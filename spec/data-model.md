# Data model

Where Adman keeps its data, the ID formats, and the project-level tables: `project_meta`, `subject`, `asset`, `job`, `report` and `variant_check`. The campaign, variant and layer tables are in `spec/data-model-campaign.md`. Read with `spec/data-rules.md` (links, sync, fan-out, data flow, migration, package, format change). The behaviour of `job` and `asset` rows is in `spec/jobs.md` and `spec/assets.md`.

## Where data lives

Built (Phase 1 and 2). Main files: `src/main/db/project-file.ts`, `src/main/db/project-registry.ts`, `src/main/db/meta.ts`.

| Location | Contents | Requirements |
|----------|----------|--------------|
| Project file `Name.adman` | One SQLite database with all project data | FR-001, R-06 |
| Assets folder, default `Name Assets/` beside the project file | Generated files, and imported files the user chose to copy | FR-007, R-07, R-08 |
| Anywhere on disk | Linked imported files | FR-001, FR-009, R-06 |
| App data folder (`app.getPath('userData')`) | `settings.json`, `secrets.bin`, `logs/`, `thumbnails/` | FR-173, FR-153 |

The product name is **Adman**. The project file extension is `.adman` (`PROJECT_EXTENSION` in `src/shared/schemas/project.ts`). The app ID is `com.adman.app`. The stakeholder chose the name knowing that other advertising products use it.

### Single owners

Each of these values lives in exactly one place. No other file may repeat it. Rows marked "not built" name the file the first phase that needs the value creates.

| Value | Single owner |
|-------|--------------|
| Asset ID to file path; "is this path at or inside that folder" (`pathAtOrInside`) | `src/main/assets/path-resolver.ts` |
| Export and publish path patterns | `src/shared/paths/output-paths.ts` (not built, Phase 8) |
| Background placement maths (used by Scene CSS and by the FFmpeg filter builder) | `src/shared/scene/background-placement.ts` (not built, Phase 3) |
| Animation preset maths | `src/shared/scene/presets.ts` (not built, Phase 7) |
| Follow rules for links | `src/shared/links/follow-rules.ts` (not built, Phase 5) |
| Agent policy (allow, ask, deny, tick per command) | `src/main/commands/agent-policy.ts` |
| Accepted file types | `src/shared/config/file-types.ts` |
| Ready-made sizes, their pixel sizes and labels, which are selected by default; default frame rate; most pictures per run | `src/shared/config/defaults.ts` |
| Smallest and largest side of a campaign size | `src/shared/config/size-limits.ts` |
| Provider IDs and default model IDs | `src/main/providers/registry.ts` |
| Provider and storage interfaces | `src/main/providers/types.ts` |
| Region to main language table | `src/shared/config/region-languages.ts` |
| Windows reserved names | `src/shared/config/reserved-names.ts` |
| The project name rule | `src/shared/schemas/project-name.ts` |
| MCP port | `settings.json` → `mcp.port` |
| Command, brief and MCP tool schemas | `src/shared/schemas/` |
| Public identifiers that are not secrets (the Dropbox app key) | `src/shared/config/public-ids.ts` (not built, Phase 9) |
| Which format changes are allowed | `src/shared/config/format-changes.ts` (not built, Phase 7; `spec/data-rules.md`, "Changing a variant's format") |
| Layout of a packaged project | `src/main/assets/package.ts` (`spec/data-rules.md`, "Package project") |
| Project meta values (name, assets folder paths and the rest) | The `project_meta` table. Nothing in memory keeps a copy. |
| Table names, each table's key fields and the row key text | `src/shared/schemas/rows/keys.ts` (`spec/api-queries-events.md`, "Wire rows") |
| Turning a stored row into a wire row and back; writing and parsing JSON column text | `src/main/db/rows.ts` |
| Content security policy text, strict and development | `src/main/windows/csp.ts` (`spec/security.md`) |
| Which job kinds run in the background and which are attached; how many jobs run at once per provider | `src/shared/config/job-kinds.ts` (`spec/jobs.md`) |
| The folder the hand-test tools may write to in cloud storage | `src/shared/config/dev-tools.ts` |

Known gap: the default variant duration (6000 ms) is held as `DEFAULT_DURATION_MS` in `src/main/commands/campaign/create.ts`, not in `defaults.ts`. It has one reader today. The next code that needs it moves it to `defaults.ts`.

### Frozen contract files

These files hold types and schemas only and are the contract between parts of the app. A change to one is a contract change and is reported, not made in passing.

| File | Holds |
|------|-------|
| `src/shared/schemas/brief.ts` | `BriefDraft`, `Brief` (`spec/brief-and-templates.md`) |
| `src/shared/schemas/commands/campaign.ts` | `campaign.create` input: `subjectMap`, `languages`, `sizes`, `ruleSet`, `copyRuleSetFrom`, `templateId`; `CampaignSize` |
| `src/shared/schemas/layer.ts` | `Geometry`, `TextStyle` (with `letterSpacing`), `ImageStyle`, `Timing`, `AnimationBlock`, `Animation`, the `revs` counters (`Revs`), and (LK-1) the look fields of both styles, `Shade`, `SHADE_SIDES`, `VERTICAL_ALIGNS`, `LOOK_LIMITS` (`spec/data-model-campaign.md`, "Look fields") |
| `src/shared/templates/types.ts` | `Template`, `Slot`, `NewLayer` (a layer's values without `id` and `variant_id`), signatures of the template functions |
| `src/main/assets/types.ts` | `AssetService`, including `missingAssetIds`, `writeManaged`, `read` |
| `src/shared/schemas/rows/` | Wire row schemas; `keys.ts` (`ROW_KEYS` for every table, `TableName`, `rowKey`) |
| `src/main/db/rows.ts` | Reads touched rows; per-table Zod check (`ROW_SCHEMAS`) |
| `src/shared/schemas/rows/job.ts` | `JobRow`, with no `errorDetail` |
| `src/main/providers/types.ts` | The six provider interfaces, `ImageFile`, `LayoutBox`, `ImageResult`, `AdapterContext`, `ProviderAdapters`, `ProviderFailure` |
| `src/main/providers/adapters.ts` | `adapterFor`, joining the provider folders |
| `src/main/jobs/types.ts` | `JobService`, `JobKindHandler`, `JobRunContext` |
| `src/shared/config/job-kinds.ts` | Each job kind's class and the per-provider concurrency |

Each provider has its own folder under `src/main/providers/` with an `index.ts` that exports its `adapters` object: `gemini`, `fal-seedance`, `fake`, `local-storage`, `s3`, `dropbox`, `azure-blob`, `comfyui`.

### SQLite settings and opening a file

**Settings** (applied on every open, in `connect`): `journal_mode = DELETE`, `synchronous = FULL`, `foreign_keys = ON`, `locking_mode = EXCLUSIVE`. A closed project is exactly one file. The exclusive lock stops a second app from opening the same project [REQ: A-02, R-06].

- While a project is open, SQLite keeps a `Name.adman-journal` file beside it. This is expected. It is removed when the project closes. After a crash it is left behind, and the next open uses it to repair the file and then removes it. Nothing in the app reads, copies or deletes the journal file itself.
- `connect` sets `journal_mode = DELETE` before any check. For a file in WAL mode, SQLite may change the header and fold a `-wal` file in, even when the open is then refused. This is accepted: "nothing is written" on a refused open means the app writes nothing of its own (no backup, no migration, no row).
- **The assets folder is created on first use**, not when the project is created: the first copied import or generated file creates it. A project with no such files has no assets folder, and that is not an error. Only `src/main/assets/` creates it (`spec/assets.md`).

**Opening** (`src/main/commands/project/open.ts`, `openProjectFile` in `src/main/db/project-file.ts`):

- Opening a project that is already open returns it as it is; paths are compared by real path (`findByPath` in `project-registry.ts`). Nothing else happens, so a running job is left alone.
- Opening a different file whose `project_id` is already open closes the new handle and refuses with `details.reason: 'duplicate_project'`.
- A file from a newer app version is refused with `RULE_VIOLATION`, reason `newer_version` (`spec/data-rules.md`, "Data migration").
- The stored name is checked before any backup or migration (`project_meta` below).
- The main process can hold any number of projects open at once. Two open projects may hold rows with the same ID (named test: two open projects with the same variant ID).

## ID formats

Built. Campaign IDs: `src/main/commands/campaign/ids.ts`.

| Thing | Format | Requirements |
|-------|--------|--------------|
| Subject | Typed by the user. 1–64 characters from `A–Z a–z 0–9 - _`. Unique in the project. | FR-011 |
| Variant | 6 characters from `23456789abcdefghjkmnpqrstuvwxyz`. Unique in the project. | FR-070 |
| Campaign | Slug of the campaign name (lowercase, `a–z 0–9 -`, max 40 characters) + `-` + 6 characters from the same alphabet. Example: `summer-splash-k3f9q2`. A name with no `a–z` or `0–9` gives `campaign-{code}`. Never changes after creation. | FR-163, FR-164 |
| Everything else | ULID | |

**An ID never picks the project.** Subject, variant and campaign IDs are unique only inside one project file, so two open projects can hold the same ID. A copy of a project file made outside the app holds the same ULIDs too. Every command and query that works on a project therefore names the project with `projectId` (`spec/api-principles.md`). No code searches the open projects for an ID.

## Tables

Built: every table below exists in the project file. The newest migration is `0003_job_kind_cutout` (`schema_version` 4, the count of migrations). Drizzle schema: `src/main/db/schema/project.ts` (project_meta, subject, asset, campaign, campaign_subject, rule_set, direction), `variant.ts` (variant, variant_subject, layer, background_clip), `jobs.ts` (job, report, variant_check). Migrations: `src/main/db/migrations/`. This file defines the project-level tables; `campaign`, `campaign_subject`, `rule_set`, `direction`, `variant`, `variant_subject`, `layer` and `background_clip` are in `spec/data-model-campaign.md`.

All tables are in the project file. Timestamps are ISO 8601 UTC text. Booleans are `INTEGER` 0 or 1. JSON columns are validated by the Zod schema named beside them. The SQL below is the shape of a file after all four migrations. Column order in a real file can differ (columns added by a migration come last); no code reads columns by position.

**Reading and writing JSON columns** (`src/main/db/rows.ts`):

- `storedJson(table, field, value): string | null` is the one writer of JSON column text. It reads `JSON_COLUMNS` (there is no second list). A field that is not a JSON column of that table throws a plain `Error`. `null` and `undefined` give null. Otherwise it returns `JSON.stringify(value)`; a result that is not a string throws.
- `parsedJson(table, field, value)`, called by `toWire`, throws `Error("<table>.<field> is not valid JSON")` for text that does not parse. The error has no `cause` and none of the parser's message, and is made inside the `catch`, so its stack holds none of V8's words. The query then answers `INTERNAL`. Test: `tests/integration/campaigns/campaign-damaged-row.test.ts`.
- `readWireRows` leaves out a row that cannot be read and logs the table and key (no value). A badge computed from rows can then be `false` where it should be `true`; this is accepted.

### project_meta

Key-value facts about the project. [REQ: FR-001, FR-007, R-06, R-07]

```sql
CREATE TABLE project_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- keys: project_id (ULID), name, schema_version, created_app_version,
--       assets_dir_rel (path relative to the project file), assets_dir_abs, created_at
```

Read shape: `projectMetaSchema` in `src/shared/schemas/project.ts` (`projectId`, `name`, `schemaVersion`, `createdAppVersion`, `assetsDirRel`, `assetsDirAbs`, `createdAt`).

**Where meta is read from.** The table is the only owner of these values.

- `project_id` never changes while a file is open. It is read once at open and kept on the open-project handle as `projectId`, beside `filePath`. The handle holds nothing else from meta.
- Every other value is read from the table at the moment it is needed, with `readMeta` in `src/main/db/meta.ts`, the one reader of `project_meta`. Seven short rows are cheap to read. After `project_meta` changes, `app.getState` and the next read show the new value. Test: `tests/integration/db/meta-not-cached.test.ts`.
- Reason: `project.setAssetsDir` changes `assets_dir_rel` and `assets_dir_abs` while the project is open. A copy made at open would then be wrong, and nothing would say so.
- No code outside `src/main/assets/` reads `assets_dir_rel` or `assets_dir_abs` to build a path. Everyone else asks `AssetService.assetsDir(project)`, which tries `assets_dir_rel` against the project file's folder first and `assets_dir_abs` second.
- A command that writes `project_meta` names the changed keys to the change recorder like any other row, so the window hears of it through `project.changed`.
- No command renames an open project. `writeMeta` is called with a name only when a project is made and on the package's own copy. A later command that renames a project must rule on how it meets `project.package` in its own design.
- If open tabs are ever remembered (Q-040), they become one more `project_meta` key, which needs no migration.

**The project name** (security class). One rule, in `src/shared/schemas/project-name.ts`:

- `projectName`: trimmed, 1 to 100 characters; none of `/ \ : * ? " < > |`; no control characters; does not start or end with a dot; not a name Windows reserves. The reserved list (`reserved-names.ts`) is matched against the part of the trimmed name before its first dot, with spaces dropped from the end of that part, so `CON.backup` is refused. `src/shared/schemas/commands/project.ts` imports and re-exports it for `project.create`.
- `storedProjectName`: the stored text passes `projectName` and equals its own trimmed self. `projectMetaSchema` uses it, so `readMeta` refuses a stored name the app could not have written. Refused examples: `../../x`, `a/b`, `..`, `.hidden`, empty, a trailing space.
- **Checked on every open, before backup.** `readStoredName(db)` in `meta.ts` reads the `name` row and checks it with `storedProjectName`. `openProjectFile` calls it after reading the version and before the `.bak` copy and any migration. Absent or failing: `notAProject()`, which is `INVALID_INPUT` with reason `not_a_project`, and nothing is written. Only the name is checked this early; other values wait for `readMeta`. Test: `tests/integration/db/project-open-old-name.test.ts`.
- **`schema_version` is digits only.** `readSchemaVersion` refuses a stored value that does not match `^[0-9]{1,9}$` with `notAProject()`. `-1`, empty, `1e0` and ` 1` are refused; no `.bak` appears and the stored value is unchanged.

### subject

[REQ: FR-010, FR-011, FR-012]

```sql
CREATE TABLE subject (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL
);
```

A subject listed twice in a brief's `subjectMap` is stored once.

### asset

One file known to the project. [REQ: FR-009, FR-050–FR-056, FR-068, R-06, R-08, R-12]

Import, linking, change detection, relink, the assets folder and the `adman-asset://` protocol are in `spec/assets.md`.

```sql
CREATE TABLE asset (
  id            TEXT PRIMARY KEY,
  library       TEXT NOT NULL,          -- CHECK asset_library: 'reference' | 'asset'
  kind          TEXT NOT NULL,          -- CHECK asset_kind: 'image' | 'video' | 'font' | 'text'
  origin        TEXT NOT NULL,          -- CHECK asset_origin: 'imported' | 'generated'
  storage       TEXT NOT NULL,          -- CHECK asset_storage: 'linked' | 'managed'
  subject_id    TEXT REFERENCES subject(id) ON DELETE SET NULL,
  display_name  TEXT NOT NULL,
  abs_path      TEXT NOT NULL,
  rel_path      TEXT NOT NULL,          -- relative to the project file
  mime          TEXT NOT NULL,
  byte_size     INTEGER NOT NULL,
  mtime_ms      INTEGER NOT NULL,
  content_hash  TEXT NOT NULL,          -- SHA-256 hex
  width         INTEGER,
  height        INTEGER,
  duration_ms   INTEGER,
  font_family   TEXT,
  font_publish_allowed INTEGER NOT NULL DEFAULT 0,
  gen_run_id    TEXT,                   -- job.id of the run that made it
  gen_provider  TEXT,
  gen_model     TEXT,
  gen_prompt    TEXT,
  created_at    TEXT NOT NULL
);
CREATE INDEX asset_subject      ON asset(subject_id);       -- offer a subject's files
CREATE INDEX asset_content_hash ON asset(content_hash);     -- find a file already in the project [REQ: FR-053]
CREATE INDEX asset_library_kind ON asset(library, kind);    -- library views
```

Wire row: `src/shared/schemas/rows/asset.ts`.

**Rules:**

- `subject_id` is a single column, so one file belongs to at most one subject [REQ: FR-011].
- `storage = 'managed'` files live in the assets folder and are named `{id}.{ext}`. `storage = 'linked'` files keep their own name and place.
- Resolving a path: try `rel_path` against the project file's folder, then `abs_path`. If neither exists the asset is missing [REQ: FR-009, R-06].
- Linked files are compared with `byte_size` and `mtime_ms` to find changes on disk (`spec/assets.md`) [REQ: R-06].
- A hero image is a row with `library = 'asset'`, `kind = 'image'` and a `subject_id`. If a subject has several, the newest fills the slot and the others are offered [REQ: R-12].
- `font_publish_allowed` is set by the user with a checkbox "I am allowed to share this font" [REQ: FR-162].
- `font_family` is null for every font as built. Phase 3 fills it for imported fonts.

**A generated asset row:**

- `origin = 'generated'`, `storage = 'managed'`, `display_name` is `{assetId}.png` for a picture, `subject_id` is null. It is inserted by the system command `asset.addGenerated`, sent only by the job runner and denied to agents.
- `gen_run_id` is the job's ID; `gen_provider` and `gen_prompt` come from the job row.
- `gen_model` is `input.model ?? job.model`. `asset.addGenerated` takes an optional `model` (1 to 200 characters), which both the picture and the video job kinds pass from the provider's result. For ComfyUI it is the workflow's main model file name from the shipped workflow file, never a name the server reports. Gemini rows keep their model. The fake provider stores its own model name. Nothing else writes `job.model`.
- A video clip's asset row has `width` and `height` empty until Phase 7's FFmpeg step fills them. The video job's result holds them.

### job

[REQ: FR-124, FR-152, FR-216, FR-217, FR-218, FR-230, FR-248, D-036]

The table's definition. What the runner does with these rows (states, writes, resume, limits, cancel) is in `spec/jobs.md`.

```sql
CREATE TABLE job (
  id            TEXT PRIMARY KEY,
  kind          TEXT NOT NULL,     -- CHECK job_kind: 'brief_extraction','image_generation','generative_fill',
                                   --   'layout_proposal','copy_options','translation','video_generation','export','publish',
                                   --   'cutout' (migration 0003)
  status        TEXT NOT NULL,     -- CHECK job_status: 'queued','running','succeeded','failed','cancelled'
  campaign_id   TEXT,              -- no foreign key
  variant_id    TEXT,              -- no foreign key
  layer_id      TEXT,              -- migration 0001. The layer the job is for, when it is for one layer
  slot          TEXT,              -- migration 0001. The template slot the job is for, when it is for a slot
  provider      TEXT,
  model         TEXT,
  request       TEXT NOT NULL,     -- JSON, enough to retry
  remote_job_id TEXT,              -- provider's job ID, used to resume
  result        TEXT,              -- JSON
  error_kind    TEXT,              -- CHECK job_error_kind: 'bad_key','quota','refused','timeout','offline','other'
  error_detail  TEXT,              -- raw provider message; main process only, never on the wire
  progress      REAL,
  paid_calls    INTEGER NOT NULL DEFAULT 0,   -- migration 0001. Calls sent to a provider that is not local
  seen_at       TEXT,              -- migration 0001. When the user looked at the finished result; null = not yet
  started_by    TEXT NOT NULL DEFAULT 'user', -- migration 0002. CHECK job_started_by: 'user' | 'agent'
  error_reason  TEXT,              -- migration 0002. No CHECK; the row schema checks it
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX job_status ON job(status, updated_at);
CREATE INDEX job_target ON job(campaign_id, variant_id);   -- migration 0001
```

Drizzle: `src/main/db/schema/jobs.ts`. In migration `0002` the `job_started_by` CHECK sits on the column (`ALTER TABLE ... ADD ... CONSTRAINT job_started_by CHECK (...)`); SQLite applies it the same as a table check. Migration `0003` rebuilds the `job` table (new table, rows copied, old dropped, renamed, indexes made again) so `job_kind` lists `cutout`; after it every CHECK, `job_started_by` included, is a table check.

**Wire row** `JobRow` (`src/shared/schemas/rows/job.ts`): `id`, `kind`, `status`, `campaignId`, `variantId`, `layerId`, `slot`, `provider`, `model`, `request`, `remoteJobId`, `result`, `errorKind` (one of `PROVIDER_ERROR_KINDS` or null), `progress`, `paidCalls`, `seenAt`, `startedBy` (`'user' | 'agent'`), `errorReason` (one of `PROVIDER_ERROR_REASONS` or null), `createdAt`, `updatedAt`. The kind and status lists come from `src/shared/config/job-kinds.ts`; the error kind and reason lists from `src/shared/schemas/queries/app.ts`.

**What the columns mean:**

- **Where a job belongs** [REQ: FR-217]. A job for a campaign has `campaign_id`. One for a variant has `campaign_id` and `variant_id`: every command that starts a job for a variant writes both (`generation.runImages`, `generation.startVideo`). One for a single layer also has `layer_id`; one that fills a template slot that has no layer yet has `slot`. These are plain text with no foreign key: the job record outlives the thing it was for, and ended job rows of a deleted campaign stay in the project. If the layer is gone, "go to that place" leads to the variant; if the variant is gone, to the campaign.
- **"Finished, not yet looked at" is not a status** [REQ: FR-218]. A job is finished and not looked at when `status = 'succeeded'` and `seen_at` is null. `job.markSeen` sets `seen_at`. A failed job is never "not looked at".
- **The result stays** [REQ: FR-216, FR-248]. The app never deletes a job row. `result` holds the asset IDs the run produced. The options of every earlier run for a layer are the `asset` rows whose `gen_run_id` is a job with that `layer_id` or `slot`.
- **`paid_calls`** [REQ: FR-230]. One per call sent to a provider that is not local, counted at the moment of sending. A campaign's total is the sum over its job rows, split by `kind`. It is a count of calls, not money.
- **`error_detail` never leaves the main process.** The wire `JobRow` has no `errorDetail`. It is the one stored column that is not on the wire. Its one reader outside the runner and the Phase 8 report is the user-only query `job.getServerMessage`, for a ComfyUI job (`spec/comfyui.md`). No job column ever holds the ComfyUI address.
- `remote_job_id` is written only through `jc.setRemoteJobId(id)`.
- `export` and `publish` are in the kind list; `job-kinds.ts` says for each kind whether it runs in the background or is attached (`spec/jobs.md`).

**Stored request and result shapes:**

- **Picture job** (`src/shared/schemas/jobs/image-generation.ts`, types `ImageJobRequest`, `ImageJobResult`). `result` is `{ assetIds: string[], failures: Record<string, number> }`, the same shape while it runs; a key of `failures` is a provider error kind. Schema: `imageJobResult = z.object({ assetIds: z.array(z.string()), failures: z.record(z.string(), z.number().int()) })`. The job kind and `run-images.ts` import these from there. The window reads the asset IDs in one function in `src/renderer/stores/job-store.ts`, which parses `row.result` with `imageJobResult` and shows no pictures when it does not fit.
- The picture size asked for is the variant's width and height, for a slot and for any layer, stored in `request`. It states a shape; the fit to a layer's box happens when a picture is placed. OI-70: whether to ask for the box's shape for a non-background layer is open.
- `request.prompt` holds the full prompt as sent, including the "no text" ending that `promptToSend` adds once, so a retry does not add it twice.
- **Video job** (`src/shared/schemas/jobs/video-generation.ts`, `VideoJobRequest`). `result` holds `hasSound`, and the clip's width and height. The three ways to start store:

| Start | `start` | `useReferences` | `referenceAssetIds` | `videoStart` | Stored `request` |
|---|---|---|---|---|---|
| From a prompt | `none` | false | `[]` | `{ firstFrame: false, references: false }` | no start fields beyond these |
| From a first-frame picture | `first_frame` | false | `[assetId]` | `{ firstFrame: true, references: false }` | `start: 'first_frame'`, `referenceAssetIds: [assetId]` |
| With a reference picture | `none` | true | `[assetId]` | `{ firstFrame: false, references: true }` | `start: 'none'`, `referenceAssetIds: [assetId]` |

Until the Scene exists, the first frame is the chosen picture asset. Phase 7 swaps in the rendered background (`spec/comfyui.md`).

### report and variant_check

[REQ: FR-114, FR-115, FR-150, FR-151]. Tables built; writers not built (Phase 6 checks, Phase 8 reports).

```sql
CREATE TABLE report (
  id          TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaign(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL,
  output_dir  TEXT NOT NULL,
  body        TEXT NOT NULL        -- JSON: Report (spec/export-and-checks.md)
);

CREATE TABLE variant_check (
  variant_id  TEXT PRIMARY KEY REFERENCES variant(id) ON DELETE CASCADE,
  checked_rev INTEGER NOT NULL,    -- variant.rev when the checks ran
  ran_at      TEXT NOT NULL,
  ran_by      TEXT NOT NULL,       -- CHECK variant_check_ran_by: 'user' | 'agent' | 'export'
  results     TEXT NOT NULL        -- JSON: CheckResult[]
);
```

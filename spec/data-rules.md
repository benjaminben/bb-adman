# Data rules

How stored data behaves: links between a master and its variants, follow rules and sync, fan-out, the path of an edit through the command bus, caching, project file migration, packaging a project, and changing a variant's format. Read with `spec/data-model.md` and `spec/data-model-campaign.md` (the tables). Jobs are in `spec/jobs.md`; asset import and the assets folder in `spec/assets.md`.

## Links, follow rules and sync

Not built (Phase 5). The follow rules live in `src/shared/links/follow-rules.ts`. The `revs`, `synced_revs`, `overrides` and `linked` columns already exist on `layer`. The rules below are the base; how Phase 5 builds them (files, the full `sync.preview` reply, override undo, refusals, fan-out inputs, fill, directions, the campaign undo list) is in `spec/links-and-sync.md`.

Layer properties are grouped. Each group has a counter in `layer.revs` that goes up by one whenever a property in the group changes.

| Group | Properties |
|-------|------------|
| copy | `copy` |
| style | all of `style` |
| geometry | all of `geometry` |
| source | `source` |
| timing | `timing` |
| animation | `animation` |

**Follow rules** [REQ: FR-079, R-02, R-05]. A linked layer follows a group as shown. "Size" means `width` × `height` in pixels. Two variants with the same ratio and different pixel dimensions are different sizes, so geometry does not follow between them. There is no ratio-based rule. The stakeholder confirmed this [D-013].

| Group | Same size as master | Different size |
|-------|---------------------|----------------|
| geometry | Follows | Does not follow |

| Group | Same language as master | Different language |
|-------|-------------------------|--------------------|
| copy | Follows | A translation of the master's copy |

| Group | Rule |
|-------|------|
| style | Always follows |
| source | Always follows |
| timing | Always follows |
| animation | Always follows |

Format never changes a follow rule. Image variants store timing and animation and ignore them when drawing.

**Out of date** [REQ: FR-081]. A linked layer is out of date for a group when the group follows (or is a translation) and `master.revs[group] > layer.synced_revs[group]`. A variant is out of date when any of its layers is, or when the master has a layer key the variant lacks, or the variant has a linked layer whose key is gone from the master. This is computed on read. It is never stored.

**Overrides** [REQ: FR-080, FR-083]. Editing an inherited property on a linked layer adds its property path to `layer.overrides`. Paths are `copy`, `source`, `timing`, `geometry` (whole group), and `style.<field>`, `animation.entrance`, `animation.exit`. A language variant that needs its own font overrides `style.fontAssetId` only, so the rest of the style still follows [REQ: FR-056].

**Sync preview** (`sync.preview` query) returns, for each out-of-date variant, the shape below (the full reply, with `masterRev` and the Phase 5 stand-in for translations, is in `spec/links-and-sync.md`, "Sync"):

```ts
type SyncPreview = {
  variantId: string
  changes: Array<{
    layerKey: string
    kind: 'update' | 'add-layer' | 'remove-layer'
    groups: string[]                 // groups that would be written
    proposed: Partial<LayerValues>   // values after the sync
    proposedTranslation?: { text: string; status: 'proposed' | 'failed' }
    blockedByOverride: string[]      // property paths skipped because of an override
  }>
}
```

When master copy changed, opening the review starts one translation job per language. The preview shows each proposed translation when it arrives. If the job fails or there is no key, `proposedTranslation.status` is `failed`, the layer keeps its current text, and the review offers retry or typing by hand [REQ: FR-084, FR-171].

**Sync apply** (`sync.apply` command) takes a list of decisions:

```ts
type SyncDecision = {
  variantId: string
  layerKey: string
  accept: boolean
  overrides: Array<{ path: string; choice: 'keep-mine' | 'take-master' }>
}
```

- `accept: true` writes the followed groups, skipping overridden paths, and sets `synced_revs` to the master's counters. An accepted translation is written with `translation_status = 'proposed'` and `translation_source = 'ai'` [REQ: FR-101].
- `keep-mine` leaves the value and the override, and marks the group as synced.
- `take-master` removes the override and writes the master's value.
- A layer not in the list stays out of date. This is how the user leaves a layer to edit by hand [REQ: FR-082, FR-083].
- The whole apply is one command and one entry on the campaign undo list.

Named test (Phase 5 exit): "editing a master changes no other variant's layer rows".

## Fan-out

Not built (Phase 5; the video format part in Phase 7; the translation in step 6 in Phase 6). Phase 5's rules (exact inputs, the fit maths, the reply, and the fill started by the window after fan-out rather than by the command) are in `spec/links-and-sync.md`, "Fan-out" and "Generative fill".

`variant.fanOut` input: direction ID, the sizes, languages and formats to cover, and one background fit choice per new size [REQ: FR-075, FR-076]. The screen calls it "Make variants". It may name a source variant other than the master (built, MV-7); then "the master" in steps 1 to 5 means that source, and the links still go to the master (`spec/make-variants.md`, "Links after making").

For every combination of size, language and format that does not already exist in the direction:

1. Create the variant with the master's title and subjects.
2. Copy every master layer with the same `key`, `linked = 1`, empty `overrides`, and `synced_revs` equal to the master's `revs`.
3. **Geometry for a new size, master's language** (built, MV-3). A box still where the master's starter layout puts it takes that layout's box at the new size; any other box is anchored to its nearer edges, gaps and lengths scaled by the ratio of the smaller sides (`spec/make-variants.md`, "Where a box goes in a new size"). Built today: each box keeps its centre at the same share of the canvas, scaled by `min(newWidth / masterWidth, newHeight / masterHeight)`.
3a. **Text size** (built, MV-4, MV-5 and MV-7). The pixel measures of each text style (font size, box padding, radius, outline) are scaled by the ratio of the smaller sides, and the font size is fitted to the words and box when either got tighter. A measure that then differs from the master's is added to `overrides`, so the rest of the style still follows (`spec/make-variants.md`, "Text that fits"). A translation run that first fills a layer's words fits its size once more, only smaller.
4. **Background for a new size**, by the user's fit choice:
   - `scale`: place the whole image inside the canvas, centred. Empty area shows black.
   - `crop`: fill the canvas with the image, centred. The parts outside are hidden, not removed.
   - `fill`: place as `scale`; then the window starts one `generative_fill` job per such size (`generation.runFill`) that extends the image to the new size. On success (`generation.applyFill`) the new asset becomes the variant's background with `source` added to `overrides`. On failure the background stays as `scale` and retry is offered [REQ: FR-076, workflow 5.2].
5. **Geometry for a new size and a new language.** Copy geometry from the variant with the same size and format in the master's language, created in step 3 [REQ: R-02].
6. **Copy for a new language.** Start one translation job per language for the direction, covering every text layer in the master. The result is written to every new variant in that language with `translation_status = 'proposed'`. If the brief supplied copy for the language, that text is used with `translation_source = 'brief'` and no job runs [REQ: FR-027]. If there is no key or the job fails, the layers keep the master's text with `translation_status = 'missing'` and the variant offers retry [REQ: workflow 5.2].
7. **Video format** (built, P7-23). Create one background clip from the variant's background picture with `addFirstClip`, which sets `first_clip_made`. When the source is a video with clips, the new video variant copies its clips and sound settings instead (built, MV-7) (`spec/make-variants.md`, "Making variants from a variant"). A background with no picture gives no clip. Image variants get none. The "Make variants" dialog offers Image and Video (`spec/screens-variants.md`, "Make variants").
8. Ask the render service to measure text overflow on each new variant.

Fan-out is one entry on the campaign undo list. Generative fill is the only image generation the fan-out dialog can start, and only when the user chose `fill` [REQ: FR-076].

## Data flow

### An edit

Built. Main files: `src/main/commands/bus.ts`, `src/main/commands/run-in-project.ts`, `src/main/commands/types.ts`, `src/main/commands/change-recorder.ts`. [REQ: FR-006, FR-200]

1. The window (or the MCP server) sends a command. The actor (`user` or `agent`) is set in the main process, never taken from the caller. A project-scope command names its project with `projectId` (`spec/api-principles.md`).
2. The command bus works in this fixed order:
   1. If the actor is `agent` and the policy is deny, return `AGENT_DENIED`.
   2. Find the handler and validate the input with Zod (`INVALID_INPUT`).
   3. For a project-scope command, find the open project by `projectId` (`NOT_FOUND`, `details.reason = 'project_not_open'`).
   4. If the actor is `agent` and the policy is `tick`, run the agent run gate (`spec/mcp-and-agents.md`). A refusal is `AGENT_DENIED`. The gate runs before `prepare`, so a refused agent causes no file read and no provider call.
   5. If the actor is `agent` and the policy is ask, ask the user now (`AGENT_REFUSED`). Asking comes after validation, so the user is never asked about a request that could not run, and the dialog can name the target.
   6. Run the handler's `prepare` step, if it has one (below).
3. The handler's `run` step runs inside one SQLite transaction on that project's file: it writes the change, bumps `revs` and `variant.rev`, and returns the inverse command. The inverse is a full command input, `projectId` included. A handler finds every entity by its ID inside that one project. An ID the project does not hold is `NOT_FOUND`.
4. The bus pushes the inverse onto the right undo list of that project, writes a log entry and emits `project.changed` with the changed rows. The handler only names the rows it touched. The bus reads them back from the file before the transaction ends, so every event carries rows in one form (`spec/api-queries-events.md`, "Wire rows").
5. Every window store for that project applies the changed rows. Agent edits therefore appear as they happen.
6. The bus never throws and never rejects. Anything a handler throws that is not a known error is logged in full and returned as `INTERNAL` (`spec/api-principles.md`). The transaction is rolled back.

### Commands that touch files

Built. A transaction must be short and synchronous, but some commands read or copy files first (`asset.import`, `asset.relink`, `project.setAssetsDir`, `project.package`, `brief.parse`). A project-scope handler may have two steps:

| Step | Runs | May do | May not do |
|------|------|--------|------------|
| `prepare(ctx, input)` (optional, asynchronous) | Before the transaction, outside it | Read the project database, read and write files, hash, sniff types | Write to the project database |
| `run(ctx, input, prepared)` (synchronous) | Inside the one transaction | Read and write the project database | Wait for anything. No file or network work beyond a quick `stat`. |

- The bus awaits `prepare` outside the transaction, checks the project is still open, then runs `run` inside it.
- Other commands can run between `prepare` and `run`. `run` checks again anything `prepare` read from the database and now relies on (for example "no asset with this content hash exists yet").
- If `run` throws, the bus calls the handler's optional `undoPrepare(prepared)` so files copied by `prepare` are removed. A file that is still left over is harmless: a file in the assets folder that no `asset` row names is not an asset.
- **When `undoPrepare` itself fails.** The command still returns the error that stopped it. The failure of `undoPrepare` never replaces that error and never turns it into `INTERNAL`. The bus writes one extra log line with `level: 'warn'`, `event: 'command'`, `name` the command's name, `ok: false`, `errorKind: null`, the message "Clean-up after a failed command did not finish.", and `context` holding the same `commandId`, `step: 'undoPrepare'` and `error` (the thrown error's name, message and stack). A leftover file takes disk space, so the log must say where it came from. The line goes to the log only (`spec/testing.md`, "Logging"), never into the reply.
- A command that writes nothing to the project (`brief.parse`, `project.package`) does its work in `prepare` and returns the prepared value from `run`. `project.package` has no `undoPrepare`; it cleans up its own partial folder.
- If the project closes during `prepare`, the command returns `NOT_FOUND` with `details.reason = 'project_not_open'` and `undoPrepare` is called.
- Work that takes longer than a few seconds, or calls a provider, is a job (`spec/jobs.md`), not a `prepare` step.
- App-scope handlers have one asynchronous `run` and no project transaction.
- The bus does not hold other commands back while a `prepare` step runs.

### Dragging

Not built (Phase 3). While the user drags, the window keeps the moving values in zustand only. On release it sends one `layer.update`. A crash loses at most that drag [REQ: 8.2].

### Text overflow

Not built (Phase 3). The Scene compares each text layer's content height and width with its box after fonts load. The editor window and the render service both report changes through `layer.reportOverflow`, a system command that is not undoable and does not bump `rev` [REQ: FR-098].

### Asset files

Built. The window never reads files. It loads images, video and fonts from `adman-asset://{projectId}/{assetId}`. The main process serves these through the path resolver. The protocol's rules are in `spec/assets.md`.

### Generation

Built for pictures and video jobs (Phase 2); placing a chosen picture in a layer is not built (Phase 3 and 4). [REQ: FR-060–FR-068]

1. The user confirms the run dialog (count and provider).
2. The job runner calls the provider, saves each result as a PNG or MP4 in the assets folder, embeds the generation details (`spec/export-and-checks.md`) and inserts an `asset` row with `origin = 'generated'` through the system command `asset.addGenerated`.
3. The user picks one. Picking is one `layer.update` that sets `source` and clears `geometry.crop`, so the picture sits in the layer's box by the Scene's rule (A-25); it calls no provider. All options stay in the asset library [REQ: FR-063]. The earlier options of a layer (Phase 4) offer the same pick (`spec/screens-ai.md`).

### Jobs, export and publish

Jobs (starting, the runner, the two classes of kind, marks, closing a project with jobs running, resume on open) are in `spec/jobs.md`. Export: `spec/export-and-checks.md`. Publish: `spec/storage-and-publish.md`.

## Caching

Not built (Phase 3, with the render service).

| Cache target | Where | TTL | Invalidation trigger |
|--------------|-------|-----|----------------------|
| Variant thumbnail (PNG, longest side 512) | `{userData}/thumbnails/{projectId}/{variantId}-{rev}.png` | None | A new `variant.rev` makes a new file. Files for old revs are deleted when the project closes. |

No asset thumbnails are made: the window draws asset pictures straight from the asset protocol (A-30). Nothing else is cached. A variant's thumbnail is drawn again when `asset.changedOnDisk` names an asset it uses (`spec/scene.md`).

## Data migration

Built. Main files: `src/main/db/project-file.ts`, `src/main/db/bundled-migrations.ts`, `src/main/db/migrations/`. The newest migration is `0005_video_and_sound`; a file with every migration has `schema_version` 6. Each migration test opens its file with the migrations up to its own only.

No legacy data [REQ: 6.4].

On open, the app compares the file's `schema_version` with its own.

- Older file: copy the project file to `Name.adman.bak`, run the pending migrations in one transaction, update `schema_version`.
- Newer file: refuse with `RULE_VIOLATION`, `details.reason = 'newer_version'`, and the message "This project was made with a newer version of the app. Download the latest version to open it."

**The migration runner.**

- The SQL files are made by drizzle-kit (`npm run db:generate`) and listed in `migrations/meta/_journal.json`. The app runs them with its own small runner in `src/main/db/project-file.ts`. `src/main/db/bundled-migrations.ts` loads them into the app bundle in journal order. Drizzle's own migrator and its `__drizzle_migrations` table are not used. Reason: the version must have one owner, and Drizzle's migrator reads a folder from disk, which a packaged app does not have.
- `project_meta.schema_version` is the number of migrations applied to the file. The app's own version is the number of migrations it carries. This is the only record of the version.
- The backup `Name.adman.bak` is made after the lock is taken, after the stored name is checked (`spec/data-model.md`, "project_meta") and before the first migration statement. It replaces an older `.bak`. It is not deleted afterwards.
- **Foreign keys.** SQLite ignores `PRAGMA foreign_keys` inside a transaction, and drizzle-kit rebuilds a table (new table, copy, drop, rename) for most column changes. With foreign keys on, a rebuild can fail or delete child rows through `ON DELETE CASCADE`. The runner therefore: sets `foreign_keys = OFF`; begins the transaction; runs the pending migrations; runs `PRAGMA foreign_key_check` and fails if it returns any row; writes `schema_version`; commits; sets `foreign_keys = ON`. On any failure the transaction is rolled back, the file is unchanged, foreign keys are switched back on and the open is refused. Test: `tests/integration/db/migration-foreign-keys.test.ts`, with a test-only second migration that rebuilds a table with child rows.
- A failed migration is a bug in the app, so it is reported as `INTERNAL` (`spec/api-principles.md`) and the full error goes to the log.

**Writing a migration.**

- Migrations are append-only. A migration committed to the main branch is never edited, reordered or deleted. A change to the schema is always a new migration file.
- **One migration at a time across worktrees.** Two developers who each generate "the next migration" make two files with the same number. A developer who finds a schema change is needed stops and reports it; the change is made once, on the main branch, before the worktrees pick it up.
- drizzle-kit writes three things: the `.sql` file, a snapshot, and the journal entry. The `.sql` text may be replaced by hand before it is committed (for example, drizzle-kit can only describe a CHECK at table level and rebuilds the table for a new one, while SQLite can add a column with its own CHECK and no rebuild). The snapshot and journal entry are kept as `db:generate` writes them; nobody edits them by hand.
- The snapshot of the newest migration equals the Drizzle schema files. After a migration, a second `npm run db:generate` must report no change and write no file. If it writes one, stop and report.
- New and upgraded project files run the same migrations, so there is one shape of each table.
- Each migration has its own test, which opens a file with the migrations up to its own only (`bundledMigrations.slice(0, n)`). So a later migration never changes an earlier test.

**The migrations so far.**

| Tag | Adds | Test |
|-----|------|------|
| `0000_initial` | Every table of `spec/data-model.md` and `spec/data-model-campaign.md` without the columns below | `tests/integration/db/project-file.test.ts` |
| `0001_agent_changed_and_job_target` | `variant.agent_changed_at`; on `job`: `layer_id`, `slot`, `paid_calls` (default 0), `seen_at`, and index `job_target`. All added columns, no rebuild. | `migration-0001.test.ts`: runs `0000` and `0001` only; a file made at version 1 holding a variant and a job keeps both rows unchanged apart from the new fields |
| `0002_job_started_by_and_error_reason` | On `job`: `started_by` (default `'user'`, CHECK `job_started_by`), `error_reason`. Two hand-written `ALTER TABLE` statements. | `migration-0002.test.ts`: three tags in order; `schema_version` 3; an old row gains `started_by: 'user'` and `error_reason: null`; `'robot'` is refused and `'agent'` accepted, in old and new files |
| `0003_job_kind_cutout` | `job_kind` CHECK lists `cutout`. A table rebuild, as drizzle-kit writes it. | `migration-0003.test.ts` (`spec/ai-jobs.md`, "Job kinds") |
| `0004_approvals` (Built, AP-5) | New tables `approval_link`, `approval_variant`, `approval_signoff` and index `approval_signoff_campaign` (`spec/approvals-client.md`, "Local tables"). No rebuild. Gives `schema_version` 5 | `migration-0004.test.ts` (`spec/approvals-client.md`, "Local tables") |
| `0005_video_and_sound` (Built, P7-2) | A rebuild of `asset` so its `asset_kind` CHECK lists `audio`, as drizzle-kit writes it (indexes and the other checks kept). On `variant`: `first_clip_made` (integer, default 0), `sound` (default `'clips'`, CHECK `variant_sound` in `'clips','file','none'`), `sound_asset_id` (references `asset(id)`, null). On `background_clip`: `sound_on` (integer, default 1). One data step: `first_clip_made = 1` for every variant that has a clip. Gives `schema_version` 6 | `migration-0005.test.ts`: every row and child row of a version 5 file kept apart from the new fields; the defaults; a variant with a clip marked; `'audio'` accepted and `'midi'` refused; `sound: 'loud'` refused; a `sound_asset_id` naming no asset refused |

## Package project

Built. Main files: `src/main/assets/package.ts` (owns the layout), `src/main/commands/project/package.ts`. Security class. [REQ: FR-008, R-09, D-011, D-022, D-027]

`project.package` copies everything related to the project into one new folder. The original project is not changed. What a package holds is as listed below [D-022]. Refusing when a file is missing, unless the user confirms skipping it, is accepted [D-027].

**Input:** `projectId`, `targetDir`, `skipMissing` (default false). Schema in `src/shared/schemas/commands/asset.ts`.

**Result on disk:**

```
{targetDir}/{Name}/
  {Name}.adman
  {Name} Assets/
    {assetId}.{ext}        one file for every asset row
```

**What is copied:** the project file, and the file behind every `asset` row. That is both libraries, linked and managed files, imported and generated files, and generated options that no variant uses.

**What is not copied:** keys, settings, the log, thumbnails, undo lists, `.bak` files, and files in the assets folder that no `asset` row names. A package never holds a secret [REQ: 6.3].

**Steps:**

1. **Check the target.** The project name is read once with `readMeta` and handed to every later step; no later step reads it again.
   - `{targetDir}/{Name}` and `{targetDir}/{Name}.partial` must be direct children of `targetDir` after resolving, whatever the project file holds. Otherwise the command refuses with `INVALID_INPUT`, reason `not_a_project`, and nothing is made.
   - `targetDir` not absolute: `INVALID_INPUT`, "Choose a folder." A missing target folder: `NOT_FOUND`, "That folder was not found."
   - `targetDir` is the project's assets folder or inside it, judged on real paths with `pathAtOrInside(realpath(assets folder), realpath(target))`: `RULE_VIOLATION`, "Choose a folder outside the project's assets folder." A link does not get past this, and a folder named `..x` is not judged outside.
   - `{targetDir}/{Name}` exists and is not a folder: `RULE_VIOLATION`, "Something named {Name} is already there." It is a folder that is not empty: `RULE_VIOLATION`, "A folder named {Name} is already there and not empty."
2. **Find every file.** Resolve every asset row through the path resolver. A row counts as missing when:
   - its file is not found;
   - the file's extension (from its base name only) is not listed in `file-types.ts` for the row's `kind`, or its first bytes do not match that type (the same check import uses);
   - the row's `id` and the extension cannot form a managed file name (`isManagedName`).

   If any row is missing and `skipMissing` is false, write nothing and return `MISSING_FILE` with `details.assetIds`. Never `INTERNAL`. The window lists the missing files. The user relinks them, or sends the command again with `skipMissing: true` [REQ: FR-009]. An asset made through the app's commands passes while its file is unchanged; a file changed on disk into another type counts as missing.
3. Work in `{targetDir}/{Name}.partial/`. A leftover `{Name}.partial` is refused with `RULE_VIOLATION` ("A folder named {Name}.partial is in the way.") and left alone. Rename the partial folder to `{Name}/` when every step has finished. On any failure, delete the partial folder.
4. Copy the project database with SQLite's online backup (`backup` in better-sqlite3). A plain file copy of an open database is not allowed.
5. Copy each found asset file to `{Name} Assets/{assetId}.{ext}`, where `ext` is the source file's extension. A file is never written over an existing one. Bytes are not changed, so generated files keep their embedded details (`spec/export-and-checks.md`).
6. Open the copied database and rewrite it in one transaction. Only the copy is written.
   - Each copied asset: `storage = 'managed'`, `rel_path = '{Name} Assets/{assetId}.{ext}'`, `abs_path` = the file's full path inside the package, and `byte_size`, `mtime_ms`, `content_hash` read again from the copied file. `display_name` keeps the original file name.
   - Each skipped asset: the row is left as it is. It shows as missing in the package.
   - `project_meta`: a new `project_id`, `assets_dir_rel = '{Name} Assets'`, `assets_dir_abs` = the folder's full path inside the package. The new ID lets the original and the package be open at the same time.
   - `job` rows with status `queued` or `running` become `cancelled`, so a paid job is not resumed from two places.
7. Return `{ packagePath, fileCount, totalBytes, skippedAssetIds }`. `fileCount` and `totalBytes` count the project file as well as the asset files.

**Why the package opens with nothing missing.** Every `rel_path` in the package points inside the package, and the resolver tries `rel_path` against the project file's folder before `abs_path`. The assets folder is found the same way: `assets_dir_rel` against the project file's folder first, then `assets_dir_abs`. The stale absolute paths from the first machine are never needed.

The command is not undoable and does not change any `rev`. It never opens the copy, so it does not tell the job runner anything; the copy's rows are settled when someone opens it (`spec/jobs.md`).

## Changing a variant's format

Built: the command (P7-10, `src/main/commands/variant/set-format.ts`, with the undo fix P7-10b) and the MCP tool `set_variant_format` (P10-13). [REQ: FR-070, FR-120, workflow 5.5 step 1, R-20, D-012, D-020, D-025, D-026]

`variant.setFormat` changes one variant from one format to the other. Input: `projectId`, `variantId`, `format`. Setting the format a variant already has changes nothing and returns success.

**Allowed changes.** `src/shared/config/format-changes.ts` holds the one table of allowed changes. The command schema accepts both formats. The handler looks the change up in this table and nothing else in the code knows which directions are allowed.

| From | To | In this build |
|------|----|---------------|
| image | video | Allowed [D-012] |
| video | image | Allowed [D-020] |

**The grid test, both directions.** The `variant_grid` unique index stays as it is. Before any write, the handler refuses with `RULE_VIOLATION` if the direction already has another variant with the same `size_label` and `language` in the target format. Nothing is written when it refuses.

| Change | Refused when the direction already has | Message |
|--------|----------------------------------------|---------|
| image to video | A video variant at this size and language | "This direction already has a video post at this size and language." |
| video to image | An image variant at this size and language | "This direction already has an image post at this size and language." |

**Image to video:**

1. Run the grid test.
2. Set `format = 'video'`. `duration_ms` and `duration_overridden` keep their stored values. The user changes the duration with `variant.update`.
3. If `first_clip_made` is 0, the variant has no `background_clip` rows and its background layer has a usable `source`, create one clip from that asset at 0 (`addFirstClip` in `src/main/clips/write-clip.ts`) and set `first_clip_made` to 1. The clip runs to `duration_ms` for a still; for a video file it runs the file's own length. This is the same clip fan-out creates ("Fan-out", step 7). If the background layer has no `source`, no clip is created and the track shows black.
4. Layers are not touched and no layer `revs` change. `variant.rev` goes up by one, so the thumbnail is redrawn and the last check result becomes stale.

**Video to image:**

1. Run the grid test.
2. Set `format = 'image'`. This is the only column the change writes, apart from `variant.rev` going up by one.
3. No `background_clip` row is deleted or changed. An image variant ignores that table and draws its background layer's `source`.
4. Layers are not touched and no layer `revs` change.

**Video settings survive the round trip** [REQ: D-026]. A variant changed from video to image and back to video has every video setting it had before, unchanged. `variant.setFormat` never deletes or rewrites any of these in either direction:

| Stored in | Values kept |
|-----------|-------------|
| `variant` | `duration_ms`, `duration_overridden` |
| `background_clip` | Every row: `id`, `asset_id`, `start_ms`, `in_ms`, `out_ms`, `placement`. So the clips, their order on the track, their trims and their placement. |
| `layer` | `timing`, `animation` (entrance and exit blocks), their counters in `revs` and `synced_revs`, and the `timing`, `animation.entrance` and `animation.exit` paths in `overrides` |

- These are all the video-only values in the schema. Frame rate is an export choice and is not stored on a variant.
- On the way back to video, step 3 of "Image to video" finds the kept clips and creates nothing.
- `asset.remove` is refused while a clip uses the asset, whatever the variant's format (`spec/api-commands.md`). So a file a kept clip needs cannot be removed while the variant is an image.
- A video generation job that finishes while its variant is an image still adds its clip (`spec/jobs.md`). The clip is kept like any other.
- The guarantee covers what the format change does. Edits made while the variant is an image are ordinary edits and stay: a sync still writes followed timing and animation to a linked variant, and a new background image changes `source` but no clip.
- If another video variant was added at the same size and language while this one was an image, changing back is refused by the grid test. The video settings stay stored on the variant, so nothing is lost and the change works once the other variant is deleted or changed.

**OI-20, settled by `first_clip_made`** (A-180, migration 0005). A video variant whose track the user emptied on purpose keeps `first_clip_made` at 1, so after video to image and back step 3 makes no clip and the track stays empty. Any clip add sets it to 1.

**Undo and redo of the first clip** (P7-10b). The inverse of an image-to-video change that made the first clip carries `undoClipId`: the undo removes that clip and sets `first_clip_made` back to 0 when the track is then empty. The inverse of that undo carries `redoClipId`: the redo makes the clip again under the same ID, so a later redo of a clip edit finds it. Both fields take a ULID only. `variant.update` has the same kind of field, `durationOverridden`, which its inverse carries.

**Undo-only fields.** `undoClipId`, `redoClipId` and `durationOverridden` are accepted only while the bus replays an inverse for `history.undo` or `history.redo` (`ctx.replay`), and never from an agent. Sent at any other time they are refused with `INVALID_INPUT`, "Only an undo or redo names a clip this way." (for `durationOverridden`: "Only an undo or redo sets the duration flag."). A hand-sent `undoClipId` would otherwise delete a clip with no way back. The MCP tool's published input leaves all three out.

**Master and linked variants.** The command works the same on both.

- Format is not a layer property and never changes a follow rule. Changing a master's format does not make any linked variant out of date and does not change any linked variant's format.
- A linked variant stays linked. It stores the timing and animation it follows from the master in either format, and draws them when it is a video. Its clips are its own and are never synced [REQ: R-05].

**Undo:** the variant's list. The inverse restores the format and removes the clip created in step 3, if one was created. Undo and redo run the grid test like the command itself. If the cell is now taken, the undo or redo is refused with `RULE_VIOLATION`, nothing changes and the entry stays on the list. The general rule for a refused undo or redo is in `spec/api-principles.md`, "Undo".

**Agent policy:** allow [D-025]. The MCP tool is `set_variant_format` (`spec/mcp-and-agents.md`). The change deletes nothing, the user can undo it from the variant's list, and the agent can change it back, so it is an ordinary edit and not a destructive action under FR-197.

**Named tests (Phase 7 exit):** the format round-trip test and the refused-format-change test.

# SPEC.md — Technical Specification

**Project:** Adman
**Version:** 1.2 — Draft
**Date:** 2026-11-20
**Architect:** Solution Architect
**Based on:** REQUIREMENTS.md v1.0
**Status:** In Review

**How to read this document**

- `[REQ: FR-001]` links a decision to REQUIREMENTS.md. `[REQ: R-06]` links to a requirement change agreed during architecture (Section 0).
- Where this document and REQUIREMENTS.md differ, this document wins. Section 0 lists every difference.
- `> ⚠️ Decision Required:` marks something that must be settled before or during the phase it names.
- Library versions in Section 2 are minimum major versions. The architect did not verify the newest releases. The developer pins the latest stable release of each at the start of Phase 1 and records it in the lockfile.

---

## 0. Requirement Changes Agreed During Architecture

The stakeholder approved each of these in the design dialogue. REQUIREMENTS.md should be updated by the Requirements Analyst to match.

| # | Decision | Effect on REQUIREMENTS.md |
|---|----------|---------------------------|
| R-01 | An agent creates a campaign by sending structured brief fields. The app makes no AI extraction call for an agent and shows no confirm form. The campaign appears in the app at once and can be undone. | Refines FR-195, FR-022, FR-023 |
| R-02 | In fan-out, a variant that differs from the master in both size and language copies its text geometry once from the variant with the same size in the master's language. This is a one-time copy, not a link. | Refines FR-075, FR-078, FR-079 |
| R-03 | Rule set word lists are held per language. Required words are checked against the combined text of a variant. Prohibited words are checked in every text layer. | Refines FR-033, FR-113 |
| R-04 | The MCP server requires a token as well as listening on 127.0.0.1 only. | Extends FR-191 |
| R-05 | Image and video variants can share one master. Format is a fan-out choice. Timing and animation are stored on every layer and follow the master. | Confirms FR-075, refines FR-079 |
| R-06 | A project is a single file with a custom extension. It links to asset files that stay where they are on the user's machine. | Reverses FR-001, A-01 |
| R-07 | Generated files go to a folder beside the project file, named after it. The user can change the location per project. | Replaces part of FR-001 |
| R-08 | Import links files by default. The import dialog offers "copy into the assets folder" as a choice. | Reverses FR-052, C-07 |
| R-09 | A "Package project" command gathers the project file and all linked files into one folder. This is how a project moves to another machine. | Replaces the portability success criterion in 1.3 |
| R-10 | Saved keys can never be viewed. The app shows the last four characters. The user can replace or delete a key. | Replaces the view rule in FR-173 |
| R-11 | An agent can list assets and fonts by name and ID, without file contents. | Extends FR-192 |
| R-12 | A project has two libraries. The reference library holds files used only as input to image generation. The asset library holds files that can go on a post. A hero image is an asset-library image attached to a subject. | Refines FR-054, FR-055 |
| R-13 | A required asset is "present and visible" when a layer uses it, the layer is not hidden, its opacity is above zero and part of it is inside the canvas. For video, the layer must be on screen for part of the duration. The check does not test whether another layer covers it. | Defines FR-110 |
| R-14 | No GSAP. Animation presets are plain functions of time. | Replaces a preference in 9.1 |
| R-15 | Cloud storage in this build: Amazon S3 and Dropbox. Azure is listed but disabled. | Extends FR-160 |
| R-16 | Installers are unsigned in this build. Security warnings on first launch are accepted. | Refines 8.7 |
| R-17 | Undo has one list per variant and one list per campaign. Deleting a variant can be undone from the campaign list. | Refines FR-095 |
| R-18 | Export also warns about unapproved translations and overflowing text. The user can proceed, and the warnings and the decision go in the report, as with brand and legal checks. | Extends FR-114, FR-115 |
| R-19 | The licence is PolyForm Noncommercial 1.0.0. | Closes OI-02 |

R-12 and R-13 were proposed three times and not corrected. They are treated as accepted.

---

## 1. Architecture Overview

### 1.1 Pattern & Rationale

A local modular monolith inside one Electron app. There is no server and no cloud component owned by the app.

End state in one sentence: **one installed app where the main process owns all data and rules, and windows only draw.**

- The main process owns project files, edit commands, undo, jobs, providers, keys and the MCP server.
- The app window is a React UI. It sends commands and draws what the main process tells it.
- A hidden render window draws posts for export, thumbnails and agent pictures, using the same drawing component as the editor.
- FFmpeg runs as a child process to encode video.

Drivers: user and agent edits must follow one set of rules [REQ: FR-200]; keys must never reach the UI or the agent [REQ: FR-198]; preview must match export [REQ: FR-130, FR-131]; manual work must run with no keys and no network [REQ: 8.2].

**Alternatives Considered:**

| Option | Reason Rejected |
|--------|-----------------|
| Business logic in the app window | Agent edits must work whichever tab is showing. Keys must stay out of the UI. [REQ: FR-198, FR-200] |
| Separate MCP background service | The agent may only touch projects open in the app. [REQ: FR-201] |
| Local web server plus browser UI | Electron is fixed by the stakeholder. [REQ: 9.1] |
| Canvas library (Konva) for drawing | Worse text handling. HTML gives fonts, CJK, wrapping and overflow detection. [REQ: FR-056, FR-098] |
| GSAP timelines | Licence restricts visual no-code animation tools. Plain functions are simpler to make frame-exact. [REQ: R-14, FR-131] |

### 1.2 System Context Diagram

```
                         ┌──────────────────────────────────────────────┐
                         │                Electron app                  │
 Creative User ────────► │  App window (React, zustand)                 │
                         │      │ commands / queries      ▲ events      │
                         │      ▼                         │             │
                         │  Main process                                │
                         │   ├─ Command bus + policy + undo             │
                         │   ├─ Project store (SQLite per project file) │──► Project file (.adman)
                         │   ├─ Asset path resolver                     │──► Linked files, assets folder
                         │   ├─ Job runner                              │
                         │   ├─ Providers ──────────────────────────────┼──► Gemini, fal.ai, S3, Dropbox
                         │   ├─ Key store (system key store)            │──► App data folder
                         │   ├─ MCP server (127.0.0.1 + token) ◄────────┼─── External agent (Claude)
                         │   └─ Render service                          │
                         │         │                                    │
                         │         ▼                                    │
                         │  Hidden render window (Scene component)      │
                         │         │ frames                             │
                         │         ▼                                    │
                         │  FFmpeg child process ───────────────────────┼──► Exported files
                         └──────────────────────────────────────────────┘
```

External actors:

| Actor | Interaction |
|-------|-------------|
| Creative User | Uses the app window |
| External agent (Claude Code, Claude Desktop) | Calls MCP tools on 127.0.0.1 |
| Gemini API | Image, layout and text jobs, on the user's key |
| fal.ai | Image-to-video jobs, on the user's key |
| Amazon S3, Dropbox | Publishing, on the user's account |
| Teammates | Browse published files in cloud storage. Never use the app. |

### 1.3 Component Map

| Component | Responsibility | Technology |
|-----------|----------------|------------|
| App window | UI, per-tab state, transient drag state | React, zustand, Radix UI |
| Preload bridge | Exposes a typed `window.api` with `command`, `query`, `on` | Electron contextBridge |
| Command bus | Validates, applies the agent policy, runs a command in one transaction, records undo, emits events, writes the log | TypeScript, Zod |
| Project store | Opens project files, runs migrations, typed reads and writes | better-sqlite3, Drizzle |
| Asset path resolver | The only code that turns an asset ID into a file path | TypeScript |
| Link engine | Follow rules, out-of-date calculation, sync preview and apply | TypeScript (shared, pure) |
| Check engine | Brand and legal checks | TypeScript (shared, pure) |
| Scene | Draws one variant at one time. Used by editor, thumbnails, agent pictures, export. | React, HTML, CSS |
| Render service | Drives the hidden window, captures frames | Electron offscreen window |
| Export service | Image and video export, report, translation sheet | FFmpeg child process |
| Job runner | Queues, runs, resumes and retries background jobs | TypeScript |
| Provider registry | Adapters behind six interfaces | Provider SDKs |
| Key store | Encrypts and holds secrets | Electron safeStorage |
| MCP server | Tools for the external agent | MCP TypeScript SDK |
| MCP bridge mode | Lets agent apps that only launch command-line servers reach the running app | Same executable, `--mcp-bridge` flag |
| Activity log | JSON lines log of commands, jobs and errors | TypeScript |

---

## 2. Technology Stack

| Layer | Technology | Version (minimum) | Justification |
|-------|------------|-------------------|---------------|
| Desktop shell | Electron | 35 | Fixed [REQ: 9.1] |
| Frontend | React, TypeScript strict | React 19, TypeScript 5.6 | Fixed (React) [REQ: 9.1] |
| State (window) | Zustand | 5 | Stakeholder choice |
| UI controls | Radix UI primitives, CSS Modules | Radix 1 | Keyboard and screen-reader support [REQ: 8.6] |
| Backend | Electron main process, Node.js as bundled | — | Section 1.1 |
| Primary Database | SQLite through better-sqlite3 | 11 | Fixed (SQLite) [REQ: 9.1] |
| Query layer and migrations | Drizzle ORM, drizzle-kit | 0.36 | Typed queries [stakeholder confirmed] |
| Validation | Zod | 3.23 | One schema set for briefs, commands, MCP tools [REQ: FR-200] |
| Cache | None. Thumbnails are files in the app data folder. | — | No requirement for more |
| Message Queue / Event Bus | In-process job runner and Electron IPC | — | Single-user desktop app |
| Authentication | None for the user. Bearer token for MCP. | — | [REQ: 8.4, R-04] |
| File / Object Storage | Local disk. `@aws-sdk/client-s3` + `@aws-sdk/lib-storage`, `dropbox` SDK for publishing. | AWS SDK 3, dropbox 10 | [REQ: FR-160, R-15] |
| Search | None | — | Not required |
| AI: image, layout, text | Google Gen AI SDK (`@google/genai`) | 1 | Stakeholder preference [REQ: IR-002] |
| AI: video | fal client (`@fal-ai/client`), Seedance | 1 | Stakeholder preference [REQ: IR-002, OI-04] |
| Agent protocol | `@modelcontextprotocol/sdk`, Streamable HTTP transport | 1 | Fixed (MCP) [REQ: IR-003] |
| Video encoding | FFmpeg, LGPL build | 7 | Fixed (FFmpeg) [REQ: FR-143]; LGPL per licence intent [REQ: 9.3] |
| YAML parsing | `yaml` | 2 | [REQ: FR-020] |
| Monitoring / Logging | Local JSON lines log | — | [REQ: FR-153] |
| Infrastructure / IaC | None | — | No servers |
| CI/CD | GitHub Actions | — | Public repo [REQ: 9.2] |
| Build | electron-vite | 2 | |
| Packaging | electron-builder (DMG for macOS arm64 and x64, NSIS for Windows x64) | 25 | [REQ: 8.8] |
| Tests | Vitest, Testing Library, axe-core, Playwright (Electron) | Vitest 2, Playwright 1.48 | Section 10 |
| Lint and format | ESLint, Prettier (`semi: false`) | ESLint 9 | Stakeholder code rules |
| Container Runtime | None | — | Desktop app |
| Orchestration | None | — | Desktop app |

**Constraints Observed:**

- Electron, React, SQLite, FFmpeg and MCP are fixed by REQUIREMENTS.md 9.1.
- Text is drawn with HTML, matching the preference in 9.1.
- FFmpeg burns text into video on export, matching the preference in 9.1.
- The preference for GSAP in 9.1 is replaced [REQ: R-14].
- The preference for one storage interface with local and cloud versions is kept (Section 6.5).
- Every bundled dependency must be compatible with the app licence (Section 8.4). FFmpeg must be built with `--disable-gpl --disable-nonfree`.

---

## 3. Data Architecture

### 3.1 Where data lives

| Location | Contents | Requirements |
|----------|----------|--------------|
| Project file `Name.adman` | One SQLite database with all project data | R-06 |
| Assets folder, default `Name Assets/` beside the project file | Generated files, and imported files the user chose to copy | R-07, R-08 |
| Anywhere on disk | Linked imported files | R-06 |
| App data folder (`app.getPath('userData')`) | `settings.json`, `secrets.bin`, `logs/`, `thumbnails/` | FR-173, FR-153 |

The product name is **Adman**. The project file extension is `.adman`. The app ID is `com.adman.app`. The stakeholder chose the name knowing that other advertising products use it.

**Single owners.** Each of these values lives in exactly one place. No other file may repeat it.

| Value | Single owner |
|-------|--------------|
| Asset ID to file path | `src/main/assets/path-resolver.ts` |
| Export and publish path patterns | `src/shared/paths/output-paths.ts` |
| Background placement maths (used by Scene CSS and by the FFmpeg filter builder) | `src/shared/scene/background-placement.ts` |
| Animation preset maths | `src/shared/scene/presets.ts` |
| Follow rules for links | `src/shared/links/follow-rules.ts` |
| Agent policy (allow, ask, deny per command) | `src/main/commands/agent-policy.ts` |
| Accepted file types | `src/shared/config/file-types.ts` |
| Default sizes, default duration, default frame rate | `src/shared/config/defaults.ts` |
| Provider IDs and default model IDs | `src/main/providers/registry.ts` |
| Region to main language table | `src/shared/config/region-languages.ts` |
| MCP port | `settings.json` → `mcp.port` |
| Command, brief and MCP tool schemas | `src/shared/schemas/` |

**SQLite settings** (applied on every open): `journal_mode = DELETE`, `synchronous = FULL`, `foreign_keys = ON`, `locking_mode = EXCLUSIVE`. A closed project is exactly one file. The exclusive lock stops a second app from opening the same project [REQ: A-02, R-06].

### 3.2 ID formats

| Thing | Format | Requirements |
|-------|--------|--------------|
| Subject | Typed by the user. 1–64 characters from `A–Z a–z 0–9 - _`. Unique in the project. | FR-011 |
| Variant | 6 characters from `23456789abcdefghjkmnpqrstuvwxyz`. Unique in the project. | FR-070 |
| Campaign | Slug of the campaign name (lowercase, `a–z 0–9 -`, max 40 characters) + `-` + 6 characters from the same alphabet. Example: `summer-splash-k3f9q2`. Never changes after creation. | FR-163, FR-164 |
| Everything else | ULID | |

### 3.3 Data Models

All tables are in the project file. Timestamps are ISO 8601 UTC text. JSON columns are validated by the Zod schema named beside them.

#### project_meta
**Description:** Key-value facts about the project. **Requirements Traced:** [REQ: R-06, R-07]

```sql
CREATE TABLE project_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- keys: project_id (ULID), name, schema_version, created_app_version,
--       assets_dir_rel (path relative to the project file), assets_dir_abs, created_at
```

#### subject
**Requirements Traced:** [REQ: FR-010, FR-011, FR-012]

```sql
CREATE TABLE subject (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL
);
```

#### asset
**Description:** One file known to the project. **Requirements Traced:** [REQ: FR-050–FR-056, FR-068, R-06, R-08, R-12]

```sql
CREATE TABLE asset (
  id            TEXT PRIMARY KEY,
  library       TEXT NOT NULL CHECK (library IN ('reference','asset')),
  kind          TEXT NOT NULL CHECK (kind IN ('image','video','font','text')),
  origin        TEXT NOT NULL CHECK (origin IN ('imported','generated')),
  storage       TEXT NOT NULL CHECK (storage IN ('linked','managed')),
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
```

**Indexes:**
- `asset(subject_id)` — offer a subject's files
- `asset(content_hash)` — detect a file already in the project and reuse it [REQ: FR-053]
- `asset(library, kind)` — library views

**Rules:**
- `subject_id` is a single column, so one file belongs to at most one subject [REQ: FR-011].
- `storage = 'managed'` files live in the assets folder and are named `{id}.{ext}`. `storage = 'linked'` files keep their own name and place.
- Resolving a path: try `rel_path` against the project file's folder, then `abs_path`. If neither exists the asset is missing [REQ: R-06].
- On project open and when the app window regains focus, the resolver compares `byte_size` and `mtime_ms` for linked files. On a change it re-reads the hash and size, bumps the asset's thumbnails, and writes a log entry [REQ: R-06].
- A hero image is a row with `library = 'asset'`, `kind = 'image'` and a `subject_id`. If a subject has several, the newest fills the slot and the others are offered [REQ: R-12].
- `font_publish_allowed` is set by the user with a checkbox "I am allowed to share this font" [REQ: FR-162].

#### campaign
**Requirements Traced:** [REQ: FR-030–FR-034, FR-043]

```sql
CREATE TABLE campaign (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  region           TEXT NOT NULL,
  audience         TEXT NOT NULL,
  message          TEXT NOT NULL,
  offer            TEXT,
  call_to_action   TEXT,
  tone             TEXT,
  primary_language TEXT NOT NULL,       -- BCP-47
  languages        TEXT NOT NULL,       -- JSON: string[] of BCP-47 tags, includes primary
  sizes            TEXT NOT NULL,       -- JSON: CampaignSize[]
  template_id      TEXT NOT NULL,
  brief            TEXT NOT NULL,       -- JSON: the confirmed Brief
  created_by       TEXT NOT NULL CHECK (created_by IN ('user','agent')),
  created_at       TEXT NOT NULL
);

CREATE TABLE campaign_subject (
  campaign_id TEXT NOT NULL REFERENCES campaign(id) ON DELETE CASCADE,
  subject_id  TEXT NOT NULL REFERENCES subject(id),
  PRIMARY KEY (campaign_id, subject_id)
);
```

```ts
type CampaignSize = { label: string; width: number; height: number }
// label is file-safe: "1x1", "9x16", "16x9", or "{width}x{height}" for custom pixel sizes
```

A custom ratio `a:b` becomes a pixel size whose shorter side is 1080 [REQ: FR-032].

#### rule_set
**Requirements Traced:** [REQ: FR-033, FR-034, R-03]

```sql
CREATE TABLE rule_set (
  campaign_id        TEXT PRIMARY KEY REFERENCES campaign(id) ON DELETE CASCADE,
  required_asset_ids TEXT NOT NULL DEFAULT '[]',  -- JSON: asset IDs
  palette            TEXT NOT NULL DEFAULT '[]',  -- JSON: "#RRGGBB"[]
  required_words     TEXT NOT NULL DEFAULT '{}',  -- JSON: { [language]: string[] }
  prohibited_words   TEXT NOT NULL DEFAULT '{}'   -- JSON: { [language]: string[] }
);
```

Copying a rule set copies the four JSON values from the source campaign [REQ: FR-034].

#### direction
**Requirements Traced:** [REQ: FR-072, FR-073, FR-074]

```sql
CREATE TABLE direction (
  id                TEXT PRIMARY KEY,
  campaign_id       TEXT NOT NULL REFERENCES campaign(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  master_variant_id TEXT NOT NULL,
  sort              INTEGER NOT NULL
);
```

`master_variant_id` is set when the direction is created and no command changes it [REQ: FR-073].

#### variant
**Requirements Traced:** [REQ: FR-070, FR-071, FR-120]

```sql
CREATE TABLE variant (
  id            TEXT PRIMARY KEY,
  direction_id  TEXT NOT NULL REFERENCES direction(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  width         INTEGER NOT NULL,
  height        INTEGER NOT NULL,
  size_label    TEXT NOT NULL,
  language      TEXT NOT NULL,
  format        TEXT NOT NULL CHECK (format IN ('image','video')),
  duration_ms   INTEGER NOT NULL,          -- used when format = 'video' or any sibling is video
  duration_overridden INTEGER NOT NULL DEFAULT 0,
  rev           INTEGER NOT NULL DEFAULT 0, -- +1 on every change to the variant, its layers or clips
  created_by    TEXT NOT NULL CHECK (created_by IN ('user','agent')),
  created_at    TEXT NOT NULL
);

CREATE TABLE variant_subject (
  variant_id TEXT NOT NULL REFERENCES variant(id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL REFERENCES subject(id),
  PRIMARY KEY (variant_id, subject_id)
);

CREATE UNIQUE INDEX variant_grid ON variant(direction_id, size_label, language, format);
```

- The title defaults to the variant's subject IDs joined with `+` [REQ: FR-142].
- The master is the variant named by `direction.master_variant_id`.
- Default duration is 6000 ms. Default export frame rate is 30 [REQ: A-07].

#### layer
**Requirements Traced:** [REQ: FR-078–FR-083, FR-090–FR-094, FR-098, FR-101, FR-127–FR-129]

```sql
CREATE TABLE layer (
  id            TEXT PRIMARY KEY,
  variant_id    TEXT NOT NULL REFERENCES variant(id) ON DELETE CASCADE,
  key           TEXT NOT NULL,       -- shared with the matching layer in the master
  type          TEXT NOT NULL CHECK (type IN ('background','image','text')),
  slot          TEXT,                -- template slot ID, if the layer fills one
  name          TEXT NOT NULL,
  z             INTEGER NOT NULL,
  visible       INTEGER NOT NULL DEFAULT 1,
  locked        INTEGER NOT NULL DEFAULT 0,
  linked        INTEGER NOT NULL DEFAULT 0,
  overrides     TEXT NOT NULL DEFAULT '[]',  -- JSON: property paths, e.g. "style.fontAssetId"
  copy          TEXT,                -- text layers: the text
  style         TEXT NOT NULL,       -- JSON: TextStyle | ImageStyle
  geometry      TEXT NOT NULL,       -- JSON: Geometry
  source        TEXT,                -- JSON: { assetId } for image and background layers
  timing        TEXT NOT NULL,       -- JSON: Timing
  animation     TEXT NOT NULL,       -- JSON: Animation
  revs          TEXT NOT NULL,       -- JSON: { copy, style, geometry, source, timing, animation } counters
  synced_revs   TEXT NOT NULL,       -- JSON: master counters this layer last synced to
  translation_status TEXT CHECK (translation_status IN ('missing','proposed','approved')),
  translation_source TEXT CHECK (translation_source IN ('ai','agent','user','brief')),
  overflow      INTEGER NOT NULL DEFAULT 0,
  UNIQUE (variant_id, key)
);
CREATE INDEX layer_variant ON layer(variant_id, z);
```

```ts
type Geometry = {
  x: number; y: number; width: number; height: number   // pixels, top-left origin
  rotation: number                                       // degrees
  crop: { x: number; y: number; width: number; height: number } | null  // in source pixels
}
type TextStyle = {
  fontAssetId: string | null    // null = bundled default font
  fontSize: number; fontWeight: number
  color: string                 // "#RRGGBB"
  align: 'left' | 'center' | 'right'
  lineHeight: number            // multiple of font size
}
type ImageStyle = { opacity: number }                    // 0 to 1
type Timing = { startMs: number; endMs: number | null }  // null = end of the variant
type AnimationBlock = {
  preset: 'none' | 'fade' | 'fade-up' | 'slide' | 'stagger-words'
  startMs: number               // relative to the variant start
  durationMs: number
}
type Animation = { entrance: AnimationBlock; exit: AnimationBlock }
```

**Rules:**
- A background layer's geometry and crop are its stored transform. The source file is never changed, so cropping never discards pixels [REQ: FR-077].
- Each variant has exactly one background layer with `z = 0`. It cannot be deleted or reordered.
- A linked layer matches the master layer with the same `key`. Links are one level deep because only a direction's master can be the target [REQ: FR-078].
- Every variant stores its own full values. A sync is the only thing that writes master values into a linked layer [REQ: FR-081].
- `translation_status` is null on layers in the campaign's primary language and on non-text layers.
- `overflow` is written by the Scene when it measures a text layer (Section 3.6) [REQ: FR-098].
- Only text layers may have a preset other than `none` [REQ: FR-128].

#### background_clip
**Requirements Traced:** [REQ: FR-121, FR-122]

```sql
CREATE TABLE background_clip (
  id          TEXT PRIMARY KEY,
  variant_id  TEXT NOT NULL REFERENCES variant(id) ON DELETE CASCADE,
  asset_id    TEXT NOT NULL REFERENCES asset(id),
  start_ms    INTEGER NOT NULL,   -- position on the track
  in_ms       INTEGER NOT NULL,   -- trim from the start of the source
  out_ms      INTEGER NOT NULL,   -- trim point at the end of the source; for a still, in_ms + shown length
  placement   TEXT                -- JSON: Geometry, or null to use the background layer's geometry
);
CREATE INDEX clip_variant ON background_clip(variant_id, start_ms);
```

- Clips on one track may not overlap. The command rejects a move or trim that would overlap [REQ: 1.4 out of scope].
- Time with no clip shows black [REQ: FR-122].
- Each video variant owns its clips. Clips are never linked or synced [REQ: R-05].
- An image variant ignores this table and draws its background layer's `source`.

#### job
**Requirements Traced:** [REQ: FR-124, FR-152]

```sql
CREATE TABLE job (
  id            TEXT PRIMARY KEY,
  kind          TEXT NOT NULL CHECK (kind IN (
                  'brief_extraction','image_generation','generative_fill','layout_proposal',
                  'copy_options','translation','video_generation','export','publish')),
  status        TEXT NOT NULL CHECK (status IN ('queued','running','succeeded','failed','cancelled')),
  campaign_id   TEXT,
  variant_id    TEXT,
  provider      TEXT,
  model         TEXT,
  request       TEXT NOT NULL,     -- JSON, enough to retry
  remote_job_id TEXT,              -- provider's job ID, used to resume
  result        TEXT,              -- JSON
  error_kind    TEXT CHECK (error_kind IN ('bad_key','quota','refused','timeout','offline','other')),
  error_detail  TEXT,              -- raw provider message, log and report only, never shown in the UI
  progress      REAL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX job_status ON job(status, updated_at);
```

#### report and variant_check
**Requirements Traced:** [REQ: FR-114, FR-115, FR-150, FR-151]

```sql
CREATE TABLE report (
  id          TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaign(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL,
  output_dir  TEXT NOT NULL,
  body        TEXT NOT NULL        -- JSON: Report (Section 6.7)
);

CREATE TABLE variant_check (
  variant_id  TEXT PRIMARY KEY REFERENCES variant(id) ON DELETE CASCADE,
  checked_rev INTEGER NOT NULL,    -- variant.rev when the checks ran
  ran_at      TEXT NOT NULL,
  ran_by      TEXT NOT NULL CHECK (ran_by IN ('user','agent','export')),
  results     TEXT NOT NULL        -- JSON: CheckResult[]
);
```

### 3.4 Links, follow rules and sync

Layer properties are grouped. Each group has a counter in `layer.revs` that goes up by one whenever a property in the group changes.

| Group | Properties |
|-------|------------|
| copy | `copy` |
| style | all of `style` |
| geometry | all of `geometry` |
| source | `source` |
| timing | `timing` |
| animation | `animation` |

**Follow rules** [REQ: FR-079, R-02, R-05]. A linked layer follows a group as shown. "Size" means `width` × `height`.

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

**Sync preview** (`sync.preview` query) returns, for each out-of-date variant:

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

### 3.5 Fan-out

`variant.fanOut` input: direction ID, the sizes, languages and formats to cover, and one background fit choice per new size [REQ: FR-075, FR-076].

For every combination of size, language and format that does not already exist in the direction:

1. Create the variant with the master's title and subjects.
2. Copy every master layer with the same `key`, `linked = 1`, empty `overrides`, and `synced_revs` equal to the master's `revs`.
3. **Geometry for a new size, master's language.** For each non-background layer, keep the layer's centre at the same relative position on the canvas and scale its width and height by `min(newWidth / masterWidth, newHeight / masterHeight)`. Font size is style, so it follows the master unchanged.
4. **Background for a new size**, by the user's fit choice:
   - `scale`: place the whole image inside the canvas, centred. Empty area shows black.
   - `crop`: fill the canvas with the image, centred. The parts outside are hidden, not removed.
   - `fill`: place as `scale`, then start a `generative_fill` job that extends the image to the new size. On success the new asset becomes the variant's background with `source` added to `overrides`. On failure the background stays as `scale` and retry is offered [REQ: FR-076, workflow 5.2].
5. **Geometry for a new size and a new language.** Copy geometry from the variant with the same size and format in the master's language, created in step 3 [REQ: R-02].
6. **Copy for a new language.** Start one translation job per language for the direction, covering every text layer in the master. The result is written to every new variant in that language with `translation_status = 'proposed'`. If the brief supplied copy for the language, that text is used with `translation_source = 'brief'` and no job runs [REQ: FR-027]. If there is no key or the job fails, the layers keep the master's text with `translation_status = 'missing'` and the variant offers retry [REQ: workflow 5.2].
7. **Video format.** Create one background clip from the variant's background image, from 0 to the variant's duration.
8. Ask the render service to measure text overflow on each new variant.

Fan-out is one entry on the campaign undo list. Generative fill is the only image generation it can start, and only when the user chose `fill` [REQ: FR-076].

### 3.6 Data Flow

**An edit** [REQ: FR-006, FR-200]

1. The window (or the MCP server) sends a command with an actor: `user` or `agent`.
2. The command bus validates it with Zod, then looks up the agent policy if the actor is `agent`.
3. The handler runs inside one SQLite transaction: it writes the change, bumps `revs` and `variant.rev`, and returns the inverse command.
4. The bus pushes the inverse onto the right undo list, writes a log entry and emits `project.changed` with the changed rows.
5. Every window store for that project applies the changed rows. Agent edits therefore appear as they happen.

**Dragging.** While the user drags, the window keeps the moving values in zustand only. On release it sends one `layer.update`. A crash loses at most that drag [REQ: 8.2].

**Text overflow.** The Scene compares each text layer's content height and width with its box after fonts load. The editor window and the render service both report changes through `layer.reportOverflow`, a system command that is not undoable and does not bump `rev` [REQ: FR-098].

**Asset files.** The window never reads files. It loads images, video and fonts from `adman-asset://{projectId}/{assetId}`. The main process serves these through the path resolver.

**Generation** [REQ: FR-060–FR-068]

1. The user confirms the run dialog (count and provider).
2. The job runner calls the provider, saves each result as a PNG or MP4 in the assets folder, embeds the generation details (Section 6.6) and inserts an `asset` row with `origin = 'generated'`.
3. The user picks one. Picking is a `layer.update` that sets `source`. All options stay in the asset library [REQ: FR-063].

**Export** — Section 6.7. **Publish** — Section 6.5.

### 3.7 Caching Strategy

| Cache Target | Layer | TTL | Invalidation Trigger |
|--------------|-------|-----|----------------------|
| Variant thumbnail (PNG, longest side 512) | `{userData}/thumbnails/{projectId}/{variantId}-{rev}.png` | None | A new `variant.rev` makes a new file. Files for old revs are deleted when the project closes. |
| Asset thumbnail | `{userData}/thumbnails/{projectId}/asset-{assetId}-{contentHash8}.png` | None | Content hash change |

Nothing else is cached.

### 3.8 Data Migration

No legacy data [REQ: 6.4].

Project file upgrades: Drizzle migrations live in `src/main/db/migrations/`. On open, the app compares `schema_version` with its own.
- Older file: copy the project file to `Name.adman.bak`, run the migrations in one transaction, update `schema_version`.
- Newer file: refuse to open and show "This project was made with a newer version of the app. Download the latest version to open it."

---

## 4. API Specification

The app has no HTTP API of its own. It has two interfaces: the internal interface between the window and the main process, and the MCP tools.

### 4.1 Design Principles

- **Three channels.** `command` changes data. `query` reads data. `event` goes from the main process to the window.
- **One schema set.** Every command, query and MCP tool input is a Zod schema in `src/shared/schemas/`. MCP tool handlers call the same commands as the window.
- **Actor.** Every command carries `actor: 'user' | 'agent'`. The preload bridge always sets `user`. The MCP server always sets `agent`. Neither side can choose.
- **Names.** Commands and queries are `domain.action`. MCP tools are `snake_case`.
- **No rate limiting, pagination or versioning** for the internal interface. MCP list tools return at most 500 items and say when more exist.

**Result format** (internal and MCP):

```json
{ "ok": true, "data": {} }
```

```json
{
  "ok": false,
  "error": {
    "code": "NEEDS_KEY",
    "message": "Add your Gemini key to generate images.",
    "details": { "provider": "gemini" }
  }
}
```

**Error codes:**

| Code | Meaning |
|------|---------|
| `INVALID_INPUT` | Schema check failed |
| `NOT_FOUND` | Unknown ID |
| `RULE_VIOLATION` | Breaks a rule, for example deleting a master variant on its own [REQ: FR-073] |
| `NEEDS_KEY` | A key is missing. The window opens the key dialog and retries. [REQ: FR-171] |
| `PROVIDER_ERROR` | Provider failed. `details.kind` is one of `bad_key`, `quota`, `refused`, `timeout`, `offline`, `other`. [REQ: FR-069] |
| `MISSING_FILE` | A linked file cannot be found [REQ: R-06] |
| `PROJECT_LOCKED` | The project file is open elsewhere |
| `AGENT_DENIED` | The agent policy is deny. `message` says why. [REQ: workflow 5.7] |
| `AGENT_REFUSED` | The user refused, or did not answer in 120 seconds [REQ: FR-197] |

`message` is always plain language. Raw provider text goes to `job.error_detail` and the log only [REQ: FR-069].

### 4.2 Commands

Undo scope: **V** = the variant's list, **C** = the campaign's list, **—** = not undoable. Agent policy: **allow**, **ask**, **deny**.

| Command | Input | Undo | Agent | Requirements |
|---------|-------|------|-------|--------------|
| `project.create` | name, location | — | deny | FR-002, FR-004 |
| `project.open` | filePath | — | deny | FR-002, FR-003 |
| `project.close` | projectId | — | deny | FR-006 |
| `project.setAssetsDir` | projectId, dir | — | deny | R-07 |
| `project.package` | projectId, targetDir | — | deny | R-09 |
| `subject.create` | projectId, id, name, description | — | deny | FR-011 |
| `subject.update` | subjectId, name?, description? | — | deny | FR-011 |
| `subject.delete` | subjectId (refused while a campaign uses it) | — | deny | FR-197 |
| `asset.import` | projectId, paths[], library, subjectId?, copy: boolean | — | deny | FR-050–FR-054, R-08 |
| `asset.update` | assetId, library?, subjectId?, displayName?, fontPublishAllowed? | — | deny | FR-054, R-12 |
| `asset.relink` | assetId, newPath, relinkSiblings: boolean | — | deny | R-06 |
| `asset.remove` | assetId (refused while a layer, clip or rule set uses it) | — | deny | FR-197 |
| `brief.parse` | projectId, filePath or text | — | deny | FR-020, FR-022 |
| `campaign.create` | projectId, brief, subjectMap, sizes, languages, ruleSet or copyRuleSetFrom, templateId | — | allow | FR-023–FR-026, FR-195, R-01 |
| `campaign.update` | campaignId, name?, audience?, tone?, offer?, callToAction?, languages?, sizes? | C | deny | FR-031, FR-032 |
| `campaign.delete` | campaignId | — | ask | FR-197 |
| `ruleSet.update` | campaignId, any of the four lists | C | deny | FR-033 |
| `ruleSet.copyFrom` | campaignId, sourceCampaignId | C | deny | FR-034 |
| `direction.createFromMaster` | masterVariantId, name | C | deny | FR-074 |
| `direction.rename` | directionId, name | C | deny | FR-072 |
| `direction.delete` | directionId (refused if it is the campaign's last) | C | deny | A-06 |
| `variant.fanOut` | directionId, sizes[], languages[], formats[], fits{} | C | deny | FR-075, FR-076 |
| `variant.add` | directionId, sizeLabel, language, format | C | allow | FR-195 |
| `variant.update` | variantId, title?, durationMs? | V | allow | FR-070, FR-120 |
| `variant.delete` | variantId (refused for a master) | C | ask | FR-073, FR-197 |
| `layer.create` | variantId, type (image or text), values | V | allow | FR-090, FR-194 |
| `layer.update` | layerId, patch of copy, style, geometry, source, timing, animation, name, visible, locked | V | allow | FR-092–FR-094, FR-194 |
| `layer.delete` | layerId (refused for a background) | V | allow | FR-092, FR-197 |
| `layer.reorder` | variantId, layerIds in order | V | allow | FR-092 |
| `layer.clearOverride` | layerId, paths[] | V | deny | FR-080 |
| `layer.reportOverflow` | layerId, overflow | — | deny (system) | FR-098 |
| `clip.add` | variantId, assetId, startMs | V | deny | FR-121 |
| `clip.update` | clipId, startMs?, inMs?, outMs?, placement? | V | deny | FR-122 |
| `clip.remove` | clipId | V | deny | FR-122 |
| `translation.propose` | variantIds[] or directionId + language | — | deny | FR-101 |
| `translation.set` | layerId, text, applyToSameLanguage: boolean | V | allow | FR-102, FR-194 |
| `translation.approve` | layerIds[] | C | deny | FR-101 |
| `translation.exportSheet` | campaignId, filePath | — | deny | FR-103 |
| `sync.apply` | directionId, decisions[] | C | deny | FR-082, FR-083 |
| `check.run` | campaignId or variantIds[] | — | allow | FR-114, FR-196 |
| `generation.runImages` | variantId, slot or layerId, prompt, referenceAssetIds[], count, provider | — | deny | FR-062–FR-065, FR-199 |
| `generation.runFill` | variantId, provider | — | deny | FR-076 |
| `generation.proposeLayout` | variantId, provider | V (when applied) | deny | FR-061 |
| `generation.copyOptions` | campaignId, slot, count, provider | — | deny | FR-045 |
| `generation.startVideo` | variantId, prompt, durationMs, provider | — | deny | FR-123, FR-199 |
| `job.retry` | jobId | — | deny | FR-069, FR-152 |
| `job.cancel` | jobId | — | deny | FR-152 |
| `export.run` | campaignId, variantIds[], outputDir, imageFormat, jpgQuality, fps, proceedDespiteWarnings | — | deny | FR-140, FR-199 |
| `publish.run` | campaignId, storage, replaceConfirmed | — | deny | FR-161, FR-199 |
| `history.undo` / `history.redo` | scope (`variant:{id}` or `campaign:{id}`) | — | deny | FR-095 |
| `settings.update` | patch of settings | — | deny | FR-067 |
| `secret.set` / `secret.delete` | name, value | — | deny | FR-170, FR-198 |
| `mcp.setEnabled` | enabled | — | deny | FR-191 |
| `mcp.regenerateToken` | — | — | deny | R-04 |
| `agent.answerPermission` | requestId, allow, rememberAuto | — | deny | FR-197 |

**Notes on specific commands**

- `campaign.create` with actor `user` is called only after the confirm form [REQ: FR-023]. With actor `agent` it takes the same structured input and no form is shown [REQ: R-01]. It creates the campaign, its rule set, one direction named "Direction 1", and one master variant at the first size in the primary language with a background layer and one layer per filled slot. The headline layer's copy is the campaign message, word for word [REQ: FR-043].
- `translation.set` on a language variant writes the text with `translation_status = 'proposed'`. `translation_source` is `user` or `agent` by actor. An agent can never approve [REQ: FR-200]. With `applyToSameLanguage` the same text is written to the matching layer of every variant in the direction with that language and no `copy` override.
- `translation.approve` is the only way a status becomes `approved`. Editing an approved translation sets it back to `proposed` [REQ: FR-101].
- `layer.update` by an agent on a master bumps `revs` like any edit, so linked variants become out of date and nothing cascades [REQ: FR-200].
- A campaign-scope command that changes a variant clears that variant's undo list. Undoing the campaign entry restores the variant from a snapshot held in the entry.
- Each undo list holds at most 200 entries. All lists are dropped when the project closes [REQ: FR-006].

**Adding deferred agent abilities later** [REQ: FR-199]. Changing `generation.*`, `export.run` or `publish.run` from deny to ask in `agent-policy.ts`, and adding the MCP tool definitions, is all that is needed. No command changes.

### 4.3 Queries

| Query | Returns |
|-------|---------|
| `app.getState` | Settings (no secrets), recent projects, open projects, provider list with availability, secret names with last four characters |
| `project.get` | Project meta, subjects, campaigns (summary), missing asset count |
| `asset.list` | Assets filtered by library, kind, subject. Includes `missing: boolean`. |
| `campaign.get` | Campaign, rule set, directions, variant summaries with computed badges |
| `variant.get` | Variant, layers, clips, computed out-of-date detail, latest check result |
| `template.list` / `template.slots` | Templates, and for a campaign each slot as filled or empty with candidates [REQ: FR-042] |
| `sync.preview` | `SyncPreview[]` for a direction (Section 3.4) |
| `job.list` | Jobs for the activity panel [REQ: FR-152] |
| `report.list` / `report.get` | Saved reports [REQ: FR-151] |
| `history.state` | Whether undo and redo are available for a scope |
| `publish.inspect` | Whether the campaign's cloud folder already has files [REQ: FR-164] |

**Computed variant badges** [REQ: 6.1]: `outOfDate`, `overflow` (any layer), `translationUnapproved` (any layer `missing` or `proposed`), `checkWarning` (latest `variant_check` has a `brand-legal` warning and `checked_rev = rev`), `checkStale` (`checked_rev < rev`), `jobRunning`, `missingFile`.

### 4.4 Events

| Event | Payload |
|-------|---------|
| `project.changed` | projectId, changed and removed rows by table, actor |
| `job.updated` | The job row |
| `agent.permissionRequested` | requestId, tool, target summary, expiresAt |
| `agent.activity` | Tool name and target, for a "the agent is working" indicator |
| `asset.changedOnDisk` | assetIds[] |
| `mcp.status` | enabled, port, connected client names |

### 4.5 MCP Tools

**Endpoint:** `http://127.0.0.1:{mcp.port}/mcp` (Streamable HTTP). Default port 47821.
**Authentication:** `Authorization: Bearer {token}`.
**Bridge:** `"{app executable}" --mcp-bridge` speaks MCP over stdio and forwards to the endpoint (Section 6.8).

Every tool that takes a `project_id` works only on projects open in the app [REQ: FR-201]. No tool returns file contents, file paths, settings or secrets [REQ: FR-198].

| Tool | Input | Output | Policy | Requirements |
|------|-------|--------|--------|--------------|
| `list_projects` | — | Open projects: id, name | allow | FR-192, FR-201 |
| `get_project` | project_id | Subjects, campaign summaries | allow | FR-192 |
| `list_subjects` | project_id | id, name, description, attached asset IDs | allow | FR-192 |
| `list_assets` | project_id, library?, kind? | id, display name, kind, library, subject ID, width, height, duration, font family | allow | R-11 |
| `get_campaign` | project_id, campaign_id | Campaign fields, rule set, directions, variant summaries with badges | allow | FR-192 |
| `get_variant` | project_id, variant_id | Variant, layers (all values), clips, out-of-date detail | allow | FR-192 |
| `render_variant` | project_id, variant_id, time_ms? (default 0), max_dimension? (default 1024, max 2048), hide_text? | One PNG image | allow | FR-193 |
| `create_campaign` | project_id, brief (Section 6.1 schema), subject_map, sizes?, languages?, rule_set? | campaign_id, master variant_id | allow | FR-195, R-01 |
| `add_variant` | project_id, direction_id, size_label, language, format | variant_id | allow | FR-195 |
| `create_layer` | project_id, variant_id, type (`text` or `image`), copy?, asset_id?, geometry, style?, timing?, animation? | layer_id | allow | FR-194 |
| `update_layer` | project_id, layer_id, any of copy, geometry, style, asset_id, timing, animation, visible, name | Updated layer | allow | FR-194 |
| `delete_layer` | project_id, layer_id | — | allow | FR-197 notes |
| `reorder_layers` | project_id, variant_id, layer_ids | — | allow | FR-194 |
| `set_translation` | project_id, layer_id, text, apply_to_same_language? | Updated layer, status `proposed` | allow | FR-194, FR-200 |
| `run_checks` | project_id, campaign_id or variant_ids | Check results | allow | FR-196 |
| `get_check_results` | project_id, campaign_id | Latest results per variant | allow | FR-196 |
| `delete_variant` | project_id, variant_id | — | ask | FR-197 |
| `delete_campaign` | project_id, campaign_id | — | ask | FR-197 |

**Ask flow** [REQ: FR-197]

1. The server emits `agent.permissionRequested`. The window shows a dialog naming the agent, the action and the target.
2. The tool call waits up to 120 seconds.
3. Allow runs the command. Refuse or timeout returns `AGENT_REFUSED`.
4. If `settings.mcp.autoApproveDestructive` is true, step 1 is skipped and the action is logged as auto-approved.

**Refusals.** A request for something not offered returns `AGENT_DENIED` with a sentence such as "Agents cannot start image generation in this version. Ask the user to do it in the app." [REQ: workflow 5.7]

`add_variant` by an agent creates the variant as one fan-out cell (Section 3.5) with background fit `scale` and no translation job. Text layers in another language get `translation_status = 'missing'` until the agent or the user supplies text.

---

## 5. Authentication & Authorization

### 5.1 Authentication Flow

- **User:** none. The app is single-user [REQ: 8.4].
- **Agent:** bearer token.
  1. The user turns the MCP server on in Settings. The app creates a random 32-byte token (base64url) if none exists and stores it in `secrets.bin`.
  2. Settings shows a "Connect to Claude" panel with the address, the token and ready-to-paste setup text for Claude Code and Claude Desktop.
  3. Every request must carry the token. A wrong or missing token gets HTTP 401.
  4. "Make a new token" replaces it. Connected agents are dropped.

### 5.2 Authorization Model

Policy-based, with two actors.

**Roles:**

| Role | Description | Permissions Summary |
|------|-------------|---------------------|
| Creative User | The person at the computer | Everything |
| External Agent | An MCP client with the token | Only commands marked allow or ask in Section 4.2 |

**Permissions Matrix:**

| Permission | Creative User | External Agent |
|------------|---------------|----------------|
| Read open projects, variants, layers, rule sets, asset names | ✓ | ✓ |
| Render a picture of a variant | ✓ | ✓ |
| Create, edit, delete, reorder layers | ✓ | ✓ |
| Set translations | ✓ | ✓ (always unapproved) |
| Approve translations | ✓ | ✗ |
| Create a campaign, add a variant | ✓ | ✓ |
| Run checks | ✓ | ✓ |
| Delete a variant or campaign | ✓ | With the user's permission |
| Fan-out, sync, undo | ✓ | ✗ |
| Image or video generation, export, publish | ✓ | ✗ (deferred) |
| Subjects, assets, rule sets, settings | ✓ | ✗ |
| Keys | Set, replace, delete. Never view. | ✗ never |

Enforcement is in the command bus, before the handler runs. The MCP server has no other path to data.

### 5.3 Token & Session Management

- Token: opaque, 32 random bytes, no expiry, replaced on demand.
- Storage: `secrets.bin`, encrypted with Electron `safeStorage` (Keychain on macOS, DPAPI on Windows).
- Comparison: constant-time.
- Sessions: MCP session IDs are held in memory and dropped when the server is turned off or the app quits.

---

## 6. Integration Specifications

Every provider is registered in `src/main/providers/registry.ts`:

```ts
type ProviderInfo = {
  id: string                       // e.g. "gemini"
  label: string                    // e.g. "Google Gemini"
  jobs: Array<'image' | 'layout' | 'text' | 'video' | 'storage' | 'verification'>
  available: boolean               // false shows "Not yet available" and disables the choice
  secrets: string[]                // secret names it needs
  defaultModels: Record<string, string>
}
type ProviderError = {
  kind: 'bad_key' | 'quota' | 'refused' | 'timeout' | 'offline' | 'other'
  detail: string                   // raw text for the log
}
```

Registered in this build [REQ: FR-067, IR-002]:

| ID | Jobs | Available |
|----|------|-----------|
| `gemini` | image, layout, text | Yes |
| `fal-seedance` | video | Yes |
| `firefly` | image | No |
| `s3` | storage | Yes |
| `dropbox` | storage | Yes |
| `azure-blob` | storage | No |
| `jev` | verification | No |
| `fake` | all | Only when `ADMAN_FAKE_PROVIDERS=1` |

**Plain messages** [REQ: FR-069]. One message per error kind, with a Retry button:

| Kind | Message |
|------|---------|
| `bad_key` | "{Provider} did not accept your key. Check it in Settings and try again." |
| `quota` | "Your {Provider} account has reached its limit. Check your plan with {Provider}, then try again." |
| `refused` | "{Provider} declined this request because of its content rules. Change the prompt or the images and try again." |
| `timeout` | "{Provider} took too long to answer. Try again." |
| `offline` | "The app could not reach {Provider}. Check your internet connection and try again." |
| `other` | "{Provider} could not finish this request. Try again." |

**Retry rule.** A provider call is never repeated automatically after it was sent, because a repeat may be charged twice. Retry is always the user's action. The one exception is polling a video job that has already started.

**Interfaces** [REQ: FR-066, IR-001]:

```ts
interface ImageProvider {
  generate(input: { prompt: string; references: ImageFile[]; width: number; height: number; count: number }): Promise<ImageResult[]>
  extend(input: { image: ImageFile; placement: Geometry; width: number; height: number; prompt: string }): Promise<ImageResult>
}
interface LayoutProvider {
  propose(input: { background: ImageFile; width: number; height: number; items: Array<{ slot: string; text: string }>; palette: string[]; fonts: string[] }): Promise<LayoutBox[]>
}
interface TextProvider {
  extractBrief(input: { text: string }): Promise<Brief>
  copyOptions(input: { slot: string; brief: Brief; language: string; count: number }): Promise<string[]>
  translate(input: { items: Array<{ key: string; text: string }>; from: string; to: string; region: string; audience: string }): Promise<Array<{ key: string; text: string }>>
}
interface VideoProvider {
  start(input: { image: ImageFile; prompt: string; durationMs: number; width: number; height: number }): Promise<{ remoteJobId: string }>
  check(remoteJobId: string): Promise<{ status: 'running' | 'succeeded' | 'failed'; progress?: number; videoUrl?: string; error?: ProviderError }>
}
interface StorageProvider {
  exists(path: string): Promise<boolean>
  read(path: string): Promise<Uint8Array>
  write(path: string, data: ReadableStream | Uint8Array, contentType: string): Promise<void>
  list(prefix: string): Promise<string[]>
  remove(paths: string[]): Promise<void>
}
interface VerificationProvider {
  checkImageColours(input: { image: ImageFile; palette: string[] }): Promise<{ pass: boolean; note: string }>
}
type LayoutBox = { slot: string; x: number; y: number; width: number; height: number; fontSize: number; color: string; align: 'left' | 'center' | 'right' }
type ImageResult = { png: Uint8Array; model: string }
```

A `LocalStorageProvider` implements `StorageProvider` on disk. Export writes through it and publish writes through the cloud one, so both share the path code [REQ: 9.1 preference].

### 6.1 Brief intake
**Direction:** Inbound (file or form) **Requirements Traced:** [REQ: FR-020–FR-027]

Brief schema (JSON and YAML files use these field names):

```json
{
  "campaignName": "string, required",
  "region": "string, required",
  "audience": "string, required",
  "message": "string, required",
  "subjects": [{ "id": "string, optional", "name": "string, required", "description": "string, optional" }],
  "offer": "string, optional",
  "callToAction": "string, optional",
  "tone": "string, optional",
  "requiredWords": "string[] or { language: string[] }, optional",
  "prohibitedWords": "string[] or { language: string[] }, optional",
  "languages": "string[] of BCP-47 tags, optional",
  "sizes": "string[] such as '1:1' or '1080x1350', optional",
  "copy": { "<language>": { "headline": "string", "callToAction": "string" } }
}
```

- `subjects` needs at least one entry and has no upper limit [REQ: FR-021].
- `.json` and `.yaml`/`.yml` are parsed locally. Unknown fields are ignored. Missing required fields are left empty on the form.
- `.md` and `.txt` go to `TextProvider.extractBrief` [REQ: FR-022]. With no key, the app shows the key dialog. The user can cancel and fill the form by hand [REQ: FR-171].
- A plain word list for `requiredWords` or `prohibitedWords` is stored under the primary language [REQ: R-03].
- The confirm form shows every field, one row per subject with "New subject ID" or "Use existing subject", size and language pickers, and the rule set editor with "Copy from campaign" [REQ: FR-023, FR-024, FR-034].
- Default sizes: 1080×1080, 1080×1920, 1920×1080. Default language: looked up from `region-languages.ts` by country name or ISO code. If the region is not in the table the language field is empty and required [REQ: FR-026].
- Right-to-left languages (`ar`, `he`, `fa`, `ur`, `yi`, `ps`, `sd`, `dv`) are refused with "Right-to-left languages are not supported yet." [REQ: FR-104]

**Starter template** (`src/shared/templates/starter.ts`) [REQ: FR-040, FR-041]:

| Slot ID | Type | Filled from |
|---------|------|-------------|
| `background` | image | Empty until generated or chosen |
| `subject-image` | image | The subject's hero image, if any [REQ: R-12] |
| `logo` | image | The first image in the rule set's required assets, if any |
| `headline` | copy | The campaign message, always [REQ: FR-043] |
| `call-to-action` | copy | The brief's `callToAction`, if given |

**Subject image cases** [REQ: FR-055, R-12]:

| The subject has | Slot shows | Generation panel |
|-----------------|-----------|------------------|
| A hero image (asset library) | Filled | Not needed |
| Only reference-library files | Empty | Prompt pre-filled, the subject's reference files attached |
| No files | Empty | Prompt pre-filled from the subject description and the campaign message |

### 6.2 Gemini (image, layout, text)
**Direction:** Outbound **Protocol:** HTTPS through `@google/genai` **Authentication:** API key, secret name `gemini.apiKey` **Requirements Traced:** [REQ: FR-060–FR-069, FR-022, FR-045, FR-101, IR-002]

**Trigger:** user actions only [REQ: FR-065].

| Job | Call | Default model |
|-----|------|---------------|
| Image generate | `generateContent` with the prompt and reference images, image output | `gemini-2.5-flash-image` |
| Image extend | Same, with the placed image on a canvas of the target size and an instruction to extend the scene to the edges | `gemini-2.5-flash-image` |
| Layout | `generateContent` with the background picture and a JSON response schema matching `LayoutBox[]` | `gemini-2.5-flash` |
| Extract brief, copy options, translate | `generateContent` with a JSON response schema | `gemini-2.5-flash` |

> ⚠️ Decision Required: The model IDs above are the ones the architect knows. Check the current Gemini model list at the start of Phase 4 and update `registry.ts`.

**Rules:**
- Every image prompt ends with a fixed instruction: "Do not include any text, letters, numbers, logos or watermarks in the image." [REQ: FR-061]
- The pre-filled prompt is built from subject name and description, audience, region and message. The user can edit it [REQ: FR-062].
- `count` images means `count` calls, run two at a time. The run dialog shows "This will use {count} generations with {provider}." [REQ: FR-063, FR-064]
- Results are saved as PNG with generation details embedded (Section 6.6).
- Layout boxes are clamped to the canvas, and colours are snapped to the nearest palette colour when the palette is not empty. The app then creates or updates text layers. Text is always drawn by the app [REQ: FR-061].
- Translation prompt includes the region and audience as context [REQ: FR-101].

**Error Handling:** map HTTP 401/403 → `bad_key`, 429 → `quota`, safety blocks → `refused`, no answer in 120 s (image) or 60 s (text) → `timeout`, network failure → `offline`. No automatic retry.
**Circuit Breaker:** No.

### 6.3 fal.ai Seedance (image-to-video)
**Direction:** Outbound **Protocol:** HTTPS queue API through `@fal-ai/client` **Authentication:** API key, secret name `fal.apiKey` **Requirements Traced:** [REQ: FR-123, FR-124, OI-04]

**Trigger:** the user starts it for one variant [REQ: FR-123].

**Flow:**
1. Render the variant's background with no other layers to a PNG and upload it with the fal storage upload call.
2. `fal.queue.submit` to model `bytedance/seedance-2.0/image-to-video` with the prompt, image URL, duration and aspect ratio. Save the request ID in `job.remote_job_id`.
3. Poll `fal.queue.status` every 5 seconds. Update `job.progress`.
4. On success, download the MP4, remove any audio and embed generation details (Section 6.6), save to the assets folder, insert the asset, and add it as a clip at the first free position on the track.
5. On failure, set the job to failed. The track is untouched and the activity panel and variant tile offer retry [REQ: FR-124].

**Resume:** on project open, every `video_generation` job with status `running` and a `remote_job_id` goes back to step 3. A paid job is never lost because the app closed.

**Limits:** the generation panel offers only the durations and sizes the model accepts. A clip shorter than the variant leaves the rest of the track black until the user fills it [REQ: FR-122].

**Error Handling:** as Section 6.2, with a 15 minute timeout on the whole job.
**Circuit Breaker:** No.

> ⚠️ Decision Required: The route is not tested. In Phase 7, confirm the model ID, its accepted durations and sizes, and its price on fal.ai before building the panel [REQ: OI-04].

### 6.4 Adobe Firefly (stub)
**Direction:** Outbound **Requirements Traced:** [REQ: FR-067, IR-002, OI-03]

Research result: no route was found to the Firefly API without an enterprise plan. Adobe community answers describe it as an enterprise-only add-on.

Deliver `src/main/providers/firefly/` implementing `ImageProvider` against Adobe's public documentation: OAuth server-to-server token from client ID and secret (secret names `firefly.clientId`, `firefly.clientSecret`), then the image generate call. Register it with `available: false`. It is listed in Settings and the run dialog as "Adobe Firefly — not yet available" [REQ: C-02]. It has unit tests against recorded example responses from the public docs and is never called at run time.

### 6.5 Cloud storage (S3 and Dropbox)
**Direction:** Outbound **Requirements Traced:** [REQ: FR-160–FR-164, R-15]

**Amazon S3.** `@aws-sdk/client-s3` and `@aws-sdk/lib-storage`. Settings: bucket, region, optional prefix. Secrets: `s3.accessKeyId`, `s3.secretAccessKey`. Calls: `ListObjectsV2`, multipart `Upload`, `DeleteObjects`.

**Dropbox.** `dropbox` SDK. Sign-in is OAuth 2 with PKCE in the user's browser, redirecting to `http://127.0.0.1:47822/oauth/dropbox`. Scopes: `files.content.write`, `files.content.read`, `files.metadata.read`. Access type: full Dropbox, so the user can pick a shared team folder as the root. Secret: `dropbox.refreshToken`. Settings: account name, root folder.

> ⚠️ Decision Required: The stakeholder registers a Dropbox app (full Dropbox access, the redirect address above) and gives the developer its app key before Phase 9. The app key is public and goes in `src/shared/config/public-ids.ts`.

**Azure Blob.** A file implementing `StorageProvider` that throws "not available", registered with `available: false`.

**Trigger:** `publish.run`, manual, one campaign at a time [REQ: FR-161].

**Published layout** [REQ: FR-163, FR-164]:

```
{prefix or root}/{campaignId}/
  exports/{postTitle}/{sizeLabel}/{language}-{variantId}.{ext}
  components/backgrounds/{displayName}-{assetId8}.{ext}
  components/logos/...
  components/subjects/{subjectId}/...
  components/images/...
  components/fonts/...            only fonts with font_publish_allowed
  translations.csv
  report.html
  report.json
  manifest.json
```

**Flow:**
1. `publish.inspect` lists `{campaignId}/`. If files exist, the dialog warns "This will replace the files published for this campaign." and needs confirmation [REQ: FR-164].
2. The dialog also says "Generated images and videos carry the prompt that made them. Anyone with these files can read it." [REQ: 6.3]
3. The app runs a fresh export of the whole campaign into a temporary folder, including checks and report (Section 6.7). Check warnings are shown as in any export.
4. It collects the components: every asset used by a layer or clip of an exported variant, sorted into the folders above. Assets in the rule set's required list go to `logos`. Assets attached to a subject go to `subjects/{subjectId}`. Generation attempts that no variant uses are not uploaded [REQ: FR-162].
5. It uploads every file, then writes `manifest.json` (file list with sizes and hashes, app version, time).
6. It deletes any object under `{campaignId}/` that is not in the new manifest. Nothing outside `{campaignId}/` is ever listed, written or deleted [REQ: FR-164].

Components are uploaded as they are on disk, so generated ones keep their embedded details [REQ: C-21]. Exports are written fresh and carry none [REQ: FR-068].

**Error Handling:** each file upload is retried up to 3 times with 1, 4 and 10 second waits. Uploads are free to repeat. A failed publish leaves the old manifest in place and can be run again.
**Circuit Breaker:** No.

### 6.6 Embedded generation details
**Requirements Traced:** [REQ: FR-068, OI-05]

| File type | Where | Content |
|-----------|-------|---------|
| PNG (all generated images) | One `iTXt` chunk with keyword `generation` | JSON below |
| MP4 (generated video) | Container tag `comment`, written by FFmpeg with `-c:v copy -an -metadata comment=...` | JSON below |

```json
{
  "app": "Adman",
  "appVersion": "1.0.0",
  "provider": "gemini",
  "model": "gemini-2.5-flash-image",
  "prompt": "the full prompt sent",
  "kind": "image_generation",
  "createdAt": "2026-11-20T14:30:00Z"
}
```

This follows ComfyUI, which writes JSON into PNG text entries and MP4 container tags. Any tool that reads PNG text chunks or `ffprobe` can read it. The same values are stored on the `asset` row and used by the report [REQ: FR-150].

### 6.7 Export
**Direction:** Outbound to disk **Requirements Traced:** [REQ: FR-126, FR-130–FR-132, FR-140–FR-143, FR-150, FR-151]

**Output layout** (`output-paths.ts`):

```
{outputDir}/{campaignId}/{postTitle}/{sizeLabel}/{language}-{variantId}.{ext}
{outputDir}/{campaignId}/report-{YYYYMMDD-HHmmss}.html
{outputDir}/{campaignId}/report-{YYYYMMDD-HHmmss}.json
```

`postTitle` is the variant title with characters outside `A–Z a–z 0–9 + - _ space` replaced by `-`. `ext` is `png`, `jpg` or `mp4`.

**Flow:**
1. Run the checks on the chosen variants (Section 6.9).
2. If any warn, show them. The user fixes them or proceeds. Proceeding is recorded [REQ: FR-115].
3. Variants with a missing file are listed as failures and skipped [REQ: R-06].
4. Export each variant. Each file is written to `{name}.partial` and renamed when complete.
5. Write the report files and insert the `report` row.

**Image variant:** the render service draws the full Scene at the variant's pixel size and captures it. PNG through `nativeImage.toPNG()`, JPG through `toJPEG(quality)` with default quality 90.

**Video variant:**
1. Frame count = `ceil(durationMs / 1000 × fps)`. Frame `i` is drawn at time `i × 1000 / fps`. Time comes from the frame number, never from a clock, so every machine produces the same frames [REQ: FR-131].
2. The render service draws the Scene with the background left out and a transparent page, and captures each frame as PNG. If no layer changes between two frames (no animation running, no layer starting or ending), the previous frame is sent again without redrawing.
3. Frames are piped to FFmpeg as `-f image2pipe -framerate {fps} -c:v png -i -`.
4. FFmpeg builds the background: a black base of the variant's size and duration, then each clip trimmed (`trim`, `setpts`), scaled and cropped by `background-placement.ts`, and overlaid in its time range. Stills are looped for their length.
5. FFmpeg overlays the frame stream on the background and encodes.

```
Encoder:  macOS  -c:v h264_videotoolbox -b:v 12M
          Windows -c:v h264_mf -b:v 12M
Common:   -pix_fmt yuv420p -r {fps} -an -movflags +faststart
```

`fps` is 30 by default and can be raised to 60 [REQ: FR-132, A-07]. `-an` makes every export silent.

**Report** [REQ: FR-150]:

```ts
type Report = {
  campaignId: string; campaignName: string; createdAt: string; appVersion: string; outputDir: string
  proceededDespiteWarnings: boolean
  variants: Array<{
    variantId: string; title: string; sizeLabel: string; language: string; format: 'image' | 'video'
    file: string | null                       // path relative to outputDir, null if it failed
    assets: Array<{ assetId: string; displayName: string; role: 'background' | 'image' | 'font' | 'clip'
                    origin: 'generated' | 'imported'; provider?: string; model?: string; prompt?: string }>
    checks: CheckResult[]
    failure: string | null
  }>
}
```

`report.html` is one self-contained file with no scripts. The report view in the app draws the same JSON [REQ: FR-151].

**Translation sheet** [REQ: FR-103]: `translation.exportSheet` writes a CSV in UTF-8 with a byte-order mark so Excel opens it correctly. Columns: `variant_id, title, size, language, layer, source_text, text, status`. One row per text layer of every variant not in the primary language. Publishing includes it as `translations.csv`.

### 6.8 MCP server and bridge
**Direction:** Inbound **Protocol:** MCP, Streamable HTTP **Authentication:** bearer token **Requirements Traced:** [REQ: FR-190, FR-191, IR-003, R-04]

- The server starts only while `settings.mcp.enabled` is true. It is off on first run [REQ: FR-191].
- It binds to `127.0.0.1` only, never `0.0.0.0`.
- It rejects any request that has an `Origin` header, and any request whose `Host` header is not `127.0.0.1:{port}` or `localhost:{port}`. This stops web pages from reaching it.
- If the port is taken, Settings shows "Port {port} is in use. Choose another." and the server stays off.

**Bridge mode.** Starting the app executable with `--mcp-bridge` does not open a window and does not take the single-instance lock. It reads the port and token from the app data folder, then relays MCP messages between stdio and the HTTP endpoint. If the app is not running or the server is off, it answers every request with "Open the app and turn on agent access in Settings."

**Connect panel** shows two blocks to copy:
- Claude Code: `claude mcp add --transport http adman http://127.0.0.1:{port}/mcp --header "Authorization: Bearer {token}"`
- Claude Desktop: a JSON entry with `command` set to the app executable path and `args` set to `["--mcp-bridge"]`.

> ⚠️ Decision Required: The architect did not verify how the current Claude Desktop connects to local servers. In Phase 10, check the current Claude Desktop documentation. If it can reach `http://127.0.0.1` with a header directly, the bridge mode can be dropped.

### 6.9 Checks
**Requirements Traced:** [REQ: FR-110–FR-115, R-03, R-13]

```ts
type CheckResult = {
  checkId: 'required-assets' | 'text-colours' | 'prohibited-words' | 'required-words'
         | 'unapproved-translations' | 'text-overflow'
  group: 'brand-legal' | 'readiness'
  status: 'pass' | 'warn' | 'skipped'
  findings: Array<{ layerId?: string; message: string }>
}
```

| Check | Rule |
|-------|------|
| `required-assets` | For each asset in the rule set: a layer in the variant uses it, is visible, has opacity above 0 and overlaps the canvas. For video, its timing overlaps the duration. Skipped if the list is empty. |
| `text-colours` | Every text layer's `style.color` equals a palette colour, ignoring letter case. Skipped if the palette is empty. |
| `prohibited-words` | No word in the list for the variant's language appears in any text layer. Skipped if there is no list for that language. |
| `required-words` | Every word in the list for the variant's language appears in the variant's text layers joined together. Skipped if there is no list for that language. |
| `unapproved-translations` | No text layer has `translation_status` of `missing` or `proposed`. Skipped for variants in the primary language. [REQ: R-18] |
| `text-overflow` | No visible text layer has `overflow = 1`. [REQ: R-18] |

The first four checks are in group `brand-legal`. The last two are in group `readiness`. They read values the app already stores, so they add no second source for those facts. All six run in `check.run`, before export and on demand, and all six appear in the report. The `checkWarning` badge counts only the `brand-legal` group, because unapproved translations and overflow already have their own badges.

Word matching: both sides are normalised with Unicode NFKC and lowercased. For languages written with spaces, a match must sit on word boundaries found with `Intl.Segmenter`. For Chinese, Japanese and Korean, a match is a plain substring. A list entry may be a phrase.

`check.run` writes `variant_check` and returns the results. Export runs it first, always [REQ: FR-114].

FR-112 (colours inside background images, P2) is not built. The `VerificationProvider` interface and the disabled `jev` entry are its place [REQ: OI-01].

---

## 7. Infrastructure & Deployment

### 7.1 Environment Strategy

| Environment | Purpose | Infrastructure | Access |
|-------------|---------|----------------|--------|
| local | Developer workstation | `npm run dev` (electron-vite). Fake providers by default. | Developer |
| ci | Lint, type check, tests, secret scan, build | GitHub Actions: `macos-latest`, `windows-latest` | Automatic |
| release | Installers for users | GitHub Releases | Public download |

There is no dev, staging or production server.

### 7.2 Cloud & Hosting

None owned by the app. The public GitHub repository hosts the code and the release files [REQ: 9.2].

### 7.3 Containerization

None.

### 7.4 Orchestration

None.

### 7.5 CI/CD Pipeline

```
push / pull request
  └─ lint (ESLint, Prettier check, file-length rule)
  └─ typecheck (tsc --noEmit)
  └─ secret scan (gitleaks)
  └─ unit + integration tests (Vitest)            macOS and Windows
  └─ scene reference-picture tests                macOS and Windows
  └─ build (electron-vite build)

tag v*
  └─ everything above
  └─ fetch FFmpeg (pinned version, SHA-256 checked)
  └─ end-to-end smoke test (Playwright, fake providers)
  └─ package (electron-builder): DMG arm64, DMG x64, NSIS x64
  └─ create a draft GitHub Release with the installers attached
```

- Branches: `main` is always releasable. Work happens on short branches merged by pull request.
- Rollback: users install an earlier release by hand [REQ: 8.7]. A bad release is marked as such and a new one is published.
- Installers are unsigned [REQ: R-16]. The README explains the first-launch steps: on macOS, right-click and choose Open, or allow it in System Settings; on Windows, choose "More info" then "Run anyway".
- The installer registers the project file extension so a double-click opens the project [REQ: R-06].
- No automatic updates [REQ: 1.4].

**FFmpeg** [REQ: FR-143, 9.3]

- Built with `--disable-gpl --disable-nonfree`, plus `--enable-videotoolbox` on macOS and `--enable-mediafoundation` on Windows.
- Needed parts: decoders for H.264, HEVC, VP8, VP9, ProRes and PNG; demuxers for MP4, MOV, WebM and image pipe; filters `scale`, `crop`, `overlay`, `trim`, `setpts`, `loop`, `color`, `format`, `fps`; the MP4 muxer.
- `scripts/fetch-ffmpeg` downloads one archive per platform from a URL pinned in `scripts/ffmpeg-sources.json` with its SHA-256. The binaries are not committed.
- Packaged at `resources/ffmpeg/{platform}-{arch}/ffmpeg[.exe]`.
- `THIRD-PARTY-NOTICES.md` carries the LGPL text, the exact build flags and a link to the matching source.

> ⚠️ Decision Required: Pick the source of the LGPL builds in Phase 8. Ready-made LGPL builds exist for Windows. For macOS the developer may need to build FFmpeg in a CI job and attach the result to a release in this repository. Either way, record the URL and checksum in `ffmpeg-sources.json`.

### 7.6 Infrastructure as Code

None.

### 7.7 Secrets Management

**User secrets** [REQ: FR-170–FR-173, R-10]

- Entered in the app, in Settings or in the key dialog that appears when an action first needs a key [REQ: FR-171].
- A key is not tested when entered [REQ: FR-172].
- Stored in `{userData}/secrets.bin`: a JSON map encrypted as a whole with `safeStorage.encryptString`.
- Held only in the main process. No query returns a secret value. `app.getState` returns each name with its last four characters.
- If `safeStorage.isEncryptionAvailable()` is false, the app refuses to save keys and says "This computer cannot store keys securely."
- Never written to a project file, the log, a report or an MCP reply.

| Secret name | Used by |
|-------------|---------|
| `gemini.apiKey` | Gemini |
| `fal.apiKey` | fal.ai |
| `firefly.clientId`, `firefly.clientSecret` | Firefly (disabled) |
| `s3.accessKeyId`, `s3.secretAccessKey` | S3 |
| `dropbox.refreshToken` | Dropbox |
| `mcp.token` | MCP server |

**Repository secrets** [REQ: FR-181]

- `.gitignore` covers `.env*`, `*.adman`, `* Assets/`, `resources/ffmpeg/`, `out/`, `dist/`, `test-results/`. The `examples/` folder is the one exception.
- gitleaks runs on every push and pull request.
- CI needs only the built-in `GITHUB_TOKEN`.

---

## 8. Security Design

### 8.1 Threat Model Summary

| Threat | Mitigation |
|--------|------------|
| A secret committed to the public repo | No secret files in the repo, gitleaks in CI [REQ: FR-181] |
| A key leaking through a shared project | Keys live only in the app data folder [REQ: FR-173] |
| A key leaking to the agent or the UI | Secrets never leave the main process. No command, query or tool returns one. [REQ: FR-198] |
| Another program or person on the network reaching the MCP server | Off by default, bound to 127.0.0.1, bearer token [REQ: FR-191, R-04] |
| A web page in the user's browser calling the MCP server | Requests with an `Origin` header are rejected. `Host` header is checked. |
| The agent spending money, exporting, publishing or destroying work | Policy table: deny for generation, export, publish; ask for deletes [REQ: FR-197, FR-199] |
| Text from an agent, a brief or an AI answer carrying HTML or script | All such text is set as text content. The Scene never uses `dangerouslySetInnerHTML`. Strict content security policy. |
| A project file from someone else pointing at private files, which a later publish would upload | A path is linked only if the file's content is a real image, video, font or text file of an accepted type, checked by reading its first bytes. The publish dialog lists every component file with its full path before upload. [REQ: R-06] |
| A corrupt or hostile project file | Every JSON column is parsed with Zod on read. A row that fails is reported and skipped. |
| An imported file with active content | SVG is not accepted. Accepted types are fixed (Section 8.3). |
| The window being steered to web content | Navigation and new windows are blocked. Links open in the system browser, `https:` only. |

### 8.2 Network Security

- The app listens on the network in two cases only: the MCP server on `127.0.0.1:{mcp.port}`, and the Dropbox sign-in redirect on `127.0.0.1:47822` for the length of the sign-in.
- Outbound calls go only to the provider the user chose for the action. All use TLS through the provider SDKs. There is no telemetry [REQ: 1.4].

**Window settings** (app window and hidden render window): `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, `webSecurity: true`.

**Content security policy:**

```
default-src 'self';
img-src 'self' adman-asset: data: blob:;
media-src adman-asset:;
font-src 'self' adman-asset:;
style-src 'self' 'unsafe-inline';
script-src 'self';
connect-src 'none'
```

`adman-asset://` is a custom protocol handled in the main process. It serves a file only when the project is open and the asset ID exists in it.

### 8.3 Data Security

- Secrets: encrypted at rest (Section 7.7).
- Project files and assets: not encrypted. They are ordinary user documents.
- Log: never contains secret values. Prompts and brief text may appear, and stay on the machine [REQ: FR-153].

**Accepted file types** (`file-types.ts`) [REQ: FR-051]:

| Kind | Types |
|------|-------|
| Image | PNG, JPEG, WebP |
| Video | MP4, MOV, WebM |
| Font | TTF, OTF, WOFF2 |
| Text | TXT, MD, JSON, YAML |

A file is accepted when its extension is in the list and its first bytes match the type.

### 8.4 Compliance Controls

No compliance standard is named [REQ: 6.3].

| Requirement | Control Implemented |
|-------------|---------------------|
| No personal data, no telemetry [REQ: 6.3] | No outbound calls except chosen providers |
| Prompts in generated files are readable by others [REQ: 6.3] | Reminder in the publish dialog |
| Agent can read open projects [REQ: 6.3] | Stated beside the MCP switch in Settings: "A connected agent can read the projects you have open. That content goes to the AI service that runs the agent." |
| Licence intent: public code, no commercial reuse by others [REQ: 9.3, OI-02] | `LICENSE` is PolyForm Noncommercial 1.0.0. All npm dependencies must be under MIT, ISC, BSD, Apache-2.0 or similar. CI runs a licence check and fails on GPL or AGPL packages. FFmpeg is LGPL and shipped as a separate program. |
| Font licences [REQ: 9.3] | Fonts publish only with `font_publish_allowed` |

The stakeholder confirmed PolyForm Noncommercial 1.0.0 [REQ: R-19]. The architect is not a lawyer and this is not legal advice.

---

## 9. Observability

### 9.1 Logging

One JSON object per line in `{userData}/logs/activity-{YYYY-MM-DD}.jsonl`. A new file each day. Files older than 30 days are deleted on start. Nothing is sent anywhere [REQ: FR-153].

**Required Log Fields:**
```json
{
  "timestamp": "ISO 8601",
  "level": "info|warn|error|debug",
  "event": "command|job|provider|mcp|asset|app",
  "name": "layer.update",
  "actor": "user|agent|system",
  "agentClient": "client name or null",
  "projectId": "ULID or null",
  "campaignId": "string or null",
  "variantId": "string or null",
  "jobId": "ULID or null",
  "ok": true,
  "errorKind": "string or null",
  "message": "string",
  "context": {}
}
```

- Every command is logged with its actor, which marks agent-made edits [REQ: FR-200].
- Auto-approved destructive agent actions are logged with `context.autoApproved: true`.
- The fixed field set is what opt-in telemetry would send later [REQ: FR-153].

### 9.2 Metrics

None. The stakeholder set no targets [REQ: 8.1]. Job durations are recorded in the log `context`.

### 9.3 Distributed Tracing

None. A command's ULID is carried in `context.commandId` on every log line it causes.

### 9.4 Alerting

None. There is no operator. The user sees failures in the activity panel and in plain-language dialogs [REQ: FR-152, FR-069].

---

## 10. Testing Strategy

### 10.1 Test Coverage Requirements

| Test Type | Coverage Target | Tooling | Runs In |
|-----------|-----------------|---------|---------|
| Unit | 90% of lines in `src/shared/`, 80% in `src/main/` outside providers | Vitest | CI |
| Integration (commands against a temporary project file) | Every command in Section 4.2 has a success test and a rule-violation test | Vitest | CI |
| Provider adapters | Each adapter tested against recorded responses, including one test per error kind | Vitest | CI |
| Scene reference pictures | Each preset at 5 points in time, each layer type, CJK text, overflow | Vitest + hidden window, per-OS reference files, 0.5% pixel tolerance | CI |
| Component and accessibility | Every dialog and panel: keyboard path, labels, axe-core with no violations | Testing Library, axe-core | CI |
| End-to-end | Workflows 5.1 to 5.7 with fake providers | Playwright (Electron) | CI on tags |
| MCP | Every tool, the ask flow, token and header rejection | MCP SDK client in Vitest | CI |
| Performance / Load | None. No targets set. | — | — |
| Security | gitleaks, `npm audit` at high severity, licence check | — | CI |

**Tests that must exist by name:**
- The same variant drawn at frame `i` twice gives identical pictures [REQ: FR-131].
- A video export of a fixed variant has exactly `ceil(duration × fps)` frames [REQ: FR-131].
- An exported PNG has no `generation` chunk, and a generated PNG has one [REQ: FR-068].
- No MCP tool reply, log line or project file contains a secret value [REQ: FR-198].
- Publishing campaign A never lists, writes or deletes outside `{campaignIdA}/` [REQ: FR-164].
- An agent `set_translation` never yields `approved` [REQ: FR-200].
- Editing a master changes no other variant's layer rows [REQ: FR-081].
- The app starts and completes import, manual layout and image export with no secrets saved and the network disabled [REQ: 8.2].

### 10.2 Test Data Strategy

- Tests create project files in a temporary folder and set `ADMAN_USER_DATA_DIR` to another temporary folder.
- `ADMAN_FAKE_PROVIDERS=1` registers the `fake` provider for every job. It returns fixed pictures, a fixed 2-second video, layout boxes from a fixed rule and "translations" made by adding a language tag to the source text. It can be told to fail with each error kind.
- `examples/` holds `brief.yaml` with two subjects, four small source images and the six exported PNGs (three sizes, two languages) that the README shows [REQ: FR-180].
- No real provider is called in CI. `npm run test:live` calls real providers using keys from the developer's own environment and is run by hand.

### 10.3 Contract Testing

Provider adapters are tested against recorded responses kept in `tests/fixtures/providers/`. The MCP tool list is snapshot-tested so a change to a tool's name or input is a visible diff.

### 10.4 Verification policy

Every change has a class. The developer runs the checks for that class. The full gate runs before a release, not for each change.

| Class | Kind of change | Required checks |
|-------|----------------|-----------------|
| A | Pure logic in `src/shared/` (follow rules, checks, presets, paths) | Lint, typecheck, unit tests for the touched module |
| B | Data and commands (`src/main/db`, `src/main/commands`) | Class A + integration tests for the touched commands + migration test if the schema changed |
| C | Drawing and export (`src/shared/scene`, render and export services) | Class A + reference-picture tests |
| D | UI (`src/renderer`) | Lint, typecheck, component and accessibility tests for the touched component |
| E | Providers and MCP | Class A + adapter or MCP tests for the touched adapter or tool |
| F | Release | Everything in Section 10.1, on macOS and Windows |

---

## 11. Non-Functional Targets

The stakeholder set no numeric targets [REQ: 8.1]. These are the testable targets this design commits to.

| Attribute | Target | Measurement Method |
|-----------|--------|--------------------|
| UI during a background job | The window stays usable. Jobs run in the main process or the hidden window. | End-to-end test edits a layer while a fake video job runs [REQ: FR-124] |
| Export determinism | Same frames on any machine | Named tests in 10.1 [REQ: FR-131] |
| Data loss on crash | At most the edit in progress | Integration test kills the process after a command and reopens [REQ: 8.2] |
| Work with no keys and no network | Import, layout, checks, image and video export | Named test in 10.1 [REQ: 8.2] |
| Accessibility | WCAG 2.1 AA for controls. Canvas contents are best effort. | axe-core, keyboard tests [REQ: 8.6] |
| Platforms | macOS 12 or later (arm64, x64), Windows 10 or later (x64) | CI runs both [REQ: 8.8] |
| Scale | No hard limit on subjects, campaigns, variants or duration. The campaign grid draws only visible tiles. | Integration test with 500 variants [REQ: 8.3] |
| Availability, RTO, RPO, concurrent users, throughput | Not applicable to a single-user desktop app | — |

**Accessibility rules** [REQ: 8.6]: every control is a Radix primitive or a native element with a visible label or `aria-label`; focus rings are never removed; text and controls use design tokens that meet 4.5:1 contrast; every action on the canvas (select, move, resize, reorder) also has a keyboard path through the layer list and the properties panel.

**Keyboard shortcuts** [REQ: FR-097] (Cmd on macOS, Ctrl on Windows): undo `Z`, redo `Shift+Z`, delete `Delete` or `Backspace`, duplicate `D`, nudge with arrows (1 px, 10 px with Shift), zoom in `=`, zoom out `-`, zoom to fit `0`. On the timeline: play or pause `Space`.

---

## 12. Project Structure

One repository, one package.

```
project-root/
├── src/
│   ├── main/                    # Electron main process
│   │   ├── index.ts             # start-up, single-instance lock, --mcp-bridge switch
│   │   ├── windows/             # app window, hidden render window, asset protocol
│   │   ├── db/                  # Drizzle schema, migrations, open and close
│   │   ├── commands/            # command bus, agent-policy.ts, one folder per domain
│   │   ├── queries/
│   │   ├── history/             # undo lists
│   │   ├── assets/              # path-resolver.ts, import, relink, package, type sniffing
│   │   ├── jobs/                # runner, resume
│   │   ├── providers/           # registry.ts, gemini/, fal-seedance/, firefly/, s3/, dropbox/, azure-blob/, jev/, fake/, local-storage/
│   │   ├── render/              # render service
│   │   ├── export/              # image, video (FFmpeg filter builder), report, sheet
│   │   ├── publish/
│   │   ├── mcp/                 # server, tools, bridge
│   │   ├── secrets/
│   │   ├── settings/
│   │   └── log/
│   ├── preload/                 # window.api bridge
│   ├── renderer/                # app window (React)
│   │   ├── app/                 # shell, tabs, routes
│   │   ├── stores/              # app-store.ts, project-store.ts (one per tab)
│   │   ├── screens/             # start, project-home, campaign, editor, settings
│   │   ├── editor/              # canvas, handles, snapping, layer list, properties, timeline
│   │   ├── dialogs/             # brief-confirm, slots, generation, run-confirm, fan-out, sync-review, export, publish, report, agent-permission, key, relink
│   │   ├── panels/              # activity
│   │   └── ui/                  # shared controls and design tokens
│   ├── render-worker/           # hidden window entry: mounts Scene, answers render requests
│   └── shared/                  # no Electron or Node imports
│       ├── schemas/             # Zod: brief, commands, queries, MCP tools, JSON columns
│       ├── scene/               # Scene component, presets.ts, background-placement.ts, overflow
│       ├── links/               # follow-rules.ts, out-of-date, sync preview
│       ├── checks/
│       ├── paths/               # output-paths.ts
│       ├── templates/           # starter.ts
│       └── config/              # defaults.ts, file-types.ts, region-languages.ts, public-ids.ts
├── tests/
│   ├── integration/
│   ├── e2e/
│   ├── fixtures/
│   └── reference-pictures/{darwin,win32}/
├── examples/                    # brief.yaml, source images, six exported PNGs
├── resources/                   # app icon, bundled default font; ffmpeg/ is fetched, not committed
├── scripts/                     # fetch-ffmpeg, ffmpeg-sources.json
├── .github/workflows/
├── LICENSE
├── THIRD-PARTY-NOTICES.md
├── README.md
├── REQUIREMENTS.md
└── SPEC.md
```

**Module rules:**
- `src/shared/` imports nothing from `main`, `renderer` or Electron.
- `src/renderer/` reaches the main process only through `window.api`.
- Only `src/main/assets/path-resolver.ts` builds asset paths. An ESLint rule bans `path.join` with asset fields elsewhere.
- The Scene is a pure component: props are the variant, its layers and clips, a map of asset IDs to `adman-asset://` addresses, the time in milliseconds, and a mode (`full` or `overlay-only`).

**Code rules** (stakeholder's standing rules):
- A source file is at most 200 lines. 300 is the hard limit, enforced by ESLint `max-lines`. Generated files and large static data are exempt.
- No semicolons in TypeScript or JavaScript.

**Naming Conventions:**
- Files and directories: kebab-case
- React components: PascalCase exports in kebab-case files
- Environment variables: UPPER_SNAKE_CASE
- Database tables and columns: snake_case
- Commands and queries: `domain.action` in camelCase
- MCP tools: snake_case

**README contents** [REQ: FR-180]: what the app is; download and first-launch steps for unsigned installers; how to run from source; the example brief with its six output pictures; key design decisions (a short form of Section 16); assumptions and limitations (Section 1.4 of REQUIREMENTS.md, plus R-06 linked files and R-16 unsigned installers).

---

## 13. Environment Variables

Users never set any of these. They exist for development and CI. User configuration is in `settings.json` (13.1).

| Variable | Service | Required | Description | Example / Default |
|----------|---------|----------|-------------|-------------------|
| `ADMAN_FAKE_PROVIDERS` | main | No | `1` registers the fake provider for every job | `1` in dev and CI |
| `ADMAN_USER_DATA_DIR` | main | No | Overrides the app data folder | Temporary folder in tests |
| `ADMAN_LOG_LEVEL` | main | No | Lowest level written to the log | `info` |
| `GEMINI_API_KEY` | `test:live` only | No | Developer's own key for hand-run live tests | — |
| `FAL_KEY` | `test:live` only | No | Developer's own key for hand-run live tests | — |
| `GITHUB_TOKEN` | CI | Yes (CI) | Creates the draft release | Provided by GitHub Actions |

### 13.1 settings.json

```ts
type Settings = {
  defaultProjectDir: string            // default: {Documents}/Adman Projects  [REQ: FR-004]
  recentProjects: Array<{ path: string; name: string; openedAt: string }>   // max 20  [REQ: FR-002]
  defaultProviders: { image: string; layout: string; text: string; video: string }  // default gemini, gemini, gemini, fal-seedance  [REQ: FR-067]
  generation: { optionsPerRun: number }          // default 4  [REQ: FR-063]
  export: { imageFormat: 'png' | 'jpg'; jpgQuality: number; fps: 30 | 60 }   // default png, 90, 30
  mcp: { enabled: boolean; port: number; autoApproveDestructive: boolean }   // default false, 47821, false  [REQ: FR-191, FR-197]
  storage: {
    s3: { bucket: string; region: string; prefix: string } | null
    dropbox: { accountName: string; rootPath: string } | null
  }
}
```

The file is written by the app only [REQ: FR-170].

---

## 14. Implementation Phases

Each phase lists its verification class from Section 10.4.

### Phase 1 — Shell, project file, settings and keys
**Goal:** The app opens, creates and reopens project files in tabs, and stores keys.
**Class:** B, D
**Scope:**
- [ ] Repository, tooling, lint rules (no semicolons, file length), CI for push
- [ ] Main process, preload bridge, app window, window security settings, content security policy
- [ ] Project file: schema, migrations, open and close with exclusive lock, newer-version refusal
- [ ] Command bus with actor, transactions, events, undo lists, activity log
- [ ] Start screen, project tabs, recent projects, default project location
- [ ] Settings screen, secrets store, key dialog (`NEEDS_KEY` flow)
- [ ] File extension registration in the installers

**Exit Criteria:** Create a project, close the app, double-click the file and it opens. Two projects open as tabs. A saved key shows only its last four characters. All Phase 1 commands have integration tests.
**Dependencies:** None.

### Phase 2 — Assets, subjects, brief intake and campaigns
**Goal:** A brief becomes a campaign with a master variant.
**Class:** B, D
**Scope:**
- [ ] Asset import (link or copy), type sniffing, two libraries, attach to subject
- [ ] Path resolver, `adman-asset://` protocol, missing-file detection, relink, change detection
- [ ] Package project
- [ ] Subjects
- [ ] Brief parsing for JSON and YAML, blank form, confirm form, region-language table
- [ ] Campaign, rule set (with copy from another campaign), custom sizes
- [ ] Starter template and slot view
- [ ] Project home and campaign view (grid without thumbnails)

**Exit Criteria:** `examples/brief.yaml` produces a campaign whose master has a headline layer with the message word for word. Moving a linked file and relinking works. Package project opens on a second machine with nothing missing.
**Dependencies:** Phase 1.

### Phase 3 — Scene and editor
**Goal:** The user lays out a post by hand.
**Class:** C, D
**Scope:**
- [ ] Scene component for image variants: background, image and text layers, fonts, overflow measurement
- [ ] Hidden render window and render service, thumbnails
- [ ] Editor: canvas, selection, move, resize, rotate, reorder, show, hide, lock, delete
- [ ] Layer list, properties panel (text and image properties), background transform
- [ ] Snapping and alignment guides, keyboard shortcuts, undo and redo per variant
- [ ] Font upload and use, bundled default font

**Exit Criteria:** Every layer action in FR-092 to FR-097 works by mouse and by keyboard. Overflowing text shows a badge. Reference-picture tests pass on both systems.
**Dependencies:** Phase 2.

### Phase 4 — AI generation
**Goal:** Empty slots can be filled with AI.
**Class:** E, D
**Scope:**
- [ ] Provider registry, error kinds, plain messages, job runner, activity panel
- [ ] Fake provider
- [ ] Gemini adapter: image generate, layout, extract brief, copy options
- [ ] Generation panel, run confirmation dialog with count and provider choice
- [ ] Generation details embedded in PNG
- [ ] Markdown and plain-text brief intake
- [ ] Firefly stub, listed as not yet available

**Exit Criteria:** Workflow 5.1 runs end to end with the fake provider in CI and with a real Gemini key by hand. Each error kind shows its message and a retry button.
**Dependencies:** Phase 3. Gemini model IDs checked (Section 6.2).

### Phase 5 — Variants, fan-out, links and sync
**Goal:** One master drives a grid of variants.
**Class:** A, B, D
**Scope:**
- [ ] Follow rules, revision counters, out-of-date calculation, overrides
- [ ] Fan-out with the background fit dialog; generative fill through Gemini `extend`
- [ ] Sync preview and apply, sync review dialog
- [ ] Directions: create from a master, one grid per direction
- [ ] Campaign undo list, including variant delete
- [ ] Status badges on the grid

**Exit Criteria:** Workflows 5.3 and 5.4 pass end to end. The named test "editing a master changes no other variant's layer rows" passes.
**Dependencies:** Phase 4.

### Phase 6 — Localization and checks
**Goal:** Translations with approval, and brand and legal checks.
**Class:** A, B, D, E
**Scope:**
- [ ] Gemini `translate`, translation at fan-out and in sync review
- [ ] Translation status, edit, approve (single and all same-language), brief-supplied copy
- [ ] Translation sheet export
- [ ] Per-language fonts through the `style.fontAssetId` override
- [ ] The six checks (four brand and legal, two readiness), on demand and stored per variant

**Exit Criteria:** Workflow 5.2 passes end to end. Each check has pass, warn and skipped tests, including a CJK case.
**Dependencies:** Phase 5.

### Phase 7 — Video and timeline
**Goal:** Video variants preview as they will export.
**Class:** C, D, E
**Scope:**
- [ ] Animation presets as pure functions; Scene support for time, timing and presets
- [ ] Background track: clips, move, reorder, trim, black gaps, preview with `<video>`
- [ ] Timeline: one track per layer, timing bars, entrance and exit blocks, playhead, play, pause, scrub
- [ ] fal.ai Seedance adapter, job resume, details embedded in MP4
- [ ] Video format in fan-out

**Exit Criteria:** Workflow 5.5 passes with the fake provider. Preset reference pictures pass. A running video job survives closing and reopening the app.
**Dependencies:** Phase 6. Seedance route checked (Section 6.3).

### Phase 8 — Export and reports
**Goal:** Deliverables and a report on disk.
**Class:** C, B
**Scope:**
- [ ] FFmpeg fetch script, packaging, notices file
- [ ] Image export (PNG, JPG), video export (frame pipe, filter builder, system encoders)
- [ ] Output path builder, partial-file rename
- [ ] Checks before export, proceed-with-warnings flow
- [ ] Report JSON, HTML file, in-app report view

**Exit Criteria:** The named determinism and frame-count tests pass. A whole-campaign export of the example produces the documented folder layout and a report on both systems.
**Dependencies:** Phase 7. FFmpeg build source chosen (Section 7.5).

### Phase 9 — Cloud publishing
**Goal:** A campaign's deliverables and components in S3 or Dropbox.
**Class:** E, D
**Scope:**
- [ ] Storage interface, local implementation, S3, Dropbox with browser sign-in, Azure stub
- [ ] Publish flow: inspect, warn, fresh export, component collection, upload, manifest, stale cleanup
- [ ] Font sharing checkbox
- [ ] Cloud storage settings

**Exit Criteria:** The named test for campaign folder isolation passes against a fake storage. A hand-run publish to a real S3 bucket and a real Dropbox folder shows the documented layout.
**Dependencies:** Phase 8. Dropbox app key supplied (Section 6.5).

### Phase 10 — MCP server
**Goal:** Claude can read and edit open projects.
**Class:** E, D
**Scope:**
- [ ] Server on 127.0.0.1 with token, header checks, on and off switch
- [ ] All tools in Section 4.5 over the existing commands
- [ ] Ask flow, permission dialog, automatic permission setting
- [ ] Bridge mode, Connect to Claude panel
- [ ] Agent activity indicator, agent marking in the log

**Exit Criteria:** Workflow 5.7 passes with an MCP test client. By hand, Claude Code places copy on a variant and the edits appear live and can be undone. The named secret-leak test passes.
**Dependencies:** Phase 6 (commands exist). Claude Desktop connection checked (Section 6.8).

### Phase 11 — README, example set and release
**Goal:** A public repository someone can run.
**Class:** F
**Scope:**
- [ ] README, example brief, source images and six exported PNGs
- [ ] LICENSE, third-party notices, licence check in CI
- [ ] Release workflow, unsigned installers for macOS and Windows
- [ ] Full verification gate on both systems

**Exit Criteria:** A fresh machine installs from the release, opens the example and exports it with no keys. Section 10.1 passes in full.
**Dependencies:** Phases 1 to 10.

---

## 15. Open Items & Decisions Required

| # | Item | Owner | Blocking | Due |
|---|------|-------|----------|-----|
| OI-01 | Jev for image colour checks (FR-112, P2). Only the introduction page was read. It can answer true-or-false questions about an image, so the fit is plausible. Not built; a disabled slot exists. Decide after reading its sign-up, endpoint and pricing pages. | Stakeholder, Architect | No | After this build |
| OI-02 | Licence: closed. PolyForm Noncommercial 1.0.0, confirmed by the stakeholder. | — | No | — |
| OI-03 | Firefly: closed. No route without an enterprise plan was found. Stub only. | — | No | — |
| OI-04 | Confirm the Seedance model ID, limits and price on fal.ai by testing | Developer | Yes, for Phase 7 | Start of Phase 7 |
| OI-05 | Embedded details: closed. PNG `iTXt` chunk and MP4 `comment` tag (Section 6.6). | — | No | — |
| OI-06 | Whether an agent may later start generation, export or publish | Stakeholder | No | After this build |
| OI-07 | Product name: closed. Adman, `.adman`, `com.adman.app`. Other advertising products use the name ADMAN; the stakeholder accepted this. Not a trademark check. | — | No | — |
| OI-08 | Register a Dropbox app and supply its app key | Stakeholder | Yes, for Phase 9 | Start of Phase 9 |
| OI-09 | Choose the source of LGPL FFmpeg builds for macOS and Windows | Developer | Yes, for Phase 8 | Start of Phase 8 |
| OI-10 | Check current Gemini model IDs | Developer | Yes, for Phase 4 | Start of Phase 4 |
| OI-11 | Check how the current Claude Desktop connects to a local MCP server, and keep or drop bridge mode | Developer | No | Phase 10 |
| OI-12 | Export warnings for unapproved translations and overflowing text: closed. Added as two readiness checks (Section 6.9). | — | No | — |
| OI-13 | Update REQUIREMENTS.md with the changes in Section 0 | Requirements Analyst | No | Before Phase 1 |
| OI-14 | Signed installers. The stakeholder may have an Apple Developer ID. | Stakeholder | No | After this build |

---

## 16. Architecture Decision Records (ADRs)

All dated 2026-11-20, status Accepted.

### ADR-001: The main process owns data and rules
**Context:** User and agent edits must follow the same rules, appear live, be undoable and be logged [REQ: FR-200]. Keys must never reach the UI or the agent [REQ: FR-198].
**Decision:** All data access and rules run in the main process behind a command bus. Windows send commands and draw.
**Alternatives Considered:** Logic in the window; a separate MCP service.
**Consequences:** Every UI action is a round trip to the main process. Dragging needs transient local state. One place enforces policy, undo and logging.

### ADR-002: A project is one SQLite file that links to assets
**Context:** The stakeholder wants a single document file and does not want large files duplicated [REQ: R-06].
**Decision:** One SQLite file with a custom extension. Assets are linked by relative and absolute path. Generated files go to a folder beside it. Package project gathers everything for moving.
**Alternatives Considered:** A project folder holding everything (the original FR-001); all assets stored inside the one file.
**Consequences:** Links can break when files move, so the app needs missing-file detection, relinking and packaging. A project file from someone else can point at local files, which is handled by type checks and by listing files before publishing.

### ADR-003: Zustand holds a copy, SQLite holds the truth
**Context:** Stakeholder chose zustand. Several tabs and an agent can change the same project [REQ: FR-003, FR-200].
**Decision:** One zustand store per project tab, updated from `project.changed` events. Commands are not applied optimistically, except transient drag state.
**Alternatives Considered:** Optimistic updates everywhere; state only in the window.
**Consequences:** Simple and consistent. A small delay between an action and its effect, which is negligible locally.

### ADR-004: Posts are drawn with HTML by one Scene component
**Context:** Text must stay editable, support uploaded and CJK fonts, and report overflow. Preview must match export [REQ: FR-056, FR-098, FR-130].
**Decision:** One pure React component draws a variant at a time. The editor, thumbnails, agent pictures and export all use it.
**Alternatives Considered:** Konva or another canvas library; SVG.
**Consequences:** The editor's handles, snapping and guides are built by hand. Text rendering is the browser's, which differs slightly between macOS and Windows, so reference pictures are kept per system.

### ADR-005: Animation presets are pure functions of time
**Context:** Export must be identical on any machine [REQ: FR-131]. Animation is stored as data [REQ: FR-129]. GSAP's licence restricts visual no-code animation tools [REQ: R-14].
**Decision:** `presets.ts` maps preset, progress and word index to opacity and offset. Preview feeds it clock time. Export feeds it frame time.
**Alternatives Considered:** GSAP timelines seeked per frame; CSS animations.
**Consequences:** Only the five presets exist. Adding one means adding a function. No licence exposure.

### ADR-006: Video export overlays captured frames on an FFmpeg background
**Context:** Frame-exact seeking of a `<video>` element is unreliable, and text must be burned in exactly as previewed [REQ: FR-126, FR-131].
**Decision:** The hidden window draws all non-background layers on a transparent page, one frame at a time. FFmpeg builds the background from the clips and overlays the frames.
**Alternatives Considered:** Capturing the whole Scene including video; drawing text with FFmpeg's own text filter.
**Consequences:** Background placement is computed in one shared function used by both the Scene and the filter builder. Export speed depends on frame capture, eased by reusing unchanged frames.

### ADR-007: LGPL FFmpeg with system encoders
**Context:** The licence intent bars commercial reuse by others, which conflicts with GPL parts of FFmpeg [REQ: 9.3].
**Decision:** Build with `--disable-gpl --disable-nonfree`. Encode H.264 with VideoToolbox on macOS and Media Foundation on Windows.
**Alternatives Considered:** A GPL build with x264 run as a separate program.
**Consequences:** Files exported on the two systems differ in size and quality. Frames and timing are the same. A macOS LGPL build may have to be made in CI.

### ADR-008: Links are stored copies with revision counters
**Context:** Nothing may change in a linked variant until the user syncs, and overrides must be skipped [REQ: FR-081, FR-083].
**Decision:** Each variant stores full layer values. Master layers count changes per property group. Linked layers record the count they last synced to. Out of date is computed. Overrides are property paths.
**Alternatives Considered:** Resolving inherited values on read; a stored out-of-date flag.
**Consequences:** Sync is an explicit copy with a clear preview. Layer rows are larger. No flag can drift from the truth.

### ADR-009: One agent policy table over the same commands
**Context:** The agent has a limited action set now, and more may be allowed later [REQ: FR-197, FR-199].
**Decision:** MCP tools call the same commands as the UI. One table marks each command allow, ask or deny for agents.
**Alternatives Considered:** Separate agent-only code paths.
**Consequences:** Allowing generation, export or publish later is a table edit plus a tool definition. Agent edits get undo, logging and live display for free.

### ADR-010: MCP over HTTP on 127.0.0.1 with a token, plus a bridge mode
**Context:** The server must accept only same-computer connections [REQ: FR-191]. Any local program or web page could otherwise reach it. The first agent app is Claude.
**Decision:** Streamable HTTP bound to 127.0.0.1, bearer token, `Origin` and `Host` checks. The app executable has a `--mcp-bridge` mode for clients that only launch command-line servers.
**Alternatives Considered:** Stdio only (cannot reach a running app's open projects without a bridge anyway); no token.
**Consequences:** The user pastes a token once. Bridge mode needs care with the single-instance lock.

### ADR-011: Saved keys cannot be viewed
**Context:** FR-173 asked for viewing behind the computer's password or biometric check. Electron has no built-in cross-platform prompt for that [REQ: R-10].
**Decision:** Keys are write-only in the UI. The last four characters are shown.
**Alternatives Considered:** Native code per system for the password or biometric prompt.
**Consequences:** Stricter than the requirement and no native code. A user who loses a key gets it again from the provider.

### ADR-012: Publish does a fresh export
**Context:** Publishing must upload final exports, components, the sheet and the report as one consistent set [REQ: FR-162].
**Decision:** `publish.run` exports the whole campaign to a temporary folder, then uploads, writes a manifest and removes stale files under the campaign's folder only.
**Alternatives Considered:** Uploading whatever the last export left on disk.
**Consequences:** Publishing takes as long as an export plus the upload. The published set always matches the project at that moment.

---

## 17. Glossary

Terms from REQUIREMENTS.md Section 12 keep their meaning. Added or changed here:

| Term | Definition |
|------|------------|
| Project file | The single SQLite file, with a custom extension, that is a project |
| Assets folder | The folder beside the project file where generated and copied files are saved |
| Linked file | An imported file that stays where it is and is referred to by path |
| Managed file | A file the app saved into the assets folder |
| Reference library | Files used only as input to image generation |
| Asset library | Files that can go on a post |
| Hero image | An asset-library image attached to a subject |
| Package project | The command that copies the project file and every linked file into one folder |
| Command | A validated request to change data, sent by the window or the MCP server |
| Actor | Who sent a command: user or agent |
| Agent policy | The table marking each command allow, ask or deny for agents |
| Scene | The component that draws one variant at one time |
| Property group | A set of layer properties that link and sync together: copy, style, geometry, source, timing, animation |
| Follow rule | Whether a linked layer takes a property group from its master |
| Layer key | The ID a layer shares with its matching layer in the master |
| Bridge mode | Running the app executable with `--mcp-bridge` to relay MCP between stdio and the running app |
| Fake provider | A built-in provider for tests and development that needs no key |

---

## 18. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1 | 2026-11-20 | Solution Architect | Working decision log during the design dialogue |
| 1.0 | 2026-11-20 | Solution Architect | Full specification |
| 1.1 | 2026-11-20 | Solution Architect | Product named Adman. Extension, app ID, asset protocol and environment variable prefix renamed to match. |
| 1.2 | 2026-11-20 | Solution Architect | Licence confirmed. Export warns about unapproved translations and overflowing text (two readiness checks). |

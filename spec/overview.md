# Overview: requirement changes, architecture, stack, ADRs, glossary

What Adman is built from: where the spec departs from the requirements, how the app is split into parts, which libraries it uses, the architecture decisions and the terms used across the spec. Read it first. A developer then usually needs `spec/structure.md` (where code goes) and `spec/data-model.md` (what is stored).

## How the spec relates to the requirements

- Where the spec and REQUIREMENTS.md differ, the spec wins.
- `[REQ: FR-xxx]` points at a requirement. `REQUIREMENTS.md` is the index and names the file under `requirements/` that holds each section (version 1.4). Some live in drafts not yet merged:
  - FR-230 to FR-249: `requirements/draft-client-input.md`, Section 2.
  - FR-250 to FR-291: `requirements/draft-comfyui.md`.
  - FR-294 to FR-308: `requirements/draft-d053.md`.
- `[REQ: R-xx]` points at a row of the table below.
- `[D-0xx]` points at a stakeholder decision in `DECISIONS.md`, which holds the stakeholder's own words.
- `OI-xx` is an open item, listed in `spec/open-items.md`, or in `spec/assumptions.md` with the assumption the build makes meanwhile.

### Requirement changes agreed in architecture

The stakeholder approved each of these. REQUIREMENTS.md was updated to match (its Sections 9.6 to 9.9 map each one to the changed text).

| # | Rule | Effect on REQUIREMENTS.md |
|---|------|---------------------------|
| R-01 | An agent creates a campaign by sending structured brief fields. The app makes no AI extraction call for an agent and shows no confirm form. The campaign appears in the app at once. Creating it cannot be undone. An agent can delete a campaign it created, which is a delete and not an undo [D-010]. Every campaign delete by an agent asks for the user's permission, whoever created the campaign [D-023]. | Refines FR-195, FR-022, FR-023 |
| R-02 | In fan-out, a variant that differs from the master in both size and language copies its text geometry once from the variant with the same size in the master's language. This is a one-time copy, not a link. | Refines FR-075, FR-078, FR-079 |
| R-03 | Rule set word lists are held per language. Required words are checked against the combined text of a variant. Prohibited words are checked in every text layer. | Refines FR-033, FR-113 |
| R-04 | The MCP server requires a token as well as listening on 127.0.0.1 only. | Extends FR-191 |
| R-05 | Image and video variants can share one master. Format is a fan-out choice, and can be changed later (R-20). Timing and animation are stored on every layer and follow the master. | Confirms FR-075, refines FR-079 |
| R-06 | A project is a single file with a custom extension. It links to asset files that stay where they are on the user's machine. | Reverses FR-001, A-01 |
| R-07 | Generated files go to a folder beside the project file, named after it. The user can change the location per project. | Replaces part of FR-001 |
| R-08 | Import links files by default. The import dialog offers "copy into the assets folder" as a choice. | Reverses FR-052, C-07 |
| R-09 | A "Package project" command gathers everything related to the project into one folder: the project file and the file behind every asset the project has a record of, linked or in the assets folder, including generated options no variant uses [D-011, D-022]. A file in the assets folder that the project has no record of is not an asset and is left out. This is how a project moves to another machine. | Replaces the portability success criterion. New FR-008. |
| R-10 | Saved provider and storage keys can never be viewed. The app shows the last four characters. The user can replace or delete a key. The MCP access token is the one exception: the user can see and copy it in full in the Connect panel [D-014]. | Replaces the view rule in FR-173 |
| R-11 | An agent can list assets and fonts by name and ID, without file contents. | Extends FR-192 |
| R-12 | A project has two libraries. The reference library holds files used only as input to image generation. The asset library holds files that can go on a post. A hero image is an asset-library image attached to a subject. | Refines FR-054, FR-055 |
| R-13 | A required asset is "present and visible" when a layer uses it, the layer is not hidden, its opacity is above zero and part of it is inside the canvas. For video, the layer must be on screen for part of the duration. The check does not test whether another layer covers it. | Defines FR-110 |
| R-14 | No GSAP. Animation presets are plain functions of time. | Replaces a preference in 9.1 |
| R-15 | Cloud storage in this build: Amazon S3 and Dropbox. Azure is listed but disabled. | Extends FR-160 |
| R-16 | Installers are unsigned in this build. Security warnings on first launch are accepted. The README carries the standard steps for opening an unsigned app. Needing the README for those steps, and only those, is an accepted exception to "the user must not need the README" [D-015]. | Refines 8.7 |
| R-17 | Undo has one list per variant and one list per campaign. Deleting a variant can be undone from the campaign list. | Refines FR-095 |
| R-18 | Export also warns about unapproved translations and overflowing text. The user can proceed, and the warnings and the decision go in the report, as with brand and legal checks. | Extends FR-114, FR-115 |
| R-19 | The licence is PolyForm Noncommercial 1.0.0. | Closes OI-02 |
| R-20 | A variant's format can be changed after it is created, both ways: image to video [D-012] and video back to image [D-020]. Every video setting is kept while the variant is an image and is back unchanged when it becomes a video again [D-026]. An agent can change a variant's format [D-025]. | Refines FR-070, FR-075 notes, FR-120, 4.18. Gives workflow 5.5 step 1 its command. |
| R-21 | A subject is defined by one or more photos of it; its description is optional. The brief form requires a photo per subject, and a brief may name photos by any file path or by asset ID [D-100]. Every subject photo, in either library, guides AI pictures and can be placed in an ad. `campaign.create` and agents need none, so FR-055's "no files" case stays [D-098]. Design: `spec/subject-photos.md`. | Refines FR-011, FR-021, FR-024, FR-054, FR-055, FR-062, R-12 (REQUIREMENTS.md text not yet updated) |

### Stakeholder decisions that shape the design

Each is in `DECISIONS.md` and REQUIREMENTS.md. The last column says where the spec designs it.

| Decision | Rule | Designed in |
|----------|------|-------------|
| D-007 | The Dropbox app key is supplied. | `spec/storage-and-publish.md` |
| D-010, D-023 | R-01 | `spec/api-commands.md`; agent policy in `spec/mcp-and-agents.md` |
| D-011, D-022 | R-09 | `spec/data-rules.md`, "Package project" |
| D-012, D-020, D-025, D-026 | R-20. The empty-track round trip (OI-20) is covered by `variant.first_clip_made` (A-180). | `spec/data-rules.md`, "Changing a variant's format"; ADR-013 |
| D-013 | Geometry follows only between variants of the same pixel size. There is no ratio-based rule. | `spec/data-rules.md`, "Links" |
| D-014 | R-10 | `spec/mcp-and-agents.md`, `spec/security.md`; ADR-011 |
| D-016 | Opening a project by double-click, the publish dialog listing files first, replacing the MCP token. | `spec/storage-and-publish.md`, `spec/mcp-and-agents.md` |
| D-024 | A brief with one subject is valid. | `spec/brief-and-templates.md` |
| D-027 | Package project refuses when a linked file is missing, unless the user confirms skipping the missing files. | `spec/data-rules.md`, "Package project" |
| D-031 | The app window opens maximized, not full screen [REQ: FR-220]. | "App window at launch" below |
| D-036 | Job record fields, background and attached job kinds, `job.markSeen`, `project.close` refuses while jobs run. | `spec/jobs.md` |

### Build order and client items

- Real image generation and real cloud storage were moved forward and built in Phase 2, ahead of the editor. No phase was renumbered. `spec/phases/` holds the plan each phase and each later piece of work was built from.
- The client items FR-230 to FR-249 each sit in the phase that builds them. Some are designed in depth there, the rest only as scope. Already in the data model: `variant.agent_changed_at` (FR-239), the ready-made size 4:5 with the label `4x5` (FR-247, one pixel size has one label), and `TextStyle.letterSpacing` (FR-249).
- The items S-1 to S-17 of `requirements/draft-client-input.md` are not decided and are not in the spec.
- Navigation follows REQUIREMENTS.md 1.4 (FR-211 to FR-213): open campaigns are the main tabs, with variant tabs inside a campaign. There are no project tabs. Several projects can be open at once; one is shown at a time, chosen with the project switcher in the top row (`spec/editor.md`, "The shell"). That is the build's own choice, kept until Q-038, Q-039 and Q-040 are answered (OI-31 in `spec/assumptions.md`).

## Architecture

### Pattern

A local modular monolith inside one Electron app. The app owns no server. One optional outside part exists: the approvals service (`approvals-service/`), a small web app the user deploys to their own hosting account so that reviewers can sign off ads in a browser (`spec/approvals.md`). The app works in full without it.

In one sentence: **one installed app where the main process owns all data and rules, and windows only draw.**

- The main process owns project files, edit commands, undo, jobs, providers, keys and the MCP server.
- The app window is a React UI. It sends commands and draws what the main process tells it.
- A hidden render window draws posts for export, thumbnails and agent pictures, using the same drawing component as the editor.
- FFmpeg runs as a child process to encode video.

Drivers: user and agent edits must follow one set of rules [REQ: FR-200]; keys must never reach the UI or the agent [REQ: FR-198]; preview must match export [REQ: FR-130, FR-131]; manual work must run with no keys and no network [REQ: 8.2].

Alternatives considered:

| Option | Reason rejected |
|--------|-----------------|
| Business logic in the app window | Agent edits must work whatever the window is showing. Keys must stay out of the UI. [REQ: FR-198, FR-200] |
| Separate MCP background service | The agent may only touch projects open in the app. [REQ: FR-201] |
| Local web server plus browser UI | Electron is fixed by the stakeholder. [REQ: 9.1] |
| Canvas library (Konva) for drawing | Worse text handling. HTML gives fonts, CJK, wrapping and overflow detection. [REQ: FR-056, FR-098] |
| GSAP timelines | Licence restricts visual no-code animation tools. Plain functions are simpler to make frame-exact. [REQ: R-14, FR-131] |

Scope rule [D-053 item 23]: the app has one customer that matters. A case the client does not need may be left out when it adds complexity. That is a reason to leave a thing out, never to weaken a protection.

### System context

```
                         +----------------------------------------------+
                         |                Electron app                  |
 Creative User --------> |  App window (React, zustand)                 |
                         |      | commands / queries      ^ events      |
                         |      v                         |             |
                         |  Main process                                |
                         |   +- Command bus + policy + undo             |
                         |   +- Project store (SQLite per project file) |--> Project file (.adman)
                         |   +- Asset path resolver                     |--> Linked files, assets folder
                         |   +- Job runner                              |
                         |   +- Providers ------------------------------┼--> Gemini, ComfyUI, fal.ai,
                         |   |                                          |    S3, Dropbox
                         |   +- Approvals client -----------------------┼--> Approvals service --> Reviewers
                         |   +- Key store (system key store)            |--> App data folder
                         |   +- MCP server (127.0.0.1 + token) <--------┼--- External agent (Claude)
                         |   +- Render service                          |
                         |         |                                    |
                         |         v                                    |
                         |  Hidden render window (Scene component)      |
                         |         | frames                             |
                         |         v                                    |
                         |  FFmpeg child process -----------------------┼--> Exported files
                         +----------------------------------------------+
```

External actors:

| Actor | Interaction |
|-------|-------------|
| Creative User | Uses the app window |
| External agent (Claude Code, Claude Desktop) | Calls MCP tools on 127.0.0.1 |
| Gemini API | Image, layout and text jobs, on the user's key |
| ComfyUI server | Image and video jobs on a server the user runs, at the address set in Settings. Needs no key. See `spec/comfyui.md`. |
| fal.ai | Image-to-video jobs (Seedance), on the user's key. See `spec/providers-adapters.md`. |
| Amazon S3, Dropbox | Publishing, on the user's account. S3 also holds the pictures and clips of an approvals gallery. |
| Approvals service | The user's own deployed copy of `approvals-service/`. The app sends it a campaign's gallery; it shows the gallery to reviewers and keeps their sign-offs. See `spec/approvals.md`. |
| Reviewers | Open an approval link in a browser, with a password. Never use the app. |
| Teammates | Browse published files in cloud storage. Never use the app. |

Two more entries into the code, beside the app window:

- **Bridge mode.** The same executable started with `--mcp-bridge` opens no window. It passes an agent app's messages to the MCP server of the running app (`src/main/bridge/`; `spec/mcp-and-agents.md`).
- **The quickstart.** `npm run quickstart` runs `quickstart/cli.ts` from a terminal. It reuses the brief reader, the Scene and the layout code in `src/shared/`, and the Gemini adapter in `src/main/providers/`. It draws in a headless browser. It uses no Electron part, no project file and no database (`spec/quickstart.md`).

### Component map

Every component below is built. What is not built is listed under the table.

| Component | Responsibility | Technology | Where |
|-----------|----------------|------------|-------|
| App window | UI, the window's copy of project state per open project, transient drag state | React, zustand, Radix UI | `src/renderer/`: `app/` (shell), `screens/`, `editor/`, `dialogs/`, `ui/` (shared parts), `stores/` |
| Preload bridge | Exposes a typed `window.api` with `command`, `query`, `on`; `window.drop` for dropped files; the render window's `renderApi` | Electron contextBridge | `src/preload/index.ts`, `render.ts` |
| Command bus | Validates, applies the agent policy, runs a command in one transaction, records undo, emits events, writes the log | TypeScript, Zod | `src/main/commands/bus.ts`, `agent-policy.ts`, `run-in-project.ts`; one folder per command domain |
| Query runner | Read-only answers for the window and for agents | TypeScript, Zod | `src/main/queries/` |
| Project store | Opens project files, runs migrations, typed reads and writes | better-sqlite3, Drizzle | `src/main/db/` |
| Asset service | Import, linking, relink, change detection, package project. Its path resolver is the only code that turns an asset ID into a file path. | TypeScript | `src/main/assets/` (`path-resolver.ts`) |
| Link engine | Follow rules, out-of-date calculation, sync preview and apply, the plan for making variants | TypeScript (pure rules in shared, writers in main) | `src/shared/links/`, `src/main/links/` |
| Check engine | Brand and legal checks, the checks before export | TypeScript (pure rules in shared) | `src/shared/checks/`, `src/main/checks/` |
| Translation | Translation runs, approval, the translation sheet | TypeScript | `src/main/translation/`, `src/shared/translation/` |
| Scene | Draws one variant at one time. Used by the editor, thumbnails, agent pictures, export and the quickstart. | React, HTML, CSS | `src/shared/scene/` |
| Render service | Drives the hidden window, captures frames, keeps thumbnails | Electron hidden window | `src/main/render/`, `src/main/thumbnails/`, `src/renderer/render-worker/` |
| Media tool | The one door to FFmpeg | FFmpeg child process | `src/main/media/` (`run-ffmpeg.ts`) |
| Clips | The background clips and the sound of a video variant | TypeScript | `src/main/clips/`, `src/shared/clips/` |
| Export service | Image and video export, report, translation sheet | Render service, media tool | `src/main/export/`, `src/shared/export/` |
| Publish flow | Exports a campaign and uploads it, with a manifest, to S3 or Dropbox | Storage adapters | `src/main/publish/`, `src/shared/publish/` |
| Approvals client | Sends a campaign's gallery to the approvals service, keeps its links and passwords, reads the sign-offs | `fetch`, S3 signed addresses | `src/main/approvals/`, `src/shared/approvals/` |
| Approvals service | The reviewers' gallery in a browser, and their sign-offs. Its own package, deployed by the user. | Next.js, libSQL (Turso) | `approvals-service/` |
| Job runner | Queues, runs, resumes, cancels and retries background jobs | TypeScript | `src/main/jobs/`; one file per job kind in `kinds/` |
| Provider registry | Adapters behind seven interfaces: image, layout, text, cut-out, video, storage, verification | Provider SDKs, Node `http` and `fetch` | `src/main/providers/` (`registry.ts`, `types.ts`, one folder per provider) |
| Key store | Encrypts and holds secrets | Electron safeStorage | `src/main/secrets/` |
| Settings store | Reads and writes `settings.json` in the app data folder | TypeScript, Zod | `src/main/settings/` |
| MCP server | Tools for the external agent, the ask flow, the permissions | MCP TypeScript SDK | `src/main/mcp/`; see `spec/mcp-and-agents.md` |
| MCP bridge mode | Lets agent apps that only launch command-line servers reach the running app | Same executable, `--mcp-bridge` flag | `src/main/bridge/` |
| Activity log | JSON lines log of commands, jobs and errors | TypeScript | `src/main/log/activity-log.ts` |
| Quickstart | A command-line demo: one brief becomes a set of ads, with no app | `tsx`, a headless browser through Playwright | `quickstart/` |

Not built:

- **Adobe Firefly.** A stub adapter, listed as not available (`spec/providers-adapters.md`).
- **Azure Blob storage.** Listed but disabled [REQ: R-15].
- **The licence file, the licence check and a release workflow.** Phase 11, held (`spec/phases/phase-11.md`).
- **ComfyUI:** the Krea 2 workflow, video from two reference pictures, the optional enlarging step, and picking a run back up by a user action. Extending a picture is built in the adapter but not offered, because its workflow is still a draft (`spec/comfyui-workflows.md`, `spec/comfyui-trials.md`).
- **Cut-out through fal.ai, and cancel for a Gemini run** (`spec/ai-jobs.md`, `spec/cancel.md`).
- **The usage and the estimated cost of a run** (`spec/jobs.md`, `spec/export-and-checks.md`).
- **The check of colours inside pictures** [REQ: FR-112] (`spec/export-and-checks.md`).
- **Tests:** the Scene's reference-picture tests are not run in CI and have no Windows pictures; there is no 500-variant scale test (`spec/testing.md`).
- **Sample pictures for the quickstart in the README** (`spec/quickstart.md`).
- Smaller items are marked "Not built" where their topic file describes them.

### App window at launch

Built (`src/main/windows/app-window.ts`) [D-031] [REQ: FR-220]. The stakeholder's words: "the app should default to open with the window maximized (not literally fullscreen)".

- Every time the app creates its window, it opens maximized: it fills the screen's work area and keeps its title bar. The macOS menu bar and Dock, and the Windows taskbar, stay visible.
- Never full screen. The app does not set the `fullscreen` option and never calls `setFullScreen`. The user can still enter full screen with the system's own control.
- The window is maximized on `ready-to-show`, before it is first shown, so the user never sees it small first.
- The window is shown once, on whichever comes first: `ready-to-show`, a page that did not load (`did-fail-load`), or 4 seconds after it is made (`src/main/windows/reveal-window.ts`). The app must never run with no window: on its first launch the installed macOS app did, because `ready-to-show` never arrived. The cause is not known yet; the first launch also asks for Keychain access, which is the suspect. A page that does not load, or whose process ends, writes one line to the activity log (`app.pageLoadFailed`, `app.pageProcessGone`) with a code only, no address or path.
- The size numbers have one owner, `src/main/windows/app-window-options.ts`: 1280 × 820 when un-maximized, 900 × 600 at the smallest.
- Nothing about the window is remembered between launches. `settings.json` has no key for it. Whether it should reopen at its last size is open (OI-26); until answered, it opens maximized on every launch.
- The app window only. The hidden render window is never shown and is sized by the picture it draws.
- Test: `tests/e2e/window.spec.ts` (class G, `spec/testing.md`) launches the built app and reads the window's state from the main process: `isMaximized()` becomes true (the test waits, because the system reports it a moment after the window shows) and `isFullScreen()` is false. Integration tests cannot check this: they do not load Electron.

Closing the last window quits the app on every system, macOS included (`app.on('window-all-closed', () => app.quit())` in `src/main/index.ts`). Whether macOS should keep the app running is open (OI-23); the built behaviour stands until answered.

### Open projects

Built.

- The main process can hold two or more projects open at once. Two open projects may hold rows with the same variant ID; nothing may assume IDs are unique across projects. Named test: two open projects with the same variant ID.
- The window holds a copy of each open project (ADR-003). The start screen stays.
- Project meta is not cached. The `project_meta` table is the owner. The open project handle (`src/main/db/project-file.ts`) holds only `projectId` and `filePath`. Any reader that needs the name or another meta value calls `readMeta`. After `project_meta` changes, `app.getState` and the next read show the new value.

### Shared services (`CoreDeps`)

Built (`src/main/core-deps.ts`, `src/main/core.ts`).

`CoreDeps` is the one object of shared services that `core.ts` builds once and hands to every domain. Every field is required, so every domain always gets them all. The type in `src/main/core-deps.ts` is the list, with a comment on each field. In groups:

- **Stores:** `projects`, `settings`, `secrets`, `undo`, `comfyWorkflows` (the ComfyUI workflows a person or an agent added).
- **Services:** `assets`, `jobs`, `render`, `log`, `providers`.
- **Feature ports:** `approvals`, `export`, `exportPictures`, `media` (FFmpeg), `publish`, `dropboxFetch`.
- **Helpers that need Electron, passed in by `src/main/index.ts`:** `openExternal`, `toPng`, `fitPicture`, `webpToPng`, `readPixels`.
- **Facts:** `devTools`, `appVersion`, `now`, `userDataDir`.

Rules for them:

- `tests/integration/registration.test.ts` ("hands every domain the CoreDeps fields of Section 12") compares the whole list, so an unlisted field fails it.
- `createCore` defaults keep a test or a partial build safe: `devTools` defaults to false; the default `openExternal` opens nothing and throws; the defaults of `toPng` and `fitPicture` throw `toPng is not available` and `fitPicture is not available`. Any hand-built `CoreDeps` in a test carries a `fitPicture` that throws the same message.
- `src/main/index.ts` must fill them all: `openExternal` is Electron's `shell.openExternal` wrapped by `httpsOnly` (`src/main/windows/open-external.ts`, `https:` addresses only); `devTools` is true only when `app.isPackaged` is false and `ADMAN_DEV_TOOLS` is `1` (`src/main/dev-tools-flag.ts`); `toPng` and `fitPicture` come from Electron's `nativeImage` (`src/main/png-converter.ts`, `src/main/picture-fitter.ts`).
- `devCommands(deps)` returns an empty list when `deps.devTools` is false. `app.getState` returns `devTools: boolean`.
- Electron's `nativeImage` decodes PNG and JPEG only. The main process is handed PNG and JPEG and nothing else to decode. `toPng` does not decode WebP. See `spec/providers.md`.

### Ownership rules

Built; these hold for all new work.

- A frozen contract file changes only through the architect, on the main branch. Feature work otherwise edits only its own files.
- Table ownership: asset code writes `asset` and `project_meta`; subject and campaign code writes `subject`, `campaign`, `campaign_subject`, `rule_set`, `direction`, `variant`, `variant_subject`, `layer`. Each reads the other's tables. Campaign code reads `asset` rows by ID (hero images, required assets) and never builds a path. Asset code reads `subject`, `rule_set`, `layer` and `background_clip` to check `asset.update` and to refuse `asset.remove` while an asset is in use.
- Only asset code (`src/main/assets/`) reads `assets_dir_rel` or `assets_dir_abs`. The assets folder is found by `assets_dir_rel` first, then `assets_dir_abs`.
- All code names touched rows with `ctx.changes.touch`, reads and writes rows only through `src/main/db/rows.ts`, returns wire rows from queries, and uses `expect-changes` in each command's success test.
- Code that uses a provider calls `adapterFor` and imports no adapter folder. An adapter lives only in its provider folder.
- Every source file stays under 200 lines. A file that would pass it is split inside its own folder, and the new file is reported. See `spec/structure.md`.

### One owner for each value

No screen holds a copy of any of these.

| Value | Owner | How others get it |
|-------|-------|-------------------|
| The ComfyUI address | `settings.comfyui.baseUrl`, written only by `comfy.setAddress` (`spec/comfyui.md`) | `comfy.getInfo` |
| The Gemini key | The secrets store, written only by `secret.set` | Never. The screen sees the last four characters from `app.getState`. |
| The provider list, what is available, what can be cancelled | `src/main/providers/registry.ts` | `app.getState().providers` |
| The sentence for each error kind, and for each ComfyUI reason (`reasonMessage(reason)`, with `{address}` and `{n}` left as marks the window fills) | `src/shared/providers/messages.ts` | Import. `src/main/providers/messages.ts` only re-exports `plainMessage` from it. |
| The most pictures in one run | `MAX_IMAGES_PER_RUN` in `src/shared/config/defaults.ts` | Import |
| The form of an asset's address | `assetUrl(projectId, assetId)` in `src/renderer/ui/asset-url.ts` | Import. The main process keeps its own reader in `src/main/assets/asset-url.ts`. |
| A workflow graph | The file in `src/main/providers/comfyui/workflows/`. `comfy-workflows/` is a hand-test copy that no code reads. | `comfy.getInfo` (description only) |
| The Dropbox sign-in port 47822 | `DROPBOX_SIGN_IN_PORT` in `src/main/providers/dropbox/sign-in-port.ts` | `src/main/providers/comfyui/own-ports.ts` and the Dropbox sign-in import it. No other file under `src/` writes 47822. |
| The ComfyUI limits (client and adapter) | `src/main/providers/comfyui/limits.ts` | Import. Each new limit is added there by the work that first uses it. |
| The refused-host list for the ComfyUI address | `src/shared/comfy/refused-hosts.ts` | Import |
| Which pictures a run sends | `job.request.referenceAssetIds`, written only by `generation.runImages` | The panel sends asset IDs. It never sends a path or bytes. |
| The name of an uploaded file | `uploadName(bytes)` in `src/main/providers/comfyui/values.ts` | The ComfyUI adapter calls it. No caller, asset row or server text supplies a name. |
| How many pictures a ComfyUI workflow takes | The length of `slots.references` in its `WorkflowSpec` | The command refuses with `too_many_references` and `details.max`. The window holds no copy of the number. |
| The Flux graph | `src/main/providers/comfyui/workflows/flux3-klein-edit-references.json`. `comfy-workflows/flux3-klein-image-references.json` is the hand-test copy; no code reads it. | `comfy.getInfo` (description only) |
| Which providers an agent may run | `agentRunsOffered` in `src/shared/config/agent-runs.ts` | See `spec/mcp-and-agents.md` |

Every screen takes its colours, spaces and sizes from `src/renderer/ui/tokens.css` and is built from the shared parts in `src/renderer/ui/` (`spec/app-style.md`, `spec/app-style-parts.md`).

## Technology stack

Versions are the exact pins in `package.json`. `npm ci` installs them from the lockfile. Node `>=22.12.0` (`engines`).

| Layer | Technology | Version | Why |
|-------|------------|---------|-----|
| Desktop shell | `electron` | 45.4.1 | Fixed [REQ: 9.1] |
| Frontend | `react`, `react-dom`; TypeScript strict | 19.3.1; `typescript` 6.0.3 | Fixed (React) [REQ: 9.1] |
| State (window) | `zustand` | 5.1.0 | Stakeholder choice |
| UI controls | Radix UI primitives (`@radix-ui/react-dialog`, `@radix-ui/react-tabs`), CSS Modules | 1.3.1, 1.2.1 | Keyboard and screen-reader support [REQ: 8.6] |
| Backend | Electron main process, Node.js as bundled | — | See "Pattern" |
| Database | SQLite through `better-sqlite3` | 13.2.0 | Fixed (SQLite) [REQ: 9.1] |
| Query layer and migrations | `drizzle-orm`; `drizzle-kit` | 0.45.4; 0.31.11 | Typed queries (stakeholder confirmed). drizzle-kit is a development tool that writes the migration SQL (`npm run db:generate`) and is not shipped in the app. |
| Validation | `zod` | 4.6.7 | One schema set for briefs, commands, MCP tools [REQ: FR-200] |
| IDs | `ulid` | 3.0.2 | See `spec/data-model.md` |
| Cache | None. Thumbnails are files in the app data folder. | — | |
| Message queue / event bus | In-process job runner and Electron IPC | — | Single-user desktop app |
| Authentication | None for the user. Bearer token for MCP. | — | [REQ: 8.4, R-04] |
| File and object storage | Local disk. `@aws-sdk/client-s3`, `@aws-sdk/lib-storage`, `@aws-sdk/s3-request-presigner` (signed addresses for approval galleries), `@smithy/node-http-handler` and `dropbox` for publishing. | AWS SDK 3.1174.0, smithy 4.14.2, dropbox 10.66.0 | [REQ: FR-160, R-15] |
| AI: image, layout, text | Google Gen AI SDK (`@google/genai`) | 3.6.1 | Stakeholder preference [REQ: IR-002] |
| AI: image and video on a local server | ComfyUI over HTTP, with Node's `http`, `https`, `dns`, `crypto` and Electron's `nativeImage`; `ws` for the live "how far along" connection | `ws` 8.23.0 | See `spec/comfyui.md`. |
| AI: video | fal.ai Seedance over HTTPS with Node's `fetch` | — | No package: the adapter calls the fal queue address itself (`src/main/providers/fal-seedance/`). Stakeholder preference [REQ: IR-002, OI-04]. |
| Agent protocol | `@modelcontextprotocol/sdk`, Streamable HTTP transport | 1.32.2 | Fixed (MCP) [REQ: IR-003] |
| Video encoding | FFmpeg, LGPL build | 9.0.2 | Fixed (FFmpeg) [REQ: FR-143]; LGPL per licence intent [REQ: 9.3]. Fetched by `npm run fetch:ffmpeg` into `resources/ffmpeg/`, not committed; the sources and checksums are in `scripts/ffmpeg-sources.json`. |
| YAML parsing | `yaml` | 2.9.1 | [REQ: FR-020]. ISC licence, no dependencies of its own, no install script, so no `allowScripts` entry. See `spec/brief-and-templates.md`. |
| Monitoring and logging | Local JSON lines log | — | [REQ: FR-153] |
| Infrastructure as code | None | — | No servers |
| CI/CD | GitHub Actions | — | Public repo [REQ: 9.2] |
| Build | `electron-vite`, `vite`, `@vitejs/plugin-react` | 6.0.0, 8.3.8, 6.3.0 | |
| Packaging | `electron-builder` (DMG for macOS arm64 and x64, NSIS for Windows x64) | 26.18.0 | [REQ: 8.8] |
| Quickstart runner | `tsx` | 4.23.15 | Runs `quickstart/cli.ts` without a build step. See `spec/quickstart.md`. |
| Approvals service | `next`, `@libsql/client` | 16.4.6, 0.18.0 | Its own `package.json` in `approvals-service/`. See `spec/approvals-service.md`. |
| Tests | Vitest (with coverage-v8, jsdom), Testing Library (react, user-event, jest-dom), axe-core, Playwright (Electron) | Vitest 5.1.1, Testing Library react 16.3.3, axe-core 4.14.1, Playwright 1.65.1 | See `spec/testing.md` |
| Lint and format | ESLint with typescript-eslint and react-hooks rules; Prettier (`semi: false`, `singleQuote: true`, `printWidth: 100`) | ESLint 10.15.0, Prettier 3.10.1 | Stakeholder code rules |
| Container runtime, orchestration | None | — | Desktop app |

Rules for packages:

- Electron, React, SQLite, FFmpeg and MCP are fixed by REQUIREMENTS.md 9.1.
- Text is drawn with HTML, matching the preference in 9.1.
- FFmpeg burns text into video on export, matching the preference in 9.1.
- The preference for GSAP in 9.1 is replaced [REQ: R-14].
- The preference for one storage interface with local and cloud versions is kept (`spec/storage-and-publish.md`).
- Every bundled dependency must be compatible with the app licence (`spec/security.md`). FFmpeg must be built with `--disable-gpl --disable-nonfree`.
- Nobody adds a package or an `allowScripts` entry on their own decision. A developer who comes to think a package is needed stops and reports. The install-script rules are in `spec/infra-and-settings.md`.

## Architecture decision records and glossary

ADR-001 to ADR-013 and the glossary are in `spec/adrs-and-glossary.md`.

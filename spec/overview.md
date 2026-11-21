# Overview: requirement changes, architecture, stack, ADRs, glossary

What Adman is built from: where the spec departs from the requirements, how the app is split into parts, which libraries it uses, the architecture decisions and the terms used across the spec. Read it first. A developer then usually needs `spec/structure.md` (where code goes) and `spec/data-model.md` (what is stored).

## How the spec relates to the requirements (was 0)

- Where the spec and REQUIREMENTS.md differ, the spec wins.
- `[REQ: FR-xxx]` points at a requirement. Most are in `REQUIREMENTS.md` (version 1.4). Some live in other files:
  - FR-230 to FR-249: `REQUIREMENTS-Client-Input.md`, Section 2.
  - FR-250 to FR-291: `REQUIREMENTS-ComfyUI.md`.
  - FR-294 to FR-308: `REQUIREMENTS-D053.md`.
- `[REQ: R-xx]` points at a row of the table below.
- `[D-0xx]` points at a stakeholder decision in `DECISIONS.md`, which holds the stakeholder's own words.
- `OI-xx` is an open item, listed in `spec/open-items.md`.

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

### Stakeholder decisions that shape the design (was 0.1)

Each is in `DECISIONS.md` and REQUIREMENTS.md. The last column says where the spec designs it.

| Decision | Rule | Designed in |
|----------|------|-------------|
| D-007 | The Dropbox app key is supplied. | `spec/storage-and-publish.md` |
| D-010, D-023 | R-01 | `spec/api-commands.md`; agent policy in `spec/mcp-and-agents.md` |
| D-011, D-022 | R-09 | `spec/data-rules.md`, "Package project" |
| D-012, D-020, D-025, D-026 | R-20. One round-trip case is not covered without a schema change (OI-20). | `spec/data-rules.md`, "Changing a variant's format"; ADR-013 |
| D-013 | Geometry follows only between variants of the same pixel size. There is no ratio-based rule. | `spec/data-rules.md`, "Links" |
| D-014 | R-10 | `spec/mcp-and-agents.md`, `spec/security.md`; ADR-011 |
| D-016 | Opening a project by double-click, the publish dialog listing files first, replacing the MCP token. | `spec/storage-and-publish.md`, `spec/mcp-and-agents.md` |
| D-024 | A brief with one subject is valid. | `spec/brief-and-templates.md` |
| D-027 | Package project refuses when a linked file is missing, unless the user confirms skipping the missing files. | `spec/data-rules.md`, "Package project" |
| D-031 | The app window opens maximized, not full screen [REQ: FR-220]. | "App window at launch" below |
| D-036 | Job record fields, background and attached job kinds, `job.markSeen`, `project.close` refuses while jobs run. | `spec/jobs.md` |

### Build order and client items (was 0.2)

- Real image generation and real cloud storage were moved forward and built in Phase 2, ahead of the editor. No phase was renumbered. `spec/phases/` holds the plan for each phase from 3 on.
- The client items FR-230 to FR-249 each sit in the phase that builds them. Some are designed in depth there, the rest only as scope. Already in the data model: `variant.agent_changed_at` (FR-239), the ready-made size 4:5 with the label `4x5` (FR-247, one pixel size has one label), and `TextStyle.letterSpacing` (FR-249).
- The items S-1 to S-17 of `REQUIREMENTS-Client-Input.md` are not decided and are not in the spec.
- Navigation follows REQUIREMENTS.md 1.4 (FR-211 to FR-213): open campaigns are the main tabs, with variant tabs inside a campaign. There are no project tabs. How projects are shown and switched, and whether tabs are remembered, wait for the UI pass (Q-038, Q-039, Q-040; OI-31).

## Architecture (was 1)

### Pattern

A local modular monolith inside one Electron app. There is no server and no cloud component owned by the app.

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
| fal.ai | Image-to-video jobs, on the user's key. Not built: the adapter is empty and the provider is listed as not available. |
| Amazon S3, Dropbox | Publishing, on the user's account |
| Teammates | Browse published files in cloud storage. Never use the app. |

### Component map (was 1.3)

| Component | Responsibility | Technology | Status |
|-----------|----------------|------------|--------|
| App window | UI, the window's copy of project state per open project, transient drag state | React, zustand, Radix UI | Built in part: shell, start screen, project and campaign pages, picture and video panels, Settings (`src/renderer/`). Editor not built (Phase 3). |
| Preload bridge | Exposes a typed `window.api` with `command`, `query`, `on` | Electron contextBridge | Built (`src/preload/index.ts`) |
| Command bus | Validates, applies the agent policy, runs a command in one transaction, records undo, emits events, writes the log | TypeScript, Zod | Built (`src/main/commands/bus.ts`, `agent-policy.ts`) |
| Project store | Opens project files, runs migrations, typed reads and writes | better-sqlite3, Drizzle | Built (`src/main/db/`) |
| Asset path resolver | The only code that turns an asset ID into a file path | TypeScript | Built (`src/main/assets/path-resolver.ts`) |
| Link engine | Follow rules, out-of-date calculation, sync preview and apply | TypeScript (shared, pure) | Not built (Phase 5) |
| Check engine | Brand and legal checks | TypeScript (shared, pure) | Not built (Phase 6) |
| Scene | Draws one variant at one time. Used by editor, thumbnails, agent pictures, export. | React, HTML, CSS | Not built (Phase 3; time and presets Phase 7) |
| Render service | Drives the hidden window, captures frames | Electron offscreen window | Not built (Phase 3) |
| Export service | Image and video export, report, translation sheet | FFmpeg child process | Not built (Phase 8) |
| Job runner | Queues, runs, resumes and retries background jobs | TypeScript | Built (`src/main/jobs/`) |
| Provider registry | Adapters behind six interfaces: image, layout, text, video, storage, verification | Provider SDKs, Node `http` | Built (`src/main/providers/registry.ts`, `types.ts`). Gemini images, ComfyUI pictures and video, S3, Dropbox and the fake provider have adapters. |
| Key store | Encrypts and holds secrets | Electron safeStorage | Built (`src/main/secrets/`) |
| MCP server | Tools for the external agent | MCP TypeScript SDK | Built in part (`src/main/mcp/`). See `spec/mcp-and-agents.md`. |
| MCP bridge mode | Lets agent apps that only launch command-line servers reach the running app | Same executable, `--mcp-bridge` flag | Not built (Phase 10) |
| Activity log | JSON lines log of commands, jobs and errors | TypeScript | Built (`src/main/log/activity-log.ts`) |

### App window at launch

Built (`src/main/windows/app-window.ts`) [D-031] [REQ: FR-220]. The stakeholder's words: "the app should default to open with the window maximized (not literally fullscreen)".

- Every time the app creates its window, it opens maximized: it fills the screen's work area and keeps its title bar. The macOS menu bar and Dock, and the Windows taskbar, stay visible.
- Never full screen. The app does not set the `fullscreen` option and never calls `setFullScreen`. The user can still enter full screen with the system's own control.
- The window is maximized on `ready-to-show`, before it is first shown, so the user never sees it small first.
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

`CoreDeps` is the one object of shared services that `core.ts` builds once and hands to every domain. It has fifteen fields, all required, so every domain always gets them: `projects` (`ProjectRegistry`), `settings` (`SettingsStore`), `secrets` (`SecretStore`), `undo` (`UndoLists`), `providers` (`ProviderInfo[]`), `log` (`ActivityLog`), `assets` (`AssetService`), `jobs` (`JobService`), `openExternal` (`(url: string) => Promise<void>`), `devTools` (`boolean`), `toPng` (`(bytes: Uint8Array) => Uint8Array`, JPEG or PNG in, PNG out, throws when it cannot), `fitPicture` (`(bytes: Uint8Array, size: { width: number; height: number }) => Uint8Array`, crops to the exact size, centred and filled, then scales; PNG out, behind the same limits as `toPng`), `appVersion` (`string`), `now` (`() => Date`), `userDataDir` (`string`).

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

The plain screens built so far (project page, campaign page, picture and video panels, Settings ComfyUI section) use the app's existing controls and tokens (`tokens.css`, `layout.module.css`, the Radix parts already used). No new visual language, no new package. The UI pass may replace any of them whole.

## Technology stack (was 2)

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
| File and object storage | Local disk. `@aws-sdk/client-s3`, `@aws-sdk/lib-storage`, `@smithy/node-http-handler` and `dropbox` for publishing. | AWS SDK 3.1174.0, smithy 4.14.2, dropbox 10.66.0 | [REQ: FR-160, R-15] |
| AI: image, layout, text | Google Gen AI SDK (`@google/genai`) | 3.6.1 | Stakeholder preference [REQ: IR-002] |
| AI: image and video on a local server | ComfyUI over HTTP, with Node's `http`, `https`, `dns`, `crypto` and Electron's `nativeImage` | — | No package. See `spec/comfyui.md`. |
| AI: video | fal client (`@fal-ai/client`), Seedance | Not installed | Stakeholder preference [REQ: IR-002, OI-04]. Added with the fal.ai adapter. |
| Agent protocol | `@modelcontextprotocol/sdk`, Streamable HTTP transport | 1.32.2 | Fixed (MCP) [REQ: IR-003] |
| Video encoding | FFmpeg, LGPL build | 7 or later, not yet added | Fixed (FFmpeg) [REQ: FR-143]; LGPL per licence intent [REQ: 9.3]. Build source open (OI-09). |
| YAML parsing | `yaml` | 2.9.1 | [REQ: FR-020]. ISC licence, no dependencies of its own, no install script, so no `allowScripts` entry. See `spec/brief-and-templates.md`. |
| Monitoring and logging | Local JSON lines log | — | [REQ: FR-153] |
| Infrastructure as code | None | — | No servers |
| CI/CD | GitHub Actions | — | Public repo [REQ: 9.2] |
| Build | `electron-vite`, `vite`, `@vitejs/plugin-react` | 6.0.0, 8.3.8, 6.3.0 | |
| Packaging | `electron-builder` (DMG for macOS arm64 and x64, NSIS for Windows x64) | 26.18.0 | [REQ: 8.8] |
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

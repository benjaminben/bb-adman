# Architecture decision records and glossary

The thirteen architecture decisions with their reasons, and the words the spec uses. Read with `spec/overview.md`.

## Architecture decision records

All accepted, 2026-11-20.

### ADR-001: The main process owns data and rules

Built.

- **Context:** User and agent edits must follow the same rules, appear live, be undoable and be logged [REQ: FR-200]. Keys must never reach the UI or the agent [REQ: FR-198].
- **Decision:** All data access and rules run in the main process behind a command bus. Windows send commands and draw.
- **Alternatives considered:** Logic in the window; a separate MCP service.
- **Consequences:** Every UI action is a round trip to the main process. Dragging needs transient local state. One place enforces policy, undo and logging.

### ADR-002: A project is one SQLite file that links to assets

Built (project file, linking, packaging in `src/main/assets/package.ts`).

- **Context:** The stakeholder wants a single document file and does not want large files duplicated [REQ: R-06].
- **Decision:** One SQLite file with a custom extension. Assets are linked by relative and absolute path. Generated files go to a folder beside it. Package project gathers everything for moving: the project file and the file behind every asset the project has a record of, linked or in the assets folder, with every path rewritten to point inside the package [D-011, D-022]. See `spec/data-rules.md`, "Package project".
- **Alternatives considered:** A project folder holding everything (the original FR-001); all assets stored inside the one file.
- **Consequences:** Links can break when files move, so the app needs missing-file detection, relinking and packaging. A project file from someone else can point at local files, which is handled by type checks and by listing files before publishing.

### ADR-003: Zustand holds a copy, SQLite holds the truth

Built (`src/renderer/stores/`).

- **Context:** The stakeholder chose zustand. The window and an agent can change the same project [REQ: FR-003, FR-200].
- **Decision:** SQLite holds the truth. The window holds a copy per open project, keyed by `projectId` (`project-store.ts`), updated from `project.changed` and `job.updated` events. Nothing is applied optimistically except transient drag state. Where campaign tabs, variant tabs and each tab's place (FR-213) are held, and whether they are remembered (Q-040), is designed in the UI pass (OI-31).
- **Alternatives considered:** Optimistic updates everywhere; state only in the window.
- **Consequences:** Simple and consistent. A small delay between an action and its effect, which is negligible locally.

### ADR-004: Posts are drawn with HTML by one Scene component

Not built (Phase 3).

- **Context:** Text must stay editable, support uploaded and CJK fonts, and report overflow. Preview must match export [REQ: FR-056, FR-098, FR-130].
- **Decision:** One pure React component draws a variant at a time. The editor, thumbnails, agent pictures and export all use it.
- **Alternatives considered:** Konva or another canvas library; SVG.
- **Consequences:** The editor's handles, snapping and guides are built by hand. Text rendering is the browser's, which differs slightly between macOS and Windows, so the expected images of visual tests are kept per system.

### ADR-005: Animation presets are pure functions of time

Not built (Phase 7).

- **Context:** Export must be identical on any machine [REQ: FR-131]. Animation is stored as data [REQ: FR-129]. GSAP's licence restricts visual no-code animation tools [REQ: R-14].
- **Decision:** `presets.ts` maps preset, progress and word index to opacity and offset. Preview feeds it clock time. Export feeds it frame time.
- **Alternatives considered:** GSAP timelines seeked per frame; CSS animations.
- **Consequences:** Only the five presets exist. Adding one means adding a function. No licence exposure.

### ADR-006: Video export overlays captured frames on an FFmpeg background

Not built (Phase 8).

- **Context:** Frame-exact seeking of a `<video>` element is unreliable, and text must be burned in exactly as previewed [REQ: FR-126, FR-131].
- **Decision:** The hidden window draws all non-background layers on a transparent page, one frame at a time. FFmpeg builds the background from the clips and overlays the frames.
- **Alternatives considered:** Capturing the whole Scene including video; drawing text with FFmpeg's own text filter.
- **Consequences:** Background placement is computed in one shared function used by both the Scene and the filter builder. Export speed depends on frame capture, eased by reusing unchanged frames.

### ADR-007: LGPL FFmpeg with system encoders

Not built (Phases 7 and 8).

- **Context:** The licence intent bars commercial reuse by others, which conflicts with GPL parts of FFmpeg [REQ: 9.3].
- **Decision:** Build with `--disable-gpl --disable-nonfree`. Encode H.264 with VideoToolbox on macOS and Media Foundation on Windows.
- **Alternatives considered:** A GPL build with x264 run as a separate program.
- **Consequences:** Files exported on the two systems differ in size and quality. Frames and timing are the same. A macOS LGPL build may have to be made in CI.

### ADR-008: Links are stored copies with revision counters

Not built (Phase 5).

- **Context:** Nothing may change in a linked variant until the user syncs, and overrides must be skipped [REQ: FR-081, FR-083].
- **Decision:** Each variant stores full layer values. Master layers count changes per property group. Linked layers record the count they last synced to. Out of date is computed. Overrides are property paths.
- **Alternatives considered:** Resolving inherited values on read; a stored out-of-date flag.
- **Consequences:** Sync is an explicit copy with a clear preview. Layer rows are larger. No flag can drift from the truth.

### ADR-009: One agent policy table over the same commands

Built (`src/main/commands/agent-policy.ts`).

- **Context:** The agent has a limited action set now, and more may be allowed later [REQ: FR-197, FR-199].
- **Decision:** MCP tools call the same commands as the UI. One table marks each command allow, ask or deny for agents.
- **Alternatives considered:** Separate agent-only code paths.
- **Consequences:** Allowing generation, export or publish later is a table edit plus a tool definition. Agent edits get undo, logging and live display for free.

### ADR-010: MCP over HTTP on 127.0.0.1 with a token, plus a bridge mode

Built: the server (`src/main/mcp/server.ts`) and bridge mode (P10-9, `src/main/bridge/`; `spec/mcp-and-agents.md`, "Bridge mode").

- **Context:** The server must accept only same-computer connections [REQ: FR-191]. Any local program or web page could otherwise reach it. The first agent app is Claude.
- **Decision:** Streamable HTTP bound to 127.0.0.1, bearer token, `Origin` and `Host` checks. The app executable has a `--mcp-bridge` mode for clients that only launch command-line servers.
- **Alternatives considered:** Stdio only (cannot reach a running app's open projects without a bridge anyway); no token.
- **Consequences:** The user pastes a token once. Bridge mode needs care with the single-instance lock.

### ADR-011: Saved keys cannot be viewed

Built.

- **Context:** FR-173 asked for viewing behind the computer's password or biometric check. Electron has no built-in cross-platform prompt for that [REQ: R-10].
- **Decision:** Provider and storage keys are write-only in the UI. The last four characters are shown. The MCP access token is an explicit exception [D-014]: it only guards a server on the same computer, the user has to paste it into their agent app, and the app can make a new one at any time. The user can see and copy it in full in the Connect panel. It reaches the window through one query, `mcp.getConnectInfo`, which only the user actor can call.
- **Alternatives considered:** Native code per system for the password or biometric prompt. Treating the token like a key and showing it once only, which would force a new token each time the user sets up another agent app.
- **Consequences:** Stricter than the original requirement for keys and no native code. A user who loses a key gets it again from the provider. One secret value can reach the window, so the rule "no MCP reply, log line or project file contains a secret" is kept by a named test that includes the token (`spec/testing.md`).

### ADR-012: Publish does a fresh export

Built (P9-7 to P9-13). As built, the export runs inside the publish job into its work folder; it is all or nothing about its ads and inserts no `report` row (`spec/storage-and-publish.md`, "Publishing").

- **Context:** Publishing must upload final exports, components, the sheet and the report as one consistent set [REQ: FR-162].
- **Decision:** `publish.run` exports the whole campaign to a temporary folder, then uploads, writes a manifest and removes stale files under the campaign's folder only.
- **Alternatives considered:** Uploading whatever the last export left on disk.
- **Consequences:** Publishing takes as long as an export plus the upload. The published set always matches the project at that moment.

### ADR-013: Format change is its own command with one table of allowed changes

Built (P7-10; the tool P10-13).

- **Context:** A variant's format can be changed in both directions: image to video [REQ: R-20, D-012] and video back to image [D-020]. Video settings must survive a change to image and back [D-026]. An agent may make the change [D-025]. The change has side effects that a title or duration edit does not: it must respect the `variant_grid` unique index and may create a background clip.
- **Decision:** A command of its own, `variant.setFormat`, on the variant's undo list, allowed for agents. One table in `src/shared/config/format-changes.ts` says which changes are allowed, and both are. The change writes `format` and nothing else, except the first clip of a variant that has none. Clips, duration, timing and animation stay stored while a variant is an image, so neither direction loses anything.
- **Alternatives considered:** Adding `format` to `variant.update`, which would hide the grid test and the clip step inside a title-and-duration edit. Deleting the variant and adding a new one in the other format, which loses the variant's ID, overrides, translations and video settings. Deleting clips when a variant becomes an image, which D-026 rules out.
- **Consequences:** One more command, one more MCP tool (`set_variant_format`) and one more single-owner file. An image variant can hold clip rows it does not draw. The unique index does not change. The empty-track round trip (OI-20) is covered by the column `variant.first_clip_made` (A-180, migration 0005).

## Glossary

Terms from REQUIREMENTS.md Section 12 keep their meaning. Added or changed here:

| Term | Definition |
|------|------------|
| Project file | The single SQLite file, with a custom extension (`.adman`), that is a project |
| Assets folder | The folder beside the project file where generated and copied files are saved |
| Linked file | An imported file that stays where it is and is referred to by path |
| Managed file | A file the app saved into the assets folder |
| Reference library | Files used only as input to image generation |
| Asset library | Files that can go on a post |
| Hero image | An asset-library image attached to a subject |
| Package project | The command that copies everything related to a project into one folder: the project file and the file behind every asset the project has a record of, linked or in the assets folder. Paths in the copy point inside the folder. |
| Access token | The secret an agent app must present to the MCP server. The user can view it in the Connect panel. It is not a provider or storage key. |
| Format change | Changing an existing variant from image to video, or from video to image, with `variant.setFormat` |
| Format round trip | Changing a video variant to image and back to video. Every video setting is kept (`spec/data-rules.md`, "Changing a variant's format"). |
| Command | A validated request to change data, sent by the window or the MCP server |
| Actor | Who sent a command: user or agent |
| Agent policy | The table marking each command allow, ask or deny for agents |
| Scene | The component that draws one variant at one time |
| Property group | A set of layer properties that link and sync together: copy, style, geometry, source, timing, animation |
| Follow rule | Whether a linked layer takes a property group from its master |
| Layer key | The ID a layer shares with its matching layer in the master |
| Bridge mode | Running the app executable with `--mcp-bridge` to relay MCP between stdio and the running app |
| Fake provider | A built-in provider for tests and development that needs no key |

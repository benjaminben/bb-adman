# Screens as built

What each built screen offers today, its source files, its wording, and the choices made without a design sign-off. The campaign screens and dialogs (ComfyUI failures, the address and licence dialogs, the trial mark, confirmed licences, import, drop, relink, package, the project home's parts, the Assets panel, the brief form, the campaign page and its tabs) are in `spec/screens-campaign.md`. Read with `spec/test-harnesses.md` (which of these functions the end-to-end harness reaches), `spec/structure.md` (renderer layout) and `spec/api-commands.md` / `spec/api-queries-events.md` (the calls each screen sends).

## Status of these screens

Built (Phases 1 and 2, then restyled by the design wave, `spec/phases/design-wave.md`). Every screen is built from the shared parts in `src/renderer/ui/` (`spec/app-style-parts.md`) and styled only from `ui/tokens.css`, `ui/base.css`, `ui/layout.module.css` and each component's own CSS module (`spec/structure.md`, "One styling source"). The look is in `spec/app-style.md`.

| Screen | Where it is described |
|--------|------|
| Shell: top bar, project menu, Activity panel, result notice, agent line, close question | This file, "Shell" |
| Start | This file, "Start" |
| Project home and the New campaign page | This file, "Project home"; parts in `spec/screens-campaign.md` |
| Campaign page (head, the "Campaign" tab strip, Variants, Checks, Translations) | `spec/screens-campaign.md` and `spec/screens-variants.md` |
| Editor (a variant tab), with the Generate panel | `spec/editor.md` and `spec/screens-ai.md` |
| Settings and the first-run setup | This file, "Settings" |
| Key, address and licence dialogs | This file and `spec/screens-campaign.md` |

## Rules for every screen

Built. The reviewer checks these on every screen.

- Every command goes through the app store's `command` (`src/renderer/stores/app-store.ts`), so `NEEDS_KEY` opens the key dialog and an error shows in the error banner. Queries go through `useApi().query`. A screen imports nothing from `src/main/`.
- **A paid call starts only after the user's own click, with the cost on screen at that click** (design-wave choice C-15, `spec/phases/design-wave.md`). For a provider whose `local` is false:
  - **In a dialog the user opened to make something** (the run dialog, fan-out, copy options), the dialog's own action button is the paying click. The cost line is a MoneyLine (`spec/app-style-parts.md`), the last element of the body, directly above the buttons, and its element is in the dialog's accessible description (`aria-describedby`). The button names the action ("Generate", "Cut out", "Place text", "Suggest copy", "Read brief", "Retry", "Make {n} variants"). Nothing is sent before that click, and there is no second confirm step after it.
  - **From a control in a place not opened to pay** (the Activity row's Retry for a video, the sync review's Translate), the first click shows one line in place: a MoneyLine with the cost, then "Confirm" and "Cancel" (`ui/paid-confirm/`). Only Confirm sends.
  - The cost line names the provider the held request goes to. Nothing is started on open, on a timer, or again after a failure. A local provider needs no cost line and no second step: its line says "Nothing is charged". A run whose provider is not known is treated as paid.
- **One run per click.** From the moment `generation.runImages`, `generation.startVideo` or `job.retry` is sent until its reply arrives, the button that sent it is disabled, for every provider. Any reply, a refusal included, enables it again. Tests: `tests/unit/renderer/editor/one-run-per-click.test.tsx`, `earlier-retry-click.test.tsx`.
- A provider that is not `available` is not offered for a run.
- The ComfyUI address is drawn only in the Settings ComfyUI section, inside a failure sentence, and in the run dialog's ComfyUI line (`spec/screens-ai.md`). It is sent in no input but `comfy.setAddress`. The window writes nothing to the console.
- Text from a server or a file (server message, brief values, a file name, a display name) is drawn as text content, never as HTML, never as a link.
- For pictures and other assets, the renderer draws no file path and reads no file. It sends a path only to `asset.import` (a path from the system picker, or from a file dropped on the window through the drop bridge), `asset.relink` (from the relink picker), `project.package` and `export.run` (each from the folder picker); and a brief's path only to `brief.parse` or, for a Markdown or text brief, `brief.extract` (from the brief picker). Display names and a file's base name are drawn as text. The project's own file path and the recent-project paths are in a tooltip and an accessible name or description only, never printed; the default projects folder is printed on the Settings Files page, cut in the middle. They are sent only to `project.open`, `project.create` and `settings.update`. The other places a path is drawn are the permission dialog for an agent's file import (`spec/security.md`, "Paths in the renderer") and the publish dialog's file list (A-218, `spec/phases/phase-09.md`, "Screens").
- No screen has a field for a key. Keys go through the key dialog or the Settings key rows only.
- Every control has a label and can be reached and used by keyboard (`spec/testing.md`, accessibility rules). An icon button's name is its `aria-label` and its `title`. Each screen file stays under 200 lines.
- Counts in visible words use real plurals through `src/renderer/ui/plural.ts` (`plural(n, one, many = one + 's')` gives "1 file", "2 files"). No visible text uses "(s)".
- `assetUrl` (`src/renderer/ui/asset-url.ts`) builds every `adman-asset://` address and escapes both parts with `encodeURIComponent`.

## Shell

Built. `src/renderer/app/app-shell/`, `project-switcher/`, `campaign-tabs/`, `activity-button/`, `activity-panel/`, `activity-row/`, `result-notice/`, `agent-activity/`, `error-banner/`, `first-run/`, `app-context.tsx`, `nav-context.tsx`; `stores/app-store.ts`, `stores/project-store.ts`, `stores/nav-store.ts`.

- **Top bar** (a `banner`), shown over a project and over Settings: the project switcher, the shown project's campaign tabs (`spec/editor.md`, "The shell"), then two icon buttons, "Activity" and "Settings". The start screen has no top bar.
  - "Activity" opens the Activity panel. While tasks run it shows their number in the accent colour, with the hidden words "{n} running".
  - "Settings" toggles (`aria-pressed` while Settings shows). See "Settings" below for the ways out.
- **Project switcher** (`app/project-switcher/`): a menu button showing the shown project's name ("AdManager" when none). With two or more projects open, a chip with the number follows; the button is then named "{name} {n} projects open". The menu: one `menuitem` per open project (named by the project through `aria-label`; choosing it shows that project), each with a `menuitem` "Close {name}" at its end; a separator; "Package…" (only with a project shown; opens the package dialog, `usePackageProject(projectId)` in `screens/project-home/package-project/`), "Open…" (project file picker, then `project.open`) and "Start screen". Arrow keys move through every item and wrap; Escape or a click elsewhere closes it.
- **Close question** (SH-5): closing a campaign tab, a variant tab or a project while tasks run asks first, in a `DialogFrame kind="confirm"`. Buttons "Keep open" (focused) and "Stop and close". The tab questions name the tab in the title only. "A request already sent may still be charged." and, for a project, the lost-work and left-running lines are the frame's `warning` (visible, and the accessible description). With nothing running, closing asks nothing. Close questions inside dialogs (copy options, brief reading) add "{Task} is still running. Closing this dialog stops it." after the warning.
- **Activity panel** (SH-4; `app/activity-panel/`, `app/activity-row/`): a panel along the right edge, compact density. A PanelHead "Activity" with the icon button "Close activity". "Running" and "Finished" are Sections (`activity.running`, `activity.finished`; they do not fold; the count is the summary), each holding a list named "Running" / "Finished"; an empty one is not drawn. Empty panel: "No runs yet", or "No project open". Each row is an ObjectRow:
  - its thumb is the job kind's icon; its name is "{what} · {provider}" ("Pictures (4) · Google Gemini", "Video · fal.ai Seedance"; `row-text.ts`);
  - its meta line is a robot icon (hidden words "Started by an agent") for an agent's job, then "{HH:MM} · {where}", the time first so a long place never hides it; `{where}` is "{campaign} › {variant} › {layer}" with a deleted part as "(deleted)", or "Project";
  - one StatusMark: "Waiting", "Working", "Done", "Failed" or "Cancelled"; an unseen result adds a dot titled "New result";
  - one icon action: "Cancel" (shown exactly when `job.cancel` would accept the run, `ui/cancel-shown.ts`, `spec/cancel.md`) or "Retry" (background jobs only, `row-retry.tsx`). A video Retry on a paid provider draws the two-step paid line under the row;
  - the row's main button is "Go to {where}" (to the place `ui/show-result.ts` finds); a row with no place offers no button;
  - a failed row keeps its failure sentence visible under it (`ui/run-failure/`, `spec/screens-campaign.md`).
- **Result notice** (`app/result-notice/`): one info line under the error banner when a run finishes out of view: "{kind words}: {where}.", a "Show" button (goes there and closes the line) and an icon button "Dismiss". Its live region is always drawn.
- **Error banner** (`role="alert"`): the last refused command's message with "Dismiss".
- **Agent line** (`app/agent-activity/`, `role="status"`): the robot icon, the tool, then " · {project name}" when the project is open. A visually hidden "Agent working: " comes before the tool. Hidden 10 seconds after the last `agent.activity` event.
- The key dialog, the address dialog, the licence dialog, the permission dialog and the first-run setup are mounted once here.
- The window opens maximized, never full screen [D-031].

## Start

Built. `src/renderer/screens/start/start-screen/`, `start-images/`, `new-project-form/`, `recent-projects/`. The look is in `spec/app-style.md`, "Start screen".

- Two halves. Left: a full-height picture, 50% wide, that crossfades to another every 10 seconds in random order (one still picture with reduced motion). Right: a region named "AdManager" holding the app mark and the heading, the two buttons, then "Recent". The Activity and Settings icon buttons sit in the right half's corner (no top bar, no project switcher here).
- "New project" swaps the two buttons for one row: a field named "Project name", a folder icon button named "Location: {folder}. Change" (folder picker; the folder shows in no printed text) and "Create" (`project.create`) [REQ: FR-002, FR-004]. Escape brings the two buttons back.
- "Open…": the project file picker, then `project.open`.
- "Recent": one button per project with a file icon and its name; the path is in its tooltip and its name ("Open {name}, {path}"). Projects open now come first, each with an accent dot and the tooltip "Open now" (named "Show {name}, open now"). With none, the list is not drawn.

## Project home

Built. `src/renderer/screens/project-home/project-home/` (`project-home.tsx`, `home-sections.tsx`, `use-project.ts`), `brief-load/`, `brief-paste/`, `brief-form/`, `campaign-list/`, `import-files/`, `missing-files/`, `drop-import/`, `campaign-input.ts`. The parts are in `spec/screens-campaign.md`.

- The `h1` is the project name. The file path is its `title` and accessible description only. "Loading the project…" while loading. Event `project.changed` for this project reads `project.get` again; one for another project does not. Close and Package are in the project menu (Shell), not on the page.
- **Campaigns:** a Section (`home.campaigns`, does not fold) whose header holds the count, "Load a brief" and "Paste a brief". Each campaign is one tile button named "Open {name}" with its cover and the variant count as an icon and number (`title` "{n} variants"). A dashed "+" tile named "New campaign" opens the New campaign page. Empty: "No campaigns yet".
- **Assets row:** the `h2` "Assets", an InfoTip "About Assets", the missing mark "{n} missing" (only when files are missing; named "{n} missing: Find missing files…"; opens the relink dialog), "Import" (named "Import files…"), a folder icon button "Import a folder…", and "Open assets" (opens the Assets panel).
- **New campaign page** (HOME-2): "Load a brief", "Paste a brief" and the "+" tile open the brief form as its own page in place of the sections: a `SubPage` titled "New campaign" (`h2`) with Back. The form is the region "New campaign". "Cancel" closes it at once (removing the photos the form added, then focusing "Load a brief"). Back and Escape do the same, but with typed work they first ask "Leave this brief?" (warning "What you typed will be lost.") with "Keep editing" (focused) and "Leave". The fields, the subjects and photos, "To fix" and the foot are in `spec/screens-campaign.md`, "The brief form".
- An open campaign shows on its campaign tab, full width, in the page's place (`CampaignView projectId campaignId onBack`). The drop target and the Assets panel stay mounted in one `AssetsScope` while a campaign or variant shows.

## Campaign page

Built. `src/renderer/screens/campaign/` (`campaign-view/`, `campaign-head/`, `campaign-overview/`, `variants-tab/`, `direction-grids/`, `direction-header/`, `variant-grid/`, `variant-tile/`, `check-panel/`, `rule-set-panel/`, `translation-panel/`, `campaign-export/`, `report-list/`, `publish-button/`, `approval-bar/`, `approval-mark/`, `campaign-undo/`, `variant-tabs/`, `provider-select/`).

- "Loading the campaign…" while `campaign.get` is read. Then the campaign head and one tab strip named "Campaign": Variants, Checks, Translations, a divider, then the open variants. The head, the Checks and Translations tabs and the dialogs are in `spec/screens-campaign.md`; the Variants tab is in `spec/screens-variants.md`; a variant's tab holds the editor (`spec/editor.md`).
- Pictures and videos are made in the editor's Generate panel (`spec/screens-ai.md`). A run is followed in the Activity panel or the panel's "Earlier options".
- Known gaps, noted and not built: a refused `campaign.get` leaves the page on "Loading the campaign…" with no message ("Back to project" still works).

## Settings

Built (SET-1 to SET-6). `src/renderer/screens/settings/settings-screen/` (with `settings-pages.ts`) and one component folder per part.

**Frame.** An `h1` "Settings" over a side list (`nav` "Settings pages": AI services, Files, Publish, Agents), with a quiet "Setup" button at its foot (named "Open the setup…"; opens the first-run setup at its welcome step). Beside it one page with its `h2` title. The page chosen last is remembered for the window's life (`rememberPage`); nothing is saved. `SettingsScreen` takes `page?` and `onClose?`.

**Ways out** (SH-2): the top bar's "Settings" button (pressed), Escape (`ui/escape-leave/`), the icon button "Close settings", and over a project a click on a campaign tab or "+". Leaving returns to the view the user came from (`leaveSettings()` in the app store), or the start screen if that project closed. Escape does not leave while a dialog, menu or popover is open, or while focus is in a key's password field holding typed text. Over a project the top bar and campaign tabs stay drawn.

**Save rule** (SET-6): "Port", the Dropbox "Folder", "JPG quality" and "Report name" save on Enter or on leaving the field, then show a "Saved" mark for 2 seconds (`screens/settings/saved-mark/`). The ComfyUI "Server address" and the approvals "Service address" keep their own "Save". Choices (switches, segment groups, selects) save at once. A refusal shows as a line under its control.

### AI services

- **Keys** (`keys-section/`, `key-row/`; a Section, summary "{saved} of {available}", InfoTip "About keys": "Keys are stored encrypted on this computer. After saving, only the last four characters are shown."). One row per secret of each AI provider (storage keys are on the Publish page), a group named "{provider} {secret label}". A saved key shows the mark "•••{last four}" (tip "Key saved, ends in {last four}. Replace"; a click opens the field) and a trash icon "Delete key" (`secret.delete`). An unset key shows "Not set" and "Add key". The field is a password field with "Save" (`secret.set`, the field cleared before the call) and "Cancel". A provider not yet available is a faded row marked "Soon" [REQ: FR-170].
- **ComfyUI server** (`comfy-section/`, `comfy-check-result/`): the state is a mark in the Section head ("Not set", "Checking", "Connected", "Failed"). "Server address" starts filled with the saved address, with "Save", "Remove" (when one is saved) and "Check" (disabled with no address; `comfy.check`). Save sends `comfy.setAddress` and contacts nothing; a refused address shows the command's own sentence under the field. Under the field the privacy paragraph, word for word: "When ComfyUI makes a picture or a video, your brief text, prompts and reference pictures are sent to the server at this address. Whoever runs that server can see them." [REQ: REQUIREMENTS-ComfyUI.md 3.3] (`ui/comfy-privacy.ts`, its one owner; also shown in the address dialog, A-42, and nowhere else). A check result lists the workflows with their status, licence note and missing items (sentences from `src/shared/providers/messages.ts`; the Settings form of `redirect_refused`: "The server tried to send Adman to another address. Adman did not follow."). "Licences" (the confirmed licences, `spec/screens-campaign.md`) and "On the server" are folded Sections.
- **Defaults** (`provider-defaults/`): one choice per job ("Image generation", "Layout", "Text", with an InfoTip "Briefs, copy and translation.", "Video generation"). Two to four providers: a group of buttons named as the job, the chosen one `aria-pressed="true"`; five or more: a select. An unavailable provider is shown disabled. A change saves with `settings.update` [REQ: FR-067].

`KeysSection` and `ComfySection` take `fold?: 'open' | 'none'`; their headings are level 3.

### Files

- **Projects folder** (`location-setting/`): one row with the path cut in the middle (`ui/middle-cut.ts`), the full path in the row's `title` and accessible name "Projects folder {path}", and the button "Change default location" (folder picker, then `settings.update`) [REQ: FR-004].
- **Export** (`export-section/`): groups of buttons "Picture format" (PNG, JPG) and "Frame rate" ("30 fps", "60 fps"); fields "JPG quality" (visible "Quality") and "Report name".

### Publish

- **Cloud storage** (`s3-section/`, `dropbox-section/`, shared row parts in `s3-check/`): two rows, Amazon S3 and Dropbox. A row's form shows only while the row is open (`aria-expanded`); a row starts open when the service is not set up. S3: "Bucket", "Region", "Folder" (named "Folder in the bucket") and "Test" (named "Test connection"). Dropbox: "Sign in to Dropbox" / "Sign out" and "Folder" (named "Folder in the app folder"). `S3Section` takes `fold?: 'open' | 'none'`.
- **Approvals service** (`approvals-section/`): one row with "Service address" and its own "Save" (`spec/approvals.md`, "Screens").

### Agents

- **Agent access** (`mcp-section/`, `connect-panel/`, `auto-approve-setting/`): a Section whose header holds the switch "Turn on agent access" (`mcp.setEnabled`). Inside: "Port" (saved by the save rule; no min or max on the field, so the command's own range sentence shows), the problem lines from `mcp.getConnectInfo` ("Port {port} is in use. Choose another."; "There is no access token. Make a new token."; "The MCP server could not start. Turn it off and on to try again."), "New token" (named "Make a new token"; `mcp.regenerateToken`), and the switch "Delete without asking" with an InfoTip and the visible line "Deletes cannot be undone." (`settings.update { mcp: { autoApproveDestructive } }`, P10-7). A refused command's message shows as a line; a line equal to the state line is drawn once; any successful agent-access command clears both refusal lines. After every command the section reads `mcp.getConnectInfo` again. A refused `mcp.getConnectInfo` shows the query's own fixed message, with no switch.
- **Connect to Claude**, a folded Section shown when the server is on and a token exists: "Address", "Access token" (masked until "Show") and "Claude Code" (the command line in a code block) as text, never in an attribute, each with a copy button using `navigator.clipboard.writeText` on click only. A second block, "Claude Desktop", shows `ConnectInfo.claudeDesktop` (the bridge's config JSON, no token) with its own copy button (P10-9; `spec/mcp-and-agents.md`, "Bridge mode"). On failure "Copy did not work. Select the text and copy it." The token is kept in this section's own state only: never in a store, a log line or an attribute.
- **Agent runs** (`agent-runs-section/`): a Section, summary "{n} on", shown whether the MCP server is on or off. While any offered provider is paid, the line "Paid. Each run an agent starts is charged to your account, with no click from you." at the top. One row per provider for which `agentRunsOffered` gives null, with a switch (`agentRuns.setAllowed`), a paid one marked "Paid". The field "Run limit" (with an InfoTip "About run limit"), 1 to 16, saved by `agentRuns.setLimit` on each change; an empty field sends nothing. Whether the per-provider switch stays is open (OI-90; build default: yes, off). Rules: `spec/agent-runs.md`.

### The first-run setup

`app/first-run/` (R2E-10, SET-7), mounted once in the shell. A `DialogFrame kind="form" size="wide"` titled "Set up AdManager" that opens by itself once per window when the window shows the start screen, `settings.setup.done` is false and no secret of any kind is saved. A step strip (`ol` named "Steps": Keys, ComfyUI, Storage; the current one has `aria-current="step"`). The welcome has a visually hidden `h2` "Welcome" and the welcome words as the description. Each step's heading is "Step n of 3: AI keys" / "ComfyUI server" / "Cloud storage", the "Step n of 3:" part visually hidden, with an InfoTip "About this step" holding the step's line. On the ComfyUI and Storage steps the mounted part draws the same words, so the whole step heading is visually hidden and the InfoTip sits at the end of the strip row (Z-1b). The steps mount `KeysSection`, `ComfySection` and `S3Section` with `fold="none"`. Foot: "Back" (after the welcome), "Skip for now", and "Start" / "Next" / "Finish". "Next" never needs anything filled in. Any ending (Finish, "Skip for now", Escape, the close button) sends `settings.update { setup: { done: true } }` once. A key is typed only into the key row, as in Settings; the flow adds no command, event or log line. Design: `spec/phases/round-2-editor.md`, D8.

## Key dialog

Built. `src/renderer/dialogs/key-dialog/`. Opens when a command returns `NEEDS_KEY` [REQ: FR-171]. A `form` DialogFrame titled "{provider label} key" (for example "Google Gemini key"), one password field per missing secret (uncontrolled: a typed key is never a `value` attribute), an InfoTip "About keys", "Cancel" and "Save" (saves each with `secret.set`, then the action is retried). Keys are not tested when entered [REQ: FR-172].

## Agent ask dialog

Built (P10-7, P10-7b, P10-8, SUBJ-1). `src/renderer/app/permission-dialog/`.

- **Ask dialog for a file import** (R2P-6), when the event's `kind` is `'import'`: title "An agent asks to import files" ("An agent asks to make a campaign with files" for a brief); the body names the agent, the project and the file count; then every full path, read with the user-only query `agent.askFiles`, as plain text in a monospace list that wraps and scrolls ("Loading the list of files…" meanwhile; "The list of files could not be shown." on failure, and then only "Refuse" works); the line "Once imported, agents can place these files in ads and send pictures to AI providers you allowed."; "Answer within 2 minutes."; "Refuse" (focused first) and "Import" ("Allow" for a brief), which works only once the list is shown and 750 ms have passed. No "Don't ask again" box. The rules: `spec/security.md`, "Paths in the renderer".
- **Ask dialog for a delete**, on `agent.permissionRequested`: title "An agent asks to delete"; body "{agent} wants to {action}: {target}.", where `{agent}` is "Agent named {client name}" or "An agent" (the name is the agent's own text, drawn as text only); a cost line ("This cannot be undone." for a campaign; for a variant also "It also clears the undo list of this campaign."; a subject has its own line, D-101); "Answer within 2 minutes."; checkbox "Don't ask again for deletes"; buttons "Refuse" (focused first) and "Allow" (pressable 750 ms after opening). A refusal shows as a DialogAlert. Escape refuses. At `expiresAt` it closes with no answer.

## Address and licence dialogs

Built. `src/renderer/dialogs/address-dialog/`, `licence-dialog/`, mounted in the shell beside the key dialog; `src/renderer/stores/run-asks.ts`. A run refused for a missing ComfyUI address or an unconfirmed commercial licence opens one, then the run is sent again (`spec/screens-campaign.md`). Refusal `comfy_job_not_offered` shows its message in the error banner.

## Editor, tabs and thumbnails

Built (Phase 3, restyled by the design wave). Described in `spec/editor.md`: the project switcher and campaign tabs; the editor (canvas, layer list, properties panel, picture chooser, font upload) is the content of a variant tab; the campaign grid and project home show thumbnails. Every rule in "Rules for every screen" holds for them.

**Phase 3 tokens** in `src/renderer/ui/tokens.css`, used by no other file's literal: `--editor-layers-width` (260px), `--editor-props-width` (312px), `--canvas-backdrop` (a mid grey that is neither ad black nor page white), `--selection-dark` and `--selection-light` (the selection line and its two sides), `--guide-color` (a magenta that shows on most pictures), `--handle-size` (8px), `--rotate-handle-offset` (24px), `--thumbnail-tile` (the grid tile's picture width), `--layer-thumb` (32px). Overflow and missing marks use the existing danger tokens.

## Choices made without a design sign-off

Each was made to get a working, testable screen. A later UI pass may change any of them. The design wave's own choices (C-1 to C-15) are in `spec/phases/design-wave.md`.

Phase 3 (editor and tabs, `spec/editor.md`):

- Layers on the left, canvas in the centre, properties on the right, a one-line header and one banner line above.
- Selection drawn as a dark line with a light line each side, square resize handles and a round rotation handle above the box.
- Guides in magenta, 1 screen pixel; snapping within 6 screen pixels.
- An empty picture layer shown in the editor as a dashed box saying "Empty picture"; overflowing text as a dashed box in the danger colour.
- The canvas backdrop is a mid grey; the ad itself is black where nothing is drawn.
- Zoom steps 25 to 400 %, default "Fit", with "Zoom out" and "Zoom in" at the foot of the canvas.
- Text is typed in the properties panel, not on the canvas; double-clicking a text layer does nothing beyond selecting it, and "Add text layer" puts the focus in the Copy field.
- Fields save on Enter or on leaving the field, never on each keystroke.
- The weight list uses the nine standard names (Thin 100 to Black 900).
- Colour is a row of swatches (the campaign palette) with "Other colour" for a typed hex value.
- The picture chooser is a dialog with a grid of the asset library's pictures and "Import pictures…".
- Duplicate places the copy 20 px right and down, on top of every layer.
- The project switcher is a menu button at the left of the top bar; "Project" is a fixed first campaign tab; "+" opens the New campaign page.
- The thumbnail of a campaign on the project home is the master of its first direction; a failed thumbnail says "No preview".
- The app menu has no View menu.

Phases 1 and 2:

- Settings is shown in place of the tab content, not as a tab or a window.
- A running video run counts whole minutes from `createdAt`, refreshed every 15 seconds (`ui/run-status/video-status.ts`), and shows no percentage even when the job has one; a running picture run shows its percent.
- The reference pictures for a picture run and the picture a video starts from are separate choices of the same pictures.
- The local-provider reference sentence (OI-77) and the "<Picture 1>" hint (OI-89) are provisional wording.
- The Claude Code line uses the `--font-mono` token (a system monospace font list).
- No crop preview for a first-frame picture.

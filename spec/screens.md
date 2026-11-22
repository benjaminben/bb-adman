# Screens as built

What each built screen offers today, its source files, its wording, and the choices made without a design sign-off. The Phase 2 campaign screens and dialogs (ComfyUI failures, the address and licence dialogs, the trial mark, confirmed licences, import, drop, relink, package, the brief form, the slot view, the campaign grid) are in `spec/screens-campaign.md`. Read with `spec/test-harnesses.md` (which of these functions the end-to-end harness reaches), `spec/structure.md` (renderer layout) and `spec/api-commands.md` / `spec/api-queries-events.md` (the calls each screen sends).

## Status of these screens

Built (Phases 1 and 2). They are plain working screens, made so every function can be used and tested before the real interface exists. They are built with the app's existing controls and tokens (`ui/tokens.css`, `ui/base.css`, `ui/layout.module.css`, each component's own CSS module, the Radix parts already used: Tabs, Dialog). All styling comes from `tokens.css` (`spec/structure.md`, "One styling source"). No new visual language and no new package. The UI pass may replace any of them whole. A design prototype exists in `design/prototype/`; the built screens do not follow it.

| Screen | Fate |
|--------|------|
| Shell with project tabs | Replaced in Phase 3 by the project switcher and campaign tabs [REQ: FR-211] (`spec/editor.md`, "Navigation"; OI-31 assumption). The start screen stays. |
| Start | Stays in substance; restyled by the UI pass |
| Project home | Placeholder for the campaign list and brief intake of the UI pass |
| Campaign page, Make pictures, Make a video, run list | Replaced: by the Phase 3 editor, the Phase 4 picture section, run confirmation dialog and activity panel (`spec/screens-ai.md`), the Phase 5 grids (`spec/screens-variants.md`) and the Phase 7 video card |
| Settings | Stays as the Settings screen, with the sections added since (agent runs, export and reports name in Phase 8, cloud storage in Phase 9, agent access in Phase 10) |
| Key dialog | Stays (the `NEEDS_KEY` flow, FR-171) |
| Hand test (dev) | Removed in P9-14, with `dev.storage`, the `{userData}/hand-test-local` handling and the `src/shared/config/dev-tools.ts` constants |

## Rules for every screen

Built. The reviewer checks these on every screen.

- Every command goes through the app store's `command` (`src/renderer/stores/app-store.ts`), so `NEEDS_KEY` opens the key dialog and an error shows in the error banner. Queries go through `useApi().query`. A screen imports nothing from `src/main/`.
- **A paid run starts only on the user's own confirm.** For a provider whose `local` is false, Generate, Start and Retry show one line in the panel with Confirm and Cancel (`paid-confirm.tsx`). The line names the provider the held request goes to. Nothing is sent before Confirm. Nothing is started on open, on a timer, or again after a failure. A local provider needs no confirm. A run row whose provider is not known is treated as paid: Retry asks first.
- **One run per click.** From the moment `generation.runImages`, `generation.startVideo` or `job.retry` is sent until its reply arrives, the button that sent it is disabled, for every provider. Any reply, a refusal included, enables it again. Tests: `generate-panel-click.test.tsx`, `run-row-click.test.tsx`.
- A provider that is not `available` is not offered for a run.
- The ComfyUI address is drawn only in the Settings ComfyUI section, inside a failure sentence, and in the run confirmation dialog's ComfyUI line (`spec/screens-ai.md`). It is sent in no input but `comfy.setAddress`. The window writes nothing to the console.
- Text from a server or a file (server message, brief values, a file name, a display name) is drawn as text content, never as HTML, never as a link.
- For pictures and other assets, the renderer draws no file path and reads no file. It sends a path only to `asset.import` (a path from the system picker, or from a file dropped on the window through the drop bridge), `asset.relink` (from the relink picker) `project.package` and `export.run` (each from the folder picker); and a brief's path only to `brief.parse` or, for a Markdown or text brief, `brief.extract` (Phase 4) (from the brief picker). Display names and a file's base name are drawn as text. (The project's own file path, the recent-project paths and the default location are shown on the start, project and Settings screens, and sent only to `project.open`, `project.create` and `settings.update`.)
- No screen has a field for a key. Keys go through the key dialog or the Settings key rows only.
- Every control has a label and can be reached and used by keyboard (`spec/testing.md`, accessibility rules). Each screen file stays under 200 lines.
- `assetUrl` (`src/renderer/ui/asset-url.ts`) builds every `adman-asset://` address and escapes both parts with `encodeURIComponent`.

## Shell

Built. `src/renderer/app/app-shell/`, `app/error-banner/`, `app/app-context.tsx`, `app/app.tsx`, `stores/app-store.ts`, `stores/project-store.ts`.

- A tab bar (Radix Tabs, label "Open projects"): "Start", then one tab per open project named after it [REQ: FR-003].
- "Settings" button (pressed state while Settings shows).
- The error banner (`role="alert"`) shows the last refused command's message with "Dismiss".
- The key dialog, the address dialog and the licence dialog are mounted once here.
- The window opens maximized, never full screen [D-031].

## Start

Built. `src/renderer/screens/start/start-screen/`, `new-project-form/`, `recent-projects/`.

- Heading "Adman".
- "New project": "Project name" field, "Location" (the default from Settings, shown as text), "Change location" (folder picker), "Create project" (`project.create`) [REQ: FR-002, FR-004].
- "Open": "Open project…" (project file picker, then `project.open`), "Recent projects" with an Open button each (`aria-label` "Open {name}, {path}"), or "No recent projects yet."

## Project home

Built. `src/renderer/screens/project-home/project-home/` (with `use-project.ts`), `brief-load/`, `brief-form/`, `campaign-list/`, `import-files/`, `missing-files/`, `package-project/`, `drop-import/`, `campaign-input.ts`. The sections, the brief form, import, drop, relink and package are in `spec/screens-campaign.md`.

- Heading (project name), "Close project" button (`project.close`), file path line. "Loading the project…" while loading. Event `project.changed` for this project reads `project.get` again; one for another project does not.
- **Load a brief** and **Type a brief** open the brief form, the confirm step of FR-023. A cancelled picker sends nothing. A refused `brief.parse` shows in the error banner and creates nothing.
- **Campaign list:** name, "Variants: n", "Open" (`aria-label` "Open {name}"), or "No campaign yet."
- The open campaign is state of this page, not of the app store. `CampaignPlace` renders `<CampaignView projectId campaignId onBack />` in the page's place; `CampaignView` owns its "Back to project" button and its `Campaign` region.

## Campaign page

Built. `src/renderer/screens/campaign/campaign-view/`, `variant-grid/`, `variant-tile/`, `slot-view/`, `src/renderer/stores/job-store.ts`.

- "Back to project". "Loading the campaign…" while `campaign.get` is read. Then the campaign name.
- **Variants:** the campaign grid of tiles (`spec/screens-campaign.md`, "The campaign grid and the variant tile"). The first variant (the master) is chosen at the start. The line "Runs and panels below are for: {title} · {sizeLabel} · {language}" names the chosen one. The slot view, the picture panel, the video card and the run list follow, in that order; the panels and the run list work on the chosen variant.
- **Job store,** one per open campaign page. Reads `job.list { projectId, variantId }` and keeps rows by ID. A `job.updated` row whose ID the store holds, or whose ID a command just returned, replaces the row; for any other row the store reads `job.list` again. It never guesses the project from a row. A `job.list` reply that arrives after a later one is dropped. When a `job.list` reply holds a row the store already holds with an equal or later `updatedAt`, the store keeps its own row, so a late reply cannot turn a finished run back to "Working".
- Known gaps, noted and not built: a refused `campaign.get` leaves the page on "Loading the campaign…" with no message ("Back to project" still works); the page does not read `campaign.get` again on `project.changed`.

### Make pictures

Built. In `src/renderer/screens/campaign/`: `generate-panel/`, `reference-picker/`, `reference-list.ts`, `paid-confirm/`.

- "Provider" (`provider-select/`, with the trial mark of `spec/screens-campaign.md`): providers from `app.getState` whose `jobs` holds `image` and that are `available`, starting at `settings.defaultProviders.image` when available. None: "No picture provider is available."
- "Slot": picture slots from `template.slots` (copy slots left out), the first chosen. None: "This campaign has no picture slot."
- "Prompt": prefilled by `prefilledPrompt` (`src/shared/generation/prompt.ts`) from the subjects, audience, region and message. The UI pass may reword `prefilledPrompt` with no ruling.
- **Reference pictures,** under the prompt box. Heading "Reference pictures"; one small picture per asset with a tick box and its display name; "Add pictures". Empty: "No reference pictures in this project yet."
  - Calls: `asset.list { projectId, library: 'reference', kind: 'image' }`; `dialog.pickFiles { purpose: 'import', kind: 'image', multiple: true }`; `asset.import { projectId, paths, library: 'reference', copy: false, subjectId? }`. Thumbnails through `assetUrl`.
  - Adding: picked paths go to `asset.import` as they came, with `copy: false` (files linked in place, ADR-002). `subjectId` is the chosen variant's first subject ID, omitted when it has none. After the reply the list is read again and the returned IDs are ticked. A cancelled picker sends nothing. A refused `asset.import` shows the command's message and ticks nothing.
  - Ticks: the run sends ticked IDs in tick order; each ticked picture shows its place ("1", "2"). An asset with `missing: true` cannot be ticked and says "file not found". With 8 ticked (`MAX_REFERENCES_PER_RUN`), an unticked picture cannot be ticked and the picker says "A run takes at most 8 reference pictures." Ticks are kept while the campaign page is open, also across variant changes, and dropped for an asset that left the list.
  - When the chosen provider's `local` is true and a picture is ticked: "ComfyUI takes one reference picture for now and makes the result in that picture's shape, at about 1 megapixel." This is the screen's only knowledge of the workflow; the limit is the command's, and its `too_many_references` message shows in the error banner. Provisional wording (OI-77).
- "Pictures": a count from 1 to `MAX_IMAGES_PER_RUN`, starting at `settings.generation.optionsPerRun`.
- "Generate" sends `generation.runImages`. A value the input schema refuses shows its first issue message under the fields.
- **Paid confirm line:** "This sends {n} paid request(s) to {Provider}."; with ticks, "This sends {n} paid request(s) and {m} reference picture(s) to {Provider}."; on Retry when the stored request cannot be read, "This sends paid request(s) to {Provider}." with no number. Then "Confirm" and "Cancel".

### Make a video

Built (P7-22 as the latest change). In `src/renderer/screens/campaign/`: `video-panel/` (with `video-length.ts`, `card-starts.ts`, `use-post.ts`), `video-picture-choice/`, `video-start.ts`. A card under "Make pictures", for the chosen variant. Its runs appear in the same run list.

- "Provider" (`provider-select/`, with the trial mark): providers from `app.getState` that are available and list `video` in `jobs` (ComfyUI and, since P7-15, fal.ai Seedance). Preselects the saved default only when it is available, else the first available video provider. None: "No video provider is available."
- "Start from" for a provider with an offer in `src/shared/config/video-offers.ts` (fal.ai Seedance): the offer's starts, in the order "A prompt", "The post's background", "A first-frame picture", "A reference picture". "The post's background" is the default when the background has a picture; it takes no picture choice. Lengths follow the offer's bounds and step, default the larger of 2 s and the offer's least; a reference start takes up to the offer's reference count.
- "Start from" for ComfyUI (no offer, rules as built before): "A prompt" (default), "A first-frame picture", "A reference picture", each offered only if `comfy.getInfo` lists a video workflow for its pair (`videoStart.firstFrame`, `videoStart.references`). "A prompt" is offered always, even before `comfy.getInfo` answers. ComfyUI does not offer "The post's background". One picture at most. A start no longer offered falls back to the default.
- **An image post:** the line "Change this post to video first." and "Start" disabled.
- **Picture start:** region "Picture to start from", the project's reference pictures (the list the reference picker shows), one choice, its own "Add pictures" (chooses the first added picture that can be sent), empty line "No reference pictures in this project yet.", hint "Tip: call the picture <Picture 1> in the prompt." (wording open, OI-89). A picture that cannot be sent shows its reason. The card's choice is separate from the picture panel's ticks. It is kept when switching between the two picture starts, kept but not sent under "A prompt", and dropped when it leaves the list or cannot be sent.
- "Prompt" (empty at the start). "Length (seconds)" for ComfyUI: whole seconds, default 2, least 1, most from `comfy.getInfo`'s `maxMs` for the workflow of the chosen start. Above the most, the note "The clip will be shorter: at most {n} s" shows and the most is sent as `durationMs`. With `maxMs` unknown, the typed value is sent and the command's refusal shows.
- "Start" is disabled until a picture is chosen (picture starts), and with no prompt or no video provider. It sends `generation.startVideo` with `start` (`'background'`, `'first_frame'` or `'none'`), `useReferences` and `referenceAssetIds` (the chosen pictures, as many as the start takes, or empty) from the start table in `spec/data-model.md`. Refusals show as the command gives them. A paid provider goes through the paid confirm line with a count of 1 and the number of pictures sent. A background start counts the post's background picture as one reference picture: "This sends 1 paid request(s) and 1 reference picture(s) to {Provider}."
- No crop preview. No autoplay. The card adds no command, IPC channel, CSP rule or protocol change, and shows no server address or file name. The finished clip lands on the variant's track through the job (P7-16), not through the card.

### Run list and run row

Built. In `src/renderer/screens/campaign/`: `run-list/`, `run-row/` (with `video-status.ts`), `run-result/`, `video-result/`. `run-failure/` and `cancel-shown.ts` are in `src/renderer/ui/` (the editor and the activity panel use them too).

- Each row: the provider's label (or "The provider" when unknown), "Video" for a video run, then the status.
- Under that first line, "Started by an agent" when `startedBy` is `agent`.
- Status: `queued` "Waiting"; `running` "Working", with `result.stage`, "place in queue {n}" and the job's `progress` as a whole percent when present (a ComfyUI picture run gets a live percent, `spec/comfyui.md`, "Live progress"); `succeeded` "Done" and its results; `failed` "Failed", "Retry", and under them the run failure (the reason's or kind's sentence, missing items, "Open Settings", the server's message; `spec/screens-campaign.md`); `cancelled` "Cancelled" and "Retry". A failed run never shows raw error text.
- A running video run says "Waiting (place {n})" (or "Waiting") while the server holds it in its queue, else "Working, {m} min" counted from the row's `createdAt` (there is no `startedAt` column), read again every 15 seconds (`run-row/video-status.ts`). It shows no percentage, even when a ComfyUI video run's `progress` holds one: the video row does not read `progress`.
- **"Cancel"** shows exactly when `job.cancel` would accept the run: a `queued` run on any provider; a `running` run, unless its provider's `cancel` is `none` and the job is a background job other than pictures (`spec/cancel.md`). The rule lives in `ui/cancel-shown.ts` and must always agree with `cancelRefusal` in `src/main/jobs/cancel.ts`; `tests/unit/main/jobs/cancel-shown.test.ts` holds the two to the same answer for every kind, status and provider. A refused cancel shows the command's message.
- "Retry" sends `job.retry`; for a paid provider it first shows the paid confirm line with the count `job.retry` will ask for (FN-4, `spec/screens-campaign.md`). A video run row always counts one request (`requestCount` in `src/renderer/stores/job-store.ts`).
- Picture results: one `<img>` per asset ID, 160 px wide, `alt` "Result {i}", address from `assetUrl`. None: "No pictures."
- Video result: `<video controls preload="metadata">`, `aria-label` "Video result", at the panel's width, `src` from `assetUrl`, no autoplay, sound as the clip has it. None: "No clip."
- When a succeeded row's results are first drawn, the page sends `job.markSeen` once for that job.

## Settings

Built. `src/renderer/screens/settings/settings-screen/` and one component folder per section, in this order.

### New projects

`location-setting/`. "Default location" shown as text; "Change default location" opens the folder picker and saves with `settings.update` [REQ: FR-004].

### Default AI providers

`provider-defaults/`. One select per job: "Image generation", "Layout", "Text: briefs, copy and translation", "Video generation". Each lists the providers that do that job; an unavailable one shows as "{label} (not yet available)", disabled. A change saves with `settings.update` [REQ: FR-067].

### Keys

`keys-section/`, `key-row/`, `ui/secret-labels.ts`. Heading "Keys", the line "Keys are stored encrypted on this computer. After saving, only the last four characters are shown." One row per secret of each AI provider (storage providers left out; their sign-in comes with Phase 9). An unavailable provider shows "Not yet available". A row shows "Saved, ends in {last four}" (nothing after "ends in" for a key of four characters or fewer) or "Not set"; "Add" or "Replace" opens a password field with "Save" (`secret.set`, the field cleared before the call) and "Cancel"; "Delete" (`secret.delete`) [REQ: FR-170].

### ComfyUI server

`comfy-section/`, `comfy-check-result/`.

- Heading "ComfyUI server". "Saved address" shown in full, or "No address saved."
- A fixed privacy paragraph beside the address field, shown whether or not an address is saved, word for word: "When ComfyUI makes a picture or a video, your brief text, prompts and reference pictures are sent to the server at this address. Whoever runs that server can see them." [REQ: REQUIREMENTS-ComfyUI.md 3.3]. A constant in `src/renderer/ui/comfy-privacy.ts`, its one owner, not returned by `comfy.getInfo`. A test pins it with and without a saved address. S2-6 shows it in the address dialog too (A-42); nowhere else.
- "Server address" field with Save and Remove. Save sends `comfy.setAddress` with the typed text and contacts nothing; a refused address shows the command's own sentence under the field and keeps the old address. Remove sends `null`.
- "Check" sends `comfy.check`; disabled with no address saved. "Checking…" while it runs.
- Outcome `ok`: the server version and, per non-draft workflow, its label, status (`trial` shown as "trial"), its licence note as text when it has one, and "complete" or its missing items by name and folder. An `ok` with no workflows shows the version alone. Each other outcome (`no_answer`, `not_comfyui`, `sign_in_needed`, `redirect_refused`, `certificate`, `address_refused`) shows its sentence from `spec/comfyui.md` with the address filled in. Under "What Adman leaves on the server", the "left on the server" sentences.
- `comfy-check-result.tsx` takes the six check sentences from `src/shared/providers/messages.ts` (`checkMessage`, `fillMarks`) and the missing-item text from `missingItemText`, with the Settings form of `redirect_refused`: "The server tried to send Adman to another address. Adman did not follow."
- Below the check result, the list "Licences you confirmed" with "Forget" (`licence-list/`, `spec/screens-campaign.md`).

### Agent access

`mcp-section/`, `connect-panel/`.

- Heading "Agent access". A switch "Turn on agent access" (`mcp.setEnabled`). "Port" field with "Save port" (`settings.update`; no min or max on the field, so the command's own range sentence shows). "Make a new token" (`mcp.regenerateToken`).
- Problem lines from `mcp.getConnectInfo`: "Port {port} is in use. Choose another."; "There is no access token. Make a new token."; "The MCP server could not start. Turn it off and on to try again." A refused command's message shows as a line too; a line equal to the state line is drawn once. Any successful agent-access command clears both refusal lines. After every command the section reads `mcp.getConnectInfo` again.
- **Connect to Claude** panel, shown when the server is on and a token exists: "Address", "Access token" and "Claude Code" (the command line, in a code block) as text, never in an attribute. "Copy" beside the line uses `navigator.clipboard.writeText` on click only (no preload, IPC, CSP or permission-handler change; a permission handler added later must allow `clipboard-sanitized-write`). It reads "Copied" after a click; on failure "Copy did not work. Select the line and copy it." Nothing is logged about the token. A second block, "Claude Desktop", shows `ConnectInfo.claudeDesktop` (the bridge's config JSON, no token) with its own Copy button (P10-9; `spec/mcp-and-agents.md`, "Bridge mode").
- Checkbox "Let agents delete campaigns and variants without asking" (`auto-approve-setting/`, P10-7), with the line "An agent can then delete work with no click from you. Deletes cannot be undone, and deleting a variant clears its campaign's undo list." Saved with `settings.update { mcp: { autoApproveDestructive } }`.
- The token is kept in this section's own state only: never in a store, a log line or an attribute.
- A refused `mcp.getConnectInfo` shows the heading and the query's own fixed error message, with no switch.

### Agent runs

`agent-runs-section/`. Below Agent access, shown whether the MCP server is on or off.

1. Heading "Agent runs".
2. One checkbox per provider for which `agentRunsOffered` gives null, labelled "Let agents start runs with {label}", calling `agentRuns.setAllowed`. A refused command's own message shows under its checkbox.
3. Under a provider whose `local` is false: "Paid. Each run an agent starts is charged to your account, with no click from you."
4. Number field "Most runs agents may have waiting or running, per provider", 1 to 16, saved by `agentRuns.setLimit` on each change. An empty field sends nothing. A refused command's own message shows under the field.
5. A run row says "Started by an agent" when `startedBy` is `agent` ('Run list and run row').

Whether the per-provider tick stays is open (OI-90; build default: yes, off). The rules for agent runs are in `spec/agent-runs.md`. End-to-end case: `tests/e2e/screen-tour.spec.ts`, "Settings · Agent runs: one tick per provider, the limit".

## Key dialog

Built. `src/renderer/dialogs/key-dialog/`. Opens when a command returns `NEEDS_KEY` [REQ: FR-171]. Title "Add your {provider label} key", one password field per missing secret, "Save and continue" (saves each with `secret.set`, then the action is retried) and "Cancel". Keys are not tested when entered [REQ: FR-172].

## Agent ask dialog and activity line

Built (P10-7, P10-7b, P10-8). `src/renderer/app/permission-dialog/`, `src/renderer/app/agent-activity/`.

- **Ask dialog**, on `agent.permissionRequested`: title "An agent asks to delete"; body "{agent} wants to {action}: {target}.", where `{agent}` is "Agent named {client name}" or "An agent" (the name is the agent's own text, drawn as text only); a cost line ("This cannot be undone." for a campaign; for a variant also "It also clears the undo list of this campaign."); "Answer within 2 minutes."; checkbox "Don't ask again for deletes"; buttons "Refuse" (focused first) and "Allow" (pressable 750 ms after opening). Escape refuses. At `expiresAt` it closes with no answer.
- **Activity line:** "Agent working: {tool}", then " · {project name}" when the project is open; `role="status"`; hidden 10 seconds after the last `agent.activity` event.

## Address and licence dialogs

Built. `src/renderer/dialogs/address-dialog/`, `licence-dialog/`, mounted in the shell beside the key dialog; `src/renderer/stores/run-asks.ts`. A run refused for a missing ComfyUI address or an unconfirmed commercial licence opens one, then the run is sent again (`spec/screens-campaign.md`). Refusal `comfy_job_not_offered` shows its message in the error banner.

## Editor, tabs and thumbnails

Built (Phase 3). Described in `spec/editor.md`: the project switcher, campaign tabs and variant tabs replace the project tabs; the editor (canvas, layer list, properties panel, picture chooser, font upload) is the content of a variant tab; the campaign grid and project home show thumbnails. Every rule in "Rules for every screen" holds for them.

**Phase 3 tokens**, added to `src/renderer/ui/tokens.css` by slice P3-0 and used by no other file's literal: `--editor-layers-width` (260px), `--editor-props-width` (312px), `--canvas-backdrop` (a mid grey that is neither ad black nor page white), `--selection-dark` and `--selection-light` (the selection line and its two sides), `--guide-color` (a magenta that shows on most pictures), `--handle-size` (8px), `--rotate-handle-offset` (24px), `--thumbnail-tile` (the grid tile's picture width), `--layer-thumb` (32px). Overflow and missing marks use the existing danger tokens.

## Choices made without a design sign-off

Each was made to get a working, testable screen. The UI pass may change any of them.

Phase 3 (editor and tabs, `spec/editor.md`):

- The editor layout of the accepted prototype: layers on the left, canvas in the centre, properties on the right, a top bar and one banner line above.
- Selection drawn as a dark line with a light line each side (prototype round 3, R3-3), square resize handles and a round rotation handle above the box.
- Guides in magenta, 1 screen pixel; snapping within 6 screen pixels.
- An empty picture layer shown in the editor as a dashed box saying "Empty picture"; overflowing text as a dashed box in the danger colour.
- The canvas backdrop is a mid grey; the ad itself is black where nothing is drawn.
- Zoom steps 25 to 400 %, default "Fit", shown at the foot of the canvas with the size in pixels.
- Text is typed in the properties panel, not on the canvas; double-clicking a text layer does nothing beyond selecting it, and "Add text layer" puts the focus in the Copy field.
- Fields save on Enter or on leaving the field, never on each keystroke.
- The weight list uses the nine standard names (Thin 100 to Black 900).
- Colour is a hex field, the system colour picker, and the campaign palette as buttons.
- The picture chooser is a dialog with a grid of the asset library's pictures and "Import pictures…".
- Duplicate places the copy 20 px right and down, on top of every layer.
- The project switcher is a menu button at the left of the tab row; "Project" is a fixed first campaign tab; "+" shows it.
- Variant tabs are named "{title} · {sizeLabel} · {language}"; job marks are "Running" or a dot.
- The thumbnail of a campaign on the project home is the master of its first direction; a failed thumbnail says "No preview".
- The app menu has no View menu.

Phases 1 and 2:

- Navigation by one tab per open project, with Settings as a button beside the tabs (OI-31 is open).
- Settings is shown in place of the tab panels, not as a tab or a window.
- Screens share one layout stylesheet (`ui/layout.module.css`) of pages, sections, rows and fields; a class one component uses sits in its own module.
- The paid confirm is one line inside the panel, not the run confirmation dialog of Phase 4, and shows no paid-generation count (FR-230 waits for Phase 4).
- Picture results are 160 px wide images in a row; the video result fills the panel's width.
- A running video run counts whole minutes from `createdAt`, refreshed every 15 seconds, and shows no percentage even when the job has one; a running picture run shows its percent.
- The reference picker and the video card's picture choice are separate lists of the same pictures, with separate choices.
- The local-provider reference sentence (OI-77) and the "<Picture 1>" hint (OI-89) are provisional wording.
- The Claude Code line uses the `--font-mono` token (a system monospace font list).
- The choices for the Phase 2 leftover screens are listed in `spec/screens-campaign.md`.
- No crop preview for a first-frame picture.

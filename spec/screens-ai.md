# Screens: AI generation, activity and close warnings

The AI screens: the run dialog and the paid count, the Generate panel of the properties panel (generate, reference pictures, new pictures, earlier options, cut-out), copy options, placing text with AI, reading a brief with AI, the activity panel, and the warnings before closing a tab, a dialog, a project or the app. Read with `spec/screens.md` (rules for every screen), `spec/editor.md` (the editor these sit in), `spec/ai-jobs.md` (the commands and jobs behind them) and `spec/jobs.md`.

Everything here is Built (P4-1 to P4-19, Round 2, then the design wave's DLG-4a, DLG-4b, DLG-5, ED-4a, ED-4b, SH-4, SH-5). Each component has its own folder and CSS module, takes every colour, space, radius and type size from `src/renderer/ui/tokens.css`, and gets its data through props or a store. Every rule of `spec/screens.md`, "Rules for every screen", holds: a paid call starts only after the user's own click with the cost on screen at that click (C-15), one run per click, no raw error text, server and file text drawn as text.

## Where the code lives

```
src/renderer/
├── app/        activity-button/, activity-panel/ [activity-scope.tsx],
│               activity-row/ [row-text.ts, row-marks.tsx, row-retry.tsx],
│               project-switcher/close-project.tsx
├── dialogs/    run-dialog/ [provider-choice.tsx, cost-lines.tsx, run-summary.ts],
│               reference-dialog/, copy-options-dialog/ [copy-setup.tsx, option-list.tsx,
│               use-copy-run.ts], brief-reading-dialog/ [use-job-row.ts]
├── editor/     generate-panel/ [make-switch.tsx, start-from.tsx, same-shape-list.tsx,
│               video-fields.tsx, video-picture-choice.tsx, video-start.ts, use-kind.ts],
│               generate-fields/ [reference-strip.tsx, run-status.tsx, use-first-draft.ts],
│               earlier-options/ [new-options.tsx, run-block.tsx, option-tile.tsx,
│               run-words.ts, retry-button.tsx, use-earlier-options.ts],
│               picture-fields/ [cut-out.tsx, cut-out-status.tsx], clip-preview/,
│               type-styles/, layout-run.ts (Place text with AI: start, finish)
├── screens/    project-home/brief-load/use-text-brief.tsx
├── stores/     activity-store.ts, attached-store.ts, generate-drafts.ts, placed-runs.ts,
│               job-store.ts (requestCount)
└── ui/         paid-count/, paid-confirm/, run-status/ [working-detail.ts, video-status.ts],
                close-warning/, run-failure/, reference-picker/, job-progress/,
                cancel-shown.ts, go-there.ts, show-result.ts
```

**Phase 4 tokens** in `tokens.css`: `--activity-width` (360px), `--option-thumb` (72px), `--mark-dot` (8px), `--run-dialog-width` (480px).

## The run dialog

`dialogs/run-dialog/` (`run-dialog.tsx`, `provider-choice.tsx`, `cost-lines.tsx`, `run-summary.ts`), a `DialogFrame kind="run"`. Every AI run the user starts goes through it [REQ: FR-064, FR-067, FR-230, FR-256]. Its body is `RunSetup`, exported so a dialog can draw the same setup in its own body (copy options, below); `RunSetup` takes `cancelLabel`.

Props: `open`, `projectId`, `job` (`image`, `cutout`, `layout`, `text`, `video`), `title`, `confirmLabel`, `count?` (`{ label, value, min, max }`, editable), `referenceCount?`, `requests?` (a text run's paid requests), `campaignId?`, `retry?` (provider and count fixed), `video?` (`{ start, seconds }`), `onConfirm(provider, count, video?)`, `onCancel`. The dialog reads the providers from the app store. The caller sends the command inside `onConfirm` and returns its reply as a promise. From the click until that promise settles both buttons are disabled and the dialog cannot close. A refusal shows inside the dialog as a danger DialogAlert at the top of the body (A-50) and the action turns back on; on success the caller closes the dialog.

- **Title** from the caller: "Make pictures", "Make a video", "Cut out the subject", "Place text with AI", "Suggest copy", "Read the brief with AI", or "Retry the run" (every `retry` use: earlier options, the Translations tab, the Activity row).
- **Provider** (`provider-choice.tsx`): every provider whose `jobs` holds the job, as a row of segments (still radios) or, at five or more, a `select`. A disabled choice shows only its name, with the reason in its `title` (not yet available; ComfyUI with no offered workflow for the job). An offered `trial` workflow shows the trial mark. Starts at `settings.defaultProviders[job]` when enabled, else the first enabled one; for `cutout`, ComfyUI first (OI-55). With `retry`, the provider is shown as text, "Provider: {label}", not chosen.
- **Until `comfy.getInfo` has answered**: no provider is shown as chosen, the choice and the action are disabled, and neither the cost line nor "No provider can do this yet." shows. With `retry` the dialog does not wait. Reason: the starting choice depends on that answer. `use-comfy-info.ts` exports `useComfyInfoState()`, which gives `{ info, loaded }`.
- **Count** when the caller passes one: "Pictures" or "Options", an inline number field. With `retry`, "{label}: {n}" as text.
- **The paid count** (with `campaignId`): `<PaidCount>` (below), above the cost line.
- **A video's length line**, when the provider makes another length than the one typed: "{Provider} makes clips of {min} to {max} seconds, so this one will be {n} seconds."
- **The cost line**, the body's last element, directly above the buttons, and in the dialog's `aria-describedby` (with the length line when it shows). From `runCost(input): { paid, words }` in `run-summary.ts`:
  - a paid provider (not `local`, not the fake one, or not known) draws a MoneyLine "Paid: {what} → {Provider}" (read aloud with "to"): "Paid: 4 pictures + 2 references → Google Gemini", "Paid: 1 video, 5 seconds + 1 picture → …", "Paid: 1 cut-out → …"; a layout or text run "Paid: 1 request → …" or "Paid: 3 requests → …". A retry whose stored request cannot be read says "pictures" with no number;
  - ComfyUI: "This runs on your ComfyUI server at {address} with the workflow {label}. Nothing is charged." The address comes from `comfy.getInfo` (FR-256 allows it here; the privacy paragraph stays in Settings and the address dialog). With no address saved, the line leaves it out;
  - the fake provider: "This uses the fake provider. Nothing is charged."; another local provider: "This runs on {label}. Nothing is charged."
- **The click that pays** (C-15): the run dialog was opened to make something, so its action button is the one click that sends; there is no second confirm step.
- Buttons: "Cancel" (quiet) and the action ("Generate", "Cut out", "Place text", "Suggest copy", "Read brief", "Retry"). No enabled provider: a warn DialogAlert "No provider can do this yet." with a "Settings" action, and the action disabled.
- A refusal of the caller's command shows in the dialog and in the banner; `NEEDS_KEY`, the address and the licence dialogs open as for every run. A licence question cancelled by the user is not shown as a refusal.

## The paid count

`ui/paid-count/` (`paid-count.tsx`, `use-paid-count.ts`). Reads `campaign.paidCount`, again after each `job.updated` whose row has that `campaignId`. Draws an info mark with a coin: "Paid so far: {p} pictures, {v} videos" (real plurals), with ", {t} text requests" when `text` is above 0. Its `title` is the full sentence "Paid generations for this campaign so far: {p} pictures, {v} videos." and, when `text` is above 0, " Text requests: {t}." Shown in the run dialog and in the campaign head (campaign views only) [REQ: FR-230]. Nothing shows while the query has not answered or was refused. It starts nothing.

## The Generate panel

Built (R2E-4, R2E-5, R2E-8, ED-4a, ED-4b). `editor/generate-panel/`: a Section "Generate" (`props.generate`, level 4; a region named "Generate" with a fold button), mounted by `properties-panel` for picture and background layers. Its summary is a "Running" mark while the panel's own run goes. It holds "Make", "Start from", the generate fields (or the video fields), then "New pictures" and "Earlier options". Disabled parts follow the layer's lock. Nothing in the panel sends a run: "Generate…" only opens the run dialog. The full design is in `spec/phases/round-2-editor.md`, D4 to D7.

- **Make:** a group "Make" of two segments, "Picture" and "Video" (`aria-pressed`), on every picture and background layer. "Video" is disabled where a video cannot be made, with its reason as its `title` and accessible description: "Videos are made on the background layer."; "To make a video, set Format to Video in the top bar first."; "No video service is set up. Add a key in Settings." On a video post's background, "Video" is chosen first; with "Picture" chosen there, an InfoTip says "On a video post, the clips on the timeline show over this picture." Choosing changes the draft only.
- **Start from:** a group of tile buttons with `aria-pressed`: "A prompt only"; "This layer's picture" (its thumbnail; disabled with its reason while the layer has no picture that can be sent); "Another picture of the same shape…" (shows the list of the project's pictures within 1% of the layer box's shape, with "Add pictures…"); for a video, also "Reference pictures" when a provider can use them.
- **Video fields** (`video-fields.tsx`): "Length" with "s" (named "Clip length (seconds)"; whole number, default 2). "Generate…" opens the run dialog titled "Make a video" with action "Generate"; it names the length that will be sent and how many pictures it sends.
- **A generated clip takes the still's place.** A video run from the panel sends `layerId` (the background layer). When the clip comes back, it replaces the still on the timeline that shows the background's picture, in one write and one undo step (the internal command `clip.swap`, denied to agents). If it would be shorter than the shortest clip, it is added at the first free place instead. An agent's video run has no layer and is added as before.
- **The default prompt** leaves out the brief's message when the variant's text layers already hold words, and asks for clear space for the words instead (R2E-1).

### Generate fields

`editor/generate-fields/` [REQ: FR-062, FR-063, workflow 5.1 step 5].

- **Reference pictures** (`reference-strip.tsx`), above the prompt: a `PhotoStrip` list named "Reference pictures", each picture with "Remove {name}", and a "+" tile named "Choose reference pictures…" (opens the reference dialog). The first time a layer is shown, the pictures attached to the variant's subjects are chosen, up to `MAX_REFERENCES_PER_RUN` (8), skipping ones that cannot be sent (SP-7, `spec/subject-photos.md`).
- "Prompt": a text area (placeholder "Describe the picture"), first filled by `prefilledPrompt` from the variant's subjects and the campaign's audience, region and message.
- The prompt and the chosen pictures are kept per layer while the project is open (`stores/generate-drafts.ts`), not saved.
- "Generate…" (the Section's one primary) opens the run dialog (`job: 'image'`, title "Make pictures", action "Generate", count "Pictures" from `settings.generation.optionsPerRun`, `referenceCount`, `campaignId`). It is disabled when the chosen start needs a picture and none is chosen. The action sends `generation.runImages { projectId, variantId, layerId, prompt, referenceAssetIds, count, provider }`; the start picture is sent first, then the chosen pictures, each once, at most `MAX_REFERENCES_PER_RUN`.
- The provider is asked for the shape of the layer's box (OI-70; the rule is in `spec/api-commands.md`, `generation.runImages`).

### Run state

`generate-fields/run-status.tsx` follows the started job by `job.updated`; a visit after the start reads `job.list` for the layer once, so a change it missed shows.

- "Making {n} pictures…" and the done sentences ("Done. The first new picture is on the layer. Click another below to use it instead." or "Done. Click a new picture below to put it on the layer.") are the text of a visually hidden `role="status"`: the tiles show the run.
- Visible words stay for "Cancelled.", "The run ended with no pictures.", "Done, but the clip could not be put on the timeline. Add it with Add clip… on the timeline." and a failure sentence (`ui/run-failure/`).
- A running video shows a `JobProgress` bar named "Making the video"; its hidden status reads "Making the video. Waiting." or "Making the video. {detail}."; once done, a small player of the clip ("Done. The new clip is on the timeline below, in place of the still.").
- When the layer was empty, the run's first picture is put on it (one undo step, `stores/placed-runs.ts`).

### New pictures

`earlier-options/new-options.tsx` (R2E-5, ED-4b). The panel's own run shows in a region "New pictures" under "Generate…", never folded: a dashed spinner tile per picture still to come, then the pictures as tiles named "Use option {n} from {hh:mm}". The one on the layer has an accent ring and a check mark titled "In use" (`aria-pressed`); the others a dot titled "New result". The run's header "{time} · {provider} · {kind}" is the run's `title`, not visible text.

### Reference dialog

`dialogs/reference-dialog/`, a `DialogFrame kind="pick"` titled "Reference pictures for {layer name}". A counter "{k} / 8" in the body (`title` "{k} of 8 pictures chosen"; the limit is `MAX_REFERENCES_PER_RUN` = 8). Two grids, each the reference picker (`ui/reference-picker/`, `shared` true): "Library" (the region "Reference pictures", `library: 'reference'`) and "Made here" (the region "Made in this project", `library: 'asset'`, generated pictures only, A-68). Tiles have no visible caption: their words are hidden text and the `title`. A ticked tile shows its place in the order. Ticks across both grids are one ordered list; at the limit, unticked tiles are disabled with the description "At most 8 pictures". A dashed "+" tile named "Add pictures" imports through the system picker into the reference library. An empty grid reads "No reference pictures in this project yet." or "No pictures made in this project yet." With ComfyUI chosen and a picture ticked: "ComfyUI takes one reference picture for now and makes the result in that picture's shape, at about 1 megapixel." (OI-77). "Done" gives the ticks, in order, to the caller; "Cancel" and Escape drop this visit's changes. Each opening starts from the layer's chosen pictures.

### Earlier options

`editor/earlier-options/` [REQ: FR-248, FR-216, FR-218; workflow 5.8 step 5].

- A Section "Earlier options" (`props.earlier`, level 4), folded at first; summary "No runs" or "{n} runs"; empty: "No earlier options yet". It opens by itself when its newest run failed. Reads `job.earlierOptions`, again on a `job.updated` for one of its jobs or one naming this layer, and on `project.changed` naming an asset it shows.
- One thin row per run, newest first (`run-block.tsx`): the time (local HH:MM), a kind icon (its word hidden; "Pictures" or "Cut-out"), a robot mark "Started by an agent" when so, the status as a StatusMark ("Waiting", "Working", "Working {n}%", "Failed", "Cancelled"; a succeeded run has none), and on a failed run an icon button "Retry". The row's `title` is "{time} · {Provider} · {kind}". A failed run's sentence (`ui/run-failure/`) stays visible under it.
- Each option a tile (`--option-thumb`, whole picture shown, from `assetUrl`) named "Use option {i} from {time}". The layer's own picture is marked "In use" (`aria-pressed`). A missing file is disabled and says "file not found". Choosing sends `layer.update { source: { assetId }, geometry: { crop: null } }`: one undo entry, no provider call. Choosing the option already in use sends nothing.
- On a locked layer, the tiles and Retry are disabled.
- When a succeeded run that is not yet looked at is drawn, `job.markSeen` is sent once for it.
- Ten runs at first; "Show more" adds ten more.
- Retry (`retry-button.tsx`): a paid or unknown provider through the run dialog (title "Retry the run", action "Retry") with `retry` and, for a picture run, the count `job.retry` will ask for (`picturesLeft`); a local one sends `job.retry` at once.

### Cut-out

In `editor/picture-fields/` (`cut-out.tsx`, `cut-out-status.tsx`) [REQ: FR-307]. "Cut out the subject…", an icon button in the picture's icon bar, for a layer with a picture, shown when the run dialog would have an enabled provider for `cutout` (`runChoices`: ComfyUI with an offered `cutout` workflow, or another available provider that lists `cutout`). Disabled on a locked layer. It opens the run dialog (`job: 'cutout'`, no count, action "Cut out"). The action sends `generation.cutOut { projectId, variantId, layerId, provider }`, never `licenceConfirmed`; a refusal stays in the run dialog. A line follows the job: "Cutting out…", "Done. The cut-out is under Earlier options.", "Cancelled.", or the sentence; it reads `job.list` for the layer once. A job that finished at the same instant as its start counts as finished (the time test is `>=`). The layer is not changed; the result is used like any option.

## Copy options

`dialogs/copy-options-dialog/`, a `DialogFrame kind="run"` opened by the sparkle icon button "Suggest copy…" in the corner of "Copy" in `editor/text-fields/` (not for the `headline` slot; disabled for a locked layer) [REQ: FR-045].

- Title "Copy options for {layer name}". It reads `job.list` for the layer and keeps the rows of kind `copy_options` itself; it shows the newest succeeded one's options as radio tiles named by their text.
- Foot: "New options" (named "Make new options…"; disabled while a run goes), "Close", and, with options shown, "Use" (disabled until a tile is chosen; title "Choose an option first"). "Use" sends `layer.update { copy }` and closes the dialog. Choosing a tile sends nothing.
- **The run setup is drawn in this dialog's own body** (`copy-setup.tsx`, using `RunSetup`), never in a dialog inside it: at once when there are no options yet, after "New options", and after a failed run's "Retry". It holds the provider, "Options" (default 4, 1 to `MAX_COPY_OPTIONS`), the cost line last above the foot and in this dialog's description, and the action "Generate" (sends `generation.copyOptions`) or "Retry" (sends `job.retry` for the failed job). Its quiet button closes the setup, or the dialog when there are no options. The job is attached to this dialog (`attached-store`, owner `copy-options:{layerId}`).
- While it runs: a spinner, "Writing options…" (`role="status"`) and "Stop" (`job.cancel`, no warning; the dialog stays open). `job.markSeen` once when options show. A cancelled run goes back to the earlier options.
- A failure shows its sentence and "Retry".
- Closing while the job runs (Close, Escape or the frame's close): the close warning.

## Place text with AI

`editor/top-bar/` has the icon button "Place text with AI…" [REQ: FR-061, workflow 5.1 step 6]. Disabled, with the hint "Add text to a text layer first." as its title and description, when no visible text layer has copy, and while a layout run this editor started for the variant is going. Logic in `editor/layout-run.ts`.

- It opens the run dialog (`job: 'layout'`, title "Place text with AI", action "Place text"). The action sends `generation.proposeLayout`; the job is attached to the variant tab (`attached-store`, owner the variant) with a finish step.
- The command's refusals, shown in the run dialog: "That provider cannot place text." (`INVALID_INPUT`), "That variant was not found." (`NOT_FOUND`), "Add text to a text layer first." (`INVALID_INPUT`), and `NEEDS_KEY`, which opens the key dialog.
- The banner (`editor/editor-banner/`) shows, first of its lines: "Placing text with AI…" with "Stop" (`job.cancel`, no warning).
- **When the job succeeds** while the window is open, the finish step reads `job.get` and `variant.get` again and sends one `layer.updateMany` built by `layoutPatches` from the result, whether or not the tab is the one shown. It sends through `window.api`, so a refusal does not reach the app banner. A variant deleted while the call was out: the job still succeeds, `layer.updateMany` refuses with `NOT_FOUND`, and nothing is shown. Undo puts the text back. `layout-run.ts` marks the handled result seen, also when it was refused or the variant is gone.
- **Readable text** (R2E-2). Before the result is stored, the job checks each text box against the picture under it (the picture it already drew, no extra call). Text is kept readable to a contrast of 4.5:1: the colour is kept if it reaches it; else it becomes the brand colour (or white or black) that does; else a solid text box is added behind it. The banner then says "Text colour changed for legibility ({n})" with "Dismiss". If the picture cannot be read, the boxes go as before and one warn log line is written.
- **Type styles** (R2E-3). When the project has no font of its own, the run offers the five built-in type styles (`spec/editor.md`, "Properties panel", Type) and each box may come back with one.
- A failed job, or another refusal of `layer.updateMany`, shows "Text could not be placed. {sentence}" with "Dismiss". There is no "Retry"; the button starts a new run. The window keeps the line per variant, so a tab shown again still has it.

## Reading a brief with AI

`screens/project-home/brief-load/` and `dialogs/brief-reading-dialog/` [REQ: FR-022, FR-171].

- "Load a brief" opens the brief picker. A path whose `briefFileKind` is `structured` goes to `brief.parse`; `text` opens the run dialog (`job: 'text'`, title "Read the brief with AI", action "Read brief", no campaign). Cancel sends nothing.
- The action sends `brief.extract { projectId, filePath, provider }`. `NEEDS_KEY` opens the key dialog; if the user cancels it, the brief form opens empty, so the brief can be typed by hand.
- The reading dialog (`kind="run"`), title "Reading the brief", shows a spinner, "{Provider} is reading the brief…" and "Stop". The job is attached to it. "Stop" sends `job.cancel` and closes the dialog with no warning; closing it another way while the job runs shows the close warning. A cancelled job closes it. On success it closes and the brief form opens filled from `result.draft` and `primaryLanguage`, as after `brief.parse`; `job.markSeen` is sent. A succeeded job whose result is not a brief draft is shown as a failure of kind `other`.
- On failure: the sentence, "Type it" (named "Fill the form by hand"; the empty form) and "Retry". "Retry" opens the run dialog again (a new provider choice) and its action sends a new `brief.extract` with the same path, not `job.retry`. Closing after a failure asks nothing.

## The activity panel

[REQ: FR-152, FR-217, FR-218; D-036; workflow 5.8 step 4]

- **Button** (`app/activity-button/`), at the right of the top bar before "Settings" (in the corner of the start screen): an icon button named and titled "Activity", `aria-expanded`. While jobs are queued or running, a spinner and the count in the accent colour follow the icon, with the hidden words "{n} running" as its description. A dot (`--mark-dot`, named "New results") when a succeeded job is not yet looked at. It takes the focus back when the panel closes.
- **Panel** (`app/activity-panel/`): a region "Activity" along the right edge under the top bar, `--activity-width` wide, over the content, compact density. A PanelHead "Activity" with the icon button "Close activity"; Escape closes it too. It shows the shown project's jobs. Two Sections, "Running" (queued and running, oldest first) and "Finished" (newest first), each a list named as its Section, the count as its summary; an empty one is not drawn. Empty panel: "No runs yet"; with no project shown, "No project open".
- **Store** (`stores/activity-store.ts`): reads `job.activity` for the shown project, keeps rows by ID, applies `job.updated` for a row it holds and reads the query again for a new one, dropping a reply older than the last.
- **Row** (`app/activity-row/`), an ObjectRow:
  1. Thumb: the job kind's icon.
  2. Name (`row-text.ts`): "Pictures ({count})", "Video", "Cut-out", "Text layout", "Copy options ({count})", "Reading a brief", "Export", "Publish", "Generative fill", "Translation", then " · {Provider}". The count is left out when the request holds none.
  3. Meta: a robot icon (hidden words "Started by an agent") for an agent's job, then "{HH:MM} · {where}": the time the job started first, then "{campaign} › {variant} › {layer}", parts missing left out; a deleted part reads "(deleted)"; a brief reading reads "Project".
  4. One StatusMark: "Waiting", "Working" (with the stage, queue place or percent as the run state gives them, `ui/run-status/`), "Done", "Failed", "Cancelled". A not-yet-looked-at result shows a dot titled "New result".
  5. One icon action: "Cancel" by `ui/cancel-shown.ts`, or "Retry" for a failed or cancelled background job (`row-retry.tsx`): a local provider at once; a paid or unknown one, for pictures and cut-outs, through the run dialog with `retry` (title "Retry the run", the picture count fixed), and for a video, the two-step paid line (`ui/paid-confirm/`) drawn under the row. An attached job is started again from its own dialog or tab, not from here (A-63).
  6. The row's main button is named "Go to {where}"; a row with no place to go offers no button.
  7. A failed row shows its sentence through `ui/run-failure/`, visible under the row.
- **Go there** (`ui/go-there.ts`, through the nav store), in one action, then the panel closes: a job with a layer opens the campaign tab and the variant tab, shows it and selects the layer, so its earlier options show; a gone layer leads to the variant; a gone variant leads to the campaign's Variants tab; a video job leads to its layer, else its variant (R2E-6); a brief reading leads to the Project tab; a gone campaign has no place. It sends no `job.markSeen`; the view that shows the result does.
- **Result notice** (R2E-6, `app/result-notice/`): one info line under the error banner when a picture, video, cut-out or generative fill run of the shown project succeeds and its layer (or variant) is not on screen: "New pictures are ready: {where}." (and the like for the other kinds), with "Show" (goes there through `ui/show-result.ts`) and the icon button "Dismiss". Only the newest shows.

## Attached jobs and the close warning

[D-036; OI-31; OI-51]

- **`stores/attached-store.ts`** holds the attached jobs this window started: `register(jobId, owner, finish?)`, where `owner` is a variant tab (`{ projectId, variantId }`) or a dialog (`{ projectId, dialog: id }`), and `end(jobId)` forgets a job (Stop). It follows `job.updated`; when a job ends it runs `finish` (the layout apply) if it succeeded, and forgets it. A job's first rows can come before the reply registers it, so the latest row of up to 50 unregistered attached jobs is kept. The store lives for the window, so a finish runs when its tab is not the one shown. Jobs from an earlier session are not held: the open rule has settled them.
- **`ui/close-warning/`**, a `DialogFrame kind="confirm"` shown before a close that would leave attached jobs running (SH-5):
  - Title: "Stop {task}?" with task "placing text with AI", "writing copy options", "reading the brief"; for several, "Stop {n} AI tasks?"
  - When any job's provider is paid, "A request already sent may still be charged." is the frame's `warning` (visible, and the accessible description). Inside a dialog (copy options, brief reading), "{Task} is still running. Closing this dialog stops it." follows it. A tab's question does not repeat the title in a sentence.
  - Buttons "Keep open" (focused; closes nothing) and "Stop and close" (sends `job.cancel` for each, then closes).
- **Where it shows:** closing a variant tab (its jobs); closing a campaign tab (the jobs of its variant tabs); closing the copy options or the reading dialog, by its button, Escape or the frame's close.
- **Closing a project** (the project menu's "Close {name}") with any job queued or running: a `DialogFrame kind="confirm"` "Close {project}?" whose `warning` is "{n} runs are still going in this project. Closing stops them. Requests already sent to a paid provider may still be charged, and their results are lost." plus one left-running line per provider whose started paid video cannot be stopped (A-174). Buttons "Keep open" and "Stop and close" (`project.close { runningJobs: 'stop' }`).
- **Quitting** with jobs queued or running in any open project: the main process (`src/main/index.ts`) shows a system message box before quitting, "Quit AdManager?", detail "{n} runs are still going. Quitting stops them. Requests already sent to a paid provider may still be charged, and their results are lost.", buttons "Quit" and "Cancel". "Quit" closes every project through `project.close` with `'stop'` (`closeAllStopping` in `core.ts`), then quits. With nothing running, no box. The text is built by a pure function with its own unit test.

## Choices made without a design sign-off

Each was made to get a working, testable screen. A later UI pass may change any of them.

- One run dialog for every AI job, with the provider as segments, the count inside it, and the campaign's paid count above the cost line.
- AI for a picture layer sits in the properties panel's Generate Section; earlier options are a folded Section of thin rows and small tiles, ten runs at a time.
- Reference pictures are chosen in a dialog with two grids, the reference library and pictures made in the project.
- Copy options are a dialog with the run setup in its own body; place text with AI is a top-bar button with a banner line and applies at once, with Undo as the way back.
- The activity panel is a right-hand panel over the content, opened from a top-bar button, for the shown project only, in two Sections.
- Close warnings are confirm dialogs with "Keep open" focused; quitting uses the system's message box.

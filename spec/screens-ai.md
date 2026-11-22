# Screens: AI generation, activity and close warnings

The Phase 4 screens: the run confirmation dialog and the paid count, the picture section of the properties panel (generate, reference pictures, earlier options, cut-out), copy options, placing text with AI, reading a brief with AI, the activity panel, and the warnings before closing a tab, a dialog, a project or the app. Read with `spec/screens.md` (rules for every screen), `spec/editor.md` (the editor these sit in), `spec/ai-jobs.md` (the commands and jobs behind them) and `spec/jobs.md`.

Everything here is Built (P4-1 to P4-19). Built without a design sign-off [D-084]: each component has its own folder and CSS module, takes every colour, space, radius and type size from `src/renderer/ui/tokens.css`, and gets its data through props or a store. Every rule of `spec/screens.md`, "Rules for every screen", holds: a paid call starts only after the user's own click with the cost on screen at that click (C-15), one run per click, no raw error text, server and file text drawn as text.

## Where the code lives

```
src/renderer/
├── app/        activity-button/, activity-panel/ [activity-scope.tsx],
│               activity-row/ [row-text.ts, row-retry.tsx], project-switcher/close-project.tsx
├── dialogs/    run-dialog/, reference-dialog/, copy-options-dialog/ [option-list.tsx,
│               use-copy-run.ts], brief-reading-dialog/ [use-job-row.ts]
├── editor/     generate-panel/ (was picture-ai/), clip-preview/, type-styles/, generate-fields/ [run-status.tsx, use-first-draft.ts],
│               earlier-options/ [run-block.tsx, run-words.ts, retry-button.tsx,
│               use-earlier-options.ts], picture-fields/ [cut-out.tsx, cut-out-status.tsx],
│               layout-run.ts (Place text with AI: start, finish)
├── screens/    project-home/brief-load/use-text-brief.tsx
├── stores/     activity-store.ts, attached-store.ts, generate-drafts.ts
└── ui/         paid-count/, close-warning/, run-failure/ (moved), reference-picker/ (moved),
                cancel-shown.ts (moved), go-there.ts
```

Changed: `editor/properties-panel/` (mounts `picture-ai`), `editor/picture-fields/` (cut-out button), `editor/text-fields/` ("Suggest copy…"), `editor/top-bar/` and `editor/editor-banner/` (Place text with AI), `screens/campaign/campaign-view/` (paid count), `screens/campaign/variant-tabs/`, `app/campaign-tabs/` and `app/project-switcher/` (close warnings), `screens/project-home/brief-load/` (Markdown and text briefs), `app/app-shell/` (activity).

**Phase 4 tokens**, added to `tokens.css` by P4-1: `--activity-width` (360px), `--option-thumb` (72px), `--mark-dot` (8px), `--run-dialog-width` (480px).

## The run confirmation dialog

`dialogs/run-dialog/` (`run-dialog.tsx`, `provider-choice.tsx`, `run-summary.ts`), on the dialog frame (`ui/dialog-frame/`). Every AI run the user starts in Phase 4 goes through it [REQ: FR-064, FR-067, FR-230, FR-256]. The overview's "Make pictures" panel keeps its one-line paid confirm (a placeholder, `spec/screens.md`); the video card that also had one is being removed (R2E-9, in progress), since videos are now made in the editor's Generate panel through this dialog.

Props: `open`, `projectId`, `job` (`image`, `cutout`, `layout`, `text`), `title`, `confirmLabel`, `count?` (`{ label, value, min, max }`, editable), `referenceCount?`, `campaignId?`, `retry?` (provider and count fixed), `onConfirm(provider, count)`, `onCancel`. The dialog reads the providers from the app store. The caller sends the command inside `onConfirm` and returns its reply as a promise; `count` is null when the caller gave none. "Confirm" and "Cancel" stay disabled from the click until that promise settles. A refusal is shown inside the dialog and "Confirm" turns back on; on success the caller closes the dialog. With no ComfyUI address saved, the ComfyUI line leaves the address out.

- **Title** from the caller: "Make pictures", "Cut out the subject", "Place text with AI", "Suggest copy", "Read the brief with AI", or "Retry the run" (every `retry` use: earlier options, copy options, activity row).
- **"Provider"**, a radio group (`provider-choice.tsx`): every provider whose `jobs` holds the job. An unavailable one is shown disabled as "{label} (not yet available)" (Firefly). ComfyUI with no offered workflow for the job (`comfy.getInfo`, `offered`) is disabled as "ComfyUI (no workflow for this yet)"; an offered `trial` workflow shows the trial mark. Starts at `settings.defaultProviders[job]` when enabled, else the first enabled one; for `cutout`, ComfyUI first (OI-55). With `retry`, the provider is shown as text, not chosen.
- **Until `comfy.getInfo` has answered** (built): no provider is shown as chosen, the provider list and Confirm are disabled, and neither the summary line nor "No provider can do this yet." is shown. With `retry` the dialog does not wait. Reason: the starting choice depends on that answer, and a choice shown early was swapped for ComfyUI under the user. `use-comfy-info.ts` exports `useComfyInfoState()`, which gives `{ info, loaded }`.
- **Count** when the caller passes one: "Pictures" or "Options", a number field.
- **What the run does**, one line from `run-summary.ts`:
  - paid: "This will use {n} generation(s) with {Provider}." and, with references, " It sends {m} reference picture(s)." For one request (layout, text): "This sends 1 paid request to {Provider}."
  - ComfyUI: "This runs on your ComfyUI server at {address} with the workflow {label}. Nothing is charged." The address comes from `comfy.getInfo` (FR-256 allows it here; the privacy paragraph stays in Settings and the address dialog).
  - the fake provider: "This uses the fake provider. Nothing is charged."
  - **The click that pays** (C-15, `spec/screens.md`, "Rules for every screen"): the run dialog was opened to make something, so for a paid provider its confirm button is the one click that sends; there is no second confirm step. The paid line is the cost line of that rule: directly above the buttons, in the dialog's accessible description, and nothing is sent before the click. DLG-4 of the design wave moves the paid count above the line and links the line by `aria-describedby`.
- **The campaign's count** (with `campaignId`): `<PaidCount>` (below).
- Buttons: the confirm label ("Generate", "Cut out", "Place text", "Suggest copy", "Read brief", "Retry") and "Cancel". No enabled provider: the line "No provider can do this yet." and the confirm disabled.
- A refusal of the caller's command shows in the dialog (A-50) and in the banner; `NEEDS_KEY`, the address and the licence dialogs open as for every run.

## The paid count

`ui/paid-count/` (`paid-count.tsx`, `use-paid-count.ts`). Reads `campaign.paidCount`, again after each `job.updated` whose row has that `campaignId`. Draws "Paid generations for this campaign so far: {p} pictures, {v} videos." and, when `text` is above 0, " Text requests: {t}." Shown in the run dialog and on the campaign overview under the campaign name [REQ: FR-230]. A refused query draws nothing.

## The Generate panel

Built (R2E-4, R2E-5, R2E-8). `editor/generate-panel/` replaces `editor/picture-ai/` ("Make pictures with AI" is gone): a fieldset with the legend "Generate", mounted by `properties-panel` for image and background layers, between "Shade" and "Position and size". It holds the generate fields, then the earlier options. Disabled parts follow the layer's lock. Pictures and videos are both made here. The full design is in `spec/phases/round-2-editor.md`, D4 to D7.

- **Make: Picture / Video.** A two-way switch shown only on the background layer of a video post, with "Video" chosen first. Elsewhere a line says where videos are made ("To make a video, set Format to Video in the top bar first." on an image post's background; "Videos are made on the background layer." on another layer of a video post). With no video provider set up, "Video" is disabled with "No video service is set up. Add a key in Settings."
- **Start from**: "A prompt only"; "This layer's picture"; "Another picture of the same shape…" (pictures of the project within 1% of the layer box's shape, with "Add pictures…"); for video, also "Reference pictures" when a provider can use them.
- **Video fields**: "Clip length (seconds)" (whole number, default 2). The run dialog's title is "Make a video"; it names the length that will be sent (rounded to what the provider makes, with a line when it differs from what was typed) and how many pictures it sends. Nothing is sent before Confirm. A provider that cannot start this way is shown disabled.
- **A generated clip takes the still's place.** A video run from the panel sends `layerId` (the background layer). When the clip comes back, it replaces the still on the timeline that shows the background's picture, in one write and one undo step (the internal command `clip.swap`, denied to agents). If it would be shorter than the shortest clip, it is added at the first free place instead. An agent's video run has no layer and is added as before.
- **A finished run.** The line under "Generate…" says where the result went (for example "Done. The first new picture is on the layer. Click another below to use it instead." or "Done. The new clip is on the timeline below, in place of the still."). The new run's pictures show first under "New pictures", the older ones under "Earlier options". When the layer was empty, the first new picture is put on it (one undo step). A done video shows a small player ("Video result").
- **The default prompt** leaves out the brief's message when the variant's text layers already hold words, and asks for clear space for the words instead (R2E-1).

### Result notice

Built (R2E-6). `app/result-notice/`, one line under the error banner, info tone, when a picture, video, cut-out or generative fill run of the shown project succeeds and its layer (or variant) is not on screen: "New pictures are ready: {where}." (and the like for the other kinds), with "Show" (goes there through `ui/show-result.ts`) and "Dismiss". Only the newest shows. Activity's "Go there" and the campaign page's run rows ("Choose in the editor", "See it in the editor") use the same `showResult`; a video job now leads to its layer or variant, not to the campaign overview.

### Generate fields

`editor/generate-fields/` [REQ: FR-062, FR-063, workflow 5.1 step 5].

- "Prompt": a text area, first filled by `prefilledPrompt` from the variant's subjects and the campaign's audience, region and message (without the message when the ad's text layers hold words).
- "Reference pictures": "{n} chosen" or "None chosen", and "Choose reference pictures…" (the reference dialog). The first time a layer is shown, the reference-library pictures of the variant's subjects are chosen, up to `MAX_REFERENCES_PER_RUN`, skipping ones that cannot be sent. (Built, SP-7: every picture attached to the subjects, in either library; `spec/subject-photos.md`.)
- The prompt and the chosen pictures are kept per layer while the project is open (`stores/generate-drafts.ts`), not saved.
- "Generate…" opens the run dialog (`job: 'image'`, count "Pictures" from `settings.generation.optionsPerRun`, `referenceCount`, `campaignId`). Confirm sends `generation.runImages { projectId, variantId, layerId, prompt, referenceAssetIds, count, provider }`.
- After the reply, one line follows the started job by `job.updated`: "Making {n} pictures…", the "Done…" words of "The Generate panel" above, "Cancelled.", or the failure sentence. A visit after the start reads `job.list` for the layer once, so a change it missed shows (`run-status.tsx`).
- The provider is asked for the shape of the layer's box (OI-70; the rule is in `spec/api-commands.md`, `generation.runImages`).

### Reference dialog

`dialogs/reference-dialog/`, title "Reference pictures for {layer name}". Two lists, each the reference picker (`ui/reference-picker/`, moved from `screens/campaign/`): "Reference pictures" (`library: 'reference'`) with "Add pictures", and "Made in this project" (`library: 'asset'`, generated pictures only, A-68). An empty list reads "No reference pictures in this project yet." or "No pictures made in this project yet." Ticks across both are one ordered list, at most `MAX_REFERENCES_PER_RUN`; when full, the unticked boxes are disabled and the line "At most {max} pictures." shows. "Done" keeps the ticks; "Cancel" and Escape drop this visit's changes. Each opening starts from the layer's chosen pictures. Removing a picture from the project is not offered here.

### Earlier options

`editor/earlier-options/` [REQ: FR-248, FR-216, FR-218; workflow 5.8 step 5].

- A region titled "Earlier options" (`aria-labelledby` on a plain line, not a heading: the properties panel has one heading, the layer's name). Reads `job.earlierOptions`, again on a `job.updated` for one of its jobs or one naming this layer, and on `project.changed` naming an asset it shows.
- One block per run, newest first: "{time} · {Provider} · Pictures" ("Cut-out" for a cut-out run), with the time as local HH:MM; "Started by an agent" when so; then the status: "Waiting", "Working" or "Working {n}%", "Failed" with the sentence (`ui/run-failure/`) and "Retry", "Cancelled". A succeeded run has no status word. Retry shows on failed runs only.
- Each option a button with the picture (`--option-thumb`, whole picture shown, from `assetUrl`), labelled "Use option {i} from {time}". The layer's own picture is marked "In use" (`aria-pressed`). A missing file is disabled with "file not found". Choosing sends `layer.update { source: { assetId }, geometry: { crop: null } }`: one undo entry, no provider call. Choosing the option already in use sends nothing.
- On a locked layer, the option buttons and Retry are disabled.
- When a succeeded run that is not yet looked at is drawn, `job.markSeen` is sent once for it.
- Empty: "No earlier options for this layer." Ten runs at first; "Show more" adds ten more.
- Retry (`retry-button.tsx`): a paid or unknown provider through the run dialog (title "Retry the run", confirm "Retry") with `retry` and, for a picture run, the count `job.retry` will ask for; a local one sends `job.retry` at once.

### Cut-out

In `editor/picture-fields/` (`cut-out.tsx`, `cut-out-status.tsx`) [REQ: FR-307]. "Cut out the subject…" under "Choose picture…", for a layer with a picture, shown when the run dialog would have an enabled provider for `cutout` (`runChoices`: ComfyUI with an offered `cutout` workflow, or another available provider that lists `cutout`). Disabled on a locked layer. It opens the run dialog (`job: 'cutout'`, no count). Confirm sends `generation.cutOut { projectId, variantId, layerId, provider }`, never `licenceConfirmed`; a refusal stays in the run dialog. A line under the button follows the job: "Cutting out…", "Done. The cut-out is under Earlier options.", "Cancelled.", or the sentence; it reads `job.list` for the layer once, as the generate line does. As built (P4-T3), a job that finished at the same instant as its start counts as finished (the time test is `>=`). The layer is not changed; the result is used like any option.

## Copy options

`dialogs/copy-options-dialog/`, opened by "Suggest copy…" beside "Copy" in `editor/text-fields/` (not for the `headline` slot; disabled for a locked layer) [REQ: FR-045].

- Title "Copy options for {layer name}". It reads `job.list` for the layer and keeps the rows of kind `copy_options` itself (the query has no kind filter); it shows the newest succeeded one's options, else "No options yet.". Buttons "Close" and "Make new options…" (disabled while a run goes).
- "Make new options…" opens the run dialog (`job: 'text'`, title and confirm "Suggest copy", count "Options", default 4, 1 to `MAX_COPY_OPTIONS`). Confirm sends `generation.copyOptions`. The job is attached to this dialog (`attached-store`, owner `copy-options:{layerId}`).
- While it runs: "Writing options…" and "Stop" (`job.cancel`, no warning; the dialog stays open). Then each option as text with "Use this text" (`layer.update { copy }`, closes the dialog); `job.markSeen` once when shown. A cancelled run goes back to the earlier options.
- A failure shows its sentence and "Retry": the run dialog in `retry` mode (title "Retry the run", confirm "Retry", the failed job's count), whose Confirm sends `job.retry` for the failed job.
- Closing while the job runs (Close, Escape or the frame's close): the close warning.

## Place text with AI

`editor/top-bar/` gains "Place text with AI…" [REQ: FR-061, workflow 5.1 step 6]. Disabled, with the hint "Add text to a text layer first.", when no visible text layer has copy. Logic in `editor/layout-run.ts`.

- It opens the run dialog (`job: 'layout'`, title "Place text with AI", confirm "Place text"). Confirm sends `generation.proposeLayout`; the job is attached to the variant tab (`attached-store`, owner the variant) with a finish step.
- The command's refusals, shown in the run dialog: "That provider cannot place text." (`INVALID_INPUT`), "That variant was not found." (`NOT_FOUND`), "Add text to a text layer first." (`INVALID_INPUT`), and `NEEDS_KEY`, which opens the key dialog.
- The banner (`editor/editor-banner/`) shows, first of its lines: "Placing text with AI…" with "Stop" (`job.cancel`, no warning). As built (LK-6), the top-bar button is disabled while a layout run this editor started for the variant is going.
- **When the job succeeds** while the window is open, the finish step reads `job.get` and `variant.get` again and sends one `layer.updateMany` built by `layoutPatches` from the result, whether or not the tab is the one shown. It sends through `window.api`, so a refusal does not reach the app banner. A variant deleted while the call was out: the job still succeeds, `layer.updateMany` refuses with `NOT_FOUND`, and nothing is shown. Undo puts the text back. As built (P4-T3), `layout-run.ts` marks the handled result seen, also when it was refused or the variant is gone.
- **Readable text** (R2E-2). Before the result is stored, the job checks each text box against the picture under it (the picture it already drew, no extra call). Text is kept readable to a contrast of 4.5:1: the colour is kept if it reaches it; else it becomes the brand colour (or white or black) that does; else a solid text box is added behind it. The banner then says "Text placed. The colour of 1 text was changed so it stands out from the picture." ("The colours of {n} texts were changed…"), with "Dismiss". If the picture cannot be read, the boxes go as before and one warn log line is written.
- **Type styles** (R2E-3). When the project has no font of its own, the run offers the five built-in type styles (`spec/editor.md`, "Text settings") and each box may come back with one.
- A failed job, or another refusal of `layer.updateMany`, shows "Text could not be placed. {sentence}" with "Dismiss". There is no "Retry"; the button starts a new run. The window keeps the line per variant, so a tab shown again still has it.

## Reading a brief with AI

`screens/project-home/brief-load/` and `dialogs/brief-reading-dialog/` [REQ: FR-022, FR-171].

- "Load a brief" opens the brief picker as today. A path whose `briefFileKind` is `structured` goes to `brief.parse`; `text` opens the run dialog (`job: 'text'`, title "Read the brief with AI", no campaign). Cancel sends nothing.
- Confirm sends `brief.extract { projectId, filePath, provider }`. `NEEDS_KEY` opens the key dialog; if the user cancels it, the brief form opens empty, so the brief can be typed by hand.
- The reading dialog, title "Reading the brief", shows "{Provider} is reading the brief…" and "Stop". The job is attached to it. "Stop" sends `job.cancel` and closes the dialog with no warning; closing it another way while the job runs shows the close warning. A cancelled job closes it. On success it closes and the brief form opens filled from `result.draft` and `primaryLanguage`, as after `brief.parse`; `job.markSeen` is sent. A succeeded job whose result is not a brief draft is shown as a failure of kind `other`.
- On failure: the sentence, "Retry" and "Fill the form by hand" (the empty form). "Retry" opens the run dialog again (a new provider choice) and its Confirm sends a new `brief.extract` with the same path, not `job.retry`. Closing after a failure asks nothing.

## The activity panel

[REQ: FR-152, FR-217, FR-218; D-036; workflow 5.8 step 4]

- **Button** (`app/activity-button/`), at the right of the top row before "Settings": "Activity", with "{n} running" when jobs are queued or running and a dot (`--mark-dot`, label "New results") when a succeeded job is not yet looked at. `aria-expanded`.
- **Panel** (`app/activity-panel/`): a region "Activity" along the right edge under the top row, `--activity-width` wide, over the content. "Close activity" and Escape close it. It shows the shown project's jobs; on the start screen, "Open a project to see its activity." Two lists: "Running" (queued and running, oldest first) and "Finished" (newest first). Empty: "Nothing has run in this project yet."
- **Store** (`stores/activity-store.ts`): reads `job.activity` for the shown project, keeps rows by ID, applies `job.updated` for a row it holds and reads the query again for a new one, dropping a reply older than the last, as the job store does.
- **Row** (`app/activity-row/`):
  1. What (`row-text.ts`): "Pictures ({count})", "Video", "Cut-out", "Text layout", "Copy options ({count})", "Reading a brief", "Export", "Publish", "Generative fill", "Translation", then " · {Provider}". The count is left out when the request holds none.
  2. Where: "{campaign} › {variant} › {layer}", parts missing left out; a deleted part reads "(deleted)"; a brief reading reads "Project".
  3. Status, as the run row words it, and "Started {HH:MM}". "Started by an agent" when so. A not-yet-looked-at result shows the mark "New".
  4. Buttons: "Go there" (`aria-label` "Go to {where}"); "Cancel" by `ui/cancel-shown.ts` (moved from `run-row/`); "Retry" for a failed or cancelled background job (`row-retry.tsx`): a local provider at once; a paid or unknown one, for pictures and cut-outs, through the run dialog with `retry` (title "Retry the run", the picture count fixed), and for a video, the run row's one-line paid confirm. An attached job is started again from its own dialog or tab, not from here (A-63).
  5. A failed row shows its sentence through `ui/run-failure/`.
- **Go there** (`ui/go-there.ts`, through the nav store), in one action, then the panel closes: a job with a layer opens the campaign tab and the variant tab, shows it and selects the layer, so its earlier options show; a gone layer leads to the variant; a gone variant leads to the campaign overview; a video job leads to its layer, else its variant (R2E-6); a brief reading leads to the Project tab; a gone campaign has no "Go there". It sends no `job.markSeen`; the view that shows the result does.

## Attached jobs and the close warning

[D-036; OI-31; OI-51]

- **`stores/attached-store.ts`** holds the attached jobs this window started: `register(jobId, owner, finish?)`, where `owner` is a variant tab (`{ projectId, variantId }`) or a dialog (`{ projectId, dialog: id }`), and `end(jobId)` forgets a job (Stop). It follows `job.updated`; when a job ends it runs `finish` (the layout apply) if it succeeded, and forgets it. A job's first rows can come before the reply registers it, so the latest row of up to 50 unregistered attached jobs is kept. The store lives for the window, so a finish runs when its tab is not the one shown. Jobs from an earlier session are not held: the open rule has settled them.
- **`ui/close-warning/`**, a dialog shown before a close that would leave attached jobs running:
  - Title: "Stop {task}?" with task "placing text with AI", "writing copy options", "reading the brief"; for several, "Stop {n} AI tasks?"
  - Body: "{Task} is still running. Closing this {tab | dialog} stops it." and, when any job's provider is paid, "A request already sent may still be charged."
  - Buttons "Stop and close" (sends `job.cancel` for each, then closes) and "Keep open" (has the focus; closes nothing).
- **Where it shows:** closing a variant tab (its jobs); closing a campaign tab (the jobs of its variant tabs); closing the copy options or the reading dialog, by its button, Escape or the frame's close.
- **Closing a project** (the project switcher's "Close project") with any job queued or running: a dialog "Close {project}?", "{n} runs are still going in this project. Closing stops them. Requests already sent to a paid provider may still be charged, and their results are lost.", buttons "Stop runs and close" (`project.close { runningJobs: 'stop' }`) and "Keep open".
- **Quitting** with jobs queued or running in any open project: the main process (`src/main/index.ts`) shows a system message box before quitting, "Quit AdManager?", detail "{n} runs are still going. Quitting stops them. Requests already sent to a paid provider may still be charged, and their results are lost.", buttons "Quit" and "Cancel". "Quit" closes every project through `project.close` with `'stop'` (`closeAllStopping` in `core.ts`), then quits. With nothing running, no box. The text is built by a pure function with its own unit test.

## Choices made without a design sign-off

Each was made to get a working, testable screen. The UI pass may change any of them.

- One run confirmation dialog for every AI job, with the provider as a radio group, the count inside it, and the campaign's paid count at the foot.
- AI for a picture layer sits in the properties panel, under the layer's picture fields; earlier options are a grid of small pictures under the generate fields, ten runs at a time.
- Reference pictures are chosen in a dialog with two lists, the reference library and pictures made in the project.
- Copy options are a dialog; place text with AI is a top-bar button with a banner line and applies at once, with Undo as the way back.
- The activity panel is a right-hand panel over the content, opened from a top-row button, for the shown project only, in two lists.
- Close warnings are dialogs with "Keep open" focused; quitting uses the system's message box.

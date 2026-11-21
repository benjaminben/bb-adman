# Screens: AI generation, activity and close warnings

The Phase 4 screens: the run confirmation dialog and the paid count, the picture section of the properties panel (generate, reference pictures, earlier options, cut-out), copy options, placing text with AI, reading a brief with AI, the activity panel, and the warnings before closing a tab, a dialog, a project or the app. Read with `spec/screens.md` (rules for every screen), `spec/editor.md` (the editor these sit in), `spec/ai-jobs.md` (the commands and jobs behind them) and `spec/jobs.md`.

Everything here is Not built (Phase 4). Built without a design sign-off [D-084]: each component has its own folder and CSS module, takes every colour, space, radius and type size from `src/renderer/ui/tokens.css`, and gets its data through props or a store. Every rule of `spec/screens.md`, "Rules for every screen", holds: a paid run starts only on the user's confirm, one run per click, no raw error text, server and file text drawn as text.

## Where the code lives

```
src/renderer/
├── app/        activity-button/, activity-panel/, activity-row/
├── dialogs/    run-dialog/, reference-dialog/, copy-options-dialog/, brief-reading-dialog/
├── editor/     picture-ai/, generate-fields/, earlier-options/,
│               layout-run.ts (Place text with AI: start, finish)
├── stores/     activity-store.ts, attached-store.ts, generate-drafts.ts
└── ui/         paid-count/, close-warning/, run-failure/ (moved), reference-picker/ (moved),
                cancel-shown.ts (moved), go-there.ts
```

Changed: `editor/properties-panel/` (mounts `picture-ai`), `editor/picture-fields/` (cut-out button), `editor/text-fields/` ("Suggest copy…"), `editor/top-bar/` and `editor/editor-banner/` (Place text with AI), `screens/campaign/campaign-view/` (paid count), `screens/campaign/variant-tabs/`, `app/campaign-tabs/` and `app/project-switcher/` (close warnings), `screens/project-home/brief-load/` (Markdown and text briefs), `app/app-shell/` (activity).

**Phase 4 tokens**, added to `tokens.css` by P4-1: `--activity-width` (360px), `--option-thumb` (72px), `--mark-dot` (8px), `--run-dialog-width` (480px).

## The run confirmation dialog

`dialogs/run-dialog/` (`run-dialog.tsx`, `provider-choice.tsx`, `run-summary.ts`), on the dialog frame (`ui/dialog-frame/`). Every AI run the user starts in Phase 4 goes through it [REQ: FR-064, FR-067, FR-230, FR-256]. The overview's "Make pictures" panel and video card keep their one-line paid confirm (placeholders, `spec/screens.md`).

Props: `open`, `projectId`, `job` (`image`, `cutout`, `layout`, `text`), `title`, `confirmLabel`, `count?` (`{ label, value, min, max }`, editable), `referenceCount?`, `campaignId?`, `retry?` (provider and count fixed), `onConfirm(provider, count)`, `onCancel`. The dialog reads the providers from the app store. The caller sends the command inside `onConfirm` and returns its reply as a promise; `count` is null when the caller gave none. "Confirm" and "Cancel" stay disabled from the click until that promise settles. A refusal is shown inside the dialog and "Confirm" turns back on; on success the caller closes the dialog. With no ComfyUI address saved, the ComfyUI line leaves the address out.

- **Title** from the caller: "Make pictures", "Cut out the subject", "Place text with AI", "Suggest copy", "Read the brief with AI", or "Try again".
- **"Provider"**, a radio group (`provider-choice.tsx`): every provider whose `jobs` holds the job. An unavailable one is shown disabled as "{label} (not yet available)" (Firefly). ComfyUI with no offered workflow for the job (`comfy.getInfo`, `offered`) is disabled as "ComfyUI (no workflow for this yet)"; an offered `trial` workflow shows the trial mark. Starts at `settings.defaultProviders[job]` when enabled, else the first enabled one; for `cutout`, ComfyUI first (OI-55). With `retry`, the provider is shown as text, not chosen.
- **Count** when the caller passes one: "Pictures" or "Options", a number field.
- **What the run does**, one line from `run-summary.ts`:
  - paid: "This will use {n} generation(s) with {Provider}." and, with references, " It sends {m} reference picture(s)." For one request (layout, text): "This sends 1 paid request to {Provider}."
  - ComfyUI: "This runs on your ComfyUI server at {address} with the workflow {label}. Nothing is charged." The address comes from `comfy.getInfo` (FR-256 allows it here; the privacy paragraph stays in Settings and the address dialog).
  - the fake provider: "This uses the fake provider. Nothing is charged."
- **The campaign's count** (with `campaignId`): `<PaidCount>` (below).
- Buttons: the confirm label ("Generate", "Cut out", "Place text", "Suggest copy", "Read brief", "Try again") and "Cancel". No enabled provider: the line "No provider can do this yet." and the confirm disabled.
- A refusal of the caller's command shows in the dialog (A-50) and in the banner; `NEEDS_KEY`, the address and the licence dialogs open as for every run.

## The paid count

`ui/paid-count/` (`paid-count.tsx`, `use-paid-count.ts`). Reads `campaign.paidCount`, again after each `job.updated` whose row has that `campaignId`. Draws "Paid generations for this campaign so far: {p} pictures, {v} videos." and, when `text` is above 0, " Text requests: {t}." Shown in the run dialog and on the campaign overview under the campaign name [REQ: FR-230]. A refused query draws nothing.

## The picture section of the properties panel

`editor/picture-ai/`, heading "Make pictures with AI", mounted by `properties-panel` for image and background layers, between "Picture" and "Position and size". It holds the generate fields, then the earlier options. Disabled parts follow the layer's lock.

### Generate fields

`editor/generate-fields/` [REQ: FR-062, FR-063, workflow 5.1 step 5].

- "Prompt": a text area, first filled by `prefilledPrompt` from the variant's subjects and the campaign's audience, region and message.
- "Reference pictures": "{n} chosen" or "None chosen", and "Choose reference pictures…" (the reference dialog). The first time a layer is shown, the reference-library pictures of the variant's subjects are chosen, up to `MAX_REFERENCES_PER_RUN`, skipping ones that cannot be sent.
- The prompt and the chosen pictures are kept per layer while the project is open (`stores/generate-drafts.ts`), not saved.
- "Generate…" opens the run dialog (`job: 'image'`, count "Pictures" from `settings.generation.optionsPerRun`, `referenceCount`, `campaignId`). Confirm sends `generation.runImages { projectId, variantId, layerId, prompt, referenceAssetIds, count, provider }`.
- After the reply, one line follows the started job by `job.updated`: "Making {n} pictures…", "Done. Choose one under Earlier options.", or the failure sentence.
- The provider is asked for the shape of the layer's box (OI-70; the rule is in `spec/api-commands.md`, `generation.runImages`).

### Reference dialog

`dialogs/reference-dialog/`, title "Reference pictures for {layer name}". Two lists, each the reference picker (`ui/reference-picker/`, moved from `screens/campaign/`): "Reference pictures" (`library: 'reference'`) with "Add pictures", and "Made in this project" (`library: 'asset'`, generated pictures only, A-68). Ticks across both are one ordered list, at most `MAX_REFERENCES_PER_RUN`; a further tick is refused with "At most {max} pictures." "Done" keeps the ticks; "Cancel" drops this visit's changes. Removing a picture from the project is not offered here.

### Earlier options

`editor/earlier-options/` [REQ: FR-248, FR-216, FR-218; workflow 5.8 step 5].

- Heading "Earlier options". Reads `job.earlierOptions`, again on a `job.updated` for one of its jobs or one naming this layer, and on `project.changed` naming an asset it shows.
- One block per run, newest first: "{time} · {Provider} · Pictures" (or "Cut-out"), "Started by an agent" when so, then the status: "Waiting", "Working" with the percent, "Failed" with the sentence (`ui/run-failure/`) and "Retry", "Cancelled".
- Each option a button with the picture (`--option-thumb`, whole picture shown, from `assetUrl`), labelled "Use option {i} from {time}". The layer's own picture is marked "In use" (`aria-pressed`). A missing file is disabled with "file not found". Choosing sends `layer.update { source: { assetId }, geometry: { crop: null } }`: one undo entry, no provider call.
- When a succeeded run that is not yet looked at is drawn, `job.markSeen` is sent once for it.
- Empty: "No earlier options for this layer." Ten runs at first, then "Show more".
- Retry: a paid provider through the run dialog with `retry` and the count `job.retry` will ask for; a local one at once.

### Cut-out

In `editor/picture-fields/` [REQ: FR-307]. "Cut out the subject…" under "Choose picture…", for a layer with a picture, shown when some provider can cut out (ComfyUI with an offered `cutout` workflow, or the fake provider). It opens the run dialog (`job: 'cutout'`, no count). Confirm sends `generation.cutOut { projectId, variantId, layerId, provider }`. A line under the button follows the job: "Cutting out…", "Done. The cut-out is under Earlier options.", or the sentence. The result is used like any option.

## Copy options

`dialogs/copy-options-dialog/`, opened by "Suggest copy…" beside "Copy" in `editor/text-fields/` (not for the `headline` slot; disabled for a locked layer) [REQ: FR-045].

- Title "Copy options for {layer name}". It shows the options of the layer's newest succeeded `copy_options` job, if any, and "Make new options…".
- "Make new options…" opens the run dialog (`job: 'text'`, count "Options", default 4, 1 to 8). Confirm sends `generation.copyOptions`. The job is attached to this dialog (`attached-store`).
- While it runs: "Writing options…" and "Stop" (`job.cancel`). Then each option as text with "Use this text" (`layer.update { copy }`, closes the dialog); `job.markSeen` when shown. A failure shows its sentence and "Try again".
- Closing while the job runs: the close warning.

## Place text with AI

`editor/top-bar/` gains "Place text with AI…" [REQ: FR-061, workflow 5.1 step 6]. Disabled, with the hint "Add text to a text layer first.", when no visible text layer has copy. Logic in `editor/layout-run.ts`.

- It opens the run dialog (`job: 'layout'`). Confirm sends `generation.proposeLayout`; the job is attached to the variant tab (`attached-store`, owner the variant) with a finish step.
- The banner (`editor/editor-banner/`) shows, first of its lines: "Placing text with AI…" with "Stop" (`job.cancel`).
- **When the job succeeds** while the tab is open, the finish step sends one `layer.updateMany` built by `layoutPatches` from the result, whether or not the tab is the one shown. Undo puts the text back. A failure shows "Text could not be placed. {sentence}" with "Dismiss".

## Reading a brief with AI

`screens/project-home/brief-load/` and `dialogs/brief-reading-dialog/` [REQ: FR-022, FR-171].

- "Load a brief" opens the brief picker as today. A path whose `briefFileKind` is `structured` goes to `brief.parse`; `text` opens the run dialog (`job: 'text'`, title "Read the brief with AI", no campaign). Cancel sends nothing.
- Confirm sends `brief.extract { projectId, filePath, provider }`. `NEEDS_KEY` opens the key dialog; if the user cancels it, the brief form opens empty, so the brief can be typed by hand.
- The reading dialog, title "Reading the brief", shows "{Provider} is reading the brief…" and "Stop". The job is attached to it. On success it closes and the brief form opens filled from `result.draft` and `primaryLanguage`, as after `brief.parse`; `job.markSeen` is sent. On failure: the sentence, "Try again" (the run dialog again) and "Fill the form by hand" (the empty form).

## The activity panel

[REQ: FR-152, FR-217, FR-218; D-036; workflow 5.8 step 4]

- **Button** (`app/activity-button/`), at the right of the top row before "Settings": "Activity", with "{n} running" when jobs are queued or running and a dot (`--mark-dot`, label "New results") when a succeeded job is not yet looked at. `aria-expanded`.
- **Panel** (`app/activity-panel/`): a region "Activity" along the right edge under the top row, `--activity-width` wide, over the content. "Close activity" and Escape close it. It shows the shown project's jobs; on the start screen, "Open a project to see its activity." Two lists: "Running" (queued and running, oldest first) and "Finished" (newest first). Empty: "Nothing has run in this project yet."
- **Store** (`stores/activity-store.ts`): reads `job.activity` for the shown project, keeps rows by ID, applies `job.updated` for a row it holds and reads the query again for a new one, dropping a reply older than the last, as the job store does.
- **Row** (`app/activity-row/`):
  1. What: "Pictures ({count})", "Video", "Cut-out", "Text layout", "Copy options ({count})", "Reading a brief", then " · {Provider}".
  2. Where: "{campaign} › {variant} › {layer}", parts missing left out; a deleted part reads "(deleted)"; a brief reading reads "Project".
  3. Status, as the run row words it, and "Started {HH:MM}". "Started by an agent" when so. A not-yet-looked-at result shows the mark "New".
  4. Buttons: "Go there" (`aria-label` "Go to {where}"); "Cancel" by `ui/cancel-shown.ts` (moved from `run-row/`); "Retry" for a failed or cancelled background job (paid: the run dialog with `retry`). An attached job is started again from its own dialog or tab, not from here (A-63).
  5. A failed row shows its sentence through `ui/run-failure/`.
- **Go there** (`ui/go-there.ts`, through the nav store), in one action, then the panel closes: a job with a layer opens the campaign tab and the variant tab, shows it and selects the layer, so its earlier options show; a gone layer leads to the variant; a gone variant, or a video job, leads to the campaign overview; a brief reading leads to the Project tab; a gone campaign has no "Go there". It sends no `job.markSeen`; the view that shows the result does.

## Attached jobs and the close warning

[D-036; OI-31; OI-51]

- **`stores/attached-store.ts`** holds the attached jobs this window started: `register(jobId, owner, finish?)`, where `owner` is a variant tab (`{ projectId, variantId }`) or a dialog (`{ dialog: id }`). It follows `job.updated`; when a job ends it runs `finish` (the layout apply) if it succeeded, and forgets it. The store lives for the window, so a finish runs when its tab is not the one shown. Jobs from an earlier session are not held: the open rule has settled them.
- **`ui/close-warning/`**, a dialog shown before a close that would leave attached jobs running:
  - Title: "Stop {task}?" with task "placing text with AI", "writing copy options", "reading the brief"; for several, "Stop {n} AI tasks?"
  - Body: "{Task} is still running. Closing this {tab | dialog} stops it." and, when any job's provider is paid, "A request already sent may still be charged."
  - Buttons "Stop and close" (sends `job.cancel` for each, then closes) and "Keep open" (has the focus; closes nothing).
- **Where it shows:** closing a variant tab (its jobs); closing a campaign tab (the jobs of its variant tabs); closing the copy options or the reading dialog, by its button, Escape or the frame's close.
- **Closing a project** (the project switcher's "Close project") with any job queued or running: a dialog "Close {project}?", "{n} runs are still going in this project. Closing stops them. Requests already sent to a paid provider may still be charged, and their results are lost.", buttons "Stop runs and close" (`project.close { runningJobs: 'stop' }`) and "Keep open".
- **Quitting** with jobs queued or running in any open project: the main process (`src/main/index.ts`) shows a system message box before quitting, "Quit Adman?", detail "{n} runs are still going. Quitting stops them. Requests already sent to a paid provider may still be charged, and their results are lost.", buttons "Quit" and "Cancel". "Quit" closes every project through `project.close` with `'stop'` (`closeAllStopping` in `core.ts`), then quits. With nothing running, no box. The text is built by a pure function with its own unit test.

## Choices made without a design sign-off

Each was made to get a working, testable screen. The UI pass may change any of them.

- One run confirmation dialog for every AI job, with the provider as a radio group, the count inside it, and the campaign's paid count at the foot.
- AI for a picture layer sits in the properties panel, under the layer's picture fields; earlier options are a grid of small pictures under the generate fields, ten runs at a time.
- Reference pictures are chosen in a dialog with two lists, the reference library and pictures made in the project.
- Copy options are a dialog; place text with AI is a top-bar button with a banner line and applies at once, with Undo as the way back.
- The activity panel is a right-hand panel over the content, opened from a top-row button, for the shown project only, in two lists.
- Close warnings are dialogs with "Keep open" focused; quitting uses the system's message box.

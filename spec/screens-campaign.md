# Screens: Phase 2 leftovers

The screens, dialogs and components that Phase 2 still owes: ComfyUI failures and refusals on the campaign page, the commercial-licence dialog, import (by button and by dropping files), relink, package, the brief form, the slot view and the campaign grid. Read with `spec/screens.md` (rules for every screen, built screens, choices made without a design sign-off), `spec/structure.md` (one folder per component, one styling source) and `spec/api-commands.md` / `spec/api-queries-events.md` (the calls). The slices that build them are in `spec/phases/phase-02-leftovers.md` (S2-1 to S2-17).

Everything here is Not built (Phase 2 leftovers). Each part names its slice.

## Rules for these screens

Every rule in `spec/screens.md`, "Rules for every screen", holds. In addition:

- **Folders and styling.** Each component has its own folder with an `index.ts` and, when it has styles, its own CSS module. Every colour, space, radius, line width and type size comes from `src/renderer/ui/tokens.css`. No slice adds a token; if one is needed, the developer stops and reports. Components get their data through props or a store and do not reach into each other.
- **Dialogs** use `src/renderer/ui/dialog-frame/` (S2-2): a Radix dialog with an overlay, a title, an optional description, and the content. Escape and a click outside close it, except while a command it sent is waiting (`closable` false). On close, focus goes back to the control that opened it; when that control is gone (a drop), focus goes to the page's heading.
- **Refusals.** Every command goes through the app store's `command`, so a refusal also shows in the error banner. A dialog that sent the command shows the same message inside itself as well (role `alert`), because the banner is behind the dialog's overlay (A-50).
- **Paths.** The renderer draws no path. It shows a file's base name (the text after the last `/` or `\`) as text. A path is sent only to: `asset.import` (from `dialog.pickFiles`, `dialog.pickFolder`, or a dropped file through the drop bridge), `asset.relink` (from `dialog.pickFiles` with `purpose: 'relink'`), `project.package` (from `dialog.pickFolder`) and `brief.parse` (from `dialog.pickFiles` with `purpose: 'brief'`).
- **Counts in sentences** use the "(s)" form the built screens use ("{n} file(s)"), so no sentence needs a plural rule.

## Shared pieces (S2-1, S2-2)

- **`src/shared/providers/messages.ts`** (S2-1) owns every sentence below that the main process or two screens use:
  - `checkMessage(outcome)`: the six Settings check sentences, with `{address}` left as a mark. `redirect_refused` has its Settings form: "The server tried to send Adman to another address. Adman did not follow." The run form in `reasonMessage` keeps "…, and the run was stopped." [F-12]
  - `fillMarks(text, { address?, n? })`: puts the address and the count into a sentence's `{address}` and `{n}` marks. A missing value leaves the mark's sentence readable: an unknown address becomes "the saved address".
  - `licenceNotConfirmedMessage(model)`: "{model} requires a commercial license. Confirm that you have one first." (the command's refusal, S2-4).
- **`src/renderer/ui/missing-item-text.ts`** (S2-1): `missingItemText(item)` gives "Model {name}, in the folder {folder}" and the like (the text `comfy-check-result.tsx` builds today), for Settings and the run row.
- **`src/renderer/ui/comfy-privacy.ts`** (S2-2): the ComfyUI privacy paragraph, moved out of `comfy-section.tsx` word for word. Shown in the Settings ComfyUI section and in the address dialog, nowhere else (A-42).
- **`src/renderer/screens/campaign/use-comfy-info.ts`** (S2-2): the `useComfyInfo()` hook, moved out of `video-panel/video-length.ts` unchanged, for the video card, the panels' trial mark and the run row.

## Campaign page: ComfyUI failures in the run row (S2-5)

Component `src/renderer/screens/campaign/run-failure/`, drawn by `run-row/` for a `failed` row in place of today's one sentence. Props: `row: JobRow`, `projectId`, `provider: ProviderInfo | undefined`, `providerLabel`. [REQ: FR-265, FR-266, FR-267, FR-069]

**What it shows**

1. **The sentence.** When `row.errorReason` is set: `fillMarks(reasonMessage(row.errorReason), { address, n })`, with `address` from `useComfyInfo()` and `n` the number of missing items. Otherwise `plainMessage(row.errorKind ?? 'other', providerLabel)` as today.
2. **Missing items** (reason `missing_items`): a list labelled "What the server is missing", one `missingItemText(item)` per entry of `row.result.missing`. Each entry is checked with the shared `MissingItem` schema; an entry that fails is left out. The names come from the app's own workflow files.
3. **"Open Settings"** for the reasons `address_needed`, `no_answer`, `not_comfyui`, `sign_in_needed`, `redirect_refused`, `certificate`, `address_refused`. It calls the app store's `show({ kind: 'settings' })`. No other reason shows it.
4. **"Show the server's message"**, only when `provider?.serverText` is true. It sends the query `job.getServerMessage { projectId, jobId }` once and shows, under a heading "Message from the ComfyUI server", the reply's `text` in a `<pre>` block as text content. The button then reads "Hide the server's message" and hides the block without asking again. A null `text`: "The server sent no message for this run." A refused query: its message in the block.

The run row's own "Retry" stays where it is. Every failure sentence therefore has Retry beside it.

**States:** before `comfy.getInfo` answers, the address mark reads "the saved address"; after, the address. Loading the server's message: "Reading the server's message…" in the block, button disabled.

**Never:** the server text set as HTML, turned into a link, or parsed. A reply holding `<a href="…">x</a>` shows those characters.

**Keyboard and focus:** both buttons are plain buttons in tab order after Retry. "Show the server's message" has `aria-expanded` and `aria-controls` naming the block.

**The confirm count on Retry (FN-4).** For an `image_generation` row, the paid confirm line of Retry shows `picturesLeft(requestCount(row), row.result)` (`src/shared/generation/pictures-left.ts`), the number `job.retry` will ask for. Other rows keep `requestCount(row)`.

**A ComfyUI run asks for no paid confirm.** Unchanged rule (ComfyUI's `local` is true); S2-5 adds a test that Retry on a failed ComfyUI row sends `job.retry` with no confirm line.

## The address dialog (S2-6)

Component `src/renderer/dialogs/address-dialog/`, mounted once in the app shell beside the key dialog. [REQ: FR-255; `spec/api-principles.md`, "NEEDS_KEY", last paragraph]

**When it opens.** The app store's `command` sends `generation.runImages`, `generation.startVideo` or `job.retry`, and the reply is `RULE_VIOLATION` with `details.reason` `comfy_address_needed`. The store opens the dialog and waits. No other command opens it.

**What it shows**

- Title "Enter your ComfyUI server's address".
- The privacy paragraph from `ui/comfy-privacy.ts`.
- A text field "Server address", hint "For example http://127.0.0.1:8188". Empty at the start. `autoComplete` off, `spellCheck` false.
- Buttons "Cancel" and "Save and continue" (primary, the form's submit; Enter in the field submits).

**What each control does**

- "Save and continue" sends `comfy.setAddress { address }` with the typed text. A refusal shows its own sentence under the field (`aria-describedby` on the field) and the dialog stays open. On success the dialog closes and the store sends the first command again, once, with the same input.
- "Cancel" (and Escape) closes it. The store returns the first refusal to the caller and does not put it in the error banner. Nothing is sent again.

**States:** open with an empty field; saving ("Saving…", both buttons disabled, `closable` false); refused (sentence under the field); closed.

**Focus:** the field has focus on open. Tab order: field, Cancel, Save and continue.

## The commercial-licence dialog (S2-6) [D-088]

Component `src/renderer/dialogs/licence-dialog/`, mounted once in the app shell. The rule and its main-process half are in `spec/comfyui-workflows.md`, "Commercial-licence dialog".

**When it opens.** The app store's `command` sends `generation.runImages`, `generation.startVideo` or `job.retry`, and the reply is `INVALID_INPUT` with `details.reason` `licence_not_confirmed`. `details.workflow` names the workflow. The store opens the dialog and waits. This is the window's only licence check: the main process alone decides which workflow a run uses, and it refuses before any job row (A-40).

**What it shows**

- The model's name `{model}` is the workflow's `model.label` from `comfy.getInfo`, found by `details.workflow`. If the query fails or the workflow is not listed, `{model}` is "This model".
- Title, word for word: "{model} requires a commercial license, please confirm that you have one before production use".
- A checkbox "don't show again for {model}", not ticked at the start.
- Buttons "Cancel" and "Confirm" (primary).

**What each control does**

- "Confirm": if the box is ticked, the dialog first sends `settings.update { licenceConfirmed }` with the current list from `app.getState` plus `{model}` (no duplicates). Then it closes, and the store sends the first command again, once, with the same input plus `licenceConfirmed: true`. A refused `settings.update` shows in the banner; the run is still sent, since the user confirmed.
- "Cancel" (and Escape) closes it. Nothing is sent; the store returns the refusal without the banner.
- The store asks at most once per call. If the second send is refused again, that refusal goes to the banner.

**States:** open; saving the model ("Saving…", buttons disabled); closed.

**Focus:** the checkbox has focus on open. Tab order: checkbox, Cancel, Confirm.

## The trial mark in the panels (S2-7)

When the chosen provider is ComfyUI and the workflow `comfy.getInfo` marks `offered` for the run the panel would start has status `trial`, the provider's name in the panel reads "ComfyUI (trial)". [REQ: FR-254]

- Make pictures: the job is `image` with no ticked reference, `image_refs` with one or more.
- Make a video: the job is `video` and the workflow's `videoStart` equals the chosen start's pair (`video-start.ts`).
- A shared helper `src/renderer/screens/campaign/offered-workflow.ts`, `offeredFor(info, job, pair?)`, finds it. Before `comfy.getInfo` answers, no mark.
- Both panels draw their provider choice through a new component `src/renderer/screens/campaign/provider-select/` (props: `label`, `providers`, `value`, `onChange`, `trial: boolean`), so the mark has one owner. The label stays "Provider", so the existing tests and the end-to-end helpers still find it.

## Settings: confirmed licences (S2-8)

Component `src/renderer/screens/settings/licence-list/`, mounted inside `comfy-section/` below the check result. [D-088]

- Heading (level 3) "Licences you confirmed".
- One row per name in `app.getState`'s `settings.licenceConfirmed`, in saved order: the name as text and a button "Forget" (`aria-label` "Forget {model}"). It sends `settings.update { licenceConfirmed }` with that name removed. The next run of that model shows the dialog again.
- Empty: "You have not confirmed a commercial license for any model."
- A refusal shows in the banner and as a line under the list. While a Forget is sent, every Forget button is disabled.

## Project home

The layout after S2-2, top to bottom, inside today's page (heading, "Close project", file path):

1. "Campaigns": the campaign list, as built.
2. "Start a campaign": `brief-load/` ("Load a brief" and, from S2-13, "Type a brief"), and the brief form when one is open.
3. "Files": `import-files/` ("Import files…", "Import a folder…") and `missing-files/` (the missing-file line).
4. "Package": `package-project/` ("Package project…").
5. `drop-import/`: draws nothing until files are dragged over the window.

Each of 3 to 5 is its own component in `src/renderer/screens/project-home/`, mounted by `project-home.tsx` with its final props in S2-2 and drawing nothing until its slice fills it. Props: `ImportFiles { projectId, subjects: SubjectRow[] }`, `MissingFiles { projectId, missingCount: number }`, `PackageProject { projectId }`, `DropImport { projectId, projectName, subjects: SubjectRow[] }`. `missingCount` is `project.get`'s `missingAssetCount`; it is current because the page reads `project.get` again on `project.changed`.

While a campaign is open, the campaign page takes the place of sections 1 to 4, as today. `drop-import/` stays mounted.

**After "Create campaign"** the new campaign opens (A-45): `BriefLoad` gets `onCreated(campaignId)` from the page, which opens that campaign. S2-2 adds the prop and the call.

## The import dialog (S2-9) [REQ: FR-050, FR-052, FR-053, FR-054, FR-246]

Component `src/renderer/dialogs/import-dialog/`. Props: `projectId`, `open`, `paths: string[]`, `folder: boolean` (the one path is a folder), `subjects: SubjectRow[]`, `onClose()`. Opened by `import-files/` and by `drop-import/`, each with its own instance.

**What it shows**

- Title: "Import {n} file(s)"; for a folder, "Import a folder".
- The names to import: each path's base name as text, at most 10, then "and {k} more".
- "Put them in" (radio group): "Asset library (can go on a post)", chosen at the start; "Reference library (only to guide AI pictures)".
- Checkbox "Copy into the project's assets folder", not ticked at the start. Hint under it: "Not ticked: the files stay where they are, and the project links to them."
- "Attach to a subject" (select): "No subject" first and chosen at the start, then each project subject as "{name} ({id})".
- Buttons "Cancel" and "Import" (primary).

**What each control does**

- "Import" sends `asset.import { projectId, paths, library, copy, subjectId? }` (`subjectId` left out for "No subject").
- "Cancel" (and Escape) closes; nothing is sent.

**States**

- **Choosing:** as above.
- **Importing:** "Importing…", buttons disabled, `closable` false.
- **Refused:** the command's message inside the dialog; the choices stay; "Import" works again.
- **Done:** the choices are replaced by result lines, each only when its number is not 0:
  - "{a} file(s) added." (`a` = IDs in `assetIds`, each once, that are not in `reusedAssetIds`)
  - "{r} file(s) were already in the project and were kept as they were." (`r` = `reusedAssetIds.length`)
  - "{s} item(s) in the folder were skipped: links, hidden files, and files Adman cannot use." (`s` = `skippedCount`)
  - All three 0: "Nothing was imported. The folder holds no file Adman can use."
  - From S2-17: one line per animated WebP, "{name} holds an animation. Adman uses its first picture."
  - One button "Done" closes the dialog.

**Focus:** the first radio has focus on open; "Done" has focus once the result shows.

### Import buttons (S2-9)

`src/renderer/screens/project-home/import-files/`:

- "Import files…": `dialog.pickFiles { purpose: 'import', multiple: true }`, then the dialog with the picked paths, `folder: false`.
- "Import a folder…": `dialog.pickFolder { title: 'Choose a folder to import' }`, then the dialog with `[path]`, `folder: true`.
- A cancelled picker sends nothing and opens nothing.

## Importing by dropping files (S2-3, S2-10) [REQ: FR-246]

**The drop bridge (S2-3, security class).** The sandboxed window cannot read a dropped file's path. The preload adds one more object beside `window.api`: `window.drop = { pathOf(file: File): string }`, which calls Electron's `webUtils.getPathForFile(file)` and returns its answer: the full path for a file or folder from the system, and `''` for a `File` the page made itself. Type `DropApi` in `src/shared/schemas/drop-api.ts`; `src/renderer/env.d.ts` declares it. The renderer reads it only through `src/renderer/ui/dropped-paths.ts`: `droppedPaths(files: FileList): string[]`, which leaves out empty answers. Nothing else changes in the preload or the main process; `asset.import` checks a dropped path exactly as a picked one (A-43).

**The drop target (S2-10).** `src/renderer/screens/project-home/drop-import/`, mounted by the project page of the shown project.

- While mounted it listens on `window` for `dragenter`, `dragover`, `dragleave` and `drop`. For a drag whose `dataTransfer.types` holds `Files`, `dragover` calls `preventDefault()` and sets `dropEffect` to `copy`. Any other drag is left alone.
- While files are dragged over the window, a layer covers the window (`position: fixed`, the `--color-overlay` token, `pointer-events: none`) with the text "Drop to import into {project name}". It goes on `dragleave` out of the window, on `drop`, and on Escape.
- On `drop`: `preventDefault()`, then `droppedPaths(event.dataTransfer.files)`. With no path, nothing happens. Otherwise the import dialog opens with those paths (`folder: false`; a dropped folder is fine, since `asset.import` opens folders) and the subjects. A drop never imports by itself: the user presses "Import".
- While an import dialog of this page is open, a new drop is ignored.
- Dropping on the Start screen or on Settings does nothing: no project page is mounted there, and the main process already blocks the page from opening the file.
- **Keyboard:** dropping has no keyboard form; "Import files…" and "Import a folder…" are the keyboard path to the same choices.

## Finding missing files: the relink dialog (S2-11) [REQ: FR-009]

**The line on the project home.** `src/renderer/screens/project-home/missing-files/`. With `missingCount` 0 it draws nothing. Otherwise: "{n} file(s) this project links to cannot be found." and a button "Find missing files…" that opens the relink dialog.

**The dialog.** `src/renderer/dialogs/relink-dialog/`. Props: `projectId`, `open`, `onClose()`, `onlyAssetIds?: string[]` (the package dialog passes the IDs it was refused for).

- Title "Find missing files".
- Checkbox "Also look for other missing files in the same folder", ticked at the start. It is `relinkSiblings`.
- A list labelled "Missing files": the assets from `asset.list { projectId }` with `missing: true` (only those in `onlyAssetIds` when given), sorted by display name. Each row: the display name as text, its kind as a word ("picture", "video", "font", "text file"), its library ("asset library" or "reference library"), and a button "Find…" (`aria-label` "Find {display name}").
- "Find…" sends `dialog.pickFiles { purpose: 'relink', kind }` (the asset's kind). A cancelled picker sends nothing. Then `asset.relink { projectId, assetId, newPath, relinkSiblings }`.
- One status line above the list (role `status`): after a success, "Found {display name}." and, when `siblingIds` is not empty, "{k} other file(s) in the same folder were found too." After a refusal, the command's message (role `alert`). Then the list is read again.
- Button "Close".

**States:** loading ("Looking for missing files…"); a list; empty ("No file is missing."); relinking (that row's button reads "Finding…", every Find button disabled, `closable` false); refused (status line, buttons enabled again).

**Focus:** the checkbox has focus on open. After a relink, focus goes to the next row's "Find…" button, or to "Close" when the list is empty.

## Package project (S2-12) [REQ: FR-008; D-027]

**The button.** `src/renderer/screens/project-home/package-project/`: a button "Package project…" that opens the dialog.

**The dialog.** `src/renderer/dialogs/package-dialog/`. Props: `projectId`, `open`, `onClose()`.

- Title "Package project". Description: "Adman copies the project file and every file it uses into one new folder that can be opened on another computer. The project you have open does not change."
- Button "Choose a folder and package…" (primary): `dialog.pickFolder { title: 'Choose where to put the package' }`. A cancelled picker sends nothing. Then `project.package { projectId, targetDir, skipMissing: false }`. The chosen folder is kept in the dialog's state for a second send and never drawn (A-48).
- Button "Cancel".

**States**

- **Ready:** as above.
- **Packaging:** "Packaging… Large projects take a while.", buttons disabled, `closable` false.
- **Done:** "The package is ready: {fileCount} file(s), {size}." (`size` from `totalBytes`, in KB, MB or GB with one decimal place), and, when `skippedAssetIds` is not empty, "{k} missing file(s) were left out." One button "Close".
- **Files missing** (`MISSING_FILE` with `details.assetIds`): "{n} file(s) cannot be found, so the package would not open with nothing missing." Then a list of their display names (from `asset.list`, matched by ID). Buttons:
  - "Find missing files…" opens the relink dialog with `onlyAssetIds`. When it closes, the dialog sends `project.package` again with the same folder and `skipMissing: false`.
  - "Package without them": `project.package` again with the same folder and `skipMissing: true`.
  - "Cancel".
- **Refused** (any other refusal, for example "A folder named {Name} is already there and not empty."): the message, and "Choose another folder…" in place of the primary button.

**Focus:** the primary button has focus on open and in each new state; "Close" when done.

## The brief form (S2-13, S2-14) [REQ: FR-020, FR-021, FR-023, FR-024, FR-026, FR-034]

Component `src/renderer/screens/project-home/brief-form/`, replacing the read-only `brief-summary/` (removed in S2-13). The pure model is `src/renderer/screens/project-home/brief-form-model.ts`. Agents never see this form [REQ: R-01].

**How it opens** (`brief-load/`):

- "Load a brief": as built (`dialog.pickFiles { purpose: 'brief' }`, then `brief.parse`). The form opens filled from the reply.
- "Type a brief" (S2-13): the form opens empty, with one empty subject row, the default sizes, and no language.
- While the form is open both buttons are hidden.

**The model** (`brief-form-model.ts`, pure, no React):

```ts
type SubjectChoice = {
  name: string
  description: string
  mode: 'new' | 'existing'
  newId: string                  // the ID a new subject gets
  existingId: string | null      // a subject the project holds
}
type BriefFormValues = {
  campaignName: string; region: string; audience: string; message: string
  offer: string; callToAction: string; tone: string
  subjects: SubjectChoice[]
  sizes: { readyMade: string[]; other: string; master: string | null }   // labels ticked; typed text; label of the master
  languages: string                                                     // typed, split on commas and spaces
  rules: { mode: 'words' | 'copy'; copyFrom: string | null
           requiredWords: Record<string, string>; prohibitedWords: Record<string, string> }  // language to text, one entry per line
  copy: BriefDraft['copy']       // carried through unchanged; not edited here
}
formFromDraft(reply: BriefParsed | null, heldSubjectIds: string[]): BriefFormValues
planFromForm(projectId: string, values: BriefFormValues, heldSubjectIds: string[]): CampaignPlan
```

- `formFromDraft` fills every field from the draft as the brief has it, nothing trimmed. Each subject: `newId` is the brief's `id` or one made from its name (`briefSubjectIds` in `campaign-input.ts`, unchanged); `mode` is `existing` with `existingId` that ID when the project holds it, else `new`. Sizes: each brief size read with `parseSize`; one equal to a ready-made size is ticked, any other goes into `other` as `{width}x{height}`, and text that cannot be read goes into `other` as typed. No brief size: the ready-made sizes picked by default. `master` is the first size. Languages: the brief's own joined with ", ", else `primaryLanguage`, else empty. Word lists: `wordsByLanguage` under each language, one word per line. `rules.mode` is `words`.
- `planFromForm` gives `{ ok: true, subjects, campaign }` (as today's `CampaignPlan`) or `{ ok: false, problems }`. Subjects with mode `new` become `subject.create` inputs (once per ID); every `subjectMap` entry has `create: false`, as built. The `brief` sent is the form's values: the seven texts (empty optional ones left out), `subjects` as `{ id, name, description }`, `languages`, `sizes` as `{width}x{height}` texts, `requiredWords` and `prohibitedWords` by language (empty lists left out), `copy` as carried. `sizes` puts the master first. `copyRuleSetFrom` is sent when `rules.mode` is `copy`; otherwise neither rule input is sent, so the rule set holds the brief's words. The whole input must pass the shared `campaignCreateInput` schema.
- **Problems**, each a line, in this order: "Enter the campaign name.", "Enter the region.", "Enter the audience.", "Enter the message." (each when blank after trimming); "Add at least one subject."; "Subject {i}: enter a name."; "Subject {i}: the ID "{id}" may hold only A-Z, a-z, 0-9, - and _, up to 64 letters."; "Subject {i}: the ID "{id}" is already in this project. Choose "Use a subject this project has", or another ID."; "Subjects {i} and {j} have the same ID."; "Subject {i}: choose a subject."; "Choose at least one size."; "The size "{text}" cannot be read."; "Give at least one language."; "Right-to-left languages are not supported yet." (from `isRightToLeft`); "Choose a campaign to copy the rules from."; then any schema issue's own message. `{i}` counts from 1.

**What the form shows** (region "Brief", heading "Brief"):

- **Campaign** (S2-13): text fields "Campaign name", "Region", "Audience", "Offer (optional)", "Call to action (optional)", "Tone (optional)", and a text area "Message" (shown and sent word for word). When the user leaves "Region" and "Languages" is empty, "Languages" is filled from `primaryLanguageFor(region)` when that finds one.
- **Subjects** (S2-13): a list labelled "Subjects". Each row is a group labelled "Subject {i}": "Name", "Description (optional)", and a radio pair "New subject" / "Use a subject this project has". New: a text field "Subject ID". Existing: a select of the project's subjects, "{name} ({id})". A row's "Remove" (`aria-label` "Remove subject {i}") is disabled when it is the only row. "Add subject" adds an empty row with mode `new`. An existing subject is used as stored; the brief keeps the typed name.
- **Sizes** (S2-13 shows them as one read-only line, "Sizes: {labels}"; S2-14 makes them editable): a fieldset "Sizes" with one checkbox per ready-made size, "{label} ({width}×{height})"; a text field "Other sizes" with the hint "Ratios or pixel sizes, separated by commas, for example 4:5 or 1200x628."; a select "Master size" listing the chosen sizes in order.
- **Languages** (read-only line in S2-13, a field in S2-14): text field "Languages", hint "Language tags such as en or fr-CA, separated by commas. The first is the campaign's main language."
- **Rules** (read-only line "Rules: the brief's word lists" in S2-13; S2-14): a fieldset "Rules" with a radio pair "Use these word lists" / "Copy the rules from another campaign". Words: for each language in the list, text areas "Required words ({language})" and "Prohibited words ({language})", one word or phrase per line. Copy: a select of the project's campaigns; with none, the radio is disabled and the line "This project has no other campaign." shows. A line under the fieldset: "Colours and required files are set after the campaign is made." (A-44)
- **Copy per language**, when the brief has it: a read-only line "Copy given for: {languages}". It is sent as it came.
- **Problems:** when `planFromForm` gives problems, a list under the heading "Before the campaign can be made" (`aria-live="polite"`).
- Buttons "Create campaign" (primary; disabled while there are problems or while creating) and "Cancel".

**What the buttons do**

- "Create campaign": `subject.create` for each new subject, then `campaign.create`; it stops at the first refusal, whose message shows in the banner (as built). "Creating the campaign…" while it runs; every field and button disabled. On success the form closes and `onCreated(campaignId)` opens the new campaign.
- "Cancel": the form closes and nothing is sent. Typed values are dropped without asking (A-51).

**Keyboard and focus:** fields in reading order. Enter in a one-line field does nothing (no form submit), so a stray Enter never creates a campaign. On open, focus goes to "Campaign name". After "Add subject", focus goes to the new row's "Name". After "Remove", focus goes to the "Add subject" button.

The read-only `brief-summary/` and the wording "What the brief lacks" go. Old cases move as listed in S2-13.

## The slot view (S2-15) [REQ: FR-042]

Component `src/renderer/screens/campaign/slot-view/`, on the campaign page below the variant grid. Props: `projectId`, `campaignId`. View only (A-46).

- Region "Slots", heading "Slots of the master".
- Reads `template.slots { projectId, campaignId }` on mount and again on `project.changed` for this project. Reads `asset.list { projectId, kind: 'image' }` for the candidates' names and pictures.
- One row per slot, in template order: the slot's name ("Background", "Subject picture", "Logo", "Headline", "Call to action"; any other slot ID shown as it is), then "Filled" or "Empty".
- An empty picture slot with candidates: "Pictures that could go here:" and, per candidate, a small picture (`assetUrl`, width `--layer-thumb`, `alt` its display name) with its display name as text. A candidate missing from `asset.list` is left out; one with `missing: true` shows "file not found" in place of its picture.
- **States:** loading ("Reading the slots…"); refused (the query's message); no slots ("This campaign's template has no slots."); done.
- No controls. Choosing a candidate comes with the Phase 3 picture chooser.

## The campaign grid and the variant tile (S2-16)

Replace the radio list `variant-list/` (removed). These are the parts Phase 3 builds on (`spec/editor.md`, "Navigation" and "Thumbnails on the screens"; slices P3-9, P3-10, P3-16).

**`src/renderer/screens/campaign/variant-grid/`**, component `VariantGrid`. Props: `variants: VariantSummary[]`, `chosenId: string | null`, `onChoose(variantId: string)`.

- A list `<ul aria-label="Variants">` laid out as a CSS grid: columns at least `--thumbnail-tile` wide, filling the row; gaps `--space-3`. One `<li>` per variant, holding a `VariantTile`, in `campaign.get` order (master first in its direction). One grid for the whole campaign; one grid per direction comes with Phase 5.
- No variants (a broken file): "This campaign has no variants."

**`src/renderer/screens/campaign/variant-tile/`**, component `VariantTile`. Props:

```ts
type VariantTileProps = {
  variant: VariantSummary
  chosen: boolean                          // the variant the panels below work on
  onChoose: (variantId: string) => void
  preview?: ReactNode                      // P3-16 passes <VariantThumbnail …/>; absent: the shape box
  actions?: ReactNode                      // P3-10 passes the "+" button; drawn beside the main button, never inside it
}
```

- **The main button** covers the tile (`type="button"`, `aria-pressed={chosen}`). A click, Enter or Space calls `onChoose(variant.id)`. Inside it, in order:
  1. **The picture area.** `preview` when given. Before thumbnails exist: a box in the variant's shape (inline `aspect-ratio: {width} / {height}`, which is data, not styling), filled with `--color-surface`, edged with `--color-border`, holding the text "{sizeLabel}" centred and "Video" under it for a video variant.
  2. **The title** as text.
  3. A line "{width}×{height} · {language} · {format}", and " · master" when `isMaster`.
  4. **Marks**, each a short word in a small box, only when true: `jobRunning` "Running", `resultUnseen` "New result", `overflow` "Text does not fit", `missingFile` "File missing", `translationUnapproved` "Translation not approved", `outOfDate` "Out of date", `checkWarning` "Check warning", `checkStale` "Not checked". The words come from one table, `variant-tile/badge-words.ts` (pure).
- **Chosen look:** the tile's edge in `--color-accent`, `--focus-ring-width` wide. The focus ring is drawn from the focus tokens, as everywhere.
- **Keyboard:** each tile is one stop in the tab order. Arrow keys are not used (A-47).

**The campaign page after S2-16** (`campaign-view/`): "Back to project"; the campaign name; `VariantGrid`; then the line "Runs and panels below are for: {title} · {sizeLabel} · {language}" for the chosen variant; then the slot view, Make pictures, Make a video and the run list, as built. The master is chosen at the start, as built.

**What Phase 3 changes** (not built here): P3-9 and P3-10 make a plain click open the variant's tab and add the "+" through `actions`; P3-16 passes the thumbnail through `preview`. How the overview's panels then choose their variant is Phase 3's to settle (`spec/editor.md`).

## Choices made without a design sign-off

The UI pass may change any of them.

- ComfyUI failures sit inside the run row, under the status line; the server's message opens in place under a heading.
- The address dialog replaces "Open Settings" for a run refused for lack of an address. "Open Settings" stays on a failed run whose reason is about the server.
- The licence dialog has the ruled sentence as its title, with no other text.
- The trial mark is the word "(trial)" after the provider's name.
- Import, relink and package are dialogs; their buttons sit on the project home in a "Files" and a "Package" section.
- Dropped files show a full-window layer with one line of text.
- The brief form is one long form on the project home, not a dialog or a separate page, with problems listed at its foot.
- The slot view is a plain list with small pictures, below the grid.
- Variant tiles are buttons in a grid of boxes in the variant's shape; the chosen one has an accent edge; marks are words.

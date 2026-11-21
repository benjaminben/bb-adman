# Screens: Phase 2 campaign screens and dialogs

The screens, dialogs and components of Phase 2's groups 4 and 5: ComfyUI failures and refusals on the campaign page, the address and commercial-licence dialogs, the trial mark, confirmed licences in Settings, import (by button and by dropping files), relink, package, the brief form, the slot view and the campaign grid. Read with `spec/screens.md` (rules for every screen, the other built screens, choices made without a design sign-off), `spec/structure.md` (one folder per component, one styling source) and `spec/api-commands.md` / `spec/api-queries-events.md` (the calls).

Built (slices S2-1 to S2-17; `spec/phases/phase-02-screens.md`). For built parts the code and its tests are the record of detail; this file keeps the wording, states, focus rules and limits.

## Rules for these screens

Built. Every rule in `spec/screens.md`, "Rules for every screen", holds. In addition:

- **Folders and styling.** Each component has its own folder with an `index.ts` and, when it has styles, its own CSS module. Every colour, space, radius, line width, type size and opacity comes from `src/renderer/ui/tokens.css`. Small text (the tile's marks and size line, the import dialog's hints) uses `--font-size-small`. A disabled button, field or select is drawn at `--opacity-disabled` by `base.css`. Components get their data through props or a store and do not reach into each other.
- **Dialogs** use `src/renderer/ui/dialog-frame/`: a Radix dialog with an overlay, a title, an optional description, and the content. On open, focus goes to the first control unless the dialog says otherwise. Escape and a click outside close it, except while a command it sent is waiting (`closable` false). On close, focus goes back to the control that opened it; when that control is gone (a drop), focus goes to the page's `h1`.
- **Refusals.** Every command goes through the app store's `command`, so a refusal also shows in the error banner. A dialog that sent the command shows the same message inside itself as well (role `alert`), because the banner is behind the dialog's overlay (A-50).
- **Paths.** The renderer draws no path. It shows a file's base name (the text after the last `/` or `\`) as text. A path is sent only to: `asset.import` (from `dialog.pickFiles`, `dialog.pickFolder`, or a dropped file through the drop bridge), `asset.relink` (from `dialog.pickFiles` with `purpose: 'relink'`), `project.package` (from `dialog.pickFolder`) and `brief.parse` (from `dialog.pickFiles` with `purpose: 'brief'`).
- **Counts in sentences** use the "(s)" form ("{n} file(s)"), so no sentence needs a plural rule.

## Shared pieces (S2-1, S2-2)

Built.

- **`src/shared/providers/messages.ts`** owns every sentence below that the main process or two screens use:
  - `checkMessage(outcome)`: the six Settings check sentences, with `{address}` left as a mark. `redirect_refused` has its Settings form: "The server tried to send Adman to another address. Adman did not follow." The run form in `reasonMessage` keeps "…, and the run was stopped." [F-12]
  - `fillMarks(text, { address?, n? })`: puts the address and the count into a sentence's `{address}` and `{n}` marks. A missing value leaves the sentence readable: an unknown address becomes "the saved address".
  - `licenceNotConfirmedMessage(model)`: "{model} requires a commercial license. Confirm that you have one first." (the command's refusal).
- **`src/renderer/ui/missing-item-text.ts`**: `missingItemText(item)` gives "Model {name}, in the folder {folder}" and the like, for Settings and the run row.
- **`src/renderer/ui/comfy-privacy.ts`**: the ComfyUI privacy paragraph. Shown in the Settings ComfyUI section and in the address dialog, nowhere else (A-42).
- **`src/renderer/screens/campaign/use-comfy-info.ts`**: the `useComfyInfo()` hook, for the video card, the panels' trial mark and the run row.

## Campaign page: ComfyUI failures in the run row (S2-5)

Built. Component `src/renderer/screens/campaign/run-failure/` (with `missing-items.ts`, `server-message.tsx`), drawn by `run-row/` under the status line of a `failed` row. Props: `row: JobRow`, `projectId`, `provider: ProviderInfo | undefined`, `providerLabel`. [REQ: FR-265, FR-266, FR-267, FR-069]

**What it shows**

1. **The sentence.** When `row.errorReason` is set: `fillMarks(reasonMessage(row.errorReason), { address, n })`, with `address` from `useComfyInfo()` and `n` the number of missing items (left out when there are none). Otherwise `plainMessage(row.errorKind ?? 'other', providerLabel)`.
2. **Missing items** (reason `missing_items`): a list labelled "What the server is missing", one `missingItemText(item)` per entry of `row.result.missing`. Each entry is checked against the `MissingItem` type by a small schema in `run-failure/missing-items.ts` (`MissingItem` in `src/shared/schemas/queries/app.ts` is a type only); an entry that fails is left out. The names come from the app's own workflow files.
3. **"Open Settings"** for the reasons `address_needed`, `no_answer`, `not_comfyui`, `sign_in_needed`, `redirect_refused`, `certificate`, `address_refused`. It calls the app store's `show({ kind: 'settings' })`. No other reason shows it.
4. **"Show the server's message"**, only when `provider?.serverText` is true. It sends the query `job.getServerMessage { projectId, jobId }` once and shows, under a heading "Message from the ComfyUI server", the reply's `text` in a `<pre>` block as text content. The button then reads "Hide the server's message" and hides the block without asking again. A null `text`: "The server sent no message for this run." A refused query: its message in the block.

The run row's own "Retry" stays where it is, so every failure sentence has Retry beside it.

**States:** before `comfy.getInfo` answers, the address mark reads "the saved address"; after, the address. Loading the server's message: "Reading the server's message…" in the block (role `status`), the button disabled.

**Never:** the server text set as HTML, turned into a link, or parsed. A reply holding `<a href="…">x</a>` shows those characters.

**Keyboard and focus:** both buttons are plain buttons in tab order after Retry. "Show the server's message" has `aria-expanded` and `aria-controls` naming the block.

**The confirm count on Retry (FN-4).** For an `image_generation` row, the paid confirm line of Retry shows `picturesLeft(requestCount(row), row.result)` (`src/shared/generation/pictures-left.ts`), the number `job.retry` will ask for. Other rows keep `requestCount(row)`. A ComfyUI run asks for no paid confirm (ComfyUI's `local` is true).

## The address dialog (S2-6)

Built. Component `src/renderer/dialogs/address-dialog/`, mounted once in the app shell beside the key dialog. [REQ: FR-255; `spec/api-principles.md`, "NEEDS_KEY", last paragraph]

**When it opens.** The app store's `command` sends `generation.runImages`, `generation.startVideo` or `job.retry`, and the reply is `RULE_VIOLATION` with `details.reason` `comfy_address_needed`. The store sets `addressRequest` and waits. Which refusal of which command opens which dialog is in `src/renderer/stores/run-asks.ts` (pure). No other command opens it.

**What it shows**

- Title "Enter your ComfyUI server's address".
- The privacy paragraph from `ui/comfy-privacy.ts`, as the dialog's description.
- A text field "Server address", hint "For example http://127.0.0.1:8188". Empty at the start. `autoComplete` off, `spellCheck` false.
- Buttons "Cancel" and "Save and continue" (primary, the form's submit; Enter in the field submits).

**What each control does**

- "Save and continue" sends `comfy.setAddress { address }` with the typed text. A refusal shows its own sentence under the field (role `alert`, named in the field's `aria-describedby`), focus goes back to the field, and the dialog stays open. On success the dialog closes and the store sends the first command again with the same input.
- "Cancel" (and Escape) closes it. The store returns the first refusal to the caller and does not put it in the error banner. Nothing is sent again.

**States:** open with an empty field; saving ("Saving…" on the primary button, both buttons disabled, `closable` false; the field stays enabled); refused (sentence under the field); closed.

**Focus:** the field has focus on open. Tab order: field, Cancel, Save and continue.

## The commercial-licence dialog (S2-6) [D-088]

Built. Component `src/renderer/dialogs/licence-dialog/` (with `licence-choices.tsx`), mounted once in the app shell. The rule and its main-process half are in `spec/comfyui-workflows.md`, "Commercial-licence dialog".

**When it opens.** The app store's `command` sends `generation.runImages`, `generation.startVideo` or `job.retry`, and the reply is `INVALID_INPUT` with `details.reason` `licence_not_confirmed` and a text `details.workflow`. The store sets `licenceRequest` and waits. This is the window's only licence check: the main process alone decides which workflow a run uses, and it refuses before any job row (A-40).

**What it shows**

- The model's name `{model}` is the workflow's `model.label` from `comfy.getInfo`, found by `details.workflow`. The dialog opens once that query has answered. If the query fails or the workflow is not listed, `{model}` is "This model".
- Title, word for word: "{model} requires a commercial license, please confirm that you have one before production use".
- A checkbox "don't show again for {model}", not ticked at the start. With "This model" there is no checkbox, since that is no name the main process could match.
- Buttons "Cancel" and "Confirm" (primary).

**What each control does**

- "Confirm" answers the store. If the box is ticked, the store first sends `settings.update { licenceConfirmed }` with the current list from `app.getState` plus `{model}` (no duplicates); meanwhile the dialog shows "Saving…" on Confirm, with the box and both buttons disabled and `closable` false. Then the dialog closes, and the store sends the first command again with the same input plus `licenceConfirmed: true`. A refused `settings.update` is shown in the banner after the run is sent; the run is still sent, since the user confirmed. If the run is then refused, the run's refusal takes the banner.
- "Cancel" (and Escape) closes it. Nothing is sent; the store returns the refusal without the banner.

**Focus:** the checkbox has focus on open; with no checkbox, "Cancel". Tab order: checkbox, Cancel, Confirm.

## Asking once per call (S2-6)

Built. `src/renderer/stores/app-store.ts`. The store asks each kind of dialog, address and licence, at most once per call to `command`. So one call may ask for the address, send again, and then ask for the licence. A refusal of a kind already asked in that call goes to the banner. The key dialog for `NEEDS_KEY` keeps its own rule (`spec/screens.md`, "Key dialog"). `comfy.check`, `asset.import` and every other command open neither dialog.

## The trial mark in the panels (S2-7)

Built. When the chosen provider is ComfyUI and the workflow that `comfy.getInfo` marks `offered` for the run the panel would start has status `trial`, the word "(trial)" shows beside the provider select. [REQ: FR-254]

- Make pictures: the job is `image` with no ticked reference, `image_refs` with one or more.
- Make a video: the job is `video` and the workflow's `videoStart` equals the chosen start's pair (`video-start.ts`).
- `src/renderer/screens/campaign/offered-workflow.ts`, `offeredFor(info, job, pair?)`, finds it. Before `comfy.getInfo` answers, no mark.
- Both panels draw their provider choice through `src/renderer/screens/campaign/provider-select/` (props: `label`, `providers`, `value`, `onChange`, `trial: boolean`), so the mark has one owner. The mark is a separate text after the select and is the select's `aria-describedby`. The option's own name stays "ComfyUI" and the field's label stays "Provider": the existing tests and the end-to-end helpers in `tests/e2e/screens.ts` pick an option by its exact name.

## Settings: confirmed licences (S2-8)

Built. Component `src/renderer/screens/settings/licence-list/`, mounted inside `comfy-section/` below the check result. [D-088]

- Heading (level 3) "Licences you confirmed".
- One row per name in `app.getState`'s `settings.licenceConfirmed`, in saved order: the name as text and a button "Forget" (`aria-label` "Forget {model}"). It sends `settings.update { licenceConfirmed }` with that name removed. The next run of that model shows the dialog again.
- Empty: "You have not confirmed a commercial license for any model."
- A refusal shows in the banner and as a line under the list. While a Forget is sent, every Forget button is disabled.

## Project home

Built. The layout, top to bottom, inside the page (heading, "Close project", file path):

1. "Campaigns": the campaign list (`campaign-list/`). Each row: a box holding the campaign's cover thumbnail (the master of its first direction; alt "Cover of {name}"; the box stays empty when there is no cover), the name as text, "Variants: {n}", and "Open". How thumbnails are drawn: `spec/editor.md`, "Thumbnails on the screens".
2. "Start a campaign": `brief-load/` ("Load a brief" and "Type a brief"), and the brief form when one is open.
3. "Files": `import-files/` ("Import files…", "Import a folder…") and `missing-files/` (the missing-file line).
4. "Package": `package-project/` ("Package project…").
5. `drop-import/`: draws nothing until files are dragged over the window.

Props: `ImportFiles { projectId, subjects: SubjectRow[] }`, `MissingFiles { projectId, missingCount: number }`, `PackageProject { projectId }`, `DropImport { projectId, projectName, subjects: SubjectRow[] }`. `missingCount` is `project.get`'s `missingAssetCount`; it is current because the page reads `project.get` again on `project.changed`.

While a campaign is open, the campaign page takes the place of sections 1 to 4. `drop-import/` stays mounted.

**After "Create campaign"** the new campaign opens (A-45): `BriefLoad` gets `onCreated(campaignId)` from the page.

## The import dialog (S2-9) [REQ: FR-050, FR-052, FR-053, FR-054, FR-246]

Built. Component `src/renderer/dialogs/import-dialog/` (with `import-choices.tsx`, `import-text.ts`, `animated-names.ts`). Props: `projectId`, `open`, `paths: string[]`, `folder: boolean` (the one path is a folder), `subjects: SubjectRow[]`, `onClose()`. Opened by `import-files/` and by `drop-import/`, each with its own instance. Every close resets it.

**What it shows**

- Title: "Import {n} file(s)"; for a folder, "Import a folder".
- A list labelled "Files to import": each path's base name as text, at most 10, then "and {k} more". It stays in every state.
- "Put them in" (radio group): "Asset library (can go on a post)", chosen at the start; "Reference library (only to guide AI pictures)".
- Checkbox "Copy into the project's assets folder", not ticked at the start. Hint under it: "Not ticked: the files stay where they are, and the project links to them."
- "Attach to a subject" (select): "No subject" first and chosen at the start, then each project subject as "{name} ({id})".
- Buttons "Cancel" and "Import" (primary).

**What each control does**

- "Import" sends `asset.import { projectId, paths, library, copy, subjectId? }` (`subjectId` left out for "No subject").
- "Cancel" (and Escape) closes; nothing is sent.

**States**

- **Choosing:** as above.
- **Importing:** the line "Importing…" (role `status`), every choice and both buttons disabled, `closable` false.
- **Refused:** the command's message inside the dialog (role `alert`); the choices stay; "Import" works again.
- **Done:** the choices are replaced by a list labelled "Import result", each line only when its number is not 0:
  - "{a} file(s) added." (`a` = IDs in `assetIds`, each once, that are not in `reusedAssetIds`)
  - "{r} file(s) were already in the project and were kept as they were." (`r` = `reusedAssetIds.length`)
  - "{s} item(s) in the folder were skipped: links, hidden files, and files Adman cannot use." (`s` = `skippedCount`)
  - All three 0: "Nothing was imported. The folder holds no file Adman can use."
  - One line per ID in `animatedAssetIds` (S2-17): "{name} holds an animation. Adman uses its first picture.", the display name from `asset.list`. A name not found, or a refused `asset.list`, reads "A file holds an animation. Adman uses its first picture." No query is sent when the list is empty.
  - One button "Done" closes the dialog.

**Focus:** the first radio has focus on open; "Done" has focus once the result shows.

### Import buttons (S2-9)

Built. `src/renderer/screens/project-home/import-files/`:

- "Import files…": `dialog.pickFiles { purpose: 'import', multiple: true }`, then the dialog with the picked paths, `folder: false`.
- "Import a folder…": `dialog.pickFolder { title: 'Choose a folder to import' }`, then the dialog with `[path]`, `folder: true`.
- A cancelled picker sends nothing and opens nothing.

## Importing by dropping files (S2-3, S2-10) [REQ: FR-246]

**The drop bridge (Built, S2-3, security class).** The sandboxed window cannot read a dropped file's path. The preload adds one more object beside `window.api`: `window.drop = { pathOf(file: File): string }`, which calls Electron's `webUtils.getPathForFile(file)` and returns its answer: the full path for a file or folder from the system, and `''` for a `File` the page made itself. Type `DropApi` in `src/shared/schemas/drop-api.ts`; `src/renderer/env.d.ts` declares it. The renderer reads it only through `src/renderer/ui/dropped-paths.ts`: `droppedPaths(files: FileList): string[]`, which leaves out empty answers. `asset.import` checks a dropped path exactly as a picked one (A-43).

**The drop target (Built, S2-10).** `src/renderer/screens/project-home/drop-import/` (with `use-file-drop.ts`), mounted by the project page of the shown project.

- While mounted it listens on `window` for `dragenter`, `dragover`, `dragleave`, `drop` and `keydown`. For a drag whose `dataTransfer.types` holds `Files`, `dragover` calls `preventDefault()` and sets `dropEffect` to `copy`. Any other drag is left alone. The listeners go on unmount.
- While files are dragged over the window, a layer covers the window (`position: fixed`, the `--color-overlay` token, `pointer-events: none`) with the text "Drop to import into {project name}". It goes when the drag leaves the window, on `drop`, and on Escape.
- On `drop`: `preventDefault()`, then `droppedPaths(event.dataTransfer.files)`. With no path, nothing happens. Otherwise the import dialog opens with those paths (`folder: false`; a dropped folder is fine, since `asset.import` opens folders) and the subjects. A drop never imports by itself: the user presses "Import".
- While this page's drop dialog is open, a new drag shows no layer and a new drop is ignored.
- Dropping on the Start screen or on Settings does nothing: no project page is mounted there, and the main process blocks the page from opening the file.
- **Keyboard:** dropping has no keyboard form; "Import files…" and "Import a folder…" are the keyboard path to the same choices.

## Finding missing files: the relink dialog (S2-11) [REQ: FR-009]

Built.

**The line on the project home.** `src/renderer/screens/project-home/missing-files/`. With `missingCount` 0 it draws nothing. Otherwise: "{n} file(s) this project links to cannot be found." and a button "Find missing files…" that opens the relink dialog. The dialog stays open when the last file is found, though the line goes.

**The dialog.** `src/renderer/dialogs/relink-dialog/` (with `relink-body.tsx`, `missing-row.tsx`, `use-missing-assets.ts`). Props: `projectId`, `open`, `onClose()`, `onlyAssetIds?: string[]` (the package dialog passes the IDs it was refused for). Its content mounts afresh at each open, so the list is read again and the box ticked again.

- Title "Find missing files".
- Checkbox "Also look for other missing files in the same folder", ticked at the start. It is `relinkSiblings`.
- A list labelled "Missing files": the assets from `asset.list { projectId }` with `missing: true` (only those in `onlyAssetIds` when given), sorted by display name. Each row: the display name as text, then its kind and library as words ("picture", "video", "font" or "text file"; "asset library" or "reference library"), and a button "Find…" (`aria-label` "Find {display name}").
- "Find…" sends `dialog.pickFiles { purpose: 'relink', kind }` (the asset's kind). A cancelled picker sends nothing. Then `asset.relink { projectId, assetId, newPath, relinkSiblings }`, and the list is read again.
- A line above the list: after a success, "Found {display name}." and, when `siblingIds` is not empty, " {k} other file(s) in the same folder were found too." (role `status`). After a refusal, the command's message (role `alert`). A refused `asset.list` shows its message (role `alert`) and the list reads as empty.
- Button "Close".

**States:** loading ("Looking for missing files…"); a list; empty ("No file is missing."); relinking (that row's button reads "Finding…", every Find button and Close disabled, `closable` false); refused (the line, buttons enabled again).

**Focus:** the checkbox has focus on open. After a relink, focus goes to the "Find…" of the next row after the relinked one that is still missing, else of the first row left, else to "Close". After a refused relink, focus goes back to that row's "Find…".

## Package project (S2-12) [REQ: FR-008; D-027]

Built.

**The button.** `src/renderer/screens/project-home/package-project/`: a button "Package project…" that opens the dialog.

**The dialog.** `src/renderer/dialogs/package-dialog/` (with `package-body.tsx`, `use-package.ts`, `file-size.ts`). Props: `projectId`, `open`, `onClose()`. Its content mounts afresh at each open, so each open starts ready with no folder kept.

- Title "Package project". Description: "Adman copies the project file and every file it uses into one new folder that can be opened on another computer. The project you have open does not change."
- Buttons "Cancel" and "Choose a folder and package…" (primary): `dialog.pickFolder { title: 'Choose where to put the package' }`. A cancelled picker sends nothing. Then `project.package { projectId, targetDir, skipMissing: false }`. The chosen folder is kept in the dialog's state for a second send and never drawn (A-48).

**States**

- **Ready:** as above.
- **Packaging:** the line "Packaging… Large projects take a while." (role `status`) above the last view, which stays on screen with its buttons disabled; `closable` false.
- **Done:** "The package is ready: {fileCount} file(s), {size}." and, when `skippedAssetIds` is not empty, " {k} missing file(s) were left out." One button "Close". `size` comes from `totalBytes` through `fileSize`: KB, MB or GB, 1 KB = 1024 bytes, one decimal place; a value that would read 1024.0 of one unit is shown in the next.
- **Files missing** (`MISSING_FILE` with `details.assetIds`): "{n} file(s) cannot be found, so the package would not open with nothing missing." Then a list labelled "Missing files" of their display names (from `asset.list`, matched by ID, sorted; an ID not listed is left out). Three choices, stacked:
  - "Find missing files…" (primary) opens the relink dialog with `onlyAssetIds`. When it closes, the dialog sends `project.package` again with the same folder and `skipMissing: false`.
  - "Package without them": `project.package` again with the same folder and `skipMissing: true`.
  - "Cancel".
- **Refused** (any other refusal, for example "A folder named {Name} is already there and not empty."): the message (role `alert`), and "Choose another folder…" in place of the primary button.

**Focus:** the primary button has focus on open and in each new view: "Choose a folder and package…", "Find missing files…", "Choose another folder…", or "Close" when done.

## The brief form (S2-13, S2-14) [REQ: FR-020, FR-021, FR-023, FR-024, FR-026, FR-034]

Built. Component `src/renderer/screens/project-home/brief-form/` (with `campaign-fields.tsx`, `language-field.tsx`), using `subject-rows/`, `size-fields/` and `rule-fields/` (with `word-lists.tsx`). The pure model is `src/renderer/screens/project-home/brief-form-model.ts`, with `brief-form-problems.ts` (the problem lines, the row IDs, the schema check) and `brief-form-sizes.ts`. Agents never see this form [REQ: R-01].

**How it opens** (`brief-load/`):

- "Load a brief": `dialog.pickFiles { purpose: 'brief' }`, then `brief.parse`. The form opens filled from the reply. A refused `brief.parse` shows in the banner and opens nothing.
- "Type a brief": the form opens empty, with one empty subject row, the default sizes, and no language.
- While the form is open both buttons are hidden.

**The model** (pure, no React):

```ts
type SubjectChoice = {
  name: string
  description: string
  mode: 'new' | 'existing'
  newId: string                  // the ID a new subject gets; blank: made from the name
  existingId: string | null      // a subject the project holds
}
type BriefFormValues = {
  campaignName: string; region: string; audience: string; message: string
  offer: string; callToAction: string; tone: string
  subjects: SubjectChoice[]
  sizes: { readyMade: string[]; other: string; master: string | null }   // labels ticked, in tick order; typed text; label of the master
  languages: string                                                     // typed, split on commas and spaces
  rules: { mode: 'words' | 'copy'; copyFrom: string | null
           requiredWords: Record<string, string>; prohibitedWords: Record<string, string> }  // language to text, one entry per line
  copy: BriefDraft['copy']       // carried through unchanged; not edited here
}
formFromDraft(reply: BriefParsed | null, heldSubjectIds: string[]): BriefFormValues
planFromForm(projectId: string, values: BriefFormValues, heldSubjectIds: string[]): CampaignPlan
```

- `formFromDraft` fills every field from the draft as the brief has it, nothing trimmed. Each subject: `newId` is the brief's `id` or one made from its name (`briefSubjectIds` in `campaign-input.ts`); `mode` is `existing` with `existingId` that ID when the project holds it, else `new`. Sizes: each brief size read with `parseSize`; one equal to a ready-made size is ticked, any other goes into `other` as `{width}x{height}`, and text that cannot be read goes into `other` as typed. No brief size: the ready-made sizes picked by default. `master` is the first size that can be read. Languages: the brief's own joined with ", ", else `primaryLanguage`, else empty. Word lists: through `wordsByLanguage`, one word per line; a plain list with no language is kept under the main language. `rules.mode` is `words`.
- **Row IDs** (`subjectIds`): a chosen project subject's ID, or the typed "Subject ID". A new row with a blank "Subject ID" and a name gets an ID made from the name with `briefSubjectIds`, stepping around the other rows' IDs; the field shows that ID as its placeholder. A blank ID with a blank name stays blank, so only the name line shows for it. The bad-ID line never shows for a blank ID.
- `planFromForm` gives `{ ok: true, subjects, campaign }` or `{ ok: false, problems }`. Rows with mode `new` become `subject.create` inputs; every `subjectMap` entry has `create: false`. The `brief` sent is the form's values: the seven texts (blank optional ones left out), `subjects` as `{ id, name, description }`, `languages`, `sizes` as `{width}x{height}` texts, `requiredWords` and `prohibitedWords` by language, `copy` as carried. Word lists are sent only for the languages in the list, blank lines and empty lists left out. `sizes` puts the master first. `copyRuleSetFrom` is sent when `rules.mode` is `copy`; otherwise neither rule input is sent, so the rule set holds the brief's words. The whole input must pass the shared `campaignCreateInput` schema (template `starter`).
- **Problems**, each a line, in this order; each kind of subject problem runs over every row before the next kind: "Enter the campaign name.", "Enter the region.", "Enter the audience.", "Enter the message." (each when blank after trimming); "Add at least one subject."; "Subject {i}: enter a name."; "Subject {i}: the ID "{id}" may hold only A-Z, a-z, 0-9, - and _, up to 64 letters."; "Subject {i}: the ID "{id}" is already in this project. Choose "Use a subject this project has", or another ID."; "Subjects {i} and {j} have the same ID." (`{i}` the first row with that ID; typed, made and chosen IDs all count, so the same project subject in two rows is a problem); "Subject {i}: choose a subject."; "Choose at least one size." (nothing ticked or typed); "The size "{text}" cannot be read."; "Give at least one language."; "Right-to-left languages are not supported yet." (from `isRightToLeft`); "Choose a campaign to copy the rules from.". Only when none of these remain, any schema issue's own message, each once. `{i}` counts from 1.

**What the form shows** (a region labelled by its level-3 heading "Brief"):

- **Campaign:** text fields "Campaign name", "Region", "Audience", "Offer (optional)", "Call to action (optional)", "Tone (optional)", and a text area "Message" (shown and sent word for word). When the user leaves "Region" and "Languages" is empty, "Languages" is filled from `primaryLanguageFor(region)` when that finds one.
- **Subjects:** a list labelled "Subjects". Each row is a group "Subject {i}": "Name", "Description (optional)", and a radio pair "New subject" / "Use a subject this project has" (the second disabled when the project has no subject). New: a text field "Subject ID". Existing: a select "Project subject", first "Choose a subject", then the project's subjects as "{name} ({id})"; choosing the radio picks the subject whose ID the row's "Subject ID" names, when the project has it. A row's "Remove" (`aria-label` "Remove subject {i}") is disabled when it is the only row. "Add subject" adds an empty row with mode `new`. An existing subject is used as stored; the brief keeps the typed name.
- **Sizes:** a fieldset "Sizes" with one checkbox per ready-made size, "{label} ({width}×{height})"; a ticked box goes to the end of the chosen order. A text field "Other sizes" with the hint "Ratios or pixel sizes, separated by commas, for example 4:5 or 1200x628." A select "Master size" listing the chosen sizes that can be read, in order, each as "{label} ({width}×{height})" for a ready-made size and "{width}×{height}" for any other; disabled when there is none. The chosen master stays while it is still chosen, else the first size is the master.
- **Languages:** text field "Languages", hint "Language tags such as en or fr-CA, separated by commas. The first is the campaign's main language."
- **Rules:** a fieldset "Rules" with a radio pair "Use these word lists" / "Copy the rules from another campaign". Words: for each language in the list, text areas "Required words ({language})" and "Prohibited words ({language})", one word or phrase per line. Copy: a select "Campaign to copy from", first "Choose a campaign", then the project's campaigns by name. With no campaign the copy radio is disabled and the line "This project has no other campaign." shows. A line under the fieldset: "Colours and required files are set after the campaign is made." (A-44)
- **Copy per language**, when the brief has it: a read-only line "Copy given for: {languages}". It is sent as it came.
- **Problems:** when `planFromForm` gives problems, a list under the level-4 heading "Before the campaign can be made", inside an `aria-live="polite"` region. With no problems the box is not drawn and takes no space.
- Buttons "Create campaign" (primary; disabled while there are problems) and "Cancel".

**What the buttons do**

- "Create campaign": `subject.create` for each new subject, then `campaign.create`; it stops at the first refusal, whose message shows in the banner. "Creating the campaign…" while it runs; every field and button is disabled (one fieldset). On success the form closes and `onCreated(campaignId)` opens the new campaign.
- "Cancel": the form closes and nothing is sent. Typed values are dropped without asking (A-51).

**Keyboard and focus:** fields in reading order. The form is not an HTML form, so Enter in a one-line field sends nothing and a stray Enter never creates a campaign. On open, focus goes to "Campaign name". After "Add subject", focus goes to the new row's "Name". After "Remove", focus goes to "Add subject".

## The slot view (S2-15) [REQ: FR-042]

Built. Component `src/renderer/screens/campaign/slot-view/` (with `use-slots.ts`), on the campaign page below the variant grid and above the picture panel. Props: `projectId`, `campaignId`. View only (A-46).

- Region "Slots", level-3 heading "Slots of the master"; the rows are a list labelled "Slots of the master".
- Reads `template.slots { projectId, campaignId }` on mount and again on `project.changed` for this project; a reply older than the newest read is dropped. Reads `asset.list { projectId, kind: 'image' }` for the candidates' names and pictures, only when an empty picture slot has candidates.
- One row per slot, in template order: the slot's name ("Background", "Subject picture", "Logo", "Headline", "Call to action"; any other slot ID shown as it is), then "Filled" or "Empty".
- An empty picture slot with candidates: "Pictures that could go here:" and, per candidate, a small picture (`assetUrl`, a `--layer-thumb` square, `alt` its display name) with its display name as text (hidden from screen readers, since the `alt` says it). A candidate missing from `asset.list` is left out; one with `missing: true` shows "file not found" in place of its picture.
- **States:** loading ("Reading the slots…"); refused (the query's message); no slots ("This campaign's template has no slots."); done.
- No controls. Choosing a candidate comes with the Phase 3 picture chooser.

## The campaign grid and the variant tile (S2-16)

Built. They replace the old radio list (`variant-list/` is gone). These are the parts Phase 3 builds on (`spec/editor.md`, "Navigation" and "Thumbnails on the screens"; slices P3-9, P3-10, P3-16).

**`src/renderer/screens/campaign/variant-grid/`**, component `VariantGrid`. Props: `projectId?: string`, `variants: VariantSummary[]`, `chosenId: string | null`, `onChoose(variantId: string)`, `onOpenBehind?(variantId: string)`.

- A list `<ul aria-label="Variants">` laid out as a CSS grid: columns at least `--thumbnail-tile` wide, filling the row; gaps `--space-3`. One `<li>` per variant, holding a `VariantTile`, in `campaign.get` order (master first in its direction). One grid for the whole campaign; one grid per direction comes with Phase 5.
- With `projectId`, each tile's `preview` is the variant's drawn thumbnail (`VariantThumbnail`, alt empty, since the tile's text names the variant).
- With `onOpenBehind`, each tile's `actions` is a small "+" button, label "Open {title} in a tab", that opens the variant's tab behind the overview.
- No variants (a broken file): "This campaign has no variants."

**`src/renderer/screens/campaign/variant-tile/`**, component `VariantTile`. Props:

```ts
type VariantTileProps = {
  variant: VariantSummary
  chosen: boolean                          // the variant the panels below work on
  onChoose: (variantId: string) => void
  preview?: ReactNode                      // the grid passes <VariantThumbnail …/>; absent: the shape box
  actions?: ReactNode                      // the grid passes the "+" button; drawn beside the main button, never inside it
}
```

- **The main button** covers the tile (`type="button"`, `aria-pressed={chosen}`). A click, Enter or Space calls `onChoose(variant.id)`. Inside it, in order:
  1. **The picture area.** `preview` when given. Otherwise a box in the variant's shape (inline `aspect-ratio: {width} / {height}`, which is data, not styling), filled with `--color-surface`, edged with `--color-border`, holding the text "{sizeLabel}" and "Video" under it for a video variant.
  2. **The title** as text.
  3. A line "{width}×{height} · {language} · {format}", and " · master" when `isMaster`.
  4. **Marks**, each a short word in a small box, only when true: `jobRunning` "Running", `resultUnseen` "New result", `overflow` "Text does not fit", `missingFile` "File missing", `translationUnapproved` "Translation not approved", `outOfDate` "Out of date", `checkWarning` "Check warning", `checkStale` "Not checked". The words come from one table, `variant-tile/badge-words.ts` (pure).
- **Chosen look:** the tile's edge in `--color-accent`, `--focus-ring-width` wide. The focus ring is drawn from the focus tokens, as everywhere.
- **Keyboard:** each tile is one stop in the tab order. Arrow keys are not used (A-47).

**The campaign page** (`campaign-view/`): "Back to project"; the campaign name; `VariantGrid` (given `projectId` and `onOpenBehind`); the line "Runs and panels below are for: {title} · {sizeLabel} · {language}" for the chosen variant; the slot view; Make pictures; Make a video; the run list. The master is chosen at the start.

**Phase 3 additions** (built, P3-9, P3-10, P3-16): a plain click on a tile opens the variant's tab; the "+" opens it behind; the tiles show thumbnails. The rules for tabs and thumbnails are in `spec/editor.md`, "Variant tabs" and "Thumbnails on the screens".

## Choices made without a design sign-off

The UI pass may change any of them.

- ComfyUI failures sit inside the run row, under the status line; the server's message opens in place under a heading.
- The address dialog replaces "Open Settings" for a run refused for lack of an address. "Open Settings" stays on a failed run whose reason is about the server.
- The licence dialog has the ruled sentence as its title, with no other text.
- The trial mark is the word "(trial)" beside the provider select.
- Import, relink and package are dialogs; their buttons sit on the project home in a "Files" and a "Package" section.
- The package dialog's three choices for missing files are stacked, the main one first.
- Dropped files show a full-window layer with one line of text.
- The brief form is one long form on the project home, not a dialog or a separate page, with problems listed at its foot.
- The slot view is a plain list with small pictures, below the grid.
- Variant tiles are buttons in a grid of boxes in the variant's shape; the chosen one has an accent edge; marks are words.

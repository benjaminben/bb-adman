# Screens: project and campaign screens and dialogs

The screens, dialogs and components of the project home and the campaign page: ComfyUI failures and refusals, the address and commercial-licence dialogs, the trial mark, confirmed licences in Settings, the project home's parts, the Assets panel and subject cards, import (by button and by dropping files), relink, package, the brief form, the campaign head and its tab strip, the Checks and Translations tabs, reports, export, publish and the approval link. Read with `spec/screens.md` (rules for every screen, the shell, Settings, choices made without a design sign-off), `spec/screens-variants.md` (the Variants tab and its dialogs), `spec/structure.md` (one folder per component, one styling source) and `spec/api-commands.md` / `spec/api-queries-events.md` (the calls).

Built (slices S2-1 to S2-17, Round 2, then the design wave, `spec/phases/design-wave.md`). For built parts the code and its tests are the record of detail; this file keeps the wording, states, focus rules and limits.

## Rules for these screens

Built. Every rule in `spec/screens.md`, "Rules for every screen", holds. In addition:

- **Folders and styling.** Each component has its own folder with an `index.ts` and, when it has styles, its own CSS module. Every colour, space, radius, line width, type size and opacity comes from `src/renderer/ui/tokens.css`. Small text uses `--font-size-small`. A disabled button, field or select is drawn at `--opacity-disabled` by `base.css`. Components get their data through props or a store and do not reach into each other. Shared parts are in `src/renderer/ui/` (`spec/app-style-parts.md`).
- **Dialogs** use `src/renderer/ui/dialog-frame/` with a `kind` (`form`, `run`, `confirm`, `pick`, `review`, `publish`; `spec/app-style-parts.md`, "Dialog"): a Radix dialog with an overlay, a title, an optional description or `warning`, the content and a foot. On open, focus goes to the first control unless the dialog says otherwise. Escape and a click outside close it, except while a command it sent is waiting (`closable` false). On close, focus goes back to the control that opened it; when that control is gone (a drop), focus goes to the page's `h1`.
- **Refusals.** Every command goes through the app store's `command`, so a refusal also shows in the error banner. A dialog that sent the command shows the same message inside itself as well (a danger DialogAlert or `role="alert"` line), because the banner is behind the dialog's overlay (A-50).
- **Paths.** The renderer draws no asset path, with the one exception of the publish dialog's file list (A-218, below). It shows a file's base name (the text after the last `/` or `\`) as text. A path is sent only to: `asset.import` (from `dialog.pickFiles`, `dialog.pickFolder`, or a dropped file through the drop bridge), `asset.relink` (from `dialog.pickFiles` with `purpose: 'relink'`), `project.package` and `export.run` (from `dialog.pickFolder`) and `brief.parse` / `brief.extract` (from `dialog.pickFiles` with `purpose: 'brief'`).
- **Counts in visible words** use real plurals through `ui/plural.ts` ("1 file", "2 files").

## Shared pieces (S2-1, S2-2)

Built.

- **`src/shared/providers/messages.ts`** owns every sentence below that the main process or two screens use:
  - `checkMessage(outcome)`: the six Settings check sentences, with `{address}` left as a mark. `redirect_refused` has its Settings form: "The server tried to send Adman to another address. Adman did not follow." The run form in `reasonMessage` keeps "…, and the run was stopped." [F-12]
  - `fillMarks(text, { address?, n? })`: puts the address and the count into a sentence's `{address}` and `{n}` marks. A missing value leaves the sentence readable: an unknown address becomes "the saved address".
  - `licenceNotConfirmedMessage(model)`: "{model} requires a commercial license. Confirm that you have one first." (the command's refusal).
- **`src/renderer/ui/missing-item-text.ts`**: `missingItemText(item)` gives "Model {name}, in the folder {folder}" and the like, for Settings and the run failure.
- **`src/renderer/ui/comfy-privacy.ts`**: the ComfyUI privacy paragraph. Shown in the Settings ComfyUI section and in the address dialog, nowhere else (A-42).
- **`src/renderer/screens/campaign/use-comfy-info.ts`**: `useComfyInfo()` and `useComfyInfoState()`, for the run dialog, the Generate panel, fan-out and the run failure.

## ComfyUI failures: the run failure (S2-5)

Built. Component `src/renderer/ui/run-failure/` (with `missing-items.ts`, `server-message.tsx`), drawn under a failed run wherever one shows: the Activity row, an earlier-options row, the Generate panel's run state, copy options and the brief reading dialog. Props: `row: JobRow`, `projectId`, `provider: ProviderInfo | undefined`, `providerLabel` (the caller passes the provider and model words from `useRunName`, `spec/providers.md`, "Model words", so a sentence reads "Google Gemini · Nano Banana 2.1 took too long to answer. Try again."). [REQ: FR-265, FR-266, FR-267, FR-069]

**What it shows**

1. **The sentence.** When `row.errorReason` is set: `fillMarks(reasonMessage(row.errorReason), { address, n })`, with `address` from `useComfyInfo()` and `n` the number of missing items (left out when there are none). Otherwise `plainMessage(row.errorKind ?? 'other', providerLabel)`.
2. **Missing items** (reason `missing_items`): a list labelled "What the server is missing", one `missingItemText(item)` per entry of `row.result.missing`. Each entry is checked against the `MissingItem` type by a small schema in `run-failure/missing-items.ts`; an entry that fails is left out.
3. **"Open Settings"** for the reasons `address_needed`, `no_answer`, `not_comfyui`, `sign_in_needed`, `redirect_refused`, `certificate`, `address_refused`. It calls the app store's `show({ kind: 'settings' })`. No other reason shows it.
4. **"Show the server's message"**, only when `provider?.serverText` is true. It sends the query `job.getServerMessage { projectId, jobId }` once and shows, under a heading "Message from the ComfyUI server", the reply's `text` in a `<pre>` block as text content. The button then reads "Hide the server's message" and hides the block without asking again. A null `text`: "The server sent no message for this run." A refused query: its message in the block.

The place that draws the failure keeps its own "Retry" beside it.

**States:** before `comfy.getInfo` answers, the address mark reads "the saved address"; after, the address. Loading the server's message: "Reading the server's message…" in the block (role `status`), the button disabled.

**Never:** the server text set as HTML, turned into a link, or parsed. A reply holding `<a href="…">x</a>` shows those characters.

**Keyboard and focus:** both buttons are plain buttons in tab order after Retry. "Show the server's message" has `aria-expanded` and `aria-controls` naming the block.

**The count on Retry (FN-4).** For an `image_generation` row, a paid Retry asks for `picturesLeft(requestCount(row), row.result)` (`src/shared/generation/pictures-left.ts`), the number `job.retry` will ask for. Other rows keep `requestCount(row)` (`stores/job-store.ts`). A ComfyUI run asks for no paid confirm (ComfyUI's `local` is true).

## The address dialog (S2-6, DLG-3a)

Built. Component `src/renderer/dialogs/address-dialog/`, mounted once in the app shell beside the key dialog. [REQ: FR-255; `spec/api-principles.md`, "NEEDS_KEY", last paragraph]

**When it opens.** The app store's `command` sends `generation.runImages`, `generation.startVideo` or `job.retry`, and the reply is `RULE_VIOLATION` with `details.reason` `comfy_address_needed`. The store sets `addressRequest` and waits. Which refusal of which command opens which dialog is in `src/renderer/stores/run-asks.ts` (pure). No other command opens it.

**What it shows:** a `form` DialogFrame titled "ComfyUI address"; a text field "Server address" with the placeholder "http://127.0.0.1:8188", empty at the start, `autoComplete` off, `spellCheck` false; the privacy paragraph from `ui/comfy-privacy.ts` on the page above the buttons, and as the dialog's accessible description; "Cancel" and "Save" (the form's submit; Enter in the field submits).

**What each control does**

- "Save" sends `comfy.setAddress { address }` with the typed text. A refusal shows its own sentence as a danger DialogAlert under the field (named in the field's `aria-describedby`), focus goes back to the field, and the dialog stays open. On success the dialog closes and the store sends the first command again with the same input.
- "Cancel" (and Escape) closes it. The store returns the first refusal to the caller and does not put it in the error banner. Nothing is sent again.

**States:** open with an empty field; saving ("Saving…" on the primary button, both buttons disabled, `closable` false; the field stays enabled); refused (the alert under the field); closed.

**Focus:** the field has focus on open. Tab order: field, Cancel, Save.

## The commercial-licence dialog (S2-6, DLG-2) [D-088]

Built. Component `src/renderer/dialogs/licence-dialog/` (with `licence-choices.tsx`), mounted once in the app shell, a `DialogFrame kind="confirm"`. The rule and its main-process half are in `spec/comfyui-workflows.md`, "Commercial-licence dialog".

**When it opens.** The app store's `command` sends `generation.runImages`, `generation.startVideo` or `job.retry`, and the reply is `INVALID_INPUT` with `details.reason` `licence_not_confirmed` and a text `details.workflow`. The store sets `licenceRequest` and waits. This is the window's only licence check: the main process alone decides which workflow a run uses, and it refuses before any job row (A-40).

**What it shows**

- The model's name `{model}` is the workflow's `model.label` from `comfy.getInfo`, found by `details.workflow`. The dialog opens once that query has answered. If the query fails or the workflow is not listed, `{model}` is "This model".
- Title, word for word: "{model} requires a commercial license, please confirm that you have one before production use".
- A checkbox "don't show again for {model}", not ticked at the start. With "This model" there is no checkbox, since that is no name the main process could match.
- Buttons "Cancel" (quiet) and "Confirm" (primary).

**What each control does**

- "Confirm" answers the store. If the box is ticked, the store first sends `settings.update { licenceConfirmed }` with the current list from `app.getState` plus `{model}` (no duplicates); meanwhile the dialog shows "Saving…" on Confirm, with the box and both buttons disabled and `closable` false. Then the dialog closes, and the store sends the first command again with the same input plus `licenceConfirmed: true`. A refused `settings.update` is shown in the banner after the run is sent; the run is still sent, since the user confirmed. If the run is then refused, the run's refusal takes the banner.
- "Cancel" (and Escape) closes it. Nothing is sent; the store returns the refusal without the banner.

**Focus:** the checkbox has focus on open; with no checkbox, "Cancel". Tab order: checkbox, Cancel, Confirm.

## Asking once per call (S2-6)

Built. `src/renderer/stores/app-store.ts`. The store asks each kind of dialog, address and licence, at most once per call to `command`. So one call may ask for the address, send again, and then ask for the licence. A refusal of a kind already asked in that call goes to the banner. The key dialog for `NEEDS_KEY` keeps its own rule (`spec/screens.md`, "Key dialog"). `comfy.check`, `asset.import` and every other command open neither dialog.

## The trial mark (S2-7)

Built. When a ComfyUI choice's offered workflow for the run has status `trial`, a trial mark shows beside it. [REQ: FR-254]

- In the run dialog's provider choice (`dialogs/run-dialog/provider-choice.tsx`) and in fan-out's fill provider select (`screens/campaign/provider-select/`, props `label`, `providers`, `value`, `onChange`, `trial: boolean`).
- `src/renderer/screens/campaign/offered-workflow.ts`, `offeredFor(info, job, pair?)`, finds the workflow. Before `comfy.getInfo` answers, no mark.
- The option's own name stays "ComfyUI" and the field's label stays "Provider", so tests pick an option by its exact name.

## Settings: confirmed licences (S2-8)

Built. Component `src/renderer/screens/settings/licence-list/`, mounted inside `comfy-section/` below the check result. [D-088]

- A Section "Licences" (level 4), folded at first, with the count as its summary.
- One row per name in `app.getState`'s `settings.licenceConfirmed`, in saved order: the name as text and a quiet button "Forget" (`aria-label` "Forget {model}"). It sends `settings.update { licenceConfirmed }` with that name removed. The next run of that model shows the dialog again.
- Empty: "None confirmed".
- A refusal shows in the banner and as a line under the list. While a Forget is sent, every Forget button is disabled.

## Project home

Built (HOME-1). The page (`project-home/project-home/`, `home-sections.tsx`), under the `h1` project name:

1. **Campaigns** (`campaign-list/`): a Section (`home.campaigns`, level 2, does not fold); its header holds the count, "Load a brief" and "Paste a brief" (`brief-load/`). Each campaign is one tile button named "Open {name}": the campaign's cover thumbnail (the master of its first direction; the box stays empty when there is no cover), the name, and the variant count as an icon and number (`title` "{n} variants"). How thumbnails are drawn: `spec/editor.md`, "Thumbnails on the screens". A dashed "+" tile named "New campaign" opens the New campaign page (with the home showing, two buttons have that name: the top bar's comes first). Empty: "No campaigns yet".
2. **Assets** (D-109; `home-assets/`): the project's library, drawn in the page, as the last block. A `section` named by its `h2` "Assets". Its header row: the `h2`, an InfoTip "About Assets" ("The pictures, clips, fonts and subjects of this project."), then at the right end `missing-files/` (the mark "{n} missing", named "{n} missing: Find missing files…", only when files are missing; it opens the relink dialog), `import-files/` ("Import", named "Import files…", and a folder icon button "Import a folder…") and a `plus` button "Subject" (named "New subject…"; opens the subject dialog). The row has `--space-2` above and below its controls, so a button never touches a line. Under it, the same groups as the Assets panel, from the same component (`assets/assets-list/`): Subjects, Pictures, Clips, Fonts and Other files, each a folding Section (`home.assets.{key}`, open at first, the count as summary), at the page's normal density. Pictures and subject cards are grids that fill the page's width with as many columns as fit (`repeat(auto-fill, minmax(…))` on a token width); clips, fonts and other files are ObjectRows. Loading, a refused read with "Retry", and the empty lines are the panel's. The block and its last Section have no line under them: it is the end of the page. The page has no "Open assets" button, and the Assets panel is not drawn while the home shows (its open state is kept for the next campaign). The import dialog's result does not offer "Show in assets" on this page (the scope's `available` is false here). Built: `home-assets/`, `assets/assets-list/` (the list, its Sections and the shared "New subject…" button).
3. `drop-import/`: draws nothing until files are dragged over the window.

Props: `ImportFiles { projectId, subjects: SubjectRow[] }`, `MissingFiles { projectId, missingCount: number }`, `DropImport { projectId, projectName, subjects: SubjectRow[] }`. `missingCount` is `project.get`'s `missingAssetCount`; it is current because the page reads `project.get` again on `project.changed`. `BriefLoad` takes `home(actions)` and stays mounted: it draws the sections around its buttons, or the New campaign page in their place.

Close and Package are in the project menu (`spec/screens.md`, "Shell"); `usePackageProject(projectId)` in `package-project/` opens the package dialog.

While a campaign is open, the campaign page takes the place of the sections, full width. `drop-import/` and the Assets panel stay mounted.

**After "Create campaign"** the new campaign opens (A-45): `BriefLoad` gets `onCreated(campaignId)` from the page.

## The Assets panel (R2C-5 to R2C-7, AST-1, AST-2, SUBJ-1)

Built. `src/renderer/screens/assets/` (`assets-scope/`, `assets-button/`, `assets-panel/`, `assets-list/`, `asset-row/` with `picture-tile.tsx`, `subject-card/`, `attach-photos.ts`), `src/renderer/dialogs/subject-dialog/` and `dialogs/delete-subject/`.

- A panel along the left edge under the top bar, compact density, mounted once per project, so it stays open across a campaign and the editor. The Activity panel keeps the right edge. It opens from the "Assets" icon button in the campaign head, and is drawn only while a campaign or the editor shows; the project home shows the same library in its own Assets block (D-109, "Project home").
- A PanelHead "Assets" (`h2`) with the icon button "Close assets". An action row: the import buttons and a `plus` button named "New subject…" (visible word "Subject"; opens the subject dialog).
- Subjects, Pictures, Clips, Fonts and Other files are folding Sections (`assets.{key}`, open at first, the count as summary; Other files only when not empty).
- **Pictures** are a two-column grid of tiles: the picture, the name under it, marks as icons with their words in the tooltip and hidden text ("Reference only", "Made with AI", "Linked"; "File not found" stays visible words), and under each the select "Subject of {name}" (sends `asset.update`). Clips, fonts and other files are ObjectRows.
- **Subject cards** (`subject-card/`): the subject's name (`h4`) with a pencil icon button "Edit {name}" (opens the subject dialog) and a trash icon button "Delete {name}" (D-101), the description, then its photos as a `PhotoStrip` (`size="small"`) named "Photos of {name}": each photo with a ✕ "Remove {file} from {name}" (detaches it: `asset.update` with `subjectId` null; no asset is deleted), a "+" tile "Add photos to {name}", and the amber edge when there are none ("No photos yet" is hidden text). Result lines use real plurals ("2 photos added."); a refusal stays on the card as words.
- **Delete subject** (`dialogs/delete-subject/`, D-101, `spec/phases/subject-delete.md`): a `confirm` dialog "Delete {name}?" whose description is "This cannot be undone." plus, with photos, "Its photo stays in the project without a subject." / "Its {n} photos stay in the project without a subject." "Keep" (quiet, focused) sends nothing; "Delete subject" (danger primary, a spinner inside while it sends) sends `subject.delete` once. A refusal (the subject is in use) stays in the dialog as a danger DialogAlert.
- **The subject dialog** (`dialogs/subject-dialog/`, `kind="form"`): titled "New subject" or "Edit {name}"; "Name", "Description (optional)", the photos to add (a list "Photos to add", each with "Remove {name}"), an InfoTip "About Photos", one danger DialogAlert for a refusal; "Create subject" or "Save" (sends only what changed). Its result: "{name} was made with {n} photos."
- **No path is drawn.** A pure picker (`assetView`) keeps only the fields the screen needs; the rows' paths never reach a component.
- The import dialog's "Subject" select has "New subject…", and its result offers "Show in assets" when the panel is closed.
- Commands: `asset.list`, `asset.import`, `asset.update`, `subject.create`, `subject.update`, `subject.delete`.

Full design: `spec/phases/round-2-campaign.md`, design addition 5.

## The import dialog (S2-9, DLG-3b) [REQ: FR-050, FR-052, FR-053, FR-054, FR-246]

Built. Component `src/renderer/dialogs/import-dialog/` (with `file-strip.tsx`, `import-choices.tsx`, `import-text.ts`, `send-import.ts`, `animated-names.ts`), a `DialogFrame kind="form"`. Props: `projectId`, `open`, `paths: string[]`, `folder: boolean` (the one path is a folder), `subjects: SubjectRow[]`, `onClose()`. Opened by `import-files/` and by `drop-import/`, each with its own instance. Every close resets it.

**What it shows**

- Title: "Import 1 file", "Import {n} files"; for a folder, "Import a folder".
- A list labelled "Files to import": up to six small tiles, each an icon (picture, file or folder) with the base name as its `title` and hidden text, then a "+{m}" chip for the rest (hidden words "{m} more files"). No thumbnail: the files are not assets yet, and the window loads pictures only through the asset address. It stays in every state.
- "Put them in": a Segmented "Assets" | "References" (radios keeping the names "Asset library (can go on a post)" and "Reference library (only to guide AI pictures)"), "Assets" chosen at the start, each with an InfoTip ("About Assets", "About References").
- Checkbox "Copy into the project's assets folder", not ticked at the start. Hint under it: "Not ticked: the files stay where they are, and the project links to them."
- "Subject" (a select named "Attach to a subject"): "No subject" first and chosen at the start, then each project subject as "{name} ({id})", then "New subject…", which shows the field "Subject name" (focused).
- Buttons "Cancel" and "Import" (primary).

**What each control does**

- "Import" sends `asset.import { projectId, paths, library, copy, subjectId? }` (`subjectId` left out for "No subject"; with "New subject…", `subject.create` first).
- "Cancel" (and Escape) closes; nothing is sent.

**States**

- **Choosing:** as above.
- **Importing:** a spinner and "Importing…" (role `status`), every choice and both buttons disabled, `closable` false.
- **Refused:** the command's message as a danger DialogAlert; the choices stay; "Import" works again.
- **Done:** the choices are replaced by a list labelled "Import result" (inside a `role="status"`), each line only when its number is not 0:
  - "{a} files added." (`a` = IDs in `assetIds`, each once, that are not in `reusedAssetIds`)
  - "{r} files were already in the project and were kept as they were." (`r` = `reusedAssetIds.length`; singular "1 file was … as it was.")
  - "{s} items in the folder were skipped: links, hidden files, and files Adman cannot use." (`s` = `skippedCount`)
  - All three 0: "Nothing was imported. The folder holds no file Adman can use."
  - One line per ID in `animatedAssetIds` (S2-17): "{name} holds an animation. Adman uses its first picture.", the display name from `asset.list`. A name not found, or a refused `asset.list`, reads "A file holds an animation. Adman uses its first picture." No query is sent when the list is empty.
  - "Done" closes the dialog; "Show in assets" when the Assets panel is closed.

**Focus:** the first radio has focus on open; "Done" has focus once the result shows.

### Import buttons (S2-9)

Built. `src/renderer/screens/project-home/import-files/`:

- "Import" (named "Import files…"): `dialog.pickFiles { purpose: 'import', multiple: true }`, then the dialog with the picked paths, `folder: false`.
- "Import a folder…" (folder icon): `dialog.pickFolder { title: 'Choose a folder to import' }`, then the dialog with `[path]`, `folder: true`.
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

## Finding missing files: the relink dialog (S2-11, DLG-7) [REQ: FR-009]

Built.

**The mark on the project home.** `src/renderer/screens/project-home/missing-files/`. With `missingCount` 0 it draws nothing. Otherwise the mark "{n} missing" (named "{n} missing: Find missing files…"), which opens the relink dialog. A tile's "File missing" mark opens it too. The dialog stays open when the last file is found, though the mark goes.

**The dialog.** `src/renderer/dialogs/relink-dialog/` (with `relink-body.tsx`, `missing-row.tsx`, `use-missing-assets.ts`), `kind="review"`. Props: `projectId`, `open`, `onClose()`, `onlyAssetIds?: string[]` (the package dialog passes the IDs it was refused for). Its content mounts afresh at each open, so the list is read again and the switch on again.

- Title "Find missing files".
- A Switch "Search folder" (named "Also look for other missing files in the same folder", the same sentence in an InfoTip), on at the start. It is `relinkSiblings`.
- A list labelled "Missing files": the assets from `asset.list { projectId }` with `missing: true` (only those in `onlyAssetIds` when given), sorted by display name. Each row: the display name, its kind and library as words, and a button "Find…" (`aria-label` "Find {display name}").
- "Find…" sends `dialog.pickFiles { purpose: 'relink', kind }` (the asset's kind). A cancelled picker sends nothing. Then `asset.relink { projectId, assetId, newPath, relinkSiblings }`, and the list is read again.
- Under "Found" (an `h3` and a list "Found"), the files found in this opening.
- A line above the list: after a success, "Found {display name}." and, when `siblingIds` is not empty, " {k} other files in the same folder were found too." (role `status`). After a refusal, the command's message (role `alert`). A refused `asset.list` shows its message (role `alert`) and the list reads as empty.
- Button "Close".

**States:** loading (a spinner and "Looking for missing files…"); a list; empty ("No file is missing."); relinking (that row's button reads "Finding…", every Find button and Close disabled, `closable` false); refused (the line, buttons enabled again).

**Focus:** the switch has focus on open. After a relink, focus goes to the "Find…" of the next row after the relinked one that is still missing, else of the first row left, else to "Close". After a refused relink, focus goes back to that row's "Find…".

## Package project (S2-12, DLG-6a) [REQ: FR-008; D-027]

Built.

**Where it opens.** The project menu's "Package…" (`usePackageProject(projectId)` in `src/renderer/screens/project-home/package-project/`).

**The dialog.** `src/renderer/dialogs/package-dialog/` (with `package-body.tsx`, `missing-list.tsx`, `use-package.ts`, `file-size.ts`), `kind="publish"`. Props: `projectId`, `open`, `onClose()`. Its content mounts afresh at each open, so each open starts ready with no folder kept.

- Title "Package project". An InfoTip "About packaging": "Adman copies the project file and every file it uses into one new folder that can be opened on another computer. The project you have open does not change."
- Buttons "Cancel" and "Choose folder…" (primary, named "Choose a folder and package…"): `dialog.pickFolder { title: 'Choose where to put the package' }`. A cancelled picker sends nothing. Then `project.package { projectId, targetDir, skipMissing: false }`. The chosen folder is kept in the dialog's state for a second send and never drawn (A-48).

**States**

- **Ready:** as above.
- **Packaging:** a bar "Packaging" (`JobProgress`, no value) over the last view, which stays on screen with its buttons disabled; `closable` false.
- **Done:** a mark "{n} files · {size}" (for example "12 files · 48.3 MB"; tip "The package is ready: …") and, when `skippedAssetIds` is not empty, "{k} missing files were left out." One button "Close". `size` comes from `totalBytes` through `fileSize`: KB, MB or GB, 1 KB = 1024 bytes, one decimal place; a value that would read 1024.0 of one unit is shown in the next.
- **Files missing** (`MISSING_FILE` with `details.assetIds`): a mark "{n} missing" and a list "Missing files" of their display names (from `asset.list`, matched by ID, sorted; an ID not listed is left out). Buttons:
  - "Find…" (primary, named "Find missing files…") opens the relink dialog with `onlyAssetIds`. When it closes, the dialog sends `project.package` again with the same folder and `skipMissing: false`.
  - "Skip them" (named "Package without them"): `project.package` again with the same folder and `skipMissing: true`.
  - "Cancel".
- **Refused** (any other refusal, for example "A folder named {Name} is already there and not empty."): the message (role `alert`), and "Choose another folder…" in place of the primary button.

**Focus:** the primary button has focus on open and in each new view.

## The brief form (S2-13, S2-14, HOME-2, HOME-3a, HOME-3b) [REQ: FR-020, FR-021, FR-023, FR-024, FR-026, FR-034]

Built. Component `src/renderer/screens/project-home/brief-form/` (with `campaign-fields.tsx`, `language-field.tsx`), using `subject-rows/` (`subject-block.tsx`), `subject-photos/`, `size-fields/` (`size-chip.tsx`) and `rule-fields/` (with `word-lists.tsx`). The pure model is `src/renderer/screens/project-home/brief-form-model.ts`, with `brief-form-problems.ts` (the problem lines, the row IDs, the schema check), `brief-form-sizes.ts` and `brief-form-photos.ts`. Agents never see this form [REQ: R-01].

**Photos per subject** [D-098]: each subject has a photo strip, the form has the switch "Place first photo", and "Create campaign" attaches the photos before `campaign.create`. Wording, model and order: `spec/subject-photos.md`.

**How it opens** (`brief-load/`, `brief-paste/`):

- "Load a brief": `dialog.pickFiles { purpose: 'brief' }`, then `brief.parse`. The form opens filled from the reply. A refused `brief.parse` shows in the banner and opens nothing. A Markdown or text brief is read with AI (`spec/screens-ai.md`, "Reading a brief with AI").
- "Paste a brief": a `form` dialog with a "Brief text" area (placeholder "JSON, YAML or Markdown"). Foot: "Empty form" (named "Start from an empty form"; the form opens empty, with one empty subject row, the default sizes, and no language), "Cancel", and "Read brief", which sends `brief.parse { projectId, text }` (read by fixed rules, no AI); the form opens filled, as for a loaded brief, and a refusal shows in the dialog.
- The "+" tile "New campaign" opens the empty form.

**The page** (HOME-2): a `SubPage` titled "New campaign" (`h2`) with Back, in place of the home's sections. The form is the region "New campaign". "Cancel" leaves at once: it removes the photos the form added, closes the form, sends nothing, and focuses "Load a brief". Back and Escape leave the same way, but with typed text or added photos they first ask, in a `confirm` dialog, "Leave this brief?" (warning "What you typed will be lost.", "Keep editing" focused, "Leave"); Escape or a click outside that dialog keeps the brief. Nothing leaves while the campaign is being made. The Escape rule is shared with Settings (`src/renderer/ui/escape-leave/`). `SubPage` takes `escapeBack?: boolean` (default true; the form passes false and its caller handles Escape).

**The model** (pure, no React):

```ts
type SubjectChoice = {
  name: string
  description: string
  mode: 'new' | 'existing'
  newId: string                  // the ID a new subject gets; blank: made from the name
  existingId: string | null      // a subject the project holds
  photos: FormPhoto[]            // in the order added (spec/subject-photos.md)
  adding: boolean                // an "Add photos" import is running for this row
  notes: string[]                // lines about this row's photos
}
type BriefFormValues = {
  campaignName: string; region: string; audience: string; message: string
  offer: string; callToAction: string; tone: string
  subjects: SubjectChoice[]
  placeSubjectPhoto: boolean
  sizes: { readyMade: string[]; other: string; master: string | null }   // labels chosen, in order; typed text; label of the master
  languages: string                                                     // typed, split on commas and spaces
  rules: { mode: 'words' | 'copy'; copyFrom: string | null
           requiredWords: Record<string, string>; prohibitedWords: Record<string, string> }  // language to text, one entry per line
  copy: BriefDraft['copy']       // carried through unchanged; not edited here
}
formFromDraft(reply: BriefParsed | null, heldSubjectIds: string[], briefPhotos?: BriefPhotos): BriefFormValues
planFromForm(projectId: string, values: BriefFormValues, heldSubjectIds: string[], images, refused): CampaignPlan
```

- `formFromDraft` fills every field from the draft as the brief has it, nothing trimmed. Each subject: `newId` is the brief's `id` or one made from its name (`briefSubjectIds` in `campaign-input.ts`); `mode` is `existing` with `existingId` that ID when the project holds it, else `new`. Sizes: each brief size read with `parseSize`; one equal to a ready-made size is chosen, any other goes into `other` as `{width}x{height}`, and text that cannot be read goes into `other` as typed. No brief size: the ready-made sizes picked by default. `master` is the first size that can be read. Languages: the brief's own joined with ", ", else `primaryLanguage`, else empty. Word lists: through `wordsByLanguage`, one word per line; a plain list with no language is kept under the main language. `rules.mode` is `words`.
- **Row IDs** (`subjectIds`): a chosen project subject's ID, or the typed "Subject ID". A new row with a blank "Subject ID" and a name gets an ID made from the name with `briefSubjectIds`, stepping around the other rows' IDs; the field shows that ID as its placeholder. A blank ID with a blank name stays blank. The bad-ID line never shows for a blank ID.
- `planFromForm` gives `{ ok: true, subjects, campaign }` or `{ ok: false, problems }`. Rows with mode `new` become `subject.create` inputs; every `subjectMap` entry has `create: false`. The `brief` sent is the form's values: the seven texts (blank optional ones left out), `subjects` as `{ id, name, description }`, `languages`, `sizes` as `{width}x{height}` texts, `requiredWords` and `prohibitedWords` by language, `copy` as carried. Word lists are sent only for the languages in the list, blank lines and empty lists left out. `sizes` puts the master first. `copyRuleSetFrom` is sent when `rules.mode` is `copy`; otherwise neither rule input is sent, so the rule set holds the brief's words. The whole input must pass the shared `campaignCreateInput` schema (template `starter`).
- **Problems**, each a line, in this order; each kind of subject problem runs over every row before the next kind: "Enter the campaign name.", "Enter the region.", "Enter the audience.", "Enter the message." (each when blank after trimming); "Add at least one subject."; "Subject {i}: enter a name."; "Subject {i}: the ID "{id}" may hold only A-Z, a-z, 0-9, - and _, up to 64 letters."; "Subject {i}: the ID "{id}" is already in this project. Choose "Use a subject this project has", or another ID."; "Subjects {i} and {j} have the same ID."; "Subject {i}: choose a subject."; the photo problems of `spec/subject-photos.md`; "Choose at least one size."; "The size "{text}" cannot be read."; "Give at least one language."; "Right-to-left languages are not supported yet." (from `isRightToLeft`); "Choose a campaign to copy the rules from.". Only when none of these remain, any schema issue's own message, each once. `{i}` counts from 1.

**What the form shows:**

- **Campaign fields:** visible labels "Name", "Region", "Audience", "Message" (a text area, shown and sent word for word), "Offer", "Call to action", "Tone"; their accessible names stay "Campaign name", "Region", "Audience", "Message", "Offer (optional)", "Call to action (optional)", "Tone (optional)". Focus opens in "Campaign name". When the user leaves "Region" and "Languages" is empty, "Languages" is filled from `primaryLanguageFor(region)` when that finds one.
- **Subjects:** a Section "Subjects" (`brief.subjects`, does not fold) with the count, an InfoTip "About Photos" and a "+ Add" button named "Add subject" (adds an empty row with mode `new`; focus goes to its "Name"). Each subject is a group "Subject {n}": "Name" and "Description (optional)" (placeholders, with those accessible names); a ✕ "Remove subject {n}" (disabled on the only one; focus then goes to "Add subject"); radios drawn as segments "New" | "From project" (named "New subject" and "Use a subject this project has"; "From project" disabled when the project has no subject); then "ID" (named "Subject ID") for a new subject, or the select "Project subject" ("Choose a subject", then the project's subjects as "{name} ({id})"). Under it the photos as a `PhotoStrip` "Photos of subject {n}" with a "+" tile "Add photos to subject {n}" and ✕ "Remove photo {name} from subject {n}". An existing subject is used as stored; the brief keeps the typed name.
- **"Place first photo"**: a Switch named "Start the ad with a subject photo placed".
- When a loaded brief brought photos: "This brief added {n} photos. Check them before you create the campaign."
- **Sizes:** a Section "Sizes" holding a group "Sizes" of toggle chips (buttons with `aria-pressed`) named "{label} ({width}×{height})" for each ready-made size, a chip for each typed size that can be read, and the field "Other" (named "Other sizes", placeholder "4:5, 1200x628", an InfoTip and description "Ratios or pixel sizes, separated by commas, for example 4:5 or 1200x628."). A chip turned on goes to the end of the chosen order. A chosen chip carries a ★ button "Master: {label}"; the first chosen size is the master by default.
- **Languages:** the field "Languages" (placeholder "en, fr-CA", InfoTip and description "Language tags such as en or fr-CA, separated by commas. The first is the campaign's main language."), then a list "Languages in order" of the tags as chips: ★ "Main language" on the first, a pencil "Copy given" on each language the brief gave copy for. Copy is sent as it came.
- **Rules:** a Section "Rules", shut at first, summary "{n} required · {m} prohibited" or "From {campaign}", with an InfoTip "Colours and required files are set after the campaign is made." (A-44). Inside, a group "Rules from" of two segments "Word lists" | "Copy from" ("Copy from" disabled with the title "No other campaign yet" when there is none). Words: with two or more languages, a language picker, then "Required words ({lang})" and "Prohibited words ({lang})", one word or phrase per line. Copy: a select "Campaign to copy from" ("Choose a campaign", then the project's campaigns).
- **To fix:** when `planFromForm` gives problems, a warn box with the `h3` "To fix" and a list of every line in words, inside an `aria-live="polite"` region, never folded. With no problems nothing is drawn.
- **Foot** (held at the bottom of the scrolling page): a mark button "{n} to fix" (tip "{n} to fix: go to the list"; a click focuses the "To fix" heading), "Cancel" (quiet), and "Create campaign" (primary; disabled while there are problems, titled "Fix the {n} problems first").

**What the buttons do**

- "Create campaign": the photos are attached, then `subject.create` for each new subject, then `campaign.create`; it stops at the first refusal, whose message shows in the banner. While it runs the spinner turns inside the button, a hidden status says "Creating the campaign…", and every field and button is disabled (one fieldset). On success the form closes and `onCreated(campaignId)` opens the new campaign.
- "Cancel": closes the form at once (above). Typed values are dropped without asking (A-51).

**Keyboard:** fields in reading order. The form is not an HTML form, so Enter in a one-line field sends nothing and a stray Enter never creates a campaign.

## The campaign head and the tab strip (CAMP-3)

Built. `src/renderer/screens/campaign/campaign-view/`, `campaign-head/`, `campaign-overview/` (`view-tab-items.tsx`, `check-count.ts`), `variant-tabs/`, `approval-bar/`.

- **The head** is one row: an icon button "Back to project"; the campaign name (`h2`); the paid mark "Paid so far: …" (`spec/screens-ai.md`, "The paid count"; on the campaign views only, not over a variant); the approval link button and "Refresh" (below); "Export…"; a More menu "More actions for {name}" with "Reports…"; "Publish…" (the only primary); and the "Assets" icon button. Each opens its dialog and sends nothing itself. A refresh failure is drawn in full on its own line under the head row, where it wraps, so the campaign name keeps its room (Z-1b).
- **One tab strip**, a tablist named "Campaign" (tests use an exact match: "Open campaigns" is the top bar's tablist): "Variants", "Checks" (with a warning badge named "{n} warnings", none at 0, while reading, or when the read is refused), "Translations", a divider, then one tab per open variant named "{size} · {lang}" (the title first only when titles differ). The campaign's Undo and Redo icon buttons sit at the strip's end (`spec/screens-variants.md`). The chosen view is kept while the campaign page is open, also while a variant tab shows.
- The Variants tab is in `spec/screens-variants.md`; a variant tab holds the editor (`spec/editor.md`).
- `campaign.get` is read on mount, again on `project.changed` and on `job.updated`, so a deleted variant loses its tab and the marks follow the jobs.

## The Checks tab (CAMP-4)

Built. `src/renderer/screens/campaign/check-panel/` and `rule-set-panel/` (with `add-files-dialog.tsx`), a region "Checks". The rules and commands are in `spec/export-and-checks.md`.

- **Header:** "Run checks" (primary; a spinner inside and a hidden status "Checking…" while it runs; sends `check.run`); a mark "{n} warnings", a button that opens the first warned row (its number counts the same warned results as the tab badge, through `campaign-overview/check-count.ts`); a mark "{n} not checked" (named "{n} not checked: changed since the last check. Check again"; runs the checks again); an InfoTip "About Checks".
- **A table:** one `rowgroup` per checked post; the row button "{sizeLabel} · {language}" with `aria-expanded`; six cells named "{check}: {state}" (Files, Colours, Prohibited, Required, Translated, Fits). An opened row shows its findings under it. Posts never checked are not listed; with none checked, the EmptyState "Not checked yet" (no button of its own: "Run checks" is in the header).
- **Rules:** a Section `checks.rules` (region "Rules"; closed when any rule is set; summary "{n} colours · {m} files · {k} words"). Colours: "Add colour", then "Hex colour", then Enter. Required files: tiles by display name and "Add a required file…" (`add-files-dialog.tsx`). Words: a Segmented "Word list language", then the text areas "Required words ({lang})" and "Prohibited words ({lang})".

## The Translations tab (CAMP-5)

Built. `src/renderer/screens/campaign/translation-panel/`, a region "Translations". The rules are in `spec/data-model-campaign.md` and `spec/ai-jobs.md`.

- An InfoTip "About Translations" ("These are the texts on the posts themselves. A change here changes that post at once.") and the icon button "Export translation sheet…" (a "Saved" mark for 4 seconds after it saves).
- One region per language, named by the language ("German"): a bar titled "{a} of {b} approved"; "Approve all" (named "Approve all {language}"); "Translate again…" (named "Translate {language} again…"; opens the run dialog). While a job runs, a mark "Translating" and "Stop". A failed job shows "Failed: {sentence}" with "Retry" (opens the run dialog in retry mode).
- Rows: a list "{language} translations"; each row shows the source text (the primary language, as the source) beside the translation field; marks "Missing" or "Approved", or a button "Proposed: approve"; the link toggle is a button with `aria-pressed` named "Use for every {language} post with this text box"; the source ("from AI" and so on) is an icon with hidden text.
- **Order (R3-3).** The same as the Variants tab: language blocks in the campaign's languages order, the primary language first; inside a block, directions in the campaign's order and rows in `directionOrder` then `gridAxes` order (the master's size first, then the campaign's sizes, an image before a video). `translation-order.ts` calls the Variants tab's own two functions; it holds no copy of the order. With more than one direction, each direction is named by an `h3` inside the block and the list is named "{language} translations in {direction}".
- **Language heading (R3-3).** Each block is a Section at level 2 with `size="title"` (`--type-title-size`, `--type-title-weight`) and `--gap-section` above it.
- **The Source block (R3-3).** The first block is the primary language, with the word "Source" in its header. One row per text layer of each primary-language post: the thumbnail, "{size} · {layer}", and an editable field over the full width. Enter or leaving the field saves; Shift+Enter adds a line; Escape puts the old words back. Saving sends `layer.update { copy }`, the editor's own command: one undo step on that variant's list, and linked posts follow by the usual rules (a linked post of another size keeps its words until Sync). A refusal shows the command's message under the row. Nothing here starts a translation run. The rows come from `translation.sources`.
- **"Out of date" (R3-3).** A translation row shows the mark "Out of date" under its source text when the master's words for that layer are ahead of what the row last synced (`staleGroups`, the copy group, as the Variants tab's mark). It is a mark, not a button.
- A one-language campaign: the EmptyState "One language: English" (the campaign's language).

## Reports and the report view (CAMP-6, DLG-7)

Built. `src/renderer/screens/campaign/report-list/` (`campaign-reports.tsx` exports `useReports(projectId, campaignId)` → `{ open(), dialog }`; `read-reports.ts`) and `src/renderer/dialogs/report-view/`.

- **Reports** (from the head's More menu "Reports…"): a wide dialog "Reports" with a list "Reports". Each export is an ObjectRow whose button is named "Export {n}…" and opens the report; marks show the files written and, visibly, "{n} failed". The row's `title` is the export folder's base name: the full path is cut in `read-reports.ts` and never kept. Empty: the EmptyState "No exports yet" with "Export…".
- **The report view** (`kind="review"`): the report's title; summary marks with "Paid generations" visible; the head facts in a "Details" Section (`report.details`, folded at first); the ads as rows on the left (a list "Ads") and the picked ad's lines on the right. No folder field: `outputDir` is not read. Every value from the report is drawn as text.

## The export dialog (DLG-6a)

Built. `src/renderer/dialogs/export-dialog/` (`ad-ticks.tsx`, `folder-row.tsx`, `export-options.tsx`, `export-warnings.tsx`, `export-end.tsx`, `use-export-job.ts`), `kind="publish"`, opened by the head's "Export…" (`campaign-export/`; `CampaignExport` takes `reports?: boolean`, and the head passes false). The rules are in `spec/export-and-checks.md`.

- Title "Export {campaign}" ("Export campaign" before the name is read). "Loading the ads…" meanwhile.
- **Ads:** a fieldset "Ads to export" with the header "Ads {k}/{n}" and a tri-state tick "All ads"; each ad is an ObjectRow whose tick is named "{title} · {size} · {lang} · {format}".
- **Folder:** a row with the folder's base name (the full path only as its `title`), "Choose folder…", then "Change…".
- **Options:** "Format", a group "Picture format" of segments PNG / JPG; "Quality" (named "JPG quality"); "Frames per second" when a video is ticked.
- Foot: "Cancel" and "Export". While it runs, a bar "Exporting"; when done, marks "{n} exported" and, when any failed, "{n} failed"; then "Close". A failed or cancelled job reads "The export failed." / "The export was cancelled."
- **Warnings step:** the warnings as rows, a reason field (placeholder "Why export anyway? (optional)", named "Reason for exporting anyway (optional)"), "Back" and "Export anyway".

## The publish dialog (DLG-6b)

Built. `src/renderer/dialogs/publish-dialog/`, `kind="publish"`, opened by the head's "Publish…". Described in full in `spec/phases/phase-09.md`, "Screens" (with A-218: each file's full local path is drawn as plain text under its row).

## The approval link (CAMP-3, DLG-6b)

Built. `src/renderer/screens/campaign/approval-bar/`, `approval-mark/`, `src/renderer/dialogs/approval-dialog/`. The rules are in `spec/approvals.md`.

- **In the head:** a group "Approval link" with one button named "Approval link…", "Approval link… {a}/{b}" or "Approval link… off" (its tip "Signed off: a of b variants. Checked hh:mm"), and the icon button "Refresh" (a spinner while it refreshes).
- **The dialog** "Approval link": icon buttons "Copy link" and "Copy password", a menu "More actions for the link" with "New password…"; the sign-offs as rows; "Turn off…" (named "Turn off link…") opens the confirm dialog "Turn off link?" with "Keep link" (focused) and "Turn off link".

## Choices made without a design sign-off

Each was made to get a working, testable screen.

- ComfyUI failures sit under the failed run wherever it shows; the server's message opens in place under a heading.
- The address dialog replaces "Open Settings" for a run refused for lack of an address. "Open Settings" stays on a failed run whose reason is about the server.
- The licence dialog has the ruled sentence as its title, with no other text.
- Import, relink and package are dialogs; import and relink buttons sit on the project home's Assets row, Package in the project menu.
- Dropped files show a full-window layer with one line of text.
- The brief form is its own page with "To fix" listed at its foot.

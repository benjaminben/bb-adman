# Groups 4 and 5 — Phase 2 screens (slices S2-4 to S2-17)

Part of the Phase 2 leftovers; the rest is in `spec/phases/phase-02-leftovers.md`.

Group 4 is the ComfyUI failures and refusals on the campaign page (TP-4a), the commercial-licence dialog (LD-1, D-088) and the confirm count on Retry (review item FN-4). Group 5 is import by button and by drop, relink, package, the brief form, the slot view and the campaign grid. Every screen, its controls, states, sentences and focus are in `spec/screens-campaign.md`. The slices below say who built what, in which files, with which tests.

**Status.** S2-1 to S2-17 are built and merged on `main`, with the UI-1 polish (disabled controls at `--opacity-disabled`, the `--font-size-small` token, the run row's Cancel rule in `run-row/cancel-shown.ts`; `spec/structure.md`, `spec/screens.md`). The built slices stay below as the record of what each one owns and which test edits were approved.

**What these slices do not build**, by decision (`spec/assumptions.md`):

- The run dialog of FR-256 (the address and the workflow before a ComfyUI run) is Phase 4's run confirmation dialog (A-49). The Settings parts the hand-test screen once stood in for are built: the check lists each workflow with its missing items and licence note, and the section lists what Adman leaves on the server.
- No extra line for a queued agent run that will be cancelled at its turn (A-49).
- The campaign page shows no message when `campaign.get` is refused: the reply is dropped and the last data stays (a nuisance; not built unprompted). It does read `campaign.get` again on `project.changed` and `job.updated` for its project (`useCampaign` in `campaign-view.tsx`, built with Phase 3).

**Main-process work these screens need.** Every command and query the screens call exists (the licence check, `licenceConfirmed` and `offered` came with S2-4; the animated-WebP list in the `asset.import` reply with S2-17).

## Rules for these slices

- Every slice: write the failing tests first, then the code; run lint, typecheck and `npm test` in full; plus what its class asks (`spec/testing.md`). A class G slice runs its end-to-end spec and `tests/e2e/screen-tour.spec.ts`.
- A slice edits only the files it owns and the existing files it is told it may touch. A change needed elsewhere: stop and report. An existing test is edited only where the slice lists the edit as approved.
- New tests get their own fixture files. No slice edits a shared fixture (`campaign-fixture.ts`, `project-fixture.ts`, `comfy-fixture.ts`, `video-fixture.ts`) unless it is listed.
- Every new component follows the folder rule and takes every CSS value from a token (`spec/structure.md`). No slice adds a token: stop and report if one is needed. Each file stays under 200 lines.
- No slice extends the hand-test screen (`src/renderer/dev/`).
- Budget: one slice per developer run, well under 300k tokens; hand off with `HANDOFF.md` if near it.

## Order and side-by-side work

Slices in one wave may run side by side in separate git worktrees: no two of them edit the same file. A slice starts only when every slice it comes after has merged.

| Wave | Slices (side by side) | Each comes after |
|------|-----------------------|------------------|
| 0 | S2-1, S2-2, S2-3 | Built |
| 1 | S2-4, S2-5, S2-9, S2-11, S2-13, S2-15, S2-16 | Built |
| 2 | S2-6, S2-7, S2-8, S2-10, S2-12, S2-14 | Built |
| 3 | S2-17 | Built |

- **Built pieces the slices use** (S2-1 to S2-3): `checkMessage`, `fillMarks` and `licenceNotConfirmedMessage` in `src/shared/providers/messages.ts`; `src/renderer/ui/missing-item-text.ts`; the dialog frame `src/renderer/ui/dialog-frame/`; `src/renderer/ui/comfy-privacy.ts`; `src/renderer/screens/campaign/use-comfy-info.ts`; the drop bridge `window.drop.pathOf` and `droppedPaths(files)` in `src/renderer/ui/dropped-paths.ts`.
- **Phase 3** builds on S2-16's `variant-tile/` and `variant-grid/`, and on the built `dialog-frame/`.

## S2-4 — Licence check and offered workflows (main process)

Built.

- **Exists when done:** the main half of LD-1 (`spec/comfyui-workflows.md`, "Commercial-licence dialog") and the `offered` mark on `comfy.getInfo`.
  - Settings key `licenceConfirmed: string[]` (model labels, each 1 to 100 characters, at most 50), default `[]`, written by `settings.update`. A loaded value that fails reads as `[]` and the other keys are kept.
  - `generation.runImages`, `generation.startVideo` and `job.retry` take `licenceConfirmed: true` (optional). After the workflow is chosen, a workflow whose `licence.commercialNote` is not null runs only when its `model.label` is in `settings.licenceConfirmed`, or the actor is the user and the input holds `licenceConfirmed: true`. Otherwise `INVALID_INPUT`, `details = { reason: 'licence_not_confirmed', workflow }`, message `licenceNotConfirmedMessage(model.label)`, before any job row and before anything is sent. For an agent the flag is ignored.
  - `WorkflowInfo.offered: boolean`: true for the workflow `offeredWorkflow` gives the user for its job (and, for video, its start pair) with the app's dev-tools setting.
- **New files:** `src/main/commands/generation/licence-check.ts`.
- **May touch:** `src/shared/schemas/settings.ts`, `src/main/settings/defaults.ts`, `src/main/settings/settings-store.ts`, `src/shared/schemas/commands/generation.ts`, `src/shared/schemas/commands/job.ts`, `src/main/commands/generation/comfy-checks.ts`, `comfy-video-checks.ts`, `src/main/commands/job/retry.ts`, `src/main/queries/comfy.ts`, `src/shared/schemas/queries/comfy.ts`. Approved test edits: each test that lists every settings key gains `licenceConfirmed` (`tests/integration/commands/settings-update.test.ts` and any other the developer finds, named in the report); `tests/unit/renderer/fake-api.ts` (`licenceConfirmed: []` in `baseState`); each `WorkflowInfo` fixture gains `offered` (`tests/unit/renderer/screens/settings/comfy-fixture.ts`, the video fixtures); the agent gate's ComfyUI test gains one refusal case.
- **Read:** `spec/comfyui-workflows.md` "Which workflow a run gets", "Commercial-licence dialog"; `spec/api-principles.md` the reason table and "What `details` may hold"; `spec/infra-and-settings.md` "settings.json"; `spec/agent-runs.md` (the gate's order of checks).
- **Tests:** `tests/integration/generation/licence-check.test.ts` (an H3 video and a FLUX 3 klein picture with no flag: refused with the reason and `details.workflow`, no job row, the stand-in got no request; with the flag: accepted; with the model saved and no flag: accepted; a MOSS picture with no flag: accepted; `job.retry` of a failed H3 run: the same three; as the agent with the flag in the input and ComfyUI ticked: refused; as the agent after the model is saved: accepted), `tests/unit/main/settings/settings-licence.test.ts` (default; a bad loaded value; `settings.update` takes a list and refuses a non-text entry), `tests/integration/queries/comfy-info-offered.test.ts` (dev tools off: no `trial` workflow offered; on: exactly one offered per job and per video start pair; the agent still gets `AGENT_DENIED`).
- **Class:** B. Not security class; short review (it changes what an agent is refused).

## S2-5 — ComfyUI failures in the run row (TP-4a, FN-4)

Built.

- **Exists when done:** `spec/screens-campaign.md`, "Campaign page: ComfyUI failures in the run row", including the Retry count of FN-4.
- **New files:** `src/renderer/screens/campaign/run-failure/`.
- **May touch:** `src/renderer/screens/campaign/run-row/run-row.tsx` (draws `RunFailure` for a failed row; the Retry count).
- **Read:** `spec/screens-campaign.md` that section; `spec/comfyui.md` "Failures, and the server's own words"; `spec/security.md` "What the window may draw".
- **Tests:** `tests/unit/renderer/screens/campaign/run-failure.test.tsx` (`out_of_memory` shows its sentence; `no_answer` fills the address from `comfy.getInfo`, and reads "the saved address" before it answers; `missing_items` lists each item's text and fills `{n}`, and drops a malformed entry; the seven reasons show "Open Settings" and pressing it shows Settings; `run_failed` does not; no reason gives the kind's sentence; "Show the server's message" sends `job.getServerMessage` once and draws the text; a reply holding `<a href="https://x.test">y</a>` shows those characters and the row holds no link; a null reply shows its sentence; a provider without `serverText` has no button; axe), `tests/unit/renderer/screens/campaign/run-row-retry-count.test.tsx` (a cancelled picture row with `count: 4` and two kept asset IDs: "This sends 2 paid request(s)"; a video row keeps the stored count; Retry on a failed ComfyUI row sends `job.retry` with no confirm line).
- **Class:** D. Not security class; the review checks that server text is drawn as text only.

## S2-6 — The address dialog and the licence dialog (TP-4a, LD-1)

Built.

- **Exists when done:** `spec/screens-campaign.md`, "The address dialog", "The commercial-licence dialog" and "Asking once per call". The app store asks and sends again for the three run commands, each kind of dialog at most once per call.
- **New files:** `src/renderer/dialogs/address-dialog/`, `src/renderer/dialogs/licence-dialog/`, `src/renderer/stores/run-asks.ts` (which refusal of which command opens which dialog; pure).
- **May touch:** `src/renderer/stores/app-store.ts` (state `addressRequest` and `licenceRequest`; the ask-then-send-again step, at most once per call), `src/renderer/app/app-shell/app-shell.tsx` (mounts both dialogs beside the key dialog). Approved test edit: the `comfy_address_needed` row was removed from `tests/unit/renderer/screens/campaign/video-picture.test.tsx` (that refusal now opens the address dialog instead of the banner).
- **Read:** `spec/screens-campaign.md` those two sections; `spec/api-principles.md` "`NEEDS_KEY`"; `spec/comfyui-workflows.md` "Commercial-licence dialog".
- **Tests:** `tests/unit/renderer/stores/run-asks.test.ts` (with the fake API: `comfy_address_needed` on `generation.runImages` opens the address request; after a save the same input is sent once more; Cancel returns the refusal, sends nothing more and leaves the banner empty; `licence_not_confirmed` opens the licence request with the workflow; Confirm sends the same input plus `licenceConfirmed: true`; a ticked box sends `settings.update` with the model added before the run; a second refusal is not asked again and goes to the banner; `comfy.check` and `asset.import` refusals open nothing), `tests/unit/renderer/dialogs/address-dialog.test.tsx` (privacy paragraph; a refused address shows its sentence under the field and the dialog stays; Saving state; Cancel; focus on the field; axe), `tests/unit/renderer/dialogs/licence-dialog.test.tsx` (the ruled sentence with the model from `comfy.getInfo`, and "This model" when it is not found; the box's label; Cancel; Confirm with and without the box; focus on the box; axe), `tests/e2e/comfy-asks.spec.ts` (offline, ComfyUI stand-in, dev tools on: with no address, Generate with ComfyUI opens the address dialog, saving the stand-in's address starts the run; an H3 video start opens the licence dialog, Cancel leaves no run row, Confirm with the box ticked starts it, and a second start shows no dialog). A new spec file, not a case added to `comfy-stand-in.spec.ts`.
- **Class:** D + G. Not security class.

## S2-7 — The trial mark in the panels

Built.

- **Exists when done:** `spec/screens-campaign.md`, "The trial mark in the panels".
- **New files:** `src/renderer/screens/campaign/provider-select/`, `src/renderer/screens/campaign/offered-workflow.ts`.
- **May touch:** `screens/campaign/generate-panel/generate-panel.tsx`, `screens/campaign/video-panel/video-panel.tsx` (each draws `ProviderSelect`).
- **Read:** that section; `spec/comfyui-workflows.md` "Which workflow a run gets".
- **Tests:** `tests/unit/renderer/screens/campaign/offered-workflow.test.ts` (`image` with no ticks, `image_refs` with ticks, a video pair, nothing offered), `tests/unit/renderer/screens/campaign/trial-mark.test.tsx` ("(trial)" beside the select, describing it, when the offered workflow is `trial`, the option's name still "ComfyUI"; ticking a reference picture follows the `image_refs` workflow; a `proven` one has no mark; Gemini never has one; the video card follows the chosen start; the field's label is still "Provider"; axe). Every existing panel test passes unchanged.
- **Class:** D. Not security class.

## S2-8 — Confirmed licences in Settings

Built.

- **Exists when done:** `spec/screens-campaign.md`, "Settings: confirmed licences".
- **New files:** `src/renderer/screens/settings/licence-list/`.
- **May touch:** `screens/settings/comfy-section/comfy-section.tsx` (one mount below the check result).
- **Tests:** `tests/unit/renderer/screens/settings/licence-list.test.tsx` (lists saved names as text; "Forget" sends `settings.update` without that name; buttons disabled while it is sent; empty sentence; a refusal line; axe).
- **Class:** D. Not security class.

## S2-9 — The import dialog and the import buttons

Built.

- **Exists when done:** `spec/screens-campaign.md`, "The import dialog" and "Import buttons".
- **New files:** `src/renderer/dialogs/import-dialog/`; the body of `screens/project-home/import-files/` (owned from here on).
- **Read:** those sections; `spec/assets.md` "Import", "Folders".
- **Tests:** `tests/unit/renderer/dialogs/import-dialog.test.tsx` (the three defaults; `asset.import` carries each choice; no `subjectId` for "No subject"; result lines for a mix of added, reused and skipped; the all-zero sentence; a refusal shows inside and "Import" works again; Cancel sends nothing; Importing disables both buttons and Escape; the dialog's text holds base names only, never a folder of the path; eleven names show ten and "and 1 more"; axe), `tests/unit/renderer/screens/project-home/import-files.test.tsx` (the files picker input; the folder picker input; a cancelled picker sends nothing).
- **Class:** D. Not security class.

## S2-10 — Importing by dropping files

Built.

- **Exists when done:** `spec/screens-campaign.md`, "Importing by dropping files", the drop target.
- **New files:** the body of `screens/project-home/drop-import/` (owned from here on).
- **Tests:** `tests/unit/renderer/screens/project-home/drop-import.test.tsx` (with a stand-in `window.drop`: a drag of files is accepted and any other drag is left alone; the layer shows the project's name; a drop opens the import dialog with the paths and sends nothing before "Import"; a drop whose paths are all empty does nothing; a drop while the dialog is open is ignored; Escape hides the layer; the listeners are gone after unmount), `tests/e2e/drop-import.spec.ts` (a file put on a hidden input with `setInputFiles` and dropped on the window through a `DragEvent` opens the import dialog; "Import" adds the asset).
- **Class:** D + G. Not security class; the review checks that a drop never imports without "Import".

## S2-11 — The relink dialog

Built.

- **Exists when done:** `spec/screens-campaign.md`, "Finding missing files: the relink dialog".
- **New files:** `src/renderer/dialogs/relink-dialog/`; the body of `screens/project-home/missing-files/` (owned from here on).
- **Read:** that section; `spec/assets.md` "Relink".
- **Tests:** `tests/unit/renderer/dialogs/relink-dialog.test.tsx` (lists only missing assets, by name; `onlyAssetIds` narrows it; "Find…" sends the relink picker with the asset's kind, then `asset.relink` with `relinkSiblings` from the box; a cancelled picker sends nothing; the found and siblings sentences; a refusal shows; the list is read again; focus moves to the next missing row's "Find…", or back to the same one after a refusal; axe), `tests/unit/renderer/screens/project-home/missing-files.test.tsx` (nothing at 0; the sentence and button otherwise).
- **Class:** D. Not security class.

## S2-12 — The package dialog

Built.

- **Exists when done:** `spec/screens-campaign.md`, "Package project": "Find missing files…" is the main button in the files-missing view; sizes use 1 KB = 1024 bytes with one decimal place; the three choices are stacked; the last view stays on screen, disabled, while packaging.
- **New files:** `src/renderer/dialogs/package-dialog/` (with a private `file-size.ts`); the body of `screens/project-home/package-project/` (owned from here on).
- **Read:** that section; `spec/data-rules.md` "Package project".
- **Tests:** `tests/unit/renderer/dialogs/package-dialog.test.tsx` (a cancelled picker sends nothing; the done line; `MISSING_FILE` lists the names; "Package without them" sends `skipMissing: true` with the same folder; "Find missing files…" opens the relink dialog with only those IDs and packages again when it closes; another refusal offers "Choose another folder…"; no path appears in the dialog; axe), `tests/unit/renderer/dialogs/file-size.test.ts`.
- **Class:** D. Not security class.

## S2-13 — The brief form: fields and subjects

Built.

- **Exists when done:** `spec/screens-campaign.md`, "The brief form": the model in full, "Type a brief", the campaign fields, the subject rows, problems, create and cancel (sizes, languages and rules as read-only lines until S2-14 replaced them). `brief-summary/` is removed.
- **New files:** `src/renderer/screens/project-home/brief-form-model.ts`, `screens/project-home/brief-form/`, `screens/project-home/subject-rows/`.
- **May touch:** `screens/project-home/brief-load/brief-load.tsx` ("Type a brief"; the form in place of the summary), `screens/project-home/campaign-input.ts` (`campaignPlan` goes; `briefSubjectIds` stays). Approved test edits: `tests/unit/renderer/screens/project-home/campaign-input.test.ts` keeps its `briefSubjectIds` block, and its `campaignPlan` cases move to `brief-form-model.test.ts` against `planFromForm(formFromDraft(…))`, with the new problem wording; `brief-load.test.tsx` and `brief-subject-ids.test.tsx` keep every case against the form (the region "Brief", the list "Subjects", "Create campaign" and "Cancel" keep their names; the notes "(made from the name)" and "already in this project, used as it is" become the "Subject ID" field's value and the chosen "Use a subject this project has"; the bad-ID problem reads "Subject {i}: the ID …"). The end-to-end helpers in `tests/e2e/screens.ts` must pass unchanged.
- **Read:** that section; `spec/brief-and-templates.md` "The brief's shape", "From a brief to a campaign".
- **Tests:** `tests/unit/renderer/screens/project-home/brief-form-model.test.ts` (filling from a draft, sizes and languages as described; every problem line; the sent `brief`, `subjectMap` and `subject.create` list; an existing subject sends no `subject.create`; a typed new ID taken by the project is a problem), `brief-form.test.tsx` (edit a field and the sent input changes; message word for word; "Add subject" and "Remove" with focus; Enter in a field creates nothing; Creating disables everything; the new campaign opens; axe), `brief-type.test.tsx` ("Type a brief" opens an empty form with problems listed; leaving "Region" fills "Languages"; a filled form sends `subject.create` then `campaign.create`).
- **Class:** D. Not security class.

## S2-14 — The brief form: sizes, languages and rules

Built.

- **Exists when done:** the sizes, languages and rules of "The brief form", and three rulings: a blank Subject ID is made from the name (so the bad-ID line never shows for a blank ID); the same project subject in two rows is a problem ("Subjects 1 and 2 have the same ID."); an empty problems box takes no space. Also the copy select "Campaign to copy from", word lists sent only for the listed languages, and the "Master size" option wording.
- **New files:** `screens/project-home/size-fields/`, `screens/project-home/rule-fields/`; `brief-form-problems.ts` and `brief-form-sizes.ts` beside `brief-form-model.ts`.
- **May touch:** `screens/project-home/brief-form/` (owned from S2-13). Approved test edits: `tests/unit/renderer/screens/project-home/brief-load.test.tsx` and `brief-type.test.tsx` (to the form with editable sizes, languages and rules).
- **Tests:** `tests/unit/renderer/screens/project-home/size-fields.test.tsx` (ticks, other sizes, master choice; the master first in the sent sizes; an unreadable size is a problem), `rule-fields.test.tsx` (word lists per language go into `brief`; "Copy the rules from another campaign" sends `copyRuleSetFrom` and no word lists in the rule input; disabled with no other campaign), `brief-form-languages.test.tsx` (typed tags in order; a right-to-left tag is a problem; no tag is a problem), `brief-form-problems.test.ts`, `brief-form-rulings.test.tsx` (the three rulings), axe for each.
- **Class:** D. Not security class.

## S2-15 — The slot view

Built.

- **Exists when done:** `spec/screens-campaign.md`, "The slot view", below the grid and above the picture panel.
- **New files:** the body of `screens/campaign/slot-view/` (owned from here on).
- **Read:** that section; `spec/brief-and-templates.md` "`slotStates` and the template queries".
- **Tests:** `tests/unit/renderer/screens/campaign/slot-view.test.tsx` (rows in template order with names and states; candidates with pictures through `assetUrl` and names as text; a missing candidate says "file not found"; read again on `project.changed` for this project only; loading, refused and empty sentences; axe).
- **Class:** D. Not security class.

## S2-16 — The campaign grid and the variant tile

Built.

- **Exists when done:** `spec/screens-campaign.md`, "The campaign grid and the variant tile". `variant-list/` is removed.
- **New files:** `src/renderer/screens/campaign/variant-grid/`, `src/renderer/screens/campaign/variant-tile/` (with `badge-words.ts`).
- **May touch:** `screens/campaign/campaign-view/campaign-view.tsx`. Approved test edits: `tests/unit/renderer/screens/campaign/campaign-view.test.tsx` (radios become tile buttons with `aria-pressed`; the order check reads the tiles), `tests/unit/renderer/screens/campaign/reference-ticks.test.tsx` lines 113 and 127 (`getByRole('button', { name: /German post/ })`), `tests/e2e/screen-tour.ts` line 90 (the list "Variants" and its buttons).
- **Read:** that section; `spec/editor.md` "Navigation", "Thumbnails on the screens" (what Phase 3 adds; do not build it).
- **Tests:** `tests/unit/renderer/screens/campaign/variant-tile.test.tsx` (the text lines; " · master"; the shape box with "Video" for a video variant; each mark only when true; `aria-pressed`; click, Enter and Space call `onChoose`; `preview` replaces the box; `actions` drawn outside the button; a title holding `<b>` shows the characters; axe), `variant-grid.test.tsx` (order; the empty sentence; axe), `badge-words.test.ts`.
- **Class:** D (+ the screen-tour end-to-end run). Not security class.

## S2-17 — The animated-WebP notice

Built.

- **What it does:** the `asset.import` reply holds `animatedAssetIds: string[]`, the imported or reused WebP files whose first bytes say they are animated (`webpHeadInfo`, in `src/main/assets/inspect.ts`; `src/main/assets/import.ts`; `src/main/commands/asset/import.ts`). The import dialog's done state adds one line per ID, "{name} holds an animation. Adman uses its first picture.", the name from `asset.list` (`animated-names.ts`, `animationLines` in `import-text.ts`). A name not found, or a refused `asset.list`, gives "A file holds an animation. Adman uses its first picture." No query is sent when the list is empty. Wording: `spec/screens-campaign.md`, "The import dialog".
- **Tests:** `tests/integration/assets/import-animated-webp.test.ts` (an animated WebP is listed; a still WebP and a PNG are not; the same inside a folder import), cases in `tests/unit/renderer/dialogs/import-dialog.test.tsx`.
- **Class:** B + D. Security class, short review (reads file bytes through `webpHeadInfo`).

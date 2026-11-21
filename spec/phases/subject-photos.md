# Subject photos — a subject is defined by its photos

**Goal:** On the brief form, each subject has at least one photo before a campaign is made; a brief file can name photos beside it; the description stays optional. Every subject photo guides AI pictures and can be placed in an ad as it is [D-098, R-21].

**Exit criteria**

- A JSON or YAML brief that names photos in its folder opens the form with those photos shown in each subject row; a path outside the folder, a missing file or a non-picture shows its note and is not used.
- "Create campaign" is disabled with "Subject {i}: add at least one photo." until each row has a photo, and with the one-subject lines when a photo belongs elsewhere or sits in two rows.
- After "Create campaign", each photo is attached to its subject. With "Start the ad with a subject photo placed" not ticked (the default) the master's subject slot is empty; ticked, it holds the first subject's newest photo.
- On the new campaign, the subject's photos are pre-ticked in "Make pictures", pre-chosen in the editor's generate fields and on the video card, whichever library they are in.
- A subject photo in the reference library can be placed from the picture chooser, which moves it to the asset library.
- A picture or video run that sends any picture ends its prompt with the "keep printing" ending; a run with none keeps "no text" (SP-9).
- Cancel leaves no new asset in the project.
- `create_campaign` behaves as before: an agent can still make a campaign whose subjects have no files, and its slot fills as before.
- Every existing end-to-end and shots run that creates a campaign through the form passes, with the edits named in SP-5.

**Dependencies:** Phase 4 merged (P4-15 `brief.extract`, P4-20 exit check). Not tied to the approvals slices: none of them edits the files below.

**Design:** `spec/subject-photos.md` (everything, assumptions A-110 to A-126). SP-9's design is `spec/providers-adapters.md`, "Prompt and text rules" (A-127 in `spec/assumptions.md`). Read also `spec/screens-campaign.md` "The brief form" and `spec/brief-and-templates.md` "What the project page sends".

## Rules for these slices

- Every slice: write the failing tests first, then the code; run lint, typecheck and the tests its class asks (`spec/testing.md`). The full gate runs before release, not per slice.
- A slice edits only the files it owns and the existing files it may touch. A change needed elsewhere: stop and report.
- **Frozen contracts.** Only SP-1 edits `src/shared/schemas/brief.ts` and `src/shared/schemas/commands/brief.ts`; only SP-6 edits `src/shared/schemas/commands/campaign.ts` (designed in `spec/subject-photos.md`). Only SP-2 edits `brief-form-model.ts`, `brief-form-problems.ts` and the new `brief-form-photos.ts`, except one line SP-4 adds to `planFromForm`.
- **One owner** of "which rows are reference pictures" and "which photos are pre-chosen": `src/renderer/ui/reference-picker/reference-rows.ts` (SP-7). No other file filters by library for references.
- **Screens** (D-084): one folder per component, CSS from tokens only. No new token is expected (`--layer-thumb` exists).
- Files stay under 200 lines where they can, 300 at most. `subject-rows.tsx` (147 lines) gains only a mount point for the new `subject-photos/` component.
- Budget: one slice per developer run, well under 300k tokens; hand off with `HANDOFF.md` if near it.

## Order and side-by-side work

| Wave | Slice | Waits for | May run beside |
|------|-------|-----------|----------------|
| 1 | SP-1 Brief photo paths in `brief.parse` (built) | Phase 4 | SP-2, SP-6, SP-7, SP-8, SP-9 |
| 1 | SP-2 Form model: photos, problems, attach plan (built) | Phase 4 | SP-1, SP-6, SP-7, SP-8, SP-9 |
| 1 | SP-6 `campaign.create` gains `placeSubjectPhoto` (built) | Phase 4 | SP-1, SP-2, SP-7, SP-8, SP-9 |
| 1 | SP-7 Subject photos in the reference lists and pre-choices (built) | Phase 4 | SP-1, SP-2, SP-6, SP-8, SP-9 |
| 1 | SP-8 Placing a reference-library subject photo (built) | Phase 4 | SP-1, SP-2, SP-6, SP-7, SP-9 |
| 1 | SP-9 The prompt ending keeps printing when pictures are sent (built) | Phase 4 | Every other SP slice |
| 2 | SP-3 The "Photos" part of a subject row and the place box (built) | SP-2 | SP-1, SP-6, SP-7, SP-8, SP-9 |
| 3 | SP-4 Brief photos on load, the Create order, cleanup (built) | SP-1, SP-3, SP-6 | SP-9 |
| 4 | SP-5 Fixtures, end-to-end and shots updates, exit check (built) | Every other SP slice except SP-9 | SP-9 |

**SP-3, SP-4 and SP-5 merge into `main` together**, because the form's photo requirement breaks the end-to-end runs until SP-5.

No two slices of one wave share a file: SP-1 is in `src/main/assets/`, `src/main/commands/brief/`, `src/main/jobs/kinds/brief-extraction.ts` and the brief schemas; SP-2 in the project-home model files; SP-6 in `campaign.ts` and `fills.ts`; SP-7 in `ui/reference-picker/`, `editor/generate-fields/`, `screens/campaign/campaign-view/` and `video-picture-choice/`; SP-8 in `dialogs/picture-chooser/`; SP-9 in `src/shared/generation/prompt.ts`, the picture and video commands and job kinds, `job/retry.ts`, and their tests. SP-9 shares no file with any other SP slice: it touches no renderer file and no end-to-end or shots file (none of them checks a prompt ending), so SP-3, SP-4, SP-5 and SP-7 can be built beside it.

## Slices

### SP-1 — Brief photo paths in `brief.parse` (built)

- **As built:** `isWideFolder` also refuses `/Volumes` itself on macOS. Names are compared without case on macOS and Windows, and with case on Linux.

- **Exists when done:** `BriefDraft` subjects read `pictures` (text or list). `brief.parse` with a `filePath` replies `subjectPictures`, checked by `checkBriefPictures` with the folder-width check and the six rules of `spec/subject-photos.md`; with `text`, every picture gets `no_folder`; a brief whose real folder is too wide gives `wide_folder` for every picture. `pictureName` gives the shown name. `cleanLineText` is exported from `bad-line.ts` and used by `badLineAt`. `brief-extraction.ts` removes `pictures` from the draft it returns. `Brief` has no `pictures`.
- **New files:** `src/main/assets/brief-pictures.ts`; `src/shared/brief/picture-name.ts`.
- **May touch:** `src/shared/schemas/brief.ts`; `src/shared/schemas/commands/brief.ts`; `src/shared/brief/bad-line.ts` (export `cleanLineText`, no change in behaviour); `src/main/commands/brief/parse.ts`; `src/main/jobs/kinds/brief-extraction.ts`.
- **Tests first:**
  - `tests/unit/shared/brief/picture-name.test.ts`: `photos/a.png` gives `a.png`; `C:\x\b.jpg` gives `b.jpg`; a name with a right-to-left mark or a tab is cleaned; 200 letters cut to 120 with "…"; `''` and `photos/` give `(no name)`.
  - `tests/unit/shared/brief/draft.test.ts` (approved addition): `pictures` as text, as a list, as a number (dropped), as a list with a number (dropped); `Brief` drops a subject's `pictures`.
  - `tests/integration/assets/brief-pictures.test.ts`, in a temp folder holding a brief, a `photos/` folder and a folder beside it: accepted: `a.png`, `photos/b.jpg`, `photos\b.jpg` (same file, kept once), `./a.png`, a WebP, a link inside the folder to a picture inside it. `outside_folder`: `''`, an absolute path, `C:\x.png`, `C:x.png`, `\\host\share\x.png`, `//host/x.png`, `~/x.png`, `../x.png`, `photos/../../x.png`, `photos\..\..\x.png`, a text with U+0000, a link inside the folder to a picture outside it, a link to a folder outside. `not_found`: a missing file, a folder named `c.png`, a link that leads nowhere. `not_a_picture`: a text file named `d.png`, a PNG named `e.txt`, an empty `f.png`. A brief opened through a linked folder accepts its own photos. The same picture in two subjects is accepted for both. A hard link inside the folder is accepted. No call writes a log line. `wide_folder` (the width test takes the folder, the home folder and the platform as inputs, so every case runs on any machine): `/`, `C:\`, `c:\` against `C:\`, `\\host\share\`, `/Volumes/Disk` on macOS (but not `/Volumes/Disk/briefs`), the home folder, the home folder reached through a link; not refused: `{home}/Downloads`, `{home}/Desktop`, `{home}/work/brief`.
  - `tests/integration/campaigns/brief-parse.test.ts` (approved edits): replies gain `subjectPictures`; a text brief with pictures gives `no_folder`; no path appears in any error or log line.
  - The `brief_extraction` job's existing test file gains: an answer whose subject has `pictures` returns a draft without them, and the stored job result has none.
- **Approved edits to existing tests:** `brief-parse.test.ts`, `draft.test.ts`, `bad-line.test.ts` (only if an import path changes), the brief-extraction job test.
- **Exit check:** lint, typecheck, the unit tests under `tests/unit/shared/brief/`, the integration tests named above.
- **Class:** A + B. **Security class, full review.** **After:** nothing.

### SP-2 — Form model: photos, problems, attach plan (built)

- **As built:** `planFromForm(projectId, values, heldSubjectIds, images?, imagesRefused = false)`; the photo rules apply only when `images` is passed. SP-3 widened problem line 4 to any form photo, added or reused, attached to another subject.

- **Exists when done:** `SubjectChoice` has `photos`, `adding`, `notes`; `BriefFormValues` has `placeSubjectPhoto`. `formFromDraft` takes `briefPhotos`. `planFromForm` takes `images` and gives `attach`. The five photo problem lines show in order.
- **New files:** `src/renderer/screens/project-home/brief-form-photos.ts` (`rowPhotos`, `photoProblems`, `attachPlan`, all pure).
- **May touch:** `brief-form-model.ts`, `brief-form-problems.ts`.
- **Tests first:** `tests/unit/renderer/screens/project-home/brief-form-photos.test.ts`: a new row with no photo gives line 3; an existing row with no subject chosen gives no line 3; an existing row whose subject has one attached image (or a missing one) gives no line 3; an attached video does not count; `adding` gives line 2; `images` null gives line 1 and hides 2 to 5; a reused photo with another subject gives line 4 with that subject's ID; one asset in two rows gives line 5 naming the first row; a photo not in `images` is ignored. `attachPlan`: an added photo and a reused unattached photo each give `{ projectId, assetId, subjectId }` with no `library`; a photo attached to the row's own subject gives nothing; order is row then photo. `formFromDraft` gives `placeSubjectPhoto: false`.
- **Approved edits to existing tests:** `brief-form-model.test.ts`, `brief-form-problems.test.ts`: forms meant to be valid gain one photo and an `images` list holding it; calls pass `images`; expected plans gain `attach`; expected values gain `placeSubjectPhoto: false`.
- **Exit check:** lint, typecheck, the pure unit tests `tests/unit/renderer/screens/project-home/brief-form-*.test.ts`.
- **Class:** A. **After:** nothing.

### SP-3 — The "Photos" part of a subject row and the place box (built)

- **Exists when done:** each subject row shows the "Photos" fieldset of `spec/subject-photos.md`: the list, "Add photos", "Remove", the notes, "Adding photos…". "Add photos" picks and imports into the asset library; "Remove" and "Remove subject {i}" remove new assets. Under the subject list, the checkbox "Start the ad with a subject photo placed" with its hint. Above the subject list, "This brief added {n} photo(s) from its folder. Check them before you create the campaign." when the form opened with `n` > 0 photos (A-125). `brief-form/` reads `asset.list { kind: 'image' }` on open and on `project.changed` and passes `images` to the rows and to `planFromForm`.
- **New files:** `src/renderer/screens/project-home/subject-photos/` (`index.ts`, `subject-photos.tsx`, `photo-tile.tsx`, `use-add-photos.ts`, `place-photo-field.tsx`, `subject-photos.module.css`); `src/renderer/screens/project-home/brief-form/use-project-images.ts`.
- **May touch:** `subject-rows/subject-rows.tsx` (a mount point; stable row keys; new props `projectId`, `images`, `onUpdate`; "Remove subject" sends `asset.remove` for the row's added photos); `brief-form/brief-form.tsx` (the images hook, the place box mount).
- **As built:** the new test file may be split into `subject-photos.test.tsx`, `subject-photos-remove.test.tsx` and `subject-photos-fixture.tsx`.
- **Tests first:** `tests/unit/renderer/screens/project-home/subject-photos.test.tsx`: wording and labels; "Add photos" sends `dialog.pickFiles { purpose: 'import', kind: 'image', multiple: true }` then `asset.import { library: 'asset', copy: false }` with no `subjectId`; a cancelled picker sends nothing; a reused ID shows "Already in this project" and is not removed on Remove; a refusal adds the message to the notes; an animated ID adds its note; "Remove" of an added photo sends `asset.remove`; focus after Remove (next, previous, "Add photos"); attached pictures show "Already attached" and no button; a missing file shows "file not found"; the place box starts unticked and sets `placeSubjectPhoto`; the brief line shows with the count of photos in `initial` and is not drawn for 0, and does not change after "Add photos" or "Remove"; axe check.
- **Approved edits to existing tests** (only to add a photo or an `asset.list` stub so the form is valid): `brief-form-fixture.tsx` (stubs for `asset.list`, `dialog.pickFiles`, `asset.import`, and a helper `addPhoto(row)`), `brief-form.test.tsx`, `brief-form-rulings.test.tsx`, `brief-form-languages.test.tsx`, `brief-subject-ids.test.tsx`, `brief-type.test.tsx`, `size-fields.test.tsx`, all under `tests/unit/renderer/screens/project-home/`.
- **Exit check:** lint, typecheck, the component tests named above.
- **Class:** D. **After:** SP-2.

### SP-4 — Brief photos on load, the Create order, cleanup (built)

- **Starts from SP-3's branch**, and turns six red tests in `brief-load.test.tsx` and `project-sections.test.tsx` green.

- **Exists when done:** after `brief.parse`, `brief-load/` imports each subject's checked paths (one `asset.import` per subject, `library: 'asset'`, `copy: true`: a brief's photos are copied, A-124), shows "Adding the brief's photos…", turns notes into lines, and opens the form with `briefPhotos`. "Create campaign" sends `subject.create`, then `asset.update` per `attach` entry, then `campaign.create` with `placeSubjectPhoto`, stopping at the first refusal; after a refusal, made subjects switch rows to "existing" and attached photos stop being `added`. Cancel and unmount remove every still-added photo.
- **New files:** `src/renderer/screens/project-home/brief-load/use-brief-photos.ts`, `brief-load/photo-notes.ts` (the note lines, pure).
- **May touch:** `brief-load/brief-load.tsx`; `brief-form-model.ts` (one line: `placeSubjectPhoto` into the `campaign.create` input); `brief-load/use-text-brief.tsx` only if its `BriefParsed` needs `subjectPictures` left out explicitly.
- **Tests first:** `tests/unit/renderer/screens/project-home/brief-load-photos.test.tsx`: a reply with two subjects' paths sends two imports, each with `copy: true`, and opens the form with the photos; a refused copy (`assets_folder_missing`) gives the "could not be added" note; the `wide_folder` line; notes show each line of the table; a refused import gives "The brief's photos could not be added: {message}"; the order on Create is `subject.create`, `asset.update`…, `campaign.create` (with `placeSubjectPhoto: false` by default, `true` when ticked); a refused `asset.update` stops before `campaign.create` and the made subject's row turns to "Use a subject this project has"; Cancel removes the added photos and not the reused ones; no path is drawn. `photo-notes.test.ts`: each reason's line.
- **Approved edits to existing tests:** `brief-load.test.tsx`, `brief-load-text.test.tsx`, `project-sections.test.tsx`, `project-home.test.tsx`, `brief-form-model.test.ts` (expected `campaign.create` inputs gain `placeSubjectPhoto`).
- **Exit check:** lint, typecheck, the component tests named above.
- **Class:** D. **Security check, short review:** only a picker path, a drop path or a `subjectPictures` path reaches `asset.import`; every `subjectPictures` path goes with `copy: true` and every picked or dropped path with `copy: false`; no path is drawn, logged or put in `brief`; no note goes into a log line or an event. **After:** SP-1, SP-3, SP-6.

### SP-6 — `campaign.create` gains `placeSubjectPhoto` (built)

- **Exists when done:** `campaignCreateInput` has `placeSubjectPhoto?: boolean`. `false` leaves `subject-image` unfilled; left out or `true` fills it as today. `template.slots` is unchanged. `create_campaign` does not offer it.
- **As built:** the `create_campaign` tool uses a second schema, `campaignCreateToolInput`, without `placeSubjectPhoto`; the field is dropped when an agent passes it.
- **May touch:** `src/shared/schemas/commands/campaign.ts`; `src/main/commands/campaign/create.ts`; `src/main/commands/campaign/fills.ts`; `src/main/mcp/tools/table.ts`.
- **Tests first:** `tests/integration/campaigns/campaign-create-fills.test.ts` (approved addition): with a hero image, `placeSubjectPhoto: false` gives a master with no `subject-image` layer and `template.slots` still lists the hero as a candidate; `true` and left out fill it as today. A schema test: a non-boolean is refused. The MCP tool's input schema has no such field (existing MCP schema test, approved addition).
- **Approved edits to existing tests:** none expected beyond the additions.
- **Exit check:** lint, typecheck, `tests/integration/campaigns/campaign-create*.test.ts`, the MCP tool schema test.
- **Class:** A + B. No security review (no new data path). **After:** nothing.

### SP-7 — Subject photos in the reference lists and pre-choices (built)

- **As built:** the lists share one read through `ReferenceRowsContext` (`use-picture-list.ts`). The video card also shows "Photo of {subject id}".

- **Exists when done:** `reference-rows.ts` owns `isReferenceRow` and `subjectPhotoIds`. Every reference list reads `asset.list { kind: 'image' }` and keeps `isReferenceRow`; "Made in this project" drops rows with a subject; an asset-library subject photo shows "Photo of {subject id}". The campaign page pre-ticks, the editor's first draft pre-chooses, and the video card pre-chooses, as in the table of `spec/subject-photos.md`.
- **New files:** `src/renderer/ui/reference-picker/reference-rows.ts`.
- **May touch:** `src/renderer/ui/reference-picker/use-picture-list.ts`, `reference-list.ts`, `reference-picker.tsx` (the "Photo of" text); `src/renderer/editor/generate-fields/use-first-draft.ts`; `src/renderer/screens/campaign/campaign-view/campaign-view.tsx` (the pre-tick); `src/renderer/screens/campaign/video-picture-choice/video-picture-choice.tsx` (the pre-choice).
- **Tests first:** `tests/unit/renderer/ui/reference-rows.test.ts`: a reference-library image with no subject is a row; an asset-library image with a subject is a row; an asset-library image with no subject is not (a generated one is listed only in "Made in this project"); a video is not; `subjectPhotoIds` keeps only the given subjects' images that can be sent, oldest first, at most 8. Component tests: the campaign page ticks a subject's asset-library photo on open, keeps a user's tick on a variant change, and re-fills on a variant change when nothing is ticked; the first draft chooses an asset-library subject photo; the video card chooses the first subject photo when nothing is chosen; the reference dialog shows a subject photo once, in "Reference pictures".
- **Approved edits to existing tests:** `tests/unit/renderer/screens/campaign/reference-fixture.ts`, `reference-picker.test.tsx`, `reference-ticks.test.tsx`, `reference-limit.test.tsx`, `campaign-view.test.tsx`, `campaign-view-paid-count.test.tsx`, `video-picture.test.tsx`; `tests/unit/renderer/dialogs/reference-dialog.test.tsx`; `tests/unit/renderer/editor/generate-fields.test.tsx`: the `asset.list` stub answers the call without a library filter; expected ticks change only where a fixture asset has a subject.
- **Exit check:** lint, typecheck, the component tests named above.
- **Class:** D. **Security check, short review:** a picture reaches a provider only after the user presses Generate or Start with it shown ticked; every send goes through `AssetService.read`; no new command or path. **After:** nothing.

### SP-8 — Placing a reference-library subject photo (built)

- **Exists when done:** the picture chooser shows, under the asset library's pictures, "Subject photos in the reference library" with its hint; choosing one sends `asset.update { library: 'asset' }` and then places it; a refusal shows in the chooser and places nothing. Reference-library files with no subject are not listed.
- **May touch:** `src/renderer/dialogs/picture-chooser/use-pictures.ts`, `picture-chooser.tsx`; a new `picture-chooser/subject-reference-list.tsx` if `picture-chooser.tsx` would pass 200 lines.
- **Tests first:** `tests/unit/renderer/dialogs/picture-chooser.test.tsx` (approved additions): the second list holds only reference-library images with a subject; choosing one sends `asset.update` then `onChoose`, in that order; a refused update sends no `onChoose` and shows the message; with no such image the second list is not drawn. Integration (existing `layer` tests unchanged): a layer source set to a reference-library asset is still refused with `reference_library`.
- **Approved edits to existing tests:** `picture-chooser.test.tsx` (the `asset.list` stub may be called twice).
- **Exit check:** lint, typecheck, the component tests named above.
- **Class:** D. No security review (an existing command, sent by the user's choice). **After:** nothing.

### SP-9 — The prompt ending keeps printing when pictures are sent (built)

- **Exists when done:** `prompt.ts` exports `NO_TEXT_ENDING` (unchanged), `KEEP_PRINTING_ENDING`, `promptEnding(pictures)` and `promptToSend(prompt, { pictures })` as designed in `spec/providers-adapters.md`, "Prompt and text rules". Every caller passes `{ pictures: referenceAssetIds.length }` of its request. A picture or video run with one or more pictures (references or a first frame) stores and sends the "keep printing" ending; a run with none stores and sends "no text". `job.retry` of a picture or video row stores the prompt through `promptToSend` with the old row's picture count, and changes no other request field (the kept-pictures count rule stays). No window change.
- **New files:** `tests/integration/commands/job-retry-prompt.test.ts`.
- **May touch:** `src/shared/generation/prompt.ts`; `src/main/commands/generation/run-images.ts`, `start-video.ts` (one call each); `src/main/jobs/kinds/image-generation.ts`, `video-generation.ts` (one call each); `src/main/commands/job/retry.ts` (`retryRequest` only).
- **Tests first:**
  - `tests/unit/shared/generation/prompt.test.ts` (approved additions): `KEEP_PRINTING_ENDING` is the exact text; `NO_TEXT_ENDING` is unchanged; `promptEnding(0)` is "no text", `promptEnding(1)` and `promptEnding(8)` are "keep printing"; `promptToSend('A bottle', { pictures: 0 })` and `{ pictures: 2 }` each add the right ending after one space; the prompt is trimmed; calling it twice with the same count gives the same text, for both counts; a prompt ending in "no text" sent with 1 picture ends in "keep printing" only, and the other way round; both endings pasted in either order, with spaces and line breaks between, give one ending, the right one; a prompt that is only an ending gives the chosen ending alone; an ending in the middle of the prompt is left there; a cut ending (existing test) still gets the full ending added; neither ending holds the word "product"; `prefilledPrompt` holds neither ending.
  - `tests/integration/generation/run-images.test.ts` (approved edits and additions): with one reference, the stored `request.prompt` ends with "keep printing" once and holds no "no text"; with none, it ends with "no text".
  - `tests/integration/generation/image-kind.test.ts` (approved additions): a job with one reference hands the fake provider the prompt with "keep printing"; a stored prompt that already ends with it is sent unchanged.
  - `tests/integration/generation/start-video.test.ts` (approved additions): a prompt-only start stores "no text"; a first-frame start and a reference start each store "keep printing".
  - `tests/integration/jobs/video-generation.test.ts` (approved additions): the fake provider's `start` gets "keep printing" for a first-frame request and "no text" for a prompt-only one.
  - `tests/integration/generation/comfy-run.test.ts` (approved edits): the run with a reference fills the workflow's prompt slot with the "keep printing" prompt.
  - `job-retry-prompt.test.ts`: retrying a failed picture row with one reference whose stored prompt ends in "no text" gives a new row whose prompt ends in "keep printing" once; a row with no reference keeps its prompt exactly; a first-frame video row is handled like the picture row; no other request field changes; the old row is unchanged.
- **Approved edits to existing tests:** every existing `promptToSend('…')` call in a test gains the second argument, with the count of the pictures that test's run sends; an expected prompt changes only where the run sends a picture. Files: `prompt.test.ts`, `run-images.test.ts`, `image-kind.test.ts`, `start-video.test.ts`, `comfy-run.test.ts`, `video-generation.test.ts`; `tests/integration/commands/job-retry-kept.test.ts` and `job-retry-comfy.test.ts` only where an expected retried request now holds the ending. `tests/live/gemini-reference.live.test.ts`: both prompts are built with `promptToSend(text, { pictures: references.length })` instead of its own copy of the ending, so the stakeholder's next live run checks the final wording. The developer does not run it.
- **Exit check:** lint, typecheck, `tests/unit/shared/generation/`, the integration tests named above, `tests/integration/commands/job-retry*.test.ts`. Fake provider only; no paid run [D-049].
- **Class:** A + B. No security review: the change is two fixed texts and which one is picked; no new command, path or data reaches a provider. **After:** nothing.

### SP-5 — Fixtures, end-to-end and shots updates, exit check (built)

- **Exists when done:** the brief fixtures name small made-up photos; every e2e and shots run that makes a campaign through the form has a photo; new shots 140 to 146; the "Not built" marks in `spec/subject-photos.md` read "Built (SP-n)".
- **New files:** made-up pictures, drawn shapes only, no brand, no text, no person: `tests/fixtures/briefs/photos/citrus-can.png` and `berry-bottle.png` (each a 256×256 PNG, a coloured can or bottle shape on a plain ground), `tests/shots/fixtures/photos/` with the pictures `s2-16-brief.yaml` names; `tests/shots/sp-5.shots.ts`.
- **May touch (fixtures):** `tests/fixtures/briefs/e2e-brief.yaml`, `s2-13-brief.yaml`, `tests/shots/fixtures/s2-16-brief.yaml` (each subject gains `pictures`). `tests/fixtures/briefs/p4-15-brief.md` is not changed; its runs add a photo through "Add photos" using `tests/fixtures/briefs/photos/citrus-can.png`.
- **May touch (helpers):** `tests/e2e/screens.ts` (`loadBriefAndCreate` waits for the photo to show; new helpers `addPhoto(app, form, row, file)` and `untickReferences(page)`), `tests/e2e/workflow-5-1-steps.ts` (`readBriefAndCreate` adds a photo), `tests/e2e/screen-tour.ts`.
- **May touch (specs and shots that make a campaign through the form):** e2e: `comfy-asks.spec.ts`, `comfy-stand-in.spec.ts`, `editor-open.spec.ts`, `jpeg-orientation.spec.ts`, `quit-warning.spec.ts`, `workflow-5-1.spec.ts`, `workflow-5-8-steps.ts`. Shots: `lk-5`, `p3-9`, `p3-10`, `p3-11`, `p3-12`, `p3-13`, `p3-14`, `p3-15`, `p3-16`, `p4-10`, `p4-12`, `p4-13`, `p4-14`, `p4-15`, `p4-16`, `p4-17`, `p4-18`, `p4-19`, `p4-20`, `s2-5`, `s2-6`, `s2-7`, `s2-13`, `s2-14`, `s2-15`, `s2-16`, `tour` (each `tests/shots/{name}.shots.ts`).
- **What changes for those runs.** With the default (box not ticked) the master's layers are as before. But the subject's photos are now pre-ticked as references, so a run that sends a picture or video job now sends them: a job kind may become `image_refs`, and a ComfyUI workflow that takes fewer references refuses with `too_many_references`. A run whose check is about something else calls `untickReferences` before it generates; a run about references updates its expected request. The developer lists each run and which way it went. Shots whose pictures change are taken again and named in the report.
- **New shots** (`tests/shots/sp-5.shots.ts`): `140-brief-photos` (a loaded brief, both rows with photos), `141-photo-notes` (a brief naming an outside path, a missing file and a text file: the notes), `142-typed-brief-no-photo` (the problem line), `143-existing-subject-photos` (a row using a project subject with attached pictures plus one added), `144-place-box-ticked` (the master with the subject photo placed), `145-references-pre-ticked` ("Make pictures" with the subject's photos ticked), `146-chooser-subject-references` (the picture chooser's second list).
- **Exit check:** lint, typecheck, `npm test`, `npm run test:e2e`, the shots runs named above; the exit criteria at the top of this file, checked one by one in the report.
- **Class:** D + a G-style run (the developer runs the end-to-end tests on a desktop). **After:** every other SP slice except SP-9, which shares no file with it.

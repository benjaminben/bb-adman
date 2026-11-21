# Subject photos — a subject is defined by its photos

**Goal:** On the brief form, each subject has at least one photo before a campaign is made; a brief file can name photos beside it; the description stays optional [D-098, R-21].

**Exit criteria**

- A JSON or YAML brief that names photos in its folder opens the form with those photos shown in each subject row; a path outside the folder, a missing file or a non-picture shows its note and is not used.
- "Create campaign" is disabled with "Subject {i}: add at least one photo." until each row has a photo, and with the one-subject lines when a photo belongs elsewhere or sits in two rows.
- After "Create campaign", each photo is attached to its subject in the chosen library, and the subject slot of the master is filled when the first subject has an asset-library photo.
- Cancel leaves no new asset in the project.
- `campaign.create` and `create_campaign` behave as before: an agent can still make a campaign whose subjects have no files.
- Every existing end-to-end and shots run that creates a campaign through the form passes, with the edits named in SP-5.

**Dependencies:** Phase 4 merged (P4-15 `brief.extract`, P4-20 exit check). Not tied to the approvals slices: none of them edits the files below.

**Design:** `spec/subject-photos.md` (everything, assumptions A-110 to A-118). Read also `spec/screens-campaign.md` "The brief form" and `spec/brief-and-templates.md` "What the project page sends".

## Rules for these slices

- Every slice: write the failing tests first, then the code; run lint, typecheck and the tests its class asks (`spec/testing.md`). The full gate runs before release, not per slice.
- A slice edits only the files it owns and the existing files it may touch. A change needed elsewhere: stop and report.
- **Frozen contracts.** Only SP-1 edits `src/shared/schemas/brief.ts` and `src/shared/schemas/commands/brief.ts` (designed in `spec/subject-photos.md`, "Schemas"). Only SP-2 edits `brief-form-model.ts`, `brief-form-problems.ts` and the new `brief-form-photos.ts`.
- **Screens** (D-084): one folder per component, CSS from tokens only. No new token is expected (`--layer-thumb` exists).
- Files stay under 200 lines where they can, 300 at most. `subject-rows.tsx` (147 lines) gains only a mount point for the new `subject-photos/` component.
- Budget: one slice per developer run, well under 300k tokens; hand off with `HANDOFF.md` if near it.

## Order and side-by-side work

| Wave | Slice | Waits for | May run beside |
|------|-------|-----------|----------------|
| 1 | SP-1 Brief photo paths in `brief.parse` | Phase 4 | SP-2 |
| 1 | SP-2 Form model: photos, problems, attach plan | Phase 4 | SP-1 |
| 2 | SP-3 The "Photos" part of a subject row | SP-2 | SP-1 |
| 3 | SP-4 Brief photos on load, the Create order, cleanup | SP-1, SP-3 | Nothing |
| 4 | SP-5 Fixtures, end-to-end and shots updates, exit check | SP-4 | Nothing |

SP-1 works in `src/main/` and `src/shared/schemas/`, SP-2 in `src/renderer/screens/project-home/` model files: no shared file. SP-2 does not need SP-1's types: `formFromDraft` takes `BriefPhotos`, made by SP-4.

## Slices

### SP-1 — Brief photo paths in `brief.parse` (Not built)

- **Exists when done:** `BriefDraft` subjects read `pictures` (text or list). `brief.parse` with a `filePath` replies `subjectPictures`, checked by `checkBriefPictures` with the six rules of `spec/subject-photos.md`; with `text`, every picture gets `no_folder`. `pictureName` gives the shown name. `cleanLineText` is exported from `bad-line.ts` and used by `badLineAt`. `brief-extraction.ts` removes `pictures` from the draft it returns. `Brief` has no `pictures`.
- **New files:** `src/main/assets/brief-pictures.ts`; `src/shared/brief/picture-name.ts`.
- **May touch:** `src/shared/schemas/brief.ts`; `src/shared/schemas/commands/brief.ts`; `src/shared/brief/bad-line.ts` (export `cleanLineText`, no change in behaviour); `src/main/commands/brief/parse.ts`; `src/main/jobs/kinds/brief-extraction.ts`.
- **Tests first:**
  - `tests/unit/shared/brief/picture-name.test.ts`: `photos/a.png` gives `a.png`; `C:\x\b.jpg` gives `b.jpg`; a name with a right-to-left mark or a tab is cleaned; 200 letters cut to 120 with "…"; `''` and `photos/` give `(no name)`.
  - `tests/unit/shared/brief/draft.test.ts` (approved addition): `pictures` as text, as a list, as a number (dropped), as a list with a number (dropped); `Brief` drops a subject's `pictures`.
  - `tests/integration/assets/brief-pictures.test.ts`, in a temp folder holding a brief, a `photos/` folder and a folder beside it: accepted: `a.png`, `photos/b.jpg`, `photos\b.jpg` (same file, kept once), `./a.png`, `A.PNG` when the file is `A.PNG`, a WebP, a link inside the folder to a picture inside it. `outside_folder`: `''`, `/abs/x.png` (any absolute path), `C:\x.png`, `C:x.png`, `\\host\share\x.png`, `//host/x.png`, `~/x.png`, `../x.png`, `photos/../../x.png`, `photos\..\..\x.png`, a text with U+0000, a link inside the folder to a picture outside it, a link to a folder outside. `not_found`: a missing file, a folder named `c.png`, a link that leads nowhere. `not_a_picture`: a text file named `d.png`, a PNG named `e.txt`, an empty `f.png`. A brief opened through a linked folder accepts its own photos. The same picture in two subjects is accepted for both. No call writes a log line (spy on the logger).
  - `tests/integration/campaigns/brief-parse.test.ts` (approved edits): replies gain `subjectPictures` (existing `toEqual` checks add `subjectPictures` with empty entries); a text brief with pictures gives `no_folder`; no path appears in any error or log line.
  - The `brief_extraction` job's existing test file gains: an answer whose subject has `pictures` returns a draft without them, and the stored job result has none.
- **Approved edits to existing tests:** `brief-parse.test.ts`, `draft.test.ts`, `bad-line.test.ts` (only if an import path changes), the brief-extraction job test, as above. Nothing else.
- **Exit check:** lint, typecheck, the unit tests under `tests/unit/shared/brief/`, the integration tests named above.
- **Class:** A + B. **Security class, full review** (paths named by an untrusted file; real-path containment; nothing of a path in logs or errors). **After:** nothing.

### SP-2 — Form model: photos, problems, attach plan (Not built)

- **Exists when done:** `SubjectChoice` has `use`, `photos`, `adding`, `notes`; `emptySubject()` fills them. `formFromDraft` takes `briefPhotos`. `planFromForm` takes `images` and gives `attach`. The five photo problem lines show in the order of `spec/subject-photos.md`, "Problem lines".
- **New files:** `src/renderer/screens/project-home/brief-form-photos.ts` (`rowPhotos`, `photoProblems`, `attachPlan`, all pure).
- **May touch:** `brief-form-model.ts`, `brief-form-problems.ts` (calls `photoProblems` at its place).
- **Tests first:** `tests/unit/renderer/screens/project-home/brief-form-photos.test.ts`: a new row with no photo gives line 3; an existing row with no subject chosen gives no line 3; an existing row whose subject has one attached image (or a missing one) gives no line 3; an attached video does not count; `adding` gives line 2; `images` null gives line 1 and hides 2 to 5; a reused photo with another subject gives line 4 with that subject's ID (the model holds IDs only); one asset in two rows (form photo and attached) gives line 5 naming the first row; a photo not in `images` is ignored. `attachPlan`: added photo gets `library: row.use`; a reused unattached photo gets no `library`; a photo attached to the row's own subject gives nothing; order is row then photo.
- **Approved edits to existing tests:** `brief-form-model.test.ts` and `brief-form-problems.test.ts`: forms meant to be valid gain one photo and an `images` list holding it; calls pass `images`; expected plans gain `attach`. No expected problem line of the existing kinds changes.
- **Exit check:** lint, typecheck, the unit tests of `tests/unit/renderer/screens/project-home/brief-form-*.test.ts` that are pure (`.ts`).
- **Class:** A (pure renderer logic). **After:** nothing.

### SP-3 — The "Photos" part of a subject row (Not built)

- **Exists when done:** each subject row shows the "Photos" fieldset of `spec/subject-photos.md`: the list, "Add photos", "Remove", "Use the photos", the notes, "Adding photos…". "Add photos" picks and imports; "Remove" and "Remove subject {i}" remove new assets. `brief-form/` reads `asset.list { kind: 'image' }` on open and on `project.changed` and passes `images` to the rows and to `planFromForm`.
- **New files:** `src/renderer/screens/project-home/subject-photos/` (`index.ts`, `subject-photos.tsx`, `photo-tile.tsx`, `use-add-photos.ts`, `subject-photos.module.css`); `src/renderer/screens/project-home/brief-form/use-project-images.ts`.
- **May touch:** `subject-rows/subject-rows.tsx` (a mount point, and "Remove subject" calling the cleanup); `brief-form/brief-form.tsx` (the images hook and passing it on).
- **Tests first:** `tests/unit/renderer/screens/project-home/subject-photos.test.tsx`: wording and labels; "Add photos" sends `dialog.pickFiles { purpose: 'import', kind: 'image', multiple: true }` then `asset.import` with the row's library, `copy: false`, no `subjectId`; a cancelled picker sends nothing; a reused ID is shown as "Already in this project, kept in the {library}" and is not removed on Remove; a refusal adds the message to the notes; an animated ID adds its note; "Remove" of an added photo sends `asset.remove`; focus after Remove (next, previous, "Add photos"); attached pictures of an existing subject show with "Already attached" and no button; a missing file shows "file not found"; axe check of the row.
- **Approved edits to existing tests** (each only to add a photo or an `asset.list` stub so the form is valid, never to change an expected line): `brief-form-fixture.tsx` (a stub for `asset.list`, `dialog.pickFiles` and `asset.import`, and a helper `addPhoto(row)`), `brief-form.test.tsx`, `brief-form-rulings.test.tsx`, `brief-form-languages.test.tsx`, `brief-subject-ids.test.tsx`, `brief-type.test.tsx`, `size-fields.test.tsx`, all under `tests/unit/renderer/screens/project-home/`.
- **Exit check:** lint, typecheck, the component tests named above.
- **Class:** D. **After:** SP-2.

### SP-4 — Brief photos on load, the Create order, cleanup (Not built)

- **Exists when done:** after `brief.parse`, `brief-load/` imports each subject's checked paths (one `asset.import` per subject, `library: 'asset'`, `copy: false`), shows "Adding the brief's photos…", turns notes into lines, and opens the form with `briefPhotos`. "Create campaign" sends `subject.create`, then `asset.update` per `attach` entry, then `campaign.create`, stopping at the first refusal; after a refusal, made subjects switch rows to "existing" and attached photos stop being `added`. Cancel and unmount remove every still-added photo.
- **New files:** `src/renderer/screens/project-home/brief-load/use-brief-photos.ts`, `brief-load/photo-notes.ts` (the note lines of the table, pure).
- **May touch:** `brief-load/brief-load.tsx`; `brief-load/use-text-brief.tsx` only if its `BriefParsed` needs `subjectPictures` left out explicitly.
- **Tests first:** `tests/unit/renderer/screens/project-home/brief-load-photos.test.tsx`: a reply with two subjects' paths sends two imports with those paths and opens the form with the photos; a reply with notes shows each line of the table; a refused import gives "The brief's photos could not be added: {message}"; the order of commands on Create is `subject.create`, `asset.update`…, `campaign.create`; a refused `asset.update` stops before `campaign.create` and the made subject's row turns to "Use a subject this project has"; Cancel removes the added photos and not the reused ones; no path is drawn (the page text holds no folder name). `photo-notes.test.ts`: each reason's line.
- **Approved edits to existing tests:** `brief-load.test.tsx`, `brief-load-text.test.tsx`, `project-sections.test.tsx`, `project-home.test.tsx` (stubs for the new calls and a photo so the form is valid; expected command lists gain the `asset.update` step).
- **Exit check:** lint, typecheck, the component tests named above.
- **Class:** D. **Security check, short review:** only a picker path, a drop path or a `subjectPictures` path reaches `asset.import`; no path is drawn, logged or put in `brief`. **After:** SP-1, SP-3.

### SP-5 — Fixtures, end-to-end and shots updates, exit check (Not built)

- **Exists when done:** the brief fixtures name small made-up photos; every e2e and shots run that makes a campaign through the form has a photo; new shots 140 to 144; the "Not built" marks in `spec/subject-photos.md` read "Built (SP-n)".
- **New files:** made-up pictures, drawn shapes only, no brand, no text, no person: `tests/fixtures/briefs/photos/citrus-can.png` and `berry-bottle.png` (each a 256×256 PNG, a coloured can or bottle shape on a plain ground), `tests/shots/fixtures/photos/` with the pictures `s2-16-brief.yaml` names; `tests/shots/sp-5.shots.ts`.
- **May touch (fixtures):** `tests/fixtures/briefs/e2e-brief.yaml` and `s2-13-brief.yaml` (each subject gains `pictures`), `tests/shots/fixtures/s2-16-brief.yaml` (the same). `tests/fixtures/briefs/p4-15-brief.md` is not changed (the AI reader gives no photos); its runs add a photo through "Add photos" using `tests/fixtures/briefs/photos/citrus-can.png`.
- **May touch (helpers):** `tests/e2e/screens.ts` (`loadBriefAndCreate` waits for the photo to show; a new helper `addPhoto(app, form, row, file)` answers the picker and presses "Add photos"; a helper `photosAsGuide(form, row)`), `tests/e2e/workflow-5-1-steps.ts` (`readBriefAndCreate` adds a photo), `tests/e2e/screen-tour.ts`.
- **May touch (specs and shots that make a campaign through the form):** e2e: `comfy-asks.spec.ts`, `comfy-stand-in.spec.ts`, `editor-open.spec.ts`, `jpeg-orientation.spec.ts`, `quit-warning.spec.ts`, `workflow-5-1.spec.ts`, `workflow-5-8-steps.ts`. Shots: `lk-5`, `p3-9`, `p3-10`, `p3-11`, `p3-12`, `p3-13`, `p3-14`, `p3-15`, `p3-16`, `p4-10`, `p4-12`, `p4-13`, `p4-14`, `p4-15`, `p4-16`, `p4-17`, `p4-18`, `p4-19`, `p4-20`, `s2-5`, `s2-6`, `s2-7`, `s2-13`, `s2-14`, `s2-15`, `s2-16`, `tour` (each `tests/shots/{name}.shots.ts`).
- **The filled subject slot.** With the fixtures' photos in the asset library, a new master gains a picture layer in the subject slot. A run whose checks are about the master's layers (counts, order, the chosen layer) either updates its expected layers or, when the check is about something else, calls `photosAsGuide` before Create so the master is as before. Reference-library photos are pre-chosen as reference pictures in the generate fields (`spec/screens-ai.md`), so a run that uses `photosAsGuide` and then sends a picture job checks that its request is unchanged, and unticks them if not (a workflow that takes no reference refuses with `too_many_references`). The developer lists each run and which way it went. Shots whose pictures change are taken again and named in the report.
- **New shots** (`tests/shots/sp-5.shots.ts`): `140-brief-photos` (a loaded brief, both rows with photos), `141-photo-notes` (a brief naming an outside path, a missing file and a text file: the notes), `142-typed-brief-no-photo` (the problem line), `143-existing-subject-photos` (a row using a project subject with attached pictures plus one added), `144-guide-photos` ("Only to guide AI pictures" chosen).
- **Exit check:** lint, typecheck, `npm test`, `npm run test:e2e`, the shots runs named above; the exit criteria at the top of this file, checked one by one in the report.
- **Class:** D + G-style run (the developer runs the end-to-end tests on a desktop). **After:** SP-4.

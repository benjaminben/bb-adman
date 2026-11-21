# Subject photos

A subject (the product, service or person an ad is about) is defined first by one or more photos of it. Its description stays optional. Generating the subject into new angles and scenes is a core use, so every photo of a subject guides the AI, and any of them can also be placed in an ad as it is. This file covers the brief file's `pictures` field and how `brief.parse` checks it, the "Photos" part of the brief form, what "Create campaign" sends, how subject photos reach the reference pickers and the picture chooser, what agents see, and what is out of scope [D-098, R-21].

Every part of this file is **Not built**. Slices: `spec/phases/subject-photos.md` (SP-1 to SP-8). Assumptions A-110 to A-126 are at the end of this file.

Read with: `spec/brief-and-templates.md` (the brief's shape, `brief.parse`, "What the project page sends"), `spec/screens-campaign.md` ("The brief form"), `spec/assets.md` (import, reuse, libraries, reference pictures, the asset protocol), `spec/screens-ai.md` (generate fields, reference dialog), `spec/editor.md` ("Picture chooser"), `.claude/rules/security-priorities.md`.

[REQ: FR-010, FR-011, FR-021, FR-024, FR-053, FR-054, FR-055, FR-062, R-12]

## The rules

- **A subject photo** is a picture asset (`kind = 'image'`) attached to a subject through `asset.subject_id`, in either library. The link is only `asset.subject_id`. The confirmed `Brief`, `campaign.brief`, every MCP reply and every log line hold no photo path.
- **Every subject photo guides the AI.** It is offered as a reference picture wherever reference pictures are chosen, and it is pre-chosen for that subject's variants, whichever library it is in ("Subject photos as reference pictures").
- **Every subject photo can be placed in an ad as it is.** One in the asset library already can; one in the reference library is moved to the asset library when the user places it through the picture chooser ("Placing a subject photo later").
- **R-12 keeps its meaning for every file not attached to a subject:** a reference-library file is only input to generation and is never offered for placing, and an asset-library file that is not a subject photo (and was not made in the project, A-68) is never offered as a reference.
- **The form adds photos to the asset library.** Its one choice is whether the new ad starts with a subject photo placed in the subject picture slot. Default: not placed (A-119).
- **On the brief form every subject needs at least one photo** before "Create campaign" works. The description stays optional.
- **`campaign.create` and the MCP tool `create_campaign` do not check photos.** Agents cannot import files (`asset.import` is denied to them), so an agent can still make a campaign whose subjects have no files. A subject can also lose its files later (`asset.remove`, or `asset.update { subjectId: null }`). So FR-055's third case ("the subject has no files") stays reachable and stays built.

## The brief file (Not built, SP-1)

A subject in a JSON or YAML brief gains one optional field:

```yaml
subjects:
  - id: citrus-can
    name: Citrus can
    pictures:
      - photos/citrus-can-front.png
      - photos/citrus-can-side.jpg
  - name: Berry bottle
    pictures: berry-bottle.webp      # one text is read as a list of one
```

- `pictures` is a text or a list of texts. Each text is a path **relative to the folder the brief file is in**. `/` and `\` both separate folders, so a brief written on Windows works on a Mac and the other way round.
- A path must stay inside the brief's folder or below it. Why: a brief may come from someone else. If it could name any file on the disk, loading it could pull a private picture into the project, and from there it could be sent to an AI provider or published. That is a sensitive-data attack, the kind `.claude/rules/security-priorities.md` says matters.
- A photo must be a PNG, JPEG or WebP picture, judged by its first bytes and its extension, the same check `asset.import` makes (`spec/assets.md`, "File types").
- A photo the brief names but that cannot be used is left out, and the form says why in a plain line in that subject's row (see "Notes from the brief"). It never refuses the whole brief.
- There is no limit on how many photos a subject may name. A brief naming thousands may be slow; that is a nuisance and is not worked on.

### Schemas

`src/shared/schemas/brief.ts` stays the one owner of the brief schema:

```ts
const draftSubject = z.object({
  id: loose(z.string()),
  name: loose(z.string()),
  description: loose(z.string()),
  pictures: loose(z.union([z.string(), z.array(z.string())])),
})
```

- `BriefDraft` carries the raw texts from the file, unchanged. A list with one entry that is not text is dropped whole, like any wrong-typed field.
- `BriefSubject` (inside the confirmed `Brief`) does **not** gain `pictures`. Zod drops unknown keys, so a `pictures` field sent by an agent in `create_campaign`, or by any caller of `campaign.create`, is dropped and never stored.

`src/shared/schemas/commands/brief.ts` gains the checked result:

```ts
type PictureNoteReason =
  'outside_folder' | 'not_found' | 'not_a_picture' | 'not_readable' | 'no_folder' | 'wide_folder'
type PictureNote = { name: string; reason: PictureNoteReason }   // name: see "Shown names"
type SubjectPictures = { paths: string[]; notes: PictureNote[] }
type BriefParsed = {
  draft: BriefDraft
  primaryLanguage: string | null
  subjectPictures?: SubjectPictures[]   // brief.parse always sets it; the AI reader never does
}
```

`subjectPictures` has one entry per entry of `draft.subjects`, in the same order. A subject with no `pictures` gets `{ paths: [], notes: [] }`. `paths` are full paths that passed every check, in the brief's order, each once.

## How `brief.parse` checks the paths (Not built, SP-1, security class)

New file `src/main/assets/brief-pictures.ts` (asset code, because `src/main/assets/` is the only place that builds a file path for an import; `spec/assets.md`, "Single owners"):

```ts
checkBriefPictures(briefPath: string, subjects: BriefDraft['subjects']): Promise<SubjectPictures[]>
```

`brief.parse` calls it in `prepare` after the draft is read, for a `filePath` input only. For a `text` input there is no folder: every given picture gets a note with reason `no_folder` and no path is checked.

**A folder that is too wide** (A-123). First, `realpath` of the brief's folder is compared with a short list. When it is the filesystem root (`/`), a drive or volume root (`C:\`, a `\\host\share\` root), on macOS a direct child of `/Volumes`, or the user's home folder itself (`os.homedir()`, by its real path), no picture is checked: every given picture gets a note with reason `wide_folder`. A folder below the home folder, such as Downloads or Desktop, is not refused, because a brief is often saved there. The comparison is on real paths, and on Windows and macOS without regard to letter case. The test is a pure function in the same file, `isWideFolder(realDir: string, realHome: string, platform: NodeJS.Platform): boolean`, so every case can be tested on any machine.

Otherwise, for each picture text, in this order. The first rule that fails gives the note and the text goes no further:

1. **The text.** Reason `outside_folder` when: it is empty; it holds U+0000; `path.posix.isAbsolute` or `path.win32.isAbsolute` is true for it; it starts with a letter and `:` (`C:x.png`); it starts with `~`; or any part, after splitting on `/` and `\`, is `..`. Empty parts and `.` parts are skipped.
2. **Join.** The parts are joined onto the brief file's folder with `path.join`. Nothing is decoded: `%2e%2e` is a file name.
3. **Real place.** `realpath` of the joined path must be at or inside `realpath` of the brief's folder, judged with `pathAtOrInside` (`src/main/assets/path-resolver.ts`). Otherwise `outside_folder`. This stops a link inside the folder that leads out of it. A `realpath` failure with `ENOENT` or `ENOTDIR` gives `not_found`; any other error gives `not_readable`.
4. **A file.** `stat` of the real path must be a regular file; a folder gives `not_found`.
5. **A picture.** The extension (lower case, after the last dot) must be listed for kind `image` in `src/shared/config/file-types.ts`, and the first `SNIFF_BYTES` must match that type (`src/main/assets/sniff.ts`). Otherwise `not_a_picture`. An error while reading gives `not_readable`; `ENOENT` gives `not_found`.
6. **Once.** A real path already accepted for the same subject is skipped with no note.

The accepted value is the real path. The same file may be accepted for two subjects; the form then refuses it (one photo belongs to one subject, FR-011).

**Nothing of the paths leaves.** `checkBriefPictures` writes no log line and throws nothing for a bad picture; a note is not an error. The reply goes to the window only (agents are denied `brief.parse`). No path enters an error message, a log line, `campaign.brief` or a job row.

**Brief photos are copied** (A-124). A photo a brief names is imported with `copy: true`, so the project keeps its own copy in the assets folder. Why: the sender of a brief may keep write access to its folder for good (a pulled repository, a share they run). A linked photo could later be swapped for a link to any picture the user can read, and the project would then send or publish that picture. Photos the user picks with "Add photos", or drops, are linked as before (`copy: false`): the user chose those files.

**Accepted risk.** A file can still be swapped for a link between this check and the copy made by `asset.import`, a window of one parse and one import. That needs write access to the folder at that moment, as for the other accepted link swaps in `spec/assets.md`. After the copy, the folder no longer matters.

### Shown names

`pictureName(text: string): string` (`src/shared/brief/picture-name.ts`) gives the text a note shows: the part after the last `/` or `\`, then cleaned with `cleanLineText` (steps 2 to 5 of `badLineAt`: tabs to spaces, hidden and reordering characters removed, end trimmed, cut to 120 code points with "…"). `bad-line.ts` exports `cleanLineText` and `badLineAt` calls it, so the character list has one owner. An empty result reads `(no name)`. A note never shows a folder.

## The AI brief reader (Not built, SP-1)

`brief.extract` (Markdown and plain-text briefs) gives no photos. In `src/main/jobs/kinds/brief-extraction.ts`, the draft has `pictures` removed from every subject before it is returned, so a path an AI answer made up is never stored in the job row or shown. Its reply has no `subjectPictures`. The user adds photos on the form. Markdown image links (`![](can.png)`) are not read (A-114): they would be paths steered by the AI's reading, and the form's "Add photos" already does the job.

## The brief form (Not built, SP-2, SP-3)

### The model

`src/renderer/screens/project-home/brief-form-model.ts` gains fields; the photo rules live in a new pure file `brief-form-photos.ts` beside it.

```ts
type FormPhoto = {
  assetId: string
  added: boolean      // this form imported it as a new asset; removed again if not used
}
type SubjectChoice = {
  name: string
  description: string
  mode: 'new' | 'existing'
  newId: string
  existingId: string | null
  photos: FormPhoto[] // in the order added
  adding: boolean     // an "Add photos" import is running for this row
  notes: string[]     // lines about this row's photos (from the brief, a refused import, an animation)
}
type BriefFormValues = {
  // ...the fields of today, and:
  placeSubjectPhoto: boolean   // "Start the ad with a subject photo placed"; false at the start
}
type ProjectImages = AssetList | null   // asset.list { projectId, kind: 'image' }; null while not read

type BriefPhotos = { photos: FormPhoto[]; notes: string[] }[]   // one per draft subject
formFromDraft(reply: BriefParsed | null, heldSubjectIds: string[], briefPhotos?: BriefPhotos): BriefFormValues
planFromForm(projectId: string, values: BriefFormValues, heldSubjectIds: string[], images: ProjectImages): CampaignPlan

type CampaignPlan =
  | { ok: true; subjects: SubjectCreateInput[]; attach: AssetUpdateInput[]; campaign: CampaignCreateInput }
  | { ok: false; problems: string[] }
```

- `emptySubject()` has `photos: []`, `adding: false`, `notes: []`. `formFromDraft` sets `placeSubjectPhoto: false` for a loaded brief and for "Type a brief".
- `formFromDraft` copies `briefPhotos[i]` into subject `i`; with none, the row has no photos and no notes.
- `planFromForm` puts `placeSubjectPhoto: values.placeSubjectPhoto` into the `campaign.create` input (from SP-4, once SP-6 has added the input).
- **A row's photos**, for the rules below: its `photos` whose `assetId` is in `images` with `kind = 'image'`, plus, for an `existing` row with a chosen subject, every image in `images` whose `subjectId` is that subject ("attached"). A photo no longer in `images` is ignored (it was removed elsewhere). An attached picture whose file is missing still counts (A-113).
- **`attach`**, in row order, then photo order: `{ projectId, assetId, subjectId }` for each photo that is not yet attached to any subject (an added one, or a reused one with no subject). A photo already attached to the row's own subject gives nothing. No entry changes a library: added photos are already in the asset library, and a reused photo keeps its own (FR-053, A-115).

### Problem lines

These join the subject problems of `brief-form-problems.ts`, after "Subject {i}: choose a subject.", in this order, each kind over every row before the next kind:

1. "The project's pictures are still being read." (once, while `images` is null and no refusal is known) or "The project's pictures could not be read." (once, after a refused `asset.list`).
2. "Subject {i}: wait for the photos to be added." (the row's `adding` is true).
3. "Subject {i}: add at least one photo." (the row has no photo; for an `existing` row only once a subject is chosen).
4. "Subject {i}: the photo "{name}" belongs to the subject "{subject id}". One photo belongs to one subject." (a row's photo, `added: false`, attached to another subject than the row's own).
5. "Subjects {i} and {j} use the same photo "{name}". One photo belongs to one subject." (one asset ID in two rows, as a form photo or an attached one; `{i}` the first row).

`{name}` is the asset's `displayName`. Lines 2 to 5 skip a row while line 1 shows.

### What a row shows

Inside each "Subject {i}" group, after "Description (optional)" and before the "New subject" radio pair, a fieldset with the legend "Photos":

- A hint: "Photos of the product, service or person. PNG, JPEG or WebP. At least one is needed. AI pictures are drawn from them."
- A list labelled "Photos of subject {i}". One item per photo, in this order: attached pictures first (oldest first), then the form's photos in the order added. Each item:
  - a small picture: `assetUrl(projectId, assetId)`, a `--layer-thumb` square, `alt` the display name. A missing file shows the text "file not found" in its place;
  - the display name as text, hidden from screen readers (the `alt` says it);
  - for an attached picture: the text "Already attached". No button: the form never detaches a picture;
  - for a form photo with `added: false`: "Already in this project";
  - for a form photo: a button "Remove" (`aria-label` "Remove photo {name} from subject {i}").
- With no photo: the line "No photos yet."
- A button "Add photos" (`aria-label` "Add photos to subject {i}").
- While `adding`: the line "Adding photos…" (role `status`) and "Add photos" disabled.
- **Notes**, when `notes` is not empty: a list labelled "Notes on the photos of subject {i}", each line as plain text.

All text is drawn as text, never as markup. No path is ever drawn.

### "Start the ad with a subject photo placed"

One checkbox for the whole form, under the subject list and its "Add subject" button: "Start the ad with a subject photo placed", not ticked at the start. Hint under it: "Every photo guides the AI pictures either way. Ticked: the newest photo of the first subject that has one goes in the subject picture slot as it is. Not ticked: the slot starts empty. Any photo can be placed later." It is `placeSubjectPhoto`.

**Why one box and not one per row:** the starter template has one subject picture slot, filled from the first subject with an asset-library photo (`spec/brief-and-templates.md`, "The starter template"), so a per-row choice would promise more than the template does.

**Why not ticked by default.** The stakeholder: "it will be a common use case that the subjects (including products and people) will be generatively placed at different angles and scenarios". With the box not ticked the master starts with an empty subject slot and the subject's photos pre-chosen as references, ready for a generate run. A user whose packaging must stay as it is (the client's S-13: "our packaging may not be altered or redrawn") ticks it, or places the photo later from the slot view or the picture chooser; the cut-out feature (FR-307) works on a placed picture. Easy to flip (A-119).

### "Add photos"

1. `dialog.pickFiles { purpose: 'import', kind: 'image', multiple: true }`. A cancelled picker sends nothing.
2. The row's `adding` becomes true. `asset.import { projectId, paths, library: 'asset', copy: false }` with no `subjectId` (a new subject does not exist yet).
3. On success: each ID in `assetIds`, in order, not already in the row, becomes a `FormPhoto` with `added` true unless it is in `reusedAssetIds`. Each ID in `animatedAssetIds` adds the note "{name} holds an animation. Adman uses its first picture." `adding` becomes false. Focus stays on "Add photos".
4. On a refusal: the command's message is added to `notes`, no photo is added, `adding` becomes false.
5. If the row or the form is gone when the reply comes, each new (`added`) ID is removed at once (below).

### Removing a form photo

- "Remove" takes the photo out of the row. When it has `added: true`, `asset.remove { projectId, assetId }` is sent (it deletes the row and leaves every file: a picked photo's own file is untouched, and a brief photo's copy stays in the assets folder, A-126). A refusal is ignored: the asset stays in the project, unattached (A-111).
- "Remove subject {i}", "Cancel", and the form going away without a campaign made (the project closes) do the same for every `added: true` photo still in the form.
- Focus after "Remove": the next photo's "Remove" in that row, else the previous one's, else "Add photos".

### Photos from a loaded brief (Not built, SP-4)

After `brief.parse` succeeds and before the form opens, `brief-load/` imports each subject's `subjectPictures[i].paths` with one `asset.import { projectId, paths, library: 'asset', copy: true }` per subject that has paths (one bad file then spoils only that subject's batch). The line "Adding the brief's photos…" (role `status`) shows meanwhile. The results become `briefPhotos[i]` as in "Add photos" step 3; a refused import adds the note "The brief's photos could not be added: {message}" for that subject. Then the form opens through `formFromDraft(reply, held, briefPhotos)`.

**Notes from the brief**, one per `PictureNote`, in the brief's order, `{name}` from `pictureName`:

| Reason | Line |
|--------|------|
| `outside_folder` | "The photo "{name}" was not used: a brief may only name photos in its own folder or below it." |
| `not_found` | "The photo "{name}" was not found." |
| `not_a_picture` | "The file "{name}" is not a picture Adman can use." |
| `not_readable` | "The photo "{name}" could not be read." |
| `no_folder` | "The photo "{name}" was not used: a typed brief has no folder to find it in." |
| `wide_folder` | "The photo "{name}" was not used: put the brief and its photos in a folder of their own." |

These are notes, not problem lines: they do not block. The block comes from "add at least one photo" when nothing usable is left.

**The line above the subject rows** (A-125). When the brief brought photos in, one line shows above the subject list, as plain text: "This brief added {n} photo(s) from its folder. Check them before you create the campaign." `{n}` counts the form photos that came from the brief's import, added or reused, over all rows, at the time the form opens. With `n` 0 the line is not drawn. `brief-form/` counts it once from its `initial` values (the photos in every row when the form opens): only a loaded brief's import can put photos there, so "Type a brief" and the AI reader give 0. It does not change while the form is open, and the model needs no new field.

Importing on open, before the user confirms, is chosen because it lets the window show each photo with the existing asset protocol and gives the asset IDs the one-subject rule needs (see "Showing a photo before Create"). Nothing leaves the machine. Cancel removes the new rows (A-111); the copies a brief's photos made stay in the assets folder with no row naming them, so they are not assets and Package leaves them out (`spec/assets.md`, "Removing an asset"; A-126). A refused copy (for example `assets_folder_missing`) gives the "could not be added" note above.

### Reading the project's pictures

`brief-form/` reads `asset.list { projectId, kind: 'image' }` when the form opens and again on `project.changed` for this project; a reply older than the newest read is dropped. The result is `images` for `planFromForm` and the rows. A refused read shows its message (role `alert`) above the subject list.

## "Create campaign" (Not built, SP-4)

In `brief-load/brief-load.tsx`, with `plan.ok`:

1. `subject.create` for each new subject, in row order.
2. `asset.update` for each entry of `plan.attach`, in order.
3. `campaign.create`, with `placeSubjectPhoto` from the form.

It stops at the first refusal, whose message shows in the banner, as today. `campaign.create` reads the subjects' photos for the slot, so step 2 must come before it.

**After a refusal** the form stays open and is made safe to press again:

- each row whose `subject.create` succeeded switches to "Use a subject this project has" with that subject chosen, so it is not made twice (A-118);
- each photo whose `asset.update` succeeded is now attached: it drops out of the row's form photos and shows as attached. It is no longer `added`, so Cancel does not remove it.

**Why `asset.update` and not `asset.import` with `subjectId` at Create.** The photos are imported when added, to show them and to know their asset IDs. Attaching them is then one field change. A file already in the project (FR-053) is not imported again: it keeps its library and its subject. If it has no subject it is attached to this one; if it has another subject the form says so and blocks (problem line 4) and never moves it (FR-011, A-116).

**Every refusal the steps can give** (shown in the banner):

| Step | Case | Message |
|------|------|---------|
| `subject.create` | ID taken (another window made it) | the command's own |
| `asset.update` | Asset removed meanwhile | `NOT_FOUND`, the command's own |
| `asset.update` | Subject removed meanwhile | "That subject is not in this project." |
| `campaign.create` | any | the command's own, as today |

## `campaign.create`: `placeSubjectPhoto` (Not built, SP-6)

`src/shared/schemas/commands/campaign.ts` (frozen; this change is designed here) gains one optional input: `placeSubjectPhoto?: boolean`.

- Left out or `true`: as today. `slotFills` (`src/main/commands/campaign/fills.ts`) fills `subject-image` with the hero image (the newest asset-library image of the first subject that has one).
- `false`: `subject-image` is left empty, so no layer is made for it (as for a subject with no hero). Nothing else changes: `template.slots` still lists the hero images as candidates, so the slot view offers them.
- The brief form always sends it. The MCP tool `create_campaign` does not offer it, so an agent's campaign fills the slot as today (A-122).

## Subject photos as reference pictures (Not built, SP-7)

**One owner.** New pure file `src/renderer/ui/reference-picker/reference-rows.ts`:

```ts
isReferenceRow(asset: AssetList[number]): boolean   // kind 'image' and (library 'reference' or subjectId !== null)
subjectPhotoIds(rows: AssetList, subjectIds: string[]): string[]   // images attached to these subjects that can be sent, oldest first, at most MAX_REFERENCES_PER_RUN
```

Every list of "reference pictures" reads `asset.list { projectId, kind: 'image' }` (no library filter) and keeps the rows `isReferenceRow` passes. Every pre-choice uses `subjectPhotoIds`. What changes, place by place:

| Place | File | Today | Now |
|-------|------|-------|-----|
| Campaign page, "Make pictures" picker | `ui/reference-picker/use-picture-list.ts` (`library: 'reference'`) | reference library only; nothing pre-ticked | `isReferenceRow`; when the campaign page opens, and when the chosen variant changes while nothing is ticked, the ticks become `subjectPhotoIds` of the chosen variant's subjects (`campaign-view.tsx`, which owns the ticks). A tick the user set is never replaced (A-120) |
| Editor generate fields, the reference dialog's "Reference pictures" list | the same `use-picture-list.ts` | reference library only | `isReferenceRow` |
| The reference dialog's "Made in this project" list | `use-picture-list.ts` (`library: 'asset'`) | generated asset-library images | the same, minus rows with a subject (they show in the first list) |
| Editor first draft | `editor/generate-fields/use-first-draft.ts` | reference-library images of the variant's subjects | `subjectPhotoIds` of the variant's subjects, from the wider list |
| Video card, "Picture to start from" (first frame and "A reference picture") | `ui/reference-picker/reference-list.ts` (`useReferences`), `screens/campaign/video-picture-choice/` | reference library only; nothing pre-chosen | `isReferenceRow`; when nothing is chosen at the first read, the first of `subjectPhotoIds([subjectId])` is chosen (A-120) |

- "Add pictures" in these pickers is unchanged: it imports into the reference library, attached to the variant's first subject when there is one.
- Headings and empty lines stay ("Reference pictures", "No reference pictures in this project yet."). A row that is a subject photo in the asset library shows the extra text "Photo of {subject id}" after its name, so a user knows why an ad picture is listed.
- **No main-side change is needed.** Checked: `generation.runImages` (`run-images.ts`) and `generation.startVideo` (`video-start-checks.ts`, `usablePicture`) take any asset ID the project holds and read it with `AssetService.read`, which checks kind, size and picture type, never the library. Layer commands refuse a reference-library file as a picture source (`check-layer-assets.ts`, reason `reference_library`), which is what keeps R-12 true for placing.

**Agents.** Agents find a subject's photos with `list_assets` filtered by subject (it gives library and subject ID) and, from Phase 10, `list_subjects` (attached asset IDs). `generate_images` and `generate_video` take any image asset ID from `list_assets`. Nothing changes for agents; agents get no pre-choice.

## Placing a subject photo later (Not built, SP-8)

The editor's picture chooser (`src/renderer/dialogs/picture-chooser/`, `use-pictures.ts`) lists the asset library's pictures, as today, and under them a second list "Subject photos in the reference library": the reference-library images that have a subject, each with "Photo of {subject id}". Choosing one sends `asset.update { projectId, assetId, library: 'asset' }` and then the chooser's `onChoose` as for any picture. A refused update shows its message in the chooser and places nothing. The move is shown before it happens by the hint under that list: "Choosing one moves it to the asset library, so it can go on a post. It still guides AI pictures." Reference-library files with no subject are not listed (R-12).

## Showing a photo before Create

Three ways were weighed:

| Option | New privileged surface | Shows the photo | Chosen |
|--------|------------------------|-----------------|--------|
| (a) File names only until Create | None | No | No: the user cannot see what they confirm |
| (b) Import on add, attach on Create | None: `asset.import`, `asset.update`, `asset.remove` and the asset protocol exist and are reviewed | Yes, through `adman-asset:` | **Yes** |
| (c) A main-side preview of a path | A new reader that turns a window-given path into picture bytes for the window | Yes | No: a new file-reading door for a preview |

The cost of (b): the project holds the new rows while the form is open, and an agent's `list_assets` sees them by name. Cancel removes them; a crash leaves them unattached (A-111). The window CSP is unchanged.

## Security rules (SP-1 review, SP-4 and SP-7 checks)

- A path reaches `asset.import` from the window only when the system picker returned it, a drop gave it, or a `brief.parse` reply listed it in `subjectPictures`. `spec/assets.md`, "Accepted risks", says so.
- `asset.import` checks a brief photo exactly as a picked file. A brief photo is copied into the assets folder (`copy: true`); a picked or dropped photo is linked (`copy: false`).
- A hard link inside the brief's folder is accepted as an ordinary file: it passes the real-path check because it has no link to follow. Making one needs write access the user already has, and the photo is copied at import, so it cannot change later.
- Picture notes are shown on the user's own screen only. They are never logged, never put in an event and never returned to an agent, because a note's reason can tell whether a file outside the folder exists.
- The window never draws a path; notes show `pictureName` only.
- No path in `campaign.brief`, a job row, an MCP reply, an error message or a log line.
- The brief's folder is judged on real paths, so a brief opened through a linked folder, and a link inside the folder, are both handled.
- **Pre-chosen references send pictures to a provider.** A subject photo is now pre-chosen in more places, and in either library. A picture is still sent only when the user presses Generate or Start, it is listed and ticked on screen first, and it goes through `AssetService.read` (kind, size and type checks; a clean PNG). A hostile project's linked row attached to a subject could be pre-chosen; this is the accepted risk of `spec/assets.md` ("A linked path may name any file…"), now reached through a pre-tick as well as a hand tick. SP-7's review checks this stays true.
- Threats in scope (`.claude/rules/security-priorities.md`): a hostile brief naming a private picture elsewhere on the disk (sensitive data) is stopped by rules 1 and 3. A brief naming a non-picture file is stopped by rule 5. A slow brief with many photos is a nuisance and is not worked on.

## What agents see

- Agents are still denied `asset.import`, `subject.create` and `brief.parse`. `create_campaign` accepts subjects with no photos; a `pictures` field in its brief is dropped; it fills the subject slot as today.
- An agent sees photos as assets (`list_assets`, `list_subjects` from Phase 10) and may send any of them as a reference picture.

## Wording

The UI says "Photos" and "photo". It never says "product shot" or "product photo": a subject can be a product, a service or a person, and there is no field for which (FR-010). The prompt pre-fill already uses the subject's name when it has no description (`src/shared/generation/prompt.ts`); nothing changes there [REQ: FR-062].

## Out of scope

- Choosing per subject which photo is placed; the newest of the first subject with one fills the slot, as today.
- Detaching or moving an attached picture from the brief form.
- Moving a picture back from the asset library to the reference library from any screen.
- Copying photos into the assets folder from the form (they are linked; the import dialog has the copy choice).
- Photos in Markdown briefs, and photos named by URL.
- Any check in `campaign.create` or `create_campaign` that a subject has a photo; `placeSubjectPhoto` for agents.
- A limit on the number of photos. A pre-choice of more photos than a ComfyUI workflow takes is refused by the run with `too_many_references`, as today for subject reference pictures; the user unticks.

## Assumptions

- **A-110. The brief form adds photos to the asset library**, with no library choice. They guide AI pictures through the widened reference lists and can be placed at once. *SP-3. Change later: easy.*
- **A-111. Photos are imported when added**, brief photos when the form opens, and removed again on Remove or Cancel. A crash or a refused remove leaves an unattached linked asset, harmless and visible in the library. *SP-3, SP-4. Easy.*
- **A-112. Brief photo paths resolve against the brief file's folder**, and a path outside it is never used; there is no "allow it anyway" choice. *SP-1. Easy.*
- **A-113. An attached picture whose file is missing counts as a photo** for "add at least one photo"; the relink dialog finds it. *SP-2. Easy.*
- **A-114. The AI brief reader gives no photos**, and Markdown image links are not read. *SP-1. Easy.*
- **A-115. A photo already in the project keeps its library** when the form attaches it. *SP-2. Easy.*
- **A-116. A photo attached to another subject blocks Create**; the form never moves it. *SP-2. Easy.*
- **A-117. The brief file cannot say whether to place a photo**; the form's box decides. *SP-1. Easy.*
- **A-118. After a refused step on Create, rows whose subject was made switch to "Use a subject this project has"**, so pressing again does not make it twice. *SP-4. Easy.*
- **A-119. "Start the ad with a subject photo placed" is not ticked at the start**, because generating the subject into new scenes is the common case (the orchestrator's reading of the stakeholder's note). Flipping it is one default in `formFromDraft`. *SP-2. Easy.*
- **A-120. Pre-choice on the campaign page and the video card** happens when the page opens, and on a variant change only while nothing is ticked; a user's own ticks are kept. *SP-7. Easy.*
- **A-121. The picture chooser moves a reference-library subject photo to the asset library when it is placed**, and nothing moves it back. *SP-8. Easy.*
- **A-122. `create_campaign` does not offer `placeSubjectPhoto`**; an agent's campaign fills the slot as today. *SP-6. Easy.*
- **A-123. A brief in a folder that is too wide brings no photos**: the filesystem root, a drive or volume root, a direct child of `/Volumes` on macOS, or the home folder itself. Downloads and Desktop are allowed. *SP-1. Easy.*
- **A-124. Photos a brief names are copied into the assets folder**; photos the user picks or drops stay linked. *SP-4. Easy.*
- **A-125. A line above the subject rows says how many photos the brief added**, counted once when the form opens. *SP-3. Easy.*
- **A-126. Cancel leaves a brief photo's copy in the assets folder** with no row naming it; it is not an asset and Package leaves it out. Removing such files waits for OI-44 (managed files and the system bin). *SP-4. Easy.*

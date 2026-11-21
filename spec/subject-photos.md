# Subject photos

A subject (the product, service or person an ad is about) is defined first by one or more photos of it. Its description stays optional. This file covers the brief file's `pictures` field, how `brief.parse` checks those paths, the "Photos" part of each subject row on the brief form, what "Create campaign" sends and in what order, what agents see, and what is out of scope [D-098, R-21].

Every part of this file is **Not built**. Slices: `spec/phases/subject-photos.md` (SP-1 to SP-5). Assumptions A-110 to A-118 are at the end of this file.

Read with: `spec/brief-and-templates.md` (the brief's shape, `brief.parse`, "What the project page sends"), `spec/screens-campaign.md` ("The brief form"), `spec/assets.md` (import, reuse, libraries, the asset protocol), `.claude/rules/security-priorities.md`.

[REQ: FR-010, FR-011, FR-021, FR-024, FR-053, FR-054, FR-055, FR-062, R-12]

## The rule

- On the brief form, every subject needs at least one photo before "Create campaign" works. A photo is a picture asset (`kind = 'image'`) attached to the subject through `asset.subject_id`, as today.
- The description stays optional everywhere.
- The link between a subject and its photos is only `asset.subject_id`. The confirmed `Brief`, `campaign.brief`, every MCP reply and every log line hold no photo path.
- **The command `campaign.create` and the MCP tool `create_campaign` do not change.** They do not check photos. Agents cannot import files (`asset.import` is denied to them), so an agent can still make a campaign whose subjects have no files. A subject can also lose its files later (`asset.remove`, or `asset.update { subjectId: null }`). So FR-055's third case ("the subject has no files") stays reachable and stays built: the subject slot is empty and the prompt is pre-filled from the subject and the message. Only the form requires a photo.

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
type PictureNoteReason = 'outside_folder' | 'not_found' | 'not_a_picture' | 'not_readable' | 'no_folder'
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

For each picture text, in this order. The first rule that fails gives the note and the text goes no further:

1. **The text.** Reason `outside_folder` when: it is empty; it holds U+0000; `path.posix.isAbsolute` or `path.win32.isAbsolute` is true for it; it starts with a letter and `:` (`C:x.png`); it starts with `~`; or any part, after splitting on `/` and `\`, is `..`. Empty parts and `.` parts are skipped.
2. **Join.** The parts are joined onto the brief file's folder with `path.join`. Nothing is decoded: `%2e%2e` is a file name.
3. **Real place.** `realpath` of the joined path must be at or inside `realpath` of the brief's folder, judged with `pathAtOrInside` (`src/main/assets/path-resolver.ts`). Otherwise `outside_folder`. This stops a link inside the folder that leads out of it. A `realpath` failure with `ENOENT` or `ENOTDIR` gives `not_found`; any other error gives `not_readable`.
4. **A file.** `stat` of the real path must be a regular file; a folder gives `not_found`.
5. **A picture.** The extension (lower case, after the last dot) must be listed for kind `image` in `src/shared/config/file-types.ts`, and the first `SNIFF_BYTES` must match that type (`src/main/assets/sniff.ts`). Otherwise `not_a_picture`. An error while reading gives `not_readable`; `ENOENT` gives `not_found`.
6. **Once.** A real path already accepted for the same subject is skipped with no note.

The accepted value is the real path. The same file may be accepted for two subjects; the form then refuses it (one photo belongs to one subject, FR-011).

**Nothing of the paths leaves.** `checkBriefPictures` writes no log line and throws nothing for a bad picture; a note is not an error. The reply goes to the window only (agents are denied `brief.parse`). No path enters an error message, a log line, `campaign.brief` or a job row.

**Accepted risk.** A file can be swapped for a link between this check and the later `asset.import`. That needs write access to the user's folders while the form is open, as for the other accepted link swaps in `spec/assets.md`.

### Shown names

`pictureName(text: string): string` (`src/shared/brief/picture-name.ts`) gives the text a note shows: the part after the last `/` or `\`, then cleaned with `cleanLineText` (steps 2 to 5 of `badLineAt`: tabs to spaces, hidden and reordering characters removed, end trimmed, cut to 120 code points with "…"). `bad-line.ts` exports `cleanLineText` and `badLineAt` calls it, so the character list has one owner. An empty result reads `(no name)`. A note never shows a folder.

## The AI brief reader (Not built, SP-1)

`brief.extract` (Markdown and plain-text briefs) gives no photos. In `src/main/jobs/kinds/brief-extraction.ts`, the draft has `pictures` removed from every subject before it is returned, so a path an AI answer made up is never stored in the job row or shown. Its reply has no `subjectPictures`. The user adds photos on the form. Markdown image links (`![](can.png)`) are not read (A-114): they would be paths steered by the AI's reading, and the form's "Add photos" already does the job.

## The brief form: the "Photos" part (Not built, SP-2, SP-3)

### The model

`src/renderer/screens/project-home/brief-form-model.ts` gains fields; the photo rules live in a new pure file `brief-form-photos.ts` beside it.

```ts
type PhotoUse = 'asset' | 'reference'
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
  use: PhotoUse       // the library for the photos this form adds; 'asset' at the start
  photos: FormPhoto[] // in the order added
  adding: boolean     // an "Add photos" import is running for this row
  notes: string[]     // lines about this row's photos (from the brief, a refused import, an animation)
}
type ProjectImages = AssetList | null   // asset.list { projectId, kind: 'image' }; null while not read

type BriefPhotos = { photos: FormPhoto[]; notes: string[] }[]   // one per draft subject
formFromDraft(reply: BriefParsed | null, heldSubjectIds: string[], briefPhotos?: BriefPhotos): BriefFormValues
planFromForm(projectId: string, values: BriefFormValues, heldSubjectIds: string[], images: ProjectImages): CampaignPlan

type CampaignPlan =
  | { ok: true; subjects: SubjectCreateInput[]; attach: AssetUpdateInput[]; campaign: CampaignCreateInput }
  | { ok: false; problems: string[] }
```

- `emptySubject()` has `use: 'asset'`, `photos: []`, `adding: false`, `notes: []`.
- `formFromDraft` copies `briefPhotos[i]` into subject `i`; with none, the row has no photos and no notes.
- **A row's photos**, for the rules below: its `photos` whose `assetId` is in `images` with `kind = 'image'`, plus, for an `existing` row with a chosen subject, every image in `images` whose `subjectId` is that subject ("attached"). A photo no longer in `images` is ignored (it was removed elsewhere). An attached picture whose file is missing still counts (A-113).
- **`attach`**, in row order, then photo order:
  - a photo with `added: true`: `{ projectId, assetId, subjectId, library: row.use }`;
  - a photo with `added: false` (it was in the project before) whose asset has no subject: `{ projectId, assetId, subjectId }`. Its library is left as it is (FR-053: a reused file keeps its own library; A-115);
  - a photo already attached to the row's own subject: nothing.

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

- A hint: "Photos of the product, service or person. PNG, JPEG or WebP. At least one is needed."
- A list labelled "Photos of subject {i}". One item per photo, in this order: attached pictures first (oldest first), then the form's photos in the order added. Each item:
  - a small picture: `assetUrl(projectId, assetId)`, a `--layer-thumb` square, `alt` the display name. A missing file shows the text "file not found" in its place;
  - the display name as text, hidden from screen readers (the `alt` says it);
  - for an attached picture: the text "Already attached", and its library as words ("asset library" or "reference library"). No button: the form never detaches a picture;
  - for a form photo with `added: false`: "Already in this project, kept in the {library}";
  - for a form photo: a button "Remove" (`aria-label` "Remove photo {name} from subject {i}").
- With no photo: the line "No photos yet."
- A button "Add photos" (`aria-label` "Add photos to subject {i}").
- A radio group "Use the photos":
  - "In the ad, as they are" (chosen at the start). Hint: "Asset library. The newest goes in the subject picture slot. Choose this for packaging that must not be changed."
  - "Only to guide AI pictures". Hint: "Reference library. AI draws new pictures from them. Choose this for a person or a product shown in new scenes."
  - The choice is the library of the photos this form adds. A line under it when the row has any photo with `added: false` or attached: "Photos already in the project keep their library."
- While `adding`: the line "Adding photos…" (role `status`) and "Add photos" disabled.
- **Notes**, when `notes` is not empty: a list labelled "Notes on the photos of subject {i}", each line as plain text.

All text is drawn as text, never as markup. No path is ever drawn.

**Why the default is the asset library.** A photo in the asset library goes on the post as it is: the subject slot fills at once with the newest one (FR-055 case 1), the client's packaging is never redrawn (S-13: "our packaging may not be altered or redrawn"), and the cut-out feature (FR-307) works on a placed picture. The reference library suits a person or a product the AI should draw in new scenes; one click switches to it. The choice is per row, not per photo, because one subject is usually one kind of thing; mixing is done later in the asset library (A-110).

### "Add photos"

1. `dialog.pickFiles { purpose: 'import', kind: 'image', multiple: true }`. A cancelled picker sends nothing.
2. The row's `adding` becomes true. `asset.import { projectId, paths, library: row.use, copy: false }` with no `subjectId` (a new subject does not exist yet).
3. On success: each ID in `assetIds`, in order, not already in the row, becomes a `FormPhoto` with `added` true unless it is in `reusedAssetIds`. Each ID in `animatedAssetIds` adds the note "{name} holds an animation. Adman uses its first picture." `adding` becomes false. Focus stays on "Add photos".
4. On a refusal: the command's message is added to `notes`, no photo is added, `adding` becomes false.
5. If the row or the form is gone when the reply comes, each new (`added`) ID is removed at once (below).

### Removing a form photo

- "Remove" takes the photo out of the row. When it has `added: true`, `asset.remove { projectId, assetId }` is sent (it deletes the row and leaves the file, which was linked and is untouched). A refusal is ignored: the asset stays in the project, unattached (A-111).
- "Remove subject {i}", "Cancel", and the form going away without a campaign made (the project closes) do the same for every `added: true` photo still in the form.
- Focus after "Remove": the next photo's "Remove" in that row, else the previous one's, else "Add photos".

### Photos from a loaded brief (Not built, SP-4)

After `brief.parse` succeeds and before the form opens, `brief-load/` imports each subject's `subjectPictures[i].paths` with one `asset.import { projectId, paths, library: 'asset', copy: false }` per subject that has paths (one bad file then spoils only that subject's batch). The line "Adding the brief's photos…" (role `status`) shows meanwhile. The results become `briefPhotos[i]` as in "Add photos" step 3; a refused import adds the note "The brief's photos could not be added: {message}" for that subject. Then the form opens through `formFromDraft(reply, held, briefPhotos)`.

**Notes from the brief**, one per `PictureNote`, in the brief's order, `{name}` from `pictureName`:

| Reason | Line |
|--------|------|
| `outside_folder` | "The photo "{name}" was not used: a brief may only name photos in its own folder or below it." |
| `not_found` | "The photo "{name}" was not found." |
| `not_a_picture` | "The file "{name}" is not a picture Adman can use." |
| `not_readable` | "The photo "{name}" could not be read." |
| `no_folder` | "The photo "{name}" was not used: a typed brief has no folder to find it in." |

These are notes, not problem lines: they do not block. The block comes from "add at least one photo" when nothing usable is left.

Importing on open, before the user confirms, is chosen because it lets the window show each photo with the existing asset protocol and gives the asset IDs the one-subject rule needs (see "Showing a photo before Create"). Nothing leaves the machine and nothing is copied; Cancel removes the new rows (A-111).

### Reading the project's pictures

`brief-form/` reads `asset.list { projectId, kind: 'image' }` when the form opens and again on `project.changed` for this project; a reply older than the newest read is dropped. The result is `images` for `planFromForm` and the rows. A refused read shows its message (role `alert`) above the subject list.

## "Create campaign" (Not built, SP-4)

In `brief-load/brief-load.tsx`, with `plan.ok`:

1. `subject.create` for each new subject, in row order.
2. `asset.update` for each entry of `plan.attach`, in order.
3. `campaign.create`.

It stops at the first refusal, whose message shows in the banner, as today. `campaign.create` fills the subject slot from the hero images, so step 2 must come before it.

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
| `asset.update` | Move into the reference library while in use (an agent placed it meanwhile) | `asset_in_use`, the command's own |
| `campaign.create` | any | the command's own, as today |

## Showing a photo before Create

Three ways were weighed:

| Option | New privileged surface | Shows the photo | Chosen |
|--------|------------------------|-----------------|--------|
| (a) File names only until Create | None | No | No: the user cannot see what they confirm |
| (b) Import on add, attach on Create | None: `asset.import`, `asset.update`, `asset.remove` and the asset protocol exist and are reviewed | Yes, through `adman-asset:` | **Yes** |
| (c) A main-side preview of a path | A new reader that turns a window-given path into picture bytes for the window | Yes | No: a new file-reading door for a preview |

The cost of (b): the project holds the new rows while the form is open, and an agent's `list_assets` sees them by name. Cancel removes them; a crash leaves them unattached (A-111). The window CSP is unchanged.

## Security rules (SP-1 review, SP-4 check)

- A path reaches `asset.import` from the window only when the system picker returned it, a drop gave it, or a `brief.parse` reply listed it in `subjectPictures`. `spec/assets.md`, "Accepted risks", says so.
- `asset.import` checks a brief photo exactly as a picked file. Nothing is copied (`copy: false`).
- The window never draws a path; notes show `pictureName` only.
- No path in `campaign.brief`, a job row, an MCP reply, an error message or a log line.
- The brief's folder is judged on real paths, so a brief opened through a linked folder, and a link inside the folder, are both handled.
- Threats in scope (`.claude/rules/security-priorities.md`): a hostile brief naming a private picture elsewhere on the disk (sensitive data) is stopped by rules 1 and 3. A brief naming a non-picture file is stopped by rule 5. A slow brief with many photos is a nuisance and is not worked on.

## What agents see

- Nothing changes for agents. They are still denied `asset.import`, `subject.create` and `brief.parse`. `create_campaign` accepts subjects with no photos; a `pictures` field in its brief is dropped.
- An agent sees photos as assets: `list_assets` by name and ID, and `list_subjects` (Phase 10) gives each subject's attached asset IDs.

## Wording

The UI says "Photos" and "photo". It never says "product shot" or "product photo": a subject can be a product, a service or a person, and there is no field for which (FR-010). The prompt pre-fill already uses the subject's name when it has no description (`src/shared/generation/prompt.ts`); nothing changes there [REQ: FR-062].

## Out of scope

- Choosing the library per photo, and saying the use in the brief file (A-110, A-117).
- Choosing which photo is the hero on the form; the newest fills the slot, as today.
- Detaching or moving an already attached picture from the form.
- Copying photos into the assets folder from the form (they are linked; the import dialog has the copy choice).
- Photos in Markdown briefs, and photos named by URL.
- Any check in `campaign.create` or `create_campaign` that a subject has a photo.
- A limit on the number of photos.

## Assumptions

- **A-110. One library choice per subject row**, default "In the ad, as they are" (asset library). *SP-3. Change later: easy.*
- **A-111. Photos are imported when added**, brief photos when the form opens, and removed again on Remove or Cancel. A crash or a refused remove leaves an unattached linked asset, harmless and visible in the library. *SP-3, SP-4. Easy.*
- **A-112. Brief photo paths resolve against the brief file's folder**, and a path outside it is never used; there is no "allow it anyway" choice. *SP-1. Easy.*
- **A-113. An attached picture whose file is missing counts as a photo** for "add at least one photo"; the relink dialog finds it. *SP-2. Easy.*
- **A-114. The AI brief reader gives no photos**, and Markdown image links are not read. *SP-1. Easy.*
- **A-115. A photo already in the project keeps its library**; the row's choice applies only to photos new to the project. *SP-2. Easy.*
- **A-116. A photo attached to another subject blocks Create**; the form never moves it. *SP-2. Easy.*
- **A-117. The brief file cannot say how photos are used**; every brief photo starts in the asset library. *SP-1. Easy.*
- **A-118. After a refused step on Create, rows whose subject was made switch to "Use a subject this project has"**, so pressing again does not make it twice. *SP-4. Easy.*

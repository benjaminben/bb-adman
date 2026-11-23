# Assets

An asset is one file known to a project: a picture, video, font or text file, imported by the user or made by a job. This file covers linked files and the assets folder, import, accepted file types and how a type is recognised, WebP, relink, change detection, the `adman-asset://` protocol, reference pictures, generated assets, and the accepted risks that concern asset files.

Read with: `spec/data-model.md` (the `asset` and `project_meta` tables, ID formats), `spec/data-rules.md` (Package project, the prepare and run steps of commands that touch files), `spec/api-commands.md` (`asset.*` and `project.setAssetsDir` inputs and replies), `spec/security.md` (threat model). Jobs that make assets: `spec/jobs.md`.

[REQ: FR-007, FR-009, FR-050 to FR-056, FR-068, FR-294 to FR-299, R-06, R-07, R-08, R-12]

## Where asset files live

Built. Main files: `src/main/assets/path-resolver.ts`, `src/main/assets/service.ts`.

| Location | Contents |
|----------|----------|
| Assets folder, default `{Name} Assets/` beside the project file | Generated files, and imported files the user chose to copy (`storage = 'managed'`) |
| Anywhere on disk | Linked imported files (`storage = 'linked'`) |
| App data folder, `thumbnails/` | Thumbnails (Phase 3) |

- A managed file is named `{assetId}.{ext}` in the assets folder. A linked file keeps its own name and place. Linking in place is the default for imports from the window (ADR-002).
- **Resolving an asset's file:** `rel_path` against the project file's folder first, then `abs_path`. A path that is not a regular file is skipped. If neither is a file, the asset is missing [REQ: FR-009, R-06]. `project.get` gives the missing count from `AssetService.missingAssetIds`; `asset.list` marks each row `missing`.
- **Finding the assets folder:** `assets_dir_rel` against the project file's folder first, then `assets_dir_abs` (both in `project_meta`). When neither exists yet, the `rel` place, where the first managed file will create it. This is why a packaged or moved project opens with nothing missing.
- **Single owners.** `src/main/assets/path-resolver.ts` is the only file that builds an asset path; callers outside `src/main/assets/` never build one. Only asset code reads `assets_dir_rel` or `assets_dir_abs`. Accepted file types: `src/shared/config/file-types.ts`. Package layout: `src/main/assets/package.ts`.
- **Table ownership.** Asset code writes `asset` and `project_meta`. Campaign code reads `asset` rows by ID (hero images, required assets) and never builds a path. Asset code reads `subject`, `rule_set`, `layer` and `background_clip` to check `asset.update` and to refuse `asset.remove` while an asset is in use. Rows are read through `src/main/db/rows.ts` and written through `project.orm` inside `run`, each written row named with `ctx.changes.touch`.

### The asset service (frozen contract)

Built. `AssetService` on `CoreDeps.assets` (`src/main/assets/types.ts`). `src/main/core.ts` uses `createAssetService()` with no argument; `createAssetService(options?: { maxPictureBytes?: number })` uses `MAX_PICTURE_BYTES` unless a test passes a smaller limit. There is no stand-in.

```ts
type AssetService = {
  missingAssetIds(project: ProjectHandle): Promise<string[]>   // assets whose file cannot be found
  resolve(project: ProjectHandle, assetId: string): Promise<string | 'missing'>
  assetsDir(project: ProjectHandle): string
  // Writes {assetsDir}/{assetId}.{ext}, creating the assets folder on first use.
  writeManaged(project: ProjectHandle, file: { assetId: string; ext: string; bytes: Uint8Array }): Promise<void>
  // The picture's bytes and the type they show (PNG or JPEG), not the row's mime.
  read(project: ProjectHandle, assetId: string): Promise<ImageFile>
}
```

Test: `tests/integration/core-options.test.ts` ("puts the asset service and the job service on CoreDeps").

### Managed file names (security class)

Built. `managedPath(dir, assetId, ext)` in `path-resolver.ts` throws a plain `Error` unless `assetId` is a ULID (`/^[0-9A-HJKMNP-TV-Z]{26}$/`) and `ext` matches `^[a-z0-9]{1,10}$`. `path-resolver.ts` is the one owner of these patterns and exports `isManagedName(assetId, ext)`. So a managed path never leaves the assets folder, whatever a project file holds. `writeManaged` relies on it and does not look at the bytes, so a test calling it directly must hand real bytes of the type it names. Files are written with the `wx` flag: never over an existing file.

`pathAtOrInside(dir, p)` in `path-resolver.ts` is the one owner of "is this path at or inside that folder": true for `dir` itself, a child, a deep child, a child named `..x`; false for the parent, a sibling, and a sibling named `..x`. Built on `pathInside`.

### Creating the assets folder (security class)

Built. `ensureAssetsDir` in `src/main/assets/service.ts`, called by `writeManaged` and by `place` in `import.ts`; neither has a `mkdir` of its own. The folder is created on first use (the first copied import or generated file), not when the project is created. A project with no managed files has no assets folder, and that is not an error.

1. If the folder `assetsDirOf` gives exists (`stat`), it is used, wherever it is.
2. If not, it may be created only inside the project file's folder. First a text check with `pathInside`.
3. Then `lstat` the folder path: a real folder (not a link) is used, and `mkdir` is never called on that branch; a file or a link of any kind refuses and is left unchanged; nothing there goes on to step 4.
4. `nearestRealParent` walks up from the parent while `realpath` fails with `ENOENT` or `ENOTDIR`. On such a failure it `lstat`s the same path: success means a link that leads nowhere, which refuses; it steps up only when `lstat` also fails with `ENOENT` or `ENOTDIR`; any other error refuses. The real path found must be at or inside `realpath` of the project file's folder.
5. `mkdir`. A failed `mkdir` refuses the same way.

Refusal: `RULE_VIOLATION`, reason `assets_folder_missing`, message "The assets folder could not be found. Choose the assets folder again." The default folder is made on first use also when the project was opened through a link to its folder. A missing assets folder outside the project's folder is never made again; the user chooses again [REQ: FR-296]. Two pictures of a project's first job both store (step 3 handles the race). Tests: `tests/integration/assets/assets-dir-race.test.ts`, `tests/integration/generation/image-kind-race.test.ts`; `assets-dir-create-links.test.ts` must pass unchanged.

### Choosing another assets folder

Built. `project.setAssetsDir { projectId, dir }` (`src/main/commands/project/set-assets-dir.ts`, file side `src/main/assets/assets-dir.ts`). Two steps, not undoable [REQ: FR-007, R-07].

- It moves no file and makes no folder [REQ: FR-295]. The setting says where new managed files go; existing rows keep their paths.
- For each managed asset, if `{dir}/{assetId}.{ext}` is a regular file by `lstat` (a link with that name is left alone), the row's `abs_path` and `rel_path` are set to it, with size, time and hash read again. Otherwise its paths stay. A managed row whose `id` or extension cannot form a path is left alone.
- `dir` must be a full path to an existing folder: not a full path, `INVALID_INPUT` "Choose a folder by its full path."; any `stat` error, `NOT_FOUND` "Choose a folder that exists."; a file, `INVALID_INPUT` "Choose a folder, not a file."
- Refused with `RULE_VIOLATION`, `jobs_running`, "Wait for the running work to finish, then change the assets folder.", while a job is `queued` or `running`: a job writes a file and then adds its row, and both must see one folder.
- Writes `assets_dir_rel` and `assets_dir_abs`, naming both keys to the change recorder. Reply `{ assetsDir, repointedAssetIds }`.

### Removing an asset

Built. `asset.remove` deletes the row and leaves every file on disk, managed files too [REQ: FR-295]. No command ever touches a linked file. Refused with `details = { reason: 'asset_in_use' }` while the asset is a layer's picture, a layer's font, a background clip, or one of a rule set's required assets (`src/main/assets/in-use.ts`). A file in the assets folder that no `asset` row names is not an asset. (OI-44 asked whether a managed file should go to the system bin; today none does.)

`asset.update` refuses only a move into the `reference` library while the asset is in use (`asset_in_use`); an asset already there and in use can still have its other fields changed. `subjectId: null` detaches it from its subject.

## Import [REQ: FR-050 to FR-054, R-08]

Built. `asset.import { projectId, paths, library, subjectId?, copy }`. Files: `src/main/assets/import.ts`, `folder-walk.ts`, `inspect.ts`, `sniff.ts`, `unreadable.ts`; handler `src/main/commands/asset/import.ts`. Agents are denied `asset.import`. An agent imports files only through `asset.importFiles` (the tool `import_assets`): asked every time, at most 20 full paths, always copied, never linked (`spec/security.md`, "Rules: agents and cost").

- Each path comes from the system picker (`dialog.pickFiles`, `purpose: 'import'`). The window sends a path in no other call. `copy: true` saves a copy in the assets folder as `{assetId}.{ext}` (`managed`); `copy: false` links the file where it is (`linked`).
- All file work is in `prepare`: inspect every file first (type, hash, size, time, picture size), then copy the new ones when asked. `run` checks again that no asset with each hash exists yet and inserts the rows. If `run` fails, `undoPrepare` removes the copies.
- **Reuse** [REQ: FR-053]. A file whose content hash is already in the project is not imported again: the existing asset is reused, and keeps its own library and subject.
- **Reply** `{ assetIds, reusedAssetIds, skippedCount, animatedAssetIds }`. `assetIds` has one ID per imported or reused file, in input `paths` order, a folder's files sorted by relative path compared by code point. `reusedAssetIds` holds each ID once, in first-met order, naming assets that were in the project before the command. `skippedCount` counts skipped folder entries, so the app is never silent about them. `animatedAssetIds` holds each ID once, among `assetIds`, of a file that is an animated WebP, read from its first bytes with `webpHeadInfo` (S2-17); a file whose header cannot be read counts as not animated.
- **A path named directly** follows a link. A wrong type or an unreadable file refuses the whole command.
- **Unreadable files.** In `asset.import` and `asset.relink`, an error from `stat`, open, read or hashing other than `ENOENT` and `ENOTDIR` gives `RULE_VIOLATION`, `file_not_readable`, "{file name} could not be read." with no path. One shared helper writes one `warn` line with the command name, reason `file_not_readable` and the OS error code (`EACCES`, `EBUSY`, `EIO` need different help), with no path and no file name. A second `warn` line from the bus is accepted. `ENOENT` gives `NOT_FOUND`.

### Folders (security class)

Built. `src/main/assets/folder-walk.ts` [REQ: FR-050, FR-294; D-053 item 19].

- A path in `paths` that is a folder stands for the files in it and its subfolders.
- `FOLDER_LIMITS = { maxDepth: 12, maxFiles: 500 }` (one owner). At most 12 levels below the named folder: a folder past the depth is not entered and counts as one skipped entry. At most 500 regular files found, skipped ones included, counted before any file is read. Over 500: `INVALID_INPUT`, reason `too_many_files`, nothing imported.
- Inside a folder: an entry that is a link is skipped and never followed (checked with `lstat`); a name starting with a dot is skipped; a file of no accepted type, empty, or unreadable is skipped, not refused. A file's type is decided from its first bytes before it is hashed.
- A directly named folder that cannot be listed refuses with `file_not_readable`.
- An empty folder, even one named like a picture (`pics.png`), succeeds with `{ assetIds: [], reusedAssetIds: [], skippedCount: 0, animatedAssetIds: [] }`.
- The 8-level depth rule of `checkMp4` is unrelated.

## File types and how a type is recognised

Built. `src/shared/config/file-types.ts` (one owner; every picker takes its list from here) and `src/main/assets/sniff.ts` [REQ: FR-051].

A file is accepted when its extension is listed **and** its first bytes match that type. Imported files are untrusted, so the bytes decide, not the name. A caller reads the first `SNIFF_BYTES = 4096` bytes.

| Type | Kind | `mime` | Extensions | Bytes must show |
|------|------|--------|------------|-----------------|
| png | image | `image/png` | `png` | PNG signature (`pictureType`) |
| jpeg | image | `image/jpeg` | `jpg`, `jpeg` | JPEG signature (`pictureType`) |
| webp | image | `image/webp` | `webp` | `RIFF` at 0 and `WEBP` at 8 |
| mp4 | video | `video/mp4` | `mp4` | `ftyp` at 4 |
| mov | video | `video/quicktime` | `mov` | `ftyp`, `moov`, `mdat`, `wide`, `free`, `skip` or `pnot` at 4 |
| webm | video | `video/webm` | `webm` | `1A 45 DF A3` |
| ttf | font | `font/ttf` | `ttf` | `00 01 00 00` or `true` |
| otf | font | `font/otf` | `otf` | `OTTO` |
| woff2 | font | `font/woff2` | `woff2` | `wOF2` |
| text | text | `text/plain`, `text/markdown`, `application/json`, `application/yaml` | `txt`; `md`; `json`; `yaml`, `yml` | first 4,096 bytes valid UTF-8 with no NUL |

- The extension is the lower-case text after the last dot; a name that is only a dot and an extension (`.png`) has none. An empty file matches no type.
- `pickerExtensions(purpose, kind?)`: `import` offers every extension, or only those of `kind` when given; `relink` only those of the asset's kind; `brief` only the text ones.
- **File facts as built.** Width and height come from PNG and JPEG headers only. `font_family` is filled from the font's `name` table at import, relink and the change check (`readFontFamily`, `spec/scene.md`, "Font names at import"); the change check sets it to null when a font file becomes another kind. `duration_ms` is null: Phase 7 reads video. `readFileFacts` hashes before checking type (direct files, relink and the change check; folder import checks type first). MP4 and MOV are recognised by `ftyp` alone, so a HEIC, AVIF or M4A named `.mp4` is taken as video; Phase 7 may tighten this.
- Size limits for pictures sent to a provider (`src/main/providers/picture-limits.ts`): `MAX_PICTURE_BYTES` 32 MiB, `MAX_PICTURE_SIDE` 8,192, `MAX_PICTURE_PIXELS` 24,000,000. Import itself has no size limit.

## WebP

Rule: a picture is never refused only because it is WebP [REQ: FR-298, FR-051]. WebP is accepted everywhere, and the provider or workflow always gets a PNG.

### WebP to PNG conversion

Built (Phase 2, slice WP).

- Import, the library, the asset protocol, showing, placing and export take WebP as it is. A conversion happens only where the main process hands picture bytes on: a reference picture, a first frame, an extend source. The user's file is never changed.
- `generation.runImages`, `generation.startVideo` (its start check lists `image/webp` beside PNG and JPEG) and the reference picker all accept a WebP picture.
- `CoreDeps.webpToPng(bytes: Uint8Array): Promise<Uint8Array>`; the default throws (like `fitPicture`); `src/main/index.ts` fills it from `src/main/windows/webp-window.ts`.
- `src/main/providers/webp-size.ts` reads the RIFF header and first chunk (`VP8 `, `VP8L`, `VP8X`) without decoding, and throws when it cannot. `webpInfo(bytes)` takes a whole file and gives `{ width, height, animated }` before a conversion. `webpHeadInfo(head)` gives the same from a file's first bytes only, for the animation flag at import.
- Called in `readPicture` (`src/main/assets/read-picture.ts`): a WebP by its `sniff.ts` signature is checked with `webpInfo` against `MAX_PICTURE_SIDE` and `MAX_PICTURE_PIXELS` (an over-limit file never reaches the decoder window), converted, then must be a PNG of the size `webpInfo` gave. It then goes through `toPng` like every picture. A failed conversion is `asset_not_a_picture`; over the byte limit, `asset_too_large`. Transparency is kept.
- Animated WebP: first frame only. `asset.import` names these files in `animatedAssetIds` ("Import"), and the import dialog says so (`spec/screens-campaign.md`).
- The decoder window: one hidden sandboxed window with no preload. The main process passes the bytes as a base64 argument of `executeJavaScript` and gets the PNG back as the call's result. One conversion at a time, 10 s limit; a crash, hang or wrong answer fails the conversion and the window is made again at next use. Its security rules: `spec/security.md`, "Rules: the WebP decoder window".
- Tests: unit `webpInfo`; `readPicture` with a stand-in converter; `tests/e2e/webp-decoder.spec.ts` (a still and an animated WebP through the real window).

## Reading a picture to send it (security class)

Built. `AssetService.read` (`src/main/assets/read-picture.ts`) loads a file into memory, and the result goes to a provider.

- The row must be `kind = 'image'`, else `asset_not_a_picture`.
- Before reading, the `stat` size must be at most `MAX_PICTURE_BYTES` (32 MiB). The file is read to the end or to the limit plus one byte, and the bytes read are checked again. Over: `RULE_VIOLATION`, `asset_too_large`, "{display name} is too large to send. The limit is 32 MB."
- The bytes must be PNG, JPEG or WebP by signature. Otherwise `RULE_VIOLATION`, `asset_not_a_picture`, "{display name} is not a picture the app can send."
- **Every picture comes back as a clean PNG** (A-55): a WebP is first converted ("WebP to PNG conversion"), then the picture goes through `toPng`, which turns a JPEG by its orientation tag (EX-1) and keeps nothing the file carried beside the picture. The reply's `mime` is always `image/png`. A converter refusal is `asset_not_a_picture`; a PNG over the byte limit at either step is `asset_too_large`. Without converters (the asset service alone, in tests) the bytes go as read and a WebP is refused.
- A file that cannot be found gives `MISSING_FILE` (`missingFile` takes asset IDs, never a path); a file gone after `stat` gives `NOT_FOUND`. A file-system error inside `readPicture` is not an `AppError`, so the bus returns the fixed `INTERNAL` reply with no error text.
- Display names in these refusals stay, for the user and the agent alike; a folder or path never appears.

## Relink [REQ: FR-009]

Built. `asset.relink { projectId, assetId, newPath, relinkSiblings }` (`src/main/assets/relink.ts`). Two steps, not undoable. Works on any asset, missing or not.

- `newPath` comes from the system picker and must be a full path to a regular file: absent, `NOT_FOUND`; a folder, `INVALID_INPUT`; unreadable, `file_not_readable`.
- The new bytes must be an accepted type of the asset's own `kind`, else `RULE_VIOLATION`, `relink_kind_mismatch`, "Choose a file of the same kind: {kind}." Different content is accepted.
- The row takes new `abs_path`, `rel_path`, `mime`, `byte_size`, `mtime_ms`, `content_hash`, `width`, `height`. `display_name`, `library`, `subject_id`, `origin` and the generation fields stay. After relink the asset is `linked`, whatever it was. No file is moved, copied or deleted.
- Reply `{ assetId, siblingIds }`. `run` checks each row again before writing.
- **`relinkSiblings`** (security class). With `oldDir` and `newDir` the folders of the old `abs_path` and of `newPath`, every other asset that is `linked`, missing now, and inside `oldDir` at any depth gets the candidate at the same relative path under `newDir`. It is relinked only when the candidate is a regular file (not a link) whose real path is still inside `newDir` and whose content hash equals the row's. Other content is left missing; a sibling that does not match is skipped without error. A candidate outside `newDir`, or under a linked subfolder of it, is never hashed. Tests: `tests/integration/assets/asset-relink-siblings*.test.ts`.

## Change detection [REQ: FR-009, R-06]

Built. `asset.checkChanged { projectId }` (handler `src/main/commands/asset/check-changed.ts`, logic `src/main/assets/check-changed.ts`). A system command: `internal` (a window cannot send it), agent policy `deny`, not undoable, bumps no `rev`. Reply `{ assetIds }`, the assets whose content hash changed.

- `prepare` looks at every `linked` asset whose file is found and compares size and time with the row. For each that differs it reads the file again (hash, size, time, type by bytes). `run` checks each row still exists and writes it.

| What changed | Row update | In `assetIds` |
|--------------|-----------|---------------|
| Hash same (only the time moved) | `byte_size`, `mtime_ms` | No |
| Hash differs, bytes still the same `kind` | `mime`, `byte_size`, `mtime_ms`, `content_hash`, `width`, `height` | Yes |
| Hash differs, bytes another kind or no accepted type | `byte_size`, `mtime_ms`, `content_hash` (so it is not found again at every check); `kind` and `mime` stay; `width`, `height` become null; one `warn` line with the asset ID | Yes |

- Missing files are skipped (the resolver finds those). Managed files are not checked. Two assets may end with one hash; nothing is merged. One `info` line per changed asset, with its ID and no path.
- **Triggers** (`src/main/assets/change-trigger.ts`, no Electron import). `checkFiles` in `src/main/index.ts` feeds both: after every successful `project.open` (through `withChangeChecks`, which starts a check without waiting, for both the `execute` given to `registerIpc` and the one in `openFromSystem`), and on `browser-window-focus` for every open project. `checkChangedFiles({ execute, emit, log }, projectId)` sends the command (actor `user`), then the event for a non-empty list. It never runs twice at once for one project. A failure is logged and goes no further.
- **Event `asset.changedOnDisk`** `{ projectId, assetIds }`, sent after a check with a non-empty list. It is the signal to redraw pictures. Redrawing thumbnails is Phase 3.

## The asset protocol `adman-asset://` (security class)

Built. The window never reads files. It loads pictures, video and fonts from

```
adman-asset://{projectId}/{assetId}
```

Decisions in `src/main/assets/asset-url.ts` (no Electron import, unit tested). Electron calls only in `src/main/windows/asset-protocol.ts`: `registerAssetScheme(protocol)`, called at top level in `src/main/index.ts` before `app.whenReady()`, and `registerAssetProtocol(protocol, projects)`. In the window, `assetUrl(projectId, assetId)` (`src/renderer/ui/asset-url.ts`) is the one owner of the address and escapes both parts with `encodeURIComponent`.

- **Served only when:** the method is GET; the whole raw address matches `^adman-asset://{ULID}/{ULID}$` (case ignored, read in upper case) with nothing after, no query, fragment or extra path (the raw text is matched, so `/../` and `%2F` are never folded); the project is open; the row exists; `kind` is `image`, `video` or `font` (`text` is never served); the row's `mime` is one `file-types.ts` lists for its kind; the resolver finds the file, opened read only.
- Anything else, including a file gone after the check: 404 with an empty body, never saying which check failed.
- **Headers:** `Content-Type` is the row's `mime`, never from the file name. `X-Content-Type-Options: nosniff` and `Cache-Control: no-store` on every answer, 404 included, so a changed linked file is read again. No path, file name or error text in any answer or header.
- **Scheme privileges** (Electron 45.4.1): `standard`, `secure`, `stream`, `corsEnabled` true; `bypassCSP`, `allowServiceWorkers`, `supportFetchAPI`, `codeCache`, `allowExtensions` false. Fonts load only with `corsEnabled` true; no `Access-Control-Allow-Origin` header is sent. The ruling and its limits: `spec/security.md`, "Rules: the asset protocol" (A-53).
- The page policy (`src/main/windows/csp.ts`) has `img-src 'self' adman-asset: data: blob:`, `media-src adman-asset:`, `font-src 'self' adman-asset:`.
- One byte range is answered (P7-6): `206` with `Content-Range` for a single `bytes=` range inside the file, `416` for a start past the end, and the whole file with `200` for several ranges or a header the handler does not read. Every check above runs before the header is read.
- The protocol does not check first bytes (accepted, OI-49).
- A change to `asset-url.ts` is security class and ruled on its own.
- Test: `tests/e2e/asset-protocol.spec.ts`: with a project open and one imported picture, a picture element pointed at its address loads; an unknown asset ID does not; a project not open does not.

## Libraries and reference pictures

Built for the test path. Main files: `src/main/commands/generation/` (checks), `src/renderer/screens/campaign/reference-picker/`, `reference-list.ts`.

- `asset.library` is `reference` (pictures that guide generation) or `asset` (files used in ads). `asset.list` returns rows by `id` ascending (oldest first); the window sorts for display.
- A hero image is a row with `library = 'asset'`, `kind = 'image'` and a `subject_id`. If a subject has several, the newest fills the slot and the others are offered [REQ: R-12]. One file belongs to at most one subject [REQ: FR-011].
- **Subject photos** (Not built) [D-098]: a picture attached to a subject, in either library, is offered and pre-chosen as a reference picture; the picture chooser moves a reference-library subject photo to the asset library when placed. Files with no subject keep the rules above. `spec/subject-photos.md`.
- `font_publish_allowed` is set by the user with a checkbox "I am allowed to share this font" [REQ: FR-162].

### Which pictures a run sends

| Value | Owner | Rule |
|-------|-------|------|
| Which pictures a run sends | `job.request.referenceAssetIds`, written only by `generation.runImages` (and `generation.startVideo` for its picture) | The window sends asset IDs, never a path or bytes. |
| How many pictures any run takes | `MAX_REFERENCES_PER_RUN` = 8 (`src/shared/config/defaults.ts`, A-56), applied by `referenceIds` (`src/shared/schemas/reference-ids.ts`) | Over 8 or an ID listed twice is refused by the schema. |
| The name of a file uploaded to ComfyUI | `uploadName(bytes)` (`adman-{16 hex}.png`) | No caller, asset row or server text supplies a name. |
| How many pictures a ComfyUI workflow takes | The length of `slots.references` in its `WorkflowSpec` | The command refuses with `too_many_references` and `details.max`. The window holds no copy of the number. |

- `generation.runImages` reads every ID in `referenceAssetIds` in `prepare` with `AssetService.read`. A picture that is gone, too large, or not a picture the app can send is refused before a job row is made. The job kind reads the bytes again. An ID the project does not hold is refused.
- `job.retry` sends the stored request again, references included, after the same checks.
- Gemini gets the prompt text first, then each reference picture in order as an `inlineData` part holding the clean PNG `AssetService.read` gave (`spec/providers-adapters.md`). ComfyUI gets each picture uploaded under `uploadName(bytes)`, only after its server check answered `ok`; the display name, path, asset ID and subject never enter a request (`spec/comfyui.md`).
- A video run's first-frame picture is fitted to the run size and sent as PNG; a reference picture is sent as the clean PNG `AssetService.read` gave, not fitted (`spec/jobs.md`, `video_generation`).
- **The reference picker** (under the prompt box): heading "Reference pictures", one small picture per asset with a tick box and its display name, button "Add pictures"; empty: "No reference pictures in this project yet." It calls `asset.list { projectId, library: 'reference', kind: 'image' }`, `dialog.pickFiles { purpose: 'import', kind: 'image', multiple: true }`, and `asset.import { projectId, paths, library: 'reference', copy: false, subjectId? }` (`subjectId` is the chosen variant's first subject when it has one). After the reply the list is read again and the returned IDs are ticked. A cancelled picker sends nothing; a refused import shows the command's message and ticks nothing. Ticked IDs are sent in tick order, each showing its place ("1", "2"). An asset with `missing: true` cannot be ticked and says "file not found". With 8 ticked (`MAX_REFERENCES_PER_RUN`), an unticked picture cannot be ticked and the picker says "A run takes at most 8 reference pictures." Ticks are kept while the campaign page is open, across variant changes, and dropped for an asset that left the list. Full screen wording: `spec/screens.md`.
- Phase 4's reference dialog (`spec/screens-ai.md`) also offers generated pictures as references (A-68). A full reference library screen, and removing a reference from the project, are UI-pass work.

## Generated assets [REQ: FR-063, FR-068, FR-216, FR-299]

Built for pictures and clips.

- A job writes each result with `AssetService.writeManaged` as `{assetId}.{ext}` in the assets folder, then sends the system command `asset.addGenerated { projectId, jobId, files: [{ assetId, ext }], model? }`. It is internal, denied to agents, not undoable, and holds asset IDs and extensions only, no path and no file contents. `prepare` checks each name with `isManagedName` and reads each file at its managed path; `run` inserts the rows.
- A generated row: `library = 'asset'`, `origin = 'generated'`, `storage = 'managed'`, `subject_id` null, `display_name` the file name, type and facts read from the file, `gen_run_id` the job ID, `gen_provider` the job's provider, `gen_model` `input.model ?? job.model` (for ComfyUI, the shipped workflow's main model file name, never the server's), `gen_prompt` the prompt from the job's request, or null when the request has none (a cut-out, Phase 4) (`src/main/commands/asset/add-generated.ts`).
- **Every generated picture is stored as PNG** [REQ: FR-299]: it goes through `toPng` and gets the generation details embedded first (`spec/export-and-checks.md`, "Embedded generation details"). A clip is stored as the provider returned it after `checkMp4`, sound included; its `width` and `height` stay empty until Phase 7.
- Options no variant uses stay in the library [REQ: FR-063]. Picking one is a `layer.update` that sets `source`.
- A cancel landing between `writeManaged` and `asset.addGenerated` leaves a file with no row. Accepted nuisance.

## What Package project means for assets

Built. `project.package` (`src/main/assets/package.ts`); the full command is in `spec/data-rules.md`, "Package project".

- It copies the file behind every `asset` row: both libraries, linked and managed, imported and generated, and options no variant uses. Files in the assets folder that no row names are not copied. In the package each copied asset becomes `managed` at `{Name} Assets/{assetId}.{ext}`, bytes unchanged.
- A found asset is copied only when: its extension (from the file's base name only) is listed in `file-types.ts` for the row's `kind`; its first bytes match that type (the same check import uses); its `id` passes `isManagedName`. Failing any, it counts as missing: without `skipMissing` the package is refused with `MISSING_FILE` and `details.assetIds`; with it, the asset is left out and named in `skippedAssetIds`. Never `INTERNAL`. A file changed on disk into another type is treated as missing.
- The target folder must not be the assets folder or inside it, judged on real paths with `pathAtOrInside`: "Choose a folder outside the project's assets folder."

## Accepted risks for asset files

Do not "fix" these without a ruling. Every value read from a project file is untrusted (names, paths, `mime`, sizes, IDs, counts); the checks above are where it is checked (`spec/security.md`).

- A linked path is whatever the disk holds now. A swapped file is sent under the old picture type with `nosniff`; the window shows a broken picture and runs nothing, and the window can make no network request.
- A linked path may name any file the user's account can read. A hostile project can list a private picture: it shows in the library, reaches a provider only if the user picks it as a reference, and Package carries it only if it really is a file of its kind.
- With an agent ticked, a project from someone else, opened by the user, could make a picture start upload whatever PNG or JPEG a linked row points to, to a provider the user ticked (U-2). The agent gets no bytes back. Any future tool that returns bytes (OI-92) must be judged with this.
- A link swapped in after an `lstat` check (in `setAssetsDir`, `hashFile` opens normally; folder import with `copy: true` uses `copyFile`, which follows links), or between the `ensureAssetsDir` check and `mkdir`. No `O_NOFOLLOW` is required: the swap needs write access to the user's folders during the command, `O_NOFOLLOW` guards only the last path part, and it does not exist on Windows.
- A file opened three times on import (head, hash, copy) can be swapped between; the change check later finds a mismatching hash.
- An existing folder outside the project named by `assets_dir_*` still receives new managed files `{ULID}.{ext}`, never over an existing file.
- The change check stores size, time and SHA-256 of any readable file a linked row names, and, when the first bytes fit the row's kind, its `mime`, width and height. Any real text file with a listed extension can be named by a `text` row and carried by Package.
- Projects from elsewhere get no confirm step (OI-47 and OI-49 closed). What holds instead: the app never creates a folder outside the project's own folder; a file is never written over an existing one; bytes the window is handed never leave it and page script cannot read them; a linked file goes to a provider or into a package only when its first bytes fit the row's kind; the path checks of `spec/security.md`.
- The renderer draws no file path, reads no file, and sends an asset file path in no call except `asset.import`, and only a path the system picker or a drop returned, or one a `brief.parse` reply listed in `subjectPictures` or `brandFiles` after its checks (`spec/subject-photos.md`, `spec/brief-brand.md`; a brief may name any file, D-100). (The brief picker's path goes to `brief.parse`, `spec/brief-and-templates.md`.) Display names are drawn as text. The one other path the window draws is in the permission dialog for an agent's file import (`spec/security.md`, "Paths in the renderer").

## Not built

- Reading `duration_ms`, clip `width` and `height` (Phase 7).
- WebP to PNG conversion (slice WP, above).
- The query for earlier options of a layer (Phase 4, `spec/jobs.md`).

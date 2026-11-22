# Round 2: projects, agents and the app's name

The stakeholder's hand-testing feedback, items 12, 15, 16 and 17 (the list and the rulings are in the orchestrator's notes; the rulings used here are restated where they bind). Every slice reads `spec/phases/DEV-RULES.md` first, then this file's "Rules for these slices" and "Design additions", then the topic sections its slice names.

**Goal.** A person can paste a brief as JSON, YAML or Markdown; a brief may name its subjects' pictures by asset ID or by file path. An agent can start a project, make a campaign from brief text, and import files by path with the user's confirm. Several projects stay open in the one window and the user switches between them. The app is called AdManager and has its own "AM" icon, while its saved settings and keys stay where they are.

**Status:** built and merged on `main`: R2P-1 to R2P-12, with R2P-5b (the hardening of the agent's file read after review: one no-link read handle, a second hash of each copy, Windows network, device and second-stream paths and unusual space characters refused before the ask). The rules now live in the topic files; this file keeps the design for reference. Built differently from the design below: the icon has no letters (three stacked rounded squares), not the "AM" of D10; the start screen has no "Open now" card (D9), open projects come first in its "Recent" list with a small dot; shots used 370 to 382, not 340 to 359.

**Class:** E and B for the tools and commands, A for the brief reader, D for the screens, G for start-up and the window edge, F (packaging check) for the name and icon.

## What the code does today (measured)

### Item 15: several open projects in one window

The ruling (R-7, as replaced by the stakeholder): one window; several projects open at once; the user switches between them in the window; opening another adds it and shows it; opening one that is open shows it. No second window.

Measured against `main`. **Almost all of it is already built.**

| Part | One project assumed? | Where |
|------|---------------------|-------|
| Core | No. `createProjectRegistry` is a map by project ID; every command and query names its `projectId` | `src/main/db/project-registry.ts` |
| Opening | No. `project.open` and `project.create` add to the map; an already open file returns its own summary | `src/main/commands/project/open.ts` |
| Jobs | No. Counted and cancelled per project | `jobs.activeCount(projectId)` |
| Events | No. Each carries its project; the one window gets them all | `eventSender` in `src/main/ipc.ts` |
| Asset scheme | No. `adman-asset://{projectId}/{assetId}`, served for any open project | `asset-url.ts` |
| Render window | No. One hidden window draws for any project; `render.projectClosed(id)` per project | `src/main/render/` |
| MCP server | No. It has no "open project": `list_projects` gives every open one, every tool takes `project_id`, a closed one is `NOT_FOUND` | `src/main/mcp/` |
| Quit question | No. Counts runs over every open project | `runningCount` in `src/main/index.ts` |
| Bridge | Not involved (no window, no core) | `src/main/bridge/` |
| Renderer | No. `openProjects` in the app store; the project switcher lists them; the nav store keeps each project's tabs and place by project ID; `phase1.spec.ts` opens two | `project-switcher/`, `nav-store.ts` |

What is missing, and why the stakeholder saw what he saw:

1. **Hard to find.** The second project is open, but the only way back to the first is the switcher's menu. The menu has no "Open another project…"; the way to open one is "Start", then "Open project…", which looks like leaving the first project.
2. **A double-click on a project that is already open does nothing visible.** `openFromSystem` runs `project.open`, which returns the open project; the open list does not change, so the window's `nextView` sees nothing new and stays where it is.
3. **A double-click from Finder can be lost to another copy of the app.** Under `npm run dev` the running app is the Electron bundle. Finder opens a `.adman` file with whatever app is registered for it (a packaged `Adman.app` from `dist/`, and after the rename an older `Adman.app` beside `AdManager.app`). That second app has the same run-time name, so the same data folder and the same single-instance lock. It loses the lock and quits. On macOS the file reaches it as an `open-file` event, not on the command line, so `second-instance` in the running app gets no path and only focuses the window. This matches "just focuses the Adman window". It is an inference from the code; the slice's hand check confirms it.

**Size: small.** Two slices (R2P-9 main side, R2P-10 window side), a few hundred lines with tests. Nothing in core changes.

### Item 17: which field drives which name

| Name a person or the system sees | Driven by | Today | After |
|------|-----------|-------|-------|
| `.app` bundle name, `CFBundleName`, `CFBundleDisplayName`, executable name, DMG and NSIS file names, Start-menu shortcut | `productName` in `electron-builder.json` | Adman | **AdManager** |
| Bundle ID `com.adman.app` (also NSIS's upgrade key) | `appId` in `electron-builder.json` | — | unchanged |
| Run-time `app.name` | `productName` (else `name`) of the `package.json` inside the app; Electron's start-up script sets it, and `electron-builder` copies `package.json` into the archive | Adman | **Adman (unchanged)** |
| Data folder `~/Library/Application Support/Adman` (`%APPDATA%\Adman` on Windows) | `app.name` at start-up | Adman | **Adman (unchanged)** |
| Keychain entry "Adman Safe Storage" used by `safeStorage` | Believed to be `app.name`. **Not certain**: it may instead follow the bundle's name. R2P-11 proves it | Adman | must stay Adman |
| Window title | `<title>` in `src/renderer/index.html` (the page title replaces the window's) and `title` in `app-window-options.ts` | Adman | AdManager |
| macOS menu bar's bold first item | `CFBundleName` in a packaged app ("Electron" under `npm run dev`; that cannot change) | Adman | AdManager |
| App menu items About, Hide, Quit | Electron's role labels use `app.name` | "About Adman" | set by label: "About AdManager" |
| About panel | `app.setAboutPanelOptions` | bundle name | `applicationName: 'AdManager'` |

So the change is: `electron-builder.json` `productName` becomes "AdManager"; `package.json` keeps `"productName": "Adman"`; the visible title words change in code. If the packaged check (R2P-11) finds the archive's `package.json` holds "AdManager", the slice adds `"extraMetadata": { "productName": "Adman" }` to `electron-builder.json` and runs the check again.

**If the hand check shows the Keychain entry follows the bundle name** (a new "AdManager Safe Storage" entry appears and Settings says saved keys could not be read): the fallback is to keep `CFBundleName` "Adman" through `mac.extendInfo` and set only `CFBundleDisplayName` "AdManager" (Finder and the Dock use the display name; the menu bar then reads "Adman"). The stakeholder is asked before the fallback is built.

## Rules for these slices

- Test first; one slice per developer run, well under 300k tokens; `HANDOFF.md` if near it.
- **Shared files.** Only R2P-1 edits `src/main/commands/agent-policy.ts`, `src/main/mcp/tools/table.ts`, `src/main/core.ts`, `src/shared/schemas/events.ts`, `src/main/queries/queries.ts` and `tests/unit/main/mcp/tools/table.test.ts`. Named exceptions are listed in the slice that has one.
- **Tool rows.** R2P-1 adds the three new tools as `notBuilt` rows in their own group files (A-230). The slice that owns a group file fills its row and touches no other tool file.
- **The shared tool-list test files** (merge rule A-248, `spec/phases/phase-10.md`, "Rules"): `BUILT_TOOLS` in `tests/integration/mcp/tool-client.ts`; the snapshot (`npx vitest run tests/integration/mcp/tool-list.test.ts -u`); `STILL_NOT_BUILT` in `tests/unit/main/mcp/tools/tool-plan.test.ts`; `tests/integration/mcp/reply-words.test.ts` (one row per tool, in tool list order); `SECTION_4_5_TOOLS` in `tests/integration/mcp/no-tools.test.ts`. R2P-5, R2P-7 and R2P-8 each edit all five for their own tool and nothing else in them. On a conflict the merger keeps both rows in tool list order and re-makes the snapshot; the diff only adds that slice's tool.
- **Replies.** Every reply goes through a picker in the slice's reply file that names every field. No reply, refusal, event or log line holds a file path, a file name taken from a path, file contents, brief text, a setting, a key or the token. Each tool slice runs `riskyKeys` and the word test over its recorded replies, success and refusal, and greps the log lines its test wrote for every path it gave.
- **Security class.** Every slice that lets an agent do something new is "full" and merges only after its review.
- **Screens.** One folder per component, CSS from `src/renderer/ui/tokens.css` only, no new token. Shots in `tests/shots/r2p-{n}.shots.ts`, picture names from 340 to 359.
- Nothing leaves the machine. No paid call: nothing here calls a provider.

## Design additions

### D1. The brief reader for text: `parseBriefText` (A-340, A-341)

New pure file `src/shared/brief/text.ts`:

```ts
type BriefTextSyntax = 'json' | 'yaml' | 'markdown'
parseBriefText(text: string): Result<{ draft: BriefDraft; syntax: BriefTextSyntax }>
```

1. `parseBrief(text, 'json')`. If `ok`, take it.
2. Else `parseBrief(text, 'yaml')`. Take it only if `ok` **and** the draft has at least one field. (Markdown such as `Region: Canada` is valid YAML with an unknown key `Region`, which gives an empty draft; that must fall through.)
3. Else `parseMarkdownBrief(text)` (D2).
4. Else the one error `INVALID_INPUT`, `details.reason: 'brief_unreadable'`, "The brief could not be read as JSON, YAML or Markdown."

Never throws. No bad line is given (the text came from the caller). No AI call. No size limit (D-059 item 2; a slow parse is a nuisance). The YAML rules of `spec/brief-and-templates.md` stay as they are.

### D2. The Markdown form (A-342)

New pure files `src/shared/brief/markdown.ts` (the walk) and `src/shared/brief/markdown-labels.ts` (the label table, its one owner). Fixed rules, no AI.

**Labels.** Matched without regard to letter case, with runs of spaces read as one, with `**` or `__` around the label removed, and with a trailing `:` on a heading removed.

| Label | Brief field | Kind |
|-------|-------------|------|
| Campaign name, Campaign | `campaignName` | text |
| Region | `region` | text |
| Audience | `audience` | text |
| Message | `message` | text |
| Offer | `offer` | text |
| Call to action | `callToAction` | text |
| Tone | `tone` | text |
| Languages | `languages` | list |
| Sizes | `sizes` | list |
| Required words, Required words ({lang}) | `requiredWords` (plain list, or `{ lang: [...] }`) | list |
| Prohibited words, Prohibited words ({lang}) | `prohibitedWords` | list |
| Subjects | `subjects` | section |
| Copy ({lang}) | `copy[lang]` | section |

Inside one subject: `ID` → `id`, `Name` → `name`, `Description` → `description`, `Pictures` or `Picture` → `pictures` (list). Inside a Copy section: `Headline` → `headline`, `Call to action` → `callToAction`.

**The walk**, line by line, after one byte-order mark is removed and each line loses a trailing `\r`:

1. Lines inside a fenced block (a line starting with ```` ``` ```` or `~~~` opens it, the next such line closes it) are skipped.
2. A heading is `#` to `######`, a space, then text. **Level 1:** if its text is a label, it starts that field's section; otherwise the first level-1 heading gives `campaignName` and later ones are ignored. **Level 2:** a label starts that field's section; any other text starts a section that is ignored until the next level-1 or level-2 heading. **Level 3 inside Subjects** starts a new subject whose name is the heading text.
3. A line `Label: value` with a known label and a non-empty value sets that field (inside a subject or a Copy section, that section's labels). For a list field the value is split on commas, each part trimmed, empty parts dropped (`Languages: en, fr`). A `Label:` line with an empty value starts that field's list, read from the list items that follow.
4. A list item is a line starting with `- `, `* `, `+ ` or a number and `. `; its text, trimmed, is one item of the current list field. Directly under `## Subjects`, an item makes a subject with that name.
5. Other non-blank lines under a text field's section (`## Message`) are its text: lines joined with one space; a blank line between paragraphs gives `\n\n`; trimmed.
6. A field given a second time is ignored; the first wins.
7. Nothing else is read: tables, images and links stay plain text, or are ignored when they fall outside a field.
8. The result goes through `briefDraftFrom`, so `BriefDraft`'s rules apply. A walk that set no field is `brief_unreadable`.

**Example** (made-up names):

```markdown
# Spring Glow launch

Region: Canada
Audience: Adults 25 to 40 who buy skin care online
Call to action: Shop the serum
Tone: Warm and plain

## Message
Glow that lasts from morning to night.

## Languages
- en
- fr

## Sizes
- 1:1
- 9:16

## Required words (en)
- serum

## Subjects

### Citrus Glow serum
ID: citrus-glow
Description: A 30 ml glass dropper bottle with an orange label
Pictures:
- 01JD3K7Q2M8V5X9T4R6Y1B0C2N
- /Users/sam/Pictures/citrus-glow-front.png

## Copy (fr)
Headline: Un éclat qui dure
Call to action: Découvrir le sérum
```

It reads as `campaignName` "Spring Glow launch", `region`, `audience`, `callToAction`, `tone`, `message`, `languages: ['en', 'fr']`, `sizes: ['1:1', '9:16']`, `requiredWords: { en: ['serum'] }`, one subject with `id`, `name`, `description` and two `pictures`, and `copy.fr`.

### D3. Picture references in a brief (A-343 to A-346)

New pure file `src/shared/brief/picture-refs.ts`:

```ts
type PictureRef =
  | { kind: 'asset'; assetId: string }          // the text, upper-cased, is a ULID
  | { kind: 'file'; path: string }              // absolute on this system, path.normalize'd
  | { kind: 'relative'; text: string }          // anything else
pictureRef(text: string, platform: NodeJS.Platform): PictureRef
```

A ULID is `^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$`. "Absolute" is `path.win32.isAbsolute` on Windows and `path.posix.isAbsolute` elsewhere. `~` is not expanded (it is relative).

**A brief a person loads or pastes (R-4 as the stakeholder last ruled).** A path may name any file on the disk; there is no confirm step; the normal import checks apply. This lifts the rule that a brief may only name pictures in its own folder. In `src/main/assets/brief-pictures.ts`:

- `checkBriefPictures(briefPath | null, projectId, subjects)` replaces the folder rules. For each picture text, in order, the first failing rule gives the note:
  1. An `asset` ref: the project must hold an asset of that ID with kind `image`; else note `unknown_asset`. An accepted one goes to `assetIds`.
  2. A `relative` ref: from a file, it is joined onto the brief file's folder with `path.join` and then checked as a file (it may lead out of the folder); from pasted text, note `not_full_path` and nothing is read.
  3. A file: text with U+0000 gives `not_found`. `realpath`; `ENOENT` or `ENOTDIR` gives `not_found`, other errors `not_readable`. `stat` must be a regular file, else `not_found`. Extension listed for kind `image` and first bytes match, else `not_a_picture`. An accepted file goes to `paths` as its real path, once per subject.
- Removed: the `outside_folder`, `wide_folder` and `no_folder` reasons, `isWideFolder` and the `..` and inside-the-folder checks.
- `SubjectPictures` becomes `{ paths: string[]; assetIds: string[]; notes: PictureNote[] }`. `PictureNoteReason` becomes `'not_found' | 'not_a_picture' | 'not_readable' | 'not_full_path' | 'unknown_asset'`.
- `brief.parse { text }` now reads with `parseBriefText` and checks pictures too; `brief.parse { filePath }` keeps its file rules (the ending picks JSON or YAML) and checks pictures as above.
- The window imports `paths` exactly as SP-4 does today: one `asset.import { paths, library: 'asset', copy: true }` per subject. Asset IDs become form photos already in the project (FR-053 rules: no subject, attached at Create; this subject, shown attached; another subject, problem line 4).

Notes, shown on the user's screen only, never logged, never in an event, never to an agent:

| Reason | Line |
|--------|------|
| `not_found` | "The photo "{name}" was not found." (as today) |
| `not_a_picture` | "The file "{name}" is not a picture Adman can use." (as today) |
| `not_readable` | "The photo "{name}" could not be read." (as today) |
| `not_full_path` | "The photo "{name}" was not used: a pasted brief has no folder, so give the photo's full path or its asset ID." |
| `unknown_asset` | "No picture with the asset ID "{name}" is in this project." |

The line above the subject rows (A-125) becomes "This brief added {n} photo(s). Check them before you create the campaign."

**What stays:** no path reaches `campaign.brief` (`BriefSubject` has no `pictures`), a job row, an MCP reply, an event, an error message or a log line. `checkBriefPictures` writes no log line. Brief photos are copied (A-124).

**A brief an agent sends** (D6): asset IDs need no confirm; any file path makes the call `ask` with the same on-screen confirm as `import_assets`; a relative path is refused with no disk read. This split between a person and an agent is A-346.

### D4. Pasting a brief (item 12, person side; A-347)

"Type a brief" becomes **"Paste a brief"**. It opens a dialog (`src/renderer/screens/project-home/brief-paste/`), shared dialog frame:

- Title "Paste a brief". One text area, label "Brief text", hint under it "Paste a brief as JSON, YAML or Markdown." Monospace (`--font-mono`), at least 16 rows, grows with the dialog.
- Buttons: "Cancel", "Start from an empty form" (opens the form empty, as "Type a brief" did), "Read brief" (primary; disabled while the text is only white space).
- "Read brief" sends `brief.parse { projectId, text }`. A refusal shows its message in the dialog (role `alert`) and the text stays. On success the dialog closes and the flow is the loaded brief's (SP-4): "Adding the brief's photos…", the imports, then the form with its notes.
- "Load a brief" (a file) is unchanged; its `.md` and `.txt` files still go to the AI reader (open question 1).

### D5. Agent import by path: `asset.importFiles` and `import_assets` (item 16, R-3; A-348 to A-352)

**Command** `asset.importFiles` (new). Input `assetImportFilesInput`, strict:

```ts
{ projectId: string, paths: string[] (1 to 20), library: 'asset' | 'reference' (default 'asset') }
```

**Before the ask** (text only, nothing on disk is touched, so an agent cannot learn whether a file exists without the user's yes). Each path, in order; the first failure refuses the whole call with `INVALID_INPUT` and `details: { reason, index }` (1-based):

| Rule | Reason | Message |
|------|--------|---------|
| More than 20 | `too_many_files` | "Give at most 20 files in one call." |
| Not absolute, or longer than 4,096 characters | `not_full_path` | "File {n} is not a full path." |
| Holds a control or format character (Unicode Cc or Cf, which can hide or reorder text on screen) | `hidden_characters` | "File {n}'s path holds hidden characters." |
| Extension not listed for `image`, `video` or `font` in `file-types.ts` (text files and SVG never) | `not_supported` | "File {n} is not a picture, video or font Adman can use." |

Each path is then `path.normalize`d; that text is what the user sees and what is read.

**The ask.** Agent policy `ask`. The user sees every full path (D7). `mcp.autoApproveDestructive` never covers it (D7).

**After an allow**, in `prepare` (new file `src/main/assets/import-files.ts`, asset code because `src/main/assets/` is the only place that builds an import path): for each path, `realpath` must equal the shown path (compared without letter case on macOS and Windows), so a link anywhere on the way is refused; `lstat` must be a regular file; then `prepareImport(project, realPaths, copy: true)`, with its type, size and decode checks, and each file's found kind must be `image`, `video` or `font`. One failure refuses the call and leaves no copy (`removeCopies`). `run` inserts rows as `asset.import` does (`origin: 'imported'`, no subject; a file the project already holds gives its existing ID).

| After-allow failure | Code, reason | Message |
|---------|------|---------|
| Missing | `NOT_FOUND`, `file_not_found` | "File {n} was not found." |
| Reached through a link | `RULE_VIOLATION`, `file_is_link` | "File {n} is reached through a link. Give the file's own full path." |
| A folder or not a regular file | `RULE_VIOLATION`, `not_a_file` | "File {n} is not a file." |
| Not readable | `RULE_VIOLATION`, `file_not_readable` | "File {n} could not be read." |
| Type, size or decode refused | `RULE_VIOLATION`, `not_supported` | "File {n} is not a picture, video or font Adman can use." |
| Assets folder missing | as today, `assets_folder_missing` | as today |

Every message names the file by its place in the list, never by path or name. The prepare step's own errors (which hold file names) are caught and replaced by these. `logUnreadable`'s warn line is kept (it holds no path).

**Copy, never link** (A-349): an agent-imported file is always copied into the assets folder, so a project can never be made to follow a path an agent named.

**Tool** `import_assets` (group file `src/main/mcp/tools/import-tools.ts`), input `project_id, paths, library`. Reply picker `importedIds`: `{ assetIds: string[] }` in input order. Description: "Import picture, video or font files into an open project by their full paths, at most 20 at a time. The user is asked every time and sees each full path; you wait up to two minutes, and a refusal is final. Each file is copied into the project. Gives one asset ID per path, in order. Text files, SVG and folders are not accepted." It carries `LEAVE_THE_CHOICE` (it can lead to an asset on a layer).

**The agent reads:** asset IDs; through the existing tools afterwards, each asset's display name (its file name), kind and size. **Never:** any path, the real path, a file's contents, which check refused a file beyond the sentence, or anything about a file before the user allowed.

**Stays denied:** `asset.import` (folders, links, the user's own picks), `asset.relink`, `project.package`, `asset.update`, `asset.remove`, `project.setAssetsDir`, `brief.parse`, `brief.extract`, `subject.*`.

### D6. `campaign.createFromBrief` and `create_campaign_from_brief` (item 12, R-4; A-353, A-354)

Two command names, one handler (`src/main/commands/campaign/from-brief.ts` and `from-brief-pictures.ts`), so the policy table stays static:

| Command | Policy | Refuses |
|---------|--------|---------|
| `campaign.createFromBrief` | `allow` | a brief that names any file path (`RULE_VIOLATION`, `brief_names_files`, "This brief names files. Send it again through the tool so the user can be asked.") |
| `campaign.createFromBriefWithFiles` | `ask` | a brief that names no file path (`INVALID_INPUT`, `no_files`) |

Input (both), strict: `{ projectId, text: string (min 1) }`.

**The tool** `create_campaign_from_brief` (group file `src/main/mcp/tools/brief-tools.ts`), input `project_id, text`. `ToolDef` gains `targets?: readonly string[]` and `pickTarget?(input): string` (R2P-1): the tool parses the text with `parseBriefText` and `pictureRef`, and picks `...WithFiles` when any picture is a file ref, else the plain command. A picked name not in `targets` is the fixed `INTERNAL` reply. A text that cannot be read goes to the plain command, which refuses it.

**Order in the handler:**

1. Read with `parseBriefText`; refusal as D1.
2. The confirmed brief: the four required texts and at least one named subject. Missing ones: `INVALID_INPUT`, `brief_incomplete`, "The brief is missing: {fields}." where `{fields}` are the Markdown labels in lower case joined with ", " (for example "region, audience, subjects"); `details.fields` the camelCase names.
3. Subject IDs by `briefSubjectIds` (moved to `src/shared/brief/subject-ids.ts` by R2P-2). A subject ID the project already holds is used as it is (OI-72, as the form does); others are made.
4. Pictures, per subject in order, by `pictureRef`:
   - `relative`: `INVALID_INPUT`, `picture_not_full_path`, "Subject {i}, picture {j} is neither an asset ID nor a full file path. A brief sent as text has no folder." No disk read.
   - `asset`: an asset of kind `image` in this project, else `NOT_FOUND`, `unknown_asset`, "Subject {i}, picture {j}: no picture with that asset ID is in this project." If it is attached to another subject: `RULE_VIOLATION`, `photo_of_other_subject`, "Subject {i}, picture {j} is already a photo of another subject." (FR-011.)
   - `file` (only in `...WithFiles`): the D5 text rules before the ask (`index` counts over the whole brief, in subject order), the D5 after-allow rules in `prepare`, kind `image` only (otherwise `not_supported`, "File {n} is not a picture Adman can use."). At most 20 files per brief.
5. In `run`, one transaction: insert the imported rows (library `asset`), create the new subjects, attach each picture (`asset.subject_id`), then the `campaign.create` work with sizes and languages filled by `fillCreateDefaults` and `templateId` `starter`; `placeSubjectPhoto` left out (fills as an agent's `create_campaign` does, A-122). The `campaign.create` body is moved into an exported `createCampaignRows(ctx, input, now)` in `create.ts`, which both commands call; `campaign.create`'s behaviour does not change.
6. Any refusal writes nothing, and `prepare`'s copies are removed.

**Reply picker** `briefCreatedFields`: `{ campaignId, directionId, variantId, subjectIds: string[] }`, plus `assetIds: string[]` (the imported files, in brief order) for the files command.

**Stored:** `campaign.brief` is the confirmed `Brief`, which has no `pictures`. The text itself is not stored. The command's log line holds the IDs only.

**Description** (the slice owns the final words): makes a campaign in an open project from brief text in JSON, YAML or Markdown; gives the Markdown labels and a five-line example; a subject's pictures are asset IDs from `list_assets` or full file paths; if any full path is given the user is asked first and sees each path, the agent waits up to two minutes, and a refusal is final; sizes and languages left out are filled as for `create_campaign`; gives the campaign, direction, master variant and subject IDs. It carries `LEAVE_THE_CHOICE`.

**The agent reads:** the IDs. **Never:** a path, a note about a file, the stored brief's picture list (none is stored), or the existence of a file before the user allowed.

### D7. The ask for files (A-350, A-351)

`src/main/mcp/permissions.ts` and `ask-target.ts` (R2P-5):

- **Kinds.** `ASK_KINDS` in a new file `src/main/mcp/ask-kinds.ts`, its one owner: `campaign.delete` and `variant.delete` are `'delete'`; `asset.importFiles` and `campaign.createFromBriefWithFiles` are `'import'`. A command with policy `ask` that is not listed refuses at once (`refused`), so a new `ask` row cannot slip past.
- **Auto-approve covers deletes only.** With `mcp.autoApproveDestructive` true, a `'delete'` ask is approved as today; an `'import'` ask always shows the dialog. The Settings words (P10-7) already speak of deletes only.
- **Event.** `agent.permissionRequested` gains `kind: 'delete' | 'import'` and `fileCount: number` (0 for a delete). Still no ID, no input and no path.
- **The paths reach the window through a reply, not an event.** New query `agent.askFiles { requestId }`, user only (an agent gets `AGENT_DENIED`): `{ files: string[] }`, the normalised paths, in order, while the request is open; after it ends `NOT_FOUND` "That request has ended." The broker keeps the list in memory for the request's life only.
- **Target lines.** `asset.importFiles`: `{n} files into "{project}"` ("1 file"). `...WithFiles`: `Campaign "{campaignName}" with {n} files for its subjects, in "{project}"`. Names through `cleanName`.
- **Action texts** (policy rows): `asset.importFiles` "import files"; `campaign.createFromBriefWithFiles` "make campaigns that import files"; `campaign.createFromBrief` "make campaigns from a brief"; `project.createInDefaultFolder` "create projects".
- The ask log line (`event: 'ask'`) is unchanged: no input values.

**The dialog for an import** (`src/renderer/app/permission-dialog/`, R2P-6). Same frame, focus and timing rules as P10-7; no "Don't ask again" checkbox.

- Title: "An agent asks to import files" (for the brief command: "An agent asks to make a campaign with files").
- Body: "{agent} wants to import {n} file(s) into "{project}". Adman copies each one into the project's assets folder:" (brief command: "{agent} wants to make the campaign "{name}" in "{project}" and import {n} file(s) for its subjects. Adman copies each one into the project's assets folder:"). `{agent}` as P10-7.
- The list: one item per path, full path, `--font-mono`, wrapping at any character, in a box that scrolls past about 8 lines. Drawn as text content only. While `agent.askFiles` is loading: "Loading the list of files…"; if it fails: "The list of files could not be shown." and only "Refuse" works.
- Cost line: "Once imported, agents can place these files in ads and send pictures to AI providers you allowed."
- "Answer within 2 minutes."
- Buttons "Refuse" (focused first) and "Import" ("Allow" for the brief command). "Import" works only once the list is shown and 750 ms after that.

This is a named change to `spec/security.md`, "Paths in the renderer": the window draws full paths in this dialog, and only there, as text.

### D8. `project.createInDefaultFolder` and `create_project` (item 12, R-5; A-355)

**Command** `project.createInDefaultFolder` (new file `src/main/commands/project/create-default.ts`), policy `allow`. Input strict `{ name: projectName }` (the one name rule: one file name, no `/ \ : * ? " < > |`, no control characters, no leading or trailing dot, not a reserved Windows name, at most 100 characters). The folder is `settings.defaultProjectDir`; nothing in the input names a place, and an unknown key is dropped. It runs the `project.create` work with that location, so the project opens and joins the recent list.

**An existing file is never replaced.** `createProjectFile`'s check becomes `lstat`-based: any entry at the name, a link that leads nowhere included, refuses with the same `RULE_VIOLATION`, `file_exists`, "A file with this name already exists in that folder." (This also covers `project.create`, which only gains the stricter check.)

**Tool** `create_project` (group file `src/main/mcp/tools/project-tools.ts`), input `name`. Reply picker `createdProjectFields`: `{ projectId, name }`. Description: "Create a new, empty project in the user's default projects folder and open it in the app. name is the project's name and its file name: no folder, at most 100 characters. An existing file is never replaced. Gives the project's ID to use as project_id."

**With no project open** the server works as now: `list_projects` gives `[]`, and every project tool gives `NOT_FOUND` "That project is not open." An agent can work only on projects the user opened and projects it created.

**The window** lists the new project in the switcher and does not switch to it (D9). **The agent reads:** the ID and the name it gave. **Never:** the folder or the file path. A refused name tells the agent which rule failed; a `file_exists` refusal tells it a file of that name is in the default folder (A-355, accepted).

`project.create`, `project.open`, `project.close` stay `deny`.

### D9. Several projects in one window (item 15; A-356, A-357)

**Main side (R2P-9).**

- New event `app.showProject { projectId }`, to the window. `openFromSystem` sends it after `project.open` succeeds, for a new and an already open project alike.
- `openFromSystem`, the single-instance code and `pendingOpens` move out of `src/main/index.ts` (279 lines) into `src/main/open-from-system.ts` and `src/main/single-instance.ts`.
- **Finder hand-over on macOS.** The lock is requested inside `app.whenReady()`, before `start()`, so the `open-file` events macOS sends at launch are already in `pendingOpens`: `app.requestSingleInstanceLock({ paths: pendingOpens })`. A losing instance quits with no window and no core. The winner's `second-instance` handler reads `additionalData` through `handoffPaths(data): string[]` (pure, `src/main/open-file.ts`): an object whose `paths` is a list of at most 20 absolute texts ending in `.adman`; anything else gives `[]`. Each goes to `openFromSystem`, which runs `project.open` with its own checks. On Windows the lock stays where it is today (the path comes on the command line).

**Window side (R2P-10).**

- The app store shows a project when: the window's own `project.open` or `project.create` succeeds (as today); `app.showProject` arrives; or, on the window's first state read, the newest open project (a system open before the window loaded). It no longer jumps to every project that appears, so a project an agent creates does not take the user away.
- **Project switcher.** The button shows the shown project's name and, when two or more are open, " · {n} open" in secondary text inside the same button. The menu: the open projects (the shown one marked, as today), a separator, "Open another project…" (the project picker, then `project.open`; the new one is shown, the first stays open), "Start", "Close project". Choosing a project shows it with its own tabs and place (the nav store already keeps them).
- **Start screen.** When projects are open, a card "Open now" above "Open", with one button per open project, "{name}", that shows it.
- Opening one that is open shows it; this already holds for the window's own `project.open`, and `app.showProject` covers Finder.

### D10. The name and the icon (item 17; A-358, A-359)

**Words that change to "AdManager":** the `<title>` of `src/renderer/index.html`; `title` in `app-window-options.ts`; the start screen wordmark; the switcher's fallback label; the quit question "Quit AdManager?"; the macOS app menu label and "About AdManager", "Hide AdManager", "Quit AdManager"; the About panel's `applicationName`; `electron-builder.json` `productName`.

One owner: `APP_DISPLAY_NAME = 'AdManager'` in `src/shared/config/app-name.ts`. `setAppMenu` is passed it instead of `app.name`.

**Stays "Adman":** `package.json` `name` and `productName`; `appId`; the data folder; the Keychain entry; `fileAssociations` and the `.adman` type's words ("Adman Project"); `adman-asset://`; every `ADMAN_` variable; the MCP server's name `adman` in the connect lines; the `User-Agent`; the `app: 'Adman'` mark in generated files; the default projects folder "Adman Projects"; every sentence that says "Adman" inside a message (stakeholder: "don't worry about updating anywhere else for now").

**The icon.** One source, `src/renderer/ui/app-mark/app-mark.svg`, drawn by us, `viewBox="0 0 1024 1024"`:

- A rounded square 824 × 824 at (100, 100), corner radius 185, filled `#16150f` (`--color-text`).
- A thin inner border: a rounded square inset 40 from it, radius 150, no fill, stroke `#cf1470` (`--color-accent`), width 20.
- "A" and "M" drawn as stroked paths, not as text (no font needed), stroke `#cf1470`, width 64, square ends, mitre joins. A: from (300, 690) up to (400, 340) down to (500, 690), cross bar at y 580. M a little smaller, on the same baseline: (548, 690) up to (548, 430), to (640, 570), to (732, 430), down to (732, 690). The developer may move points for balance by eye in the shots; the two letters stay centred, the M stays about 75% of the A's height.
- The colours are the token values written out; a unit test reads `tokens.css` and checks the SVG uses exactly `--color-text` and `--color-accent`.

**Rendering, with tools already present:** `scripts/icon/render-icon.mjs`, run with `npx electron scripts/icon/render-icon.mjs`, loads the SVG in a hidden offscreen window and writes `resources/icon.png` (1024 × 1024) with `capturePage().toPNG()`. `scripts/icon/make-icns.sh` makes `resources/icon.iconset` with `sips -z` (16, 32, 64, 128, 256, 512, 1024, with the @2x names), then `iconutil -c icns -o resources/icon.icns`, then removes the iconset. Both outputs are committed, so a build needs neither script. `electron-builder.json` gains `"mac": { "icon": "resources/icon.icns" }` and `"win": { "icon": "resources/icon.png" }` (the packager makes the `.ico`).

**In the app:** the start screen shows the mark (`<img src>` of the bundled SVG, `alt=""`, 48 px from the size tokens) before the "AdManager" wordmark. Under `npm run dev` on macOS, `app.dock.setIcon` with `resources/icon.png` (unpackaged only).

**Packaged check.** New `vitest.package.config.ts`, `tests/package/app-names.test.ts`, script `test:package` (`vitest run --config vitest.package.config.ts`), run after `npm run package:dir`; not part of `npm test` or `test:build`. On macOS it reads `dist/mac-arm64/AdManager.app/Contents/Info.plist` through `plutil -convert json -o -`: `CFBundleName`, `CFBundleDisplayName` and `CFBundleExecutable` are "AdManager", `CFBundleIdentifier` "com.adman.app", `CFBundleIconFile` names a file that exists in `Resources`, the `.adman` document type is listed. It reads `package.json` out of `Resources/app.asar` with `@electron/asar` (already in `node_modules`): `productName` is "Adman". On Windows it is skipped with a plain reason (the stakeholder's check).

**Why the run-time proof is a hand check.** A packaged app ignores `ADMAN_USER_DATA_DIR` and the fuses stop a test from attaching to it, so the only data folder and Keychain a packaged run can use are the stakeholder's own, and reading the key shows a Keychain prompt he must answer. The steps (R2P-11 lists them): quit every copy; open `dist/mac-arm64/AdManager.app`; if macOS asks to use "Adman Safe Storage", choose Always Allow; Settings shows the saved keys' last four characters; `~/Library/Application Support/AdManager` does not exist; Keychain Access shows no "AdManager Safe Storage".

## Slices

### R2P-1 — Contracts

- **Exists when done:** the four new commands have policy rows and stub handlers; the three tools are `notBuilt` rows; `ToolDef` has `targets` and `pickTarget`; the event fields, the new event and the stub query exist. No agent can do anything new.
- **New files:** `src/shared/schemas/commands/asset-files.ts` (`assetImportFilesInput`), `src/shared/schemas/commands/campaign-brief.ts` (`campaignFromBriefInput`), `src/shared/schemas/commands/project-default.ts` (`projectCreateDefaultInput`); stub commands `src/main/commands/asset/import-files.ts`, `src/main/commands/campaign/from-brief.ts` (both names), `src/main/commands/project/create-default.ts`, each refusing `RULE_VIOLATION` "This is not built yet." `not_built`; `src/main/queries/ask-files.ts` (user only; stub `NOT_FOUND` "That request has ended."); `src/main/mcp/ask-kinds.ts` (D7 table); group files `import-tools.ts`, `brief-tools.ts`, `project-tools.ts`, one `notBuilt` row each.
- **May touch:** `src/main/commands/agent-policy.ts` (rows: `project.createInDefaultFolder` allow, `campaign.createFromBrief` allow, `campaign.createFromBriefWithFiles` ask, `asset.importFiles` ask, action texts of D7); the asset, campaign and project command index files (spread the stubs); `src/main/mcp/tools/table.ts` (`targets`, `pickTarget`; the three group files after `FORMAT_TOOLS`); `src/main/mcp/tools/index.ts` (call `pickTarget`; a name outside `targets` gives `INTERNAL`); `src/main/core.ts`; `src/main/queries/queries.ts` (one line); `src/shared/schemas/events.ts` (`kind`, `fileCount` on `agent.permissionRequested`; `app.showProject`; `EVENT_NAMES`); `src/main/mcp/permissions.ts` (emit `kind` from `ASK_KINDS` and `fileCount: 0`; nothing else).
- **Tests first:** `tests/unit/main/mcp/tools/tool-setup-targets.test.ts` (made-up rows: `pickTarget` routes; a pick outside `targets` is `INTERNAL` and reaches no command); `tests/unit/shared/schemas/round-2-schemas.test.ts` (each input refuses unknown keys, 0 and 21 paths, an empty text, a bad name); `tests/integration/agent/round-2-stubs.test.ts` (each new command refuses `not_built`; `agent.askFiles` refuses an agent with `AGENT_DENIED`).
- **Approved edits:** `tests/unit/main/commands/agent-policy-table.test.ts` (the four rows); `tests/unit/main/mcp/tools/tool-plan.test.ts` (the 32 names in listing order; the three in `STILL_NOT_BUILT`); `tests/unit/main/mcp/tools/table.test.ts` (the new command targets in the allowed list); registration tests that list command, query or event names exactly (add the new names); `tests/integration/mcp/ask-flow.test.ts` (the payload's exact field list gains `kind` and `fileCount`); `tests/unit/renderer/fake-api.ts` (make-it-compile).
- **Exit check:** class E + B: `npm run lint`, `npm run typecheck`, `npm test`; the tool-list snapshot unchanged.
- **Security:** short. **Depends on:** nothing. **Size:** medium.

### R2P-2 — The brief text reader

- **Exists when done:** `parseBriefText`, the Markdown reader, `pictureRef` and the shared `briefSubjectIds` work as D1 to D3 say.
- **New files:** `src/shared/brief/text.ts`, `markdown.ts`, `markdown-labels.ts`, `picture-refs.ts`, `subject-ids.ts` (moved from `src/renderer/screens/project-home/campaign-input.ts`, which re-exports it or its callers import from the new place).
- **May touch:** `src/renderer/screens/project-home/campaign-input.ts` (the move only).
- **Tests first:** `tests/unit/shared/brief/text.test.ts` (JSON, YAML and Markdown each read; YAML `Region: Canada` with no known key falls to Markdown; an unreadable text gives the D1 message; never throws on 10,000 nested lists); `markdown.test.ts` (the D2 example gives the stated draft exactly; each rule 1 to 8 its own case; per-language word lists; a subject list made from items; a fenced block ignored; `**Region:**`; a field twice); `picture-refs.test.ts` (ULID in either case, absolute on each platform, `~/x`, `C:x.png`, `..`, empty); the timed rule of `parse-slow` applies to Markdown too: a 16,384-byte worst case under 5 s.
- **Approved edits:** the import path of `briefSubjectIds` in `tests/unit/renderer/screens/project-home/brief-subject-ids.test.tsx`.
- **Exit check:** class A.
- **Security:** short (a parser of hostile text). **Depends on:** nothing. **Size:** medium.

### R2P-3 — A person's brief may name any file or an asset ID

- **Exists when done:** `brief.parse` reads text with `parseBriefText`; `checkBriefPictures` applies D3 (any path, relative to the file's folder, absolute, or an asset ID); the window's notes, the photos from asset IDs and the "This brief added…" line follow D3.
- **May touch:** `src/main/assets/brief-pictures.ts`; `src/main/commands/brief/parse.ts`; `src/shared/schemas/commands/brief.ts` (`SubjectPictures`, `PictureNoteReason`); `src/renderer/screens/project-home/brief-load/` (`photo-notes.ts`, `use-brief-photos.ts`); `src/renderer/screens/project-home/brief-form/brief-form.tsx` and the form model file that turns `assetIds` into form photos.
- **Tests first:** `tests/integration/assets/brief-pictures-anywhere.test.ts` (a brief file naming `../elsewhere/a.png` and an absolute path outside its folder: both accepted as real paths; a folder path `not_found`; a text file `not_a_picture`; an asset ID of an image in the project into `assetIds`; an unknown ID and a video's ID `unknown_asset`; pasted text with a relative path `not_full_path` and no file touched; no log line holds any given path); `tests/integration/campaigns/brief-parse-text.test.ts` (a Markdown text; a pasted absolute path); a renderer test for the two new note lines and an asset-ID photo shown attached.
- **Approved edits:** `tests/integration/assets/brief-pictures.test.ts` and `tests/integration/assets/brief-pictures-place.test.ts` (remove the `outside_folder`, `wide_folder`, `isWideFolder` and `no_folder` cases; the cases that named a picture outside the folder now expect it accepted); `tests/integration/campaigns/brief-parse.test.ts` (the typed-brief case at "gives every picture of a typed brief no_folder" now expects `not_full_path` for `photos/can.png` and a checked path for `/etc/passwd`, which is `not_a_picture`; the text-input cases may also see Markdown reading); `tests/unit/renderer/screens/project-home/brief-load-photos.test.tsx` and `photo-notes.test.ts` (the reasons list); the "from its folder" line in `brief-form.test.tsx`, `brief-form-rulings.test.tsx`, `brief-form-model.test.ts` and `subject-photos-remove.test.tsx`.
- **Exit check:** class B + D; `npm run test:e2e` (the brief load flow).
- **Security:** full (it lifts a security rule; the review checks that no path reaches a log, event, reply or `campaign.brief`). **Depends on:** R2P-2. **Size:** medium.

### R2P-4 — "Paste a brief"

- **Exists when done:** the dialog of D4 replaces "Type a brief".
- **New files:** `src/renderer/screens/project-home/brief-paste/` (component, CSS module, `index.ts`).
- **May touch:** `src/renderer/screens/project-home/brief-load/brief-load.tsx` (the button and the mount).
- **Tests first:** `tests/unit/renderer/screens/project-home/brief-paste.test.tsx` (Read brief disabled on blank text; a refusal shows in the dialog and keeps the text; success closes it and starts the loaded-brief flow; "Start from an empty form" opens the empty form; axe). Shots `tests/shots/r2p-4.shots.ts`: 340 the empty dialog, 341 a pasted Markdown brief, 342 the form it opens.
- **Approved edits:** `tests/unit/renderer/screens/project-home/brief-type.test.tsx` ("Type a brief" becomes "Paste a brief", then "Start from an empty form"); `tests/shots/s2-13.shots.ts`, `s2-14.shots.ts`, `sp-5.shots.ts` (the button's name).
- **Exit check:** class D + `npm run test:e2e`.
- **Security:** none. **Depends on:** R2P-3. **Size:** small.

### R2P-5 — `import_assets` and the ask for files

- **Exists when done:** `asset.importFiles` and `import_assets` work as D5; the broker applies D7 (kinds, auto-approve for deletes only, the file list, `agent.askFiles`, the target lines).
- **New files:** `src/main/assets/import-files.ts` (text rules, the after-allow checks, error mapping); the body of `src/main/commands/asset/import-files.ts` and of `src/main/queries/ask-files.ts`; the row of `import-tools.ts`; `src/main/mcp/tools/import-replies.ts`; `src/shared/assets/file-path-text.ts` (the pure text rules, also used by D6).
- **May touch:** `src/main/mcp/permissions.ts`, `src/main/mcp/ask-target.ts`, `tests/unit/main/mcp/ask-target.test.ts` (new rows only); the five shared tool-list test files.
- **Agent reads:** asset IDs. **Never:** a path, a file name from a path, a file's contents, anything about a file before the allow. **Agent changes:** adds copies of files the user allowed, one call at a time through the ask.
- **Tests first:** `tests/integration/mcp/import-assets.test.ts` (fake clock: allow imports a PNG, an MP4 and a TTF and replies their IDs in order; refuse, time-out and busy import nothing and leave the assets folder as it was; with `autoApproveDestructive` true the event is still sent; the event has `kind: 'import'`, `fileCount`, and no path; `agent.askFiles` gives the list to the user while open, `AGENT_DENIED` to an agent, `NOT_FOUND` after; 21 paths, a relative path, a path with U+202E and a `.txt` are refused with no event; a missing file and an existing one give the same event, the difference shows only after the allow; after the allow a folder, a link on the way, an SVG renamed `.png` and a file the project holds (its existing ID) each as D5; no reply, refusal, event or log line holds any given path or file name; `riskyKeys`; the word test); `tests/unit/main/assets/import-files.test.ts` (text rules table; case-insensitive real-path compare on darwin).
- **Approved edits:** `tests/integration/mcp/ask-flow.test.ts` (an auto-approve case limited to deletes, if one asserts any `ask` command); the five shared files; `tests/integration/mcp/every-tool.ts` (add `paths`, `library`); `tests/integration/mcp/secret-leak.test.ts` (the new tool joins the call list automatically; plant a path to check).
- **Exit check:** class E + B.
- **Security:** full. **Depends on:** R2P-1. **Size:** medium.

### R2P-6 — The permission dialog for files

- **Exists when done:** the dialog shows D7's words and the file list for an `'import'` ask; deletes look as before.
- **New files:** `src/renderer/app/permission-dialog/file-list/` (the list, its loading and failure lines), `src/renderer/app/permission-dialog/ask-words.ts` (the words per kind).
- **May touch:** `src/renderer/app/permission-dialog/permission-dialog.tsx`, `use-ask.ts`, its CSS module.
- **Tests first:** `tests/unit/renderer/app/permission-dialog-files.test.tsx` (the list asked for with the request ID and drawn as text; a path holding markup shows as text; "Import" stays off until the list shows and 750 ms pass; a failed list leaves only "Refuse"; no checkbox; Escape refuses; axe). Shots `tests/shots/r2p-6.shots.ts`: 343 three files, 344 twenty long paths, 345 the brief command's dialog.
- **Approved edits:** `tests/unit/renderer/app/permission-dialog.test.tsx` (fixtures gain `kind: 'delete'` and `fileCount: 0`).
- **Exit check:** class D + `npm run test:e2e`.
- **Security:** short (it draws paths, a named change to "Paths in the renderer"). **Depends on:** R2P-5. **Size:** small to medium.

### R2P-7 — `create_campaign_from_brief`

- **Exists when done:** both commands and the tool work as D6.
- **New files:** the bodies of `src/main/commands/campaign/from-brief.ts` and `from-brief-pictures.ts`; the row of `brief-tools.ts`; `src/main/mcp/tools/brief-replies.ts`.
- **May touch:** `src/main/commands/campaign/create.ts` (export `createCampaignRows`, no behaviour change); `src/main/commands/campaign/from-brief-plan.ts` (new: reads and checks the brief), `src/main/commands/campaign/index.ts` (pass `deps`), `src/main/mcp/permissions.ts` (the file reader for the files command; the whole brief is checked before the ask, reading no file), `src/main/commands/asset/import-files.ts` (`insertImportedRows` shared, no behaviour change); `src/main/mcp/ask-target.ts` (the brief target line, if R2P-5 left it to this slice); the five shared tool-list test files.
- **Agent reads:** the campaign, direction, master variant, subject and imported asset IDs. **Never:** a path, a picture note, file existence before the allow. **Agent changes:** creates subjects, attaches its brief's pictures to them, makes the campaign; with files, only after the user's allow.
- **Tests first:** `tests/integration/mcp/brief-tool.test.ts` (the D2 Markdown example with an asset ID and no path: no event, the campaign, subjects and attachment made; the same with a path: the event, and refuse writes no campaign, subject, asset or copy; allow imports and attaches; auto-approve on still asks; JSON and YAML texts; `brief_incomplete` names the fields; a relative picture refused with no disk read; an unknown ID, a video's ID and another subject's photo each refused, nothing written; an existing subject ID reused; `campaign.brief` holds no `pictures` and no path; no reply, refusal, event or log line holds a path or the brief text; the plain command sent a path directly refuses `brief_names_files`; `riskyKeys`; the word test); a unit test of `briefCreatedFields`.
- **Approved edits:** the five shared files; `tests/integration/mcp/every-tool.ts` (add `text`).
- **Exit check:** class E + B.
- **Security:** full. **Depends on:** R2P-1, R2P-2, R2P-5. **Size:** medium.

### R2P-8 — `create_project`

- **Exists when done:** the command and tool work as D8; `createProjectFile` refuses any entry at the name.
- **New files:** the body of `src/main/commands/project/create-default.ts`; the row of `project-tools.ts`; `src/main/mcp/tools/project-create-replies.ts`.
- **May touch:** `src/main/db/project-file.ts` (the `lstat` check only); `src/main/commands/project/create.ts` (share the create work); `src/main/commands/project/index.ts` (pass `deps`); the five shared tool-list test files.
- **Agent reads:** the project ID and its own name. **Never:** the folder, the path. **Agent changes:** creates and opens an empty project in the default folder.
- **Tests first:** `tests/integration/mcp/create-project.test.ts` (the file lands in the default folder and the project is open; the reply is exactly `projectId` and `name`; a name with `/`, `..`, `\`, `:`, a control character, a leading dot, `CON` and 101 characters each refused with no file; an existing file, and a link that leads nowhere, at the name each refused, the file unchanged and the link's target not made; a `location` argument is dropped; no reply or log line holds the folder's path; `riskyKeys`; the word test); `tests/integration/commands/project-create-link.test.ts` (the user's `project.create` also refuses a dangling link).
- **Approved edits:** the five shared files; `tests/integration/mcp/every-tool.ts` (add `name`).
- **Exit check:** class E + B.
- **Security:** full. **Depends on:** R2P-1. **Size:** small.

### R2P-9 — Showing an opened project; the Finder hand-over (main side)

- **Exists when done:** D9's main side.
- **New files:** `src/main/open-from-system.ts`, `src/main/single-instance.ts`.
- **May touch:** `src/main/index.ts` (named exception: the moves and calls; it ends shorter than today); `src/main/open-file.ts` (`handoffPaths`); `tests/unit/main/ipc.test.ts` (new cases for `handoffPaths` only, if they live there).
- **Tests first:** `tests/unit/main/open-file-handoff.test.ts` (`handoffPaths` over a good list, 21 paths, a relative one, a non-`.adman`, a non-object, `__proto__`); `tests/e2e/open-from-system.spec.ts` (two projects open; `app.emit('open-file', …)` with the first project's path shows the first; a third file opens and shows; a second launch of the built app with a project path on its command line hands it over and exits).
- **Approved edits:** none expected.
- **Exit check:** class G (`npm run test:e2e` on this desktop). **Hand check** (stakeholder): with `npm run dev` running and a packaged copy registered for `.adman`, a double-click in Finder opens the file in the running app.
- **Security:** short (start-up, the single-instance lock, data from another process). **Depends on:** R2P-1. **Size:** small to medium.

### R2P-10 — Several projects in the window (window side)

- **Exists when done:** D9's window side.
- **May touch:** `src/renderer/stores/app-store.ts`; `src/renderer/app/project-switcher/`; `src/renderer/screens/start/start-screen/` and a new `src/renderer/screens/start/open-now/`.
- **Tests first:** `tests/unit/renderer/stores/app-store-show.test.ts` (a project that appears through an agent is not shown; `app.showProject` shows it; the first read shows the newest; the window's own open shows it); switcher tests (the count text with two open; "Open another project…" opens the picker and shows the new one while the first stays in the list); `tests/unit/renderer/screens/start/open-now.test.tsx`. Shots `tests/shots/r2p-10.shots.ts`: 346 the switcher with two projects, 347 its menu, 348 the start screen with "Open now".
- **Approved edits:** `tests/unit/renderer/app/project-switcher.test.tsx` (the menu gains "Open another project…"; with two open the button's name gains " · 2 open"); tests of `app-store.ts` that expect a jump to any newly listed project (now only on the first read or `app.showProject`).
- **Exit check:** class D + `npm run test:e2e`.
- **Security:** none. **Depends on:** R2P-1 (the event's schema); its end-to-end proof uses R2P-9. **Size:** small to medium.

### R2P-11 — AdManager and its icon

- **Exists when done:** D10: the words, the SVG, the two scripts, `resources/icon.png` and `resources/icon.icns`, the builder fields, the About panel, the dev Dock icon, the start screen mark, `test:package`.
- **New files:** `src/shared/config/app-name.ts`; `src/renderer/ui/app-mark/` (the SVG, a component, its CSS module); `src/main/windows/app-identity.ts` (`applyAppIdentity`: About panel, dev Dock icon); `scripts/icon/render-icon.mjs`, `scripts/icon/make-icns.sh`; `resources/icon.png`, `resources/icon.icns`; `vitest.package.config.ts`, `tests/package/app-names.test.ts`.
- **May touch:** `electron-builder.json`; `package.json` (the `test:package` script only; `name` and `productName` stay); `src/renderer/index.html`; `src/main/windows/app-window-options.ts`; `src/main/windows/app-menu.ts` (explicit labels); `src/main/index.ts` (named exception: pass `APP_DISPLAY_NAME`, one `applyAppIdentity` call); `src/main/quit-question.ts`; `src/renderer/screens/start/start-screen/`; `src/renderer/app/project-switcher/project-switcher.tsx` (the fallback label).
- **Tests first:** `tests/unit/config/app-names.test.ts` (`package.json` `productName` is "Adman" and `name` "adman", with a comment saying the data folder and Keychain hang on it; `electron-builder.json` `productName` "AdManager", `appId` unchanged, both icon fields name files that exist); `tests/unit/renderer/ui/app-mark.test.ts` (the SVG's colours are the two token values; it has no `<text>`, no `<script>`, no external reference); `tests/package/app-names.test.ts` as D10. Shots `tests/shots/r2p-11.shots.ts`: 349 the start screen, 350 the icon PNG drawn at 1024 and at 32 px (open the PNG files).
- **Approved edits:** `tests/unit/config/installer-config.test.ts` (`productName` "AdManager"); `tests/unit/main/quit-question.test.ts`, `tests/unit/main/quit-after-answer.test.ts`, `tests/e2e/quit-warning.spec.ts` ("Quit AdManager?"); `tests/unit/main/windows/app-menu.test.ts` (`appName` "AdManager", the explicit labels); `tests/unit/renderer/app/app-before-state.test.tsx`, `app-shell.test.tsx`, `project-switcher.test.tsx` (the fallback button "AdManager"); `tests/shots/st-1.shots.ts`, `st-2.shots.ts`, `st-6.shots.ts`, `tour.shots.ts` (the name they wait for).
- **Exit check:** class G + D: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:build`, `npm run test:e2e`, then once `npm run package:dir` and `npm run test:package`. Do not open the packaged app (it would use the stakeholder's data folder and Keychain); list the hand check of D10 in the report.
- **Security:** short (`electron-builder.json`: the fuses must be unchanged; the test asserts them as they are). **Depends on:** R2P-10 (both edit `project-switcher.tsx` and the start screen) and R2P-9 (`index.ts`). **Size:** medium.

### R2P-12 — Agent workflow and the round's exit

- **Exists when done:** an end-to-end MCP run against the built app: `create_project`; `import_assets` with the dialog answered "Import" by the test; `create_campaign_from_brief` in Markdown naming the imported asset by ID (no dialog); then the same with a full path (dialog, "Import"); the window lists the agent's project without switching to it. The hand-check list for the stakeholder.
- **New files:** `tests/e2e/round-2-agent.spec.ts` (built on `tests/e2e/mcp-workflow-steps.ts` helpers); `tests/shots/r2p-12.shots.ts` (351 the import dialog in the real app, 352 the switcher listing the agent's project).
- **May touch:** nothing in `src/`.
- **Exit check:** `npm run test:e2e`; the full checks of DEV-RULES.
- **Hand checks** (stakeholder): Claude Code imports two photos by path and makes a campaign from a Markdown brief; the D10 Keychain and data folder check; the R2P-9 Finder check; Windows (D-087).
- **Security:** short. **Depends on:** every other slice. **Size:** small.

## Waves

At most two developers at once.

| Wave | Slices side by side | Why they do not clash |
|------|---------------------|-----------------------|
| 1 | R2P-1, R2P-2 | R2P-2 owns new `src/shared/brief/` files and one renderer move; R2P-1 owns the shared files |
| 2 | R2P-5, R2P-3 | Import and ask code vs. the brief reader's checks and brief-load screens |
| 3 | R2P-7, R2P-4 | Campaign commands and the brief tool vs. the paste dialog. Both edit no shared tool test file at once: R2P-4 has none |
| 4 | R2P-8, R2P-6 | Project commands and tool vs. the permission dialog. R2P-8 and R2P-7 both edit the five shared tool lists; R2P-7 merges first (A-248) |
| 5 | R2P-9, R2P-10 | Main start-up vs. renderer store and switcher |
| 6 | R2P-11, then R2P-12 | R2P-11 follows R2P-9 and R2P-10; R2P-12 last |

Merge order inside a wave: the first-named slice first. Every merge is followed by the full checks on `main`.

## Assumptions

| ID | Assumption | Undo |
|----|------------|------|
| A-340 | Pasted text is tried as JSON, YAML (only when it gives a known field), then Markdown | Easy |
| A-341 | A pasted brief has no size limit, like a brief file (D-059 item 2) | Easy |
| A-342 | The Markdown form is the fixed label table and walk of D2; the first value of a field wins | Easy |
| A-343 | A picture text that is a ULID is an asset ID; one that is absolute is a path; `~` is not expanded | Easy |
| A-344 | A person's brief may name any file on the disk, imported with no confirm under the normal checks (stakeholder ruling); the inside-the-folder and wide-folder rules are removed | Settled |
| A-345 | A pasted brief's relative picture is refused with a note; a brief file's relative picture is read from its folder, wherever it leads | Easy |
| A-346 | The split: a person's brief imports paths with no confirm; an agent's brief with any path asks with the same dialog as `import_assets`; asset IDs never ask (for the stakeholder's review) | Medium |
| A-347 | "Paste a brief" keeps a "Start from an empty form" button | Easy |
| A-348 | An agent may import at most 20 files per call; images, videos and fonts only; files, never folders | Easy |
| A-349 | Agent imports and agent brief files are always copied, never linked; a path reached through a link is refused | Easy |
| A-350 | Before the user's allow nothing on disk is read for an agent's paths, so an agent cannot learn whether a file exists | Easy |
| A-351 | `autoApproveDestructive` covers deletes only; the ask paths reach the window through the user-only query `agent.askFiles`, never in an event | Easy |
| A-352 | The window draws full paths in the agent's import dialog only, as text (a named change to "Paths in the renderer") | Medium |
| A-353 | The brief tool picks between two commands (allow without files, ask with files) so the policy table stays static | Easy |
| A-354 | An agent's brief reuses an existing subject by ID and attaches its pictures to its subjects; it fills the subject slot as `create_campaign` does | Easy |
| A-355 | `create_project` uses the default projects folder; a `file_exists` refusal tells the agent a file of that name is there (accepted) | Easy |
| A-356 | A project an agent creates is listed in the switcher and not shown; only the window's own open, a system open or the first read shows a project | Easy |
| A-357 | On macOS the single-instance lock is taken after `ready`, so a losing copy can hand over the files Finder gave it | Medium |
| A-358 | Only the names in D10 change to AdManager; messages, folders, the file type's words and technical names keep "Adman" | Easy |
| A-359 | The icon's colours are `--color-text` and `--color-accent`; the letters are drawn as paths | Easy |

## Open questions

1. **A Markdown brief file loaded with "Load a brief"** still goes to the AI reader (`brief.extract`, a provider call). Should it be read by the fixed Markdown rules first, with the AI reader only for a `.txt` file or a Markdown file the rules cannot read? *Recommendation:* yes; it is one small slice on `brief.parse` and `brief-load/`. Not planned until answered.
2. **The Keychain and data folder check** after the rename needs the stakeholder's own Mac, data and a click on the Keychain prompt. *Recommendation:* the stakeholder runs the D10 steps once after R2P-11 merges. If a new "AdManager Safe Storage" entry appears, the fallback in "Item 17" is built.
3. **Should a project an agent creates be shown at once?** *Recommendation:* no; it is listed in the switcher and the agent activity line names it (A-356), so an agent never takes the user away from his work.

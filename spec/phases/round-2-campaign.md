# Round 2: the campaign page and the asset library

The stakeholder's hand-testing feedback of 2026-11-21, items 8, 9, 10, 11 and 14, with the orchestrator's rulings R-8 and R-9. Other round-2 files cover the editor (R-13: picture and video generation move into the editor, the "Make a video" card leaves the campaign page), agent tools, the first-run flow, windows and approvals.

**Status:** not built. Slices R2C-1 to R2C-7.

Every slice reads `spec/phases/DEV-RULES.md` first, then this file ("Rules for these slices", "Design additions" and its own slice), then the topic sections its slice names.

## Goal

The campaign page reads at a glance: tabs for Variants, Checks and Translations on the row with Undo and Redo; each direction's variants laid out as a table whose top-left post is the master, with sizes as rows and languages as columns; one click selects a post and a double-click opens it; each translation shows the text it comes from. And the project has one clear place, "Assets", reachable from the project page, the campaign page and the editor, that lists pictures, clips, fonts and subjects, imports files, and makes subjects with their photos, without a brief.

## Rules for these slices

- Test first; one slice per developer run, well under 300k tokens; `HANDOFF.md` if near it.
- One folder per component with its own CSS module. Every colour, space, radius, size and type size from `src/renderer/ui/tokens.css`; no new token (existing ones named below are enough). Source files aim for 200 lines, 300 at most. No semicolons.
- Wording follows `spec/screens.md`, "Rules for every screen": counts with "(s)", text from files or the user drawn as text only, **no file path drawn** (base names and display names only).
- **No command, query, event or agent policy row is added or changed by this file.** Every action uses a built command: `subject.create`, `subject.update`, `asset.import`, `asset.update`, `check.run`, `translation.set`, `translation.approve`, `variant.delete`, `history.undo`, `history.redo`. All of `subject.*` and `asset.import` / `asset.update` stay `deny` for agents (agent import is another round-2 file's item; R-3).
- **Shots.** Each slice that changes what a user sees adds `tests/shots/r2c-{n}.shots.ts`. Picture names `340` to `369` (`shot(page, '34x-...')`), in the slice's own sub-range below. Made-up content only ("Tidewater Coffee", "Harbour Blend", "Linnea Park"); no real brand or person.
- **Check class.** Every slice is class D (UI). The exit check below lists the commands for the slice. The full list in `DEV-RULES.md`, "Verify before you say done", runs once after the last wave, by the orchestrator, not per slice.
- **Existing tests.** A developer changes an existing test only as the slice's "Approved edits" says, and lists each change in the report.

### Shared files

- `src/renderer/screens/campaign/campaign-view/campaign-view.tsx`: R2C-1 (restructure), then R2C-3 (select or open). The editor round's slice that removes the "Make a video" card also touches the overview (see R2C-1, "VideoPanel").
- `src/renderer/screens/campaign/variant-grid/`, `variant-tile/`, `direction-grids/`: R2C-2, then R2C-3.
- `src/renderer/screens/project-home/project-home/project-home.tsx`: R2C-5 only in this file. Another round-2 file (windows, R-7) may touch it; the orchestrator orders them.
- `src/renderer/dialogs/import-dialog/`: R2C-7 only.
- `tests/e2e/screen-tour.ts`, `tests/e2e/localize-steps.ts`: R2C-1, then R2C-3.

## Design additions

### 1. The campaign page, piece by piece (items 9 and R-8)

The page from top to bottom:

1. **The head** (new component `campaign-head/`, moved out of `campaign-view.tsx` with no change in what it shows): "Back to project", the campaign name, the approval bar, "Export…", "Reports", "Publish…", and from R2C-5 "Assets". Stays in place.
2. **The paid count** under the head, on the Overview tab only. Stays in place.
3. **The variant tab row** ("Open variants": "Overview" and one tab per open variant). Stays in place.
4. **Inside Overview, the view bar** (new component `campaign-overview/`): on the left a tab list labelled "Campaign views" with three tabs, on the right the campaign's Undo and Redo (`campaign-undo/`, moved here, unchanged).

| Tab | Icon (`Icon` name) | Word | Mark |
|-----|--------------------|------|------|
| Variants | `grid` | Variants | none |
| Checks | `shield` | Checks | the warning badge (below) |
| Translations | `globe` | Translations | none |

- The icon is `aria-hidden`; the word is the tab's name. The tab list is a Radix `Tabs.Root` drawn with the shared `TabRow` (`look="row"`), so Left and Right move between tabs, Home and End go to the ends, and a tab shows as soon as it has focus.
- **The badge** (R-8): the number of warnings, in `layout.badge layout.warn`, after the word, with `role="img"` and `aria-label` "{n} warning(s)" (so the tab reads "Checks 3 warning(s)"). Count: over every variant whose stored check is current (`stale` false), the number of check results with `status: 'warn'`. A variant with two warned checks counts 2. Checks have no error level (statuses are `pass`, `warn`, `skipped`), so the count is warnings only (A-302). No badge at 0, while `check.results` is being read, or when it is refused. Read with the built hook `useCheckResults` (exported from `check-panel/index.ts`), so it follows `project.changed` as the panel does. Pure count: `campaign-overview/check-count.ts`, `warningCount(states: VariantCheckState[]): number`.
- **Which tab shows** is page state held in `CampaignPage` (`useState<'variants' | 'checks' | 'translations'>('variants')`), so it is kept while a variant tab is shown and back again, and starts at Variants when the campaign tab is opened again (A-303).
- The bar: one flex row, `min-height: var(--tab-row-height)`, a bottom line `var(--border-width) solid var(--color-line)` across the full width, Undo and Redo at the right end with `gap: var(--space-2)`. Narrow window: the tab list scrolls sideways inside its own box (as `TabRow` already does); Undo and Redo never wrap under it.

5. **The Variants tab** (new component `variants-tab/`), in order:
   - From R2C-3, the hint line, muted: "Click a post to select it. Double-click it, or press Enter, to open it."
   - The direction grids (`direction-grids/`, design addition 2).
   - The line "Runs and panels below are for: {title} · {sizeLabel} · {language}" (unchanged words; it names the selected variant).
   - The slot view, the picture panel (`generate-panel/`), the run list. **Stay**, acting on the selected variant, until the editor round's Generate panel replaces them (A-306, open question 1).
   - The "Make a video" card is not placed (R-13): see R2C-1, "VideoPanel".
6. **The Checks tab**: the check panel (`check-panel/`, unchanged), then the rule set panel (`rule-set-panel/`, unchanged; **moved** here from under the run list, because the checks run against it; A-305).
7. **The Translations tab**: the translation panel (`translation-panel/`, **moved** from under the run list). It is always offered. When every language of the campaign is its primary one, the tab shows only the muted line "This campaign has one language, {language name}, so there is nothing to translate." (A-304). `{language name}` from `languageName` (design addition 2).

**Moved:** rule set (to Checks), checks (own tab), translations (own tab), Undo and Redo (into the view bar). **Left in place:** head (with approvals, export, reports, publish), paid count, variant tab row, direction grids and their controls, the "Runs and panels" line, slot view, picture panel, run list. **Removed by another round-2 file:** "Make a video". `campaign-sections/` is deleted (its job is done by `campaign-overview/`).

The type `CampaignSectionProps` moves to `campaign-overview/tab-props.ts` as `CampaignTabProps = { projectId: string; campaignId: string; data: CampaignGet }` (same fields). `check-panel.tsx`, `rule-set-panel.tsx` and `translation-panel.tsx` change only that one import line.

### 2. The variant grid shows inheritance (item 8)

Per direction, under its heading, count line and direction controls (unchanged), the direction's variants are a table:

```
              English · en   German · de   French · fr
Square        [MASTER]       [tile]        [tile]
1080×1080
Story         [tile]         [tile]
1080×1920
Wide          [tile]                       [tile]
1920×1080
```

- **Axes** (pure, `variant-grid/grid-axes.ts`, `gridAxes(variants: VariantSummary[])` → `{ rows: GridRow[], columns: string[], cells: GridCell[] }`): rows are size labels, columns are language codes, each in the order first met in the list it is given. `DirectionGrids` already gives the list in `direction-order.ts` order (master first, then the campaign's sizes order, then its languages order, then image before video, then `createdAt`), so the master's size is the first row, the master's language is the first column, and a size or language the campaign does not list comes after the listed ones (A-307). `GridRow = { sizeLabel, width, height }` (from the first variant met in that row). `GridCell = { row, column, variants }` (1-based, `variants` in list order).
- **One cell, one or two tiles.** The unique index `variant(direction_id, size_label, language, format)` lets an image and a video share a size and language: they share one cell, stacked, image first (A-308). An empty cell draws nothing (A-309).
- **Row heads**: "{sizeLabel}" in `--weight-bold`, under it "{width}×{height}" muted, `--font-size-small`. **Column heads**: "{language name}" in `--weight-bold`, under it the code, muted. `languageName(code)` is moved to the new pure file `src/renderer/ui/language-name.ts` (the same body as in `translation-words.ts`, which re-exports it from R2C-4; until then both exist and R2C-4 removes the copy).
- **Layout.** A scroll box (`overflow-x: auto`, `max-width: 100%`) holds one CSS grid: `grid-template-columns: max-content repeat({columns}, var(--thumbnail-tile))` set inline (as `TabRow` sets its columns), `gap: var(--space-3)`. Row 1 holds an empty corner and the column heads; column 1 holds the row heads. The tiles' list `<ul aria-label="Variants in {direction name}">` spans `grid-column: 2 / -1; grid-row: 2 / -1` with `grid-template-columns: subgrid; grid-template-rows: subgrid`, and each `<li>` (one per occupied cell) is placed with inline `gridRow` and `gridColumn`. **A row never wraps**; when the columns do not fit, the direction's box scrolls sideways and the page does not (A-310). The row heads are `position: sticky; left: 0` with `background: var(--color-bg)`, so the sizes stay readable while scrolling. Each sideways scroll is per direction, so a direction's rows stay aligned.
- **The list keeps its name and order.** `ul` "Variants in {direction name}" holds the cells in reading order (row by row, left to right), so the first button in it is the master's. Each tile sits in a `div data-variant="{id}"` inside its cell's `li` (the focus-after-delete lookup `[data-variant="…"] button` keeps working).
- **The master is plainly marked** (A-311): its tile has a "Master" badge (`layout.badge layout.accent`, icon `star`, `aria-hidden` icon, the word as text) at the start of the title line, and a tinted ground `var(--color-accent-soft)`. The size line keeps its " · master" ending. The selected state (accent border) stays as built and is drawn over the tint.
- The empty direction keeps "This campaign has no variants." as built.

### 3. Select, then open (item 11, R-9)

- **One click** on a tile's main button selects it: `onChoose(id)`, the tile's `aria-pressed` is true, the accent border shows (as built). Selecting opens no tab.
- **Double-click** on the main button, or **Enter** while it has focus, opens the variant's tab and shows it (today's plain-click action, `openVariant`). Cmd-click (Ctrl-click on Windows) and the tile's "+" still open it behind; **Mod+Enter** does the same from the keyboard.
- **Opening selects.** Opening a variant in any way (tile, Activity's "Go there", a tab) makes it the selected one, as `chosenId` follows the shown tab today (A-313). If the selected variant is deleted, the first variant is selected (as built).
- **What acts on the selection:** the line "Runs and panels below are for: …", the slot view, the picture panel and the run list (as built: they follow `chosenId`); and the keys Enter, Mod+Enter and Delete. Quick look and Delete on each tile keep working on their own tile without selecting it.
- **Keyboard** (A-312), handled on the grid's list (`onKeyDown`), only when the focus is on a tile's main button:
  - Left / Right: the previous / next tile in the same row (skipping empty cells; in a two-tile cell, the image tile then the video tile). Up / Down: the nearest tile in the row above / below, in the same column if it has one, else the nearest column. Home / End: the first / last tile of the row. Each move focuses that tile's main button **and selects it**. At an edge nothing moves.
  - Enter: open. Mod+Enter: open behind. Space: select (the button's own click). Delete or Backspace: the delete warning for that tile (`onDelete`), not on the master (nothing happens there).
  - Tab order is as built (each tile's main button and its actions are reachable by Tab); the arrows are a faster way, not the only way.
  - Pure: `variant-grid/grid-moves.ts`, `nextTile(axes, fromId, key): string | null`.
- The tile's `title` attribute is not used for the hint; the Variants tab hint line says it once.

### 4. Translations show their source (item 10)

The fact checked: a row's field sends `translation.set`, which writes that language variant's own text layer; the tab is a view over the posts' own text. The screen now says so and shows the source plainly.

- Under the tab's "Export translation sheet…", one muted line: "These are the texts on the posts themselves. A change here changes that post at once."
- Each row, top to bottom:
  - The row line as built: "{title} · {sizeLabel} · {layerName}" (`layout.label`).
  - A two-column pair (`display: grid; grid-template-columns: repeat(auto-fit, minmax(var(--width-column-min), 1fr)); gap: var(--space-3)`), stacking when narrow:
    - **Source**: label "{primary language name} (source)" (for example "English (source)"), then the source text in a quiet box (`background: var(--color-surface-soft)`, `border-radius: var(--radius)`, `padding: var(--space-2)`, the same type size as the field). No source: "No source text" (as built).
    - **Translation**: label "{language name}" (for example "German"), then the text field as built.
  - The mark, its source, the "Use for every …" tick and "Approve" as built.
- The field's accessible name: `aria-labelledby` "{lang label id} {row line id}" ("German Tidewater Coffee · Square · Headline"); `aria-describedby` the source text's id, so a screen reader hears the source after the name.
- `{primary language name}` is `languageName(data.primaryLanguage)` from `translation.forCampaign`. The source text is the direction master's copy for that layer key (as the query gives it); the master is taken to be in the primary language (A-314).

### 5. The Assets panel (item 14)

**Where.** A panel along the **left** edge of the window, under the top bar, over the page: `position: fixed; top: var(--bar-height); bottom: 0; left: 0; width: var(--activity-width); max-width: 100%`, `background: var(--color-bg)`, `border-right: var(--border-width) solid var(--color-line)`, `box-shadow: var(--shadow-3)`, `overflow: auto` (A-315). The Activity panel keeps the right edge, so both can be open. It is mounted once per project in `ProjectHome`, so it stays open while the user moves between the project page, a campaign and a variant's editor.

**How it opens.** The new `AssetsButton` (icon `box`, `aria-expanded`, `aria-controls="assets-panel"`) toggles it:

- On the project page, the section "Files" becomes **"Assets"**: the muted line "The pictures, clips, fonts and subjects of this project.", then "Open assets" (the button), then "Import files…" and "Import a folder…" (as built), then the missing-files line (as built).
- On the campaign page, "Assets" in the head (R2C-5), at the end of the head row. The head shows in a variant's tab too, so the editor reaches it without another button.
- Open state lives in a small context, `screens/assets/assets-scope/` (`AssetsScope` provider in `ProjectHome`; `useAssetsPanel(): { open: boolean, show(opener: HTMLElement | null): void, hide(): void } | null`, null outside a scope).

**The panel**, region `aria-label` "Assets", `id="assets-panel"`, `tabIndex={-1}`, focused on open:

- A sticky head: heading "Assets" (level 2), "Close assets" (icon `x`). Escape closes it when the focus is inside (a dialog the panel opened keeps its own Escape, as the Activity panel does). On close, focus goes back to the button that opened it.
- An action row: "Import files…" and "Import a folder…" (the built `ImportFiles`, unchanged), and from R2C-6 "New subject…".
- Then the groups, each a `section` with a level-3 heading "{group} · {n}":

| Group | Holds | Each item shows | Empty line |
|-------|-------|-----------------|------------|
| Subjects (R2C-6) | every subject, by name | the subject card (below) | "No subjects yet." and under it, muted: "A subject is the product, service or person an ad is about. Its photos guide AI pictures and can be placed in ads." |
| Pictures | `kind: 'image'` | a small picture (`assetUrl`, `width` and `height` `var(--option-thumb)`, `alt` ""), the display name, "{width}×{height}", the marks, and the subject choice | "No pictures yet." |
| Clips | `kind: 'video'` | icon `film`, the display name, "{width}×{height} · {m}:{ss}" (from `durationMs`, left out when null), the marks | "No clips yet." |
| Fonts | `kind: 'font'` | icon `text`, the display name, "Family: {fontFamily}" when known, the marks | "No fonts yet." |
| Other files | `kind: 'audio'` or `'text'` | icon `file`, the display name, the marks | the group is not drawn when empty |

- Order inside a group: display name (`localeCompare`, base sensitivity), then ID.
- **Marks** (`layout.badge`): "Reference only" (`library: 'reference'`, `layout.neutral`), "Made with AI" (`origin: 'generated'`, `layout.info`), "Linked" (`storage: 'linked'`, `layout.neutral`), "File not found" (`missing`, `layout.warn`; the picture is replaced by the words, as `PhotoTile` does).
- **The subject choice** (pictures only): a small `select`, visible label "Subject", accessible name "Subject of {display name}", options "No subject" and each subject's name. A change sends `asset.update { projectId, assetId, subjectId }` (`null` for "No subject") through the app store, so a refusal shows in the error banner. The list is read again on the `project.changed` that follows.
- **Reading**: `asset.list { projectId }` (both libraries, every kind), while the panel is open: on open, and again on each `project.changed` and `asset.changedOnDisk` for this project; a reply older than the newest read is dropped. Subjects come from `ProjectHome`'s own `project.get` (`data.subjects`), passed as a prop.
- **States**: "Loading the assets…" (muted) until the first reply; a refused read shows its message (`role="alert"`, `layout.notice layout.warn`) and "Retry". With no asset and no subject, each group shows its empty line and the action row stays.
- **No path is drawn.** The rows hold `absPath` and `relPath`; a pure picker `assets-panel/asset-view.ts`, `assetView(row)`, keeps only `id, kind, library, origin, storage, subjectId, displayName, width, height, durationMs, fontFamily, missing`, and only its result reaches the components.
- Every asset of both libraries is listed. Moving a file between libraries, renaming, removing a file and deleting a subject are not in the panel this round (A-316, A-319).

**The subject card** (R2C-6), one `article` per subject, labelled by its name:

- The name (level 4), the description (muted, left out when empty).
- Its photos: the pictures whose `subjectId` is the subject, as small pictures (`var(--option-thumb)`, `alt` the display name, "file not found" when missing), each with an icon button `x`, `aria-label` "Remove {display name} from {subject name}", which sends `asset.update { subjectId: null }` (the file stays in the project). None: "No photos yet. Add at least one." (muted).
- "Add photos…" (`aria-label` "Add photos to {subject name}") and "Edit…" (`aria-label` "Edit {subject name}").
- **Add photos**: `dialog.pickFiles { purpose: 'import', kind: 'image', multiple: true }`; a cancelled picker sends nothing. Then `asset.import { projectId, paths, library: 'asset', copy: false, subjectId }` (A-317). Meanwhile "Adding photos…" (`role="status"`, `BusySpinner`) and the button is disabled. Then the attach step (below). Then one line, `role="status"`: "{n} photo(s) added.", and any notes. A refusal shows its message (`role="alert"`).
- **The attach step** (pure, `screens/assets/attach-photos.ts`, `attachPlan(reply, assets, subjectId)` → `{ updates: string[], notes: Array<{ assetId, otherSubjectId }> }`): an ID in `reusedAssetIds` (a file already in the project keeps its library and subject on import) is attached with `asset.update { assetId, subjectId }` when it has no subject; when it is another subject's photo it is left there with the note "{display name} is already a photo of {other subject's name}. It was left there." (A-318). Animated WebP files add the built note "{name} holds an animation. Adman uses its first picture."

**The subject dialog** (R2C-6), `src/renderer/dialogs/subject-dialog/`, on `DialogFrame`, two modes:

- **New** (from "New subject…"): title "New subject". Fields "Name" (required) and "Description (optional)" (a text area). Then "Photos" with the hint "PNG, JPEG or WebP. At least one is needed. AI pictures are drawn from them." (the brief form's words), "Add photos…" (the image picker), and the picked files as a list of base names (`pictureName` from `@/shared/brief/picture-name`), each with "Remove {name}". Nothing is imported before Create. Footer "Cancel" and "Create subject".
  - "Create subject" with problems shows them as lines (`role="alert"`) and moves focus to the first bad field: "Enter a name." (blank after trimming), "Add at least one photo." (A-317).
  - Then, with "Making the subject…" (`role="status"`) and every control disabled: `subject.create { projectId, id, name, description }`, `id` made from the name by the built `briefSubjectIds` (`screens/project-home/campaign-input.ts`), stepping around every existing subject ID (pure: `subject-dialog/subject-plan.ts`, `newSubjectId(name, subjects)` and `subjectProblems(values)`). A refusal shows its message and nothing else is sent. Then `asset.import { projectId, paths, library: 'asset', copy: false, subjectId: id }`, then the attach step.
  - Result, with the footer "Done" (focused): "{name} was made with {n} photo(s)." and the notes; or, when the import is refused after the subject was made, "{name} was made, but its photos could not be added: {message}" (the subject stays; its card's "Add photos…" can add them).
- **Edit** (from "Edit…"): title "Edit {name}". "Name" and "Description (optional)" filled in; no photo part. Footer "Cancel" and "Save": `subject.update { projectId, subjectId, name, description }` with only the changed fields; nothing changed closes it without a command. A refusal shows in the dialog. Problem: "Enter a name."

**The import dialog** (R2C-7), `src/renderer/dialogs/import-dialog/`:

- "Attach to a subject" gains a last option **"New subject…"**, also when the project has no subject. With it chosen, a field "Subject name" shows under the select (focused). On "Import" with it blank: "Enter the subject's name." (`role="alert"`), nothing sent. Otherwise `subject.create` (ID from `newSubjectId`, description '') and then `asset.import` with that `subjectId`. A refused `subject.create` shows its message and imports nothing. A refused import after the subject was made shows "{name} was made, but the files could not be imported: {message}".
- The result footer gains **"Show in assets"** beside "Done" when the dialog is inside an `AssetsScope` and the panel is closed: it closes the dialog and opens the panel. The drop import's dialog gets it too (it is inside the scope).

### 6. Components: new and changed

| Folder | New or changed | Slice |
|--------|----------------|-------|
| `screens/campaign/campaign-head/` | new (moved from `campaign-view.tsx`) | R2C-1 (R2C-5 adds "Assets") |
| `screens/campaign/campaign-overview/` (`campaign-overview.tsx`, `view-tab-items.tsx`, `check-count.ts`, `tab-props.ts`) | new | R2C-1 |
| `screens/campaign/variants-tab/` | new | R2C-1 (R2C-3 adds the hint, select and open) |
| `screens/campaign/campaign-sections/` | deleted | R2C-1 |
| `screens/campaign/campaign-view/` | changed | R2C-1, R2C-3 |
| `screens/campaign/variant-grid/` (`grid-axes.ts`, `grid-heads.tsx`, `tile-actions.tsx`, `use-focus-after-delete.ts`; R2C-3: `grid-moves.ts`, `use-grid-keys.ts`) | changed, split | R2C-2, R2C-3 |
| `screens/campaign/variant-tile/` | changed (master mark; R2C-3 `onOpen`) | R2C-2, R2C-3 |
| `screens/campaign/direction-grids/` | changed (passes `onOpen`) | R2C-3 |
| `ui/language-name.ts` | new | R2C-2 |
| `screens/campaign/translation-panel/` | changed | R2C-4 |
| `screens/assets/assets-scope/`, `assets-button/`, `assets-panel/` (`use-assets.ts`, `asset-groups.ts`, `asset-view.ts`), `asset-row/` | new | R2C-5 |
| `screens/assets/subject-card/`, `screens/assets/attach-photos.ts`, `dialogs/subject-dialog/` | new | R2C-6 |
| `screens/project-home/project-home/` | changed | R2C-5 |
| `dialogs/import-dialog/` | changed | R2C-7 |

### 7. Security

No new command, query, event, IPC channel, protocol rule or policy row. The window sends paths only where it already may: picker answers to `asset.import`. The new parts draw no path (`assetView`, base names only), write nothing to the console, and draw every name and description as text. Agents gain nothing: `subject.*`, `asset.import` and `asset.update` stay `deny`. R2C-5, R2C-6 and R2C-7 are security class "short" (a reviewer checks that no path is drawn or logged and that only picker paths reach `asset.import`); the others are "none".

## Slices

### R2C-1 — Campaign view tabs (items 9, R-8)

- **Exists when done:** design addition 1: the head as its own component; the view bar with "Variants", "Checks" (with its badge) and "Translations" and the campaign's Undo and Redo on one row; the Variants tab holding the grids, the "Runs and panels" line, slot view, picture panel and run list; the Checks tab holding the check panel then the rule set; the Translations tab holding the translation panel or the one-language line. Plain click on a tile still opens the variant (R2C-3 changes it).
- **New files:** `src/renderer/screens/campaign/campaign-head/` (`index.ts`, `campaign-head.tsx`, `campaign-head.module.css`: the head markup and its `.head` and `.name` rules moved from `campaign-view`; props `projectId`, `campaignId`, `data: CampaignGet | null`, `approvals` (the store), `onBack`); `src/renderer/screens/campaign/campaign-overview/` (`index.ts`, `campaign-overview.tsx`, `campaign-overview.module.css`, `view-tab-items.tsx`, `check-count.ts`, `tab-props.ts`; props `projectId`, `campaignId`, `data`, `view`, `onView`, `variants: ReactNode`); `src/renderer/screens/campaign/variants-tab/` (`index.ts`, `variants-tab.tsx`, `variants-tab.module.css`; the overview body moved from `campaign-view.tsx`).
- **May touch:** `campaign-view/campaign-view.tsx` and `campaign-view.module.css` (keeps the page, the stores, the view state; mounts `CampaignHead`, `CampaignOverview`, `VariantsTab`); `check-panel/index.ts` (export `useCheckResults`); one import line each in `check-panel/check-panel.tsx`, `rule-set-panel/rule-set-panel.tsx`, `translation-panel/translation-panel.tsx`; delete `campaign-sections/`. **VideoPanel:** if the editor round's slice that removes the "Make a video" card has merged, there is nothing to carry; if not, `VideoPanel` moves into `variants-tab.tsx` unchanged, after the picture panel, and that slice removes it from there (the orchestrator tells that slice's developer the new file).
- **Tests first:** `tests/unit/renderer/screens/campaign/check-count.test.ts` (a table: no states 0; warn results counted per variant and check; stale rows left out; pass and skipped not counted); `tests/unit/renderer/screens/campaign/campaign-overview.test.tsx` (panels as stand-ins, as `campaign-sections.test.tsx` did: three tabs named "Variants", "Checks", "Translations" in a tab list "Campaign views", icons hidden; Variants shown first; Checks shows check panel then rule set; Translations shows the panel, or the one-language line naming "English" for `['en']`; arrows move between tabs; the badge "3 warning(s)" from a `check.results` reply with three current warnings, none at 0, none while loading or refused, and it follows `project.changed`; Undo and Redo in the same bar; no accessibility violations); `tests/unit/renderer/screens/campaign/campaign-head.test.tsx` (back, name, export, publish as before; no accessibility violations); a case in `campaign-view.test.tsx` that the chosen view is kept after a variant tab is shown and the overview shown again.
- **Approved edits to existing tests:**
  - Delete `tests/unit/renderer/screens/campaign/campaign-sections.test.tsx` (replaced by `campaign-overview.test.tsx`).
  - `tests/unit/renderer/screens/campaign/campaign-view.test.tsx`: where a case reaches the check, rule set or translation panel, click the tab first.
  - Where an end-to-end or shots script reaches the regions "Checks", "Translations" or "Brand and legal rules", it first clicks the tab (`page.getByRole('tab', { name: 'Checks' })` or `'Translations'`), and clicks "Variants" before it goes back to the tiles. Through one new helper `showCampaignView(page, name)` in the new file `tests/e2e/campaign-view-steps.ts`. Files: `tests/e2e/localize-steps.ts`, `tests/e2e/localize.spec.ts`, `tests/e2e/export-warnings.spec.ts`, `tests/shots/p6-10.shots.ts`, `p6-11.shots.ts`, `p6-12.shots.ts`, `p6-13.shots.ts`, `p6-17.shots.ts`, `p6-18.shots.ts`. Nothing else in those lines changes. To find any other: `rg "name: '(Checks|Translations|Brand and legal rules)'" tests/e2e tests/shots tests/approvals-local`; list each in the report.
- **Shots:** `tests/shots/r2c-1.shots.ts`, pictures `340-campaign-variants-tab`, `341-campaign-checks-tab-badge` (after "Run checks" with a prohibited word in a rule set), `342-campaign-translations-tab`, `343-campaign-one-language`.
- **Exit check:** class D. `npm run lint`, `npm run typecheck`, `npx vitest run tests/unit/renderer/screens/campaign`, `npm run build`, `npm run test:e2e -- tests/e2e/localize.spec.ts tests/e2e/export-warnings.spec.ts tests/e2e/workflow-5-4.spec.ts`, then each edited shots file and its own with `npx playwright test --config playwright.shots.config.ts {file}`.
- **Security:** none. **Depends on:** nothing. **Size:** medium.

### R2C-2 — The grid by size and language (item 8)

- **Exists when done:** design addition 2: each direction's tiles as a table with size rows and language columns, the master top left with its "Master" badge and tint, heads for sizes and languages, a row that scrolls sideways and never wraps.
- **New files:** `src/renderer/screens/campaign/variant-grid/grid-axes.ts`; `variant-grid/grid-heads.tsx` (the corner, column heads and row heads); `variant-grid/tile-actions.tsx` and `variant-grid/use-focus-after-delete.ts` (moved out of `variant-grid.tsx` unchanged, to keep it under 200 lines); `src/renderer/ui/language-name.ts`.
- **May touch:** `variant-grid/variant-grid.tsx`, `variant-grid.module.css`; `variant-tile/variant-tile.tsx`, `variant-tile.module.css` (the master badge and tint only).
- **Tests first:** `tests/unit/renderer/screens/campaign/grid-axes.test.ts` (master's size and language first; campaign order after; an unlisted size and an unlisted language after the listed ones; an image and a video of one size and language share a cell, image first; empty cells absent; row sizes from the first variant met); in `variant-grid.test.tsx`, new cases: the list "Variants in {name}" holds one item per occupied cell in reading order; the first button in it is the master's; column heads show "German" and "de"; row heads show "Story" and "1080×1920"; the scroll box has `overflow-x: auto` and the grid's columns are `max-content` then one `var(--thumbnail-tile)` per language; no accessibility violations with three sizes and three languages; in `variant-tile.test.tsx`, the master shows "Master" with a hidden icon, a non-master does not; `tests/unit/renderer/ui/language-name.test.ts` (a known code, an unknown code kept as it is).
- **Approved edits to existing tests:** `tests/unit/renderer/screens/campaign/variant-grid.test.tsx`: a lookup of `li[data-variant]` becomes `[data-variant]`; a count of list items in a fixture where two variants share a size and language counts cells. `tests/unit/renderer/screens/campaign/direction-grids.test.tsx`: the same two kinds, if met. Nothing else; the e2e and shots scripts keep working because the list's name, its reading order and the tile's buttons do not change (check with `npm run test:e2e -- tests/e2e/workflow-5-4.spec.ts`).
- **Shots:** `tests/shots/r2c-2.shots.ts`, pictures `344-grid-three-sizes-three-languages`, `345-grid-scrolled-sideways` (a window narrow enough that the last column is off to the right, then scrolled), `346-grid-image-and-video-in-one-cell`.
- **Exit check:** class D. `npm run lint`, `npm run typecheck`, `npx vitest run tests/unit/renderer/screens/campaign tests/unit/renderer/ui/language-name.test.ts`, `npm run build`, `npm run test:e2e -- tests/e2e/workflow-5-4.spec.ts tests/e2e/format-switch.spec.ts`, the shots file.
- **Security:** none. **Depends on:** nothing (runs beside R2C-1). **Size:** medium.

### R2C-3 — Select, then open (item 11, R-9)

- **Exists when done:** design addition 3: a click selects, a double-click or Enter opens, Mod+Enter opens behind, arrows move the selection, Delete asks to delete; the Variants tab's hint line.
- **New files:** `src/renderer/screens/campaign/variant-grid/grid-moves.ts`; `variant-grid/use-grid-keys.ts`.
- **May touch:** `variant-tile/variant-tile.tsx` (prop `onOpen(variantId)`; `onDoubleClick`; the main button's `onKeyDown` for Enter and Mod+Enter, `preventDefault` so Enter does not also click); `variant-grid/variant-grid.tsx` (props `onOpen`; the list's `onKeyDown` through `use-grid-keys.ts`); `direction-grids/direction-grids.tsx` (props `onOpen`; Cmd-click stays "behind"); `variants-tab/variants-tab.tsx` (`onChoose` selects, `onOpen` opens, the hint line); `campaign-view/campaign-view.tsx` (passes `select = setChosenId` and `open`).
- **Tests first:** `tests/unit/renderer/screens/campaign/grid-moves.test.ts` (a table over a 3×3 grid with gaps and one two-tile cell: each key from each place, edges give null); in `direction-grids.test.tsx`: a click calls `onChoose` and not `onOpen`; a double-click calls `onOpen`; Enter on a focused tile calls `onOpen` once and `onChoose` not at all; Mod+Enter calls `onOpenBehind`; Right then Down move focus and call `onChoose` with the right IDs; Delete on a non-master opens the warning, on the master nothing; in `campaign-view.test.tsx`: a click selects (the "Runs and panels" line names it, `job.list` read for it, no tab opens); a double-click opens the editor in place of the overview and keeps it selected.
- **Approved edits to existing tests:**
  - Where a test or script clicks a tile's main button to **open** the variant, `.click()` becomes `.dblclick()` (Testing Library: `user.dblClick`); nothing else in that line changes. A click that only chooses the variant stays a click.
  - Unit: `tests/unit/renderer/screens/campaign/campaign-view.test.tsx` ("opens a variant in the editor on a plain click" becomes "on a double-click"), `variant-tabs.test.tsx` ("shows the variant tab on a plain click" becomes "on a double-click"; "a second click adds no tab" becomes a second double-click), `variant-tabs-warning.test.tsx`, `reference-pre-tick.test.tsx`, `reference-ticks.test.tsx`, `video-panel.test.tsx`, `tests/unit/renderer/stores/attached-campaign.test.tsx`, wherever they open a variant by a tile click.
  - End-to-end and harness: `tests/e2e/editor-open.spec.ts`, `format-switch.spec.ts`, `offline-export.spec.ts`, `screen-tour.ts` (also its comment "opens in the editor when clicked" becomes "when double-clicked"), `timeline-layers.spec.ts`, `timeline-seed.ts`, `video-variant-steps.ts`, `workflow-5-1-steps.ts`, `variants-steps.ts` (`editLayer`; the comment on `tileButton`), `tests/approvals-local/app-steps.ts`.
  - Shots: `tests/shots/lk-5`, `lk-6`, `lk-7-steps`, `p3-9`, `p3-10`, `p3-11`, `p3-12`, `p3-13`, `p3-14`, `p3-15`, `p3-16`, `p4-13`, `p4-16`, `p4-17`, `p4-18`, `p4-19`, `p5-15`, `p6-14`, `p7-17`, `p7-19`, `p7-22`, `s2-6`, `st-1`, `st-7`, `st-8`, `st-9`, `st-10`, `ap-12` (`.shots.ts`), wherever they open a variant by a tile click.
  - To find any other: `rg "getByRole\('list', \{ name: (/\^)?'?Variants" tests` and `rg "tileButton\(" tests`; list each in the report.
- **Shots:** `tests/shots/r2c-3.shots.ts`, pictures `347-tile-selected-not-open`, `348-selection-moved-by-arrows`, `349-variant-opened-by-double-click`.
- **Exit check:** class D. `npm run lint`, `npm run typecheck`, `npx vitest run tests/unit/renderer`, `npm run build`, `npm run test:e2e` (the whole end-to-end set: the edit reaches most specs), then every edited shots file and its own.
- **Security:** none. **Depends on:** R2C-1, R2C-2. **Size:** medium (many one-word test edits).

### R2C-4 — Translations show their source (item 10)

- **Exists when done:** design addition 4: the note line; each row's source labelled "{English} (source)" in its box beside the labelled translation field; the field's name and description as stated; `languageName` comes from `ui/language-name.ts` only.
- **New files:** none.
- **May touch:** `translation-panel/translation-panel.tsx` (the note; passes `primaryLanguage` to each group), `language-group.tsx` (passes the source language name to each row), `translation-row.tsx`, `translation-words.ts` (`sourceLabel(name)`; `languageName` re-exported from `@/renderer/ui/language-name`, its own body removed), `translation-panel.module.css`.
- **Tests first:** in `tests/unit/renderer/screens/campaign/translation-panel.test.tsx`: the note line shows; a German row shows "English (source)" and the source text, and "German" over the field; the field's name is "German {row line}" and its description is the source text; a row with no source text shows "No source text"; no accessibility violations; in `translation-words.test.ts`: `sourceLabel('English')` is "English (source)".
- **Approved edits to existing tests:** `translation-panel.test.tsx`, where a case finds the text field by its old name (the row line alone), the name now starts with the language name. `translation-words.test.ts`, the import of `languageName` may come from either place. Nothing in `tests/e2e/` or `tests/shots/` (they find the field by role inside its row).
- **Shots:** `tests/shots/r2c-4.shots.ts`, pictures `350-translation-rows-with-source`, `351-translation-narrow-stacked`.
- **Exit check:** class D. `npm run lint`, `npm run typecheck`, `npx vitest run tests/unit/renderer/screens/campaign/translation-panel.test.tsx tests/unit/renderer/screens/campaign/translation-words.test.ts`, `npm run build`, `npm run test:e2e -- tests/e2e/localize.spec.ts`, the shots file.
- **Security:** none. **Depends on:** R2C-1 (the type import line and the tab), R2C-2 (`ui/language-name.ts`). **Size:** small.

### R2C-5 — The Assets panel: open it and see the files (item 14, part 1)

- **Exists when done:** design addition 5 except the subjects group, "New subject…" and the import dialog: the scope, the button on the project page ("Open assets", in the renamed "Assets" section) and in the campaign head ("Assets"); the panel with its head, action row, Pictures, Clips, Fonts and Other files groups, marks, the subject choice on pictures, loading, refused and empty states; Escape and focus return.
- **New files:** `src/renderer/screens/assets/assets-scope/` (`index.ts`, `assets-scope.tsx`); `screens/assets/assets-button/` (`index.ts`, `assets-button.tsx`, `.module.css`; props `projectId`, `label?: string` default "Assets"); `screens/assets/assets-panel/` (`index.ts`, `assets-panel.tsx`, `assets-panel.module.css`, `use-assets.ts`, `asset-groups.ts`, `asset-view.ts`; props `projectId`, `subjects: SubjectRow[]`); `screens/assets/asset-row/` (`index.ts`, `asset-row.tsx`, `asset-row.module.css`).
- **May touch:** `src/renderer/screens/project-home/project-home/project-home.tsx` (wrap the page in `AssetsScope`, mount `AssetsPanel` once for both branches, the "Assets" section) and its CSS module; `src/renderer/screens/campaign/campaign-head/campaign-head.tsx` (one `AssetsButton`).
- **Tests first:** `tests/unit/renderer/screens/assets/asset-groups.test.ts` (kinds to groups; order by name then ID; "Other files" only when non-empty); `asset-view.test.ts` (a row with every field filled gives only the named keys; no `absPath`, `relPath`, `contentHash`, `mime`); `assets-panel.test.tsx` (reads `asset.list { projectId }` on open and again on `project.changed` and `asset.changedOnDisk` for this project only; a late reply dropped; the four groups with counts and empty lines; marks; "File not found" in place of the picture; the subject choice sends `asset.update` with the subject ID and with `null`; a refused read shows the message and "Retry"; no text in the panel matches the planted `absPath` or `relPath`; Escape closes and focus goes back to the opener; no accessibility violations); `assets-button.test.tsx` (`aria-expanded` follows, `aria-controls` names the panel, a second press closes); a case in `tests/unit/renderer/screens/project-home/project-home.test.tsx` that "Open assets" opens the panel and a campaign's "Assets" opens the same panel.
- **Approved edits to existing tests:** `tests/unit/renderer/screens/project-home/project-sections.test.tsx`: the headings become `['Campaigns', 'Start a campaign', 'Assets', 'Package']`. `tests/unit/renderer/screens/campaign/campaign-head.test.tsx` (from R2C-1): the head may hold one more button. Nothing in `tests/e2e/` or `tests/shots/` ("Import files…" stays on the project page).
- **Shots:** `tests/shots/r2c-5.shots.ts`, pictures `352-project-assets-section`, `353-assets-panel-files` (three pictures, one a reference, one generated, a clip, a font), `354-assets-panel-empty`, `355-assets-panel-over-editor`.
- **Exit check:** class D. `npm run lint`, `npm run typecheck`, `npx vitest run tests/unit/renderer/screens/assets tests/unit/renderer/screens/project-home tests/unit/renderer/screens/campaign/campaign-head.test.tsx`, `npm run build`, `npm run test:e2e -- tests/e2e/drop-import.spec.ts tests/e2e/asset-font.spec.ts`, the shots file.
- **Security:** short (no path drawn; the `assetView` picker). **Depends on:** R2C-1 (`campaign-head/`). **Size:** medium.

### R2C-6 — Subjects in the Assets panel (item 14, part 2)

- **Exists when done:** the Subjects group with its cards, "Add photos…", removing a photo from a subject, the attach step, "New subject…" in the panel's action row and the subject dialog in both modes (design addition 5).
- **New files:** `src/renderer/screens/assets/subject-card/` (`index.ts`, `subject-card.tsx`, `subject-card.module.css`, `use-add-photos.ts`); `src/renderer/screens/assets/attach-photos.ts`; `src/renderer/dialogs/subject-dialog/` (`index.ts`, `subject-dialog.tsx`, `subject-dialog.module.css`, `subject-plan.ts`, `picked-photos.tsx`).
- **May touch:** `screens/assets/assets-panel/assets-panel.tsx` (the Subjects group first; "New subject…" in the action row) and `asset-groups.ts` (photos per subject).
- **Tests first:** `tests/unit/renderer/screens/assets/attach-photos.test.ts` (new IDs need nothing; a reused unattached ID is attached; a reused ID of another subject gets a note; a reused ID already of this subject needs nothing); `tests/unit/renderer/dialogs/subject-plan.test.ts` (`newSubjectId` from "Harbour Blend" is `Harbour-Blend`, and `Harbour-Blend-2` when taken; a name of only signs gives `subject`; problems for a blank name and no photo); `subject-dialog.test.tsx` (New: problem lines and focus; Create sends `subject.create` then `asset.import` with the picked paths, `library: 'asset'`, `copy: false` and the new `subjectId`, then `asset.update` for an unattached reused photo; a refused create sends nothing more; a refused import after create shows the "was made, but" line; the picked list shows base names only; a cancelled picker adds nothing; Edit: sends only changed fields, nothing when unchanged; no accessibility violations); `subject-card.test.tsx` (photos of the subject only; remove sends `asset.update { subjectId: null }`; "Add photos…" sends the picker, then `asset.import` with the subject, "Adding photos…", "2 photo(s) added."; the other-subject note; no accessibility violations); in `assets-panel.test.tsx`, new cases for the Subjects group and its empty lines.
- **Approved edits to existing tests:** `tests/unit/renderer/screens/assets/assets-panel.test.tsx` (from R2C-5): the group count grows by Subjects. Nothing else.
- **Shots:** `tests/shots/r2c-6.shots.ts`, pictures `356-assets-subjects`, `357-new-subject-dialog`, `358-new-subject-problems`, `359-new-subject-made`, `363-subject-photo-note`.
- **Exit check:** class D. `npm run lint`, `npm run typecheck`, `npx vitest run tests/unit/renderer/screens/assets tests/unit/renderer/dialogs/subject-plan.test.ts tests/unit/renderer/dialogs/subject-dialog.test.tsx`, `npm run build`, the shots file (it picks photos through `tests/e2e` helpers that answer the open dialog).
- **Security:** short (picker paths to `asset.import` only; base names only drawn). **Depends on:** R2C-5. **Size:** medium.

### R2C-7 — The import dialog: a new subject, and "Show in assets" (item 14, part 3)

- **Exists when done:** design addition 5, "The import dialog".
- **New files:** none.
- **May touch:** `src/renderer/dialogs/import-dialog/import-choices.tsx` (the option and the name field), `import-dialog.tsx` (the create step, the refusal lines, "Show in assets"; keep under 200 lines by moving the send step into a new `import-dialog/send-import.ts`), `import-dialog.module.css`.
- **Tests first:** in `tests/unit/renderer/dialogs/import-dialog.test.tsx`: "New subject…" is offered with no subjects and with some; choosing it shows "Subject name" with focus; blank gives "Enter the subject's name." and sends nothing; a name sends `subject.create` (ID from `newSubjectId`, stepping around existing IDs) then `asset.import` with that `subjectId`; a refused create imports nothing; a refused import after create shows its line; "Show in assets" shows inside a scope with the panel closed, not outside a scope or with it open, and opens the panel and closes the dialog; no accessibility violations.
- **Approved edits to existing tests:** `tests/unit/renderer/dialogs/import-dialog.test.tsx`, a case that lists the subject options exactly gains the last option "New subject…". `tests/unit/renderer/screens/project-home/drop-import.test.tsx`, the same if met. Nothing else.
- **Shots:** `tests/shots/r2c-7.shots.ts`, pictures `364-import-new-subject`, `365-import-done-show-in-assets`.
- **Exit check:** class D. `npm run lint`, `npm run typecheck`, `npx vitest run tests/unit/renderer/dialogs/import-dialog.test.tsx tests/unit/renderer/screens/project-home`, `npm run build`, `npm run test:e2e -- tests/e2e/drop-import.spec.ts`, then `tests/shots/s2-9.shots.ts`, `s2-17.shots.ts`, `st-4.shots.ts` and its own.
- **Security:** short. **Depends on:** R2C-5 (the scope), R2C-6 (`newSubjectId`). **Size:** small.

## Wave table

At most two developers at once. Slices in one wave own disjoint files.

| Wave | Slices side by side | Why this order |
|------|---------------------|----------------|
| 1 | R2C-1 ‖ R2C-2 | R2C-1 owns `campaign-view`, the new overview, head and Variants tab, and the e2e tab-click edits; R2C-2 owns `variant-grid/`, `variant-tile/` and `ui/language-name.ts`. No file in common. |
| 2 | R2C-3 ‖ R2C-5 | R2C-3 needs both of wave 1 (it edits `variants-tab`, `campaign-view`, the grid and tile). R2C-5 needs `campaign-head/` from R2C-1 and touches neither. |
| 3 | R2C-4 ‖ R2C-6 | R2C-4 needs the tab (R2C-1) and `ui/language-name.ts` (R2C-2). R2C-6 needs the panel (R2C-5). |
| 4 | R2C-7 | Needs the scope (R2C-5) and `newSubjectId` (R2C-6). Then the orchestrator runs the full check of `DEV-RULES.md` once. |

The editor round's slice that removes "Make a video" should merge either before R2C-1 starts or after R2C-1 merges, never at the same time (both edit the overview).

## Assumptions

| ID | Assumption |
|----|------------|
| A-302 | The Checks badge counts warned check results (one per variant and check) on current checks only; checks have no error level, so "warnings/errors" is warnings. No badge at 0, while loading or on a refusal. |
| A-303 | The three tabs sit inside the campaign's Overview tab. The tab shown is kept while the campaign page is open and starts at Variants when the campaign is opened again. |
| A-304 | The Translations tab is always offered; a one-language campaign shows a line saying there is nothing to translate. |
| A-305 | The rule set moves into the Checks tab, under the check results. |
| A-306 | The slot view, picture panel and run list stay on the Variants tab, acting on the selected variant, until the editor's Generate panel replaces them. |
| A-307 | Grid rows are size labels and columns are languages, in the order first met in the direction order, so the master's size and language come first and unlisted ones come last. |
| A-308 | An image and a video variant of the same size and language share one cell, stacked, image first. |
| A-309 | An empty cell (no variant for that size and language) draws nothing. |
| A-310 | Each direction scrolls sideways on its own, its rows staying aligned; the size heads stay at the left edge while scrolling. |
| A-311 | The master is marked by a "Master" badge and a tinted tile; the size line keeps " · master". |
| A-312 | Keys on a tile: arrows move focus and selection, Enter opens, Mod+Enter opens behind, Space selects, Delete or Backspace asks to delete (not the master). The Tab order is unchanged. |
| A-313 | Opening a variant by any route also selects it; the selection belongs to the campaign page; a deleted selection falls back to the first variant. |
| A-314 | The source column is labelled with the campaign's primary language and shows the direction master's text, so the master is taken to be in the primary language. |
| A-315 | "Assets" is a panel along the left edge over the page, opened from the project page and the campaign head (so also from the editor), not a top-bar tab; this leaves the top bar to the other round-2 work on its "+" button and windows. |
| A-316 | The panel lists both libraries; reference files carry "Reference only"; the panel does not move files between libraries. |
| A-317 | A new subject needs a name and at least one photo (D-098); its ID is made from its name; its photos are linked, not copied, into the asset library, as the brief form's "Add photos" does; if the photos fail after the subject is made, the subject stays. |
| A-318 | A picked photo already in the project with no subject is attached to the subject; one that is another subject's photo is left there, with a note. |
| A-319 | No subject delete, asset remove, rename or library change in the panel this round. |

## Open questions

1. **Does the campaign page keep its picture panel and run list once the editor has its Generate panel (R-13)?** Recommendation: no; once the editor's panel is built, the Variants tab keeps only the grids and the selection line, and "where did my run go" (item 3) is answered in the editor. Planned: they stay (A-306) so neither round-2 file waits on the other; removing them later is one edit to `variants-tab.tsx`.
2. **Must a new subject have a photo?** Recommendation: yes, as the brief form already requires (D-098: a subject is defined first by its photos). Planned that way (A-317); dropping the rule is one line in `subject-plan.ts`.
3. **Should the Assets panel also remove files, rename them, move them between libraries and delete subjects?** Recommendation: not this round; the commands exist (`asset.remove`, `asset.update`, `subject.delete`) and each can be added to a row later without design changes elsewhere. Planned without them (A-319).

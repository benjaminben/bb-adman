# Design wave, Wave 2: project home, Assets, campaign page, dialogs, clean-up

The slice sections for HOME, AST, CAMP-1 to CAMP-6, DLG and Z-1 of `design-wave.md`, "Wave 2". Read `design-wave.md` first (choices C-1 to C-18, AP-1 to AP-16, "Rules for every slice of the wave", the open items taken for now), then `spec/app-style-parts.md`. CAMP-7 is written in `design-wave.md` and is not repeated here. Settings, editor, shell and start are in `design-wave-screens-a.md`.

## Rules for these slices

- **Names that tests use stay where they can.** Where the words on screen get shorter and the old words still describe the control, the control keeps its old words as its accessible name (`aria-label`) and `title`, as long as the visible words are contained in them (for example visible "Sync 2", name "Sync 2 out of date…"). Each slice says where it does this. Where a name truly changes, the slice lists every test that uses it.
- **Real plurals.** Each slice that owns a file printing "(s)" switches it to `plural()` from `ui/plural.ts` (DLG-1). A test that pins the "(s)" words changes only to the plural words.
- **Earlier slices' shots files are not edited** (`DEV-RULES.md`). Many of them walk by names these slices change; they are not a check. A slice notes in its report the earlier shots files it saw stop; it does not fix them. Only the e2e helpers named below are edited.
- **All campaign slices run after CAMP-7 has merged** (CAMP-7 changes `variants-tab/`, `campaign-view/` and the tests of the campaign folder). Paths below are as CAMP-7 leaves them (`ui/paid-confirm/`, `ui/run-status/`).
- **Security class.** "short": a reviewer reads the diff of the named lines against this file. "full": a reviewer also runs the slice's tests and checks each security line on screen in its shots.
- Every slice's report gives the words on screen before and after for each screen it changed (`design-wave.md`, "Words on screen go down").

## Rulings from the orchestrator

- **Leaving the New campaign page (HOME-2).** Back and Escape ask first when the form holds typed text or added photos: a `confirm` dialog, "Leave this brief?", with the line "What you typed will be lost.", buttons "Keep editing" (focused first) and "Leave". With an empty form they leave at once. "Cancel" in the form's foot keeps today's behaviour.
- **"Load a brief" and "Paste a brief"** keep their words.
- **The one tab strip** on the campaign page is named "Campaign".
- **The wordings marked "(architect's wording)"** in this file stand.
- **Tile marks on the project home (HOME-1):** if the campaign summary does not carry a running or new-result fact today, those two marks are left out and the developer says so. No new data is stored in this wave.
- **Earlier shots files** that stop working are listed in each slice's report; one clean-up at the end of the wave repairs or retires them.

## Order and side by side

Corrections to the headline table, from the files as they are:

- HOME-1 also owns `brief-load/brief-load.tsx` (button words and one new prop); HOME-2 follows it. `import-files/` is HOME-1's; AST-1 uses it as HOME-1 leaves it and does not edit it, so AST-1 may run beside HOME-1.
- HOME-3 is split: HOME-3a (fields, sizes, languages, rules, foot) then HOME-3b (subjects and photos). Both after AST-2.
- CAMP order: CAMP-7, then CAMP-1, then CAMP-2, then CAMP-3. CAMP-3 also waits for CAMP-6 (it opens Reports through CAMP-6's hook) and DLG-4a (the paid count). CAMP-4 and CAMP-6 may run beside CAMP-1 or CAMP-2. CAMP-5 waits for DLG-4a (both edit `translate-again*.test.tsx`).
- CAMP-2 edits `dialogs/sync-review/sync-button.tsx` and `tests/unit/renderer/dialogs/sync-review/sync-review.test.tsx`: **CAMP-2 and DLG-7 never run side by side.** CAMP-2 also owns `dialogs/direction-menu/` (DLG-2 does not touch it).
- DLG-3, DLG-4 and DLG-6 are split into a and b parts. DLG-4a before DLG-4b (fan-out uses DLG-4a's cost words). DLG-3a, DLG-3b, DLG-4a, DLG-5, DLG-6a, DLG-6b, DLG-7 may run side by side after DLG-1, except as said above. DLG-4a and DLG-7 wait for CAMP-7.
- Z-1 is last.

| Slice | After | Not beside |
|---|---|---|
| HOME-1 | T3a, T3b, T3c, SH-3 | HOME-2, HOME-3a/b |
| HOME-2 | HOME-1, T3e | HOME-3a/b |
| HOME-3a | HOME-2, T3d, AST-2 | HOME-3b |
| HOME-3b | HOME-3a | |
| AST-1 | T3a, T3b, T3c, T3e | |
| AST-2 | T3c, T3f | |
| CAMP-1 | CAMP-7, T3b, T3f | CAMP-2, CAMP-3 |
| CAMP-2 | CAMP-1, T3c, DLG-1 | CAMP-3, DLG-7 |
| CAMP-3 | CAMP-2, CAMP-6, DLG-4a, SH-1 | |
| CAMP-4 | CAMP-7, T3a, T3b, T3d | |
| CAMP-5 | CAMP-7, DLG-4a, T3b, T3f | |
| CAMP-6 | CAMP-7, T3c | CAMP-3 |
| DLG-1 | T4 | |
| DLG-2 | DLG-1 | |
| DLG-3a, DLG-3b | DLG-1 | |
| DLG-4a | DLG-1, CAMP-7 | DLG-4b, CAMP-5 |
| DLG-4b | DLG-4a | |
| DLG-5 | DLG-1, T3f | |
| DLG-6a, DLG-6b | DLG-1, T3c | |
| DLG-7 | DLG-1, T3c, CAMP-7 | CAMP-2 |
| Z-1 | every other slice | everything |

DLG-3a and DLG-3b touch different test files and may run side by side; so may DLG-6a and DLG-6b.

## Shots numbers

HOME-1 450, 451 · HOME-2 452 · HOME-3a 453, 454 · HOME-3b 455 · AST-1 456, 457 · AST-2 458 · CAMP-1 459, 460 · CAMP-2 461, 462 · CAMP-3 463, 464 · CAMP-4 465, 466 · CAMP-5 467 · CAMP-6 468 · DLG-2 469, 470, 471 · DLG-3a 472, 473 · DLG-3b 474, 475, 476 · DLG-4a 477, 478 · DLG-4b 479, 480 · DLG-5 481, 482, 483 · DLG-6a 484, 485 · DLG-6b 486, 487, 488 · DLG-7 489, 490, 491 · 492 to 499 spare. DLG-1 and Z-1 change nothing a user sees and have no shots file.

---

## HOME-1 — Project home

- **Kind:** markup and wording. Existing markup changes. Fixes AP-1, AP-2, AP-3, AP-9, AP-10, AP-15.
- **Exists when done:**
  - The page is the title, then two Sections, no cards. The `h1` is the project name; its `title` is the project file path and the path is its accessible description (a visually hidden span referenced by `aria-describedby`). The printed path line goes. The page's "Close project" button goes (the project menu has "Close {name}" from SH-3).
  - The Package Section goes. "Package…" is in the project menu (SH-3). `package-project/` is not deleted (SH-3 mounts it from the menu).
  - **Campaigns** Section (`id` `'home.campaigns'`, `level` 2, `fold` `'none'`, `summary` the count as plain text). The Section part puts its title in the header; the title stays "Campaigns", so the region and heading keep that name. Its header holds "Load a brief" (`.primary`, `file` icon) and "Paste a brief" (secondary, `text` icon), drawn by `BriefLoad`.
  - The list `ul` "Campaigns" of tiles. Each tile is one `button` (`.card` look, no shadow): the cover, the name, and a meta line `grid` icon + variant count (`title` "{n} variants"). The button's accessible name stays "Open {name}"; a click or Enter opens the campaign's tab. The tile shows the same marks as the campaign's tab, using `TabMarks` with `running: c.jobRunning, unseen: c.resultUnseen` when the summary carries them; if `CampaignSummary` lacks these fields, the marks are left out (no new data, OI-DW-2) and the report says so. The "Open" button and "Variants: {n}" go.
  - Last in the list, a dashed "+" tile, `aria-label` and `title` "New campaign", which asks for a new campaign exactly as the top bar's "+" does (`useNewCampaignAsk().ask(projectId)`).
  - No campaigns: `EmptyState` `icon` `grid`, `words` "No campaigns yet", no action of its own (the header's buttons are beside it).
  - **Assets** header row. Not the `Section` part: a Section is a region named by its title, and the Assets panel is already the region "Assets" (R2C-5). So it is a `div` with an `h2` "Assets", drawn in `project-home.module.css` to match the Section look (`--section-header-height`, hairline under it, title in `--type-section-size`). Header: the title, `<InfoTip about="Assets">` holding "The pictures, clips, fonts and subjects of this project.", then the missing mark, then `ImportFiles`, then a `.iconButton` with the `right` icon whose `aria-label` and `title` are "Open assets" (it is `AssetsButton` with a new optional `icon` look; `aria-expanded` as built). No body.
  - **Missing files** become a clickable `StatusMark`: `tone` `warn`, `icon` `alert`, `label` "{n} missing", `tip` "{n} missing: Find missing files…". A click opens the relink dialog as today. The notice strip and its sentence go.
  - **ImportFiles** (shared with the Assets panel): a button with the `upload` icon and the visible word "Import", `aria-label` and `title` "Import files…"; then a `.iconButton` with the `folder` icon, `aria-label` and `title` "Import a folder…". Behaviour unchanged.
  - **BriefLoad** gets one new prop, `home: (actions: ReactNode) => ReactNode`. With no form open it returns `home(actions)`, where `actions` are its two buttons, the paste dialog, the text-brief dialogs and the busy status; `project-home.tsx` passes a function that draws the two Sections with `actions` in the Campaigns header. With a form open it returns the form in place of the Sections (HOME-2 frames it). `BriefLoad` therefore stays mounted while the page shows, so Cancel and unmount still remove added photos. "Adding the brief's photos…" becomes a `BusySpinner` inside "Load a brief" with the same words as its hidden `role="status"` text.
- **Words:** "Campaigns", "Load a brief", "Paste a brief", "No campaigns yet", "New campaign" (tooltip), "{n} variants" (tooltip), "Assets", "About Assets", "Import", "Import files…" (name), "Import a folder…" (name), "{n} missing", "Open assets" (name). The drop layer's words are unchanged.
- **Owns:** `screens/project-home/project-home/`, `campaign-list/`, `missing-files/`, `import-files/`, `drop-import/` (no change expected), `brief-load/brief-load.tsx` and `brief-load.module.css`; `screens/assets/assets-button/` (the icon look only).
- **New files:** `tests/unit/renderer/screens/project-home/home-sections.test.tsx`, `tests/shots/dw-home-1.shots.ts`.
- **Tests first** (`home-sections.test.tsx`): two Section headings, "Campaigns" and "Assets", level 2, and no other `h2`; no `.card` around them; the path is not text on the page but is the title's `title` and accessible description; no "Close project" and no "Package project…" on the page; each campaign is one button named "Open {name}" holding the cover image; the "+" tile is a button "New campaign" and a click asks for a new campaign (the brief form opens, as `campaign-tabs-new.test.tsx` shows for the top bar); with no campaign the words "No campaigns yet" show; with missing files a button whose name starts "3 missing" opens the dialog "Find missing files"; "Import files…", "Import a folder…" and "Open assets" are buttons reachable by Tab in that order; axe clean with and without campaigns.
- **Approved edits to existing tests:**
  - `project-home.test.tsx`: "No campaign yet." becomes "No campaigns yet" (lines 24, 37, 47, 60, 70, 78); the case "keeps the heading, the Close project button and the file path" becomes "keeps the heading, with the file path as its description" (no Close button, `toHaveAccessibleDescription('/w/Summer.adman')`); `findByRole('heading', { name: 'Assets', level: 2 })` stays; `within(section)` finds "Import files…" as before.
  - `project-sections.test.tsx`: "No campaign yet." as above; the heading "Start a campaign" is gone: the case checks that "Load a brief" is inside the Campaigns Section; `region { name: 'Brief' }` stays until HOME-2.
  - `project-home-close.test.tsx`: delete the file (closing is in the project menu, tested by SH-3's `project-switcher-close.test.tsx`).
  - `campaign-list.test.tsx`: "Variants: 2" becomes the meta line's `title` "2 variants". `campaign-list-cover.test.tsx`: rows are the buttons inside list items; unchanged otherwise.
  - `missing-files.test.tsx`: the sentence becomes the mark: `getByRole('button', { name: /^3 missing/ })`; the button "Find missing files…" lookups use that name.
  - `import-files.test.tsx`, `assets-panel.test.tsx` lines 140 to 141: unchanged (names kept).
  - `assets-button.test.tsx` line 30: "Open assets" stays the name; unchanged.
  - `tests/e2e/phase1.spec.ts` line 38: drop 'Close project' from the list of words on the page.
- **Words on screen:** project home with two campaigns 41 before; target 12 (the two brief buttons keep "a").
- **Shots:** `dw-home-1.shots.ts`: 450 project home with two campaigns and 3 missing files; 451 empty project.
- **Exit check:** lint, typecheck, `npx vitest run tests/unit/renderer/screens/project-home tests/unit/renderer/screens/assets tests/unit/renderer/app`, build, `npx playwright test tests/e2e/phase1.spec.ts tests/e2e/drop-import.spec.ts`, the shots.
- **Security:** short. The path shows only in the title's tooltip and description (`spec/security.md`, "Paths in the renderer"); the missing-files failure stays on the page as the mark.

## HOME-2 — New campaign page

- **Kind:** markup. Existing markup changes (the form's frame only). Fixes AP-11 and C-13.
- **Exists when done:** while a form is open, `BriefLoad` draws a `SubPage` in place of the home Sections: `title` "New campaign", `onBack` = today's Cancel (photos the form added are removed, the form closes, the home returns and focus goes to "Load a brief"). Escape and Back do the same (no question; today's Cancel asks none either). The page's body scrolls; a foot fixed to the bottom of the page holds "Cancel" (`.quiet`) and "Create campaign" (`.primary`), the busy spinner inside "Create campaign" while creating with "Creating the campaign…" as its hidden `role="status"`. The form's own `h3` "Brief" goes; the `section` is labelled by the SubPage title, so the region is "New campaign". The drop target and the Assets panel stay mounted. The top bar's "+" with a form open still puts focus in the first field.
- **Words:** "New campaign", "Back", "Cancel", "Create campaign".
- **Owns:** `screens/project-home/brief-load/`, `screens/project-home/brief-form/brief-form.tsx` and `brief-form.module.css` (frame and foot only), `project-home/project-home.module.css` (page height for the fixed foot).
- **New files:** `tests/unit/renderer/screens/project-home/new-campaign-page.test.tsx`, `tests/shots/dw-home-2.shots.ts`.
- **Tests first:** "Load a brief" with a parsed brief shows a region "New campaign" with a heading "New campaign", and the first field has focus as today (the form's own focus wins over the SubPage's title focus); the Campaigns and Assets headings are gone while it shows; "Back" and Escape close it, remove the added photos (`asset.remove` sent as `brief-load-cleanup.test.tsx` checks) and show the home with focus on "Load a brief"; "Create campaign" sits in the foot and is the last tab stop; axe clean.
- **Approved edits:** every `region { name: 'Brief' }` lookup becomes `region { name: 'New campaign' }`: `project-sections.test.tsx`, `brief-load*.test.tsx`, `brief-form*.test.tsx`, `brief-type.test.tsx`, `brief-paste.test.tsx`, `brief-subject-ids.test.tsx`, `subject-photos*.test.tsx`, `brief-form-fixture.tsx`, `brief-load-photos-fixture.tsx`; `heading { name: 'Brief' }` likewise. `tests/e2e/screens.ts` (line 42 to 47 helper), `variants-steps.ts`, `workflow-5-1-steps.ts`, `export.spec.ts`: the form locator `region 'Brief'` becomes `region 'New campaign'`; what each checks is unchanged.
- **Shots:** 452 the New campaign page from a loaded brief, scrolled to the foot.
- **Exit check:** lint, typecheck, `npx vitest run tests/unit/renderer/screens/project-home tests/unit/renderer/app`, build, `npx playwright test tests/e2e/export.spec.ts tests/e2e/workflow-5-1.spec.ts tests/e2e/workflow-5-3.spec.ts`, the shots.
- **Security:** short. Back and Escape remove the form's added photos exactly as Cancel does; nothing else is deleted.

## HOME-3a — Brief form: fields, sizes, languages, rules, problems

- **Kind:** markup and wording. Fixes AP-1, AP-4, AP-5, AP-6, AP-8, AP-16.
- **Exists when done:**
  - **Campaign fields:** inline Fields with visible labels "Name", "Region", "Audience", "Message" (stacked, reading face), then one row of three small inline fields "Offer", "Call to action", "Tone", each with the placeholder "Optional". Each input keeps its old accessible name in `aria-label` ("Campaign name", "Offer (optional)", "Call to action (optional)", "Tone (optional)"). Region still fills Languages on leaving it.
  - **Sizes:** one toggle chip (`button`, `aria-pressed`) per ready-made size, drawing a small filled rectangle in the size's ratio and its label ("1x1"; the stored label is shown as is). `aria-label` is today's `sizeText` ("1x1 (1080×1080)"), `title` the pixels. A chosen chip carries a ★ button (`aria-label` "Master: {label}", `aria-pressed` on the master); a click on the ★ of a chosen chip makes it the master. The first chosen size is the master by default (`masterOf`, unchanged). The "Master size" select goes. "Other sizes" stays a text field after the chips, visible label "Other", `aria-label` "Other sizes", placeholder "4:5, 1200x628", its hint in an `InfoTip` about "Other sizes" ("Ratios or pixel sizes, separated by commas, for example 4:5 or 1200x628."). Typed sizes are master candidates and show as chips with ★ too (no ✕: they are removed by editing the field). A Section `'brief.sizes'`, `fold` `'none'`, title "Sizes".
  - **Languages:** the text field stays (placeholder "en, fr-CA"), visible label "Languages"; under it the parsed languages as chips, the first with ★ (`title` "Main language"); a language the brief gave copy for carries the `pencil` icon (`title` "Copy given"). The hint goes into an `InfoTip` about "Languages" with today's hint words. "Copy given for: …" goes (its fact is the pencil marks).
  - **Rules:** a Section `'brief.rules'`, `fold` `'closed'`, title "Rules", summary "{n} required · {m} prohibited" or "From {campaign}" (architect's wording). Open: today's radio pair becomes a Segmented "Word lists" | "Copy from"; "Copy from" disabled with `title` "No other campaign yet" when there is none (the sentence goes). Word lists: a Segmented of the languages when there are two or more, then two text areas side by side, visible "Required" and "Prohibited", placeholder "One per line", each keeping its old accessible name. The closing sentence goes into an `InfoTip` about "Rules".
  - **Problems** (OI-DW-2: one list, no field keys): the list stays at the end of the body, directly above the foot, words and order unchanged, with the heading "To fix" (architect's wording; was "Before the campaign can be made"). In the foot, left of Cancel, a clickable `StatusMark` `warn`, `alert`, `label` "{n} to fix", `tip` "{n} to fix: go to the list"; a click scrolls to the list and focuses its heading. "Create campaign" stays disabled while there are problems, with `title` "Fix the {n} problems first".
  - "This brief added {n} photo(s). Check them…" moves to HOME-3b.
- **Words:** "Name", "Region", "Audience", "Message", "Offer", "Call to action", "Tone", "Optional", "Sizes", "Other", "Languages", "Rules", "Word lists", "Copy from", "Required", "Prohibited", "One per line", "To fix", "{n} to fix".
- **Owns:** `brief-form/campaign-fields.tsx`, `brief-form/language-field.tsx`, `brief-form/brief-form.tsx` (problems and foot), `brief-form.module.css`, `size-fields/`, `rule-fields/`. `brief-form-sizes.ts`, `brief-form-model.ts` and `brief-form-problems.ts` do not change.
- **New files:** `tests/unit/renderer/screens/project-home/size-chips.test.tsx`, `brief-form-design.test.tsx`; `tests/shots/dw-home-3a.shots.ts`.
- **Tests first:** size chips are toggle buttons with their old names; pressing ★ on a chosen chip sends that size as `master` in the plan; no select named "Master size"; a typed "4:5" adds a chip; the languages show a ★ on the first; the Rules Section starts closed with its summary and opens on click; "Copy from" disabled with its reason when there is no campaign; the problems list keeps every line of `brief-form-problems.ts` word for word; the "{n} to fix" mark moves focus to the list; axe clean.
- **Approved edits:** `size-fields.test.tsx`: checkboxes become toggle buttons with the same names (`getByRole('button', { name: '1x1 (1080×1080)', pressed })`); the "Master size" select cases become ★ cases. `rule-fields.test.tsx`, `brief-form-rulings.test.tsx`: radios "Use word lists"/"Copy …" (as named today) become the Segmented's two choices named "Word lists" and "Copy from"; the no-campaign sentence case asserts the disabled reason instead; with two languages only one pair of text areas shows at a time. `brief-form.test.tsx`, `brief-form-languages.test.tsx`: "Before the campaign can be made" becomes "To fix"; "Copy given for: …" becomes the chips' `title` "Copy given". Field lookups by label stay (names kept). `tests/e2e/variants-steps.ts` lines 11 to 23: ticking "16x9 (1920×1080)" becomes pressing the chip of that name.
- **Words on screen:** brief form (one subject, two languages) 212 before; HOME-3a and 3b together reach the target 41.
- **Shots:** 453 the form top to sizes; 454 Rules open with two languages.
- **Exit check:** lint, typecheck, `npx vitest run tests/unit/renderer/screens/project-home`, build, `npx playwright test tests/e2e/workflow-5-3.spec.ts tests/e2e/localize.spec.ts`, the shots.
- **Security:** none.

## HOME-3b — Brief form: subjects and photos

- **Kind:** markup and wording. Fixes AP-1, AP-5, AP-8, AP-15.
- **Exists when done:** the Subjects Section (`'brief.subjects'`, `fold` `'none'`, title "Subjects", summary the count, an "Add subject" button in the header with the `plus` icon and visible "Add", name "Add subject"). Each subject is a block without a box or legend: a header row with "Name" and "Description" (placeholder "Description"; old name "Description (optional)" kept as `aria-label`), a Segmented "New" | "From project" for today's two radios (names "New subject" and "Use a subject this project has" kept as `aria-label`; "From project" disabled with `title` "This project has no subjects yet" when there are none), then the "ID" field or the "Project subject" select, and a ✕ `.iconButton` named "Remove subject {n}" (disabled with `title` "A campaign needs one subject" when it is the only one). Under the header, the shared `PhotoStrip` (AST-2) with this row's photos: each photo's ✕ named "Remove {file name}" as `photo-tile.tsx` names it today; the dashed "+" tile named "Add photos to subject {n}", running spinner while adding; with no photo, the "+" tile alone. The photos hint goes into an `InfoTip` about "Photos" on the Section header, word for word. Photo notes stay on the page under the strip as a warn list (failures). "This brief added {n} photos. Check them before you create the campaign." stays as one line above the Subjects (it asks the user to look before photos are used), with a real plural. **Place first photo:** a `Switch` row, label "Place first photo", old name kept as `aria-label`, the 40-word paragraph in an `InfoTip` about "Place first photo".
- **Words:** "Subjects", "Add", "Name", "Description", "New", "From project", "ID", "Project subject", "Place first photo".
- **Owns:** `subject-rows/`, `subject-photos/` (`subject-photos.tsx`, `photo-tile.tsx`, `place-photo-field.tsx`, CSS), `brief-form/brief-form.tsx` (the brief-photos line only).
- **New files:** `tests/unit/renderer/screens/project-home/subject-strip.test.tsx`; `tests/shots/dw-home-3b.shots.ts`.
- **Tests first:** the photos of a row are a `PhotoStrip` list named "Photos of subject {n}"; ✕ removes the photo and sends `asset.remove` only for a form-added one (as today); focus after a remove follows today's rule; the "+" tile opens the picker; the Switch "Place first photo" sets `placeSubjectPhoto`; no `fieldset` legend "Subject 1"; axe clean.
- **Approved edits:** `subject-photos.test.tsx`, `subject-photos-remove.test.tsx`, `subject-photos-fixture.tsx`: "No photos yet." is gone (assert the list is empty and the "+" tile shows); "Add photos" button becomes the "+" tile with the same name; "Remove" buttons keep their names; the hint paragraph is read from the InfoTip. `brief-subject-ids.test.tsx`, `brief-form.test.tsx`: radios become the Segmented's buttons with the same names; "Subject ID" label lookups become "ID" only where they use the visible label (keep `aria-label` "Subject ID"). `brief-load-photos.test.tsx`: "photo(s)" becomes the plural. `place-photo` checkbox lookups become `getByRole('switch', …)` with the same name.
- **Shots:** 455 two subjects, one with photos and a note.
- **Exit check:** lint, typecheck, `npx vitest run tests/unit/renderer/screens/project-home`, build, `npx playwright test tests/e2e/workflow-5-1.spec.ts`, the shots.
- **Security:** short. Removing a photo removes only a photo the form added (as built); photo notes (failures) stay on the page.

## AST-1 — Assets panel

- **Kind:** markup and wording. Fixes AP-1, AP-2, AP-4, AP-5, AP-11, AP-15.
- **Exists when done:** the panel root carries `data-density="compact"`. `PanelHead` `title` "Assets", `icon` `box`, `onClose` hides it, `closeLabel` "Close assets". An action row: `ImportFiles` (as HOME-1 draws it) and a button `plus` icon, visible "Subject", name "New subject…". The Subjects group first, then Pictures, Clips, Fonts, Other files, each a `Section` (`id` `'assets.{key}'`, `level` 3, `fold` `'open'`, `summary` the count). Pictures are a grid of thumbnails (`--thumbnail-tile`), name under each (ellipsis), `title` "{name} · {w}×{h}". Clips, fonts and other files are `ObjectRow`s: `thumb` the kind icon, `name` the file name, `meta` today's detail line ("1080×1920 · 1:05", "Family: …"), `marks` below. Marks are icon `StatusMark`s without labels: `sparkle` `info` "Made with AI", `link` `none` "Linked", `book` `none` "Reference only", `alert` `warn` "File not found" (and a missing picture's tile shows the `image` icon faded with `title` "File not found"). A picture's subject stays a `select` (no visible "Subject" word), name "Subject of {name}", drawn small under its thumbnail. Empty group: "No pictures yet." and the like stay as one muted line; the Subjects explanation goes into an `InfoTip` about "Subjects" in its header. Loading line and refusal with "Retry" unchanged.
- **Words:** "Assets", "Close assets" (name), "Import", "Subject", "Subjects", "Pictures", "Clips", "Fonts", "Other files", the empty lines as built.
- **Owns:** `screens/assets/assets-panel/`, `asset-row/`, `assets-scope/` (no change expected). Not `assets-button/` (HOME-1) and not `subject-card/` (AST-2).
- **New files:** `tests/unit/renderer/screens/assets/assets-panel-design.test.tsx`; `tests/shots/dw-ast-1.shots.ts`.
- **Tests first:** the head is a heading "Assets" level 2 with the button "Close assets"; groups are regions named "Pictures", "Clips"… with the count as summary; pictures render as a grid of images named by file; a made-with-AI clip row has a mark whose text is "Made with AI"; the root has `data-density="compact"`; axe clean.
- **Approved edits:** `assets-panel.test.tsx`: group regions `/^Clips · 1$/` become `/^Clips/` (and the like, including `'Subjects · 0'` to `/^Subjects/`); the Subjects explanation is read from the InfoTip; "New subject…" stays the name; "File not found" is found by its mark's hidden text; everything else unchanged.
- **Shots:** 456 panel with subjects and pictures; 457 Clips and Fonts open.
- **Exit check:** lint, typecheck, `npx vitest run tests/unit/renderer/screens/assets tests/unit/renderer/screens/project-home`, build, the shots.
- **Security:** none (no path reaches the panel, as built).

## AST-2 — Subject cards and the photo strip

- **Kind:** new shared part and markup. Fixes AP-2, AP-5, AP-8.
- **Exists when done:**
  - **`ui/photo-strip/`** (`photo-strip.tsx`, `.module.css`, `index.ts`). Props: `label: string` (the list's name), `photos: { id, name, src: string | null, removable: boolean, removeLabel: string, marks?: ReactNode }[]`, `onRemove(id)`, `onAdd()`, `addLabel: string`, `adding: boolean`, `needsOne?: boolean`, `removeRef?(id, el)`. A `ul` named `label` of tiles at `--thumbnail-tile` (image `alt` = name, `title` = name; `src` null draws the `image` icon faded with `title` "File not found"); ✕ `.iconButton` always shown on removable tiles; last, a dashed "+" tile (`button`, `aria-label` and `title` `addLabel`), a spinner inside while `adding` (disabled); with `needsOne` and no photo the "+" tile has a warn edge (`--color-warn`).
  - **Subject card:** a header row: the name (`h4`), a `pencil` `.iconButton` named "Edit {name}" (was "Edit…"); the description muted under it; the strip with `needsOne`, `addLabel` "Add photos to {name}", remove labels "Remove {file} from {name}". "No photos yet. Add at least one." goes. "Adding photos…" becomes the tile spinner with the same words as hidden `role="status"`. The result lines after adding stay as a `role="status"` line, real plurals ("1 photo added."). A refusal stays a warn alert.
- **Words:** "Edit {name}" (name), "Add photos to {name}" (name), "File not found" (tooltip).
- **Owns:** `screens/assets/subject-card/`, new `ui/photo-strip/`.
- **New files:** `ui/photo-strip/*`; `tests/unit/renderer/ui/photo-strip.test.tsx`; `tests/shots/dw-ast-2.shots.ts`.
- **Tests first:** photo strip: tiles in order, images named by file, ✕ only on removable tiles and calling `onRemove`, the "+" tile calling `onAdd` and disabled with a status while adding, the warn class with `needsOne` and no photo, axe clean. Subject card: "Edit {name}" opens the dialog; no text "No photos yet".
- **Approved edits:** `subject-card.test.tsx`: "No photos yet. Add at least one." becomes the empty strip with the "+" tile (line 72); "File not found" is the tile's `title`; "1 photo(s) added." becomes "1 photo added."; `assets-panel.test.tsx` line 230 likewise (AST-1 may run beside: only line 230 is AST-2's; if AST-1 is merged first, AST-2 rebases onto it).
- **Shots:** 458 two subject cards, one without photos.
- **Exit check:** lint, typecheck, `npx vitest run tests/unit/renderer/ui tests/unit/renderer/screens/assets`, build, the shots.
- **Security:** none (removing detaches only, as built).

## CAMP-1 — One mark set on tiles

- **Kind:** markup and wording. Fixes AP-2, AP-3, AP-12, AP-14, C-11.
- **Exists when done:**
  - The tile is the picture (`--radius-md`, no edge, no ground, hover `--shadow-1`); selected keeps the accent edge. The main button keeps `aria-pressed`, click, double-click, Enter and Mod+Enter as built. Its accessible name and `title` are "{title} · {sizeLine}" (today's `sizeLine`: "1080×1080 · de · image · master"). The visible size line goes. The title shows under the picture only when titles differ within the direction (OI-DW-3); else it is in the name and tooltip only.
  - Master: a ★ disc in the picture's top-left corner, `title` "Master", hidden from the name (the name says "master"). The "Master" badge and the tint go. Video: a `film` icon in the bottom-left corner, `title` "Video".
  - Under the picture one strip row: on the left the marks, in `badge-words.ts` order, each a `StatusMark` without a label: `icon` as `badgeMarks` gives it (running uses `tone` `running`), `tip` = the badge word ("Running", "New result", "Text does not fit", "File missing", "Translation not approved", "Out of date", "Check warning", "Not checked"). Tones: running `running`; new result `accent` (dot, no icon); text does not fit `danger`; file missing, out of date, check warning `warn`; translation not approved and not checked `none`. A mark is clickable where its fix exists today: "Text does not fit" and "New result" open the variant; "Check warning" and "Not checked" show the Checks tab; "Translation not approved" shows the Translations tab; "File missing" opens the relink dialog; "Running" opens Activity; "Out of date" is plain here (CAMP-2 makes it open the sync). `badge-words.ts` keeps the words; its `kind` values change to the tones above.
  - The approval marks join the same strip: "Signed off by {n}" as `ok` `check` with label "{n}"; "Changed since published" `warn` `sync`; "Not in the gallery" `none` `eyeOff`; tips the words of `shared/approvals/marks.ts`. The "Sign-offs ({n})" toggle goes; the `ok` mark is a button that opens `SignoffList` in a popover (`.menu` look, placed by `ui/menu-place`, Escape closes).
  - New props pass the targets: `DirectionGrids` and `VariantsTab` take `onView(view)`; `campaign-view.tsx` passes `setView`.
- **Words:** "Master", "Video" (tooltips); the badge and approval words as tooltips and names.
- **Owns:** `screens/campaign/variant-tile/`, `approval-mark/`, `direction-grids/` (props and mark wiring), `variants-tab/variants-tab.tsx` (one prop), `campaign-view/campaign-view.tsx` (one prop), `ui/signoff-list/` (popover look only).
- **New files:** `tests/unit/renderer/screens/campaign/tile-marks.test.tsx`; `tests/shots/dw-camp-1.shots.ts`.
- **Tests first:** a tile's main button is named "{title} · {sizeLine}" and has no visible size line; the master has the ★ and no "Master" text; each badge flag draws one mark whose name is its word, in order; "Check warning" click calls `onView('checks')`; "Running" opens Activity; a tile with no flag has an empty strip; the sign-off mark opens a popover listing the sign-offs and Escape closes it; axe clean.
- **Approved edits:** `variant-tile.test.tsx`, `variant-grid.test.tsx`, `variant-grid-thumbnail.test.tsx`, `direction-grids.test.tsx`, `badge-words.test.ts` (kinds only), `approval-mark.test.tsx`, `approval-mark-look.test.tsx`, `campaign-view.test.tsx`, `tests/unit/renderer/ui/signoff-list.test.tsx`: visible badge text becomes the mark's name (`getByRole('button'|'img', { name: 'Out of date' })` or `getByTitle`); "Sign-offs (2)" becomes the sign-off mark; size line text lookups become the button's name. **`tests/e2e/variants-steps.ts`:** `tile()` changes in one place to `grid(...).getByRole('listitem').filter({ has: page.getByRole('button', { name: line }) })`, and `outOfDate()` to `getByTitle('Out of date', { exact: true })` inside the section; every caller (`workflow-5-3.spec.ts`, `workflow-5-4.spec.ts`, `localize*`, `export*`, `mcp-workflow*`) keeps what it proves. `check-panel.test.tsx` and `check-words.test.ts` are not touched (their "×" lines are Checks words).
- **Words on screen:** with CAMP-2 and CAMP-3, header and Variants grid 106 to 22.
- **Shots:** 459 a direction with master, a running tile and marks; 460 the sign-off popover.
- **Exit check:** lint, typecheck, `npx vitest run tests/unit/renderer/screens/campaign tests/unit/renderer/ui`, build, `npx playwright test tests/e2e/workflow-5-3.spec.ts tests/e2e/workflow-5-4.spec.ts tests/e2e/localize.spec.ts`, the shots.
- **Security:** none.

## CAMP-2 — Tile and direction actions

- **Kind:** markup and wording. Fixes AP-3, AP-7, AP-8, AP-13.
- **Exists when done:**
  - Tile actions: the "+" and the trash go from under the tile. At the strip's right end: the `eye` `.iconButton` "Quick look at {title}" (always shown) and a `MoreMenu` `label` "{title}" with items, in order: "Open" (opens), "Open in a tab" (was "+"), "Quick look", then danger "Delete…" (not on the master). Choosing "Delete…" opens the delete warning as today (DLG-2's dialog); Mod+Enter on the tile still opens in a tab.
  - Direction header, one line: the name as `h3`, a count chip "{n}" with a visually hidden " variants" (text "{n} variants"), the R2C-3 hint as an `InfoTip` about "Variants" on the first direction only ("Click a post to select it. Double-click it, or press Enter, to open it."), then "Fan out…" (secondary, `plus` icon), then "Sync {n}" (secondary, `sync` icon, `aria-label` and `title` "Sync {n} out of date…"), shown only when something is out of date, then a `MoreMenu` `label` "{direction name}" with "New direction…", "Rename…", danger "Delete direction…". The "Direction ▾" button and "Nothing to sync" go. The tile's "Out of date" mark now opens this direction's sync review.
  - Each direction is a `Section` look without fold (`fold` `'none'`): hairline under the header, no card, `--gap-section` between directions.
  - Direction dialogs: "New direction" / "Rename" on `kind="form"`; "Delete {name}?" on `kind="confirm"` with "Its {n} variants go with it. This cannot be undone." (real plural, same words) in the body, "Keep" then "Delete direction" (`.primary.danger`). Empty direction: `EmptyState` `grid`, "No variants", action "Fan out…".
- **Words:** "Open", "Open in a tab", "Quick look", "Delete…", "{n}", "Fan out…", "Sync {n}", "New direction…", "Rename…", "Delete direction…", "No variants", the delete line as above.
- **Owns:** `screens/campaign/variant-grid/` (`tile-actions.tsx`, `variant-grid.tsx`, CSS), `direction-header/`, `direction-grids/` (header and sync), `dialogs/direction-menu/`, `dialogs/sync-review/sync-button.tsx`.
- **New files:** `tests/unit/renderer/screens/campaign/tile-more.test.tsx`; `tests/shots/dw-camp-2.shots.ts`.
- **Tests first:** the tile's More menu lists the four items in order, no Delete on the master; "Open in a tab" opens behind; "Delete…" opens "Delete {title}?"; the header has no "Nothing to sync"; with 2 out of date a button named "Sync 2 out of date…" whose text is "Sync 2"; the direction menu is "More actions for {name}" with three items; the "Out of date" mark opens the sync review; axe clean.
- **Approved edits:** `variant-grid.test.tsx`, `tests/unit/renderer/dialogs/tile-actions-fixture.ts`, `delete-variant.test.tsx` (opening path only): "Open {title} in a tab" and "Delete {title}" buttons become More menu items. `direction-grids.test.tsx`: "{n} variant(s)" becomes "{n} variants". `direction-menu.test.tsx` line 43: `menuButton` becomes `{ name: 'More actions for Direction 1' }`; "New direction from this master…" becomes "New direction…"; "variant(s)" plural. `sync-review/sync-review.test.tsx` line 104: "Nothing to sync" case becomes "no Sync button". e2e: `screen-tour.ts` lines 140 to 141 and `workflow-5-4.spec.ts` lines 69 to 71 open "More actions for {name}" and choose "New direction…"; `workflow-5-3.spec.ts` line 48 "4 variant(s)" becomes "4 variants", lines 50 and 90 assert the Sync button has count 0. `variants-steps.ts` (Sync helper) unchanged (name kept).
- **Shots:** 461 a direction header with Sync and the tile More menu open; 462 the delete-direction confirm.
- **Exit check:** lint, typecheck, `npx vitest run tests/unit/renderer/screens/campaign tests/unit/renderer/dialogs`, build, `npx playwright test tests/e2e/workflow-5-3.spec.ts tests/e2e/workflow-5-4.spec.ts tests/e2e/screen-tour.spec.ts`, the shots.
- **Security:** short. Delete warnings keep their words and Keep-first focus; delete stays reachable for every variant but the master, and for every direction.

## CAMP-3 — Header and one tab strip

- **Kind:** markup and wording. Fixes AP-2, AP-3, AP-5, AP-7, C-10.
- **Exists when done:**
  - **Head**, one row: a `left` `.iconButton` named "Back to project"; the campaign name (`h2`, title size); the paid count as `PaidCount` (DLG-4a's mark), shown on the campaign views only, as today; the approvals button; the refresh button; "Export…"; a `MoreMenu` `label` "{campaign name}" with "Reports…" (opens CAMP-6's reports dialog); "Publish…" as the one `.primary`; `AssetsButton` as an `.iconButton` (`box`, name "Assets").
  - **Approvals:** one button, `link` icon and visible "Approvals", plus with a live link a `StatusMark` inside it (`ok` when every variant in the gallery is signed, else `none`) labelled "{a}/{b}". Its `aria-label` is "Approval link…" with no link, "Approval link… {a}/{b}" when live, "Approval link… off" when ended (the ended state shows a `none` mark labelled "Off"); its `title` is "Signed off: {a} of {b} variants. Checked {time}" or "Link turned off" (or the gone sentence). With a live link, a `sync` `.iconButton` named "Refresh", spinner while refreshing. **A refresh failure stays on the page** as today: the failure words in `--color-danger-text` right of the button.
  - **One tab strip** (C-10): one `TabRow` named "Campaign" (architect's wording) holding "Variants", "Checks" (with its warning count mark), "Translations", a thin divider, then each open variant tab named "{sizeLabel} · {language}" (the title first only when titles differ within the campaign), with its thumbnail, `TabMarks`, and ✕ "Close tab". Selecting a view shows the overview (`OVERVIEW_TAB` in the nav store) at that view; selecting a variant shows it. The "Overview" tab goes; the nav store is unchanged. Undo and Redo are `.iconButton`s (`undo`, `redo`, names "Undo" and "Redo", `title` with the shortcut) at the strip's right, shown while a view is shown.
  - The Translations view of a one-language campaign is `EmptyState` `globe`, "One language: {name}", no action.
  - The paid count line under the head goes (it is the head's mark).
- **Words:** "Back to project" (name), "Approvals", "{a}/{b}", "Refresh" (name), "Export…", "Reports…", "Publish…", "Assets" (name), "Variants", "Checks", "Translations", "Undo", "Redo" (names), "One language: {name}".
- **Owns:** `screens/campaign/campaign-head/`, `campaign-overview/`, `approval-bar/`, `campaign-export/`, `publish-button/`, `campaign-undo/`, `variant-tabs/`, `campaign-view/`, `app/campaign-tabs/` (only if the strip's name needs it), `ui/tab-row/` (a divider item), `screens/assets/assets-button/` (the icon look, after HOME-1).
- **New files:** `tests/unit/renderer/screens/campaign/one-tab-strip.test.tsx`; `tests/shots/dw-camp-3.shots.ts`.
- **Tests first:** one tablist "Campaign" holding Variants, Checks, Translations and the open variants; no tab "Overview"; a variant tab named "Square · de"; choosing Checks from a variant tab shows Checks; arrow keys move across all tabs; Publish is the only `.primary` in the head; "Reports…" in the More menu opens the reports dialog; a refresh failure's words are visible text; axe clean.
- **Approved edits:** `campaign-head.test.tsx` line 46: "Reports" becomes the More menu item "Reports…". `approval-bar.test.tsx`: "Approval link…" lookups become `name: /^Approval link…/`; "Signed off: …" and "Checked …" become the button's `title`; "Refresh" unchanged. `campaign-overview.test.tsx`, `variant-tabs.test.tsx`, `variant-tabs-warning.test.tsx`, `campaign-view.test.tsx`, `campaign-view-paid-count.test.tsx`, `campaign-undo.test.tsx`, `tests/unit/renderer/app/campaign-tabs.test.tsx`: tablists "Open variants" and "Campaign views" become "Campaign"; tab "Overview" becomes "Variants"; variant tab names drop the title; the one-language sentence becomes the EmptyState words; the paid count is found in the head. e2e: `screens.ts` line 209, `variants-steps.ts` line 120, `screen-tour.ts` line 75, `offline-export.spec.ts` line 168: tab "Overview" becomes tab "Variants"; `campaign-view-steps.ts` line 10 and `workflow-5-4.spec.ts` lines 106 to 108: tablist "Campaign", the selected tab is "Variants"; `export-warnings.spec.ts` line 99: open "More actions for {campaign}", choose "Reports…". `tests/approvals-local/app-steps.ts` lines 47, 78, 87: `name: /^Approval link…/`; line 73: tab "Variants".
- **Shots:** 463 head and strip with two variant tabs and a live link; 464 a refresh failure shown.
- **Exit check:** lint, typecheck, `npx vitest run tests/unit/renderer/screens/campaign tests/unit/renderer/app`, build, `npm run test:e2e`, the shots.
- **Security:** short. The paid count stays on the page; a refresh failure stays on the page; Publish and Export open their dialogs unchanged.

## CAMP-4 — Checks tab

- **Kind:** markup and wording. Fixes AP-1, AP-2, AP-4, AP-15, AP-16.
- **Exists when done:**
  - No card and no "Checks" `h2`. A header row: "Run checks" (`.primary`, spinner inside while running, "Checking…" as hidden status); summary `StatusMark`s: `warn` `alert` "{n} warnings" (the count as today's summary counts; a click opens the first warned row) and `none` `clock` "{n} not checked" for posts changed since their check (a click runs checks); an `InfoTip` about "Checks" holding one line per check. Refusals stay a danger notice under the header.
  - A table (`.table`): one row per checked post, in grid order; first cell the post's thumbnail and "{sizeLabel} · {language}" (★ on the master); then six columns headed "Files", "Colours", "Prohibited", "Required", "Translated", "Fits", each head's `title` the check's full name. Each cell one mark: `ok` `check` (passed), `warn` `alert` (warning), `none` "–" (skipped, the reason in `title`); a post changed since its check shows a `clock` mark after its name and dimmed cells (the "Changed since the last check." line goes). A click on a row, or Enter on it, folds open the findings under the row (`aria-expanded` on the row button): the check's name then each finding line, words unchanged. Never-checked posts are not listed; none at all: `EmptyState` `shield`, "Not checked yet", action "Run checks".
  - **Rules** below: a `Section` `'checks.rules'`, title "Rules", `fold` `'closed'` when any rule is set, `'open'` when none; summary "{n} colours · {m} files · {k} words"; `InfoTip` "Checks run against these rules." Colours: a `SwatchField`-like row of swatch chips, each with an always-shown ✕ named "Remove {hex}", and a "+" that opens the hex field (placeholder "#1A2B3C", Enter adds); the bad-hex refusal stays under the row. Required files: thumbnails (fonts as an "Aa" tile) with ✕ and a dashed "+" tile named "Add a required file…" opening today's dialog. Words: a Segmented of the campaign's languages, then "Required" and "Prohibited" text areas side by side (placeholder "One per line"), keeping their accessible names. "No colours.", "No required files." go.
- **Words:** "Run checks", "{n} warnings", "{n} not checked", "Files", "Colours", "Prohibited", "Required", "Translated", "Fits", "Not checked yet", "Rules", "One per line"; findings and refusals unchanged.
- **Owns:** `screens/campaign/check-panel/`, `rule-set-panel/`.
- **New files:** `tests/unit/renderer/screens/campaign/check-table.test.tsx`; `tests/shots/dw-camp-4.shots.ts`.
- **Tests first:** one row per checked post with six cells; a warned cell's name is the check's full name plus "warning"; clicking the row shows the findings word for word; the summary mark "3 warnings" leads to the first warned row; Rules starts closed when a colour is set, with its summary; adding a bad hex shows the refusal under the row; axe clean.
- **Approved edits:** `check-panel.test.tsx`, `check-words.test.ts`, `rule-set-panel.test.tsx`: block headings become rows; "Name: Status" badges become cell marks found by name; `summaryLine` words become the two marks; "No colours." and "No required files." cases assert the empty chip row; "Hex colour"/"Add colour" lookups become the "+" chip and its field. `tests/e2e/localize-steps.ts` (the rule set and check panel steps): the same lookups; what it proves is unchanged.
- **Words on screen:** Checks tab 101 to 41.
- **Shots:** 465 the table with one row open; 466 Rules open.
- **Exit check:** lint, typecheck, `npx vitest run tests/unit/renderer/screens/campaign`, build, `npx playwright test tests/e2e/localize.spec.ts`, the shots.
- **Security:** none (findings and refusals stay on the page).

## CAMP-5 — Translations tab

- **Kind:** markup and wording. Fixes AP-1, AP-2, AP-5, AP-8, AP-10, AP-15.
- **Exists when done:** no card and no "Translations" `h2`. At the top right an `export` `.iconButton` named "Export translation sheet…" and an `InfoTip` about "Translations" holding R2C-4's line; "Saved {file}." becomes an `ok` `check` StatusMark "Saved" with the file name in its `title`, `role="status"`, for a few seconds. Each language is a `Section` (`fold` `'none'`): its name, a `.progress` bar of approved rows with "{a}/{b}" (`title` "{a} of {b} approved"), "Approve all" (disabled when nothing is proposed, with `title` "Nothing proposed"), and "Translate again…" (secondary, `sync` icon; opens the run dialog as today). While a job runs: a spinner and a `stop` `.iconButton` "Stop" in the header (the "Running…" words go). **A failed job stays on the page** as a danger notice under the header: "Failed: {provider's sentence}" with "Retry". Column heads once: the source language name and the target's. Each row: the post's thumbnail and "{sizeLabel} · {layer name}"; the source text (read only, quiet ground); the field (saves on leaving, as built); a `link` toggle `.iconButton` with `aria-pressed`, named by today's sentence "Use for every {language} post with this text box"; the status as a `StatusMark`: `warn` "Missing", `info` "Proposed", `ok` "Approved"; **"Proposed" is a button that approves the row** (`tip` "Proposed: approve"), disabled while the field holds an unsaved edit, as today's Approve; then a small source icon (`sparkle` AI, `bot` agent, `pencil` you, `book` the brief) with the word in its `title`. A refusal stays one line under its row.
- **Words:** "Export translation sheet…" (name), "Saved", "{a}/{b}", "Approve all", "Translate again…", "Stop" (name), "Failed:", "Retry", "Missing", "Proposed", "Approved".
- **Owns:** `screens/campaign/translation-panel/`.
- **New files:** `tests/unit/renderer/screens/campaign/translation-table.test.tsx`; `tests/shots/dw-camp-5.shots.ts`.
- **Tests first:** column heads once; a proposed row's "Proposed" button sends the approve command and is disabled while the field is edited; the link toggle sets "use for every"; a failed job's words are visible with Retry; while running, "Stop" stops; axe clean.
- **Approved edits:** `translation-panel.test.tsx`, `translation-words.test.ts`, `export-sheet.test.tsx`, `translate-again.test.tsx`, `translate-again-count.test.tsx`: the "Approve" button becomes the "Proposed" mark button; the tick becomes the toggle with the same name (`getByRole('button', { name, pressed })`); "Running…" becomes the spinner and "Stop" keeps its name; "The translation did not finish: …" becomes "Failed: …"; the "(source)" labels go. `tests/e2e/localize-steps.ts`: the same lookups.
- **Words on screen:** Translations tab 101 to 21.
- **Shots:** 467 German with four rows and a failed job.
- **Exit check:** lint, typecheck, `npx vitest run tests/unit/renderer/screens/campaign`, build, `npx playwright test tests/e2e/localize.spec.ts`, the shots.
- **Security:** short. The paid "Translate again…" still opens the run dialog with its cost; failures stay on the page.

## CAMP-6 — Reports

- **Kind:** markup and wording. Fixes AP-9, AP-12.
- **Exists when done:** the reports dialog lists one `ObjectRow` per export: `thumb` the `file` icon, `name` "Export {n}" (architect's wording: numbered from the oldest, 1 first), `meta` the time, `marks` `ok` `check` "{n}" (files written) and, when any failed, `danger` `xCircle` "{n} failed"; `title` the export folder's base name only. A click or Enter on the row opens the report (today's "Open"). No path is printed. Empty: `EmptyState` `export`, "No exports yet", action "Export…" (opens the export dialog). `campaign-reports.tsx` exports `useReports(projectId, campaignId)` returning `{ open(): void, dialog: ReactNode }` for CAMP-3; until CAMP-3 the existing "Reports" button stays and uses it.
- **Words:** "Reports" (title), "Export {n}", "{n} failed", "No exports yet", "Export…".
- **Owns:** `screens/campaign/report-list/`.
- **New files:** `tests/unit/renderer/screens/campaign/report-rows.test.tsx`; `tests/shots/dw-camp-6.shots.ts`.
- **Tests first:** rows are buttons named "Export {n}…" that open the report; no text holds a `/` path; the folder base name is the row's `title`; the empty state offers "Export…"; axe clean.
- **Approved edits:** `report-list.test.tsx`: row sentences become row names, meta and marks; "Open" becomes the row click. `tests/e2e/export-warnings.spec.ts` line 102: `reports.getByRole('button', { name: 'Open' })` becomes the first row button (`name: /^Export /`).
- **Shots:** 468 the reports dialog with two exports, one with a failure.
- **Exit check:** lint, typecheck, `npx vitest run tests/unit/renderer/screens/campaign`, build, `npx playwright test tests/e2e/export-warnings.spec.ts`, the shots.
- **Security:** short. No full path on screen (only the base name in a tooltip).

## DLG-1 — Plural helper and job progress

- **Kind:** new code, adds only.
- **Exists when done:** `ui/plural.ts` exports `plural(n: number, one: string, many = one + 's'): string`, giving "1 file", "2 files", "0 files". `ui/job-progress/` (`job-progress.tsx`, `.module.css`, `index.ts`): props `label: string`, `value: number | null` (0 to 1; null draws the moving bar, still under reduce motion), `action?: { label: 'Run in background' | 'Stop'; onClick(): void; disabled?: boolean }`. It draws the `.progress` bar with `role="progressbar"`, `aria-label` = `label`, `aria-valuenow` as a whole percent when known, and the one button. No screen uses either yet.
- **Owns / New files:** `src/renderer/ui/plural.ts`, `src/renderer/ui/job-progress/*`; `tests/unit/renderer/ui/plural.test.ts`, `job-progress.test.tsx`.
- **Tests first:** plural for 0, 1, 2 and an irregular `many`; the bar's role, name and value; null value has no `aria-valuenow`; the action calls `onClick`; axe clean.
- **Approved edits:** none.
- **Exit check:** lint, typecheck, `npx vitest run tests/unit/renderer/ui`.
- **Security:** none.

## DLG-2 — Confirms: delete variant, licence, permission

- **Kind:** markup. **No words change** in these three dialogs: they are delete warnings, a licence confirmation and an agent's ask.
- **Exists when done:**
  - **Delete variant:** `kind="confirm"`. Title "Delete {title}?", body "This cannot be undone.", foot "Keep" (`.quiet`, focused) then "Delete variant" (`.primary.danger`; its own `.delete` class goes). The busy spinner moves inside "Delete variant". A refusal is a `DialogAlert` `danger`, same words.
  - **Licence:** `kind="confirm"`. The title sentence, the checkbox and its words, "Cancel" and "Confirm" unchanged; "Cancel" `.quiet`, "Confirm" `.primary` last.
  - **Permission dialog** (`app/permission-dialog/`): `kind="confirm"` only. Every word, the "Agent named" line, the full path list, the fixed consequence line (`COST_ID`, last in the body, the description), the time line, the tick, Refuse focused first, the 750 ms wait on Allow with its hidden reason, Escape and outside-click refuse, the import ask's file list and its `describedBy` are unchanged. A refusal is a `DialogAlert` `danger` with the same words.
- **Owns:** `dialogs/delete-variant/`, `dialogs/licence-dialog/`, `app/permission-dialog/` (`permission-dialog.tsx` and its CSS only; `file-list/`, `ask-words.ts`, `use-ask.ts` untouched).
- **New files:** `tests/unit/renderer/dialogs/confirm-kind.test.tsx`; `tests/shots/dw-dlg-2.shots.ts`.
- **Tests first:** each of the three uses the confirm width class; delete: "Keep" has focus, "Delete variant" is last and sends `variant.delete` only on its click; licence: title words byte-equal to today's; permission: the description is the consequence line, Refuse has focus, Allow does nothing for 750 ms after the list shows, the import ask lists every full path; axe clean on each.
- **Approved edits:** none to `permission-dialog*.test.tsx`, `licence-dialog.test.tsx` (they pass unchanged). `delete-variant.test.tsx`: only a lookup of the `.delete` class, if any, becomes the button by name.
- **Shots:** 469 delete variant; 470 the permission ask for files; 471 the licence dialog.
- **Exit check:** lint, typecheck, `npx vitest run tests/unit/renderer/dialogs tests/unit/renderer/app`, build, `npx playwright test tests/e2e/permissions.spec.ts tests/e2e/round-2-agent.spec.ts tests/e2e/comfy-asks.spec.ts`, the shots.
- **Security:** **full.** Check: no word of the three dialogs changed (diff the strings); Refuse-first focus and the 750 ms wait; the path list in full; the consequence line is the accessible description and the last body line.

## DLG-3a — Forms: key and address

- **Kind:** markup and wording. Fixes AP-1, AP-6, AP-8.
- **Exists when done:**
  - **Key dialog** moves onto `DialogFrame` `kind="form"`; its own Radix root and `key-dialog.css` go. Title "{Provider} key" with the provider's `key` icon. Today's description sentence goes into an `InfoTip` about "keys", word for word. One password field per secret with today's labels. Foot "Cancel" (`.quiet`), "Save" (`.primary`).
  - **Address dialog:** `kind="form"`. Title "ComfyUI address". The field, placeholder "http://127.0.0.1:8188" (the hint line goes). **The privacy paragraph (`ui/comfy-privacy.ts`) stays on the page word for word**, as the body's line above the buttons, and is the dialog's accessible description (moved from the head's `description` to `describedBy`). Foot "Cancel", "Save". A refusal is a `DialogAlert` `danger` under the field.
- **Words:** "{Provider} key", "About keys", "ComfyUI address", "Cancel", "Save".
- **Owns:** `dialogs/key-dialog/`, `dialogs/address-dialog/`.
- **New files:** `tests/unit/renderer/dialogs/key-address-form.test.tsx`; `tests/shots/dw-dlg-3a.shots.ts`.
- **Tests first:** the key dialog is a `DialogFrame` with title "Google Gemini key", saves on "Save" and sends nothing on Cancel or Escape; the address dialog's description equals `COMFY_PRIVACY` and the paragraph is visible; axe clean.
- **Approved edits:** `key-dialog.test.tsx`, `address-dialog.test.tsx`, `tests/unit/renderer/app/first-run.test.tsx`, `tests/unit/renderer/screens/settings-screen.test.tsx` (only lookups of these two dialogs): titles "Add your {provider} key" become "{Provider} key", "Enter your ComfyUI server's address" becomes "ComfyUI address", "Save and continue" becomes "Save". e2e: `comfy-asks.spec.ts` lines 57 and 63, `comfy-stand-in.spec.ts` lines 173 and 189; `tests/e2e-real/real-steps.ts` line 136: the same words. (Settings slices that run at the same time touch other cases of `settings-screen.test.tsx`: if one is merged first, rebase.)
- **Shots:** 472 key dialog; 473 address dialog.
- **Exit check:** lint, typecheck, `npx vitest run tests/unit/renderer/dialogs tests/unit/renderer/app tests/unit/renderer/screens`, build, `npx playwright test tests/e2e/comfy-asks.spec.ts tests/e2e/comfy-stand-in.spec.ts tests/e2e/first-run.spec.ts`, the shots.
- **Security:** short. The privacy paragraph is on the page word for word; the key fields stay password fields; nothing is saved on Cancel.

## DLG-3b — Forms: import, brief reading, subject, paste a brief

- **Kind:** markup and wording. Fixes AP-1, AP-6, AP-8, AP-9.
- **Exists when done:**
  - **Import:** `kind="form"`. Title "Import {n} files" (plural) or "Import a folder". The names as a strip of up to six small thumbnails (pictures) or `file` icons, names in `title`, then a "+{m}" chip for the rest (the "and {m} more" line goes). The destination as a Segmented "Assets" | "References" (old radio names kept as `aria-label`), each with its long words in an `InfoTip`. "Subject" select (old name "Attach to a subject" kept as `aria-label`), with its new-subject choice as built. After: the result lines stay on the page as `role="status"` lines, real plurals, then "Show in assets" and "Done" as built.
  - **Brief reading:** `kind="run"`. A spinner and "{Provider} is reading the brief…" (unchanged), "Stop". On failure: the `RunFailure` block unchanged, then "Type it" (name "Fill the form by hand" kept as `aria-label`) and "Retry".
  - **Subject dialog:** `kind="form"`, labels as built, descriptions to `InfoTip`s, refusals as `DialogAlert`, result lines with real plurals.
  - **Paste a brief:** `kind="form"`. The text area with the placeholder "JSON, YAML or Markdown" (the hint line goes). Foot: "Empty form" (`.quiet`, left; name "Start from an empty form" kept as `aria-label`), "Cancel", "Read brief" (`.primary`). A refusal is a `DialogAlert` `danger`.
- **Words:** "Import {n} files", "Assets", "References", "Subject", "Type it", "Empty form", "Read brief", "JSON, YAML or Markdown".
- **Owns:** `dialogs/import-dialog/`, `dialogs/brief-reading-dialog/`, `dialogs/subject-dialog/`, `screens/project-home/brief-paste/`.
- **New files:** `tests/unit/renderer/dialogs/form-kind.test.tsx`; `tests/shots/dw-dlg-3b.shots.ts`.
- **Tests first:** import of 9 files shows six thumbnails and "+3"; the Segmented sends the chosen library; result lines keep their words with plurals; paste: "Read brief" is last and the only primary, a refusal is an alert; brief reading: "Type it" opens the empty form; axe clean on each.
- **Approved edits:** `import-dialog.test.tsx`, `import-dialog-subject.test.tsx`, `tests/unit/renderer/screens/project-home/drop-import.test.tsx`, `import-files.test.tsx`: "Import {n} file(s)" becomes the plural title ("Import 2 files", "Import 1 file"); "and {m} more" becomes the "+{m}" chip; result lines lose "(s)". `brief-reading-dialog.test.tsx`, `brief-load-text.test.tsx`, `subject-dialog.test.tsx`, `brief-paste.test.tsx`, `brief-type.test.tsx`, `tests/unit/renderer/app/campaign-tabs-new.test.tsx`: names kept, so only the hint-line and "(s)" cases change.
- **Shots:** 474 import of nine pictures; 475 paste a brief with a refusal; 476 brief reading failed.
- **Exit check:** lint, typecheck, `npx vitest run tests/unit/renderer/dialogs tests/unit/renderer/screens/project-home tests/unit/renderer/app`, build, `npx playwright test tests/e2e/drop-import.spec.ts tests/e2e/offline-export.spec.ts`, the shots.
- **Security:** short. The import dialog shows names only, no path (as built); "Read brief" with a text brief still asks before any AI reading; failures stay on the page.

## DLG-4a — The run dialog and the paid lines

- **Kind:** markup and wording (C-15). Fixes AP-6, AP-13, AP-14.
- **Exists when done:**
  - **Provider:** a Segmented of the providers when two to four, a `select` when five or more, named "Provider". A disabled choice shows only the provider's name; its reason is its `title` ("Not yet available", "No workflow for this yet", "Cannot start this way"; architect's wording, from today's label suffixes). A trial workflow shows a small "Trial" mark on its choice. A retry shows the provider and count as disabled controls in the same places.
  - **Count:** an inline field, label as given (`count.label`).
  - **Paid count** (`ui/paid-count/`): a `StatusMark` `info` `coin`, `label` "Paid so far: {n} pictures, {m} videos" (real plurals; text requests added as in today's count), `tip` today's full sentence (OI-DW-7). Shown in the run dialog as today and in the campaign head (CAMP-3).
  - **The cost line** is the body's last thing, directly above the foot, and its `id` is in the dialog's `describedBy`. A paid provider (not `local`, not `fake`) draws a `MoneyLine`: image "Paid: {n} pictures[ + {m} references] → {Provider}"; video "Paid: 1 video, {s} seconds[ + {p} pictures] → {Provider}"; layout and one text request "Paid: 1 request → {Provider}"; several text requests "Paid: {n} requests → {Provider}"; cut-out "Paid: 1 cut-out → {Provider}". A provider the app does not know on a retry counts as paid. ComfyUI and the fake provider draw today's plain line unchanged ("This runs on your ComfyUI server at {address} with the workflow {label}. Nothing is charged." / "This uses the fake provider. Nothing is charged."). The video length line (`lengthLine`) stays, unchanged, directly above the cost line and also in `describedBy`. "No provider can do this yet." becomes a `DialogAlert` `warn` with the same words and a "Settings" action that shows Settings.
  - **The click:** the action button (`confirmLabel`, `.primary`) is the only send. Nothing is sent before it; from the click until the reply both buttons are disabled and the dialog cannot close (as built). No second confirm step.
  - `run-summary.ts` exports `runCost(input): { paid: boolean; words: string }` (fan-out uses it in DLG-4b); `paidLine` in `ui/paid-confirm/` returns "Paid: {n} requests[ + {m} references] → {Provider}".
  - **Two-step line** (`ui/paid-confirm/`, used by the sync review's Translate, the activity row's Retry): the `MoneyLine` look and words above, directly left of "Confirm" (`.primary`) and "Cancel"; still two clicks; only Confirm sends.
- **Words:** "Provider", the MoneyLine forms above, "Paid so far: …", "Trial", "Settings".
- **Owns:** `dialogs/run-dialog/`, `ui/paid-count/`, `ui/paid-confirm/`.
- **New files:** `tests/unit/renderer/dialogs/run-dialog-paid.test.tsx`, `tests/unit/renderer/ui/paid-line-look.test.tsx`; `tests/shots/dw-dlg-4a.shots.ts`.
- **Tests first** (the heart of the slice):
  - opening the dialog sends no command; changing the provider or count sends none; only the action click sends exactly one command whose provider and count are the ones shown;
  - the dialog's accessible description contains the MoneyLine words ("Paid: 4 pictures + 3 references → Google Gemini", read with "to"), and the MoneyLine is the last element of the body before the foot;
  - the MoneyLine's count and references follow the count field and the `referenceCount` prop, and agree with the command's `count`;
  - a video names the seconds and pictures it sends, as `onConfirm` gets them;
  - ComfyUI and fake show their plain line and no MoneyLine; an unknown retried provider shows a MoneyLine;
  - the action is disabled from the click to the reply (one run per click), for a picture and a video run;
  - a disabled provider choice has its reason in `title`; with no enabled provider the alert shows with "Settings";
  - the two-step line sends nothing on the first click and sends once on Confirm; Cancel sends nothing;
  - the paid count mark's label and tip; axe clean.
- **Approved edits:** `run-dialog.test.tsx`, `run-dialog-video.test.tsx`, `run-summary.test.ts`: "This will use {n} generation(s) with {X}." and "This sends … paid request(s) …" become the MoneyLine words; radio names lose their "(…)" suffix; the "No provider can do this yet." case finds the alert. `tests/unit/renderer/ui/paid-count.test.tsx`: the sentence becomes the mark's `title`. The paid-confirm tests where CAMP-7 put them, `sync-review/sync-translate-paid.test.tsx`, `tests/unit/renderer/app/activity-row.test.tsx`, `tests/unit/renderer/editor/layout-run.test.tsx`, `tests/unit/renderer/screens/campaign/translate-again*.test.tsx`: the paid words only. `tests/e2e/comfy-stand-in.spec.ts` (the lines CAMP-7 left), `tests/e2e-real/real-server.spec.ts` line 72 and `real-steps.ts` line 132: `/^This sends 1 paid request\(s\)/` becomes `/^Paid: 1 /`. The confirm flow of every e2e helper is unchanged: the action button keeps its `confirmLabel`.
- **Words on screen:** run dialog 45 to 20.
- **Shots:** 477 run dialog, paid, with references; 478 the two-step line in the sync review.
- **Exit check:** lint, typecheck, `npx vitest run tests/unit/renderer`, build, `npm run test:e2e`, the shots.
- **Security:** **full.** Check: no command before the action click; the cost words are on the page at that click and in the description; every paid path names the provider; the two-step line still needs Confirm; one run per click.

## DLG-4b — Fan-out and copy options

- **Kind:** markup and wording (C-15). Fixes AP-1, AP-5, AP-6, AP-8.
- **Exists when done:**
  - **Fan-out:** `kind="run"`. "Sizes": one toggle chip per size, drawing its shape and showing its label; `aria-label` today's `sizeName` ("9x16 (1080×1920)"), `title` the pixels; the master's chip pressed and disabled with `title` "The master's size". "Languages": chips likewise. "Formats": a two-choice toggle row "Image" | "Video" (both may be on; at least one stays on: the last on cannot be turned off, `title` "Choose at least one format"). Per new size with another pixel size, a radio group named "Background for {sizeName}" (`aria-label`), visible "{label}" and three icon choices: `fit` named "Scale: show the whole picture, black at the edges", `crop` named "Crop: fill the size and hide the edges", `sparkle` named "Generate fill: extend the picture with AI" (names and `title`s are today's words). "Provider" select when there is a fill. The cost lines last, above the foot, each in `describedBy`: a fill with a paid provider: `MoneyLine` "Paid: {n} fills → {Provider}"; with ComfyUI or fake: plain "{n} fills on {Provider}. Nothing is charged." (architect's wording); translations: `MoneyLine` "Paid: up to {n} translations → {Provider}". The action button reads "Make {n} variants" (real plural) and is the only send; with nothing to make it reads "Make variants", disabled with `title` "Nothing new to make". "This makes …", "Choose at least one format.", "Nothing new to make." and "This will use …" go. "No provider can do this yet." becomes a `DialogAlert` `warn` with "Settings".
  - **Copy options:** `kind="run"`. The run setup (provider, count, cost line, as DLG-4a) is drawn inside the dialog's body when there are no options yet and after "New options" (name "Make new options…" kept as `aria-label`); the nested `RunDialog` goes. The action button names the run ("Generate"); nothing is sent before it. Options as tiles in the reading face, chosen by an accent ring; foot "Close", "Use". Stop, Retry and failures as built.
- **Words:** "Sizes", "Languages", "Formats", "Image", "Video", "Provider", the cost lines, "Make {n} variants", "New options", "Use", "Close".
- **Owns:** `dialogs/fan-out/`, `dialogs/copy-options-dialog/`.
- **New files:** `tests/unit/renderer/dialogs/fan-out-paid.test.tsx`, `copy-options-inline.test.tsx`; `tests/shots/dw-dlg-4b.shots.ts`.
- **Tests first:** nothing is sent before "Make {n} variants"; the button's count equals the variants `variant.fanOut` makes; the fill MoneyLine's count equals the fills sent and names the provider the select shows; the translations line names the text provider; both money lines are in the accessible description; one send per click; copy options has no dialog inside it and sends `copy.*` only on "Generate"; axe clean.
- **Approved edits:** `fan-out-dialog.test.tsx`, `fan-out-formats.test.tsx`, `fan-out-translation.test.tsx`, `fan-out-model.test.ts`, `tests/integration/dialogs/fan-out-paid-count.test.ts`: "Make variants" becomes `name: /^Make (\d+ )?variants?$/`; size and language checkboxes become toggle buttons with the same names; the sentences become the MoneyLines or the disabled reason. `copy-options-dialog.test.tsx`: the nested dialog becomes the inline setup. e2e: `variants-steps.ts` (the `fanOut` helper, lines 46 to 66, in one place: chips by name, the fit radio by its name, "Make … variants" by the regex; line 60 becomes "1 fill on Fake provider. Nothing is charged."), `workflow-5-4.spec.ts`, `workflow-5-1-steps.ts` line 134 (name kept).
- **Words on screen:** fan-out with a fill 77 to 23.
- **Shots:** 479 fan-out with a paid fill and translations; 480 copy options with the inline setup.
- **Exit check:** lint, typecheck, `npx vitest run tests/unit/renderer tests/integration/dialogs`, build, `npx playwright test tests/e2e/workflow-5-3.spec.ts tests/e2e/workflow-5-4.spec.ts tests/e2e/workflow-5-1.spec.ts`, the shots.
- **Security:** **full**, as DLG-4a, for fan-out's fills and translations and copy options.

## DLG-5 — Pick dialogs

- **Kind:** markup and wording (C-16). Fixes AP-1, AP-5, AP-9.
- **Exists when done:** layout, reference pictures and the picture chooser use `kind="pick"` and `.pickGrid`. Tiles carry no captions; each tile's name and `title` are what its caption said (layout name plus its description; file name; "Photo of {subject}"). The chosen tile is ringed in the spot colour; reference ticks keep their order numbers. **Layout:** five previews; "Locked layers stay as they are." goes into an `InfoTip` about "Layout"; when any layer is locked, a `lock` mark "{n} kept" (`title` "Locked layers stay as they are"); foot "Cancel", "Apply". **References:** title as built, the head shows "{k} / 6"; grids "Library" and "Made here" (old names kept as `aria-label`); "At most 6 pictures." goes (the counter says it; at the limit unticked tiles are disabled with `title` "At most 6 pictures"); a dashed "+" tile ends the first grid for "Add pictures"; foot "Cancel", "Done". **Picture chooser:** the second grid's 18-word hint into an `InfoTip`; empty: `EmptyState` `image`, "No pictures yet", action "Import pictures…"; foot "Import pictures…", "Cancel".
- **Words:** "Apply", "Done", "Cancel", "{n} kept", "{k} / 6", "Library", "Made here", "No pictures yet", "Import pictures…".
- **Owns:** `dialogs/layout-dialog/`, `dialogs/reference-dialog/`, `dialogs/picture-chooser/`, `ui/reference-picker/`.
- **New files:** `tests/unit/renderer/dialogs/pick-kind.test.tsx`; `tests/shots/dw-dlg-5.shots.ts`.
- **Tests first:** each dialog has the wide class and a `.pickGrid`; tiles have no visible caption and are named by today's caption words; the reference counter follows the ticks; at six, the rest are disabled with the reason; Apply sends only on click; axe clean.
- **Approved edits:** `layout-dialog.test.tsx`, `reference-dialog.test.tsx`, `picture-chooser.test.tsx`, `tests/unit/renderer/screens/campaign/reference-picker.test.tsx`, `tests/unit/renderer/ui/reference-rows.test.ts`: caption text lookups become tile names or `title`s; the removed hint lines are read from InfoTips; "At most 6 pictures." becomes the counter and the disabled reason.
- **Words on screen:** layout dialog 133 to 31.
- **Shots:** 481 layout; 482 references with three ticked; 483 picture chooser.
- **Exit check:** lint, typecheck, `npx vitest run tests/unit/renderer`, build, `npx playwright test tests/e2e/scene-reference.spec.ts`, the shots.
- **Security:** none.

## DLG-6a — Export and package

- **Kind:** markup and wording. Fixes AP-1, AP-9, AP-10.
- **Exists when done:**
  - **Export:** `kind="publish"`. Title "Export {campaign}". The ads as `ObjectRow`s (thumbnail, "{size} · {language}", a tick as `stateActions`); one tri-state tick in the list's header, named "All ads" (architect's wording), replacing "Tick all" and "Untick all"; the header shows "Ads {k}/{n}". The folder as one row: its base name (full path in `title`, cut in the middle if it must show) and "Change…". Format Segmented "PNG" | "JPG" and Quality as built. The overwrite sentence stays on the page as one warn line under the folder row (it is lost work). While exporting, `JobProgress` "Exporting" with the percent as value, no "Exporting… 42%" text. Done: `ok` StatusMark "{n} exported". Warnings step: each warned ad as an `ObjectRow` with its `alert` mark and the warning words; reason field with placeholder "Why export anyway? (optional)" (label kept as `aria-label`); "Back", "Export anyway".
  - **Package:** `kind="publish"`. Title "Package project". The 27-word description into an `InfoTip`. Missing files: a warn `StatusMark` "{n} missing" and the files as `ObjectRow`s with `alert`; buttons "Find…" (name "Find missing files…" kept), "Skip them" (name "Package without them" kept), "Cancel". Then "Choose folder…" (name "Choose a folder and package…" kept). While packaging, `JobProgress` "Packaging". Done: `ok` StatusMark "{n} files · {size}" and the missing-left-out line with a real plural. The relink dialog stays nested (Q6 of the audit; one exit each).
- **Words:** "Export {campaign}", "Ads {k}/{n}", "All ads", "Change…", "PNG", "JPG", "Quality", "Exporting", "{n} exported", "Package project", "{n} missing", "Find…", "Skip them", "Choose folder…", "Packaging".
- **Owns:** `dialogs/export-dialog/`, `dialogs/package-dialog/`.
- **New files:** `tests/unit/renderer/dialogs/export-package-design.test.tsx`; `tests/shots/dw-dlg-6a.shots.ts`.
- **Tests first:** the header tick checks and unchecks all; no folder path is visible text; the overwrite line is visible; progress is a `progressbar` with a value; package missing rows with "Find…"; axe clean.
- **Approved edits:** `export-dialog.test.tsx`, `export-fixture.tsx`, `export-warnings.test.tsx`, `package-dialog.test.tsx`, `file-size.test.ts`, `tests/unit/renderer/screens/project-home/package-project.test.tsx`: "Tick all"/"Untick all" become the "All ads" tick; "Exporting… 42%" becomes the progress bar's value; "(s)" plurals; names kept elsewhere. e2e `export-steps.ts` (one place for the tick and folder steps), `export.spec.ts`, `export-warnings.spec.ts`, `offline-export.spec.ts`: the same.
- **Shots:** 484 export with the folder set; 485 package with missing files.
- **Exit check:** lint, typecheck, `npx vitest run tests/unit/renderer/dialogs tests/unit/renderer/screens/project-home`, build, `npx playwright test tests/e2e/export.spec.ts tests/e2e/export-warnings.spec.ts tests/e2e/offline-export.spec.ts`, the shots.
- **Security:** short. No temporary or full path printed; the overwrite line stays on the page.

## DLG-6b — Publish and the approval dialog

- **Kind:** markup and wording. Fixes AP-1, AP-2, AP-9, AP-10.
- **Exists when done:**
  - **Publish:** `kind="publish"`. Title as built. "To": a Segmented of the destinations, each with a `StatusMark` (set up or "Not set"), and a quiet "Settings" button when the chosen one is not set up (the "Set up … in Settings." line goes). A "First publish" `info` mark when it is. **The prompt line stays on the page**, short: "Files carry their prompts." with today's full sentence in its `InfoTip` and as the dialog's description (data leaving the machine). Files as `ObjectRow`s from `ui/publish-file-list/` (thumbnail, name, kind; no path; the path in no tooltip either). "Also uploaded" as chips "Ads", "Report", "Sheet", "List". **Replace:** a warn notice "Replaces publish {n} · {date}" with a Switch "Replace" that must be on before Publish enables (today's checkbox); the other replace sentences into the notice's `InfoTip`, except "from another project", which stays on the notice as a warn mark with its words. Warnings step: reason placeholder "Why publish anyway? (optional)", the "written into the published report" sentence stays on the page (data leaving). While publishing: `JobProgress` "Publishing" with "Run in background".
  - **Approval dialog:** every action row in the foot. Link row: the link, a `copy` `.iconButton` "Copy link", a `key` `.iconButton` "Copy password", a `MoreMenu` with "New password…" (was "Set a new password…"). Gallery row: its time and "Update gallery" with its progress and "Stop" as built. Sign-offs as `ObjectRow`s. Foot: "Turn off…" (`.danger`, left; name "Turn off link…" kept), "Close". The turn-off question becomes a `kind="confirm"` dialog over it: "Turn off link?", "Reviewers lose access. The gallery is deleted." with today's paragraph kept on the page under it (it says what is deleted), "Keep link", "Turn off link" (`.primary.danger`).
- **Words:** "To", "Settings", "First publish", "Files carry their prompts.", "Ads", "Report", "Sheet", "List", "Replace", "Publishing", "Copy link", "Copy password", "New password…", "Turn off…", "Turn off link?", "Keep link", "Turn off link".
- **Owns:** `dialogs/publish-dialog/`, `dialogs/approval-dialog/`, `ui/publish-file-list/`.
- **New files:** `tests/unit/renderer/dialogs/publish-design.test.tsx`; `tests/shots/dw-dlg-6b.shots.ts`.
- **Tests first:** no path text in the publish dialog; Publish stays disabled until the "Replace" switch is on when a publish would replace; the prompt line is visible and is the description; the turn-off confirm sends `approvals.end` only on "Turn off link"; axe clean.
- **Approved edits:** `publish-dialog.test.tsx`, `publish-fixture.ts`, `publish-warnings.test.tsx`, `publish-anyway-delay.test.tsx`, `approval-dialog.test.tsx`, `approval-dialog/update-progress.test.tsx`, `tests/unit/renderer/ui/publish-file-list.test.tsx`: destination radios become the Segmented; the replace checkbox becomes the switch with the same name; path text cases assert no path; "Set a new password…" becomes "New password…". e2e `publish-steps.ts` (one place), `publish.spec.ts`, `approvals.spec.ts`; `tests/approvals-local/app-steps.ts` lines 89 to 90 (names kept).
- **Words on screen:** publish, first time, 68 to 19.
- **Shots:** 486 publish, first time; 487 publish replacing; 488 approval dialog with the turn-off confirm.
- **Exit check:** lint, typecheck, `npx vitest run tests/unit/renderer/dialogs tests/unit/renderer/ui`, build, `npx playwright test tests/e2e/publish.spec.ts tests/e2e/approvals.spec.ts`, the shots.
- **Security:** short. Data-leaving lines on the page; the replace switch gate; the turn-off confirm.

## DLG-7 — Review dialogs

- **Kind:** markup and wording. Fixes AP-1, AP-2, AP-5.
- **Exists when done:** `kind="review"`, two panes.
  - **Sync review:** left, one `ObjectRow` per variant (thumbnail, "{size} · {language}", change-group icons with words in `title`); right, the picked variant: each change with its tick, the master's new value beside the variant's own, and on a blocked field a Segmented "Mine" | "Master" (names "Keep mine" and "Take the master's" kept). An untranslated row is a warn `StatusMark` "No {language}" (`tip` today's sentence) with "Translate" on the row; **Translate keeps the two-step line** (C-15, DLG-4a's look). Foot "Cancel", "Accept selected", "Accept all".
  - **Report:** left, the ads as rows with thumbnail and marks; right, the picked ad's lines (data unchanged). Head facts in a `Section` "Details", `fold` `'closed'`. Summary marks "✓ {n}", "▲ {n}", "✕ {n}" (`title`s with the words). "Close" `.quiet`.
  - **Relink:** missing rows with `alert` that turn `check` after a find; "Find…" per row; the 10-word checkbox becomes a Switch "Search folder" (old name kept) with an `InfoTip`; result sentences with real plurals stay on the page.
  - **Quick look:** `left`/`right` `.iconButton`s on the picture's sides, names "Previous" and "Next"; "{i} / {n}"; "Close". "Drawing the variant…" becomes a spinner with the same hidden status.
- **Words:** "Mine", "Master", "No {language}", "Translate", "Accept selected", "Accept all", "Details", "Search folder", "Find…", "{i} / {n}", "Close".
- **Owns:** `dialogs/sync-review/` (not `sync-button.tsx`), `dialogs/report-view/`, `dialogs/relink-dialog/`, `dialogs/quick-look/`.
- **New files:** `tests/unit/renderer/dialogs/review-kind.test.tsx`; `tests/shots/dw-dlg-7.shots.ts`.
- **Tests first:** two panes; picking a row on the left shows it on the right; Translate's first click sends nothing and shows the MoneyLine with Confirm; Accept sends the same decisions as today; quick look arrows move; axe clean.
- **Approved edits:** `sync-review/sync-review.test.tsx` (not line 104, which is CAMP-2's), `sync-translation.test.tsx`, `sync-words.test.ts`, `report-view.test.tsx`, `relink-dialog.test.tsx`, `quick-look.test.tsx`: the 16-word translation sentence becomes the mark's tip; per-variant blocks become rows plus the right pane; "Close" lookups unchanged; relink's checkbox becomes the switch with the same name.
- **Words on screen:** sync review with overrides 47 to 18.
- **Shots:** 489 sync review with an override; 490 report; 491 quick look.
- **Exit check:** lint, typecheck, `npx vitest run tests/unit/renderer/dialogs`, build, `npx playwright test tests/e2e/workflow-5-4.spec.ts tests/e2e/workflow-5-3.spec.ts tests/e2e/report-html.spec.ts`, the shots.
- **Security:** short. Translate is still two clicks with the cost at the second; the relink finds only files the user picks.

## Z-1 — Clean-up

- **Kind:** CSS and props removal. No screen changes.
- **Exists when done:** each `--font-size-*` alias that no file under `src/renderer/` and `approvals-service/src/` uses is gone from `tokens.css` and its copy (byte-equal); `.iconOnly` and every class in `layout.module.css` that no file uses are gone; the `description` prop of `DialogFrame` is gone if no dialog passes it (else the report names the users and it stays).
- **Owns:** `ui/tokens.css`, `approvals-service/src/ui/app-tokens.css`, `ui/layout.module.css`, `ui/dialog-frame/`.
- **Tests first:** a test that greps `src/renderer` for each removed name and finds none.
- **Approved edits:** `tokens-style.test.ts`, `tokens-design.test.ts`, `base-design.test.ts`, `dialog-frame.test.tsx`: remove the cases of the removed names only.
- **Exit check:** lint, typecheck, `npx vitest run tests/unit/renderer tests/unit/config`, build, `npm run test:e2e`.
- **Security:** none.

# App style — the prototype's look, screen group by screen group

**Goal:** the built screens look like the design prototype (`design/prototype/`), with every value from `tokens.css`, and nothing they do changes.

**Exit criteria**

- `tokens.css` holds every token of `spec/app-style.md`, "The token set", with those values; the contrast test passes for every pair listed there.
- Every renderer CSS file passes `styling-source.test.ts` (unchanged) and `styling-rules.test.ts` with no file left out (ST-14).
- Every screen group of `spec/app-style.md`, "Component by component", is restyled as written there.
- No visible text, label, accessible name, role, heading level, focus order or command call has changed: every existing unit, component, accessibility and end-to-end test passes, with only the approved edits named below.
- Shots 180 to 199 exist and the existing tour shots are taken again; the stakeholder has seen them beside the prototype.

**Dependencies:** none for ST-1. The later slices wait as the wave table says. The campaign page and project home slices go last, after the approvals and subject-photo slices that share their folders.

**Design:** `spec/app-style.md` (everything). Its "Choices taken for now" (C-1 to C-14) are the stakeholder's to review; a changed answer is a token or one-module edit.

## Rules for these slices

- Every slice: write the failing tests first, then the code; run lint, typecheck and the tests its class asks (`spec/testing.md`). The full gate runs before release, not per slice.
- **No behaviour change.** No slice changes what a component does, which commands or queries it sends, its visible words, its labels or accessible names, its roles, its heading levels or its focus order. A wanted look that needs any of those: stop and report; it goes to "Out of scope" in `spec/app-style.md`.
- **End-to-end tests pass unchanged.** No slice edits a file under `tests/e2e/`. An end-to-end failure caused by layout (a control moved out of reach, a canvas drag that lands elsewhere): stop and report, do not edit the test.
- **A slice edits only the folders it owns** and the files it may touch. Shared pieces are owned by one slice: `base.css`, `layout.module.css` and `ui/icon/` by ST-2; `ui/tab-row/` and `ui/tab-marks/` by ST-3; `ui/dialog-frame/` by ST-4. A later slice uses them and does not edit them; a change needed there: stop and report.
- **The mark.** A slice puts the line `/* app-style */` first in every CSS file it restyles. `styling-rules.test.ts` holds those files to the stricter rules (below). ST-14 removes the marks and applies the rules to every file.
- **Tokens.** Only ST-1 edits `tokens.css`. A later slice that finds a value missing: stop and report; the architect adds it to `spec/app-style.md` and a small follow-up edits `tokens.css`.
- **Components.** `.tsx` edits are limited to class names, wrapper elements that carry no role or name, decorative icons (`aria-hidden`), and the two new `DialogFrame` props (ST-4). Files stay under 200 lines where they can, 300 at most.
- **Shots.** New pictures are numbered 180 to 199 (allocated below), in `tests/shots/st-{n}.shots.ts`. "Retake" means run the named existing shots files again and list in the report the pictures that changed. Shots are taken by hand on a desktop and are not a routine check (`spec/testing.md`).
- Budget: one slice per developer run, well under 300k tokens; hand off with `HANDOFF.md` if near it.

### The stricter rules (`styling-rules.test.ts`)

For a renderer CSS file whose first line is `/* app-style */`, outside comments:

- `font-family`, `font-size`, `font-weight` and `line-height` values are `var(--…)`, `inherit` or `normal` only.
- `box-shadow` is `none` or is made only of `var(--…)`, `calc(…)` of tokens, `0`, and the word `inset`.
- `transition`, `animation` and their `-duration` and `-delay` parts hold no time literal (`\d+(\.\d+)?m?s`); times come from `var(--motion-…)`.
- A file with an `animation` also holds a `@media (prefers-reduced-motion: reduce)` rule.

## Order and side-by-side work

| Wave | Slice | Waits for | May run beside | Must not run beside |
|------|-------|-----------|----------------|---------------------|
| 1 | ST-1 Tokens (built) | nothing | any slice that does not edit `tokens.css` (SP-3 to SP-5, AP-11, AP-12, Phase 5 slices) | a slice that adds tokens (none planned) |
| 2 | ST-2 Base controls, shared layout, icons (built) | ST-1 | SP and AP slices (none edits `base.css`, `layout.module.css` or `ui/icon/`) | nothing planned |
| 3 | ST-3 App shell and tabs (built) | ST-2 | ST-4 to ST-8 | a slice editing `app/` or `ui/tab-row/` (none planned) |
| 3 | ST-4 Dialogs (built) | ST-2 | ST-3, ST-5 to ST-8 | AP-11 only if AP-11 edits `ui/dialog-frame/` (it does not; its new `dialogs/approval-dialog/` takes the look through the frame) |
| 3 | ST-5 Settings (built) | ST-2 | ST-3, ST-4, ST-6 to ST-8 | a slice editing `screens/settings/` (Phase 8 and 9 add sections later) |
| 3 | ST-6 Start screen and its drawings (built) | ST-2 | ST-3 to ST-5, ST-7, ST-8 | nothing planned |
| 3 | ST-7 Editor frame, canvas and layer list (built) | ST-2 | ST-3 to ST-6, ST-8 | a Phase 5 slice editing those `editor/` folders |
| 3 | ST-8 Editor properties panel and fields (built) | ST-2 | ST-3 to ST-7 | a Phase 5 or 6 slice editing those `editor/` folders |
| 4 | ST-9 AI in the editor and the run dialog (built) | ST-4 | ST-10, and wave 3 slices other than ST-4 | nothing planned |
| 4 | ST-10 AI dialogs and the activity panel | ST-4 | ST-9, and wave 3 slices other than ST-4 | nothing planned |
| 5 | ST-11 Campaign page: view, tabs, grid, tiles | ST-3 (uses `ui/tab-row`), AP-12 merged | ST-12, ST-13 | AP-11, AP-12, any Phase 5 slice editing `screens/campaign/` |
| 5 | ST-12 Campaign page: run panels and slot view | ST-4, AP-11 merged | ST-11, ST-13 | any Phase 5 slice editing `screens/campaign/` |
| 5 | ST-13 Project home and brief form | ST-4, SP-3 to SP-5 merged | ST-11, ST-12 | any slice editing `screens/project-home/` or `tests/shots/` files it retakes |
| 6 | ST-14 Close-out: every file under the rules, full check | every other ST slice | nothing | anything |

If Phase 5 starts its campaign page slices before ST-11 and ST-12, those slices take the look from `spec/app-style.md` directly, and ST-11 and ST-12 wait for them to merge. No two slices of one wave share a file: each owns the folders named in its "May touch".

## Slices

### ST-1 — Tokens (built)

- **Exists when done:** `src/renderer/ui/tokens.css` holds every token of `spec/app-style.md`, "The token set", with the values there: existing names with their new values, the new tokens beside them, and `@media (prefers-reduced-motion: reduce) { :root { --motion-fast: 0ms } }`. The header comment says where the values come from. No other source file changes. No font file is added (`spec/app-style.md`, "Where the font files come from"). The whole app shifts at once: spot colour, warm neutrals, softer card edges, larger section headings.
- **May touch:** `src/renderer/ui/tokens.css`. New test files below.
- **Tests first:**
  - `tests/unit/renderer/ui/tokens-style.test.ts` (new): every token name in the tables of "The token set" is defined; the values of `--color-accent` (`#cf1470`), `--color-page` (`#f7f4ec`), `--color-control-border` (`#8a857b`), `--font-serif` (starts with `'Iowan Old Style'`), `--weight-bold` (`650`), `--space-8` (`32px`), `--radius-lg` (`14px`), `--motion-calm` (`16s`) are as written; the reduce-motion rule sets `--motion-fast` to `0ms`.
  - `tests/unit/renderer/ui/token-contrast.test.ts` (new): reads `tokens.css`, follows `var()` to a colour, works out the WCAG 2.1 ratio, and checks every text pair of `spec/app-style.md`, "Contrast" at 4.5:1 or more and these edge pairs at 3:1 or more: `--color-control-border` on `--color-bg`, `--color-page`, `--color-surface`, `--color-surface-soft`; `--color-focus` on the same four and on `--canvas-backdrop`; `--color-accent` on `--color-bg`. A self-check: `#767676` on `#ffffff` gives 4.5 (to one decimal), `#ffffff` on `#ffffff` gives 1.
  - `tests/unit/renderer/ui/styling-rules.test.ts` (new): the stricter rules above, applied to marked files (none yet, so it passes); self-checks that `font-size: 13px`, `font-weight: 600`, `box-shadow: 0 1px 2px var(--x)`, `transition: left 0.15s` are flagged and their token forms pass.
- **Approved edits to existing tests:** none. `styling-source.test.ts` and `tokens-phase4.test.ts` pass unchanged (every name they need is kept; Phase 4 sizes keep their values).
- **Shots:** new `tests/shots/st-1.shots.ts`: `180-tokens-start`, `181-tokens-editor`. Retake `tour.shots.ts`.
- **Exit check:** lint, typecheck, the three new tests, `tests/unit/renderer/ui/`, the component tests under `tests/unit/renderer/` (axe stays clean), and `npm run test:e2e -- tests/e2e/screen-tour.spec.ts` on a desktop.
- **Class:** D, with one end-to-end run. Not security class. **After:** nothing.

### ST-2 — Base controls, shared layout, icons (built)

- **Exists when done:** `base.css` draws the body on `--color-page` with `--leading-body`; headings in the title face and sizes; every `button`, `input`, `select`, `textarea` as the shared button and field (edges `--color-control-border`, `min-height: var(--control-height)`; a control that must be smaller, such as a tab's close button or a layer row action, is set in its own module by its slice); `b`, `strong` at `--weight-bold`. `layout.module.css` holds the shared pieces of `spec/app-style.md`, "Shared pieces": `card`, `field`, `label` (now `--weight-medium`, no raw `600`), `row`, `muted`, `primary`, and new `quiet`, `danger`, `small`, `large`, `iconOnly`, `link`, `seg`, `switch`, `badge` (with `warn`, `danger`, `info`, `ok`, `neutral`, `accent`), `chip`, `notice` (same kinds), `menu`, `menuItem`, `menuLabel`, `table`, `progress`, `empty`, `reading` (the reading face for a long-text field), `formGrid`. The new `ui/icon/` draws an icon by name from the prototype path set. No component uses the new classes yet except where `base.css` styles elements directly.
- **New files:** `src/renderer/ui/icon/` (`index.ts`, `icon.tsx`, `icon-paths.ts` (the path data, may pass 200 lines only if the set does; split into two files instead), `icon.module.css`).
- **May touch:** `src/renderer/ui/base.css`, `src/renderer/ui/layout.module.css` (both marked).
- **Tests first:** `tests/unit/renderer/ui/icon.test.tsx`: each name draws one `svg` with `aria-hidden="true"`, `focusable="false"`, a 24 by 24 `viewBox` and no title; `size="small"` sets the small class; the icon adds no tab stop and axe is clean. `styling-rules.test.ts` now covers `base.css`, `layout.module.css`, `icon.module.css`. The existing `styling-source.test.ts` check that `code` uses `--font-mono` still passes.
- **Approved edits to existing tests:** none expected.
- **Shots:** `tests/shots/st-2.shots.ts`: `182-settings-controls` (Settings shows most control kinds). Retake `tour.shots.ts`.
- **Exit check:** lint, typecheck, `tests/unit/renderer/ui/`, every component test under `tests/unit/renderer/` (the base rules reach every screen), `npm run test:e2e -- tests/e2e/screen-tour.spec.ts tests/e2e/phase1.spec.ts` on a desktop.
- **Class:** D, with one end-to-end run. **After:** ST-1.

### ST-3 — App shell and tabs (built)

- **Exists when done:** the top bar, project switcher and its menu, campaign tabs, the variant tab row's shared look (`ui/tab-row`), tab marks with the spinner and pulsing dot, and the error banner as in "Component by component", "App shell and tabs". "Activity" and "Settings" show their icon beside the word.
- **May touch:** `src/renderer/app/app-shell/`, `app/campaign-tabs/`, `app/project-switcher/`, `app/error-banner/`, `app/activity-button/` (only the icon and the count pill), `src/renderer/ui/tab-row/`, `ui/tab-marks/`.
- **Tests first:** in the existing test files for these components, approved additions only: each icon added is `aria-hidden` and the button's accessible name is unchanged ("Settings", "Activity", each tab's name); the "Running" mark still reads "Running"; with `prefers-reduced-motion` the marks' CSS holds the reduce rule (read the module text). axe clean.
- **Approved edits to existing tests:** additions only to `app-shell.test.tsx`, `campaign-tabs.test.tsx`, `project-switcher.test.tsx`, `variant-tabs.test.tsx` (reads `ui/tab-row`). No expected value changes.
- **Shots:** `tests/shots/st-3.shots.ts`: `183-shell-two-campaigns`, `184-project-menu`. Retake `tour.shots.ts` and the Phase 3 shots that show the shell (`p3-9` to `p3-16`).
- **Exit check:** lint, typecheck, the component tests above, `styling-rules.test.ts`, `npm run test:e2e -- tests/e2e/screen-tour.spec.ts tests/e2e/editor-open.spec.ts tests/e2e/quit-warning.spec.ts` on a desktop.
- **Class:** D, with one end-to-end run. **After:** ST-2.

### ST-4 — Dialogs (built)

- **Exists when done:** `DialogFrame` draws the head, body and foot bands; it has the optional `footer` and `size` props. The non-AI dialogs (key, address, licence, import, relink, package, picture chooser) use the frame's bands, move their button row into `footer` where that row is already last, and use the shared pieces. Dialogs not in this slice look right through the frame alone.
- **May touch:** `src/renderer/ui/dialog-frame/`, `src/renderer/dialogs/key-dialog/`, `address-dialog/`, `licence-dialog/`, `import-dialog/`, `relink-dialog/`, `package-dialog/`, `picture-chooser/`.
- **Tests first:** `tests/unit/renderer/ui/dialog-frame.test.tsx` (approved additions): `footer` is drawn after the children and inside the dialog; Tab from the last body control reaches the first footer button; `size` sets the width class; without the new props the frame draws as before. Each dialog's existing test keeps its focus-order and name checks.
- **Approved edits to existing tests:** additions to `dialog-frame.test.tsx`. None to the dialog tests; a dialog whose test fails because its buttons moved: the row was not last, put it back in the body.
- **Shots:** `tests/shots/st-4.shots.ts`: `185-key-dialog`, `186-import-dialog`. Retake the Phase 2 dialog shots (`s2-9` to `s2-12`, `s2-17`).
- **Exit check:** lint, typecheck, the dialog component tests under `tests/unit/renderer/dialogs/` and `ui/dialog-frame`, `styling-rules.test.ts`, `npm run test:e2e -- tests/e2e/drop-import.spec.ts tests/e2e/screen-tour.spec.ts` on a desktop.
- **Class:** D, with one end-to-end run. **After:** ST-2.

### ST-5 — Settings (built)

- **Exists when done:** the Settings screen and its sections as in "Component by component", "Settings": one column, each section a card, the 21px title, problem lines as notices, the agent access toggle drawn as a switch (its role, name and pressed state unchanged).
- **May touch:** every folder under `src/renderer/screens/settings/`.
- **Tests first:** the existing Settings tests stay green unchanged; one approved addition in `mcp-section.test.tsx`: the toggle keeps its role, name and `aria-pressed` (or `aria-checked`) after the restyle. The visually-hidden label in `key-row.module.css` keeps its allow-listed `1px`.
- **Approved edits to existing tests:** that one addition.
- **Shots:** `tests/shots/st-5.shots.ts`: `187-settings`. Retake `s2-5`, `s2-6`, `s2-7`, `ap-10`, `ap-10a`.
- **Exit check:** lint, typecheck, `tests/unit/renderer/screens/settings/`, `settings-screen.test.tsx`, `styling-rules.test.ts`, `npm run test:e2e -- tests/e2e/phase1.spec.ts` on a desktop.
- **Class:** D, with one end-to-end run. **After:** ST-2.

### ST-6 — Start screen and its drawings (built)

- **Exists when done:** the start screen in two columns: the "Adman" wordmark (the existing `h1`, its text unchanged) and the three drawings on the left, the existing "New project" and "Open" cards and recent projects on the right. The drawings are the prototype's branch, generate and linked scenes as inline SVG, colours, line and timing from tokens, still with reduce motion.
- **New files:** `src/renderer/screens/start/start-drawings/` (`index.ts`, `start-drawings.tsx`, `iso.ts` (the grid-to-page maths and box, top, line and stairs helpers, pure), one file per scene if the drawing file would pass 200 lines, `start-drawings.module.css`).
- **May touch:** `src/renderer/screens/start/start-screen/`, `recent-projects/`, `new-project-form/`.
- **Tests first:** `tests/unit/renderer/screens/start-drawings.test.tsx`: three `svg` elements, each `aria-hidden` and `focusable="false"`; no element inside has a tab stop or an accessible name; the module CSS holds the reduce-motion rule. `tests/unit/renderer/screens/iso.test.ts`: a ground point maps as in the prototype (`pt(1, 0, 0)` gives `[7.8, 4.5]` for a 9-unit step). `start-screen.test.tsx` passes unchanged: the heading still reads "Adman".
- **Approved edits to existing tests:** none.
- **Shots:** `tests/shots/st-6.shots.ts`: `188-start-drawings`, `189-start-reduced-motion` (Playwright `reducedMotion: 'reduce'`).
- **Exit check:** lint, typecheck, the tests above, `styling-rules.test.ts`, `npm run test:e2e -- tests/e2e/phase1.spec.ts tests/e2e/window.spec.ts` on a desktop.
- **Class:** D, with one end-to-end run. **After:** ST-2.

### ST-7 — Editor frame, canvas and layer list (built)

- **Exists when done:** the editor frame, top bar, banner, canvas ground and canvas bar, panel heads, layer list and layer rows as in "Component by component", "Editor". The ad box has `--shadow-2`. Layer rows show their type icon. The row's "Hide", "Lock" and "Delete" buttons are small icon buttons (eye, lock, trash) laid over the right end of the row, with their accessible names unchanged and a tooltip. A row is one line at `--row-height` and never changes height. A hidden or locked layer keeps its pressed button visible. Selection, handles, guides and crop box keep their geometry.
- **May touch:** `src/renderer/editor/editor/`, `top-bar/`, `editor-banner/`, `canvas-view/`, `canvas-overlay/` (CSS only), `crop-overlay/` (CSS only), `layer-list/`, `layer-row/`, `layout-button/`.
- **Tests first:** the existing editor tests stay green unchanged, in particular `canvas-overlay.test.tsx` and `crop-overlay.test.tsx` (their inline `left`, `top`, `width`, `transform` values prove the geometry did not move) and `layer-list.test.tsx` (names "Hide {name}", "Lock {name}", "Delete {name}"). Approved addition in `layer-list.test.tsx`: the type icon is `aria-hidden` and the row's name is unchanged.
- **Approved edits to existing tests:** that addition.
- **Shots:** `tests/shots/st-7.shots.ts`: `190-editor-image`, `191-editor-crop`. Retake `p3-9` to `p3-16`, `lk-5`, `lk-6`.
- **Exit check:** lint, typecheck, `tests/unit/renderer/editor/`, `styling-rules.test.ts`, `npm run test:e2e -- tests/e2e/editor-open.spec.ts tests/e2e/scene-overflow.spec.ts` on a desktop.
- **Class:** D, with one end-to-end run. **After:** ST-2.

### ST-8 — Editor properties panel and fields (built)

- **Exists when done:** the properties panel body, groups, geometry grid, number fields, font field, text and text-box fields (copy in the reading face), picture fields, shade fields, colour choice (swatch edges `--color-control-border`, segmented groups), background colour field.
- **May touch:** `src/renderer/editor/properties-panel/`, `layer-fields/`, `geometry-fields/`, `number-field/`, `font-field/`, `text-fields/`, `text-box-fields/`, `picture-fields/`, `shade-fields/`, `colour-choice/`, `background-colour-field/`.
- **Tests first:** the existing tests of these folders stay green unchanged (names, `aria-pressed` on the colour and alignment buttons, units). axe clean.
- **Approved edits to existing tests:** none.
- **Shots:** `tests/shots/st-8.shots.ts`: `192-editor-text-properties`. Retake `lk-7`.
- **Exit check:** lint, typecheck, `tests/unit/renderer/editor/`, `styling-rules.test.ts`, `npm run test:e2e -- tests/e2e/editor-open.spec.ts` on a desktop.
- **Class:** D, with one end-to-end run. **After:** ST-2.

### ST-9 — AI in the editor and the run dialog (built)

- **Exists when done:** the generate fields (prompt in the reading face), the picture AI part, earlier options, the reference picker grid, the run dialog with its provider rows and paid count, the run failure and close warning notices, as in "AI panels and the run dialog".
- **May touch:** `src/renderer/editor/generate-fields/`, `picture-ai/`, `earlier-options/`; `src/renderer/dialogs/run-dialog/`; `src/renderer/ui/paid-count/`, `ui/run-failure/`, `ui/reference-picker/` (CSS and class names only), `ui/close-warning/`.
- **Tests first:** the existing tests stay green unchanged: `run-dialog.test.tsx` (focus starts where it does today, the provider and ComfyUI lines), `generate-fields.test.tsx`, `earlier-options.test.tsx`, `paid-count.test.tsx`, `run-failure.test.tsx`, `close-warning.test.tsx`, `reference-picker.test.tsx`. The paid confirm rules of `spec/screens.md` (nothing sent before Confirm, one run per click) are untouched.
- **Approved edits to existing tests:** none.
- **Shots:** `tests/shots/st-9.shots.ts`: `193-run-dialog`, `194-generate-fields`. Retake `p4-10`, `p4-12` to `p4-14`.
- **Exit check:** lint, typecheck, the component tests above, `styling-rules.test.ts`, `npm run test:e2e -- tests/e2e/comfy-stand-in.spec.ts tests/e2e/comfy-asks.spec.ts tests/e2e/quit-warning.spec.ts` on a desktop.
- **Class:** D, with one end-to-end run. Security check, short review: the run dialog and paid confirm still send nothing before the user's confirm, and the ComfyUI address is still drawn only where `spec/screens.md` allows. **After:** ST-4.

### ST-10 — AI dialogs and the activity panel

- **Exists when done:** the reference, brief reading, copy options and layout dialogs (options as selectable cards, copy in the reading face) and the activity panel, button count and rows as in "Activity panel".
- **May touch:** `src/renderer/dialogs/reference-dialog/`, `brief-reading-dialog/`, `copy-options-dialog/`, `layout-dialog/`; `src/renderer/app/activity-panel/`, `app/activity-row/`.
- **Tests first:** the existing tests stay green unchanged: `reference-dialog.test.tsx`, `brief-reading-dialog.test.tsx`, `copy-options-dialog.test.tsx`, `layout-dialog.test.tsx`, `activity-panel.test.tsx`, `activity-row.test.tsx`.
- **Approved edits to existing tests:** none.
- **Shots:** `tests/shots/st-10.shots.ts`: `195-activity-panel`, `196-copy-options`. Retake `p4-15` to `p4-20`.
- **Exit check:** lint, typecheck, the component tests above, `styling-rules.test.ts`, `npm run test:e2e -- tests/e2e/workflow-5-1.spec.ts` on a desktop.
- **Class:** D, with one end-to-end run. **After:** ST-4. (`app/activity-button/` is ST-3's.)

### ST-11 — Campaign page: view, tabs, grid, tiles

- **Exists when done:** the campaign page head, the variant tabs (through ST-3's `ui/tab-row`), the grid, direction groups and tiles as in "Campaign page, grid and tiles": tile marks as badges of their kind with icons, the chosen tile ring, the approval marks and bar (AP-11, AP-12) in the same pieces.
- **May touch:** `src/renderer/screens/campaign/campaign-view/`, `variant-tabs/`, `variant-grid/`, `variant-tile/`, `approval-bar/` and `approval-mark/` (AP-11, AP-12; CSS and class names only), `src/renderer/ui/variant-thumbnail/`.
- **Tests first:** the existing tests stay green unchanged: `campaign-view.test.tsx`, `variant-tabs.test.tsx`, `variant-grid.test.tsx`, `variant-grid-thumbnail.test.tsx`, `variant-tile.test.tsx`, `trial-mark.test.tsx`, `variant-thumbnail.test.tsx`, the AP-11 and AP-12 tests. Approved addition in `variant-tile.test.tsx`: each mark's icon is `aria-hidden` and the mark's words are unchanged.
- **Approved edits to existing tests:** that addition.
- **Shots:** `tests/shots/st-11.shots.ts`: `197-campaign-grid`. Retake `s2-13` to `s2-16`, `ap-11`, `ap-12`, `tour.shots.ts`.
- **Exit check:** lint, typecheck, `tests/unit/renderer/screens/campaign/`, `styling-rules.test.ts`, `npm run test:e2e -- tests/e2e/workflow-5-1.spec.ts tests/e2e/screen-tour.spec.ts` on a desktop.
- **Class:** D, with one end-to-end run. **After:** ST-3; AP-12 merged.

### ST-12 — Campaign page: run panels and slot view

- **Exists when done:** slot view, generate panel, paid confirm line, run list, run rows, run results, video panel, video picture choice, video result and provider select as in "Campaign page, grid and tiles".
- **May touch:** `src/renderer/screens/campaign/slot-view/`, `generate-panel/`, `paid-confirm/`, `run-list/`, `run-row/`, `run-result/`, `video-panel/`, `video-picture-choice/`, `video-result/`, `provider-select/`.
- **Tests first:** the existing tests stay green unchanged, in particular `generate-panel-click.test.tsx` and `run-row-click.test.tsx` (one run per click), `slot-view.test.tsx`, `video-panel.test.tsx`, `video-picture.test.tsx`, `run-failure.test.tsx`, `reference-limit.test.tsx`.
- **Approved edits to existing tests:** none.
- **Shots:** `tests/shots/st-12.shots.ts`: `198-campaign-run-list`. Retake `s2-8`, `s2-13`.
- **Exit check:** lint, typecheck, `tests/unit/renderer/screens/campaign/`, `styling-rules.test.ts`, `npm run test:e2e -- tests/e2e/comfy-stand-in.spec.ts` on a desktop.
- **Class:** D, with one end-to-end run. Security check, short review: as ST-9 (paid confirm untouched). **After:** ST-4; AP-11 merged.

### ST-13 — Project home and brief form

- **Exists when done:** the project home page, campaign list cards, brief load, brief form (reading face for long text, two-column grid for short fields, subject rows as cards, the photo list of SP-3 as squares), size and rule fields, drop import, import files, missing files and package project, as in "Project home and brief form".
- **May touch:** every folder under `src/renderer/screens/project-home/`, CSS and class names only (`brief-form-model.ts`, `brief-form-problems.ts`, `brief-form-photos.ts` and every `use-*.ts` are not touched).
- **Tests first:** the existing tests under `tests/unit/renderer/screens/project-home/` stay green unchanged (SP-3 to SP-5 own them; this slice adds none).
- **Approved edits to existing tests:** none.
- **Shots:** `tests/shots/st-13.shots.ts`: `199-project-home-brief`. Retake `sp-5` (140 to 146), `s2-13`, `s2-16`, `tour.shots.ts`.
- **Exit check:** lint, typecheck, `tests/unit/renderer/screens/project-home/`, `styling-rules.test.ts`, `npm run test:e2e -- tests/e2e/workflow-5-1.spec.ts tests/e2e/drop-import.spec.ts tests/e2e/jpeg-orientation.spec.ts` on a desktop.
- **Class:** D, with one end-to-end run. **After:** ST-4; SP-3, SP-4 and SP-5 merged.

### ST-14 — Close-out: every file under the rules, full check

- **Exists when done:** `styling-rules.test.ts` applies to every renderer CSS file except `tokens.css`, with no mark needed; the `/* app-style */` marks are gone. Files no screen slice owned (`render-worker/render-root/`, `dev/`, any folder added meanwhile) pass the rules or get the smallest token edit that makes them pass. The "Status" line of `spec/app-style.md` reads "Built (ST-1 to ST-14)".
- **May touch:** `tests/unit/renderer/ui/styling-rules.test.ts`; the first line of every marked CSS file; any renderer CSS file the rules now flag (token use only); `spec/app-style.md` (the "Status" line only).
- **Tests first:** `styling-rules.test.ts` changed to cover every file; it fails first on any file left over.
- **Approved edits to existing tests:** `styling-rules.test.ts` (this plan's own file).
- **Shots:** retake every shots file (`npm run shots`) and list changed pictures in the report.
- **Exit check:** lint, typecheck, `npm test`, `npm run test:e2e`, `npm run shots`; the exit criteria at the top of this file, one by one in the report.
- **Class:** D, with a full end-to-end run on a desktop. **After:** every other ST slice.

# Design wave: a cleaner interface

**Built.** Wave 1 and every Wave 2 slice (45 screen slices and SUBJ-1) are merged to `main`; the screens as built are described in the topic files (`spec/screens.md`, `spec/screens-ai.md`, `spec/screens-campaign.md`, `spec/screens-variants.md`, `spec/editor.md`). Where the build differs from this plan, the slice's line here says so.

The stakeholder found the interface "quite overwhelming, especially on settings panels and pages", and asked for "a cleaner, more intuitive UX with less clutter and less text overall". The layers panel and the video timeline are the parts they like: "clear and visual and interactive". This plan comes from the stakeholder-approved design audit of 2026-11-22; every open choice in it is taken as the audit recommends. Everything a developer needs is in this file, `spec/app-style.md` ("The design system", "The token set", "Icons") and `spec/app-style-parts.md`.

## Goal

Every screen works the way the layers panel and the timeline do: it shows the thing, marks its state with a clickable mark, keeps actions on the thing, and folds away what is rare. Words on screen drop by about two thirds on the worst screens, with no feature removed and every security line kept on the page.

## Status

**Built.** Wave 1 (shared tokens and parts) and Wave 2 (screens, detailed in `spec/phases/design-wave-screens-a.md` and `design-wave-screens-b.md`) are merged. The Z-1 clean-up follows.

## Read with

`spec/phases/DEV-RULES.md` (every developer reads it first), `spec/app-style.md`, `spec/app-style-parts.md`, `spec/screens.md` "Rules for every screen", `spec/security.md` "Paths in the renderer", and the topic sections each slice names.

## The choices taken

Each is a rule for this wave.

- **C-1. Settings is a side list of four pages:** AI services, Files, Publish, Agents. Each page is a title and Sections.
- **C-2. Every field keeps a visible edge** in `--color-control-border` (the 3:1 rule).
- **C-3. Layer row actions:** the eye and the lock stay as icons on the row; Duplicate and Delete go into the row's More menu. The properties panel then drops its Layer section; nothing is lost.
- **C-4. A field that holds one value saves on Enter or when focus leaves it**, with a short "Saved" mark. A field whose save contacts an outside service, a form whose values save together, and a key keep one Save.
- **C-5. Help is in InfoTips only.** There is no switch that prints all help on the page.
- **C-6. The start screen has no top bar.** The picture runs to the top of the window; Activity and Settings are two icon buttons in the top right corner of the right half. Open projects lead the Recent list, which is the way back to them.
- **C-7. No dark theme now.** Light only; the role tokens make a dark theme a token-file change later.
- **C-8. A Section's folded or open state lasts for the window's session.** It is not saved.
- **C-9. The serif is for page titles, dialog titles and names** (and the reading face for long text the user wrote). Small panel headings are sans.
- **C-10. The campaign page has one tab strip** holding Variants, Checks, Translations and the open variants.
- **C-11. A variant tile shows its picture, a ★ for the master and a strip of marks;** its title and size go in the tooltip, since the row and column heads already say size and language. This holds where a direction's variants share one title (open item OI-DW-3).
- **C-12. The campaign page's slot view, "Make pictures" panel and "Runs" list go,** now that the editor's Generate panel makes pictures and videos (slice CAMP-7).
- **C-13. The brief form opens as its own "New campaign" page** with a back arrow and a fixed Create button, not inside the project home.
- **C-14. The Settings button toggles.** Escape and a ✕ leave Settings; the campaign tabs stay drawn while it shows; leaving returns to the view the user came from.
- **C-15. Paid runs: a paid call starts only after the user's own click with the cost on screen at that click.** In a dialog the user opened to make something (the run dialog, fan-out), the dialog's action button is that click: the cost line (MoneyLine) sits directly above the buttons and is in the dialog's accessible description, the button names the action, nothing is sent before it, and there is no second confirm step. From a control in a place not opened to pay (the sync review's Translate, the activity row's Retry for a video, the campaign page's panel and run rows while they exist), the two-step line stays: the first click shows the cost with Confirm and Cancel, and only Confirm sends. The binding text is in `spec/screens.md`, "Rules for every screen"; DLG-4 builds it.
- **C-16. A sixth dialog kind, `pick`,** for the layout dialog, the reference dialog and the picture chooser: a grid of pictures, no captions, Cancel and Use.
- **C-17. The prompt and the reference pictures are set in the editor's Generate panel only.** The run dialog keeps provider, count and cost.
- **C-18. A run's results show where the picture is, as today:** the run dialog closes and the result lands on the layer and in the panel.

## The sixteen anti-patterns

The audit found 145 problems; most are these sixteen in different places. Each has one named fix, so it is fixed the same way everywhere. A slice names the AP numbers it fixes.

| # | Anti-pattern | Named fix | What the fix is |
|---|---|---|---|
| AP-1 | Help paragraphs on the page | Help into InfoTip | A better label, a placeholder or a unit first; what is left goes in an InfoTip. Security text stays on the page, one short line |
| AP-2 | State written as a sentence | StatusMark | A dot or icon and at most two words, clickable when there is something to do |
| AP-3 | One thing in two places that look or act differently | One place | Keep the better spot, remove the other |
| AP-4 | Nothing folds | Section with summary | Group into Sections that fold, with a summary on the header; open when it needs action, closed when set and fine |
| AP-5 | Words where a picture would do | Visual control | Icon segments, swatches, drawn size chips, an icon bar on the picture; names in tooltips and accessible names |
| AP-6 | Several kinds of control for one job | One control per job | Switch for on/off, Segmented for 2 to 4, select for more, one swatch field, one save rule |
| AP-7 | Too many accent buttons | One primary | One `primary` per view; the rest secondary or quiet |
| AP-8 | Labels that are sentences | Two-word labels | One or two words, verb first for buttons; the rest in an InfoTip |
| AP-9 | Raw paths, file names and code names printed | Name first, path in tooltip | The user's name for the thing; the path in the tooltip and accessible name, cut in the middle where it must show |
| AP-10 | Progress away from the thing | Progress on the thing | A spinner or ring on the tile, row or picture being made; a dot for "new" |
| AP-11 | A mode with no way out | One way out | ✕, Back or Escape, in the same spot each time |
| AP-12 | State that shows only on hover | State always shown | Marks that are also switches (eye, lock) always show, dimmed in their default state |
| AP-13 | Disabled with no reason | Reason in tooltip | A disabled control's `title` says what is missing |
| AP-14 | Colour that says the wrong thing | Colour means status | Accent for selected, running or the main action; green, amber, red for ok, needs a look, broken; always with an icon or word |
| AP-15 | A box around every group | Hairline Sections | No boxes; a hairline under each Section. Boxes only for things you click or pick up |
| AP-16 | Full-width fields for short values, units outside | Inline field, unit inside | Label left, a value-sized control right, the unit inside; two short fields share a row |

## Rules for every slice of the wave

- **No feature removed.** Every action stays reachable, by the same keyboard path or a shorter one. A slice that moves an action names its new place in its report.
- **Every colour, space, radius and type size from tokens** (`styling-source.test.ts`, `styling-rules.test.ts`). Only T1 edits `tokens.css` in Wave 1. A Wave 2 slice that needs a new token names it in its plan entry; it then copies the file to the approvals service in the same commit.
- **Accessibility is kept:** every control has a name; roles, heading order and focus order stay sound; text 4.5:1, marks, edges and focus 3:1; visible focus; reduced motion stops everything that moves. Each new or changed screen passes axe in its unit test.
- **Paths:** no path is printed where `spec/screens.md` ("Rules for every screen") and `spec/security.md` ("Paths in the renderer") forbid it. Where a path may show (the project's own file, the default folder), it moves into a tooltip and the accessible name; a visible path is cut in the middle.
- **Security text stays on the page.** Money, lost work, data leaving the machine, what an agent asks to do, and failures are never moved into a tooltip or an InfoTip and never folded away. By name: the permission dialog's list of full paths, its fixed consequence line, its time line and its Refuse-first focus and wait (all unchanged, words included); the cost line of every paid run; licence confirmations; delete warnings; the close warnings' charge lines; the agent-runs paid line; "Deletes cannot be undone." for agent deletes; the local image server's privacy paragraph (`ui/comfy-privacy.ts`), word for word. They may get shorter only where this plan or the screen's spec names the new words.
- **Words on screen go down,** measured per screen: each Wave 2 slice's report gives the count before and after for each screen or dialog it changed (titles, labels, buttons, marks, hints, sentences; not the user's own data; InfoTip text not counted).
- **Words change only where named.** Words in this app are pinned by tests and spec. A slice uses the words in its plan entry; an existing test that pins an old word changes only as the entry's "Approved edits" says.
- **Test first; one slice per developer run, well under 300k tokens; `HANDOFF.md` when near it** (`DEV-RULES.md`).
- **Check class.** Every slice in this wave is class D (UI). Its exit check lists the commands for that slice. The full list in `DEV-RULES.md`, "Verify before you say done", runs once after Wave 1 and once after Wave 2, by the orchestrator.
- **Shots.** A slice that changes what a user sees adds `tests/shots/dw-{slice id in lower case}.shots.ts`. Picture numbers 400 to 499: T2 takes 400 to 404; the Wave 2 architect hands out 405 to 499. Made-up content only.
- **One folder, one slice at a time.** Two slices that touch the same folder never run side by side; the order rules below say which goes first. The orchestrator keeps about five to six developer runs going at a time.

## Wave 1: shared tokens and parts

Wave 1 adds tokens and parts. **It does not move any screen onto them**: screens adopt the parts in Wave 2. The only visible changes are the ones the tokens force (T1) and the three base rules of T2: control and row heights a little smaller, page titles 24px, `h2` and `h3` at 17px, cards without a shadow, menus at elevation 2.

```
T1 tokens ‖ T3f icons
   └─> T2 base controls ‖ T3a Section ‖ T3b StatusMark + InfoTip ‖ T3c ObjectRow ‖ T3e SubPage + side list
          (T4 dialog frame waits for T1 and T3f)
   └─> T3d fields (waits for T2)
```

| Slice | Kind | Existing markup | After | Beside |
|-------|------|-----------------|-------|--------|
| T1 | CSS (tokens) | none; values change | none | T3f |
| T2 | CSS | none | T1 | T3a, T3b, T3c, T3e, T4 |
| T3a | new part | none (adds only) | T1 | T2, T3b, T3c, T3e, T4 |
| T3b | new parts | none (adds only) | T1 | T2, T3a, T3c, T3e, T4 |
| T3c | new parts | none (adds only) | T1 | T2, T3a, T3b, T3e, T4 |
| T3d | new parts and optional props | none (optional props, defaults unchanged) | T2 | T3a, T3b, T3c, T3e, T4 |
| T3e | new parts | none (adds only) | T1 | T2, T3a, T3b, T3c, T4 |
| T3f | icons | none (adds only) | nothing | T1 and all |
| T4 | frame props and new parts | none (optional props, defaults unchanged) | T1, T3f | T2, T3a to T3e |

### T1 — Tokens

- **Kind:** CSS. Changes token values, so sizes change on every screen; no markup.
- **Exists when done:** `tokens.css` holds every token of `spec/app-style.md`, "Tokens the design wave adds and changes (T1)", with exactly those names and values, under the comment `/* Design wave: roles. */`; the four heights changed; the five `--font-size-*` aliases; `--width-start-art`, `--drawing-height`, `--drawing-stroke`, `--motion-calm` and the "Start page drawings" comment gone; the `[data-density='compact']` block as the last block of the file, after the reduce-motion `@media` block. `approvals-service/src/ui/app-tokens.css` is a byte-equal copy.
- **New files:** `tests/unit/renderer/ui/tokens-design.test.ts`.
- **May touch:** `src/renderer/ui/tokens.css`; `approvals-service/src/ui/app-tokens.css` (copy only); the tests named below. The header comment of `tokens.css` gains one line: "The design wave's roles and density: spec/app-style.md, 'The design system'."
- **Tests first** (`tokens-design.test.ts`, reading `:root` up to the first `@media` as the other token tests do):
  - each added token is defined with its exact value;
  - `--control-height` 32px, `--control-height-small` 24px, `--control-height-large` 40px, `--row-height` 36px;
  - the aliases: `--font-size-small` is `var(--type-meta-size)`, `--font-size-control` `var(--type-body-size)`, `--font-size-reading` `var(--type-reading-size)`, `--font-size-heading` `var(--type-title-size)`, `--font-size-page` `var(--type-page-size)`; `--font-size-body` 14px, `--font-size-title` 21px, `--font-size-wordmark` 24px unchanged;
  - the four removed tokens are not defined anywhere in the file;
  - the compact block comes after the `@media` block and sets exactly `--control-height: 28px`, `--row-height: 32px`, `--gap-field: var(--space-2)`, `--gap-section: var(--space-4)`, `--icon-size: 14px`.
- **Approved edits to existing tests:**
  - `tests/unit/renderer/ui/tokens-style.test.ts`: remove `'--width-start-art'`, `'--drawing-height'`, `'--drawing-stroke'` and `'--motion-calm'` from `SIZES_AND_MOTION`, and the case `['--motion-calm', '16s']`. Nothing else.
  - `tests/unit/renderer/ui/token-contrast.test.ts`: add (only add) `MARK_PAIRS`, each of `--color-ok`, `--color-warn`, `--color-danger`, `--color-info` on `--color-bg`, `--color-page`, `--color-surface`, `--color-surface-soft`, `--color-accent-soft`, checked at 3:1.
  - Unchanged and must pass: `tokens-phase4.test.ts`, `styling-source.test.ts`, `styling-rules.test.ts`, `tests/unit/config/approvals-tokens.test.ts`.
- **Exit check:** `npm run lint`, `npm run typecheck`, `npx vitest run tests/unit/renderer tests/unit/config`, `npm run build`.
- **Security:** none.

### T2 — Base controls

- **Kind:** CSS. No markup.
- **Exists when done:** in `base.css`, `h1` takes `font-size: var(--type-page-size)` and `font-weight: var(--type-page-weight)`; `h2` and `h3` take `var(--type-title-size)` and `var(--type-title-weight)`; the face stays `--font-title`. In `layout.module.css`: `.card` has no `box-shadow`; `.menu` has `box-shadow: var(--shadow-2)`; new classes `.secondary`, `.iconButton`, `.primary.danger`, `.inline` (with `.field`), `.unitBox`, `.unit`, each as `spec/app-style-parts.md` ("Button", "Field") describes. No screen uses the new classes yet.
- **New files:** `tests/unit/renderer/ui/base-design.test.ts`; `tests/shots/dw-t2.shots.ts`.
- **May touch:** `src/renderer/ui/base.css`, `src/renderer/ui/layout.module.css`.
- **Tests first** (`base-design.test.ts`, with the `rule()` reader of `base-style.test.ts`): `h1` uses `--type-page-size`, `h2` and `h3` `--type-title-size`; `.card` has no `box-shadow`; `.menu` uses `--shadow-2`; `.iconButton` is `--control-height-small` both ways with no edge; `.primary.danger` takes `--color-danger-text` as its ground; `.field.inline` is a grid whose first column is `--field-label-width`; `.unitBox` draws the control edge and the focus outline on `:focus-within`.
- **Approved edits to existing tests:** `tests/unit/renderer/ui/base-style.test.ts` lines 38 to 40: `h1` expects `--type-page-size`; `h2` and `h3` expect `--type-title-size`. Nothing else. Every other test under `tests/unit/renderer` passes unchanged (the settings, properties and AI style tests read these files).
- **Shots:** `dw-t2.shots.ts`, 400 Settings, 401 project home, 402 campaign page, 403 the editor with a text layer selected, 404 the run dialog. Check by eye that nothing is cut off or overlaps at the smaller heights.
- **Exit check:** `npm run lint`, `npm run typecheck`, `npx vitest run tests/unit/renderer`, `npm run build`, the shots.
- **Security:** none.

### T3a — Section

- **Kind:** new part. Adds only.
- **Exists when done:** `ui/section/` as `spec/app-style-parts.md`, "Section": the props, the markup, the fold memory for the session (C-8), "›" for a SubPage, no box.
- **New files:** `src/renderer/ui/section/` (`section.tsx`, `section.module.css`, `fold-memory.ts`, `index.ts`); `tests/unit/renderer/ui/section.test.tsx`.
- **May touch:** nothing else.
- **Tests first:** the title is a heading at `level` (default 3) holding a button with `aria-expanded` and `aria-controls`; a click folds and the body gets `hidden`; a second click opens it; unmount and mount again with the same `id` keeps the state (and a new `id` starts from `fold`); `fold="closed"` starts closed; `fold="none"` draws no button; `onOpenPage` draws a button with no `aria-expanded` that calls it; a StatusMark-like button passed as `summary` is its own tab stop after the fold button; the CSS has no `box-shadow` and no `border-radius`, and the title uses `--type-section-size`; axe is clean open and closed.
- **Approved edits to existing tests:** none.
- **Exit check:** `npm run lint`, `npm run typecheck`, `npx vitest run tests/unit/renderer/ui`.

### T3b — StatusMark and InfoTip

- **Kind:** new parts. Adds only.
- **Exists when done:** `ui/status-mark/` and `ui/info-tip/` as `spec/app-style-parts.md` describes, with the standard marks' words in that file's table available as the caller's words (the part itself holds no product words).
- **New files:** `src/renderer/ui/status-mark/` (`status-mark.tsx`, `status-mark.module.css`, `index.ts`); `src/renderer/ui/info-tip/` (`info-tip.tsx`, `info-tip.module.css`, `index.ts`); `tests/unit/renderer/ui/status-mark.test.tsx`; `tests/unit/renderer/ui/info-tip.test.tsx`.
- **May touch:** nothing else (it uses `ui/icon/` and `ui/menu-place/` as they are).
- **Tests first:**
  - StatusMark: each tone sets its class and colour token; with no `label` an icon is required (a dot alone without a label renders with its `tip` as accessible text); not clickable: a `span` with `title` = tip and the tip readable by a screen reader when it differs from the label; clickable: a button whose accessible name is the tip and which calls `onClick`; `running` draws the turning spinner and stops under reduce motion (the `spinner-motion.test.tsx` pattern); axe clean.
  - InfoTip: a button named "About {about}" with `aria-expanded="false"`; click opens the popover (`aria-expanded="true"`, the text visible); Escape closes it and focus is on the button; a click outside closes it; opening a second InfoTip closes the first; axe clean open.
- **Words:** "About {about}" (InfoTip button).
- **Approved edits to existing tests:** none.
- **Exit check:** `npm run lint`, `npm run typecheck`, `npx vitest run tests/unit/renderer/ui`.

### T3c — ObjectRow, MoreMenu and EmptyState

- **Kind:** new parts. Adds only. The layer row is **not** moved onto ObjectRow here (that is ED-1), so `editor/layer-row/` and its tests are untouched.
- **Exists when done:** `ui/object-row/`, `ui/more-menu/`, `ui/empty-state/` as `spec/app-style-parts.md` describes. `object-row.module.css` starts as a copy of the box, height and over-the-end actions rules of `editor/layer-row/layer-row.module.css`.
- **New files:** the three folders (`.tsx`, `.module.css`, `index.ts` each); `tests/unit/renderer/ui/object-row.test.tsx`, `more-menu.test.tsx`, `empty-state.test.tsx`.
- **May touch:** nothing else.
- **Tests first:**
  - ObjectRow: the box has `height: var(--row-height)` and the actions are laid over it (the same CSS check as `layer-list.test.tsx`, "rows keep one height"); a row with `meta` has `min-height: var(--row-height)`; `stateActions` and `more` show always; `actions` show only on hover, focus inside the row and `selected` (the CSS rule and a focus test); `muted` strikes the name; `onSelect` on click, `onOpen` on double-click and Enter; `title` is on the row; axe clean.
  - MoreMenu: a button "More actions for {name}" with `aria-haspopup="menu"`; opening shows `role="menu"` items in the given order with danger items last after a separator; arrow keys move; Escape closes and returns focus; a disabled item has its reason in `title` and does not call `onChoose`.
  - EmptyState: the icon is hidden, the words show, the one button calls its action.
- **Words:** "More actions for {name}".
- **Approved edits to existing tests:** none.
- **Exit check:** `npm run lint`, `npm run typecheck`, `npx vitest run tests/unit/renderer/ui`.

### T3d — Fields

- **Kind:** new parts, and optional props on the number field. The editor's `opacity-field.tsx`, `percent-slider.tsx`, `colour-field.tsx` and `colour-choice/` are not replaced here: ED-2 and ED-3 move them onto these parts.
- **Exists when done:** `ui/slider-field/` and `ui/swatch-field/` as `spec/app-style-parts.md`, "Field"; `editor/number-field/` takes `inline`, `unit` and `prefix`, drawn with `.field.inline` and `.unitBox` from T2, and is unchanged without them.
- **New files:** `src/renderer/ui/slider-field/`, `src/renderer/ui/swatch-field/` (`.tsx`, `.module.css`, `index.ts` each; the swatch popover may be its own file `swatch-popover.tsx`); `tests/unit/renderer/ui/slider-field.test.tsx`, `swatch-field.test.tsx`; `tests/unit/renderer/editor/number-field-inline.test.tsx`.
- **May touch:** `src/renderer/editor/number-field/` (`number-field.tsx`, `number-field.module.css`).
- **Tests first:**
  - SliderField: the range and the number share the label ("{label}", "{label} value"); dragging updates the number without committing; release, Enter in the number, or leaving it commits once; a value outside min and max is held to the bounds; disabled disables both.
  - SwatchField: one button per palette colour, named by its hex, `aria-pressed` on the chosen one; "No colour" first only with `allowNone`; "+" opens the popover with "Hex colour" and the colour picker; a valid hex commits once, an invalid one shows one line under the field and commits nothing; Escape closes the popover and returns focus to "+".
  - Number field inline: with `inline` and `unit` the unit is inside the box and is not part of the input's accessible name; `tabular-nums` on the input; without the new props the markup is as before.
- **Words:** "No colour", "Hex colour".
- **Approved edits to existing tests:** none; `tests/unit/renderer/editor/number-field.test.tsx` and `properties-style.test.tsx` pass unchanged.
- **Exit check:** `npm run lint`, `npm run typecheck`, `npx vitest run tests/unit/renderer/ui tests/unit/renderer/editor`.

### T3e — SubPage, SideList and PanelHead

- **Kind:** new parts. Adds only.
- **Exists when done:** `ui/sub-page/`, `ui/side-list/`, `ui/panel-head/` as `spec/app-style-parts.md` describes.
- **New files:** the three folders; `tests/unit/renderer/ui/sub-page.test.tsx`, `side-list.test.tsx`, `panel-head.test.tsx`.
- **May touch:** nothing else.
- **Tests first:** SubPage: the back button "Back" (or `backLabel`) calls `onBack`, Escape too; focus goes to the title on open. SideList: a `nav` with its label, one button per item, `aria-current="page"` on the current one only, `onChoose` on click; a `mark` adds the dot and the hidden words "needs a look"; `foot` renders after the list. PanelHead: the title at its level; with `onClose`, an icon button whose name and `title` are `closeLabel`. Axe clean for each.
- **Words:** "Back"; "needs a look" (hidden).
- **Approved edits to existing tests:** none.
- **Exit check:** `npm run lint`, `npm run typecheck`, `npx vitest run tests/unit/renderer/ui`.

### T3f — Icons

- **Kind:** icon data. Adds only.
- **Exists when done:** the 29 new names of `spec/app-style.md`, "Icon rules", are in `ui/icon/icon-paths.ts`, each drawn for this app on the 24 by 24 grid in the built set's stroke style (no third-party set copied). The concept table in `spec/app-style.md` is the one list of which icon means what. Nothing is removed.
- **New files:** none (if `icon-paths.ts` would pass 300 lines, the new names go in `icon-paths-more.ts`, merged into `ICON_PATHS` by `icon-paths.ts`; it is static data).
- **May touch:** `src/renderer/ui/icon/icon-paths.ts`, `src/renderer/ui/icon/` (the merge only).
- **Tests first:** `tests/unit/renderer/ui/icon-names.test.ts`: each of the 29 names is in `ICON_NAMES`.
- **Approved edits to existing tests:** `tests/unit/renderer/ui/icon.test.tsx` line 14: `46` becomes `75`. The per-icon checks of that file then cover the new icons.
- **Exit check:** `npm run lint`, `npm run typecheck`, `npx vitest run tests/unit/renderer/ui`.

### T4 — Dialog frame, kinds, DialogAlert and MoneyLine

- **Kind:** optional props on the frame, and new parts. With no new prop, every dialog draws exactly as built.
- **Exists when done:** `DialogFrame` takes `kind?: 'confirm' | 'form' | 'run' | 'publish' | 'review' | 'pick'` (sets the width class as `spec/app-style-parts.md`, "Dialog", says; `size` wins when both are given) and `warning?: string` (drawn in the head with the `alert` icon and used as the accessible description, before any `describedBy`). `describedBy` may hold several ids separated by spaces. `.pickGrid` exists in `dialog-frame.module.css`. `ui/dialog-alert/` and `ui/money-line/` exist.
- **New files:** `src/renderer/ui/dialog-alert/`, `src/renderer/ui/money-line/` (`.tsx`, `.module.css`, `index.ts` each); `tests/unit/renderer/ui/dialog-kind.test.tsx`, `dialog-alert.test.tsx`, `money-line.test.tsx`.
- **May touch:** `src/renderer/ui/dialog-frame/` (`dialog-frame.tsx`, `dialog-frame.module.css`).
- **Tests first:**
  - Kinds: `confirm`, `form`, `run` give the `normal` class; `publish` and `pick` `wide`; `review` `large`; `kind="form" size="wide"` gives `wide`; no `kind` gives what `size` gives (as built).
  - Warning: the line shows in the head with a hidden icon and is the dialog's accessible description; with a `describedBy` too, both are read, the warning first.
  - MoneyLine: draws the `coin` icon and the given words, carries its `id`; a dialog whose `describedBy` is that id has the money words as its accessible description; the arrow form ("Paid: 4 pictures → {Provider}") reads with "to" for a screen reader.
  - DialogAlert: `danger` and `warn` take `role="alert"`; `busy` takes `role="status"` and the spinner; at most one action button.
- **Words:** none of its own; the MoneyLine form "Paid: {n} {things}[ + {m} references] → {Provider}" is the callers' (DLG-4).
- **Approved edits to existing tests:** none; `tests/unit/renderer/ui/dialog-frame.test.tsx` passes unchanged.
- **Exit check:** `npm run lint`, `npm run typecheck`, `npx vitest run tests/unit/renderer`.
- **Security:** short review: the MoneyLine draws only what it is given and sends nothing; the frame's close rules (`closable`) are unchanged.

## Wave 2: screens (headlines)

A second architect details each slice (exists when done, files, tests first, approved edits, exit check, shots, words) before it is briefed. Every slice is markup and, unless marked, wording. Each one adopts the Wave 1 parts for its area, fixes the anti-patterns of its area, and moves its panels to `data-density="compact"` where `spec/app-style-parts.md`, "Panel", says so.

The audit was written before the last third of Round 2 merged. The list below covers the screens as built now: the Assets panel and subject cards, the Generate panel with video, the built-in type styles, the result notice, the first-run setup, the "Paste a brief" dialog, the permission dialog for files, the approval dialog with its progress and Stop, the project switcher with several projects, and the two-half start screen. (Note for the orchestrator: `spec/phases/round-2-editor.md` still lists R2E-9 as in progress, but its video card is gone from the code and `no-video-card.test.tsx` exists.)

### Order rules

- `app/app-shell/`: SH-1, then SH-2, then START-2. `screens/settings/settings-screen/`: SET-1, then SH-2.
- `app/campaign-tabs/`, `ui/tab-row/`, `ui/tab-marks/`: SH-1, then CAMP-3.
- **CAMP-7 merges before SH-4, ED-4, DLG-4 and DLG-7 start** (it moves shared helpers those folders import). It needs no Wave 1 part and may run during Wave 1.
- SH-3 before HOME-1 (Package… reaches the project menu before the page loses its section).
- AST-2 before HOME-3 (the shared photo strip). SET-2 and SET-4 before SET-7.
- ED-1, then ED-2 beside ED-3; ED-3, then ED-4. CAMP-1, then CAMP-2. DLG-1, then DLG-2 to DLG-7 side by side. HOME-1, HOME-2, HOME-3 in order.
- Z-1 is last.

### Slices

| ID | What it does | Owns | After | Beside |
|----|--------------|------|-------|--------|
| **Settings** | | | | |
| SET-1 | Settings becomes a SideList of four pages (AI services, Files, Publish, Agents), each a title and Sections; "Setup" is a quiet button at the list's foot (the Setup card goes) | `screens/settings/settings-screen/`, `screens/settings/setup-section/` | T3a, T3e | other areas |
| SET-2 | AI services page: key rows as ObjectRows with the key StatusMark (click = Replace) and a trash icon; the local server as one prefilled address field with Check and its result in the Section header; workflow rows; Licences and "On the server" folded; Defaults as Segmented. The local server's privacy paragraph stays on the page word for word | `keys-section/`, `key-row/`, `comfy-section/`, `comfy-check-result/`, `licence-list/`, `provider-defaults/`, `ui/secret-labels.ts` | SET-1, T3b, T3c | SET-3, SET-4, SET-5 |
| SET-3 | Files page: the projects folder as an ObjectRow with the path cut in the middle (full path in the tooltip) and Change; Export as Segmented and inline fields with units inside | `location-setting/`, `export-section/` | SET-1, T3d | SET-2, SET-4, SET-5 |
| SET-4 | Publish page: the two storage services and the approvals service as three ObjectRows that fold open to their forms, Test on the closed row, results as StatusMarks; a `StorageRows` part (the two storage rows) the first-run setup can show alone | `s3-section/` (split), `s3-check/`, `dropbox-section/`, `approvals-section/` | SET-1, T3b, T3c | SET-2, SET-3, SET-5 |
| SET-5 | Agents page: the Switch in the Agent access header; Connect folded (a SubPage or folded Section); one Switch per provider with the "Paid" mark; one paid Notice for the Section; "Deletes cannot be undone." kept on the page under the auto-delete Switch | `mcp-section/`, `connect-panel/`, `agent-runs-section/`, `auto-approve-setting/`, `notice-line/` | SET-1, T3b, T3e | SET-2, SET-3, SET-4 |
| SET-6 | The one-value save rule (C-4): "Save port" and "Save folder" go; Enter or leaving saves, with the "Saved" mark (markup only) | the single-value fields in `comfy-section/`, `mcp-section/`, `dropbox-section/`, `export-section/`, `approvals-section/` | SET-2 to SET-5 | other areas |
| SET-7 | First-run setup: the `form` kind; steps reuse the Keys, local server and `StorageRows` Sections, open with no chevron; a one-sentence welcome and a step strip of icons in place of "Step n of 3: …" (wording ruling needed, OI-DW-6) | `app/first-run/` | SET-2, SET-4, DLG-1 | other areas |
| **Editor** | | | | |
| ED-1 | Panel frame and layers panel: PanelHead with type icon, name and lock mark; the Layer section goes (C-3); field groups become Sections (look and placement start folded with summaries); the layer row moves onto ObjectRow with eye and lock always shown (AP-12) and a More menu holding Duplicate and Delete; icon add buttons; compact density on the side panels and the timeline. Approved edit: `layer-list.test.tsx`, "rows keep one height", reads `ui/object-row/object-row.module.css` | `editor/properties-panel/`, `editor/layer-fields/`, `editor/layer-row/`, `editor/layer-list/` | T3a, T3c, T3e | other areas |
| ED-2 | Text layer: icon alignment segments, vertical alignment in the Type Section, SwatchField for colours, an "AA" upper-case toggle, the weight hint in an InfoTip, the translation state as a StatusMark with Approve inside, a sparkle icon for Suggest copy; the five built-in type styles as a row of visual chips, each drawn in its own style, its name in the tooltip | `editor/text-fields/`, `editor/text-box-fields/`, `editor/font-field/`, `editor/language-font/`, `editor/translation-status/`, `editor/type-styles/` | ED-1, T3d, T3f | ED-3 |
| ED-3 | Picture and background layer: the picture at full width with an icon bar (Choose, Crop, Reset, Cut out; Fit and Fill on the bar), SliderFields for opacity and shade, shade side as icon segments, SwatchField for the background colour, EmptyState when there is no picture, the cut-out running ring on the picture | `editor/picture-fields/`, `editor/shade-fields/`, `editor/background-colour-field/`, `editor/colour-choice/` | ED-1, T3d, T3f | ED-2 |
| ED-4 | Generate panel: Picture / Video as one Segmented; the lines that say where videos are made become a disabled segment with its reason (AP-13); start choices as tiles; the reference strip; run state on the option tiles (AP-10) in place of the status sentence; Earlier options folded with a summary and icon run rows. Prompt and references only here (C-17); results land as today (C-18) | `editor/generate-panel/`, `editor/generate-fields/`, `editor/earlier-options/`, `editor/clip-preview/` | ED-3, CAMP-7 | other areas |
| ED-5 | Header: one-line top bar at 1280px (title edited in place, Master mark, size chip, format Segmented, icon buttons for Place text, Layout, Undo, Redo); the banner's overflow sentence becomes marks; the canvas footer | `editor/top-bar/`, `editor/format-fields/`, `editor/editor-banner/`, `editor/layout-button/`, `editor/canvas-view/` (footer only) | T3b, T3f | other areas |
| ED-6 | Timeline small flaws: Play as an icon; clip labels without "Clip n:"; clip actions on the selected block; animation In and Out as rows (markup) | `editor/transport-bar/`, `editor/clip-block/`, `editor/clip-track/`, `editor/sound-fields/`, `editor/animation-fields/` | T3f | other areas |
| **Shell** | | | | |
| SH-1 | Top bar: Activity and Settings as icon buttons; the running count in the spot colour, not amber (AP-14); the "Project" tab as a home icon; tab marks as a spinner without the word; the error banner closes with ✕ | `app/app-shell/`, `app/activity-button/`, `app/campaign-tabs/`, `ui/tab-row/`, `ui/tab-marks/`, `app/error-banner/` | T3b, T3f | SH-3, SH-4, SH-5 |
| SH-2 | Settings exit (C-14): the button toggles; Escape and ✕ leave; the campaign tabs stay drawn; the last view comes back (markup) | `app/app-shell/`, `stores/app-store.ts`, `screens/settings/settings-screen/` | SH-1, SET-1 | not SET-2 to SET-6 if they touch the screen frame |
| SH-3 | Project menu with several projects: the switcher shows a count chip ("2", tooltip "2 projects open") in place of " · 2 open"; the menu holds an ObjectRow per open project (file icon, name, spinner when it has runs, ✕ "Close {name}"), then Package…, Open…, Start screen | `app/project-switcher/` (not `close-project.tsx`), `screens/project-home/package-project/` | T3c | SH-1, SH-4 |
| SH-4 | Activity panel: PanelHead with ✕; "Running" and "Finished" Sections with counts; two-line ObjectRows (kind icon, where; what, who and time) with the status mark, the unseen dot and one action icon; a click on the row goes there; EmptyState; compact density (markup) | `app/activity-panel/`, `app/activity-row/` | T3b, T3c, T3e, CAMP-7 | SH-1, SH-3 |
| SH-5 | One close question for a tab, a variant tab and a project: `confirm` kind, one set of words ("Keep open", "Stop and close"), the charge lines kept | `ui/close-warning/`, `app/project-switcher/close-project.tsx` | T4 | not beside SH-3 |
| SH-6 | Result notice and agent line: the result notice as a one-line info Notice with "Show" and a ✕; the agent activity line as a StatusMark (agent icon, tool, project) | `app/result-notice/`, `app/agent-activity/` | T3b | other areas |
| **Start** | | | | |
| START-2 | The rest of the start screen: "New project" swaps in place for one row (name field with placeholder "Project name", a folder icon button whose tooltip says where it will be saved and which changes it, "Create"); "Open…" in place of "Open project…"; no path printed on the page; with no recent project the Recent part is left out; no top bar on the start screen (C-6) with Activity and Settings as icon buttons in the right half's top right corner. (The unused drawing tokens already went in T1.) | `screens/start/*`, `app/app-shell/` | SH-1, SH-2 | other areas |
| **Project home and New campaign** | | | | |
| HOME-1 | Project home: two Sections (Campaigns, Files) with no cards; campaign tiles as buttons with marks and a "+" tile; missing files as a StatusMark; the project path in a tooltip; the Assets line becomes an InfoTip and a "›"; the page's Close button and Package section go (both in the project menu) | `screens/project-home/project-home/`, `campaign-list/`, `missing-files/`, `import-files/`, `drop-import/` | T3a, T3b, SH-3 | other areas |
| HOME-2 | New campaign page (C-13): the brief form opens as a SubPage with a back arrow, a title and a fixed foot holding Create; "Load a brief" and "Paste a brief" lead to it (markup) | `screens/project-home/brief-load/`, `screens/project-home/brief-form/` (frame only) | HOME-1, T3e | other areas |
| HOME-3 | Brief form fields: sizes as drawn shape chips with ★ for the master; language chips with ★ for the main one; subjects with the shared photo strip and notes folded; Rules folded with a summary; help in placeholders and InfoTips; each problem under its field. May be split by folder | `brief-form/`, `size-fields/`, `subject-rows/`, `subject-photos/`, `rule-fields/`, `brief-form-problems.ts` | HOME-2, T3d, AST-2 | other areas |
| **Assets** | | | | |
| AST-1 | Assets panel: PanelHead with ✕ (same as Activity); an Import split button and "+ Subject"; groups as Sections with counts; pictures as a grid of thumbnails, clips, fonts and other files as ObjectRows; icon marks (made with AI, linked, reference only, file not found); a picture's subject as a small avatar menu; compact density | `screens/assets/assets-panel/`, `asset-row/`, `assets-button/`, `assets-scope/` | T3a, T3b, T3c, T3e | AST-2 |
| AST-2 | Subject cards: name, ✎, description muted, a photo strip with ✕ on each photo and a dashed "+" tile (a new shared `ui/photo-strip/` that HOME-3 reuses); "No photos yet" becomes the dashed tile with an amber edge | `screens/assets/subject-card/`, new `ui/photo-strip/` | T3c, T3f | AST-1 |
| **Campaign page** | | | | |
| CAMP-1 | One mark set on tiles (C-11): the picture, a ★ corner for the master, a video corner, a strip of icon marks (out of date, check, translation, approval, running, new), each with a tooltip that leads to its fix; title and size into the tooltip | `screens/campaign/variant-tile/`, `approval-mark/`, `direction-grids/` (click targets), `ui/signoff-list/` | T3b, T3f | CAMP-3 to CAMP-6 |
| CAMP-2 | Tile and direction actions: tile actions in one More menu; the direction header one line with a count chip, Sync shown only when something is out of date, ⋯ for rename and delete; the direction dialogs on their kinds | `variant-grid/`, `direction-header/`, `direction-grids/` (sync), `dialogs/direction-menu/` | CAMP-1, T3c, DLG-1 | CAMP-3 to CAMP-6 |
| CAMP-3 | Header and one tab strip (C-10): name, the approval StatusMark with a refresh icon, the paid count as a mark, Undo and Redo icons, Export as a split button with Reports, Publish as the one primary, Assets as an icon; Variants, Checks, Translations and the open variants in one strip | `campaign-head/`, `campaign-overview/`, `approval-bar/`, `campaign-export/`, `publish-button/`, `campaign-undo/`, `variant-tabs/`, `app/campaign-tabs/` | SH-1, T3b, DLG-4 (for the paid count) | CAMP-1, CAMP-4 to CAMP-6 |
| CAMP-4 | Checks tab: a table of posts by checks, one mark per cell, findings folding out under the row; two summary marks in the header; Rules as a folded Section with swatch chips and a language Segmented; no cards | `check-panel/`, `rule-set-panel/` | T3a, T3b, T3d | CAMP-1 to CAMP-3, CAMP-5, CAMP-6 |
| CAMP-5 | Translations tab: column heads once; a click on the Proposed mark approves; the "use for every post" choice as a link icon toggle; a progress bar while a job runs; export as an icon | `translation-panel/` | T3b, T3f | CAMP-1 to CAMP-4, CAMP-6 |
| CAMP-6 | Reports: ObjectRows per export (file icon, name, time, ✓ and failed counts), the folder's name in the tooltip, a click opens the report; EmptyState "No exports yet" with "Export…" | `report-list/` | T3c | CAMP-1 to CAMP-5 |
| CAMP-7 | The old panels leave the campaign page (C-12). Detailed below | see below | none (may run during Wave 1) | Wave 1; not beside SH-4, ED-4, DLG-4, DLG-7 |
| **Dialogs** | | | | |
| DLG-1 | One plural helper (`ui/plural.ts`) for real plurals in place of "(s)" (as built: visible words use real plurals through `ui/plural.ts`, no "(s)" is left, and the topic files' wording rule asks for real plurals), and the long-job pattern (progress bar plus "Run in background" or "Stop") as `ui/job-progress/` (adds only) | `ui/plural.ts`, new `ui/job-progress/` | T4 | Wave 2 slices outside dialogs |
| DLG-2 | Confirms on the `confirm` kind: delete variant, licence dialog, the permission dialog for deletes and for files. The permission dialog's words, path list, consequence line, time line, Refuse-first focus and 750 ms wait are unchanged; only the frame kind and the foot order change | `dialogs/delete-variant/`, `dialogs/licence-dialog/`, `app/permission-dialog/` | DLG-1 | DLG-3 to DLG-7 |
| DLG-3 | Forms on the `form` kind: key, address, import (with its "Show in assets"), brief reading, subject dialog, and "Paste a brief" (a text area with the placeholder "JSON, YAML or Markdown", foot "Empty form" quiet, "Cancel", "Read brief" primary; a refusal as a DialogAlert); help in InfoTips and placeholders; Segmented and grids for choices | `dialogs/key-dialog/`, `address-dialog/`, `import-dialog/`, `brief-reading-dialog/`, `subject-dialog/`, `screens/project-home/brief-paste/` | DLG-1 | DLG-2, DLG-4 to DLG-7 |
| DLG-4 | Runs (C-15): the run dialog's provider as Segmented with disabled reasons in tooltips, the paid count above the cost line, the cost line as a MoneyLine directly above the buttons and in `aria-describedby`; fan-out's fit choices as small pictures and its paid lines as MoneyLines, linked the same way; copy options draws its run setup inline (no dialog inside a dialog); the two-step line (`ui/paid-confirm/`) takes the MoneyLine look and keeps Confirm | `dialogs/run-dialog/`, `dialogs/fan-out/`, `dialogs/copy-options-dialog/`, `ui/paid-count/`, `ui/paid-confirm/` | DLG-1, CAMP-7 | DLG-2, DLG-3, DLG-5 to DLG-7 |
| DLG-5 | Pick dialogs (C-16): layout, reference pictures, picture chooser on the `pick` kind; grids without captions, names in tooltips; hint lines into InfoTips; the reference limit is 8 pictures (`MAX_REFERENCES_PER_RUN`) | `dialogs/layout-dialog/`, `dialogs/reference-dialog/`, `dialogs/picture-chooser/`, `ui/reference-picker/` | DLG-1, T3f | DLG-2 to DLG-4, DLG-6, DLG-7 |
| DLG-6 | Publish and export: destinations and files as ObjectRows with StatusMarks, no temporary paths (as built, A-218 stands: the publish dialog still draws each file's full local path as plain text under its row); progress as a bar with "Run in background"; the approval dialog's actions in the foot, its link row's More menu (new password, turn off), its "Update gallery" progress with Stop as built, the end-link confirm on the `confirm` kind | `dialogs/export-dialog/`, `dialogs/publish-dialog/`, `dialogs/package-dialog/`, `dialogs/approval-dialog/`, `ui/publish-file-list/` | DLG-1, T3c | DLG-2 to DLG-5, DLG-7 |
| DLG-7 | Review dialogs: two panes, the list left and the picked item right (sync review shows master and variant side by side; the report shows the ad's picture); icon buttons for previous and next; the Translate two-step line kept (C-15) (markup) | `dialogs/sync-review/`, `dialogs/report-view/`, `dialogs/relink-dialog/`, `dialogs/quick-look/` | DLG-1, T3c, CAMP-7 | DLG-2 to DLG-6 |
| **Clean-up** | | | | |
| Z-1 | Remove what nothing uses any more: `--font-size-*` aliases unused in both `src/renderer/` and `approvals-service/src/`, `.iconOnly` and any `layout.module.css` class no file uses, the `description` prop of `DialogFrame` once no dialog passes it; with the approved edits to the style tests that name them | `ui/tokens.css` (and its copy), `ui/layout.module.css`, `ui/dialog-frame/` | every other slice | nothing |

### CAMP-7 — The old panels leave the campaign page

- **Exists when done:** the campaign page's Variants tab holds the direction grids only. The selection line ("Runs and panels below are for: …"), the slot view, "Make pictures" and the "Runs" list are gone. Pictures and videos are made only in the editor's Generate panel; runs are followed in Activity, on the tile's running mark and in Earlier options; the result notice says where a result went. No feature is lost: a run can still be started (Generate panel), followed (Activity, Earlier options), retried and cancelled (Activity, Earlier options). FR-042 (each slot shown as filled or empty) is then met by the editor, where an empty picture layer shows "Empty picture" (open item OI-DW-5 asks the stakeholder to confirm).
- **Moves, not removals** (code other folders still import): `screens/campaign/paid-confirm/` to `ui/paid-confirm/` (row retry, sync review, run summary use it); `workingDetail` from `run-row/run-row.tsx` and `run-row/video-status.ts` to `ui/run-status/` (activity row and the editor's run status use them); `video-start.ts` and `video-picture-choice/` to `editor/generate-panel/` (the run dialog's provider choice and the panel use them). `provider-select/` stays (fan-out uses it). Each importer changes its import path only.
- **Removed:** `screens/campaign/generate-panel/`, `slot-view/`, `run-list/`, `run-row/`, `run-result/`, `video-result/`, and their mounts in `variants-tab/`.
- **Tests first:** `tests/unit/renderer/screens/campaign/no-old-panels.test.tsx`: the Variants tab has no "Make pictures" region, no "Runs" list, no "Slots" region and no selection line. Before any deletion, the "one run per click" rule (`spec/screens.md`) must be held by tests on the editor path: confirm that `tests/unit/renderer/dialogs/run-dialog.test.tsx` and the editor's generate tests disable the confirm button from the click until the reply for a picture and a video run, and for Retry from Earlier options and from Activity; add the missing cases as new tests in `tests/unit/renderer/editor/`.
- **Approved edits to existing tests** (the second architect checks each against the code before briefing):
  - Delete the campaign tests of what leaves: `generate-panel.test.tsx`, `generate-panel-click.test.tsx`, `generate-panel-words.test.tsx`, `slot-view.test.tsx`, `run-row.test.tsx`, `run-row-click.test.tsx`, `run-row-retry-count.test.tsx`, `run-row-show.test.tsx`, `run-result.test.tsx`, `video-row.test.tsx`, `video-result.test.tsx`, `reference-ticks.test.tsx`, `reference-pre-tick.test.tsx`, `reference-limit.test.tsx`, `run-panels-style.test.tsx`, and `no-video-card.test.tsx` (it asserts "Make pictures" is still there; the new test replaces it). Cases that still describe a kept behaviour (the retry count rule FN-4, the video status words) move to tests of `ui/run-status/` and the activity row, word for word.
  - `trial-mark.test.tsx`, `campaign-view.test.tsx`: drop the cases of the removed panels; the read counts lose the panels' reads.
  - Import paths only: tests that import `paid-confirm`, `video-start`, `video-picture-choice` or `video-status` from their old place.
  - `tests/e2e/screens.ts`: `picturePanel` and its helpers (provider, ticks, prompt, slot, Generate) drive the editor's Generate panel and the run dialog, as R2E-9 did for video; the "Runs" list helper reads Activity rows. `tests/e2e/comfy-stand-in.spec.ts` (the panel and run row steps), `screen-tour.ts`, `workflow-5-1-steps.ts`, `workflow-5-8-steps.ts` follow the helpers and keep what they check. `tests/e2e-real/` follows the helpers (no real run is made). The harness case in `spec/test-harnesses.md` that opens the paid confirm and presses Cancel uses the run dialog's Cancel.
  - Shots `st-9`, `p4-13`, `r2c-3`, `r2e-5`, `r2e-6`: drop or repoint the pictures of the removed panels, keeping their names for what remains.
- **Spec pass after:** `spec/screens.md` "Make pictures", "Run list and run row", the "one run per click" test names, `spec/screens-campaign.md` "The slot view", `spec/screens-variants.md` "Variants tab" (orchestrator).
- **Exit check:** lint, typecheck, `npx vitest run tests/unit/renderer`, `npm run test:e2e` (the whole e2e suite: this slice moves many of its paths).
- **Security:** short review: no paid call can start without the user's click with the cost on screen (C-15) on every path that remains; one run per click holds.

### Wording sources for the Wave 2 architect

The audit holds before-and-after wording tables for most Wave 2 slices. Developers do not read them; the Wave 2 architect carries the "after" words into each slice's entry: Settings in `design/audit/areas/settings.md` §4.1 to §4.6 and §6; editor panels in `editor-panels.md` §5.3 to §5.7 and §7; shell, project home and the brief form in `shell-start-home.md` §4.1 to §4.6 and §6; campaign page and Assets in `campaign.md` §4 and §6; dialogs in `dialogs.md` §6 (table); the start screen in `design/audit/spec-start.md`. Each area file's §5 holds the word counts to beat.

### Words on screen to beat

| Screen | Before | Target |
|--------|--------|--------|
| Settings, whole page | 517 | 147 |
| Brief form (one subject, two languages) | 212 | 41 |
| Campaign header and Variants grid | 106 | 22 |
| Campaign Translations tab | 101 | 21 |
| Campaign Checks tab | 101 | 41 |
| Properties panel, text layer on a video post | 93 | 15 |
| Properties panel, background after a run | 79 | 14 |
| Project home | 41 | 10 |
| Start screen | 22 and three printed paths | 9 |
| Layout, fan-out, publish, package and sync review dialogs together | 375 | 103 |
| Run dialog | 45 | 20 |

## Open items, with the choice taken for now

The stakeholder asked for the wave to be built without waiting on him. Each item below has a choice taken by the orchestrator so no slice is blocked. They are listed for him in `spec/phases/design-wave-verify.md`; any of them can be turned round later.

| # | Taken for now |
|---|---------------|
| OI-DW-1 | **Yes** to the new marks that use data the app already has. |
| OI-DW-2 | **No new data in this wave.** A mark that needs data the app does not keep today is left out: no "never checked" mark (a tile with no check run shows no check mark), no kept connection-test result (the result shows until the page is left), brief problems stay in one list at the foot of the form (each names its field). The warning count keeps today's meaning. |
| OI-DW-3 | **The title stays on a tile only when titles differ within its direction;** when they are all the same it moves to the tooltip. |
| OI-DW-4 | **The agent access token is folded away and drawn masked,** with "Show" and "Copy" beside it. Nothing else about the token changes. |
| OI-DW-5 | **Yes:** the layers panel's row and the picture layer's empty state show each slot as filled or empty. |
| OI-DW-6 | **Yes:** one welcome sentence and an icon step strip. |
| OI-DW-7 | **Yes:** the paid count shows as a short mark with the full sentence in its tooltip; the counts stay on the page. |
| OI-DW-8 | **The privacy paragraph stays on the page word for word.** |
| OI-DW-9 | Out of this wave. |

### The items as first written

| # | Item | Blocks |
|---|------|--------|
| OI-DW-1 | **New marks on existing data:** a "needs a look" dot on a settings page; running and new marks on campaign tiles; a "Needs storage" mark on the approvals row. Approve or drop | SET-1, SET-4, CAMP-1 |
| OI-DW-2 | **Data the marks need:** a field key per brief problem (for "each problem under its field"); "never checked" versus "passed" on a tile; one meaning of the warning count; keeping the last connection test result | HOME-3, CAMP-1, CAMP-4, SET-4 |
| OI-DW-3 | **Tile titles (C-11):** are titles the same within a direction? If not, the title stays on the tile | CAMP-1 |
| OI-DW-4 | **The agent access token** is printed in full in the Connect part. This plan folds it away; masking it is a separate choice | SET-5 |
| OI-DW-5 | **FR-042 after the slot view goes:** is the editor's "Empty picture" enough to show each slot as filled or empty? | CAMP-7 |
| OI-DW-6 | **First-run words:** the setup's 33-word welcome and "Step n of 3: …" headings are spec words; this plan wants one sentence and an icon step strip | SET-7 |
| OI-DW-7 | **The campaign's paid count (FR-230):** may it show as a short mark ("Paid so far: 3 pictures, 1 video"), with the full sentence in the tooltip? The counts stay on the page either way | CAMP-3, DLG-4 |
| OI-DW-8 | **The local image server's privacy paragraph** (`ui/comfy-privacy.ts`) stays on the page word for word under this plan's security rule and its requirement (section 3.3). The audit asked to show one short line and move the paragraph into an InfoTip; that needs the requirement owner's yes | SET-2 |
| OI-DW-9 | **The fake provider** is listed in the run dialog, fan-out and publish. Hiding it outside test builds is a behaviour change, not part of this wave | none |

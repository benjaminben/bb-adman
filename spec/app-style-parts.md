# App style: the shared parts

**Status:** partly built. Built (ST-2, ST-4): the button classes `primary`, `quiet`, `danger`, `small`, `large`, `iconOnly`, `link`; the field classes; Switch; Segmented; Badge; Chip; Notice; Card; Menu; Table; Progress bar; Empty place; the tab row; the dialog frame with `size` and `footer`. Every part marked **new** is built in Wave 1 of the design wave (`spec/phases/design-wave.md`, slice named beside it). Screens adopt the parts in Wave 2, one slice per area.

**Read with:** `spec/app-style.md` ("The design system", "The token set", "Icons"). This file holds the rules for each shared part; `app-style.md` holds the tokens, the text rule and the icons.

## Rules for every part

- Each part lives in `src/renderer/ui/`: a folder with its `.tsx`, its `.module.css` and `index.ts`, or a class in `ui/layout.module.css` where this file says so.
- Every value comes from `src/renderer/ui/tokens.css`. No part sets its own size per screen: it reads the tokens, and the density attribute (`app-style.md`, "Density") changes them.
- A tooltip is the native `title` attribute, as on the layer row today. No tooltip component, no new package.
- Every icon inside a part is `aria-hidden="true"` and `focusable="false"` (the icon component already does this). An icon-only button always has an `aria-label` and the same words in its `title`.
- Every part keeps 4.5:1 for words and 3:1 for marks, edges and focus; visible focus is the outline of `base.css`; anything that moves stops under `prefers-reduced-motion: reduce`.
- A part never carries security text of its own. Money, lost work, data leaving the machine, what an agent asks to do, and failures are passed in by the screen and drawn on the page (never only in a `title`).

## Button

Every `button` looks like `secondary` unless it carries a kind class. Classes live in `ui/layout.module.css`.

| Kind | Class | Look | Rule |
|------|-------|------|------|
| primary | `.primary` (built) | ground `--color-accent`, text `--color-accent-text`, hover `--color-accent-hover` | One per view: a screen, a dialog, or a Section of a panel. The thing the user most likely wants |
| secondary | none, or `.secondary` (new, T2: the same rules as the default `button`, so a caller can name it) | ground `--color-bg`, edge `--color-control-border`, hover ground `--color-surface-soft` | The default |
| quiet | `.quiet` (built) | no edge, no ground; hover `--color-row-hover` | Actions inside rows and toolbars; every Cancel |
| icon | `.iconButton` (new, T2) | square, `--control-height-small` both ways, quiet, icon at `--icon-size`, hover `--color-row-hover`; when `aria-pressed="true"` the icon takes `--color-accent-ink` | Row actions and toolbars. `aria-label` and `title` always |
| danger | `.danger` (built) | text `--color-danger-text` on the secondary look | Removing things |
| danger action | `.primary.danger` (new, T2) | ground `--color-danger-text`, text `--color-accent-text` | Only the action button of a `confirm` dialog that deletes |

Sizes: `.small` (`--control-height-small`, `--type-meta-size`) and `.large` (`--control-height-large`, `--font-size-body`; the start screen's two buttons only). `.iconOnly` stays as built until the clean-up slice Z-1; new code uses `.iconButton`.

Rules:

- A label is one or two words, verb first: "Save", "Add key", "Generate". "…" ends a label only when the click opens a dialog that asks for more.
- **Fields that hold one value save on Enter or when focus leaves them** (choice C-4), with the "Saved" StatusMark for 2 seconds. There is no Save button beside such a field. Exceptions keep one Save per Section: a form whose values save together (the storage service form), a key (Save and Cancel, as today), and a field whose save contacts an outside service.
- Action order is fixed across the app: the actions used most, left to right; the More menu last. A destructive action is in the More menu or at the far end, never between two others.
- A disabled control's `title` says what is missing ("Add a key first"). A disabled control with no reason is a bug (AP-13).

## Field

- **Stacked** (`.field`, built): label above in `--type-meta-size`, `--weight-medium`, `--color-text-secondary`; the control full width. For text areas, prompts and anything long.
- **Inline** (`.field.inline`, new, T2): one grid row, `grid-template-columns: var(--field-label-width) 1fr`, gap `--gap-inline`, items centred; label in `--type-meta-size`. For short values in panels and settings. Two inline fields may share a row (X and Y, W and H): put both in one `.row`.
- **Unit inside** (`.unitBox` with `.unit`, new, T2): a wrapper drawn as one field (edge `--color-control-border`, `--radius`, height `--control-height`, ground `--color-bg`) holding an `input` with no edge of its own and a `.unit` span in `--type-meta-size`, `--color-text-muted`. The unit sits at the right end; a `.unit` placed before the input is a prefix ("X", "W"). `.unitBox:focus-within` draws the focus outline in `--color-focus`, `--focus-ring-width`, `--focus-ring-offset`. The `input` keeps its own label; the unit is text, not part of the label.
- **Number field** (`editor/number-field/`, built): gains three optional props in T3d, `inline?: boolean`, `unit?: string`, `prefix?: string`, drawn with `.field.inline` and `.unitBox`. Without them it is as built. Numbers in fields, counts and the clock use `font-variant-numeric: tabular-nums`.
- **Slider field** (new, T3d, `ui/slider-field/`): a range input and a small number field at its end, on one row. Props: `label`, `value`, `min`, `max`, `step`, `unit?`, `disabled?`, `onCommit(value)`. Dragging updates the number; the value is committed on release of the pointer, on Enter in the number, or when focus leaves the number. One label names both controls ("{label}" on the range, "{label} value" on the number).
- **Swatch field** (new, T3d, `ui/swatch-field/`): one row of round swatches, each `--control-height-small` wide and tall, edge `--color-control-border`, the chosen one ringed like a focus outline. Props: `label`, `value: string | null`, `palette: string[]`, `allowNone?: boolean`, `disabled?`, `onCommit(value)`. With `allowNone`, a "⊘" swatch first (`aria-label` "No colour"). A "+" swatch last opens a small popover (elevation 2, placed by `ui/menu-place`) holding a hex field (`aria-label` "Hex colour", value shown as `#rrggbb`) and the system colour picker (`input type="color"`). Each swatch is a button with `aria-label` "{hex}" or the palette name, `aria-pressed` when chosen. There is no separate hex field outside the popover.
- **Segmented** (`.seg`, built): two to four choices. Where the choice is visual (text alignment, shade side), each segment is an icon with `aria-label` and `title`. Five or more choices: a `select`.
- **Switch** (`.switch`, built): on/off at the right end of the row whose label says what it turns on, in two to four words. A lone checkbox with a sentence becomes a Switch plus an InfoTip, unless the sentence is security text (then it stays on the page under the Switch).
- **One choice only** (a job with one provider): the value as plain text, no control.
- **Help and errors.** A field's help goes in an InfoTip beside the label or in the placeholder (an example value, `eu-west-1`). A field's error is one line under it in `--color-danger-text`, and keeps what the user typed.

## Section (new, T3a)

The one way to title and group things in a panel, a settings page or a dialog. It replaces cards around groups and bare `h2`/`h3` group titles. Folder `ui/section/` (`section.tsx`, `section.module.css`, `fold-memory.ts`, `index.ts`).

```
  Cloud storage  (i)                     ● Connected   ⌄
  ─────────────────────────────────────────────────────
  (fields when open)
```

Props:

| Prop | Type | Meaning |
|------|------|---------|
| `id` | `string` | Key for the fold memory, unique in the app: `'{screen}.{section}'`, for example `'settings.keys'` |
| `title` | `string` | One to three words |
| `level` | `2 \| 3 \| 4`, default `3` | Heading level |
| `summary` | `ReactNode`, optional | A short text or a StatusMark, on the right of the header |
| `info` | `ReactNode`, optional | An `<InfoTip>`, right after the title |
| `fold` | `'open' \| 'closed' \| 'none'`, default `'open'` | How it starts the first time this session; `'none'` never folds |
| `onOpenPage` | `() => void`, optional | The Section leads to a SubPage: the header shows "›" and opens it; no fold |

Markup and behaviour:

- `<section aria-labelledby={headingId}>`. The header row is `--section-header-height` tall. The heading element (`h{level}`) holds the title. With a fold, the heading holds a `button type="button"` with `aria-expanded` and `aria-controls={bodyId}`, named by the title. With `onOpenPage`, the heading holds a button named by the title, with the `right` icon at its end and no `aria-expanded`. With `fold="none"`, the heading holds the title as text.
- The fold button covers the whole header row and draws the `down` chevron at the row's right end (turned a quarter to the right while closed, in `--motion-fast`). The InfoTip and the summary sit on top of the button, between the title and the chevron, and are their own tab stops after it. A summary that is plain text takes no pointer events, so a click on it folds.
- The body is `<div id={bodyId} hidden={!open}>`, with `--gap-field` between fields and `--gap-section` after it.
- **Fold memory** (choice C-8): `fold-memory.ts` holds one in-memory `Map<string, boolean>` for the window's life. A Section reads it on mount (falling back to `fold`) and writes it on each toggle. Nothing is saved to disk or to the project.
- Which state to start in is the screen's call: open when the Section needs action, closed when it is set up and fine.
- Look: no box, no ground, no shadow, no radius. One hairline, `--border-width` solid `--color-line`, under the whole Section. Title in `--font-body`, `--type-section-size`, `--type-section-weight`, `--color-text-secondary`, never capitals.
- A Section carries no sentence of its own (the text rule).

## Panel and PanelHead

- A side panel is a header row, then Sections. No other boxes. Width tokens stay as built (`--editor-layers-width`, `--editor-props-width`, `--activity-width`); a panel's content gets shorter, never wider.
- **Density:** these roots carry `data-density="compact"`: the editor's layers panel, properties panel and timeline, the Assets panel, the Activity panel. Screens and dialogs stay regular.
- **PanelHead** (new, T3e, `ui/panel-head/`): one row at `--row-height`, padding `0 var(--pad-panel)`, bottom hairline `--color-line`. Props: `title: string`, `icon?: IconName` (the object's kind), `level?: 2 | 3` (default 2), `onClose?: () => void`, `closeLabel?: string`. Title in `--font-body`, `--type-body-size`, `--weight-bold` (a panel head is an operating label, not a page title). With `onClose`, a ✕ `.iconButton` (icon `x`) at the right end whose `aria-label` and `title` are `closeLabel`; the caller passes the name the screen already uses ("Close activity", "Close assets").

## ObjectRow (new, T3c)

The layer-row pattern, made shared, for every list item. Folder `ui/object-row/`. Its CSS starts as a copy of `editor/layer-row/layer-row.module.css` (the box, the one fixed height, the actions laid over the right end). The layer row itself moves onto it in Wave 2 (ED-1), not in T3c.

```
 [thumb] Name of the thing           ● mark   👁  🔒  ⋯
```

Props:

| Prop | Type | Meaning |
|------|------|---------|
| `name` | `ReactNode` | The user's own name for the thing (text, or the rename field) |
| `label` | `string` | Accessible name of the row's main button |
| `thumb` | `ReactNode`, optional | A thumbnail at `--layer-thumb` or an `<Icon>` |
| `meta` | `ReactNode`, optional | A second line in `--type-meta-size`, `--color-text-muted` |
| `marks` | `ReactNode`, optional | StatusMarks |
| `stateActions` | `ReactNode`, optional | Buttons that are also state (eye, lock, a Switch, approved). Always shown; in their default state drawn in `--color-text-muted` |
| `actions` | `ReactNode`, optional | Other row actions. Shown on hover, on focus inside the row, and while selected |
| `more` | `ReactNode`, optional | A `<MoreMenu>`. Always shown |
| `selected` | `boolean` | The selected look only; the caller sets the ARIA state it needs on the main button through `mainProps` |
| `muted` | `boolean` | A hidden thing: name struck through, row at `--opacity-disabled` except its actions |
| `title` | `string`, optional | The tooltip, for example a full path that the row does not print |
| `onSelect`, `onOpen` | optional | Click; double-click or Enter |
| `mainProps` | optional | Extra attributes for the main button (`aria-current`, `aria-pressed`, `aria-describedby`) |

Rules:

- One line at `--row-height`; a row with `meta` has a minimum height of `--row-height` and grows to two lines. The actions lie over the right end, so showing them never changes the row's height.
- Padding `0 var(--space-2)`, `--radius`, gap `--gap-inline` (marks `--gap-tight`); thumbnail on `--canvas-backdrop` with `--radius-inner`; the name ends in an ellipsis when it does not fit.
- Hover `--color-row-hover`. Selected: ground `--color-selected-bg`, name `--color-accent-ink` at `--weight-bold`.
- The order of actions is fixed inside one list. Destructive actions live in the More menu.
- Used by (Wave 2): layer rows, key rows, provider and workflow rows, storage rows, the campaign list, recent projects, the project menu, activity rows, report rows, asset rows, licence rows, sign-off rows.

**MoreMenu** (new, T3c, `ui/more-menu/`): a `.iconButton` with the `more` icon and an `aria-label` and `title` "More actions for {name}", `aria-haspopup="menu"`, `aria-expanded`. The menu is the shared `.menu`, placed by `ui/menu-place` so it stays in the window and, inside a dialog, in the dialog's body (the smallest box around its button that cuts its content off); `role="menu"`, items `role="menuitem"`, arrow keys move, Escape closes and returns focus to the button. Props: `label: string`, `items: { id, label, icon?, danger?, disabled?, reason?, onChoose }[]`. A separator comes before the first `danger` item; danger items are last, in `--color-danger-text`. A disabled item shows its `reason` in `title`.

**EmptyState** (new, T3c, `ui/empty-state/`): the `.empty` look (dashed edge, `--radius-md`), an icon, at most five words, one button. Props: `icon: IconName`, `words: string`, `action?: { label, onClick, primary? }`. Example: "No campaigns yet" with "New campaign". An empty list shows the one action that fills it (no dead ends), unless that action already sits beside it (the Checks tab's "Run checks", the project home's brief buttons) or nothing can fill it (a one-language campaign's Translations).

## Tabs (built, `ui/tab-row/`)

- One tab part for every tab strip. The current tab has an underline in the spot colour (`--indicator-width` for campaign and variant tabs, `--indicator-width-thin` inside a page); no box.
- A tab may carry one mark: a spinner while running (tooltip "Running"), an accent dot for an unseen result (tooltip "New result"), or a count of problems. No other words on a tab beyond its name.

## StatusMark (new, T3b)

A dot or an icon plus at most two words or a short value. It replaces badges with long words, status sentences and unlabelled dots. Folder `ui/status-mark/`.

Props: `tone: 'none' | 'ok' | 'warn' | 'danger' | 'info' | 'accent' | 'running'`, `label?: string`, `tip: string`, `icon?: IconName`, `onClick?: () => void`.

| Tone | Mark colour | Means |
|------|-------------|-------|
| `none` | `--color-text-muted` | Not set, or off |
| `ok` | `--color-ok` | Ready, saved, passed |
| `warn` | `--color-warn` | Needs a look; money |
| `danger` | `--color-danger` | Broken, failed |
| `info` | `--color-info` | A neutral fact |
| `accent` | `--color-accent` | New, open now |
| `running` | `--color-accent` | Working; draws the `spinner` icon turning at `--motion-spin`, still under reduce motion |

- Look: inline, gap `--gap-tight`. The dot is a circle of `--mark-dot`; an icon is `--mark-icon`. The label is `--type-meta-size`, `--color-text-secondary`, `tabular-nums`. A mark with no label must have an icon (colour is never alone).
- Not clickable: a `span` with `title={tip}`; when the tip says more than the label, a visually hidden copy of the tip follows the label so a screen reader hears it.
- Clickable (`onClick`): a `.quiet` button at `--control-height-small` holding the mark, with `title={tip}` and the tip as its accessible name. The tip begins with the visible words, so the name matches what is seen.
- One meaning on every screen. The standard marks:

| State | Tone, mark | Label | Tip |
|-------|-----------|-------|-----|
| Not set | `none`, dot | "Not set" | "Not set" |
| Key saved | `ok`, dot; click = Replace | "•••{last four}" | "Key saved, ends in {last four}. Replace" |
| Set up | `ok`, dot | the value (bucket, host, account name) | "Set up: {value}" |
| Connected | `ok`, `check` | "Connected" | the test's result sentence |
| Failed | `danger`, `xCircle` | "Failed" | the failure sentence (also on the page, see Notice) |
| Not yet available | `none`, no dot, row faded | "Soon" | "Not yet available" |
| Working | `running` | "Checking" or "Running" | what is running |
| Saved | `ok`, `check`, shown for 2 seconds | "Saved" | "Saved" |
| Warnings | `warn`, `alert` | "1 warning", "{n} warnings" | the first finding |
| Paid | `warn`, `coin` | "Paid" | "Each run is charged to your account" |
| New result | `accent`, dot | none | "New result" |
| Open now | `accent`, dot | none | "Open now" |

## Notice (built, `.notice`)

- Only for money about to be spent, work about to be lost, a failure the user must fix, and the one-time result of a test (connection works or fails).
- One line where it fits, an icon first, one action button at the right end. Tones as the badge kinds (warn, danger, info, ok), each its `-text` token on its `-bg` token.
- Never "how this works" text: that goes in an InfoTip.

## InfoTip (new, T3b)

Where almost all of today's grey help paragraphs go. Folder `ui/info-tip/`.

- A `.iconButton` with the `info` icon, `aria-label` and `title` "About {about}", `aria-expanded`, `aria-controls`. Props: `about: string`, `children` (one to three sentences).
- Opens on click, Enter or Space, and while the pointer rests on the button or the popover. Escape, a click outside, or a second click closes it; while a tip is open inside a dialog, the first Escape closes only the tip and the dialog stays (Z-1b); focus stays on or returns to the button. One InfoTip is open at a time.
- The popover: ground `--color-bg`, edge `--color-line`, `--radius-md`, `--shadow-2`, padding `var(--space-2) var(--space-3)`, at most `--infotip-width` wide, text `--type-body-size`. Placed by `ui/menu-place` so it stays in the window. It is not modal and holds no control.
- **Never for security text.** Money, lost work, data leaving the machine, what an agent asks to do and failures stay on the page. An InfoTip may hold a longer form of such a line only when the short line stays visible beside the action.

## Menu (built)

- Items in a fixed order (the same order as the row's actions), a separator before destructive items, destructive last.
- Width shrinks to its content, up to `--width-menu`. Elevation 2 (`--shadow-2`, from T2).

## Dialog

Built: `ui/dialog-frame/` (Radix dialog; head, body, foot; `size`, `footer`, `describedBy`, `closable`, and `icon?: IconName`, an icon drawn before the title words and hidden from a screen reader; the key dialog passes `key`, Z-1b). T4 adds the kinds, the warning line and two parts.

**Kinds** (new prop `kind`, T4). The kind sets the width; `size`, when also given, wins (a wide `form`).

| Kind | Width | Holds |
|------|-------|-------|
| `confirm` | `normal` | A title that is a question, at most one sentence, Cancel and the action (`.primary` or `.primary.danger`) |
| `form` | `normal` (or `wide` by `size`) | A title, Fields, Cancel and the primary. Help in InfoTips and placeholders |
| `run` | `normal` | A title, the provider (Segmented, or a select for five or more), the count, one cost line (MoneyLine when paid), Cancel and the action |
| `publish` | `wide` | A title, ObjectRows of what goes where with a StatusMark each, Cancel and Publish. While running, a progress bar replaces the body |
| `review` | `large` | Two panes: the list on the left, the picked item on the right. The decision buttons in the foot |
| `pick` | `wide` | A grid of pictures to choose from (`.pickGrid`, T4: `repeat(auto-fill, minmax(var(--thumbnail-tile), 1fr))`, gap `--gap-inline`), no captions (names in `title` and `aria-label`), the chosen one ringed in the spot colour; Cancel and "Use". For layout, reference pictures and the picture chooser (choice C-16) |

**Warning line** (new prop `warning?: string`, T4): drawn in the head under the title, with the `alert` icon, in `--color-warn-text`, and made the dialog's accessible description. The existing `description` prop keeps working as built until Wave 2 moves each dialog off it; the head then holds the title only.

**DialogAlert** (new, T4, `ui/dialog-alert/`): the one way to draw a refusal, a failure or a busy state inside a dialog. At the top of the body: an icon, one line, at most one action. Props: `tone: 'danger' | 'warn' | 'busy'`, `children`, `action?`. `danger` and `warn` take `role="alert"` and their notice colours; `busy` takes `role="status"` and the turning `spinner`.

**MoneyLine** (new, T4, `ui/money-line/`): the one way to show a cost. Props: `id: string`, `children` (the words). Amber: ground `--color-warn-bg`, text `--color-warn-text`, the `coin` icon, padding `var(--space-2) var(--space-3)`, `--radius`, one line. It is the last thing in the body, directly above the foot's buttons (or, in the inline two-step line, directly left of Confirm). The dialog lists its `id` in `aria-describedby` (with the warning's id when there is one), so the cost is read when the dialog opens. The words have the form "Paid: {n} {things}[ + {m} references] → {Provider}", with real plurals; the arrow is the `right` icon (`aria-hidden`) followed by a visually hidden "to". It always names the provider the request goes to. A local provider shows no MoneyLine; its own line (for example where the work runs) stays plain text above the buttons.

**The paid-run rule** (choice C-15, `spec/screens.md`, "Rules for every screen"): a paid call starts only after the user's own click with the cost on screen at that click. In a dialog opened to make something, the dialog's action button is that click, the MoneyLine sits directly above it and is in the accessible description, the button names the action, and nothing is sent before it. From a control in a place not opened to pay, the two-step line stays.

Rules:

- The foot holds every action row. Cancel is `.quiet`; the main action is last and `.primary` (or `.primary.danger` in a delete confirm). Never two primaries.
- Body padding `--pad-dialog`; fields `--gap-field` apart.
- Escape and Cancel always close, unless the frame is `closable={false}` while a command waits (as built).
- A long job (export, package, publish, gallery update) shows the progress bar (`.progress`), not a sentence with a percentage, and offers "Run in background" where the job can go on alone, or "Stop" where it cannot.

## SubPage (new, T3e)

For long or rare content opened from a Section: the agent connect snippets, a licence list, the server folder list. Folder `ui/sub-page/`.

- Props: `title: string`, `onBack: () => void`, `backLabel?: string` (default "Back"), `escapeBack?: boolean` (default true), `children`.
- A head row at `--row-height`: a `.iconButton` with the `left` icon (`aria-label` and `title` `backLabel`), then the title as an `h2` in `--font-title`, `--type-title-size`. On open, focus goes to the title (`tabIndex={-1}`). Back calls `onBack`; so does Escape unless `escapeBack` is false (the New campaign page passes false and handles Escape itself through `ui/escape-leave/`). The caller returns focus to the Section header that opened it and keeps that view's scroll position.

## PhotoStrip and JobProgress (built, Wave 2)

- **PhotoStrip** (`ui/photo-strip/`, AST-2): a list named by `label`; photo tiles at `--thumbnail-tile`, each with a ✕ named by its `removeLabel`; a missing file shows "File not found"; a dashed "+" tile named `addLabel`; `needsOne` gives the amber edge when empty; `addingLabel` is the hidden status while adding; `size?: 'regular' | 'small'`; `disabled?`. It calls `onAdd` / `onRemove` and sends nothing itself. Used by the subject cards, the brief form's subjects and the Generate panel's reference pictures.
- **JobProgress** (`ui/job-progress/`, DLG-1): a bar with `role="progressbar"` named by `label`, `value` 0 to 1 or `null` (no value known), an optional `count: { done, total }` for the text "3 of 10", and at most one button (`action: { label, onClick }`, any words). It starts and sends nothing itself.

## SideList (new, T3e)

The settings page list (choice C-1), usable by any screen with a few pages. Folder `ui/side-list/`.

- Props: `label: string` (the `nav`'s `aria-label`), `items: { id, label, icon: IconName, mark?: 'warn' | 'danger' }[]`, `current: string`, `onChoose(id)`, `foot?: ReactNode`.
- `<nav aria-label>` holding a list of buttons: icon, one word, an optional status dot (with a visually hidden "needs a look"). The current item has `aria-current="page"` and the selected look of ObjectRow. Rows at `--row-height`. `foot` sits at the bottom of the list (the Settings "Setup" button).

## Older pieces that stay

- **Badge** (`.badge`), **Chip** (`.chip`), **Table** (`.table`), **Progress bar** (`.progress`), **Empty place** (`.empty`), **Switch**, **Segmented**: as built (ST-2), on the new heights. A badge with more than two words becomes a StatusMark when its screen's Wave 2 slice comes.
- **Card** (`.card`): from T2 it has no shadow. A card is only for a thing you can pick up or click (a tile, a campaign tile). A box around a group of controls is a Section instead (AP-15).
- **Headings and body** (`base.css`): `h1` at `--type-page-size`, `h2` and `h3` at `--type-title-size`, all in `--font-title` at `--type-page-weight` / `--type-title-weight` (T2). Body text stays at `--font-size-body` until the clean-up slice. A heading inside a panel or a settings page is a Section title, not an `h2` in the serif.

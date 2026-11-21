# App style — the prototype's look in the real app

**Status:** designed, not built. Build plan: `spec/phases/app-style.md` (slices ST-1 to ST-14).

**Goal:** the built screens take the look of the design prototype (`design/prototype/`, round 3) without any change to what they do. D-084 stays: every value comes from `src/renderer/ui/tokens.css`, so one edit there restyles every component.

**Read with:** `design/NOTES.md` (the look and its open questions), `design/prototype/css/tokens.css` and `type.css` (the source values), `spec/screens.md` "Rules for every screen", `spec/structure.md` "One styling source".

## Rules

1. **One styling source.** No CSS file but `tokens.css` writes a raw colour, a px length other than 0, a font family, weight or size, a raw shadow, or a time. `styling-source.test.ts` (exists) guards colours and px; `styling-rules.test.ts` (ST-1) guards the rest.
2. **Existing token names stay.** A token that exists keeps its name and gets the prototype's value. Renaming would touch every CSS module and could not merge beside other work. New tokens are added beside them.
3. **The app's words stay.** No visible text, label, accessible name, role, heading level, focus order or command call changes. The prototype's wording ("post", "image", "Fan out", and so on) is not carried. Where the prototype shows an icon instead of a word, the app keeps the word and may add the icon beside it.
4. **No behaviour change.** A piece of the prototype that needs new state, a new query or command, or a new control is out of scope (see "Out of scope").
5. **Decorative pieces are hidden from assistive tech.** Icons and drawings carry `aria-hidden="true"` and `focusable="false"`, and add no tab stop.
6. **Light theme only** (REQUIREMENTS 8.9), as in the prototype.
7. **Reduce motion.** With the system's "reduce motion" on, nothing moves: `tokens.css` sets the short motion time to 0 under `@media (prefers-reduced-motion: reduce)`, and each component with an `animation` turns it off in its own `@media (prefers-reduced-motion: reduce)` rule.
8. **Focus stays an outline** (`:focus-visible` in `base.css`, already built), in the spot colour, never removed and never drawn with `box-shadow`.
9. **No CSS `url()` for icons or fonts.** Icons are inline SVG from the icon component; fonts are system fonts. Nothing new passes through the content security policy (`tests/e2e/csp.spec.ts` unchanged).

## The token set

Values are the prototype's (`design/prototype/css/tokens.css`, `type.css`) unless a row says "kept". "Prototype name" is the custom property in the prototype, or the raw value it typed by hand.

### Colours: existing tokens, new values

| Token | Was | Becomes | Prototype name | Used for |
|-------|-----|---------|----------------|----------|
| `--color-bg` | `#ffffff` | kept | `--surface` | Raised surfaces: controls, cards, dialogs, active tab, editor. Not the window ground |
| `--color-surface` | `#f4f5f7` | `#efede8` | `--surface-3` | Top bar, quiet fills, neutral badges |
| `--color-border` | `#c9ccd3` | `#cbc7bd` | `--line-strong` | Heavier card edges, dividers. Never a control's only edge (1.7:1) |
| `--color-text` | `#1b1d22` | `#16150f` | `--ink` | Body text |
| `--color-text-muted` | `#545a66` | `#68645c` | `--ink-3` | Hints, counts, secondary lines |
| `--color-accent` | `#1f5bd8` | `#cf1470` | `--accent` | The spot colour: the primary action, the selected tab and list item, live status |
| `--color-accent-text` | `#ffffff` | `#ffffff` (kept) | `--ink-on-accent` | Text on the spot colour and on `--color-text` |
| `--color-danger-bg` | `#fdecea` | `#fdeae8` | `--danger-soft` | Error notices and badges |
| `--color-danger-text` | `#8a1c12` | `#a8231c` | `--danger` | Error text |
| `--color-focus` | `#1f5bd8` | `var(--color-accent)` | focus outline | Keyboard focus outline |
| `--color-overlay` | `rgb(0 0 0 / 40%)` | `rgb(29 28 26 / 42%)` | `--scrim` | Behind dialogs |
| `--canvas-backdrop` | `#8a8d93` | `#e9e7e1` | `--canvas-bg` | Around the ad in the editor; behind thumbnails of pictures with clear parts (choice C-9) |
| `--selection-dark` | `#1b1d22` | `#16150f` | `--canvas-sel` | The canvas selection line |
| `--selection-light` | `#ffffff` | `#ffffff` (kept) | `--canvas-sel-halo` | The light lines on both sides of it |
| `--guide-color` | `#e0149a` | `#e0149a` (kept) | none | Snapping guides (the prototype has none) |

### Colours: new tokens

| Token | Value | Prototype name | Used for |
|-------|-------|----------------|----------|
| `--color-page` | `#f7f4ec` | `--bg` | The window ground (`body`), behind pages |
| `--color-surface-soft` | `#faf9f7` | `--surface-2` | Hover on buttons, dialog footers, tile ground, side panels |
| `--color-line` | `#e4e1da` | `--line` | Light edges: cards, bars, panel borders, table rows |
| `--color-control-border` | `#8a857b` | `--control-border` | The edge of every button, field, select, switch track (off) and swatch; 3:1 on every ground but the canvas |
| `--color-text-secondary` | `#4f4c46` | `--ink-2` | Field labels, inactive tabs, quiet buttons |
| `--color-accent-hover` | `#b00f5e` | `--accent-hover` | Primary button on hover |
| `--color-accent-soft` | `#fde8f2` | `--accent-soft` | Selected list row, selected layer, accent badge ground |
| `--color-accent-ink` | `#a80d59` | `--accent-ink` | Text in the spot colour (links, selected rows, accent badges) |
| `--color-warn-bg` | `#fff0d2` | `--warn-soft` | Warning notices and badges ("Out of date", "Missing file") |
| `--color-warn-text` | `#7a4a00` | `--warn` | Warning text |
| `--color-info-bg` | `#e5effd` | `--info-soft` | Information notices and badges |
| `--color-info-text` | `#1b56ad` | `--info` | Information text |
| `--color-ok-bg` | `#e2f3e7` | `--ok-soft` | Success notices, a step that is done |
| `--color-ok-text` | `#19663a` | `--ok` | Success text |
| `--color-on-picture` | `rgb(29 28 26 / 85%)` | raw in `campaign.css` | A dark chip laid over a picture (a video length on a tile) |
| `--color-hover-on-dark` | `rgb(255 255 255 / 16%)` | raw in `campaign.css` | Hover on a quiet button that sits on `--color-text` |

The prototype's neutral pair (`--neutral`, `--neutral-soft`) is `--color-text-secondary` on `--color-surface`; no new token.

### Type

| Token | Value | Prototype name |
|-------|-------|----------------|
| `--font-body` (new value) | `-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, 'Helvetica Neue', Arial, sans-serif` | `--font` |
| `--font-serif` (new) | `'Iowan Old Style', 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif` | `--font-serif` |
| `--font-title` (new) | `var(--font-serif)` | `--font-title` |
| `--font-reading` (new) | `var(--font-serif)` | `--font-reading` |
| `--font-condensed` (new) | `'Avenir Next Condensed', 'Arial Narrow', 'Helvetica Neue', sans-serif` | `--font-cond` (its last fallback, Impact, is dropped: too heavy for a small label) |
| `--font-mono` | kept | `--font-mono` |
| `--font-size-small` | `12px` (kept) | `--text-xs` |
| `--font-size-control` (new) | `13px` | `--text-sm` |
| `--font-size-body` | `14px` (kept) | `--text-md` |
| `--font-size-reading` (new) | `15px` | `--reading-size` |
| `--font-size-heading` | `16px` → `17px` | `--text-lg` |
| `--font-size-title` (new) | `21px` | `--text-xl` |
| `--font-size-page` (new) | `32px` | `--text-2xl` |
| `--font-size-wordmark` (new) | `24px` | raw in `shell.css` (`.brand.big`) |
| `--weight-regular` (new) | `400` | `--weight-regular` |
| `--weight-medium` (new) | `500` | `--weight-medium` |
| `--weight-bold` (new) | `650` | `--weight-bold` |
| `--weight-title` (new) | `600` | `--title-weight` |
| `--weight-wordmark` (new) | `800` | raw in `shell.css` |
| `--leading-body` (new) | `1.45` | raw in `base.css` |
| `--leading-tight` (new) | `1.2` | none (badges, tab labels, buttons) |
| `--tracking-title` (new) | `-0.012em` | raw in `type.css` |
| `--tracking-label` (new) | `0.14em` | raw in `type.css` (`.eyebrow`) |

### Spacing, radius, lines

| Token | Value | Prototype name |
|-------|-------|----------------|
| `--space-1`, `-2`, `-3`, `-4`, `-6` | `4px`, `8px`, `12px`, `16px`, `24px` (kept) | `--s1` to `--s5` |
| `--space-8` (new) | `32px` | `--s6` |
| `--space-12` (new) | `48px` | `--s7` |
| `--radius` | `6px` (kept) | `--r-sm` |
| `--radius-md` (new) | `10px` | `--r-md` (cards, tiles, menus, notices that stand alone) |
| `--radius-lg` (new) | `14px` | `--r-lg` (dialogs) |
| `--radius-pill` (new) | `999px` | `--r-pill` (chips, switch, progress) |
| `--radius-inner` (new) | `4px` | raw `4px` (a segment inside a segmented group, a tab close button) |
| `--border-width`, `--focus-ring-width`, `--focus-ring-offset` | `1px`, `2px`, `2px` (kept) | `--focus-w`, `--focus-gap` |
| `--indicator-width` (new) | `3px` | raw `3px` (the bar under or over the selected campaign and variant tab) |
| `--indicator-width-thin` (new) | `2px` | raw `2px` (the line under a selected in-page tab) |

Off-scale prototype values have no token. Where the prototype typed `6px` or `10px`, use `--space-2` (8px) for a gap and `--space-3` (12px) for padding inside a box; `14px`, `18px` and `20px` become `--space-3`, `--space-4` and `--space-6` (choices C-1 and C-10).

### Shadow

| Token | Value | Prototype name | Used for |
|-------|-------|----------------|----------|
| `--shadow-1` | `0 1px 2px rgb(29 28 26 / 6%), 0 1px 1px rgb(29 28 26 / 4%)` | `--shadow-1` | Cards, the selected segment, the switch knob |
| `--shadow-2` | `0 4px 14px rgb(29 28 26 / 8%), 0 1px 3px rgb(29 28 26 / 6%)` | `--shadow-2` | A card or tile on hover, the ad on the canvas |
| `--shadow-3` | `0 18px 48px rgb(29 28 26 / 18%), 0 4px 12px rgb(29 28 26 / 8%)` | `--shadow-3` | Dialogs, menus, the activity panel, a toast |

### Sizes

| Token | Value | Prototype name |
|-------|-------|----------------|
| `--control-height` | `34px` | `--control-h` |
| `--control-height-small` | `28px` | raw (`.btn.sm`, segments) |
| `--control-height-large` | `42px` | raw (`.btn.lg`) |
| `--bar-height` | `44px` | `--tabbar-h` (the top bar; also the minimum height of a panel head) |
| `--tab-height` | `36px` | raw (campaign tab) |
| `--tab-row-height` | `42px` | raw (`.vtabs`, the variant tab row) |
| `--row-height` | `38px` | raw (a layer row) |
| `--icon-size` | `16px` | raw (`svg.ic`) |
| `--icon-size-small` | `13px` | raw (icons in badges, tabs, layer rows) |
| `--icon-stroke` | `1.7` | raw (`stroke-width`, no unit) |
| `--check-size` | `16px` | raw (one size for every checkbox; the prototype's 17px tile box is not carried) |
| `--switch-width`, `--switch-height`, `--switch-knob` | `36px`, `20px`, `16px` | raw (`.switch`) |
| `--badge-height` | `22px` | raw (`.badge`) |
| `--chip-height` | `24px` | raw (`.chip`) |
| `--progress-height` | `6px` | raw (`.progress`) |
| `--width-dialog` | `440px` → `460px` | `.dialog.sm` |
| `--width-dialog-wide` (new) | `640px` | `.dialog.md` |
| `--width-dialog-large` (new) | `880px` | `.dialog.lg` |
| `--width-menu` (new) | `300px` | raw (`.menu`) |
| `--width-wide` (new) | `1360px` | raw (`.page > *` max width: project home and campaign page) |
| `--width-start-art` (new) | `640px` | raw (start page left column, at most) |
| `--drawing-height` | `176px` | `--il-h` |
| `--drawing-stroke` | `1.25px` | `--il-stroke` |
| Every other existing size token | kept (C-11) | editor panels already equal the prototype (260, 312) |

### Motion

| Token | Value | Prototype name |
|-------|-------|----------------|
| `--motion-fast` | `150ms` (`0ms` with reduce motion) | raw `0.15s` (switch, hover) |
| `--motion-spin` | `1s` | raw (`.spin`) |
| `--motion-pop` | `1.6s` | raw (the "finished, not seen" dot) |
| `--motion-calm` | `16s` | `--motion-calm` (one cycle of a start page drawing) |
| `--ease-calm` | `cubic-bezier(0.45, 0, 0.55, 1)` | `--ease-calm` |

### Not carried from the prototype

- The switchable presets (`data-accent`, `data-type`, `data-serif`, `data-corners`) and the "Prototype options" box: the app has one value per token. Changing the spot colour later is a four-line edit (`--color-accent`, `-hover`, `-soft`, `-ink`).
- `--font-display` (Avenir Next): used only by the prototype's "sans only" pairing and by its sample ads.
- Sizes for screens the app has not built: `--report-thumb-h`, `--progress-w`, `--side-control-w`.
- Every colour inside the sample ads and photos (`poster.css`, `pictures.js`, `art.js`): ads are drawn by the Scene, not by the app's CSS.

## Type

**Two voices and a label face**, as in `design/NOTES.md`, round 3:

| Voice | Token | Used for in the app |
|-------|-------|---------------------|
| Serif | `--font-title` | Every `h1`, `h2`, `h3` (page, section, dialog and card titles), at `--weight-title`, `--tracking-title` |
| Serif | `--font-reading` | Text people read or write at length: the brief text fields (brief, subject descriptions), prompt fields, ad copy fields (headline, body, call to action in the properties panel), copy and layout options in their dialogs, the brief reading dialog's text. Size `--font-size-reading`, `--leading-body` |
| Sans | `--font-body` | Everything you operate: buttons, tabs, labels, field values that are not long text (numbers, names, IDs, sizes), badges, tables, hints, and every warning, error, progress and status message |
| Condensed sans | `--font-condensed` | The "Adman" wordmark on the start screen only (the app has no eyebrow labels; see "Out of scope") |
| Mono | `--font-mono` | The Claude Code line and any `code` (kept) |

Only a `textarea` or a field named above takes the reading face; one-line `input` fields stay sans.

**Sizes.** Small text is 12px (`--font-size-small`); nothing is smaller (C-2). Buttons, tabs, labels and menu items are 13px; body 14px; reading text 15px; card titles 17px; dialog, Settings and editor titles 21px; project home and campaign page titles 32px (C-3). Mono text takes a size token, never `0.92em`.

**Weights.** `b` and `strong` use `--weight-bold` (650; Segoe UI rounds it to Semibold). The raw `600` in `layout.module.css`, `tab-row`, `app-shell` and `variant-tile` modules become tokens in their slices.

### Where the font files come from

**Answer: nothing is bundled. Every face is a system font, so the app needs no font file and no network, and redistributes nothing.**

| Family | Where it is | Licence; may we ship it? | Use |
|--------|-------------|--------------------------|-----|
| San Francisco, Segoe UI | macOS, Windows | System licences; no | `--font-body` |
| Iowan Old Style | macOS | System licence; no | First in `--font-serif` |
| Palatino Linotype, Book Antiqua, Georgia | Windows (Georgia also macOS) | System licences; no | Serif fallbacks |
| Avenir Next Condensed; Arial Narrow | macOS; Windows with Office | System licences; no | `--font-condensed` |
| Inter | `src/shared/scene/fonts/InterVariable.woff2`, in the repository | SIL Open Font License 1.1 (`OFL.txt` beside it); yes | Not used by the app's chrome; it stays the Scene's ad font |

The prototype bundles no font file either (no `@font-face` in `design/prototype/css/`). The cost, as the designer said: Windows shows Palatino Linotype or Georgia and Arial Narrow, so the look differs a little by machine. Faces that match everywhere would mean bundling open-licence files with `@font-face` and checking the content security policy's `font-src`; that is choice C-8, not this pass.

## Contrast

Text keeps 4.5:1 against its ground (SPEC 11). The edge of a control, a focus outline and a selected state keep 3:1 (WCAG 2.1, 1.4.11). Ratios below are worked out from the token values (rounded down to one decimal); ST-1's contrast test checks every pair.

**Text pairs (4.5:1), all pass:**

| Text | Ground | Ratio |
|------|--------|-------|
| `--color-text` | `--color-bg`, `--color-page`, `--color-surface` | 15 or more |
| `--color-text-secondary` | `--color-bg`, `--color-page`, `--color-surface` | 7.3 or more |
| `--color-text-muted` | `--color-bg` / `--color-surface-soft` / `--color-page` / `--color-surface` / `--color-accent-soft` / `--canvas-backdrop` | 5.8 / 5.6 / 5.3 / 5.0 / 5.0 / 4.7 |
| `--color-accent-text` | `--color-accent` / `--color-accent-hover` / `--color-text` | 5.2 / 6.8 / 15 or more |
| `--color-accent-ink` | `--color-accent-soft`, `--color-bg`, `--color-page` | 6.2 or more |
| `--color-danger-text` on `--color-danger-bg`; warn, info, ok text on their grounds | | 6.0 or more each |
| `--selection-light` on `--selection-dark` (the canvas size tag) | | 15 or more |

**Pairs that fail, and what to use instead:**

| Pairing | Where | Ratio | Instead |
|---------|-------|-------|---------|
| `--color-accent` as text on `--color-surface` | prototype: selected tab text on the grey bar | 4.4 to 4.5, too close | Text in the spot colour is always `--color-accent-ink` |
| `--color-accent` as text on `--color-accent-soft` | prototype: badges | 4.5, too close | `--color-accent-ink` (6.2) |
| Switch track off, `--line-strong` on white | prototype `controls.css` | 1.6 | `--color-control-border` (3.5) |
| Colour swatch edge, `--line-strong` | prototype `pieces.css`, `dialogs.css` | 1.6 | `--color-control-border` |
| Fan-out option card edge | prototype `flows.css` (not built in the app) | 1.6 | `--color-control-border` when Phase 5 builds it |
| Control edges in the app today, `#c9ccd3` on white | every button, field and select (`base.css`) | 1.6 | `--color-control-border` (ST-2) |
| `--color-control-border` on `--canvas-backdrop` | a control placed on the canvas ground | 2.8 | No control sits on the backdrop; the canvas bar and zoom controls sit on `--color-bg` |
| `--color-border` as a control's only edge | any | 1.6 | Only for cards and dividers; controls use `--color-control-border` |

A disabled control is drawn at `--opacity-disabled` and is exempt, as today.

## Icons and drawings

- **Icons.** A new component `src/renderer/ui/icon/` draws one 24×24 stroke icon by name, from the path set in `design/prototype/js/ui.js` (`P`; the designer's own drawings, no third-party set), copied as is. Size `--icon-size` or `--icon-size-small`, `stroke: currentColor`, `--icon-stroke`, round caps and joins. Icons sit beside words (rule 3): before a button's word, at the start of a notice or badge, beside a layer's name.
- **Spinner and dot.** A running job's mark keeps its word ("Running") and gains the spinner icon turning at `--motion-spin`; the "finished, not seen" dot pulses three times at `--motion-pop`. Both are still with reduce motion.
- **Start page drawings.** The three isometric drawings of `design/prototype/js/illustrations.js` and `css/illustrations.css` (branch, generate, linked), as one component `src/renderer/screens/start/start-drawings/`, inline SVG, colours from tokens (`--color-text`, `--color-bg`, `--color-surface`, `--color-border`, `--color-accent`, `--color-accent-soft`, `--color-accent-hover`, `--color-text-muted`), line `--drawing-stroke`, height `--drawing-height`, one cycle `--motion-calm` `--ease-calm`. With reduce motion the finished drawing shows still. No caption (the prototype has none; NOTES R3-2 is open).

## Shared pieces

Built in `base.css` and `layout.module.css` (ST-2) and used by every later slice. Each is the prototype piece named in brackets.

- **Button** (`.btn`): every `button` by default. Height `--control-height`, padding `0 var(--space-3)`, `--font-size-control`, `--weight-medium`, `--radius`, edge `--color-control-border`, ground `--color-bg`; hover ground `--color-surface-soft` and edge `--color-text-muted`; icon gap `--space-2`. Kinds as classes in `layout.module.css`: `primary` (exists; spot colour ground, hover `--color-accent-hover`), `quiet` (no edge, no ground; hover `--color-surface`), `danger` (text `--color-danger-text`), `small` (`--control-height-small`, `--font-size-small`), `large` (`--control-height-large`, `--font-size-body`), `iconOnly` (square; used only where the button already has no visible word). A text-style button (`link`) is `--color-accent-ink`, underlined.
- **Field** (`.field`, `.input`): label above in `--font-size-small`, `--weight-medium`, `--color-text-secondary`; `input` and `select` at `--control-height`, padding `0 var(--space-3)`; `textarea` padding `var(--space-2) var(--space-3)`; hint below in `--font-size-small`, `--color-text-muted`. Checkboxes and radios are native at `--check-size` with `accent-color: var(--color-accent)`.
- **Switch**: where a control already has `role="switch"` or is a pressed toggle that reads as on and off (the agent access toggle in Settings), the track is drawn as the prototype switch. Off track `--color-control-border`, on track `--color-accent`, knob `--color-bg` with `--shadow-1`, moving in `--motion-fast`.
- **Segmented group** (`.seg`): a row of `aria-pressed` buttons (text alignment, colour choice modes): ground `--color-surface`, padding and gap `calc(var(--border-width) * 2)`, segments at `--control-height-small`; pressed segment `--color-bg` with `--shadow-1` and `--color-text`; corners `--radius-inner`.
- **Badge** (`.badge`): icon plus word, never colour alone. Height `--badge-height`, `--font-size-small`, `--weight-medium`, `--radius`. Kinds: warn, danger, info, ok, neutral, accent, each its text token on its ground token.
- **Chip** (`.chip`): pill at `--chip-height`, `--color-surface` ground, `--color-text-secondary`.
- **Notice** (`.notice`): icon plus sentence, padding `var(--space-2) var(--space-3)`, `--radius`, `--font-size-control`, kinds as badges. A button inside goes to the right end.
- **Card** (`.card`, exists): `--color-bg`, edge `--color-line`, `--radius-md`, `--shadow-1`, padding `--space-4`. A card that is a button: hover edge `--color-border` and `--shadow-2`.
- **Menu**: `--width-menu`, padding `--space-2`, edge `--color-border`, `--radius-md`, `--shadow-3`; items at least `--control-height-small` tall, `--radius`, hover `--color-surface`; a group label in `--font-size-small`, `--color-text-muted`.
- **Table**: `--font-size-control`; header `--font-size-small`, `--color-text-muted`, `--weight-medium`; rows separated by `--color-line`; cell padding `var(--space-2) var(--space-3)`.
- **Progress bar**: `--progress-height`, `--radius-pill`, track `--color-surface`, fill `--color-accent`.
- **Empty place** (`.empty`): dashed `--color-border` edge, `--radius-md`, `--color-text-muted`; as a button, hover `--color-accent` edge, `--color-accent-soft` ground, `--color-accent-ink` text.
- **Headings and body**: as in "Type"; `h1` `--font-size-page`, `h2` `--font-size-title`, `h3` `--font-size-heading`; a screen with a smaller `h1` (Settings) sets it in its own module. Body on `--color-page`, `--leading-body`, antialiased.

## Component by component

Beyond the tokens, what changes in layout and structure. "Folder" names are under `src/renderer/`.

**App shell and tabs** (`app/app-shell/`, `app/campaign-tabs/`, `app/project-switcher/`, `app/error-banner/`, `ui/tab-row/`, `ui/tab-marks/`)
- Top bar: `--bar-height`, ground `--color-surface`, bottom edge `--color-line`, padding `0 var(--space-3)`, items centred. "Activity" and "Settings" become quiet buttons with their icon beside the word; Settings pressed shows `--color-bg` ground.
- Project switcher: the prototype's two-part box (name, caret) with `--color-border` edge and `--radius`; its menu is the shared menu.
- Campaign tabs: `--tab-height`, top corners `--radius-md`, `--indicator-width` bar on top in `--color-accent` when selected, selected ground `--color-bg`, labels `--font-size-body` `--weight-bold`. Close button `--radius-inner`, icon "x" beside the existing accessible name; its visible content stays what it is today.
- Variant tab row (`ui/tab-row` shared with `screens/campaign/variant-tabs`): row `--tab-row-height`, ground `--color-bg`, bottom edge `--color-line`; selected tab has an `--indicator-width` underline in the spot colour and `--weight-bold`. The row keeps its built overflow behaviour.
- Tab marks: "Running" keeps its word and gains the spinner; the dot is `--mark-dot` in the spot colour with a `--color-accent-soft` ring.
- Error banner: a danger notice with the alert icon, full width under the bar, no radius.

**Buttons and form controls** (`ui/base.css`, `ui/layout.module.css`, new `ui/icon/`): the shared pieces above.

**Dialogs** (`ui/dialog-frame/` and the dialogs of ST-4)
- Frame: ground `--color-bg`, `--radius-lg`, `--shadow-3`, max height the window less `--space-12`. Three bands: head (the title, padding `var(--space-4) var(--space-6) var(--space-3)`, bottom edge `--color-line`), body (scrolls, padding `--space-6`), foot (right-aligned buttons, padding `var(--space-3) var(--space-6)`, ground `--color-surface-soft`, top edge `--color-line`).
- `DialogFrame` gains an optional `footer` prop drawn after the body and an optional `size` prop (`'normal' | 'wide' | 'large'`, widths `--width-dialog`, `--width-dialog-wide`, `--width-dialog-large`). A dialog moves its button row into `footer` only when that row is already the last thing in the dialog, so the focus order is unchanged. The picture chooser takes `large`.
- Busy and waiting blocks: centred, spinner icon in the spot colour.

**Settings** (`screens/settings/*`)
- One column, max width `--width-page`, page padding `var(--space-8) var(--space-8) var(--space-12)`. Title `h1` at `--font-size-title` (C-3). Each section is a card; its `h2` at `--font-size-heading`. Key rows, licence list and the check results use the shared table or list rows. Problem lines are notices of their kind. The agent access toggle is drawn as a switch.

**Start screen** (`screens/start/*`)
- Two columns centred in the window, gap `--space-12`, padding `--space-12`: left the wordmark "Adman" (the existing `h1`, in `--font-condensed`, italic, `--weight-wordmark`, `--font-size-wordmark`, upper case, with a small rotated square in the spot colour drawn by CSS before it) and the three drawings; right the existing "New project" and "Open" cards. Recent projects are rows of `--radius-md` with a file icon, name above path, hover `--shadow-1`.

**Project home and brief form** (`screens/project-home/*`)
- Page max width `--width-wide`, padding `var(--space-6) var(--space-8)`. Project title `h1` 32px serif. Each section (campaigns, subjects, import, missing files, package) is a card with an `h2`.
- Campaign list: a grid of cards (`--thumbnail-tile` columns), the cover thumbnail on `--color-surface-soft` above the title, as the prototype's campaign cards; the cover stays the one the app already draws.
- Brief form: fields in a two-column grid where two short fields sit side by side (the prototype's `form-grid`); brief and description textareas in the reading face; subject rows as cards with `--radius-md`; the photo list (SP-3) as a row of `--layer-thumb` squares on `--canvas-backdrop`; size and rule fields as rows of chips or checkboxes as today. Problem lines are warn notices.
- Drop import: the empty-place style, accent on drag-over.

**Campaign page, grid and tiles** (`screens/campaign/*`, `ui/variant-thumbnail/`)
- Page head: campaign title `h1` serif 32px, actions on the right. Variant tabs as in the shell.
- Grid: gap `var(--space-3)`; direction groups are cards with padding `--space-4`; row and column heads in `--font-size-control`, `--color-text-muted`.
- Tile: `--radius-md`, ground `--color-surface-soft`, edge `--color-line`, hover `--color-border` with `--shadow-1`; chosen: edge `--color-accent` plus a 1px ring (`--border-width`) in the spot colour; the thumbnail centred; title `--weight-bold`, line `--font-size-small` muted; marks become badges of their kind (out of date and missing file warn, text does not fit danger, generating accent, others neutral), each with its icon. The approval marks (AP-12) take the same badge piece.
- Slot view, generate panel, paid confirm, run list, run row, run result, video panel and video result: cards with `--radius-md`; the paid confirm line is an info notice with its two buttons at the right; run rows are table rows; results on `--color-surface-soft`.

**Editor** (`editor/*`)
- Frame: no outer border and no radius (it fills its panel); ground `--color-bg`; columns `--editor-layers-width`, the canvas, `--editor-props-width`; panel edges `--color-line`.
- Top bar: padding `var(--space-2) var(--space-4)`, bottom edge `--color-line`; the variant title at `--font-size-title` serif.
- Banner: a full-width notice of its kind, no radius, padding `var(--space-2) var(--space-4)`.
- Canvas: ground `--canvas-backdrop`; the ad box gets `--shadow-2`; the canvas bar (zoom) on `--color-bg` with a top edge `--color-line`. The selection line, handles, guides and crop box keep their tokens and their geometry (choice C-9 changes only the ground colour).
- Panel heads (layer list, properties): sticky, min height `--bar-height`, bottom edge `--color-line`, title `h2` or `h3` as built, at `--font-size-control` `--weight-bold` sans (a panel head is an operating label, not a page title).
- Layer rows: `--row-height`, `--radius`; hover `--color-surface`; selected ground `--color-accent-soft`, name `--color-accent-ink` `--weight-bold`; hidden rows muted and struck through; the type icon (image, text, layers) beside the name; "Hide", "Lock" and "Delete" are small icon buttons (eye, lock, trash) laid over the right end of the row, with their accessible names unchanged and a tooltip (C-13). A row is one line at `--row-height` and never changes height; a hidden or locked layer keeps its pressed button visible. Thumbnails `--layer-thumb` on `--canvas-backdrop`.
- Properties panel: body padding `--space-3`, groups separated by a top edge `--color-line` and `--space-3`; geometry fields in a four-column grid of number fields; text, headline and body copy fields in the reading face; colour swatches with `--color-control-border` edges, pressed swatch shows the focus-style ring; segmented groups for alignment.

**AI panels and the run dialog** (folders listed in ST-9 and ST-10)
- Prompt fields in the reading face. Reference pickers as a grid of `--option-thumb` squares, ticked ones with a spot colour edge. Earlier options as a row of `--option-thumb` pictures, the chosen one ringed in the spot colour.
- Run dialog: the frame's three bands; the provider choice as a list of selectable rows (selected row `--color-accent-soft`); the paid count as an info badge; the ComfyUI line as muted text.
- Run failure and close warning: danger and warn notices with their icon; their buttons at the right end.
- Copy options and layout options: each option a selectable card; copy text in the reading face.

**Activity panel** (`app/activity-button/`, `app/activity-panel/`, `app/activity-row/`)
- Panel over the right edge under the top bar, `--activity-width`, ground `--color-bg`, left edge `--color-line`, `--shadow-3`. Rows are cards (`--radius-md`, edge `--color-line`, padding `--space-3`, gap `--space-2`); a finished, unseen row has a spot colour edge and ring. The Activity button's count is a small pill (`--color-warn-bg` and `--color-warn-text`; when it counts unseen results, `--color-accent` and `--color-accent-text`).

## Out of scope

- **Screens the app has not built**: fan-out, sync review, export, its warnings and report, the subjects and library pages, the three-step new-campaign dialog, the video timeline, publish. Each later phase takes its look from this file and the shared pieces when it builds them.
- **Pieces of the prototype that need a behaviour change** (each would add state, a query, a command or a control):
  - Settings' side list of sections (new links and a scroll target per section).
  - A small picture of the ad in each variant tab (a thumbnail read per tab).
  - The "N more" menu for tabs that do not fit (G-23) and the "needs your attention" triangle on tabs (G-22).
  - Grouping Activity into "Just finished", "In progress", "Earlier" (new headings), if the app does not group today.
  - "Campaign" and "Project" labels above titles (new text); a wordmark in the top bar (new text).
  - Tile ID moved into the tooltip, the tile's "+" open-behind button, Cmd-click (G-13, G-24), and the bar for several chosen tiles (G-10).
  - The finished message with "Show result" (G-14), if the app does not have it.
  - The canvas outline for "this layer is being filled" in the spot colour, if the app draws no such state.
  - Replacing a word with an icon anywhere.
- **Behaviour of any kind**, wording, the sample ads and photos, and the Scene's own fonts and colours.

## Choices taken for now

Each is the prototype's current default, or the closest token to it, taken so the work can start. Each waits for the stakeholder's review and is a token or one-module edit to change later.

- **C-1. Spacing scale.** 4, 8, 12, 16, 24, 32, 48 px. No 6px or 10px step; where the prototype typed them, gaps become 8px and paddings 12px. (NOTES R3-10, REVIEW "Waiting on a decision".)
- **C-2. Small text.** 12px is the smallest size; the prototype's 11px and 11.5px become 12px.
- **C-3. Title sizes.** Project home and campaign page titles 32px; Settings, dialog and editor titles 21px; card and section titles 17px; panel heads 13px bold sans. The prototype's split between 32px and 21px pages is kept as it is.
- **C-4. Spot colour.** Magenta `#cf1470` with its hover, soft and ink shades. Vermilion, cobalt, teal and ink are not carried.
- **C-5. Serif pairing.** Iowan Old Style, then Palatino Linotype, Palatino, Book Antiqua, Georgia. The serif is used for titles and for reading text (briefs, prompts, copy), not titles only. Warnings, errors and status messages are sans.
- **C-6. Corners.** Rounded: 6px controls, 10px cards, tiles and menus, 14px dialogs, 4px inner segments. The "sharp" set is not carried.
- **C-7. Motion.** 150ms for hovers and the switch; 1s spinner; 1.6s pulse, three times; 16s per start drawing cycle with an even ease. Everything still with "reduce motion".
- **C-8. Fonts.** System fonts only, nothing bundled; Windows shows Palatino Linotype or Georgia and Arial Narrow. Bundling open-licence faces is a later choice (NOTES round 2, question 7).
- **C-9. Canvas backdrop.** The prototype's warm light grey `#e9e7e1` with `--shadow-2` on the ad, in place of the Phase 3 mid grey (`spec/screens.md` lists "a mid grey"). An empty ad is still black, so its edge shows.
- **C-10. Dialog spacing.** Head, body and foot paddings on the scale (12, 16, 24) in place of the prototype's 14, 18 and 20.
- **C-11. App sizes kept where the prototype differs a little.** Activity panel 360px (prototype 384), grid thumbnail 160px (164), handle 8px (10), unseen dot 8px (9), checkbox 16px everywhere (17 on tiles).
- **C-12. Tab indicators.** 3px bar for campaign and variant tabs, 2px line for tabs inside a page.
- **C-13. Layer row actions.** "Hide", "Lock", "Delete" are icon buttons (eye, lock, trash) as in the prototype, keeping their accessible names, with a tooltip.
- **C-14. Editor arrangement.** Layers left, properties right (the prototype's default of its two arrangements, and what the app has).

# Starter layouts and the starting font size

Built (LK-4): the five layouts as data, the box and style rules, the starting font size, `buildMasterLayers` from the default layout, and `starterLayoutPatches`. Built (LK-6): "Layout…", the screen that applies a layout (`spec/phases/look-pack.md`) [D-094].

A starter layout is a named set of starting boxes and looks for the template's slots. A new master is built from the default one (`spec/brief-and-templates.md`, "The default layout and `buildMasterLayers`"), and "Layout…" in the editor applies any of them to the open variant (`spec/editor.md`). The five are modelled on the reference ads in `design/references/`. Read with `spec/data-model-campaign.md` ("Look fields") and `spec/scene.md` ("Text boxes", "Background colour and shade").

## Files and owners

| File | Holds |
|------|-------|
| `src/shared/config/default-layout.ts` | The types below, `MARGIN_OF_SMALLER`, `SIDE_OF_SMALLER`, `FONT_ESTIMATE`, the slot names, the "any other slot" rows, `LAYER_DEFAULTS`, and the default layout's own values (`SLOT_LAYOUTS`, `BACKGROUND_LOOK`, `DEFAULT_STARTER_LAYOUT`). `SLOT_LAYOUTS` keeps its name and shape, so Phase 4 code that reads it keeps working. |
| `src/shared/config/starter-layouts.ts` | `STARTER_LAYOUTS`: the default layout (imported, not copied) then the other four; `DEFAULT_STARTER_LAYOUT_ID = 'photo-bottom-left'` |
| `src/shared/templates/layout-rules.ts` | The box and style rules, shared by the users below and the fake layout provider: `Frame` (`{ W, H, S, m, side }`), `frameOf(size)`, `geometryOf(box, frame)`; `textLayoutStyleOf(slot, copy, box, frame)`, a text style without `fontAssetId` (the rule's values, every look field, the starting font size), which a layout sends so the user's font stays; `textStyleOf(slot, copy, box, frame)`, the same plus the rule's `fontAssetId`, for a new layer |
| `src/shared/templates/starting-font-size.ts` | `startingFontSize(copy, box, rule, frame)` and its `FontSizeRule` (`fontSizeOfSmaller`, `lineHeight`, `letterSpacing`, `allCaps`, `padding`, `outline`) |
| `src/shared/templates/master-layers.ts` | `buildMasterLayers`, reading the default layout |
| `src/shared/templates/new-layer.ts` | `newLayerValues(type, size, count)`: a layer the user adds, built by `buildMasterLayers` from a slot no layout names, so it takes the "any other slot" rows |
| `src/shared/templates/starter-layout-patches.ts` | `starterLayoutPatches(layout, size, layers)` and `StarterLayoutUpdate`, one item of `layer.updateMany` |
| `src/shared/templates/starter.ts`, `types.ts` | `starterTemplate`, `slotStates`, and the template types (`spec/brief-and-templates.md`, "Templates") |

Each value has one owner. No number of a layout is written anywhere else.

## Shapes

```ts
// default-layout.ts. 'end' is new: the box ends one margin before the far edge.
type Place = 'zero' | 'margin' | 'centre' | 'end' | { ofHeight: number }
type Extent = 'full' | 'inset' | 'side' | { ofSmaller: number } | { ofHeight: number }
type BoxRule = { x: Place; y: Place; width: Extent; height: Extent }
// TextStyleRule is unchanged; its fontSizeOfSmaller is now the largest starting size.
type TextBoxRule = {
  verticalAlign: 'top' | 'middle' | 'bottom'
  allCaps: boolean
  boxColor: string | null              // #RRGGBB or none
  boxOutlineColor: string | null
  boxOutlineOfSmaller: number          // outline width as a share of S; 0 = none
  boxRadiusOfSmaller: number
  boxPaddingOfSmaller: number
}
type LayoutSlot = { box: BoxRule; text?: TextStyleRule; textBox?: TextBoxRule; shade?: Shade | null }
type SlotLayout = LayoutSlot & { name: string }   // SLOT_LAYOUTS: the default layout, with names
type BackgroundLook = { fillColor: string | null; shade: Shade | null }
type StarterLayout = {
  id: string                           // kebab-case, unique
  name: string                         // shown in "Layout…"
  description: string                  // one sentence, shown under the name
  background: BackgroundLook
  slots: Readonly<Record<string, LayoutSlot>>   // subject-image, logo, headline, call-to-action
}
```

Slot names ("Subject image", "Logo", "Headline", "Call to action") are read from `SLOT_LAYOUTS` only. A slot a layout does not name, and any slot of a user-added layer, keeps the "any other slot" rows of `default-layout.ts`, which do not change.

## Rules shared by every layout

- `W`, `H`, `S`, `m = round(0.06 × S)` and `side = round(0.46 × S)` (`frameOf`): `W` and `H` are the size's sides, `S` the smaller one. Every result is rounded with `Math.round`.
- `'end'` gives `whole − m − length`. `{ ofHeight }` is used for `y` only.
- Box numbers: `boxPadding = round(boxPaddingOfSmaller × S)`, `boxRadius = round(boxRadiusOfSmaller × S)`, `boxOutlineWidth = max(1, round(boxOutlineOfSmaller × S))` when the share is above 0, else 0. A text slot with no `textBox` gets the defaults of `TEXT_LOOK_DEFAULTS` (no box).
- `fontSize` is `startingFontSize` (below), at most `round(fontSizeOfSmaller × S)`.
- Picture slots with no `shade` get `shade: null`. `opacity` is 1 for a new layer.

## The five layouts

Text columns: largest size (share of S), weight, colour, align, line height, letter spacing, vertical align, all capitals, box (fill; outline colour and width share; radius share; padding share).

### 1. `photo-bottom-left` — "Photo, text at the bottom left" (the default)

"Text at the bottom left over a photo, with a dark shade from the bottom and an outlined button." After references 03 and 04.

Background: `fillColor` null; shade `#000000` from `bottom`, strength 0.7, reach 0.6.

| Slot | x | y | width | height |
|------|---|---|-------|--------|
| `subject-image` | centre | 0.14 H | side | side |
| `logo` | margin | margin | 0.14 S | 0.14 S |
| `headline` | margin | 0.62 H | inset | 0.22 H |
| `call-to-action` | margin | end | 0.42 S | 0.09 S |

| Slot | Size | Weight | Colour | Align | LH | LS | V | Caps | Box |
|------|------|--------|--------|-------|----|----|---|------|-----|
| `headline` | 0.075 | 700 | `#FFFFFF` | left | 1.1 | 0 | bottom | no | none |
| `call-to-action` | 0.035 | 600 | `#FFFFFF` | center | 1.2 | 0.02 | middle | no | no fill; `#FFFFFF`, 0.003; 0; 0.015 |

### 2. `photo-top-centre` — "Photo, headline at the top"

"A centred headline in capitals at the top, the subject in the middle and an outlined button at the bottom." After reference 01.

Background: `fillColor` null; shade `#000000` from `top`, strength 0.45, reach 0.5.

| Slot | x | y | width | height |
|------|---|---|-------|--------|
| `headline` | margin | 0.08 H | inset | 0.24 H |
| `subject-image` | centre | 0.36 H | side | side |
| `logo` | margin | end | 0.14 S | 0.14 S |
| `call-to-action` | centre | end | 0.32 S | 0.09 S |

| Slot | Size | Weight | Colour | Align | LH | LS | V | Caps | Box |
|------|------|--------|--------|-------|----|----|---|------|-----|
| `headline` | 0.08 | 500 | `#FFFFFF` | center | 1.1 | 0.04 | top | yes | none |
| `call-to-action` | 0.032 | 700 | `#FFFFFF` | center | 1.2 | 0.08 | middle | yes | no fill; `#FFFFFF`, 0.003; 0; 0.015 |

### 3. `flat-bottom-left` — "Flat colour, big headline"

"A flat warm colour, the subject at the top right and a large dark headline at the bottom left." After reference 05.

Background: `fillColor` `#FFD54A`; shade null.

| Slot | x | y | width | height |
|------|---|---|-------|--------|
| `subject-image` | end | margin | 0.6 S | 0.6 S |
| `logo` | margin | margin | 0.14 S | 0.14 S |
| `headline` | margin | 0.70 H | inset | 0.16 H |
| `call-to-action` | margin | end | inset | 0.07 S |

| Slot | Size | Weight | Colour | Align | LH | LS | V | Caps | Box |
|------|------|--------|--------|-------|----|----|---|------|-----|
| `headline` | 0.09 | 800 | `#2B2B2B` | left | 1.05 | −0.01 | bottom | no | none |
| `call-to-action` | 0.04 | 600 | `#D9480F` | left | 1.2 | 0 | top | no | none |

### 4. `flat-centre-top` — "Flat colour, headline above the subject"

"A light flat colour, the logo and a centred headline at the top, and the subject below, running off the bottom edge." After reference 02.

Background: `fillColor` `#F2F2F5`; shade null.

| Slot | x | y | width | height |
|------|---|---|-------|--------|
| `logo` | centre | margin | 0.14 S | 0.14 S |
| `headline` | margin | 0.22 H | inset | 0.18 H |
| `call-to-action` | margin | 0.41 H | inset | 0.05 H |
| `subject-image` | centre | 0.48 H | 0.7 S | 0.7 S |

| Slot | Size | Weight | Colour | Align | LH | LS | V | Caps | Box |
|------|------|--------|--------|-------|----|----|---|------|-----|
| `headline` | 0.075 | 700 | `#111111` | center | 1.1 | −0.01 | top | no | none |
| `call-to-action` | 0.035 | 500 | `#111111` | center | 1.2 | 0 | top | no | none |

### 5. `photo-label-box` — "Photo, text on a label"

"The headline on a white label at the bottom left and a dark filled button, with no shade."

Background: `fillColor` null; shade null.

| Slot | x | y | width | height |
|------|---|---|-------|--------|
| `subject-image` | centre | 0.12 H | side | side |
| `logo` | margin | margin | 0.14 S | 0.14 S |
| `headline` | margin | 0.60 H | inset | 0.24 H |
| `call-to-action` | margin | end | 0.42 S | 0.09 S |

| Slot | Size | Weight | Colour | Align | LH | LS | V | Caps | Box |
|------|------|--------|--------|-------|----|----|---|------|-----|
| `headline` | 0.07 | 700 | `#111111` | left | 1.1 | 0 | middle | no | `#FFFFFF`; no outline; 0.012; 0.03 |
| `call-to-action` | 0.035 | 600 | `#FFFFFF` | center | 1.2 | 0.02 | middle | no | `#111111`; no outline; 0.045; 0.015 |

### Why the boxes do not overlap

`W ≥ S` and `H ≥ S` for every size, so a box placed with `end` and a height of `k × S` starts at or below `H − (0.06 + k) × S ≥ (0.94 − k) × H`. For example the button of layout 1 starts at or below `0.85 H`, and the headline above it ends at `0.84 H`. A centred box of width `0.32 S` or more starts at or right of `0.34 S`, past a logo that ends at `0.20 S`. The LK-4 test checks every pair at the four ready-made sizes and at 50 × 8192 and 8192 × 50. The one overlap on purpose: layout 4's subject may run past the bottom edge, which the canvas cuts off.

## Applying a layout

`starterLayoutPatches(layout, size, layers)` returns the `updates` of one `layer.updateMany` for the variant [D-094]. Pure. It matches layers by `key`, which is the slot ID in every master and every variant made from it.

**Layouts when making variants** (Not built, MV-2 and MV-3). "Make variants" finds the source's layout from where its boxes sit (`layoutOfLayers`) and puts each box still on that layout where the layout puts it at the new size, through the same `geometryOf` and `frameOf`. It changes only geometry; text sizes are fitted by `spec/make-variants.md`, "Text that fits", from the layer's own style, not from the layout's text rules. "Layout…" itself does not change.

- **Which layers.** Each layer whose `key` is a slot the layout names, of the matching type (`text` for a copy slot, `image` for a picture slot), and the layer with key `background`. A locked layer is left out. A layer the layout does not name (a user-added layer, another slot) is left out. When nothing is left, the list is empty and the dialog says so.
- **Geometry.** `x`, `y`, `width`, `height` from the layout for this variant's size, and `rotation: 0`. `crop` is not sent: a crop stays, and the Scene draws it covering the new box. The background gets the whole canvas.
- **Text layers.** `style`: `fontSize` (from the layer's current copy and the new box), `fontWeight`, `color`, `align`, `lineHeight`, `letterSpacing` and all seven look fields, the defaults included, so a box from an earlier layout is removed. `fontAssetId` and `copy` are not sent: the user's font and text stay.
- **Picture layers.** `style: { shade }`. `opacity` and `source` are not sent.
- **Background.** `style: { fillColor, shade }`.

## The starting font size

`startingFontSize(copy, box, rule, frame)` (`src/shared/templates/starting-font-size.ts`), pure, no measuring. Called through `textLayoutStyleOf` by `buildMasterLayers` in the main process and by `starterLayoutPatches` in the window, so both give the same number. The fake layout provider does not use it: it sends the largest size.

**Inputs.** `copy` (trimmed; null counts as empty), the box's width and height, the rule's `fontSizeOfSmaller`, `lineHeight`, `letterSpacing`, `allCaps`, padding and outline.

**Numbers** (`FONT_ESTIMATE` in `default-layout.ts`): a letter is `0.6` of the font size wide, `0.7` in all capitals, and `1.0` for a letter of the Han, Hiragana, Katakana or Hangul scripts; a line is filled to `0.9` of its width (words wrap early); the smallest size is `0.02 × S`.

**Formula.**

1. Content area: `Wc = width − 2 × (padding + outline)`, `Hc = height − 2 × (padding + outline)`.
2. `max = round(fontSizeOfSmaller × S)`, `min = max(1, round(0.02 × S))`.
3. For one paragraph `p` (the copy split at line breaks), its width at size `f` is `f × Σ (w(c) + letterSpacing)` over its letters `c`, spaces included, with `w(c)` as above. Its lines: `max(1, ceil(width / (0.9 × Wc)))`.
4. `f` fits when `Σ lines × lineHeight × f ≤ Hc`, and the longest word (a run of letters with no space and no wide letter) times `(w + letterSpacing) × f` is at most `Wc`.
5. The size is the largest whole `f` from `max` down to `min` that fits; `min` when none fits or when `Wc` or `Hc` is 0 or less. An empty copy gives `max`.

The text may still not fit, for a long copy or an unusual font. The Scene's measurement then marks it, as for any text [REQ: FR-098].

**Worked values** (layout 1; the tests use them). Headline box at 1080 × 1080: 950 × 238, `max` 81, `min` 22. At 1080 × 1920: 950 × 422, the same `max` and `min`. Copy of plain words no longer than 9 letters:

| Copy length | 1080 × 1080 | 1080 × 1920 |
|-------------|-------------|-------------|
| 11 | 81 | 81 |
| 60 | 71 (3 lines) | 81 (4 lines) |
| 120 | 47 (4 lines) | 63 (6 lines) |
| 300 | 30 (7 lines) | 42 (9 lines) |
| 1,000 | 22 (`min`; does not fit) | 22 (16 lines, fits) |

Button of layout 1 at 1080 × 1080: box 454 × 97, padding 16, outline 3, so `Wc` 416 and `Hc` 59; `max` 38; letter spacing 0.02. "Shop now" (8 letters) gives 38; a 40-letter call to action gives 24 (2 lines).

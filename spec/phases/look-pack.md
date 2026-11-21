# Look pack — backgrounds, text boxes, shades and starter layouts

**Goal:** The ads made in the app can look like the five reference ads the stakeholder gave [D-094]: a flat background colour, a box behind text for buttons and labels, a shade over a photo so text stays readable, and better starting layouts.

**Exit criteria**

- Every layer stored before this work draws exactly as it did: every existing scene reference picture passes unchanged, with no new reference made for an old case.
- Each new style field is drawn the same in the editor, in thumbnails and in `variant.render` (the scene reference cases of LK-2 and LK-3).
- A new campaign's master uses the default starter layout, and a long campaign message no longer runs past the headline box at the four ready-made sizes (LK-4 tests, with the worked values of `spec/starter-layouts.md`).
- "Layout…" applies any starter layout to the open variant as one undo step (LK-6).
- Three of the five references (02, 03 and 04) rebuilt in the app by hand through the editor, with the fake provider and stored pictures, shown as screenshots (LK-7). The reference files themselves are never copied into the repository or used as pictures.

**Dependencies:** Phase 3 merged. P4-1 built. `layer.updateMany` comes from P4-7. See the wave table for each slice's Phase 4 neighbours.

**Design:** the style fields in `spec/data-model-campaign.md` ("layer", "Look fields"); drawing and measuring in `spec/scene.md` ("Text boxes", "Background colour and shade"); the patch and its checks in `spec/editor-commands.md` ("Look fields"); the panel and "Layout…" in `spec/editor.md`; the starter layouts and the starting font size in `spec/starter-layouts.md`. Assumptions A-71 to A-81 in `spec/assumptions.md`.

## Rules for these slices

- Every slice: write the failing tests first, then the code; run lint, typecheck and `npm test` in full; plus what its class asks (`spec/testing.md`). A slice that touches the renderer runs `npm run test:e2e` too.
- A slice edits only the files it owns and the existing files it may touch. A change needed elsewhere: stop and report.
- **No migration.** `style` is a JSON column, checked on read with the row schema (`src/main/db/rows.ts`). Every new field is optional in the schema, so a stored row without it still reads. Absent means the default, and every default draws as today.
- **No `.default()` in a style schema.** Zod 4 fills defaults inside `.partial()`, so a default in `TextStyle` or `ImageStyle` would put every default into every `layer.update` patch and overwrite stored values. Defaults are filled by `textLookOf` and `pictureLookOf` (`src/shared/config/look.ts`), never by the schema. LK-1 has a test for this.
- **No caller's string reaches CSS.** Every new colour is drawn from three whole numbers read out of a `#RRGGBB` value that passed `HEX_COLOUR` (`rgbCss`, `src/shared/scene/colour-css.ts`); a value that fails draws nothing for that part. Every number is clamped to its bounds before use. Every choice (`verticalAlign`, `shade.from`) goes through a fixed table. An outside AI agent can send `layer.update`, so the Scene treats each value as untrusted even after the schema check.
- **Shared files.** Only LK-1 edits `src/shared/schemas/layer.ts` (a frozen contract file; this change is designed here), `merge-patch.ts` and `inverse-patch.ts`. Only LK-4 edits `src/shared/config/default-layout.ts` and `master-layers.ts`. Only LK-2 and LK-3 edit `src/shared/scene/` and `tests/e2e/scene-cases.ts`, one after the other.
- **Screens** (D-084): one folder per component, CSS from tokens only, data through props or a store. A screen slice's edit to an existing component is a mount point of a few lines, named in the slice. A new token goes in `src/renderer/ui/tokens.css` in the slice that needs it (no Phase 4 slice edits that file after P4-1). Each screen slice adds `tests/shots/{slice}.shots.ts` (for example `tests/shots/lk-5.shots.ts`) and names its pictures in its report.
- Budget: one slice per developer run, well under 300k tokens; hand off with `HANDOFF.md` if near it.

## Order and side-by-side work

| Wave | Slice | Waits for | May run beside | Must not run beside |
|------|-------|-----------|----------------|---------------------|
| 1 | LK-1 Contracts | P4-1 (built) | Every Phase 4 slice | Nothing |
| 2 | LK-2 Scene: text boxes | LK-1 | Every Phase 4 slice, LK-4 | LK-3 (same Scene files and scene cases) |
| 2 | LK-4 Starter layouts and the starting font size | LK-1; P4-3 and P4-7 merged (both read `default-layout.ts` and test against its values) | LK-2, LK-3, Phase 4 screen slices | P4-3, P4-7 |
| 3 | LK-3 Scene: background colour and shade | LK-2 | LK-4, every Phase 4 slice | LK-2 |
| 4 | LK-5 Panel fields | LK-1; LK-2 and LK-3 for its shots | LK-4, LK-6 | P4-13 (`properties-panel/`), P4-19 (`picture-fields/`) |
| 4 | LK-6 "Layout…" | LK-4; P4-7 (`layer.updateMany`); P4-16 (`top-bar/`, `editor/editor/`) | LK-5 | P4-16 |
| 5 | LK-7 Three references rebuilt, the exit check | Every other LK slice | Phase 4 slices | Nothing |

No two slices of one wave edit the same file: wave 2 splits by folder (`src/shared/scene/` against `src/shared/config/` and `src/shared/templates/`); wave 4 by component (the properties panel and picture fields against the top bar and the new dialog).

## Slices

### LK-1 — Contracts: the look fields, their defaults and the patch checks (built)

- **Exists when done:** `TextStyle` has `verticalAlign`, `allCaps`, `boxColor`, `boxOutlineColor`, `boxOutlineWidth`, `boxRadius`, `boxPadding`; `ImageStyle` has `fillColor` and `shade`; all optional, bounded, with no `.default()`. `LOOK_LIMITS`, `SHADE_SIDES`, `VERTICAL_ALIGNS` and `Shade` are exported from `layer.ts`. `textLookOf` and `pictureLookOf` fill the defaults. `layer.update` and `layer.updateMany` take the new fields through the existing patch; `fillColor` on an image layer is refused; the inverse holds defaults for absent fields; a patch that only sets a field to its default on a row without the field changes nothing. `rgbCss` turns a checked colour into CSS.
- **New files:** `src/shared/config/look.ts` (`TEXT_LOOK_DEFAULTS`, `PICTURE_LOOK_DEFAULTS`, `NEW_SHADE`, `textLookOf`, `pictureLookOf`); `src/shared/scene/colour-css.ts` (`rgbCss(hex, alpha?)`).
- **May touch:** `src/shared/schemas/layer.ts`; `src/main/commands/layer/merge-patch.ts`, `inverse-patch.ts`, `update.ts` (the "nothing changed" comparison only); `src/shared/schemas/commands/layer.ts` only if the union order needs it (it should not: the new names differ between the two styles).
- **Read:** `spec/data-model-campaign.md` "layer" ("Look fields"); `spec/editor-commands.md` "Rules for every layer and variant command", "`layer.update`" ("Look fields"); `spec/data-model.md` "Frozen contract files".
- **Tests:** `tests/unit/shared/schemas/look-fields.test.ts` (each field: a good value, each bound, a bad colour, an unknown side or align, `shade` with an unknown key; a stored text style and picture style without the fields parse; `TextStyle.partial()` and `ImageStyle.partial()` parse `{}` to `{}`, the Zod 4 guard); `tests/unit/shared/config/look.test.ts` (`textLookOf` and `pictureLookOf` fill each absent field and keep each present one); `tests/unit/shared/scene/colour-css.test.ts` (`#1A2B3C` gives `rgb(26 43 60)`; alpha clamped to 0..1 and written with at most 4 decimals; `red`, `#FFF`, `#12345G`, `url(x)` and a value with a semicolon give null); `tests/integration/commands/layer-update-look.test.ts` (each field saved on the right layer type and read back; `fillColor` on an image layer refused with "Those style values do not fit this layer."; a picture field on a text layer and a text field on a picture layer refused; `shade` replaced whole and `null` clears it; on a row stored without the fields, `{ boxColor: null }` changes nothing and adds no undo entry; undo of `{ boxColor: '#FFFFFF' }` on such a row gives `boxColor: null`; `revs.style` bumped once; the agent's call accepted the same). Approved edits: none expected; a test that compares a whole stored style may add the new fields if it fails only for that.
- **Class:** A + B. Security class, short review (new fields an agent can send; the colour rule). **After:** nothing.

### LK-2 — Scene: text boxes, vertical alignment, all capitals (built)

- **Exists when done:** a text layer draws its box (fill, outline, radius, padding), places its text top, middle or bottom, and draws all capitals when asked, as `spec/scene.md` "Text boxes" says. The overflow test measures the text against the box's inner area. Old layers draw pixel for pixel as before.
- **New files:** `src/shared/scene/text-box-css.ts` (`textBoxCss(style)`, the outer box), `src/shared/scene/measure-text.ts` (`measuredText(box, text, padding)`, the values `measureOverflow` takes).
- **May touch:** `src/shared/scene/text-layer.tsx`, `text-style.ts` (`text-transform`), `scene.tsx` (the settle step measures the inner element); `tests/e2e/scene-cases.ts` (new cases); `tests/reference-pictures/darwin/` (the new pictures only).
- **Read:** `spec/scene.md` "Text layers", "Text boxes", "Settling and the overflow measurement"; `spec/testing.md` "Reference pictures".
- **Tests:** `tests/unit/shared/scene/text-box-css.test.ts` (each field to its CSS; defaults give no fill, no border, radius 0, padding 0, `flex-start`; a bad colour gives no fill; numbers out of bounds clamped; nothing of a field's text appears in the CSS except through `rgbCss`); `tests/unit/shared/scene/measure-text.test.ts` (padding and outline narrow the area; bottom-aligned text taller than the box is caught; a long word is caught); `text-style.test.ts` gains `text-transform` (approved addition). Scene reference cases (class C), new pictures: `text-box-button` (outlined, middle, centred), `text-box-label` (filled, radius, padding, left, bottom), `text-all-caps`, `text-box-overflow-bottom` (bottom-aligned text that does not fit: drawn past the top, flagged). Every existing case passes with its existing picture.
- **Class:** C. Security class, short review (caller values becoming CSS). **After:** LK-1.

### LK-3 — Scene: background colour and shade (built)

- **Exists when done:** a background layer draws its `fillColor` under its picture; a background or image layer draws its `shade` over its picture, inside its box, as `spec/scene.md` "Background colour and shade" says. Old layers draw as before.
- **New files:** `src/shared/scene/shade-css.ts` (`shadeCss(shade)`, `SHADE_STOPS`).
- **May touch:** `src/shared/scene/picture-layer.tsx`; `tests/e2e/scene-cases.ts` (new cases); `tests/reference-pictures/darwin/` (the new pictures only).
- **Read:** `spec/scene.md` "Pictures", "Background colour and shade"; `spec/testing.md` "Reference pictures".
- **Tests:** `tests/unit/shared/scene/shade-css.test.ts` (each side to its gradient direction; the three stops at `reach`; `all` gives a plain colour; strength and reach clamped; a bad colour gives nothing); scene reference cases (class C), new pictures: `background-colour-no-picture`, `background-colour-under-transparent-picture` (a PNG with a transparent part shows the colour), `shade-bottom-on-photo`, `shade-all-on-image-layer` (with the layer turned 15°, the shade turns and is cut with the box), `image-past-the-edge` (an image layer half outside the canvas, cut off at the edge, as reference 02). Every existing case passes with its existing picture.
- **Class:** C. Security class, short review. **After:** LK-2.

### LK-4 — Starter layouts and the starting font size (built)

- **Exists when done:** five starter layouts exist as data (`spec/starter-layouts.md`); a new master is built from the default one, every new layer stores every look field, and each text layer's starting font size comes from its text's length; `starterLayoutPatches` turns a layout into `layer.updateMany` updates for a variant.
- **New files:** `src/shared/config/starter-layouts.ts` (`STARTER_LAYOUTS`, `DEFAULT_STARTER_LAYOUT_ID`); `src/shared/templates/layout-rules.ts` (`frameOf`, `geometryOf`, `textStyleOf`, moved out of `master-layers.ts` so both users share them); `src/shared/templates/starting-font-size.ts`; `src/shared/templates/starter-layout-patches.ts`.
- **May touch:** `src/shared/config/default-layout.ts` (the default layout's values, `'end'`, `TextBoxRule`, `StarterLayout`, `FONT_ESTIMATE`; `OTHER_COPY_TEXT` written out with today's values so an added text layer keeps today's look); `src/shared/templates/master-layers.ts`.
- **Read:** `spec/starter-layouts.md` (all of it); `spec/brief-and-templates.md` "The default layout and `buildMasterLayers`"; `spec/data-model-campaign.md` "Look fields".
- **Tests:** `tests/unit/shared/templates/starting-font-size.test.ts` (every worked value; an empty copy gives the largest size; a copy with two paragraphs counts both; a Japanese copy counts each letter as 1 em and has no long word; content area at or below 0 gives the smallest); `tests/unit/shared/config/starter-layouts.test.ts` (five layouts, unique IDs, the default among them; every colour passes `HEX_COLOUR`; for each layout at the four ready-made sizes and at 50 × 8192 and 8192 × 50, every box has a width and height of at least 1 and the named slots do not overlap except where the layout says a box runs off an edge); `tests/unit/shared/templates/starter-layout-patches.test.ts` (one update per named layer; a locked layer and a layer the layout does not name left out; text patches hold no `fontAssetId` and no `copy`; the background gets the whole canvas, rotation 0, its colour and shade; crop untouched; an image layer gets its shade, opacity untouched; the result passes `layerUpdateManyInput`). Approved edits: `master-layers.test.ts`, `master-layers-fields.test.ts`, `new-layer.test.ts`, `tests/integration/campaigns/campaign-create-fills.test.ts` (the new boxes, styles and look fields), and the worked-values table those tests hold.
- **Class:** A + B. Not security class. **After:** LK-1, P4-3, P4-7.

### LK-5 — Panel fields: box, shade, background colour (built)

- **Exists when done:** the properties panel shows the "Box" section for text layers, the "Shade" section for picture and background layers, and "Background colour" in the Picture section of the background, as `spec/editor.md` "Properties panel" says; each saves with one `layer.update`. Selection handles of a layer that reaches past the canvas edge are drawn past it.
- **New files:** `src/renderer/editor/colour-choice/` (a labelled `#RRGGBB` field, picker, palette swatches and an optional "None"); `src/renderer/editor/text-box-fields/`; `src/renderer/editor/shade-fields/` (with `percent-slider.tsx`); `src/renderer/editor/background-colour-field/`.
- **May touch:** `src/renderer/editor/properties-panel/properties-panel.tsx` (mount `TextBoxFields` after `TextFields` and `ShadeFields` after `PictureFields`, passing the palette; a few lines); `src/renderer/editor/picture-fields/picture-fields.tsx` (mount `BackgroundColourField` for the background, a few lines, with a `palette` prop passed through); `src/renderer/editor/canvas-view/canvas-view.module.css` (`.box` becomes `overflow: visible`; the Scene's root already cuts the ad at its edge).
- **Read:** `spec/editor.md` "Properties panel", "Canvas"; `spec/screens.md` "Rules for every screen"; `spec/data-model-campaign.md` "Look fields".
- **Tests:** `tests/unit/renderer/editor/colour-choice.test.tsx` (a bad hex goes back; "None" sends null; a swatch sends its colour; label; axe); `text-box-fields.test.tsx` (each field sends one `layer.update` with that field only; bounds; the values shown for a layer stored without the fields are the defaults; locked disables all; axe); `shade-fields.test.tsx` (None to a side sends `NEW_SHADE` with that side; changing one value sends the whole shade; the slider sends once on release; "Reach" disabled for "Whole picture"; None sends `shade: null`; axe); `background-colour-field.test.tsx` (shows `#000000` when the field is absent; background only; axe); `properties-panel` and `picture-fields` tests gain the new sections (approved additions). Shots: `tests/shots/lk-5.shots.ts` (a text layer with an outlined box; the shade fields over a photo; the background colour field; a layer half past the canvas edge with its handles).
- **Class:** D. Not security class. **After:** LK-1, LK-2, LK-3.

### LK-6 — "Layout…": apply a starter layout to the open variant (built)

- **Exists when done:** "Layout…" in the editor's top bar opens a dialog listing the starter layouts with a small preview of the open variant in each; "Apply" sends one `layer.updateMany` built by `starterLayoutPatches`, so one undo step. "Place text with AI…" is disabled while a layout run this editor started for the variant is going.
- **New files:** `src/renderer/editor/layout-button/`; `src/renderer/dialogs/layout-dialog/` (`layout-dialog.tsx`, `layout-preview.tsx`, `apply-patches.ts`: the layers with the updates merged, for the previews only).
- **May touch:** `src/renderer/editor/top-bar/` (a slot for the button, a few lines); `src/renderer/editor/editor/` (passes the button its variant, layers and assets, a few lines).
- **Read:** `spec/editor.md` "Top bar", "Layout…"; `spec/starter-layouts.md` "Applying a layout"; `spec/ai-jobs.md` "Layout proposal" (the `layer.updateMany` rules).
- **Tests:** `tests/unit/renderer/dialogs/layout-dialog.test.tsx` (lists five layouts by name and description, the first chosen; Apply sends one `layer.updateMany` with `starterLayoutPatches`' result and closes; a refusal shows its message and the dialog stays; a variant whose named layers are all locked shows "This layout changes no layer here." with Apply disabled; Cancel and Escape send nothing; axe); `tests/unit/renderer/dialogs/apply-patches.test.ts`; `top-bar` test gains the button (approved addition). Shots: `tests/shots/lk-6.shots.ts` (the dialog; a variant before and after each layout at 1080 × 1080 and 1080 × 1920).
- **Class:** D. Not security class. **After:** LK-4, P4-7, P4-16.

### LK-7 — Three references rebuilt, and the exit check (built)

All look-pack slices are built; the spec's `Not built` marks for them are turned to `Built`. Left for the stakeholder: the three looks by hand, and Windows.

- **Exists when done:** the exit criteria above pass; the spec's `Not built` marks for the look pack are listed for the orchestrator to turn to `Built`.
- **New files:** `tests/shots/lk-7.shots.ts`; pictures it needs in `tests/fixtures/look-pack/` (photos the project may keep, or made by the fake provider; never the reference files).
- **Read:** this file; `spec/editor.md` "Properties panel"; `spec/test-harnesses.md`; the reference pictures 02, 03 and 04 in `design/references/`, looked at only.
- **Tests:** `lk-7.shots.ts`, with `ADMAN_FAKE_PROVIDERS=1`, drives the editor as a user would (picture chooser, panel fields, "Layout…", canvas drags, no command sent by the script itself) to build: **02** a light flat background colour, a dark centred headline, and a picture layer running off the right and bottom edges; **03** a photo background with a dark shade from the bottom and white text at the bottom left; **04** a photo background, white text at the bottom left and an outlined button. One screenshot of each at 1080 × 1920, plus the shade and outline close up. The developer lists the stakeholder's hand checks: the same three by hand, and Windows (D-087).
- **Class:** D (shots) + G (end to end). Not security class. **After:** every other LK slice.

## Left for later phases

One line each; the full lines are in `spec/scene.md`, "Left for later phases".

- **Fan-out and links (Phase 5):** the new fields are part of `style`, so they follow the master and are overridden as style; fan-out copies them as they are.
- **Translation (Phase 6):** copies them unchanged; all capitals applies to the translated text as drawn.
- **Video and export (Phases 7 and 8):** `overlay-only` leaves out the background layer, so its colour and shade too; text over a video must keep the background's shade.
- **MCP tools (Phase 10):** the layer tools take the new fields with the same checks.
- **AI layout proposal (Phase 4):** not changed now. A later slice may let it choose a starter layout, a text box or a shade.

## Not designed

On purpose, not part of the look pack [D-094]: a free shape layer; gradients between two chosen colours; text shadow; blend modes; styling single words inside one text layer; choosing a layout when a campaign is created (A-77).

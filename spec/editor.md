# Editor and navigation

How the user lays out a post by hand: the campaign and variant tabs, the editor screen (canvas, layer list, properties panel), moving, resizing, rotating, cropping, snapping, keyboard shortcuts, fonts, undo and redo, and several picture layers per variant. Read with `spec/scene.md` (the drawing), `spec/editor-commands.md` (the commands it sends), `spec/screens.md` (rules for every screen and the list of choices made without a sign-off) and `spec/structure.md` (the renderer layout rule).

Everything here is Built (Phase 3, slices P3-9 to P3-16). The commands, queries and events it uses are built (`spec/editor-commands.md`), and so is the Scene it draws with (`spec/scene.md`). Screens are built without a design sign-off [D-084]: each component has its own folder and CSS module, takes every colour, space, radius and type size from `src/renderer/ui/tokens.css`, and gets its data through props or a store. Each look-and-feel choice is listed in `spec/screens.md`.

## Where the code lives

```
src/renderer/
├── app/            app-shell/ (changed), project-switcher/, campaign-tabs/ [use-tab-keys.ts],
│                   nav-context.tsx
├── screens/campaign/       campaign-view/ (changed), variant-tabs/, variant-grid/ (changed),
│                           variant-tile/ (changed)
├── screens/project-home/   campaign-list/ (changed)
├── editor/         editor/ [use-history.ts, use-overflow-report.ts], top-bar/, editor-banner/,
│                   canvas-view/ [use-area-size.ts],
│                   canvas-overlay/ [use-canvas-drag.ts, use-layer-keys.ts, send-geometry.ts],
│                   crop-overlay/ [crop-bar.tsx, crop-math.ts, use-crop-mode.ts, use-crop-drag.ts],
│                   layer-list/ [use-layer-actions.ts, use-row-drag.ts, stack-order.ts,
│                   focus-copy-field.ts], layer-row/ [name-field.tsx, row-actions.tsx, thumb.tsx],
│                   properties-panel/ [use-layer-actions.ts, use-palette.ts], layer-fields/,
│                   text-fields/ [copy-field.tsx, colour-field.tsx], font-field/,
│                   picture-fields/ [picture-preview.tsx, opacity-field.tsx, background-fit.ts],
│                   geometry-fields/, number-field/ [use-draft.ts],
│                   use-editor-key.ts, zoom.ts, geometry-math.ts, snap.ts, nudge.ts
├── dialogs/        picture-chooser/ [picture-grid.tsx, use-pictures.ts]
├── stores/         nav-store.ts, variant-store.ts
└── ui/             tokens.css (Phase 3 tokens), shortcuts.ts, tab-row/, tab-marks/,
                    variant-thumbnail/ [use-thumbnail.ts]
```

Not built (look pack, `spec/phases/look-pack.md`): `editor/colour-choice/`, `editor/text-box-fields/`, `editor/shade-fields/` [percent-slider.tsx], `editor/background-colour-field/` (LK-5); `editor/layout-button/`, `dialogs/layout-dialog/` [layout-preview.tsx, apply-patches.ts] (LK-6).

Each name ending in `/` is a component folder (OI-80): the component, its CSS module and `index.ts`. Files in brackets sit inside that folder. `number-field/` also hands out `useDraft`, which the name, copy, colour and opacity fields use. The loose `.ts` files in `editor/` are helpers several editor components use. Pure helpers (`zoom.ts`, `geometry-math.ts`, `snap.ts`, `nudge.ts`, `crop-math.ts`, `shortcuts.ts`) hold no React and are unit-tested. Picking a layer under a point is `pickLayer` in `geometry-math.ts`. `nav-context.tsx` gives the window's nav store to the components below it. `ui/tab-row/` is the row of tabs with a close button beside each, used by the campaign tabs and the variant tabs; `ui/tab-marks/` draws the job marks on both.

## Navigation: campaign tabs and variant tabs

[REQ: FR-003, FR-211 to FR-214, FR-218, FR-242]. Builds on the assumption of OI-31.

### The shell

- The top row: the **project switcher** on the left, then the **campaign tabs** of the shown project, then "Settings" (and "Hand test" with dev tools) on the right. Project tabs go.
- **Project switcher** (`app/project-switcher/`): a menu button showing the shown project's name, or "Adman" on the start screen. Its menu lists the open projects (choosing one shows it), then "Start" (the start screen: new, open, recent), then "Close project" for the shown one (`project.close`, with today's refusal when jobs run). Several projects stay open in the main process; one is shown at a time [REQ: FR-003].
- **Campaign tabs** (`app/campaign-tabs/`, Radix Tabs, label "Open campaigns"): first a fixed tab "Project" (the project home: campaign list, brief intake, libraries), then one tab per open campaign named after it, each with a close button ("Close {name}"), then a "+" button ("Open or start a campaign") that shows the Project tab. Opening a campaign from the project home adds its tab, or shows it if open [REQ: FR-211].
- A campaign tab shows the campaign's job marks (built in `campaign.get`): "Running" or a dot for "finished, not looked at" [REQ: FR-218], each with a text label for screen readers.

### Variant tabs

- Inside a campaign tab (`screens/campaign/variant-tabs/`): first "Overview" (the grid of variants and, below it, the picture and video panels and run list as they are built), then one tab per open variant, named "{title} · {sizeLabel} · {language}", each with a close button. The content of a variant tab is the editor [REQ: FR-212].
- **The grid and its tiles** come from the Phase 2 leftovers: `screens/campaign/variant-grid/` and `screens/campaign/variant-tile/` (slice S2-16, `spec/screens-campaign.md`). The tile takes `preview` (P3-16 passes the thumbnail) and `actions` (P3-10 passes the "+" button, drawn beside the tile's main button, never inside it).
- **Opening a variant** from a grid tile: a plain click opens its tab (or shows it if open) and shows it. A small "+" button beside the tile ("Open {title} in a tab") and Cmd-click (Ctrl-click on Windows) open the tab behind the current one and keep the overview showing [REQ: FR-214, Q-041].
- **Which variant the overview's panels work on** (A-47): the variant shown last in its own tab. Opening a tab behind does not change it. Before any variant tab has been shown, it is the first variant of the grid. That tile is drawn pressed (`aria-pressed`), and a line above the panels reads "Runs and panels below are for: {title} · {sizeLabel} · {language}".
- A variant tab shows that variant's job marks, and a "needs attention" mark when it is out of date (always false until Phase 5) [Q-042].
- Closing a variant tab removes the tab only; the variant and its undo list stay [REQ: FR-212]. A variant deleted from elsewhere loses its tab.

### What each tab keeps

`stores/nav-store.ts`, one zustand store for the window. Kept while the project stays open, dropped when it closes, not saved between launches (OI-31).

- Per project: the open campaign tabs in order, and which tab shows (`'project'` or a campaign ID).
- Per campaign: the open variant tabs in order, and which shows (`'overview'` or a variant ID).
- Per variant tab: the selected layer ID (or none) and the zoom (`'fit'` or a percentage) [REQ: FR-213].

### Keys for the tabs

[REQ: FR-242]. Next and previous variant tab: **Ctrl+Tab** and **Ctrl+Shift+Tab**, on both systems (Ctrl on macOS too). Next and previous campaign tab: **Cmd+Shift+]** and **Cmd+Shift+[** on macOS, **Ctrl+Shift+]** and **Ctrl+Shift+[** on Windows. "Overview" counts as a variant tab and "Project" as a campaign tab. Both wrap round at the ends. They work wherever the focus is, text fields included (A-23).

## The editor screen

[REQ: FR-090 to FR-098, 8.9 Editor]

### Layout

`editor/editor/` lays out a grid, after the accepted prototype:

```
+--------------------------------------------------------------+
| top bar                                                      |
| banner (when there is one)                                   |
+-------------+----------------------------------+-------------+
| layer list  | canvas                           | properties  |
| (left)      | (centre, canvas bar at the foot) | (right)     |
+-------------+----------------------------------+-------------+
```

The side widths are tokens (`--editor-layers-width`, `--editor-props-width`). Phase 7 adds a timeline row along the foot.

### The variant store

`stores/variant-store.ts`, one store per open variant tab.

- Holds the variant row (`VariantSummary`), its campaign ID, its layers by ID, the assets the layers name, one `version` number per asset, and the **draft**: the moving values of one layer during a drag or nudge.
- Loads with `variant.get`. Applies `project.changed` for its project: the variant row with its ID; layer rows with its `variantId`; removed layer IDs; asset rows it holds. A changed layer that names an asset the store lacks makes it read `variant.get` again. A `variant.get` reply that started before the last event touching this variant is dropped and the query is sent again.
- `asset.changedOnDisk` raises the `version` of each named asset it holds, so the Scene loads it again.
- The window never applies a change before the main process confirms it, apart from the draft. The draft is dropped when the drag ends, whatever the reply.

### Top bar

`editor/top-bar/`.

- The title, with "Rename" (an inline field; Enter saves with `variant.update`, Escape cancels). A "Master" mark when the variant is a master.
- A line "{sizeLabel} · {width} × {height} px · {language} · {format}".
- "Undo" and "Redo" buttons, disabled from `history.state { projectId, scope: 'variant:{id}' }`, read again after every `project.changed` naming the variant and after each undo or redo [REQ: FR-095].
- **"Layout…"** (Not built, LK-6) [D-094], after "Place text with AI…": opens the layout dialog (`dialogs/layout-dialog/`, a Radix dialog, title "Choose a layout"). It lists the starter layouts (`spec/starter-layouts.md`) as a group of choices, each with its name, its one-sentence description and a small preview: the Scene in `full` mode, the variant's layers with that layout's updates merged in, scaled to fit 160 px. The first is chosen when it opens. A line reads "Locked layers stay as they are." "Apply" sends one `layer.updateMany { variantId, updates }` built by `starterLayoutPatches`, so one undo step, and closes. A refusal shows the command's message in the dialog (`role="alert"`) and it stays open. When the chosen layout changes no layer: "This layout changes no layer here." and Apply is disabled. "Cancel" and Escape send nothing.

### Banner

`editor/editor-banner/`. At most one line, the first that applies:

1. A file is missing: "A file this variant uses cannot be found. Relink it from the project page."
2. Text does not fit [REQ: FR-098]. For one layer: "1 text layer does not fit its box. Make the box larger, the text smaller, or shorten the text." For several: "{n} text layers do not fit their box. Make the box larger, the text smaller, or shorten the text."

The line is a status message (`role="status"`), so a screen reader reads it when it changes.

### Canvas

`editor/canvas-view/` (the Scene and zoom) and `editor/canvas-overlay/` (selection, handles, guides, placeholders).

- **The Scene** is drawn in `full` mode from the store's layers with the draft merged in, at variant pixels, scaled by the zoom from its top-left corner inside a box of the scaled size. The box is centred in the canvas area when smaller, and the area scrolls when larger. The area around it is the backdrop colour.
- **Zoom** (`zoom.ts`): `'fit'` (the default; the largest scale with `--space-6` round the canvas) or one of 25, 33, 50, 67, 75, 100, 150, 200, 300, 400 %. Zoom in and out step to the next value from the current scale. The canvas bar at the foot shows "{width} × {height} px", "Zoom out", the zoom ("Fit" or "{n}%", a button that sets fit) and "Zoom in".
- **The overlay** lies over the Scene at the same scale and handles the pointer. It draws, in screen pixels whatever the zoom:
  - the selected layer's box, turned with the layer, as a dark line with a light line on each side, with eight square resize handles and one round rotation handle 24 px above the top edge (none of them for a locked layer);
  - a dotted box with no handles for a selected layer that is hidden;
  - for every visible image layer with no picture, a dashed box with "Empty picture" in it (the Scene draws nothing there);
  - for every visible text layer with `overflow` true, a dashed box in the danger colour;
  - the snapping guides during a drag.
- **Past the edge** (Not built, LK-5). A layer may lie partly outside the canvas (`spec/scene.md`, "Boxes"). The canvas box (`canvas-view`, `.box`) is `overflow: visible`, as in crop mode, so the selection box and handles of such a layer are drawn past the edge over the backdrop; the Scene's root still cuts the ad at its edge. Picking and dragging still start only on the canvas.
- **Measuring.** On the Scene's `onSettled`, when there is no draft, the editor sends `layer.reportOverflow` for each text layer whose result differs from its stored `overflow`, with the store's `variant.rev` (`spec/scene.md`).

### Selecting

- One layer is selected at a time (A-28). The selection is kept per variant tab.
- A click picks the topmost layer that is visible, not locked, and whose turned box holds the point (`geometry-math.ts`, worked out from the geometry, not from the page). The background is picked when nothing above it is, unless it is hidden or locked; then nothing is picked. A click on the backdrop, or Escape, clears the selection. The click that ends a drag picks nothing.
- A locked or hidden layer is selected from the layer list only.

### Moving, resizing and rotating

[REQ: FR-092]. Drag state lives in the variant store's draft; on release the editor sends **one** `layer.update` holding only the changed `geometry` fields [`spec/data-rules.md`, "Dragging"]. A refused update drops the draft and the error shows in the banner of the app. Escape during a drag cancels it and sends nothing.

- **Move:** press on the selected layer, or on another layer (which selects it), and drag. Nothing moves until the pointer has gone 3 screen pixels.
- **Resize:** drag a handle. The box changes along the layer's own turned sides, and the opposite side or corner stays put. Shift keeps the box's shape (a side handle then grows the box about the middle of the other side). Width and height stay at least 1 pixel.
- A locked layer has no handles, and a hidden one has none either; neither can be moved, resized or turned on the canvas.
- **Rotate:** drag the rotation handle; the angle is measured from the box's centre. Shift steps by 15°. Stored folded into (−180, 180].
- **Nudge:** arrow keys move the selected layer (not a locked one) 1 pixel, Shift and an arrow 10 pixels. Presses are gathered in the draft and sent as one `layer.update` 500 ms after the last press, or when the selection changes (`nudge.ts`). So holding a key adds one undo entry.
- The background layer moves, resizes, turns and crops like any picture layer: its geometry is where its picture goes [REQ: FR-077]. It cannot be deleted or reordered.

### Snapping and guides

[REQ: FR-096]. `snap.ts`, pure.

- While moving, the moving box's left edge, centre and right edge (of its axis-aligned bounds when turned) snap to these lines on the x axis: the canvas's left edge, centre and right edge, and the left edge, centre and right edge of every other visible layer's axis-aligned bounds. The same on the y axis with top, middle and bottom.
- While resizing, only the edges that move snap, to the same lines. A resize does not snap when the box is turned (its edges are not its sides) or when Shift keeps its shape.
- A line within 6 screen pixels (6 ÷ zoom variant pixels) snaps; the nearest line wins on each axis on its own.
- For each axis that snapped, a guide is drawn across the whole canvas, 1 screen pixel wide, in the guide colour.
- Holding Alt (Option) during a drag turns snapping off for that moment. Rotation and nudging do not snap.

### Crop mode

Built. [REQ: FR-077, FR-094]. `editor/crop-overlay/`, mounted by `editor/canvas-view/`.

- **Starting.** A double-click on a picture or background layer that has a picture, or "Crop…" in the Picture section. Never for a locked layer, a text layer, a picture layer with no picture, or a picture whose file is missing. A double-click picks a layer as a click does, so it passes through a locked or hidden layer to the one below it. Starting selects the layer.
- **What shows.** The whole picture at its current place, dimmed outside the crop, with the crop as a rectangle with eight handles. Dragging inside moves it; handles resize it. A turned layer is cropped in its own turned frame. The crop keeps the shape of the layer's box, so it fills the box exactly (`spec/scene.md`, `placePicture`), and it stays inside the picture. The picture's own size is the loaded picture's natural size.
- **Where the crop starts.** The largest area of the box's shape in the middle of the current crop, or of the whole picture when there is no crop.
- **The strip.** While cropping, a strip above the canvas (never over it, so it cannot cover the handles) shows "Crop {layer name}", the hint "Drag or use the arrows to move the crop. Shift and the arrows resize it.", "Cancel" and "Done". "Done" is disabled until the picture has loaded.
- **Done and Cancel.** Enter or "Done" sends one `layer.update { geometry: { crop } }` in source pixels, so one undo step. Nothing is sent when the crop is the one the layer already has. Escape or "Cancel" sends nothing. Both leave crop mode. The file itself is never changed.
- **Reset crop.** "Reset crop" in the Picture section shows only when a crop is set, and sends `layer.update { geometry: { crop: null } }`.
- **Keyboard.** The crop rectangle takes the focus and is labelled "Crop, {layer name}", described by the hint. The arrows move it by 1 box pixel. Shift+Right or Shift+Up makes it larger, and Shift+Left or Shift+Down smaller, by 10 box pixels of width about its middle; it then moves back inside the picture if it has to. While it has the focus, Delete, Duplicate, Bring forward and Send backward do nothing.
- **While cropping** the normal overlay is off: no handles, no move, resize, rotate or nudge. A click on the backdrop does nothing.
- **Crop mode ends** when the layer is no longer selected, is locked, is deleted, or loses its picture. Nothing is sent then.

## Keyboard shortcuts

[REQ: FR-097, FR-242]. The key combinations have one owner, `src/renderer/ui/shortcuts.ts`: `SHORTCUTS`, a table of named shortcuts (built), and `matchShortcut(press, name, platform)`, which compares the key press's `code` (from `event.code`: the key's place, so `BracketRight` whatever the layout) and the modifier keys, which must match exactly. Each shortcut has an `inFields` flag: when true it also works inside a text field, number field, select or text area. "Mod" is Cmd on macOS and Ctrl on Windows. A component registers a handler for a named shortcut with `useEditorKey(name, handler)` (`editor/use-editor-key.ts`); no component reads key codes itself.

| Action | Keys | Notes |
|--------|------|-------|
| Undo, redo | Mod+Z; Mod+Shift+Z (also Ctrl+Y on Windows) | The variant's list |
| Delete the selected layer | Delete or Backspace | Not the background; not a locked layer |
| Duplicate | Mod+D | Not the background. See "Duplicate" below |
| Nudge | Arrows (1 px); Shift+arrows (10 px) | Not a locked layer. In crop mode the arrows move the crop and Shift+arrows resize it |
| Bring forward, send backward | Mod+] ; Mod+[ | One step, `layer.reorder` |
| Zoom in, zoom out, zoom to fit | Mod+= ; Mod+- ; Mod+0 | |
| Clear selection, cancel a drag, leave crop mode | Escape | |
| Apply a crop | Enter | In crop mode |
| Save the copy | Mod+Enter | In the Copy field |
| Next, previous variant tab | Ctrl+Tab ; Ctrl+Shift+Tab | Both systems |
| Next, previous campaign tab | Mod+Shift+] ; Mod+Shift+[ | |

- **Duplicate** (Mod+D, or "Duplicate" in the properties panel) sends one `layer.create` with the layer's type and values: its copy or picture, style, geometry moved 20 px right and down, and its Visible and Locked states. The name is "{name} copy". The new layer goes on top. A locked layer can be duplicated, the background cannot. Mod+D also selects the new layer and shortens the name so it stays within 100 characters; the panel's button does neither.
- Editor shortcuts work while the focus is anywhere in the shown variant tab, except inside a text field, number field, select or text area, where the field keeps its own keys (its own undo included). Escape, the tab keys and Mod+Enter in the Copy field always work.
- **The app menu.** The app sets its own menu (`src/main/windows/app-menu.ts`): on macOS the app menu (About, Hide, Quit), and on both systems Edit (Undo, Redo, Cut, Copy, Paste, Select All, as roles, so text fields keep working) and Window (Minimize, Close). It has no View menu, so Mod+=, Mod+- and Mod+0 never zoom the whole page, and no reload. With the hand-test flag on it adds "Toggle Developer Tools". The editor calls `preventDefault` on every shortcut it handles. **Check first** (in slice P3-9): Mod+Z pressed with the canvas focused reaches the page's `keydown`, and with `preventDefault` the Edit menu's Undo does not also act. If not, stop and report.

## Layer list

`editor/layer-list/` and `editor/layer-row/`. [REQ: FR-090, FR-092]

- Heading "Layers", with "Add text layer" and "Add picture layer" buttons. Each sends `layer.create`, selects the new layer, and for text puts the focus in the Copy field.
- Rows top to bottom from the highest `z`; the background last, marked "Stays at the bottom", with no delete and no drag.
- A row: a small picture of an image or background layer (from `assetUrl`, 32 px, whole picture shown) or a "T" mark for text; the name; "Empty" for an image layer with no picture; "Does not fit" for a text layer with `overflow`; "File not found" when its picture or font is missing. A hidden layer's small picture is drawn faded.
- **Row buttons:** "Hide {name}" / "Show {name}" (`aria-pressed`), "Lock {name}" / "Unlock {name}" (`aria-pressed`) and "Delete {name}". Each toggle sends `layer.update`; Delete sends `layer.delete`. The buttons show while the row is selected, pointed at, or holds the focus. Otherwise only "Show" on a hidden layer and "Unlock" on a locked layer stay, so the state is still seen. The background and a locked layer have no Delete.
- Clicking a row selects its layer. Each row is a button. The list itself takes no focus: Up and Down, read while a row's button has the focus, select the row above or below and move the focus to it. F2 on a row's button starts a rename.
- **Rename:** double-click the name, or press F2 on a focused row: an inline field labelled "Layer name". Enter saves (`layer.update { name }`), and so does leaving the field; Escape cancels. An empty or unchanged name sends nothing. The focus then goes back to the row.
- **Reorder:** drag a row; a line shows where it will land (above or below the row under the pointer); dropping sends one `layer.reorder`. Dropping a row on the background row puts that layer at the bottom of the stack, just above the background. A drop that did not start in the list does nothing. By keyboard: Mod+] and Mod+[, or "Bring forward" and "Send backward" in the properties panel.
- Delete or Backspace deletes the selected layer (not the background, not a locked layer).

## Properties panel

`editor/properties-panel/` with one component per section. Every field saves with one `layer.update` when the user presses Enter or leaves the field, never on each keystroke. A refused value shows the command's message under the field, and the field goes back to the stored value. Number fields (`editor/number-field/`) take whole numbers unless a step says otherwise and step with the arrow keys.

- **Nothing selected:** "Select a layer to change it."
- **Header:** the layer's name and its kind ("Text", "Picture", "Background").
- **Sections**, each a group with a visible title: "Layer", "Text settings" (text layers), "Picture" (image and background layers), "Position and size". The sections are drawn afresh for each layer, so an unsaved edit or a refusal message does not carry over to another layer.
- **A locked layer:** every field and button is shown but disabled, except the "Locked" check box (to unlock it) and "Duplicate".
- **Layer** (`layer-fields/`): Name (an empty name goes back to the stored one); "Visible" and "Locked" check boxes; "Bring forward", "Send backward", "Duplicate" and "Delete layer" (none of these four for the background). "Bring forward" is disabled for the top layer and "Send backward" for the lowest above the background.
- **Text settings** (`text-fields/`, text layers) [REQ: FR-093, FR-249]:
  - "Copy": a text area; saves on leaving it or with Mod+Enter.
  - "Font" (`font-field/`, below).
  - "Size" (px, at least 1); "Weight" (a select: Thin 100, Extra light 200, Light 300, Regular 400, Medium 500, Semibold 600, Bold 700, Extra bold 800, Black 900), with the hint "Weight changes only fonts that have more than one weight."
  - "Colour": a `#RRGGBB` field, a colour picker (`<input type="color">`), and one button per colour of the campaign's palette (from `campaign.get`'s rule set), each labelled "Palette colour {hex}".
  - "Align": Left, Centre, Right (a group of three pressed buttons).
  - "Line height" (a multiple, step 0.05, 0.5 to 4); "Letter spacing" (em, step 0.01, −0.2 to 1).
  - When the text does not fit: "This text does not fit its box." It is never shrunk for the user (no "Shrink to fit"; G-1 not built).
- **Picture** (`picture-fields/`, image and background layers) [REQ: FR-094]:
  - The picture (small, whole) and its display name as text, or "Empty picture".
  - "Choose picture…" opens the picture chooser. "Remove picture" sets `source` to null.
  - "Crop…" (crop mode; disabled with no picture or a missing file) and, when a crop is set, "Reset crop".
  - "Opacity": a slider and a number field, both 0 to 100 %, stored 0 to 1. The number field saves on Enter or on leaving it. The slider saves once when it is let go (pointer up, key up, or leaving it), never while it moves, so a drag is one undo step.
  - Background only: "Fill the canvas" (geometry = the whole canvas, rotation 0, crop null) and "Fit inside" (geometry = the largest box of the picture's shape inside the canvas, centred, rotation 0, crop null; x, y, width and height are rounded to whole pixels, width and height at least 1). Each is one `layer.update`. "Fit inside" is disabled until the picture's size is known (from the asset row, or from the loaded picture when the row has none).
  - Background only, Not built (LK-5): "Background colour" (`background-colour-field/`), a `colour-choice` with the palette and no "None", with the hint "Shows under the picture." A layer with no colour shows `#000000`, which is how it draws.
- **Box** (`text-box-fields/`, text layers, after "Text settings"; Not built, LK-5) [D-094]: "Vertical align": Top, Middle, Bottom (three pressed buttons); "All capitals" (a check box); "Box colour" and "Outline colour" (`colour-choice`, each with the palette and a "None" button that sends null); "Outline width" (px, 0 to 100); "Corner radius" and "Padding" (px, 0 to 2,000). A layer stored without these fields shows the defaults.
- **Shade** (`shade-fields/`, image and background layers, after "Picture"; Not built, LK-5) [D-094]: "Shade", a select: None, From the bottom, From the top, From the left, From the right, Whole picture. Choosing a side when there is none sends `NEW_SHADE` (`src/shared/config/look.ts`) with that side; None sends `shade: null`. Then "Colour" (`colour-choice`, palette, no "None"), "Strength" (0 to 100 %) and "Reach" (5 to 100 %, disabled for Whole picture), each a slider and a number field that save as "Opacity" does. Every change sends the whole `shade`.
- `colour-choice/` (Not built, LK-5) is the labelled colour field these use: a `#RRGGBB` field, a colour picker and one button per palette colour ("Palette colour {hex}"), as the text "Colour" field, plus an optional "None". The text "Colour" field is not changed.
- **Position and size** (`geometry-fields/`, every layer): X, Y, W, H (px) and Rotation (°). W and H are read out as "Width" and "Height". Each field sends only its own geometry value; width and height are at least 1. These are the keyboard path for every canvas action [REQ: 8.6].

### Picture chooser

`dialogs/picture-chooser/`, a Radix dialog. Title "Choose a picture for {layer name}".

- A grid of the asset library's pictures (`asset.list { projectId, library: 'asset', kind: 'image' }`), each a button with the picture and its display name. A missing one is shown disabled with "file not found". Empty: "No pictures in the asset library yet."
- "Import pictures…": `dialog.pickFiles { purpose: 'import', kind: 'image', multiple: true }`, then `asset.import { projectId, paths, library: 'asset', copy: false }`, then the list is read again. A cancelled picker sends nothing.
- Choosing a picture sends `layer.update { source: { assetId } }` and closes. A refused choice shows the command's message in the dialog (`role="alert"`) and the dialog stays open. While a choice is being sent, the pictures, "Import pictures…", "Cancel" and the dialog's close are disabled. "Cancel" closes and sends nothing. The list is read again at each opening.

### Fonts: upload and choice

`editor/font-field/`. [REQ: FR-056, FR-093]

- A select labelled "Font": "Default font (Inter)", then every font asset of the asset library (`asset.list { projectId, library: 'asset', kind: 'font' }`), labelled with its `fontFamily`, or its display name when that is null; a missing one says "(file not found)". When the layer's font is not in that list, one more choice, "Font not in the asset library", stands for it and is shown chosen. Choosing sends `layer.update { style: { fontAssetId } }` (null for the default).
- "Upload font…": `dialog.pickFiles { purpose: 'import', kind: 'font', multiple: false }`, then `asset.import { projectId, paths, library: 'asset', copy: false }`, then `layer.update` with the new asset as the font. A refused import shows its message and changes nothing.
- The "I am allowed to share this font" choice [REQ: FR-162] stays for the publish work of Phase 9.

## Undo and redo per variant

[REQ: FR-095, R-17]

- The editor's undo and redo act on the shown variant's list only (`history.undo` and `history.redo` with scope `variant:{id}`). Every layer command and `variant.update` puts its inverse there. A drag, a nudge burst, a crop or a field change is one entry.
- A refused undo or redo shows its message in the error banner (`spec/api-principles.md`).
- After an undo that removes the selected layer, nothing is selected.
- Campaign-scope undo (Phase 5) is not in the editor.

## Several picture layers per variant

The smallest design Phase 3 needs (Q-032 answered yes; A-26).

- **Made by** `layer.create` with `type: 'image'`: key `layer-{ulid}`, `slot` null, no picture yet. As many as the user wants; there is no limit. Added text layers work the same way.
- **An empty picture layer is a normal saved state.** The Scene draws nothing for it; the editor shows a placeholder; it does not stop anything in Phase 3.
- **Filled** by the picture chooser (`layer.update` with `source`). Generating into it uses `generation.runImages` with its `layerId`, which already works; the panel that offers it per layer is Phase 4's.
- **A cut-out** is a picture with a transparent background. It is drawn like any picture and keeps its transparency [REQ: FR-245]. Making one inside the app is Phase 4 (`spec/ai-jobs.md`, "Cut-out"; the button in `spec/screens-ai.md`).
- **What a master's template holds** does not change: a template lists slots only. An added layer belongs to the variant, not to the template.
- **Left for later:** Phase 5 treats an added layer on a master like any master layer, by its key (fan-out copies it; sync offers it as "add-layer"); only the background gets a fit choice in fan-out. Phase 8 decides whether an empty picture layer gives an export warning.

## Thumbnails on the screens

`ui/variant-thumbnail/`: props `projectId`, `variantId`, `rev`, `alt`. It sends `thumbnail.get`; on `pending` it waits for `thumbnail.changed` for that variant and asks again; when `rev` changes it asks again. It shows the PNG through an object URL (allowed by `img-src blob:`), freed when replaced or removed. `failed`, or a refused `thumbnail.get`, shows the words "No preview". A reply to an older ask is dropped. While a draw is pending it draws nothing, so the parent's box keeps its size.

- Used by each variant tile of the campaign grid, with an empty `alt` (the tile's own text names the variant), and on the project home by each campaign row, showing the master of its first direction, with `alt` "Cover of {campaign name}". `CampaignSummary` has `cover: { variantId: string; rev: number } | null` for this: `campaignCover` in `src/main/queries/campaign.ts` works it out, and `project.get` (`src/main/queries/project.ts`) fills it in for each campaign.

## Accessibility

[REQ: 8.6]. Every control is a Radix part or a native element with a visible label or `aria-label`. The canvas is a focusable region labelled "Canvas, {title}". Every canvas action has a keyboard path through the layer list and the properties panel. Focus rings are never removed. Axe-core finds no violation in the editor, the layer list, the properties panel, the picture chooser, or the tabs.

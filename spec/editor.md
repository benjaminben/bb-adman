# Editor and navigation

How the user lays out a post by hand: the campaign and variant tabs, the editor screen (canvas, layer list, properties panel), moving, resizing, rotating, cropping, snapping, keyboard shortcuts, fonts, undo and redo, and several picture layers per variant. Read with `spec/scene.md` (the drawing), `spec/editor-commands.md` (the commands it sends), `spec/screens.md` (rules for every screen and the list of choices made without a sign-off) and `spec/structure.md` (the renderer layout rule).

Everything here is Not built (Phase 3). The commands, queries and events it uses are built (`spec/editor-commands.md`), and so is the Scene it draws with (`spec/scene.md`). Screens are built without a design sign-off [D-084]: each component has its own folder and CSS module, takes every colour, space, radius and type size from `src/renderer/ui/tokens.css`, and gets its data through props or a store. Each look-and-feel choice is listed in `spec/screens.md`.

## Where the code lives

```
src/renderer/
├── app/            app-shell/ (changed), project-switcher/, campaign-tabs/
├── screens/campaign/   campaign-view/ (changed), variant-tabs/
├── editor/         editor/, top-bar/, editor-banner/, canvas-view/, canvas-overlay/, crop-overlay/,
│                   layer-list/, layer-row/, properties-panel/, layer-fields/, text-fields/,
│                   font-field/, picture-fields/, geometry-fields/, number-field/,
│                   use-editor-key.ts, zoom.ts, geometry-math.ts, snap.ts, nudge.ts
├── dialogs/        picture-chooser/
├── stores/         nav-store.ts, variant-store.ts
└── ui/             tokens.css (Phase 3 tokens), shortcuts.ts, variant-thumbnail/
```

`editor/` folders are components (OI-80); the `.ts` files are helpers several editor components use. Pure helpers (`zoom.ts`, `geometry-math.ts`, `snap.ts`, `nudge.ts`, `shortcuts.ts`) hold no React and are unit-tested.

## Navigation: campaign tabs and variant tabs

[REQ: FR-003, FR-211 to FR-214, FR-218, FR-242]. Builds on the assumption of OI-31.

### The shell

- The top row: the **project switcher** on the left, then the **campaign tabs** of the shown project, then "Settings" (and "Hand test" with dev tools) on the right. Project tabs go.
- **Project switcher** (`app/project-switcher/`): a menu button showing the shown project's name, or "Adman" on the start screen. Its menu lists the open projects (choosing one shows it), then "Start" (the start screen: new, open, recent), then "Close project" for the shown one (`project.close`, with today's refusal when jobs run). Several projects stay open in the main process; one is shown at a time [REQ: FR-003].
- **Campaign tabs** (`app/campaign-tabs/`, Radix Tabs, label "Open campaigns"): first a fixed tab "Project" (the project home: campaign list, brief intake, libraries), then one tab per open campaign named after it, each with a close button ("Close {name}"), then a "+" button ("Open or start a campaign") that shows the Project tab. Opening a campaign from the project home adds its tab, or shows it if open [REQ: FR-211].
- A campaign tab shows the campaign's job marks (built in `campaign.get`): "Running" or a dot for "finished, not looked at" [REQ: FR-218], each with a text label for screen readers.

### Variant tabs

- Inside a campaign tab (`screens/campaign/variant-tabs/`): first "Overview" (the grid of variants and, below it, the picture and video panels and run list as they are built), then one tab per open variant, named "{title} · {sizeLabel} · {language}", each with a close button. The content of a variant tab is the editor [REQ: FR-212].
- **The grid and its tiles** come from the Phase 2 leftovers: `screens/campaign/variant-grid/` and `screens/campaign/variant-tile/` (slice S2-16, `spec/screens-campaign.md`). The tile takes `preview` (P3-16 passes the thumbnail) and `actions` (P3-10 passes the "+" button, drawn beside the tile's main button, never inside it). Before Phase 3 a click on the tile chooses the variant the overview's panels work on (A-47).
- **Opening a variant** from a grid tile: a plain click opens its tab (or shows it if open) and shows it. A "+" button on the tile ("Open {title} in a tab") and Cmd-click (Ctrl-click on Windows) open the tab behind and keep the overview showing [REQ: FR-214, Q-041].
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

### Banner

`editor/editor-banner/`. At most one line, the first that applies:

1. A file is missing: "A file this variant uses cannot be found. Relink it from the project page."
2. Text does not fit: "{n} text layer(s) do not fit their box. Make the box larger, the text smaller, or shorten the text." [REQ: FR-098]

### Canvas

`editor/canvas-view/` (the Scene and zoom) and `editor/canvas-overlay/` (selection, handles, guides, placeholders).

- **The Scene** is drawn in `full` mode from the store's layers with the draft merged in, at variant pixels, scaled by the zoom from its top-left corner inside a box of the scaled size. The box is centred in the canvas area when smaller, and the area scrolls when larger. The area around it is the backdrop colour.
- **Zoom** (`zoom.ts`): `'fit'` (the default; the largest scale with `--space-6` round the canvas) or one of 25, 33, 50, 67, 75, 100, 150, 200, 300, 400 %. Zoom in and out step to the next value from the current scale. The canvas bar at the foot shows "{width} × {height} px", "Zoom out", the zoom ("Fit" or "{n}%", a button that sets fit) and "Zoom in".
- **The overlay** lies over the Scene at the same scale and handles the pointer. It draws, in screen pixels whatever the zoom:
  - the selected layer's box, turned with the layer, as a dark line with a light line on each side, with eight square resize handles and one round rotation handle 24 px above the top edge (none of them for a locked layer);
  - a dotted box for a selected layer that is hidden;
  - for every image layer with no picture, a dashed box with "Empty picture" in it (the Scene draws nothing there);
  - for every text layer with `overflow` true, a dashed box in the danger colour;
  - the snapping guides during a drag.
- **Measuring.** On the Scene's `onSettled`, when there is no draft, the editor sends `layer.reportOverflow` for each text layer whose result differs from its stored `overflow`, with the store's `variant.rev` (`spec/scene.md`).

### Selecting

- One layer is selected at a time (A-28). The selection is kept per variant tab.
- A click picks the topmost layer that is visible, not locked, and whose turned box holds the point (`geometry-math.ts`, worked out from the geometry, not from the page). The background is picked when nothing above it is. A click on the backdrop, or Escape, clears the selection.
- A locked or hidden layer is selected from the layer list only.

### Moving, resizing and rotating

[REQ: FR-092]. Drag state lives in the variant store's draft; on release the editor sends **one** `layer.update` holding only the changed `geometry` fields [`spec/data-rules.md`, "Dragging"]. A refused update drops the draft and the error shows in the banner of the app. Escape during a drag cancels it and sends nothing.

- **Move:** press on the selected layer, or on another layer (which selects it), and drag. Nothing moves until the pointer has gone 3 screen pixels.
- **Resize:** drag a handle. The box changes along the layer's own turned sides, and the opposite side or corner stays put. Shift keeps the box's shape. Width and height stay at least 1 pixel.
- **Rotate:** drag the rotation handle; the angle is measured from the box's centre. Shift steps by 15°. Stored folded into (−180, 180].
- **Nudge:** arrow keys move the selected layer 1 pixel, Shift and an arrow 10 pixels. Presses are gathered in the draft and sent as one `layer.update` 500 ms after the last press, or when the selection changes (`nudge.ts`). So holding a key adds one undo entry.
- The background layer moves, resizes, turns and crops like any picture layer: its geometry is where its picture goes [REQ: FR-077]. It cannot be deleted or reordered.

### Snapping and guides

[REQ: FR-096]. `snap.ts`, pure.

- While moving, the moving box's left edge, centre and right edge (of its axis-aligned bounds when turned) snap to these lines on the x axis: the canvas's left edge, centre and right edge, and the left edge, centre and right edge of every other visible layer's axis-aligned bounds. The same on the y axis with top, middle and bottom.
- While resizing, only the edges that move snap, to the same lines.
- A line within 6 screen pixels (6 ÷ zoom variant pixels) snaps; the nearest line wins on each axis on its own.
- For each axis that snapped, a guide is drawn across the whole canvas, 1 screen pixel wide, in the guide colour.
- Holding Alt (Option) during a drag turns snapping off for that moment. Rotation and nudging do not snap.

### Crop mode

[REQ: FR-077, FR-094]. `editor/crop-overlay/`.

- Started by double-clicking a picture layer that has a picture, or by "Crop…" in the properties panel. Not for a locked layer.
- The whole picture is shown at its current place, dimmed outside the crop, with the crop as a rectangle with eight handles. Dragging inside moves it; handles resize it. The crop keeps the shape of the layer's box, so it fills the box exactly (`spec/scene.md`, `placePicture`). It stays inside the picture. The picture's own size is the loaded picture's natural size.
- Enter or "Done" sends one `layer.update { geometry: { crop } }` in source pixels. Escape or "Cancel" leaves it unchanged. The file itself is never changed.
- "Reset crop" in the properties panel sets `crop` to null.

## Keyboard shortcuts

[REQ: FR-097, FR-242]. The key combinations have one owner, `src/renderer/ui/shortcuts.ts`: `SHORTCUTS`, a table of named shortcuts (built), and `matchShortcut(press, name, platform)`, which compares the key press's `code` (from `event.code`: the key's place, so `BracketRight` whatever the layout) and the modifier keys, which must match exactly. Each shortcut has an `inFields` flag: when true it also works inside a text field, number field, select or text area. "Mod" is Cmd on macOS and Ctrl on Windows. A component registers a handler for a named shortcut with `useEditorKey(name, handler)` (`editor/use-editor-key.ts`); no component reads key codes itself.

| Action | Keys | Notes |
|--------|------|-------|
| Undo, redo | Mod+Z; Mod+Shift+Z (also Ctrl+Y on Windows) | The variant's list |
| Delete the selected layer | Delete or Backspace | Not the background; not a locked layer |
| Duplicate | Mod+D | `layer.create` with the layer's values, name "{name} copy", moved 20 px right and down, on top |
| Nudge | Arrows (1 px); Shift+arrows (10 px) | |
| Bring forward, send backward | Mod+] ; Mod+[ | One step, `layer.reorder` |
| Zoom in, zoom out, zoom to fit | Mod+= ; Mod+- ; Mod+0 | |
| Clear selection, cancel a drag, leave crop mode | Escape | |
| Apply a crop | Enter | In crop mode |
| Save the copy | Mod+Enter | In the Copy field |
| Next, previous variant tab | Ctrl+Tab ; Ctrl+Shift+Tab | Both systems |
| Next, previous campaign tab | Mod+Shift+] ; Mod+Shift+[ | |

- Editor shortcuts work while the focus is anywhere in the shown variant tab, except inside a text field, number field, select or text area, where the field keeps its own keys (its own undo included). Escape, the tab keys and Mod+Enter in the Copy field always work.
- **The app menu.** The app sets its own menu (`src/main/windows/app-menu.ts`): on macOS the app menu (About, Hide, Quit), and on both systems Edit (Undo, Redo, Cut, Copy, Paste, Select All, as roles, so text fields keep working) and Window (Minimize, Close). It has no View menu, so Mod+=, Mod+- and Mod+0 never zoom the whole page, and no reload. With the hand-test flag on it adds "Toggle Developer Tools". The editor calls `preventDefault` on every shortcut it handles. **Check first** (in slice P3-9): Mod+Z pressed with the canvas focused reaches the page's `keydown`, and with `preventDefault` the Edit menu's Undo does not also act. If not, stop and report.

## Layer list

`editor/layer-list/` and `editor/layer-row/`. [REQ: FR-090, FR-092]

- Heading "Layers", with "Add text layer" and "Add picture layer" buttons. Each sends `layer.create`, selects the new layer, and for text puts the focus in the Copy field.
- Rows top to bottom from the highest `z`; the background last, marked "Stays at the bottom", with no delete and no drag.
- A row: a small picture of an image or background layer (from `assetUrl`, 32 px, whole picture shown) or a text mark; the name; "Empty" for an image layer with no picture; "Does not fit" for a text layer with `overflow`; "File not found" when its picture or font is missing; a button "Hide {name}" / "Show {name}" (`aria-pressed`) and a button "Lock {name}" / "Unlock {name}" (`aria-pressed`). Each toggle sends `layer.update`.
- Clicking a row selects its layer. Up and Down arrows move between rows while the list has the focus.
- **Rename:** double-click the name, or press F2 on a focused row: an inline field; Enter saves (`layer.update { name }`), Escape cancels.
- **Reorder:** drag a row; a line shows where it will land; dropping sends one `layer.reorder`. By keyboard: Mod+] and Mod+[, or "Bring forward" and "Send backward" in the properties panel.

## Properties panel

`editor/properties-panel/` with one component per section. Every field saves with one `layer.update` when the user presses Enter or leaves the field, never on each keystroke. A refused value shows the command's message under the field, and the field goes back to the stored value. Number fields (`editor/number-field/`) take whole numbers unless a step says otherwise and step with the arrow keys.

- **Nothing selected:** "Select a layer to change it."
- **Header:** the layer's name and its kind ("Text", "Picture", "Background").
- **Layer** (`layer-fields/`): Name; "Visible" and "Locked" check boxes; "Bring forward", "Send backward", "Duplicate" and "Delete layer" (none of these four for the background). A locked layer's other fields are shown but disabled.
- **Text** (`text-fields/`, text layers) [REQ: FR-093, FR-249]:
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
  - "Crop…" (crop mode) and, when a crop is set, "Reset crop".
  - "Opacity": a slider and a number, 0 to 100 %, stored 0 to 1.
  - Background only: "Fill the canvas" (geometry = the whole canvas, rotation 0, crop null) and "Fit inside" (geometry = the largest box of the picture's shape inside the canvas, centred, rotation 0, crop null). Each is one `layer.update`.
- **Position and size** (`geometry-fields/`, every layer): X, Y, W, H (px) and Rotation (°). These are the keyboard path for every canvas action [REQ: 8.6].

### Picture chooser

`dialogs/picture-chooser/`, a Radix dialog. Title "Choose a picture for {layer name}".

- A grid of the asset library's pictures (`asset.list { projectId, library: 'asset', kind: 'image' }`), each a button with the picture and its display name. A missing one is shown disabled with "file not found". Empty: "No pictures in the asset library yet."
- "Import pictures…": `dialog.pickFiles { purpose: 'import', kind: 'image', multiple: true }`, then `asset.import { projectId, paths, library: 'asset', copy: false }`, then the list is read again. A cancelled picker sends nothing.
- Choosing a picture sends `layer.update { source: { assetId } }` and closes. "Cancel" closes and sends nothing.

### Fonts: upload and choice

`editor/font-field/`. [REQ: FR-056, FR-093]

- A select labelled "Font": "Default font (Inter)", then every font asset of the asset library (`asset.list { projectId, library: 'asset', kind: 'font' }`), labelled with its `fontFamily`, or its display name when that is null; a missing one says "(file not found)". Choosing sends `layer.update { style: { fontAssetId } }` (null for the default).
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
- **A cut-out** is a picture with a transparent background. It is drawn like any picture and keeps its transparency [REQ: FR-245]. Making a cut-out inside the app is not designed (S-12, OI-55).
- **What a master's template holds** does not change: a template lists slots only. An added layer belongs to the variant, not to the template.
- **Left for later:** Phase 5 treats an added layer on a master like any master layer, by its key (fan-out copies it; sync offers it as "add-layer"); only the background gets a fit choice in fan-out. Phase 8 decides whether an empty picture layer gives an export warning.

## Thumbnails on the screens

`ui/variant-thumbnail/`: props `projectId`, `variantId`, `rev`, `alt`. It sends `thumbnail.get`; on `pending` it waits for `thumbnail.changed` for that variant and asks again; when `rev` changes it asks again. It shows the PNG through an object URL (allowed by `img-src blob:`), freed when replaced or removed. `failed` shows the words "No preview". It draws nothing else.

- Used by each variant tile of the campaign grid, and on the project home by each campaign row, showing the master of its first direction. `CampaignSummary` gains `cover: { variantId: string; rev: number } | null` for this.

## Accessibility

[REQ: 8.6]. Every control is a Radix part or a native element with a visible label or `aria-label`. The canvas is a focusable region labelled "Canvas, {title}". Every canvas action has a keyboard path through the layer list and the properties panel. Focus rings are never removed. Axe-core finds no violation in the editor, the layer list, the properties panel, the picture chooser, or the tabs.

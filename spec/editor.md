# Editor and navigation

How the user lays out a post by hand: the campaign and variant tabs, the editor screen (canvas, layer list, properties panel), moving, resizing, rotating, cropping, snapping, keyboard shortcuts, fonts, undo and redo, and several picture layers per variant. Read with `spec/scene.md` (the drawing), `spec/editor-commands.md` (the commands it sends), `spec/screens.md` (rules for every screen and the list of choices made without a sign-off) and `spec/structure.md` (the renderer layout rule).

Everything here is Built (Phase 3, slices P3-9 to P3-16, then the look pack, Round 2 and the design wave's ED-1a to ED-6). The commands, queries and events it uses are built (`spec/editor-commands.md`), and so is the Scene it draws with (`spec/scene.md`). Each component has its own folder and CSS module, takes every colour, space, radius and type size from `src/renderer/ui/tokens.css`, uses the shared parts of `src/renderer/ui/` (`spec/app-style-parts.md`), and gets its data through props or a store. Each look-and-feel choice is listed in `spec/screens.md`.

## Where the code lives

```
src/renderer/
├── app/            app-shell/, project-switcher/, campaign-tabs/ [use-tab-keys.ts],
│                   nav-context.tsx
├── screens/campaign/       campaign-view/, campaign-overview/, variant-tabs/, variant-grid/,
│                           variant-tile/
├── screens/project-home/   campaign-list/
├── editor/         editor/ [use-history.ts, use-overflow-report.ts], top-bar/ [title-field.tsx],
│                   format-fields/ [length-field.tsx], editor-banner/,
│                   canvas-view/ [use-area-size.ts],
│                   canvas-overlay/ [use-canvas-drag.ts, use-layer-keys.ts, send-geometry.ts],
│                   crop-overlay/ [crop-bar.tsx, crop-math.ts, use-crop-mode.ts, use-crop-drag.ts],
│                   layer-list/ [use-layer-actions.ts, use-row-drag.ts, stack-order.ts,
│                   focus-copy-field.ts], layer-row/ [name-field.tsx, row-actions.tsx,
│                   row-marks.tsx, row-menu.tsx, thumb.tsx],
│                   properties-panel/ [panel-top.tsx, use-layer-actions.ts, use-palette.ts],
│                   text-fields/ [copy-field.tsx, suggest-copy.tsx, type-section.tsx,
│                   type-rows.tsx, icon-segments.tsx], font-field/, type-styles/,
│                   text-box-fields/, translation-status/, language-font/,
│                   picture-fields/ [picture-preview.tsx, picture-bar.tsx, bar-buttons.ts,
│                   background-fit.ts, cut-out.tsx], background-colour-field/, shade-fields/,
│                   generate-panel/, generate-fields/, earlier-options/,
│                   geometry-fields/, number-field/ [use-draft.ts], animation-fields/,
│                   timeline/, transport-bar/, sound-fields/, time-ruler/, playhead/,
│                   layer-tracks/, timing-bar/, clip-track/, clip-block/ [clip-actions.tsx],
│                   add-clip/, clip-preview/, sound-player/, layout-button/,
│                   use-editor-key.ts, zoom.ts, geometry-math.ts, snap.ts, nudge.ts
├── dialogs/        picture-chooser/ [picture-grid.tsx, use-pictures.ts], layout-dialog/
├── stores/         nav-store.ts, variant-store.ts, playback-store.ts
└── ui/             tokens.css (Phase 3 tokens), shortcuts.ts, tab-row/, tab-marks/,
                    variant-thumbnail/ [use-thumbnail.ts], swatch-field/, slider-field/
```

`editor/colour-choice/` is no longer used by any panel (the panels use `ui/swatch-field/`).

Each name ending in `/` is a component folder (OI-80): the component, its CSS module and `index.ts`. Files in brackets sit inside that folder. `number-field/` also hands out `useDraft`, which the name and copy fields use, and takes `inline`, `unit` and `prefix`. The loose `.ts` files in `editor/` are helpers several editor components use. Pure helpers (`zoom.ts`, `geometry-math.ts`, `snap.ts`, `nudge.ts`, `crop-math.ts`, `shortcuts.ts`) hold no React and are unit-tested. Picking a layer under a point is `pickLayer` in `geometry-math.ts`. `nav-context.tsx` gives the window's nav store to the components below it. `ui/tab-row/` is the row of tabs with a close button beside each, used by the campaign tabs and the variant tabs; `ui/tab-marks/` draws the job marks on both.

## Navigation: campaign tabs and variant tabs

[REQ: FR-003, FR-211 to FR-214, FR-218, FR-242]. Builds on the assumption of OI-31.

### The shell

- The frame (`app/app-shell/`) is a grid of two rows: the top row, then one cell for the content, which the activity panel shares at its right end.
- The top row: the **project switcher** on the left, then the **campaign tabs** of the shown project, then the "Activity" and "Settings" icon buttons on the right. The start screen has no top row (`spec/screens.md`, "Shell").
- **Project switcher** (`app/project-switcher/`): a menu button showing the shown project's name, or "AdManager" on the start screen. With two or more projects open a chip with the number follows, and the button is named "{name} {n} projects open". Its menu: one item per open project (named by the project; choosing one shows it with its own tabs and place), each with "Close {name}" at its end; a separator; "Package…" (shown project only), "Open…" (the project picker, then `project.open`; the new one is shown, the others stay open) and "Start screen". Several projects stay open in the one window; one is shown at a time [REQ: FR-003].
- **Which project shows** (R2P-9, R2P-10). The window changes the shown project only: when its own `project.open` or `project.create` succeeds; on the first state read at start (the newest open project, for a system open before the window loaded); on a click in the switcher or the start screen's "Recent"; and on the event `app.showProject { projectId }`. The main process sends `app.showProject` after a system open: a double-click on a project file, or a second launch, which the single-instance lock hands to the running app (on macOS the file paths go across in the lock's extra data, at most 20 absolute `.adman` paths). Opening a project that is already open shows it. A project an agent makes (`create_project`) is listed in the switcher and not shown, so the user is never taken away from their work.
- **Closing a project** (`project-switcher/close-project.tsx`, `useCloseProject`): it sends `project.close`. Refused with reason `jobs_running`, it clears the error banner and asks, in a `DialogFrame kind="confirm"`, "Close {project}?" with the warning "{n} runs are still going in this project. Closing stops them." (one: "1 run is still going in this project. Closing stops it.") "Requests already sent to a paid provider may still be charged, and their results are lost." Buttons "Keep open" (sends nothing) and "Stop and close" (`project.close { runningJobs: 'stop' }`), both disabled while it sends.
- **Campaign tabs** (`app/campaign-tabs/`, Radix Tabs, label "Open campaigns"): first a fixed tab "Project" (the project home), then one tab per open campaign named after it, each with a close button ("Close {name}"), then a "+" button named "New campaign" that opens the New campaign page on the Project tab. Opening a campaign from the project home adds its tab, or shows it if open [REQ: FR-211].
- A campaign tab shows the campaign's job marks (built in `campaign.get`): "Running" or a dot for "finished, not looked at" [REQ: FR-218], each with a text label for screen readers.

### Variant tabs

- Inside a campaign tab, one tab strip named "Campaign" (`screens/campaign/campaign-overview/` and `variant-tabs/`): the campaign views "Variants", "Checks" and "Translations" (`spec/screens-campaign.md`, "The campaign head and the tab strip"), a divider, then one tab per open variant, named "{sizeLabel} · {language}" (with the title first only when titles differ), each with a close button. The content of a variant tab is the editor [REQ: FR-212].
- **The grid and its tiles**: `screens/campaign/variant-grid/` and `screens/campaign/variant-tile/` (`spec/screens-variants.md`). The tile takes `preview` (the thumbnail), `actions` and `footer`, drawn in the strip under the tile's main button, never inside it.
- **Opening a variant** from a grid tile: a click selects it; a double-click, or Enter on it, opens its tab (or shows it if open) [R2C-3]. "Open in a tab" in the tile's More menu, Cmd-click (Ctrl-click on Windows) and Mod+Enter open the tab behind the current one and keep the campaign view showing [REQ: FR-214, Q-041].
- **The selected variant** (A-47): a click or an arrow key selects; opening a variant in any way selects it. Opening a tab behind does not change it. At the start it is the master. That tile is drawn pressed (`aria-pressed`).
- A variant tab shows that variant's job marks, and a "needs attention" mark when it is out of date (from the `outOfDate` badge) [Q-042].
- Closing a variant tab removes the tab only; the variant and its undo list stay [REQ: FR-212]. A variant deleted from elsewhere loses its tab.

### What each tab keeps

`stores/nav-store.ts`, one zustand store for the window. Kept while the project stays open, dropped when it closes, not saved between launches (OI-31).

- Per project: the open campaign tabs in order, and which tab shows (`'project'` or a campaign ID).
- Per campaign: the open variant tabs in order, and which shows (`'overview'`, the campaign views, or a variant ID).
- Per variant tab: the selected layer ID (or none) and the zoom (`'fit'` or a percentage) [REQ: FR-213].

### Keys for the tabs

[REQ: FR-242]. Next and previous variant tab: **Ctrl+Tab** and **Ctrl+Shift+Tab**, on both systems (Ctrl on macOS too). Next and previous campaign tab: **Cmd+Shift+]** and **Cmd+Shift+[** on macOS, **Ctrl+Shift+]** and **Ctrl+Shift+[** on Windows. The campaign views count as one variant tab and "Project" as a campaign tab. Both wrap round at the ends. They work wherever the focus is, text fields included (A-23).

## The editor screen

[REQ: FR-090 to FR-098, 8.9 Editor]

### Layout

`editor/editor/` lays out a grid, after the accepted prototype:

```
+--------------------------------------------------------------+
| header (one line)                                            |
| banner (when there is one)                                   |
+-------------+----------------------------------+-------------+
| layer list  | canvas                           | properties  |
| (left)      | (centre, canvas bar at the foot) | (right)     |
+-------------+----------------------------------+-------------+
| timeline (video posts only)                                  |
+--------------------------------------------------------------+
```

The side widths are tokens (`--editor-layers-width`, `--editor-props-width`). The layer list, the properties panel and the timeline are compact (`data-density="compact"`).

### The variant store

`stores/variant-store.ts`, one store per open variant tab.

- Holds the variant row (`VariantSummary`), its campaign ID, its layers by ID, the assets the layers name, one `version` number per asset, and the **draft**: the moving values of one layer during a drag or nudge.
- Loads with `variant.get`. Applies `project.changed` for its project: the variant row with its ID; layer rows with its `variantId`; removed layer IDs; asset rows it holds. A changed layer that names an asset the store lacks makes it read `variant.get` again. A `variant.get` reply that started before the last event touching this variant is dropped and the query is sent again.
- `asset.changedOnDisk` raises the `version` of each named asset it holds, so the Scene loads it again.
- The window never applies a change before the main process confirms it, apart from the draft. The draft is dropped when the drag ends, whatever the reply.

### Top bar

`editor/top-bar/` and `editor/format-fields/` (ED-5). One line:

- **The title**, a quiet button inside the `h3`, named "Rename {title}", with a small pencil. A click or F2 opens the inline field "Variant title"; Enter saves with `variant.update`, Escape cancels; the focus then goes back to the title.
- A "Master" mark (★) when the variant is a master.
- A size chip "{width} × {height}" whose `title` is "{sizeLabel} · {language}".
- **Format** (`format-fields/`): a group "Format" of two buttons, "Image" and "Video", with `aria-pressed`. A video shows "Length" with "s" (named "Length (seconds)").
- Icon buttons, each named and titled: "Place text with AI…" (disabled, with the hint "Add text to a text layer first." as its title and description, when no visible text layer has copy; `spec/screens-ai.md`), "Layout…", "Undo" and "Redo". Undo and Redo are disabled from `history.state { projectId, scope: 'variant:{id}' }`, read again after every `project.changed` naming the variant and after each undo or redo [REQ: FR-095].
- **"Layout…"** (LK-6, DLG-5) [D-094]: opens the layout dialog (`dialogs/layout-dialog/`, `kind="pick"`, title "Choose a layout"). It lists the starter layouts (`spec/starter-layouts.md`) as radio tiles named by the layout, each a small preview: the Scene in `full` mode, the variant's layers with that layout's updates merged in, scaled to fit 160 px. The tiles have no visible caption: the name and one-sentence description are hidden text and the `title`. An InfoTip "About Layout", and a lock mark "{n} kept" when locked layers stay as they are. The first is chosen when it opens. "Apply" sends one `layer.updateMany { variantId, updates }` built by `starterLayoutPatches`, so one undo step, and closes. A refusal shows the command's message in the dialog and it stays open. When the chosen layout changes no layer: "This layout changes no layer here." and Apply is disabled. "Cancel" and Escape send nothing.

### Banner

`editor/editor-banner/`. At most one line, the first that applies:

1. The layout run's line ("Placing text with AI…" with a spinner and "Stop", or its failure with "Dismiss"; `spec/screens-ai.md`, "Place text with AI"). After a run that recoloured text or gave it a text box (R2E-2), the info line "Text colour changed for legibility ({n})" with "Dismiss". While it shows, the lines below are hidden.
2. A file is missing: "A file this variant uses cannot be found. Relink it from the project page."
3. Text does not fit [REQ: FR-098]: "1 text does not fit" or "{n} texts do not fit", with an InfoTip "About fixing it": "Make the box larger, the text smaller, or shorten the text."

The line is a status message (`role="status"`), so a screen reader reads it when it changes.

### Canvas

`editor/canvas-view/` (the Scene and zoom) and `editor/canvas-overlay/` (selection, handles, guides, placeholders).

- **The Scene** is drawn in `full` mode from the store's layers with the draft merged in, at variant pixels, scaled by the zoom from its top-left corner inside a box of the scaled size. The box is centred in the canvas area when smaller, and the area scrolls when larger. The area around it is the backdrop colour.
- **Zoom** (`zoom.ts`): `'fit'` (the default; the largest scale with `--space-6` round the canvas) or one of 25, 33, 50, 67, 75, 100, 150, 200, 300, 400 %. Zoom in and out step to the next value from the current scale. The canvas bar at the foot shows the icon buttons "Zoom out" and "Zoom in" round the zoom ("Fit" or "{n}%", a button that sets fit). The size is in the header's chip, not here.
- **The overlay** lies over the Scene at the same scale and handles the pointer. It draws, in screen pixels whatever the zoom:
  - the selected layer's box, turned with the layer, as a dark line with a light line on each side, with eight square resize handles and one round rotation handle 24 px above the top edge (none of them for a locked layer);
  - a dotted box with no handles for a selected layer that is hidden;
  - for every visible image layer with no picture, a dashed box with "Empty picture" in it (the Scene draws nothing there);
  - for every visible text layer with `overflow` true, a dashed box in the danger colour;
  - the snapping guides during a drag.
- **Past the edge** (Built, LK-5). A layer may lie partly outside the canvas (`spec/scene.md`, "Boxes"). The canvas box (`canvas-view`, `.box`) is `overflow: visible`, as in crop mode, so the selection box and handles of such a layer are drawn past the edge over the backdrop; the Scene's root still cuts the ad at its edge. Picking and dragging still start only on the canvas.
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

- **Duplicate** (Mod+D, or "Duplicate" in the layer row's More menu) sends one `layer.create` with the layer's type and values: its copy or picture, style, geometry moved 20 px right and down, and its Visible and Locked states. The name is "{name} copy". The new layer goes on top. A locked layer can be duplicated, the background cannot. Mod+D also selects the new layer and shortens the name so it stays within 100 characters; the menu item does neither.
- Editor shortcuts work while the focus is anywhere in the shown variant tab, except inside a text field, number field, select or text area, where the field keeps its own keys (its own undo included). Escape, the tab keys and Mod+Enter in the Copy field always work.
- **The app menu.** The app sets its own menu (`src/main/windows/app-menu.ts`): on macOS the app menu (About, Hide, Quit), and on both systems Edit (Undo, Redo, Cut, Copy, Paste, Select All, as roles, so text fields keep working) and Window (Minimize, Close). It has no View menu, so Mod+=, Mod+- and Mod+0 never zoom the whole page, and no reload. With the hand-test flag on it adds "Toggle Developer Tools". The editor calls `preventDefault` on every shortcut it handles. **Check first** (in slice P3-9): Mod+Z pressed with the canvas focused reaches the page's `keydown`, and with `preventDefault` the Edit menu's Undo does not also act. If not, stop and report.

## Layer list

`editor/layer-list/` and `editor/layer-row/`. [REQ: FR-090, FR-092]

- A compact panel (`data-density="compact"`) with the heading "Layers" (`h3`) and the icon buttons "Add text layer" and "Add picture layer". Each sends `layer.create`, selects the new layer, and for text puts the focus in the Copy field.
- Rows top to bottom from the highest `z`; the background last, with no menu and no drag.
- A row is an `ObjectRow` (ED-1a) inside a box with `data-layer-id`; its main button carries `data-layer-row`. It shows a small picture of an image or background layer (from `assetUrl`, 32 px, whole picture shown) or a text mark, the type icon, the name, then the marks as icons: "Empty" (an image layer with no picture), "Does not fit" (a text layer with `overflow`), "File not found" (its picture or font is missing), "Stays at the bottom" (the background). A mark's word ends the row's accessible name ("Background Stays at the bottom", "Logo Empty"). A hidden layer's small picture is drawn faded.
- **Row controls:** the eye "Hide {name}" / "Show {name}" and the lock "Lock {name}" / "Unlock {name}" (`aria-pressed`) always show; each sends `layer.update`. Then a More menu "More actions for {name}" (not on the background) with "Duplicate", "Bring forward", "Send backward" and "Delete" (sends `layer.delete`). An item that cannot act is disabled with its reason: "Unlock the layer first", "Already at the front", "Already at the back". "Bring forward" and "Send backward" send `layer.reorder`.
- Clicking a row selects its layer. The list itself takes no focus: Up and Down, read while a row's button has the focus, select the row above or below and move the focus to it. F2 on a row's button starts a rename.
- **Rename:** double-click the name, or press F2 on a focused row: an inline field labelled "Layer name". Enter saves (`layer.update { name }`), and so does leaving the field; Escape cancels. An empty or unchanged name sends nothing. The focus then goes back to the row.
- **Reorder:** drag a row; a line shows where it will land (above or below the row under the pointer); dropping sends one `layer.reorder`. Dropping a row on the background row puts that layer at the bottom of the stack, just above the background. A drop that did not start in the list does nothing. By keyboard: Mod+] and Mod+[, or "Bring forward" and "Send backward" in the row's More menu.
- Delete or Backspace deletes the selected layer (not the background, not a locked layer).

## Properties panel

`editor/properties-panel/` (a region "Properties", `data-density="compact"`) with one component per Section. Every field saves with one `layer.update` when the user presses Enter or leaves the field, never on each keystroke. A refused value shows the command's message under the field, and the field goes back to the stored value. Number fields (`editor/number-field/`) take whole numbers unless a step says otherwise and step with the arrow keys.

- **Nothing selected:** the EmptyState "Select a layer". On a video post, an InfoTip beside it: "To make a video, select the background layer."
- **Head** (`panel-top.tsx`, ED-1b): a PanelHead with the layer's type icon and its name as the `h3`. A locked layer adds a "Locked" mark at the right end, named "Locked. Unlock"; a click unlocks it. Rename, show and hide, lock, duplicate, order and delete are on the layer row (choice C-3); the panel has no Layer section.
- **Sections** (`ui/section/`, level 4, each with a fold button; a fold lasts for the session): for a text layer, Copy (no title), "Type", "Box" and, on a video post, "Animation"; for a picture or background layer, the picture (no title), "Shade" and "Generate"; then "Position" for every layer. The Sections are drawn afresh for each layer, so an unsaved edit or a refusal message does not carry over to another layer.
- **A locked layer:** every field and button is shown but disabled. The head's "Locked" mark unlocks it.
- **Colours** are a `SwatchField` (`ui/swatch-field/`): one swatch per colour of the campaign's palette (read once through `use-palette.ts`), each named by its hex ("#F4E9D8"); a current colour that is not in the palette shows as an extra swatch; "Other colour" opens a popover with "Hex colour" (type, then Enter). Colours are passed up in upper case.
- **Text** (`text-fields/`, text layers, ED-2) [REQ: FR-093, FR-249]:
  - "Copy": a text area, first, with its label hidden (still its accessible name), and in its corner the sparkle icon button "Suggest copy…" (not for the `headline` slot; `spec/screens-ai.md`, "Copy options"). It saves on leaving it or with Mod+Enter. A translated text has its translation mark under it (tip "Translation: Proposed, from AI" and the like) with a check icon "Approve".
  - When the text does not fit: "This text does not fit its box.", visible, never folded. It is never shrunk for the user (no "Shrink to fit"; G-1 not built).
  - **Type**, an open Section (`props.type`, summary "{font} · {weight} · {size}", for example "Inter · Bold · 81"): the font select and the "Upload font…" icon (`font-field/`, below) and, on a translated layer, "All {lang} posts" (`language-font/`); the built-in styles (`type-styles/`, R2E-3), only when the project's asset library holds no font: five chips drawn as "Aa" and named by `aria-label` (Regular, Bold, Black capitals, Light, Spaced capitals; `TYPE_STYLES` in `src/shared/config/type-styles.ts`), `aria-pressed` on the one that matches; a click sends one `layer.update` with weight, capitals and letter spacing and `fontAssetId: null`; "Size" (px, at least 1) and "Weight" (a select: Thin 100 to Black 900, with an InfoTip "Weight changes only fonts that have more than one weight."); "Align" (Left, Centre, Right) and "Vertical align" (Top, Middle, Bottom) as icon segments; "Colour" as swatches; "Line height" (step 0.05, 0.5 to 4); "Letter spacing" (em, step 0.01, −0.2 to 1); "All capitals", an icon toggle (`aria-pressed`).
  - **Box** (`text-box-fields/`, LK-5, ED-2) [D-094], a folded Section (`props.box`; summary "None", "Fill", "Outline" or "Fill · Outline"): "Box colour" and "Outline colour" (swatches, each with "No colour", which sends null); "Outline width" (px, 0 to 100); "Corner radius" and "Padding" (px, 0 to 2,000). A layer stored without these fields shows the defaults.
- **Picture** (`picture-fields/`, image and background layers, ED-3) [REQ: FR-094]:
  - The picture at full width (its display name in its `title`) inside a `fieldset` whose hidden legend is "Picture", with an icon bar on its lower edge: "Choose picture…" (the picture chooser), "Crop…" (crop mode; disabled with no picture or a missing file), "Reset crop" (when a crop is set), "Cut out the subject…" (`spec/screens-ai.md`, "Cut-out"), "Remove picture" (sets `source` to null), and for the background "Fill the canvas" and "Fit inside". With no picture, the EmptyState "Empty picture" with "Choose picture…".
  - "Fill the canvas": geometry = the whole canvas, rotation 0, crop null. "Fit inside": geometry = the largest box of the picture's shape inside the canvas, centred, rotation 0, crop null; x, y, width and height rounded to whole pixels, width and height at least 1; disabled until the picture's size is known (from the asset row, or from the loaded picture when the row has none). Each is one `layer.update`.
  - "Opacity": a `SliderField` (range "Opacity", number "Opacity value"), 0 to 100 %, stored 0 to 1. The number saves on Enter or on leaving it. The slider saves once when it is let go, never while it moves, so a drag is one undo step.
  - Background only (LK-5): "Background colour" (`background-colour-field/`), swatches with no "No colour". A layer with no colour shows `#000000`, which is how it draws.
- **Shade** (`shade-fields/`, image and background layers, LK-5, ED-3) [D-094], a folded Section: a group "Shade" of six icon segments (None, From the bottom, From the top, From the left, From the right, Whole picture). Choosing a side when there is none sends `NEW_SHADE` (`src/shared/config/look.ts`) with that side; None sends `shade: null`. Then "Colour" (swatches), "Strength" (0 to 100 %) and "Reach" (5 to 100 %, disabled for Whole picture), each a `SliderField` that saves as "Opacity" does. Every change sends the whole `shade`.
- **Generate** (`generate-panel/`, image and background layers, R2E-4, R2E-8, ED-4a, ED-4b): where pictures and videos are made: `spec/screens-ai.md`, "The Generate panel".
- **Animation** (`animation-fields/`, text layers on a video post, ED-6): a folded Section (`props.animation`; summary "{entrance preset} · {exit preset}") with two rows, "In" and "Out" (the words are `aria-hidden`); each a preset select ("None", "Fade", "Fade up", "Slide", "Words one by one") named "Entrance" / "Exit" and a length in seconds named "Entrance length" / "Exit length" (off while the preset is "None"). Each change sends one `layer.update` with that block only, in whole milliseconds.
- **Position** (`geometry-fields/`, every layer, ED-1b): a folded Section (`h4`, its heading button named "Position"; the fold lasts for the session); inside, the group "Position and size": X, Y, W, H (px) and Rotation (°). W and H are read out as "Width" and "Height". Each field sends only its own geometry value; width and height are at least 1. These are the keyboard path for every canvas action [REQ: 8.6].

### Picture chooser

`dialogs/picture-chooser/`, a `DialogFrame kind="pick"` (DLG-5). Title "Choose a picture for {layer name}".

Built (SP-8) [D-098]: a second list, "Subject photos in the reference library"; choosing one moves it to the asset library first. `spec/subject-photos.md`.

- A grid (`.pickGrid`) of the asset library's pictures (`asset.list { projectId, library: 'asset', kind: 'image' }`), each a button with the picture. Tiles have no visible caption: the display name is hidden text and the `title`. A missing one is shown disabled with the visible words "file not found". Empty: the EmptyState "No pictures yet" with "Import pictures…".
- "Import pictures…": `dialog.pickFiles { purpose: 'import', kind: 'image', multiple: true }`, then `asset.import { projectId, paths, library: 'asset', copy: false }`, then the list is read again. A cancelled picker sends nothing.
- Choosing a picture sends `layer.update { source: { assetId } }` and closes. A refused choice shows the command's message in the dialog (`role="alert"`) and the dialog stays open. While a choice is being sent, the pictures, "Import pictures…", "Cancel" and the dialog's close are disabled. "Cancel" closes and sends nothing. The list is read again at each opening.

### Fonts: upload and choice

`editor/font-field/`. [REQ: FR-056, FR-093]

- A select labelled "Font": "Default font (Inter)", then every font asset of the asset library (`asset.list { projectId, library: 'asset', kind: 'font' }`), labelled with its `fontFamily`, or its display name when that is null; a missing one says "(file not found)". When the layer's font is not in that list, one more choice, "Font not in the asset library", stands for it and is shown chosen. Choosing sends `layer.update { style: { fontAssetId } }` (null for the default).
- "Upload font…", an icon button beside the select: `dialog.pickFiles { purpose: 'import', kind: 'font', multiple: false }`, then `asset.import { projectId, paths, library: 'asset', copy: false }`, then `layer.update` with the new asset as the font. A refused import shows its message and changes nothing.
- The "I am allowed to share this font" choice [REQ: FR-162] stays for the publish work of Phase 9.

## Timeline (video posts)

`editor/timeline/` and the folders it mounts (Phase 7, tidied by ED-6). The full rules are in `spec/phases/phase-07-slices-2.md`.

- A region "Timeline" along the editor's foot, compact (`data-density="compact"`), shown only on a video post. Top to bottom: the transport bar, the ruler, one row per layer ("Layer tracks"), the background row ("Background", its lane a list "Clips"), and the playhead over the lanes. Each row keeps its name under the layer list's width, so the lanes line up.
- **Transport bar** (`transport-bar/`): the icon button "Play" / "Pause" (same names as before) and the time; "Sound" (`sound-fields/`) with the choices "Clip sound", "Audio file", "None".
- **Clips** (`clip-track/`, `clip-block/`): each clip is a block named by its file's display name ("File not found" when the file is missing), found in tests as the n-th `[data-clip]`. It moves by a drag or the arrows (100 ms, 1 s with Shift); its two trim handles, "Start of {name}" and "End of {name}", trim the same way; Delete removes it. A change that would break the track rules snaps back.
- **The chosen clip's bar** (`clip-actions.tsx`, `[data-clip-bar]`): a small bar inside the clip's lane that sits fully above the block, ending at the block's right end, so it never covers the clip's name and never changes the block's size (Z-1b). It is a group named by the clip, holding the icon buttons "Sound for {name}" (`aria-pressed`, video clips only; sends `clip.update { soundOn }`) and "Remove {name}" (sends `clip.remove`).
- "Add clip…" adds a picture or video from the asset library ("No pictures or videos in the assets library yet." when there is none).
- A text layer's entrance and exit are set in the properties panel's folded "Animation" Section (above).

## Undo and redo per variant

[REQ: FR-095, R-17]

- The editor's undo and redo act on the shown variant's list only (`history.undo` and `history.redo` with scope `variant:{id}`). Every layer command and `variant.update` puts its inverse there. A drag, a nudge burst, a crop or a field change is one entry.
- A refused undo or redo shows its message in the error banner (`spec/api-principles.md`).
- After an undo that removes the selected layer, nothing is selected.
- Campaign-scope undo (Phase 5) is not in the editor: the campaign's tab strip has its own Undo and Redo (`spec/screens-variants.md`, "Campaign Undo and Redo").
- An undo of an edit that added an override uses `layer.revert`, so the override goes too (`spec/links-and-sync.md`, "Overrides").

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

- Used by each variant tile of the campaign grid, with an empty `alt` (the tile's own name says which variant), and on the project home by each campaign tile, showing the master of its first direction, with `alt` "Cover of {campaign name}". `CampaignSummary` has `cover: { variantId: string; rev: number } | null` for this: `campaignCover` in `src/main/queries/campaign.ts` works it out, and `project.get` (`src/main/queries/project.ts`) fills it in for each campaign.

## Accessibility

[REQ: 8.6]. Every control is a Radix part or a native element with a visible label or `aria-label`. The canvas is a focusable region labelled "Canvas, {title}". Every canvas action has a keyboard path through the layer list and the properties panel. Focus rings are never removed. Axe-core finds no violation in the editor, the layer list, the properties panel, the picture chooser, or the tabs.

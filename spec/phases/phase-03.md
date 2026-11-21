# Phase 3 — Scene and editor

**Goal:** The user lays out a post by hand.

**Exit criteria**

- Every layer action in FR-092 to FR-097 works by mouse and by keyboard, and every slice's named tests pass.
- Overflowing text shows a badge (on the layer, the banner and the variant's `overflow` badge).
- The reference-picture tests pass on macOS. Windows is the stakeholder's own check (D-087).
- FR-242: the tab keys work. FR-245: the transparent-picture reference test passes. FR-249: letter spacing is drawn, measured and editable.

**Status.** Every slice is built and merged on `main`: P3-6, P3-6b, and P3-8 to P3-16. The phase security review found no High or Medium finding, and the exit criteria were checked and are met. Phase 3 is complete. Campaign-scope undo on a screen belongs to Phase 5. The built slices stay below as the record of what each one owns and tests.

**Dependencies:** Built and used here: the `@/` alias, one folder per component, the token file with its test (`spec/structure.md`), the `variant.rev` helper `bumpVariantRev` in `src/main/commands/variant-rev.ts`, the Phase 3 contracts (schemas, scene types, the shortcut table, the Phase 3 tokens), the layer and variant commands (`spec/editor-commands.md`), the Scene (`src/shared/scene/`), font names at import, the render service with thumbnails (`src/main/thumbnails/`), the hidden render window with the window sender rule and fonts from the asset scheme (`src/main/render/`, `src/main/ipc.ts`), the dialog frame (`src/renderer/ui/dialog-frame/`), and the campaign grid of slice S2-16 (`screens/campaign/variant-grid/` and the tile `screens/campaign/variant-tile/`, `spec/phases/phase-02-screens.md`), used by P3-9, P3-10 and P3-16.

**Design:** `spec/scene.md`, `spec/editor.md`, `spec/editor-commands.md`. Security rules: `spec/security.md`, "Rules: the render window" and "Rules: the asset protocol". Tests and the reference rule: `spec/testing.md`. Assumptions A-22 to A-37 and A-53 in `spec/assumptions.md`.

## Rules for these slices

- Every slice: write the failing tests first, then the code; run lint, typecheck and `npm test` in full; plus what its class asks (`spec/testing.md`). Class C slices also run `npm run test:e2e -- tests/e2e/scene-reference.spec.ts` once P3-8 has merged; class G slices run their end-to-end spec.
- A slice edits only the files it owns and the existing files it is told it may touch. A change needed elsewhere: stop and report.
- No slice edits `core.ts`, `core-deps.ts`, `queries.ts`, `bus.ts`, `types.ts`, `agent-policy.ts`, `events.ts`, `tokens.css` or `shortcuts.ts`.
- Every new renderer component follows the folder rule; every CSS value comes from a token.
- Budget: one slice per developer run, well under 300k tokens; hand off with `HANDOFF.md` if near it.

## Order and side-by-side work

| Wave | Slices (side by side in separate worktrees) | Waits for |
|------|---------------------------------------------|-----------|
| 1 | P3-6, P3-6b | Built |
| 2 | P3-8, P3-9 (after S2-16) | Built |
| 3 | P3-10, P3-11, P3-12, P3-13 (after P3-9) | Built |
| 4 | P3-14 (after P3-11, P3-13), P3-16 (after P3-10) | Built |
| 5 | P3-15 (after P3-14) | Built |
| 6 | Phase security review and the exit check | Done |

## Slices

### P3-8 — Reference-picture tests (built)

- **Exists when done:** the Scene is proven in the real render window against stored pictures.
- **New files:** `tests/e2e/scene-reference.spec.ts`, `tests/e2e/scene-cases.ts`, `tests/e2e/reference-compare.ts`, `tests/reference-pictures/darwin/*.png`.
- **Read:** `spec/testing.md` "Reference pictures"; `spec/scene.md`.
- **Tests:** the cases of `spec/testing.md`, "Reference pictures", each set up through `window.api` (project, import, `campaign.create`, layer commands) and drawn with `variant.render`; and `tests/e2e/scene-overflow.spec.ts` (a text layer made to overflow by size and then by letter spacing gets `overflow` true from the render service; shrinking it gives false).
- **Class:** C. Not security class. **After:** P3-6. The developer views every new reference picture and says in the report what each shows.

### P3-9 — The editor frame (built)

- **Exists when done:** opening a variant from the grid shows the editor: top bar (rename, undo, redo), banner, canvas with zoom and selection by click, a layer list that shows and selects rows, and a properties panel with its header and empty state. Overflow reported from the editor. The app menu.
- **New files:** `src/renderer/stores/variant-store.ts`; `editor/editor/`, `top-bar/`, `editor-banner/`, `canvas-view/`, `layer-list/` (rows, selection, arrow keys only), `layer-row/` (picture or text mark, name, marks), `properties-panel/` (header and empty state only), `use-editor-key.ts`, `zoom.ts`; `src/main/windows/app-menu.ts`.
- **May touch:** `screens/campaign/campaign-view/` (shows the editor in place of the overview for the opened variant, with "Back to overview"), `screens/campaign/variant-tile/` (a plain click opens the variant; the overview's panels work on the variant shown last, A-47, `spec/editor.md` "Variant tabs"), `src/main/index.ts` (sets the menu).
- **Read:** `spec/editor.md` (layout, variant store, top bar, banner, canvas, selecting, keyboard shortcuts, undo and redo); `spec/screens.md` rules.
- **Check first:** the app-menu check of `spec/editor.md`.
- **Tests:** `tests/unit/renderer/stores/variant-store.test.ts` (applies events; drops a stale reply; asset version bump), `tests/unit/renderer/editor/zoom.test.ts`, `tests/unit/renderer/editor/editor.test.tsx` (loads, selects by click and by list, undo and redo send `history.*` with the variant scope and are disabled from `history.state`, rename, banner wording, overflow report sent once with the store's rev, axe), `tests/unit/main/windows/app-menu.test.ts` (no View menu; Edit roles; dev tools item only with the flag), `tests/e2e/editor-open.spec.ts` (Mod+Z reaches the page; Mod+= does not zoom the page).
- **Class:** D + G (the menu). Not security class. **After:** S2-16.

### P3-10 — Campaign tabs, variant tabs and the tab keys (built)

- **Exists when done:** project switcher, campaign tabs, variant tabs, opening behind, marks, what each tab keeps, FR-242.
- **New files:** `stores/nav-store.ts`; `app/project-switcher/`, `app/campaign-tabs/`; `screens/campaign/variant-tabs/`.
- **May touch:** `app/app-shell/`, `screens/campaign/campaign-view/`, `screens/project-home/campaign-list/` (opens a tab), `screens/campaign/variant-grid/` (passes the "+" through the tile's `actions` prop), `tests/e2e/screen-tour.ts` and `screens.ts` (approved edits for the new navigation).
- **Read:** `spec/editor.md` "Navigation"; `spec/assumptions.md` OI-31, Q-041, Q-042, A-23, A-24.
- **Tests:** `tests/unit/renderer/stores/nav-store.test.ts` (per-project, per-campaign and per-tab state; a removed variant loses its tab; close drops the project), `tests/unit/renderer/app/campaign-tabs.test.tsx`, `tests/unit/renderer/screens/campaign/variant-tabs.test.tsx` (plain click shows; "+" and Cmd-click open behind; selected layer and zoom kept per tab; marks; axe), `tests/unit/renderer/app/tab-keys.test.tsx` (both key pairs, wrap round, from inside a text field).
- **Class:** D (+ the screen-tour end-to-end run). Not security class.

### P3-11 — Canvas editing: move, resize, rotate, snapping, nudge, delete, duplicate (built)

- **New files:** `editor/canvas-overlay/`, `editor/geometry-math.ts`, `editor/snap.ts`, `editor/nudge.ts`.
- **May touch:** `editor/canvas-view/` (mounts the overlay).
- **Read:** `spec/editor.md` "Canvas" to "Snapping and guides", "Keyboard shortcuts".
- **Tests:** `tests/unit/renderer/editor/geometry-math.test.ts` (hit test of turned boxes, resize along turned sides, rotation folding, Shift steps), `snap.test.ts` (each target line, 6 screen px at several zooms, nearest wins per axis, resize snaps moving edges only), `nudge.test.ts` (a burst gives one update), `canvas-overlay.test.tsx` (one `layer.update` per drag; Escape cancels; locked layer has no handles; Delete, Mod+D, arrows; placeholders and overflow boxes drawn).
- **Class:** D. Not security class.

### P3-12 — Layer list actions (built)

- **New files:** inside `editor/layer-list/` and `editor/layer-row/` (owned from here on).
- **Read:** `spec/editor.md` "Layer list".
- **Tests:** `tests/unit/renderer/editor/layer-list.test.tsx` (add text and add picture send `layer.create` and select; hide, show, lock, unlock; rename by double-click and F2; drag reorder sends one `layer.reorder`; Mod+] and Mod+[; background has no delete or drag; axe).
- **Class:** D. Not security class.

### P3-13 — Properties: layer, text, font and position fields (built)

- **New files:** `editor/layer-fields/`, `text-fields/`, `font-field/`, `geometry-fields/`, `number-field/`.
- **May touch:** `editor/properties-panel/` (owned from here on); `src/shared/config/file-types.ts` (`pickerExtensions('import', kind)` offers only that kind; one line).
- **Read:** `spec/editor.md` "Properties panel", "Fonts: upload and choice"; `spec/api-queries-events.md` `dialog.pickFiles`.
- **Tests:** `tests/unit/shared/config/file-types-import-kind.test.ts` (`import` with `font` gives `ttf`, `otf`, `woff2` only; with no kind, every extension as before), `tests/unit/renderer/editor/text-fields.test.tsx` (each field sends one `layer.update` on Enter or blur, not per keystroke; letter spacing bounds and step; palette buttons; overflow line), `font-field.test.tsx` (labels from `fontFamily`; upload sends picker, import, then update; cancel sends nothing), `geometry-fields.test.tsx`, `layer-fields.test.tsx` (locked disables value fields; background has no delete, duplicate or reorder), axe for each.
- **Class:** D. Not security class.

### P3-14 — Picture properties and the picture chooser (built)

- **New files:** `editor/picture-fields/`, `dialogs/picture-chooser/`.
- **May touch:** `editor/properties-panel/` (mounts the picture fields). May reuse `ui/dialog-frame/` (S2-2) for the picture chooser.
- **Read:** `spec/editor.md` "Properties panel" (Picture), "Picture chooser"; `spec/scene.md` "Pictures".
- **Tests:** `tests/unit/renderer/editor/picture-fields.test.tsx` (choose, remove, opacity, Fill the canvas and Fit inside geometry), `tests/unit/renderer/dialogs/picture-chooser.test.tsx` (list, missing disabled, import flow, choose sends `layer.update` with `source`, cancel sends nothing, axe).
- **Class:** D. Not security class. **After:** P3-11, P3-13.

### P3-15 — Crop mode (built)

- **New files:** `editor/crop-overlay/`.
- **May touch:** `editor/canvas-view/` (mounts it), `editor/picture-fields/` ("Crop…" and "Reset crop").
- **Read:** `spec/editor.md` "Crop mode"; `spec/scene.md` `placePicture`.
- **Tests:** `tests/unit/renderer/editor/crop-overlay.test.tsx` (double-click enters; crop keeps the box's shape and stays inside the picture; Enter sends one update in source pixels; Escape sends nothing; Reset crop sends null; locked layer cannot enter).
- **Class:** D. Not security class. **After:** P3-14.

### P3-16 — Thumbnails on the screens (built)

- **New files:** `src/renderer/ui/variant-thumbnail/`.
- **May touch:** `screens/campaign/variant-grid/` (passes `<VariantThumbnail>` through the tile's `preview` prop), `screens/project-home/campaign-list/`, and for the `cover` field on `CampaignSummary`: `src/shared/schemas/queries/campaign.ts`, `src/main/queries/campaign.ts` (`campaignCover`), `src/main/queries/project.ts` (`project.get` fills it in) and `src/main/mcp/tools/project-replies.ts` (the agent's project reply carries it).
- **Read:** `spec/editor.md` "Thumbnails on the screens"; `spec/editor-commands.md` `thumbnail.get`.
- **Tests:** `tests/unit/renderer/ui/variant-thumbnail.test.tsx` (pending then event then ready; a new `rev` asks again; object URL freed; failed shows "No preview"), `tests/integration/queries/campaign-cover.test.ts`, `tests/unit/renderer/screens/project-home/campaign-list-cover.test.tsx`.
- **Class:** D + B. Not security class. **After:** P3-10.

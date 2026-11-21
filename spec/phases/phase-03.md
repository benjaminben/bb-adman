# Phase 3 — Scene and editor

**Goal:** The user lays out a post by hand.

**Exit criteria**

- Every layer action in FR-092 to FR-097 works by mouse and by keyboard, and every slice's named tests pass.
- Overflowing text shows a badge (on the layer, the banner and the variant's `overflow` badge).
- The reference-picture tests pass on macOS. Windows is the stakeholder's own check (D-087).
- FR-242: the tab keys work. FR-245: the transparent-picture reference test passes. FR-249: letter spacing is drawn, measured and editable.
- Review item LP-1 is fixed (slice P3-6) and removed from `spec/phases/review-leftovers.md`.

**Dependencies:** Phase 2 and every group of the Phase 2 leftovers, in particular group 1 (the `@/` alias, one folder per component, the token file and its lint test), group 5 (the campaign grid) and the `variant.rev` helper in `src/main/commands/variant-rev.ts`.

**Design:** `spec/scene.md`, `spec/editor.md`, `spec/editor-commands.md`. Security rules: `spec/security.md`, "Rules: the render window". Tests and the reference rule: `spec/testing.md`. Assumptions A-22 to A-37 in `spec/open-items.md`.

## Rules for these slices

- Every slice: write the failing tests first, then the code; run lint, typecheck and `npm test` in full; plus what its class asks (`spec/testing.md`). Class C slices also run `npm run test:e2e -- tests/e2e/scene-reference.spec.ts` once P3-8 has merged; class G slices run their end-to-end spec.
- A slice edits only the files it owns and the existing files it is told it may touch. A change needed elsewhere: stop and report.
- After P3-0 merges, no slice edits `core.ts`, `core-deps.ts`, `queries.ts`, `bus.ts`, `types.ts`, `agent-policy.ts`, `events.ts`, `tokens.css` or `shortcuts.ts`.
- Every new renderer component follows the folder rule; every CSS value comes from a token.
- Budget: one slice per developer run, well under 300k tokens; hand off with `HANDOFF.md` if near it.

## Order and side-by-side work

| Wave | Slices (side by side in separate worktrees) | Waits for |
|------|---------------------------------------------|-----------|
| 0 | P3-0 | Phase 2 leftovers |
| 1 | P3-1, P3-3, P3-4, P3-5, P3-7 | P3-0 |
| 2 | P3-2 (after P3-1), P3-6 (after P3-5) | |
| 3 | P3-8 (after P3-2, P3-6, P3-7), P3-9 (after P3-1, P3-3, P3-6: both edit `src/main/index.ts`) | |
| 4 | P3-10, P3-11, P3-12, P3-13 | P3-9 and P3-2 |
| 5 | P3-14 (after P3-11, P3-13), P3-16 (after P3-7, P3-10) | |
| 6 | P3-15 (after P3-14) | |

## Slices

### P3-0 — Contracts and wiring

- **Exists when done:** every shared contract of the phase, so later slices never touch a shared file.
- **New files:** `src/shared/schemas/commands/layer.ts`, `commands/variant.ts` (all inputs and replies of `spec/editor-commands.md`); `src/shared/schemas/queries/variant.ts` (`VariantGet`), `queries/render.ts` (`ThumbnailGet`, `VariantRender`); `src/shared/schemas/render.ts` (`RENDER_CHANNELS`, `RenderRequest`, `RenderDone`); `src/shared/scene/types.ts`; `src/shared/config/render.ts` (`RENDER_LIMITS`); `src/main/thumbnails/types.ts`; `src/main/thumbnails/service.ts` (a `createRenderService` whose methods answer `failed`, throw "render is not available", or do nothing; P3-7 replaces the body); `src/main/commands/layer/index.ts`, `commands/variant/index.ts` (empty lists); `src/main/queries/variant.ts`, `queries/render.ts` (empty maps); `src/renderer/ui/shortcuts.ts` (the whole table of `spec/editor.md`, "Keyboard shortcuts").
- **May touch:** `core.ts` (two domain lines; `render` on `CoreDeps` from `createRenderService`; option `drawScene`, default throws "drawScene is not available"), `core-deps.ts` (sixteenth field), `queries.ts` (two lines), `agent-policy.ts` (`'layer.restore'` deny, system), `events.ts` (`thumbnail.changed`), `src/main/index.ts` (`send` also hands each event to `core.render.onEvent`), `src/main/commands/project/close.ts` (calls `deps.render.projectClosed`), `tokens.css` (the Phase 3 tokens of `spec/screens.md`), `vitest.config.ts` (one include line: `tests/unit/shared/**/*.test.tsx` in the `renderer` project). Approved test edits: `tests/integration/registration.test.ts` (sixteen fields), `tests/unit/main/commands/agent-policy-table.test.ts` (the new row), any hand-built `CoreDeps` in tests (make-it-compile: a `render` stand-in that throws).
- **Read:** `spec/editor-commands.md`; `spec/scene.md` "Props", "One draw", "The render service"; `spec/editor.md` "Keyboard shortcuts"; `spec/structure.md` "Registering commands and queries".
- **Tests:** `tests/unit/shared/schemas/layer-commands.test.ts` (each input strict; bounds of name, copy, title, `maxDimension`, `variantRev`), `tests/unit/renderer/ui/shortcuts.test.ts` (every row of the table on both platforms; `event.code` matching), `tests/unit/shared/schemas/events-thumbnail.test.ts`.
- **Class:** B (+ D for tokens and shortcuts). Not security class. Runs alone on `main`.

### P3-1 — `layer.update` and `variant.update`

- **Exists when done:** both commands, with undo, counters, the no-op rule and the asset checks.
- **New files:** `src/main/commands/layer/update.ts`, `layer/check-layer-assets.ts`, `layer/merge-patch.ts`, `layer/inverse-patch.ts`; `src/main/commands/variant/update.ts`.
- **May touch:** `commands/layer/index.ts`, `commands/variant/index.ts`.
- **Read:** `spec/editor-commands.md` (rules for every command, `layer.update`, `variant.update`); `spec/api-principles.md` "Undo and redo"; `spec/data-rules.md` "Links" (the groups).
- **Tests:** `tests/integration/commands/layer-update.test.ts` (success with `expect-changes`; only changed groups bumped; `variant.rev` once; no-op writes nothing; undo then redo restores each field), `layer-update-refusals.test.ts` (every refusal of the command, each asserting nothing written, no event, no undo entry), `layer-update-agent.test.ts` (sent as user, `agent_changed_at` stays null; as agent, set to the command's time) [REQ: FR-239], `variant-update.test.ts`.
- **Class:** B. Not security class.

### P3-2 — `layer.create`, `layer.delete`, `layer.restore`, `layer.reorder`, `layer.reportOverflow`

- **Exists when done:** layers can be added, removed (and brought back by undo), reordered, and their overflow written.
- **New files:** `src/shared/templates/new-layer.ts`; `src/main/commands/layer/create.ts`, `delete.ts`, `restore.ts`, `reorder.ts`, `report-overflow.ts`.
- **May touch:** `commands/layer/index.ts`.
- **Read:** `spec/editor-commands.md`; `spec/editor.md` "Several picture layers per variant"; `spec/brief-and-templates.md` "Default layout".
- **Tests:** `tests/unit/shared/templates/new-layer.test.ts` (names "Picture n" and "Text n"; boxes at `50x50` and `8192x8192` pass `LayerRow`), `tests/integration/commands/layer-create.test.ts` (key `layer-{ulid}`, `slot` null, top `z`, undo deletes, redo restores the same ID), `layer-delete.test.ts` (z closed up; background refused with `background_layer`; undo restores row, counters and order), `layer-restore.test.ts` (`layer_exists`; internal: refused from a window), `layer-reorder.test.ts` (bad lists refused; undo), `layer-report-overflow.test.ts` (old `variantRev` gives `applied: false` and no write; no `rev` bump; no undo entry; text only).
- **Class:** B. Not security class. **After:** P3-1 (shares `commands/layer/index.ts` and the asset check helper).

### P3-3 — `variant.get` and fonts in the missing-file badge

- **Exists when done:** the editor's one read, and `missingFile` counting fonts.
- **New files:** `src/main/queries/variant.ts` body, `src/main/queries/variant-reads.ts`.
- **May touch:** `src/main/queries/campaign-reads.ts` (the badge).
- **Read:** `spec/editor-commands.md` "`variant.get`"; `spec/api-queries-events.md` "Computed badges".
- **Tests:** `tests/integration/queries/variant-get.test.ts` (layers by z; assets once each with `missing`; unknown variant `NOT_FOUND`; two open projects with the same variant ID), `tests/integration/queries/missing-file-fonts.test.ts`.
- **Class:** B. Not security class.

### P3-4 — Font names at import

- **Exists when done:** imported, relinked and changed fonts get `font_family`.
- **New files:** `src/main/assets/font-name.ts`.
- **May touch:** the file in `src/main/assets/` that reads file facts (`readFileFacts`).
- **Read:** `spec/scene.md` "Font names at import"; `spec/assets.md` "File types".
- **Tests:** `tests/unit/main/assets/font-name.test.ts` (TTF, OTF and WOFF2 fixtures made in the test from bytes; ID 16 before ID 1; platform 3 before 1; control characters removed; 100-character cut; a string or table past the end, a huge count, a bad WOFF2 header and an over-large WOFF2 each give null and never throw), `tests/integration/assets/font-family-import.test.ts`.
- **Class:** B. **Security class, short review** (reads untrusted bytes).

### P3-5 — The Scene component

- **Exists when done:** `src/shared/scene/` as `spec/scene.md` lists it, with the bundled font.
- **New files:** every file of `spec/scene.md`, "Files", except `types.ts`.
- **Read:** `spec/scene.md` "The Scene component"; `spec/data-model-campaign.md` "layer".
- **Tests:** `tests/unit/shared/scene/background-placement.test.ts` (cover and contain, a crop, a crop past the picture, an empty crop, no stretch), `text-style.test.ts` (the exact property list; letter spacing in `em`), `scene.test.tsx` (jsdom: drawing order by z; hidden layer has `visibility: hidden`; empty and missing pictures draw no `<img>`; copy holding `<b>` shows the characters; `overlay-only` leaves out the background; root `lang`), `font-faces.test.tsx` (one `FontFace` per asset and version; family names). Layout cannot be measured in jsdom: overflow is proven in P3-8.
- **Class:** C (its reference tests land with P3-8). Not security class. The developer takes Inter from its official release and reports the file's SHA-256.

### P3-6 — The render window and the window sender rule (LP-1)

- **Exists when done:** the hidden render window draws a `SceneInput` and returns a PNG and the overflow map; the app's command and query channels refuse any sender but the app window; events go to the app window only.
- **New files:** `src/main/render/render-window.ts`, `draw.ts`, `render-page.ts`, `done-message.ts`; `src/preload/render.ts`; `src/renderer/render.html`; `src/renderer/render-worker/main.tsx`, `render-worker/render-root/`.
- **May touch:** `src/main/ipc.ts` (`mayCall`), `src/main/index.ts` (app window reference, `send` to the app window only, `drawScene: createDraw()`, render window ended when the app window closes), `electron.vite.config.ts` (two pages, two preloads), `src/main/windows/app-window.ts` (export what the render window reuses).
- **Read:** `spec/scene.md` "The render window"; `spec/security.md` "Rules: the render window", "Rules: renderer and windows"; `spec/phases/review-leftovers.md` LP-1.
- **Check first:** the four checks of `spec/scene.md`, "One draw". Stop and report if one fails.
- **Tests:** `tests/unit/main/ipc.test.ts` (new blocks: a call from another frame or window is refused before `execute` or `query` runs; an event goes to the app window only), `tests/unit/main/render/render-page.test.ts`, `tests/unit/main/render/done-message.test.ts` (wrong sender, wrong frame, wrong `requestId`, bad shape, unknown layer IDs dropped), `tests/build/built-page.test.ts` (new block: `out/renderer/render.html` has exactly one policy tag equal to `CONTENT_SECURITY_POLICY`), `tests/e2e/render-window.spec.ts` (the render window is never visible; its page has no `window.api`; `window.renderApi` has exactly `onRequest` and `done`; a draw of a small variant gives a PNG of the asked size; closing the app window quits the app).
- **Class:** G + C. **Security class, full review.** **After:** P3-5.

### P3-7 — The render service and thumbnails

- **Exists when done:** `thumbnail.get`, `variant.render`, `thumbnail.changed`, eager thumbnails, overflow reported after each draw, clean-up on close, redraw on `asset.changedOnDisk`.
- **New files:** `src/main/thumbnails/service.ts` (body), `queue.ts`, `scene-input.ts`, `paths.ts`, `cache.ts`; `src/main/queries/render.ts` (body).
- **Read:** `spec/scene.md` "The render service", "Thumbnails"; `spec/editor-commands.md` "Queries", "Event"; `spec/security.md` thumbnail rows.
- **Tests:** with a stand-in `draw`: `tests/unit/main/thumbnails/paths.test.ts` (bad project ID, variant ID and rev throw), `tests/integration/thumbnails/thumbnail-get.test.ts` (pending, then `thumbnail.changed`, then ready; failed draw gives `failed` and one `warn` line with no path), `thumbnail-clean.test.ts` (close deletes old revs only; a link named like a thumbnail, a sub-folder and an unrelated file are left; a linked project folder writes and deletes nothing), `thumbnail-eager.test.ts` (one draw per variant after a burst of changes; `asset.changedOnDisk` redraws only variants using the asset), `render-overflow.test.ts` (a draw that measures overflow sends `layer.reportOverflow` once), `variant-render.test.ts` (`render_failed`; `maxDimension` bounds; no file written).
- **Class:** B. **Security class, short review** (paths from project values; deletes files). Side by side with P3-6.

### P3-8 — Reference-picture tests

- **Exists when done:** the Scene is proven in the real render window against stored pictures.
- **New files:** `tests/e2e/scene-reference.spec.ts`, `tests/e2e/scene-cases.ts`, `tests/e2e/reference-compare.ts`, `tests/reference-pictures/darwin/*.png`.
- **Read:** `spec/testing.md` "Reference pictures"; `spec/scene.md`.
- **Tests:** the cases of `spec/testing.md`, "Reference pictures", each set up through `window.api` (project, import, `campaign.create`, layer commands) and drawn with `variant.render`; and `tests/e2e/scene-overflow.spec.ts` (a text layer made to overflow by size and then by letter spacing gets `overflow` true from the render service; shrinking it gives false).
- **Class:** C. Not security class. **After:** P3-2, P3-6, P3-7. The developer views every new reference picture and says in the report what each shows.

### P3-9 — The editor frame

- **Exists when done:** opening a variant from the grid shows the editor: top bar (rename, undo, redo), banner, canvas with zoom and selection by click, a layer list that shows and selects rows, and a properties panel with its header and empty state. Overflow reported from the editor. The app menu.
- **New files:** `src/renderer/stores/variant-store.ts`; `editor/editor/`, `top-bar/`, `editor-banner/`, `canvas-view/`, `layer-list/` (rows, selection, arrow keys only), `layer-row/` (picture or text mark, name, marks), `properties-panel/` (header and empty state only), `use-editor-key.ts`, `zoom.ts`; `src/main/windows/app-menu.ts`.
- **May touch:** `screens/campaign/campaign-view/` (shows the editor in place of the overview for the opened variant, with "Back to overview"), group 5's tile component (calls the open action), `src/main/index.ts` (sets the menu).
- **Read:** `spec/editor.md` (layout, variant store, top bar, banner, canvas, selecting, keyboard shortcuts, undo and redo); `spec/screens.md` rules.
- **Check first:** the app-menu check of `spec/editor.md`.
- **Tests:** `tests/unit/renderer/stores/variant-store.test.ts` (applies events; drops a stale reply; asset version bump), `tests/unit/renderer/editor/zoom.test.ts`, `tests/unit/renderer/editor/editor.test.tsx` (loads, selects by click and by list, undo and redo send `history.*` with the variant scope and are disabled from `history.state`, rename, banner wording, overflow report sent once with the store's rev, axe), `tests/unit/main/windows/app-menu.test.ts` (no View menu; Edit roles; dev tools item only with the flag), `tests/e2e/editor-open.spec.ts` (Mod+Z reaches the page; Mod+= does not zoom the page).
- **Class:** D + G (the menu). Not security class. **After:** P3-1, P3-3, P3-6.

### P3-10 — Campaign tabs, variant tabs and the tab keys

- **Exists when done:** project switcher, campaign tabs, variant tabs, opening behind, marks, what each tab keeps, FR-242.
- **New files:** `stores/nav-store.ts`; `app/project-switcher/`, `app/campaign-tabs/`; `screens/campaign/variant-tabs/`.
- **May touch:** `app/app-shell/`, `screens/campaign/campaign-view/`, `screens/project-home/campaign-list/` (opens a tab), group 5's tile (the "+" button), `tests/e2e/screen-tour.ts` and `screens.ts` (approved edits for the new navigation).
- **Read:** `spec/editor.md` "Navigation"; `spec/open-items.md` OI-31, Q-041, Q-042, A-23, A-24.
- **Tests:** `tests/unit/renderer/stores/nav-store.test.ts` (per-project, per-campaign and per-tab state; a removed variant loses its tab; close drops the project), `tests/unit/renderer/app/campaign-tabs.test.tsx`, `tests/unit/renderer/screens/campaign/variant-tabs.test.tsx` (plain click shows; "+" and Cmd-click open behind; selected layer and zoom kept per tab; marks; axe), `tests/unit/renderer/app/tab-keys.test.tsx` (both key pairs, wrap round, from inside a text field).
- **Class:** D (+ the screen-tour end-to-end run). Not security class.

### P3-11 — Canvas editing: move, resize, rotate, snapping, nudge, delete, duplicate

- **New files:** `editor/canvas-overlay/`, `editor/geometry-math.ts`, `editor/snap.ts`, `editor/nudge.ts`.
- **May touch:** `editor/canvas-view/` (mounts the overlay).
- **Read:** `spec/editor.md` "Canvas" to "Snapping and guides", "Keyboard shortcuts".
- **Tests:** `tests/unit/renderer/editor/geometry-math.test.ts` (hit test of turned boxes, resize along turned sides, rotation folding, Shift steps), `snap.test.ts` (each target line, 6 screen px at several zooms, nearest wins per axis, resize snaps moving edges only), `nudge.test.ts` (a burst gives one update), `canvas-overlay.test.tsx` (one `layer.update` per drag; Escape cancels; locked layer has no handles; Delete, Mod+D, arrows; placeholders and overflow boxes drawn).
- **Class:** D. Not security class.

### P3-12 — Layer list actions

- **New files:** inside `editor/layer-list/` and `editor/layer-row/` (owned from here on).
- **Read:** `spec/editor.md` "Layer list".
- **Tests:** `tests/unit/renderer/editor/layer-list.test.tsx` (add text and add picture send `layer.create` and select; hide, show, lock, unlock; rename by double-click and F2; drag reorder sends one `layer.reorder`; Mod+] and Mod+[; background has no delete or drag; axe).
- **Class:** D. Not security class.

### P3-13 — Properties: layer, text, font and position fields

- **New files:** `editor/layer-fields/`, `text-fields/`, `font-field/`, `geometry-fields/`, `number-field/`.
- **May touch:** `editor/properties-panel/` (owned from here on); `src/shared/config/file-types.ts` (`pickerExtensions('import', kind)` offers only that kind; one line).
- **Read:** `spec/editor.md` "Properties panel", "Fonts: upload and choice"; `spec/api-queries-events.md` `dialog.pickFiles`.
- **Tests:** `tests/unit/shared/config/file-types-import-kind.test.ts` (`import` with `font` gives `ttf`, `otf`, `woff2` only; with no kind, every extension as before), `tests/unit/renderer/editor/text-fields.test.tsx` (each field sends one `layer.update` on Enter or blur, not per keystroke; letter spacing bounds and step; palette buttons; overflow line), `font-field.test.tsx` (labels from `fontFamily`; upload sends picker, import, then update; cancel sends nothing), `geometry-fields.test.tsx`, `layer-fields.test.tsx` (locked disables value fields; background has no delete, duplicate or reorder), axe for each.
- **Class:** D. Not security class.

### P3-14 — Picture properties and the picture chooser

- **New files:** `editor/picture-fields/`, `dialogs/picture-chooser/`.
- **May touch:** `editor/properties-panel/` (mounts the picture fields).
- **Read:** `spec/editor.md` "Properties panel" (Picture), "Picture chooser"; `spec/scene.md` "Pictures".
- **Tests:** `tests/unit/renderer/editor/picture-fields.test.tsx` (choose, remove, opacity, Fill the canvas and Fit inside geometry), `tests/unit/renderer/dialogs/picture-chooser.test.tsx` (list, missing disabled, import flow, choose sends `layer.update` with `source`, cancel sends nothing, axe).
- **Class:** D. Not security class. **After:** P3-11, P3-13.

### P3-15 — Crop mode

- **New files:** `editor/crop-overlay/`.
- **May touch:** `editor/canvas-view/` (mounts it), `editor/picture-fields/` ("Crop…" and "Reset crop").
- **Read:** `spec/editor.md` "Crop mode"; `spec/scene.md` `placePicture`.
- **Tests:** `tests/unit/renderer/editor/crop-overlay.test.tsx` (double-click enters; crop keeps the box's shape and stays inside the picture; Enter sends one update in source pixels; Escape sends nothing; Reset crop sends null; locked layer cannot enter).
- **Class:** D. Not security class. **After:** P3-14.

### P3-16 — Thumbnails on the screens

- **New files:** `src/renderer/ui/variant-thumbnail/`.
- **May touch:** group 5's tile component, `screens/project-home/campaign-list/`, `src/main/queries/campaign.ts` and `src/shared/schemas/queries/campaign.ts` (`cover` on `CampaignSummary`).
- **Read:** `spec/editor.md` "Thumbnails on the screens"; `spec/editor-commands.md` `thumbnail.get`.
- **Tests:** `tests/unit/renderer/ui/variant-thumbnail.test.tsx` (pending then event then ready; a new `rev` asks again; object URL freed; failed shows "No preview"), `tests/integration/queries/campaign-cover.test.ts`.
- **Class:** D + B. Not security class. **After:** P3-7, P3-10.

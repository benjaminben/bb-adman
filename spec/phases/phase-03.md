# Phase 3 — Scene and editor

Bullets carry `[logic]` (main process, shared code, commands, queries, data, providers, the Scene, render and export) or `[UI]` (screens, dialogs, panels and controls in `src/renderer/`). Both are built in this phase (D-084): each slice builds its screens with its logic, as modular components styled only from the shared tokens.

**Goal:** The user lays out a post by hand.
**Class:** C, D

## Scope

- [logic] Scene component for image variants: background, image and text layers, fonts, overflow measurement.
- [logic] Hidden render window and render service, thumbnails.
- [logic] Font assets drawn by the Scene, bundled default font.
- [logic] Letter spacing drawn by the Scene and counted in the overflow measurement [REQ: FR-249].
- [logic] An imported picture with a transparent background keeps it in the Scene and in thumbnails, with a reference-picture test [REQ: FR-245]. Phase 8 adds the same test for the exported file.
- [UI] Letter spacing in the text properties [REQ: FR-249].
- [UI] Keyboard steps to the next and previous variant tab and campaign tab [REQ: FR-242]. The keys are chosen in this phase.
- [UI] Editor: canvas, selection, move, resize, rotate, reorder, show, hide, lock, delete.
- [UI] Layer list, properties panel (text and image properties), background transform.
- [UI] Snapping and alignment guides, keyboard shortcuts, undo and redo per variant.
- [UI] Font upload and font choice.

The editor's components live under `src/renderer/editor/` (OI-80, closed), one folder per component (`spec/structure.md`).

## Exit criteria

- Every layer action in FR-092 to FR-097 works by mouse and by keyboard.
- Overflowing text shows a badge.
- Reference-picture tests pass. Agents check them on macOS; the stakeholder checks Windows himself (D-087).

## Dependencies

- Phase 2, including the Phase 2 leftovers group 1 (renderer layout and tokens) and the `variant.rev` helper.

## Carried in from earlier work

- **`variant.rev` and `agent_changed_at`.** The first layer command that bumps `variant.rev` uses the helper in `src/main/commands/variant-rev.ts` (built in the Phase 2 leftovers). That command's tests send it once as the user and once as the agent, and check that only the agent's call stamps `variant.agent_changed_at` [REQ: FR-239]. If Phase 4's option-placing handler lands first, that handler carries this test instead.
- **Font facts.** Imported fonts fill `font_family` (null as built).
- **Thumbnails** are drawn again on `asset.changedOnDisk`.
- **Several picture layers per variant** (OI-55; Q-032 answered yes). `generation.runImages` already takes a slot or any image layer. The design is open (below).
- **Thumbnails in the project home and campaign view.** The Phase 2 grid is built without thumbnails; this phase adds them once the render service exists.

## Not designed yet

- Several picture layers per variant: how picture layers are created and ordered, what a master's template holds, how follow rules and fan-out treat an added layer, and how a cut-out is drawn.
- The keys for the tab steps of FR-242.

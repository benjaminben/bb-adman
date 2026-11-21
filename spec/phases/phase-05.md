# Phase 5 — Variants, fan-out, links and sync

Bullets carry `[logic]` (main process, shared code, commands, queries, data) or `[UI]` (screens, dialogs, panels and controls in `src/renderer/`). Both are built in this phase (D-084): each slice builds its screens with its logic, as modular components styled only from the shared tokens.

**Goal:** One master drives a grid of variants.
**Class:** A, B, D

## Scope

- [logic] Follow rules, revision counters, out-of-date calculation, overrides. Geometry follows by pixel size only [D-013].
- [logic] Fan-out; generative fill through Gemini `extend`.
- [logic] Sync preview and apply.
- [logic] Directions: create from a master.
- [logic] Campaign undo list, including variant delete.
- [logic] Computed status badges.
- [UI] Fan-out background fit dialog, sync review dialog.
- [UI] One grid per direction, status badges on the grid.
- [UI] Cmd-click (macOS) or Ctrl-click (Windows) on a tile opens that variant in a tab without leaving the overview [REQ: FR-243, FR-214].
- [UI] Quick look: one variant large from the overview, with next and previous, view only, no tab opened (P2) [REQ: FR-244].

## Exit criteria

- Workflows 5.3 and 5.4 pass end to end.
- The named test "editing a master changes no other variant's layer rows" passes.

## Dependencies

- Phase 4.

## Carried in from earlier work

- **`generation.runFill` and the ComfyUI extend job.** Generative fill also runs on ComfyUI (the extend job, `spec/comfyui-workflows.md`, "Extend a background"). The picture to extend goes in a one-slot `references` with `minReferences: 1`, and there is no source-picture slot. `comfy-workflows/moss-extend.json` exists as a draft. If the real graph of the extend trial needs another shape, it is ruled then. No extend job kind exists yet: `src/main/jobs/kinds/` holds only `image-generation.ts` and `video-generation.ts`.
  - The extend source picture goes through the WebP-to-PNG rule of slice WP: the provider always gets a PNG.
  - `generation.runFill` is a `tick` row in the agent policy, but the agent-run gate knows only `generation.runImages`, `generation.startVideo` and `job.cancel`, so today it is refused for an agent. Opening it to agents is a ruling of this phase (D-080 points to yes); if yes, add it to the gate with gate tests.
- **CU-8, the ComfyUI part of the hand-test screen** (only if OI-64 keeps it) [REQ: FR-290]. Class D and B. Not security class. Depends on CU-6 and slice I part 2.
  - Owns `src/renderer/dev/` (a ComfyUI section) and `src/main/commands/dev/comfy-extend.ts`.
  - Dev-only, like `dev.storage`: shown only when `app.getState` says `devTools`, never in a packaged app. Uses the product commands.
  - Address field (`comfy.setAddress`), "Check" (`comfy.check`), missing items and licence notes per workflow, and the "left on the server" sentences.
  - A workflow picker that includes `trial` workflows. `generation.runImages` and `generation.startVideo` take an optional `workflowId` from the fixed list, accepted only when `deps.devTools` is true and the actor is the user; otherwise `INVALID_INPUT`.
  - Prompt, size, count, and reference pictures from the project's library; for video, the start choice and length. Generate. Waiting or working, with the queue place. Cancel. The result through `adman-asset://`, video played muted. "Show the server's message" on a failure.
  - `dev.comfyExtend { projectId, assetId, width, height, prompt }`, registered only with `devTools`, agent policy deny (the row exists). It enqueues an `image_generation` job with `mode: 'extend'`, the picture centred on the new canvas. This phase's `generation.runFill` replaces it; if `generation.runFill` is built first, `dev.comfyExtend` is not built.

## Not designed yet

- Whether agents may start `generation.runFill` (see above).
- The extend workflow's final graph, after its trial.

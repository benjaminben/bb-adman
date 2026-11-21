# Build plan

The work that is left, in build order. Phases 1 and most of Phase 2 are built on `main`. Each file below lists one phase's unbuilt work. The architect details one phase at a time into developer-sized slices just before it is built.

`spec/phases/review-leftovers.md` holds review findings not yet handled. Its "Fix now" items run with the Phase 2 leftovers group 2. Its "Fix with a later phase" items are read by that phase's architect.

## Order

The Phase 2 leftovers keep their group numbers. Group 1 (the `@/` alias, one folder per component, one styling source) is built.

| # | Work | Goal | Depends on | Topic files the developers need |
|---|------|------|------------|------------------------------|
| 1 | Phase 2 leftovers, group 2 (`phase-02-leftovers.md`) | Small fixes and helpers later phases lean on; ComfyUI follow-ups; slice WP; CU-9 | Phase 2 as built | `jobs.md`, `assets.md`, `comfyui.md`, `comfyui-workflows.md`, `providers.md`, `security.md`, `testing.md`, `data-rules.md` |
| 2 | Phase 2 leftovers, group 3 (`phase-02-agent-generation.md`) | Agents generate through the MCP server: AR-1, AR-2, AR-3, MCP-G | Phase 2 as built | `mcp-and-agents.md`, `agent-runs.md`, `cancel.md`, `jobs.md`, `api-principles.md`, `api-commands.md`, `api-queries-events.md`, `security.md`, `infra-and-settings.md`, `screens.md`, `testing.md` |
| 3 | Phase 2 leftovers, group 4 | ComfyUI failures on the campaign page (TP-4a) | Phase 2 as built | `comfyui.md`, `screens.md`, `api-queries-events.md`, `testing.md` |
| 4 | Phase 2 leftovers, group 5 | Phase 2 screens never built: drop import, brief forms, slot view, import, relink and package dialogs | Phase 2 as built | `screens.md`, `brief-and-templates.md`, `assets.md`, `api-commands.md`, `testing.md` |
| 5 | Phase 3 (`phase-03.md`) | The user lays out a post by hand | Phase 2 leftovers | `scene.md`, `editor.md`, `editor-commands.md`, `data-model.md`, `data-rules.md`, `assets.md`, `screens.md`, `structure.md`, `security.md`, `testing.md` |
| 6 | Phase 4 (`phase-04.md`) | Empty slots can be filled with AI | Phase 3 | `providers.md`, `jobs.md`, `brief-and-templates.md`, `mcp-and-agents.md`, `api-commands.md`, `screens.md`, `testing.md` |
| 7 | Phase 5 (`phase-05.md`) | One master drives a grid of variants | Phase 4 | `data-model.md`, `data-rules.md`, `api-commands.md`, `comfyui-workflows.md`, `screens.md`, `testing.md` |
| 8 | Phase 6 (`phase-06.md`) | Translations with approval, brand and legal checks | Phase 5 | `data-rules.md`, `export-and-checks.md`, `providers.md`, `screens.md`, `testing.md` |
| 9 | Phase 7 (`phase-07.md`) | Video variants preview as they will export | Phase 6, OI-09, OI-30 | `providers.md`, `jobs.md`, `cancel.md`, `assets.md`, `data-rules.md`, `infra-and-settings.md`, `security.md`, `screens.md`, `testing.md` |
| 10 | Phase 8 (`phase-08.md`) | Deliverables and a report on disk | Phase 7 | `export-and-checks.md`, `infra-and-settings.md`, `screens.md`, `testing.md` |
| 11 | Phase 9 (`phase-09.md`) | A campaign's deliverables in S3 or Dropbox | Phase 8, OI-18 for the hand proof | `storage-and-publish.md`, `security.md`, `infra-and-settings.md`, `screens.md`, `testing.md` |
| 12 | Phase 10 (`phase-10.md`) | Claude can read and edit open projects | Phases 3, 6, 7; group 3 | `mcp-and-agents.md`, `api-principles.md`, `api-commands.md`, `api-queries-events.md`, `security.md`, `screens.md`, `testing.md` |
| 13 | Phase 11 (`phase-11.md`) | A repository ready to publish; nothing published (D-086) | Phases 1 to 10 | `overview.md`, `infra-and-settings.md`, `testing.md` |

Every developer also reads `overview.md`. Open questions are in `open-items.md`.

## Rules for every phase

- **Screens are built with their logic** (D-084). `[logic]` and `[UI]` tags show where the work lands, not when. Components are modular, one folder each, and take all styling from the shared tokens.
- **Test first.** A developer writes a failing test, then the code that passes it. A developer does not edit an existing test unless the slice lists that edit as approved.
- **One slice per developer run**, sized well under 300k tokens. A developer who finds the slice too large stops at a passing point, commits, writes `HANDOFF.md`, and hands off.
- **A slice edits only the files it owns.** The architect names them in the brief. Slices that own no shared file may run side by side in worktrees.
- **Security-class slices get a review** before they merge. The brief says "full" or "short".
- **Verification classes** (A to G) and what each runs are in `spec/testing.md`.
- **Paid calls.** Automatic tests never make a paid call. A developer may make one low-cost paid run per new feature, at the smallest size and shortest length (D-085). No agent reads a key file.
- **Nothing leaves this machine.** Work is committed and merged locally. Nothing is pushed, tagged or released (D-086).
- **Windows.** Agents verify on macOS only. An exit criterion that says "on both systems" is met on macOS, and Windows is listed as the stakeholder's check (D-087).

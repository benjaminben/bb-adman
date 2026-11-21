# Phase 4 — AI generation

Bullets carry `[logic]` (main process, shared code, commands, queries, data, providers) or `[UI]` (screens, dialogs, panels and controls in `src/renderer/`). Both are built in this phase (D-084): each slice builds its screens with its logic, as modular components styled only from the shared tokens.

**Goal:** Empty slots can be filled with AI.
**Class:** E, D

Already built in Phase 2 and not repeated here: the provider registry, error kinds, plain messages, the job runner, the fake provider's picture and video parts, Gemini picture generation, generation details embedded in PNG, and `generation.runImages`. The key guard exists from Phase 1; every command and job that calls a provider calls it first.

## Scope

- [logic] Fake provider: its layout and text parts.
- [logic] Gemini adapter: layout, extract brief, copy options. `generation.proposeLayout` and `generation.copyOptions` are attached jobs (`spec/jobs.md`).
- [logic] Markdown and plain-text brief intake.
- [logic] Firefly stub, listed as not yet available.
- [logic] Paid generations per campaign, split into pictures and videos, from `job.paid_calls`: a query, and the figure for the run confirmation [REQ: FR-230].
- [logic] Earlier options for a layer: a query that lists the assets of earlier runs by `job.layer_id` or `job.slot`. Picking one is a `layer.update` and calls no provider [REQ: FR-248, FR-216].
- [logic] Cut-outs, since Q-032 was decided yes: the cut-out interface, its provider and job kind (OI-29). See slice CO below.
- [UI] Activity panel, over all campaigns: campaign, variant and layer for each job, "go there" in one action, and running and not-yet-looked-at marks [REQ: FR-217, FR-218]. The warning before closing a tab or dialog with an attached job in progress [D-036].
- [UI] Generation panel, run confirmation dialog with count and provider choice. The dialog and the campaign view show the campaign's paid generation count [REQ: FR-230]. A layer that was generated into offers its earlier options [REQ: FR-248]. Reference pictures are chosen in a dialog.

## Exit criteria

- Workflow 5.1 runs end to end with the fake provider in CI.
- Workflow 5.1 runs with a real Gemini key by hand. Under D-085 a developer may confirm it once with one low-cost paid run; the stakeholder runs the full hand check.
- Each error kind shows its message and a Retry button.

## Dependencies

- Phase 3.
- Gemini model IDs checked for layout, extract brief and copy options (`spec/providers-adapters.md`).
- Q-032 decided (OI-29): answered yes.

## Carried in from earlier work

- **Agent runs for the new Gemini jobs.** When this phase builds `generation.proposeLayout` and `generation.copyOptions`, their agent policy is `tick`, under the Gemini tick. Add both to the commands the gate in `src/main/commands/agent-run-gate.ts` knows, with gate tests as for `generation.runImages` [D-080].
- **The option-placing handler and the box shape** (OI-70). Today a picture job asks the provider for the variant's shape, for every slot and layer. Recommended and to be ruled with this handler: ask for the shape of the layer's box, so less of the picture is cropped when placed. If this handler is the first command to bump `variant.rev`, it carries the user-and-agent test of the `variant.rev` helper.
- **A plain sentence per failure cause** (OI-68). When a picture job fails after it was queued for a reason that is not the provider's (a reference file gone or changed, the key removed, the assets folder not writable), the user today reads "{Provider} could not finish this request." with Retry, which then shows the real refusal. Recommended: give each case its own sentence, built with the activity panel. Nothing from the `AppError` may reach the job row, the sentence or the log line.
- **Slice CO — AI cut-out** (OI-55) [REQ: FR-307]. Through ComfyUI's built-in step (one more shipped workflow, core nodes only) or through fal (after slice J, Phase 7). The result is a new PNG asset with a see-through background. It can be used as a hero image or a reference until layers exist. The note on see-through pixels passing through `toPng` (`spec/assets.md`) is ruled with it.
- **References in the generate flow:** a generated result used as a reference, and removing a reference from the project, are screen work here if ruled (see "Waiting on a ruling" in `spec/phases/phase-02-leftovers.md`).

## Not designed yet

- Slice CO: which route (ComfyUI or fal), the workflow, the job kind, and the see-through pixels rule.
- The plain sentences per failure cause (OI-68).
- The activity panel's layout and the close warning's wording.

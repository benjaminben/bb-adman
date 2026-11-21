# Phase 4 — AI generation

**Goal:** Empty slots can be filled with AI.

**Exit criteria**

- Workflow 5.1 runs end to end with the fake provider in CI (`tests/e2e/workflow-5-1.spec.ts`, P4-20), and the workflow 5.8 steps it covers: a run left going while the user works in another campaign, then found from the activity panel.
- Workflow 5.1 runs with a real Gemini key by hand. Under D-085 each new paid feature (layout, extract brief, copy options) is confirmed once by its slice with one low-cost run; the stakeholder runs the full hand check.
- Each error kind shows its message and a Retry button, and each local failure cause shows its own sentence (OI-68).
- The cut-out workflow has had its one real-server run (D-092), or is recorded as `draft` with the reason (A-57).

**Dependencies:** Phase 3 merged (the editor, tabs, nav store, picture fields, thumbnails). P4-1 and the main-process slices of wave 2 touch no Phase 3 file and may start before (see the wave table). Built and used here: the job runner, the picture and video kinds, the Gemini picture adapter, the ComfyUI adapter and its stand-in, the agent-run gate, the key guard, `toPng`, `bumpVariantRev`, the dialog frame.

**Design:** `spec/ai-jobs.md` (kinds, commands, queries, the cut-out workflow, failure sentences, fake provider parts) and `spec/screens-ai.md` (every Phase 4 screen and its wording). The Gemini calls: `spec/providers-adapters.md`, "Layout and text". Assumptions A-57 to A-70 in `spec/assumptions.md`, and OI-55, OI-68, OI-70 there.

## Rules for these slices

- Every slice: write the failing tests first, then the code; run lint, typecheck and `npm test` in full; plus what its class asks (`spec/testing.md`). A slice that touches the renderer runs `npm run test:e2e` too.
- A slice edits only the files it owns and the existing files it may touch. A change needed elsewhere: stop and report.
- **Shared files.** Only P4-1 edits `agent-policy.ts`, `agent-run-gate.ts`, `job-kinds.ts`, the Drizzle schema and migrations, `src/main/providers/types.ts`, `registry.ts` (P4-4 changes only the two model IDs), the command, kind and query index files (`commands/generation/index.ts`, `commands/brief/index.ts`, `commands/layer/index.ts`, `jobs/kinds/index.ts`, `queries/queries.ts`) and `tokens.css`. P4-1 registers every new command, job kind and query against a stub file; the slice that owns the stub replaces its body and touches no index. No Phase 4 slice edits `core-deps.ts`, `bus.ts`, `events.ts` or `shortcuts.ts`; only P4-10 edits `core.ts` (`closeAllStopping`).
- **Paid calls.** Automatic tests never make one. P4-4 makes one low-cost live run per new Gemini feature (three in all: smallest input, one call each, no retry) and reports model ID, time and size, never the answer's text. No other slice makes a paid call.
- **The real ComfyUI server.** Only P4-9 runs on it: `test:comfy` case 8, once (a second run only after a data fix, A-57). Every other slice tests ComfyUI against the stand-in.
- **Screens** (D-084): one folder per component, CSS from tokens only, data through props or a store. Folders are named in `spec/screens-ai.md`, "Where the code lives". Each slice that adds or changes something a user can see adds its own `tests/shots/{slice}.shots.ts` (for example `tests/shots/p4-12.shots.ts`) and names the pictures in its report.
- **Moves.** A component moved to `ui/` keeps its tests: the only approved test edits are import paths, listed in the slice.
- Budget: one slice per developer run, well under 300k tokens; hand off with `HANDOFF.md` if near it.

## Order and side-by-side work

| Wave | Slices (side by side in separate worktrees) | Waits for |
|------|---------------------------------------------|-----------|
| 1 | P4-1 | Nothing (may start before Phase 3 ends) |
| 2 | P4-2, P4-3, P4-4, P4-5, P4-6, P4-7, P4-8, P4-9 (main process; may start before Phase 3 ends); P4-10 | P4-1; P4-10 also Phase 3 (it edits the tabs and the project switcher) |
| 3 | P4-11 (after P4-3, P4-5, P4-9); P4-12 (after P4-2) | Phase 3 for P4-12 |
| 4 | P4-13 (after P4-12); P4-14 (after P4-2, P4-5, P4-12); P4-15 (after P4-8, P4-10, P4-12); P4-16 (after P4-7, P4-10, P4-12); P4-17 (after P4-8, P4-10, P4-12) | |
| 5 | P4-18 (after P4-13); P4-19 (after P4-11, P4-12) | |
| 6 | P4-20 | Every other slice |

No two slices of one wave edit the same file: wave 2 splits by folder (queries, `fake/`, `gemini/`, the job helpers and run failure, `firefly/`, layout, copy and brief, `comfyui/`, the tabs); wave 4 by component (`properties-panel` and `picture-ai`, the shell and activity, `brief-load`, `top-bar` and `editor-banner`, `text-fields`); wave 5 by `picture-ai` against `picture-fields`.

## Slices

### P4-1 — Contracts (built)

- **Exists when done:** the new job kind and its migration; the request and result schemas; the new command and query inputs; the provider interface additions; the policy and gate rows; every new command, kind and query registered against a stub; the reason sentences; the Phase 4 tokens.
- **New files:** `src/main/db/migrations/0003_job_kind_cutout.sql` with its snapshot and journal entry (by `npm run db:generate`); `src/shared/schemas/jobs/layout-proposal.ts`, `copy-options.ts`, `brief-extraction.ts`, `cutout.ts`; `src/shared/schemas/queries/earlier-options.ts`, `activity.ts`, `paid-count.ts`; `src/shared/config/copy-options.ts`. Stubs (each replaced by its slice): `src/main/commands/generation/propose-layout.ts`, `copy-options.ts`, `cut-out.ts`; `src/main/commands/brief/extract.ts`; `src/main/commands/layer/update-many.ts`; `src/main/jobs/kinds/layout-proposal.ts`, `copy-options.ts`, `brief-extraction.ts`, `cutout.ts`; `src/main/queries/earlier-options.ts`, `activity.ts`, `paid-count.ts`. A stub command refuses in `prepare` with `INVALID_INPUT` "That provider cannot do this yet."; a stub kind throws `ProviderFailure` `other` "Not built yet"; a stub query returns an empty list or zeros.
- **May touch:** `src/shared/config/job-kinds.ts`; `src/main/db/schema/jobs.ts`; `src/shared/schemas/commands/generation.ts`, `commands/brief.ts`, `commands/layer.ts`; `src/main/providers/types.ts`; `src/shared/schemas/queries/app.ts` (`ProviderJob`, `PROVIDER_ERROR_REASONS`); `src/main/providers/registry.ts` (`cutout` in the ComfyUI and fake rows); `src/shared/providers/messages.ts` (the eight reason sentences); the index files named in "Shared files"; `src/main/commands/agent-policy.ts`; `src/main/commands/agent-run-gate.ts`; `src/renderer/ui/tokens.css`; any file whose exhaustive table over `ProviderErrorReason` or `JobKind` stops compiling (one line each, named in the report).
- **Read:** `spec/ai-jobs.md` "Contracts" and "A plain sentence per failure cause"; `spec/data-rules.md` "Data migration"; `spec/agent-runs.md` "Gate steps for a run"; `spec/mcp-and-agents.md` "Agent policy table"; `spec/screens-ai.md` "Where the code lives" (tokens).
- **Tests:** `tests/integration/db/migration-0003.test.ts` (the cases in `spec/ai-jobs.md`); `tests/unit/shared/schemas/phase4-schemas.test.ts` (each new input and job schema: a good value, each refused field, `count` bounds, `updates` 1 to 100); `tests/integration/commands/agent-run-gate-phase4.test.ts` (for each of `generation.proposeLayout`, `generation.copyOptions`, `generation.cutOut` as the agent: unknown provider, provider not offered, tick off, limit reached each give `AGENT_DENIED` with the gate's sentence and no job row; ticked, the call passes the gate and reaches the stub's refusal); `brief.extract` as the agent gets `AGENT_DENIED`; `layer.updateMany` as the agent passes the deny check. Approved edits: `tests/unit/main/commands/agent-policy-table.test.ts` (the new rows), `tests/unit/shared/schemas/contracts.test.ts` (ten kinds), any test that lists command or query names (the new names), the registry test (the `cutout` jobs), `tests/integration/db/migration-0002.test.ts` (opens with the first three migrations only).
- **Class:** B (+ A). Security class, short review (policy rows, gate, migration). **After:** nothing.

### P4-2 — Queries: earlier options, activity, paid count (built)

- **Exists when done:** `job.earlierOptions`, `job.activity` and `campaign.paidCount` answer as `spec/ai-jobs.md`, "The three queries" says.
- **New files:** the bodies of `src/main/queries/earlier-options.ts`, `activity.ts`, `paid-count.ts` (stubs from P4-1).
- **Read:** `spec/ai-jobs.md` "The three queries"; `spec/api-queries-events.md` "Runner rules".
- **Tests:** `tests/integration/queries/earlier-options.test.ts` (runs by layer and by the layer's slot in its own variant only; a slot run of another variant left out; newest first; removed asset rows dropped; `missing` set; running and failed runs listed; unknown layer `NOT_FOUND`); `activity.test.ts` (names filled; a deleted layer, variant or campaign gives null; a brief job has all three null; an unreadable row left out; `limit`); `paid-count.test.ts` (the three sums by kind; another campaign's jobs left out; local providers add nothing because their `paid_calls` is 0; unknown campaign `NOT_FOUND`).
- **Class:** B. Not security class. **After:** P4-1.

### P4-3 — Fake provider: layout, text and cut-out parts (built)

- **Exists when done:** the fake provider answers `layout`, `text` (extract brief, copy options; translate refuses) and `cutout` as `spec/ai-jobs.md`, "The fake provider's parts" says.
- **New files:** `src/main/providers/fake/layout.ts`, `text.ts`, `cutout.ts`.
- **May touch:** `src/main/providers/fake/index.ts`, `fake/png.ts` (the alpha form).
- **Read:** `spec/ai-jobs.md` "The fake provider's parts", "Provider interfaces"; `spec/jobs.md` "The fake provider"; `spec/brief-and-templates.md` "The default layout".
- **Tests:** in `tests/unit/main/providers/fake/`: `layout.test.ts` (headline and call-to-action boxes from the default layout; other items stacked inside the canvas; palette colour), `text.test.ts` (a Markdown brief with every label gives the expected draft; unknown lines ignored; copy options count and length), `cutout.test.ts` (output size equals input; colour type 6; a corner pixel alpha 0 and the centre 255, read with `node:zlib`), and the behaviour switches (`fail`, `waitMs`, `onCancel`) once per part.
- **Class:** E. Not security class. **After:** P4-1.

### P4-4 — Gemini: layout, extract brief, copy options (built)

- **Exists when done:** `adapterFor(deps, 'gemini', 'layout' | 'text')` returns working adapters; model IDs checked (OI-10); one live run of each feature made and reported.
- **New files:** `src/main/providers/gemini/layout.ts`, `text.ts`, `json-call.ts`, `prompts.ts`; `tests/live/gemini-layout.live.test.ts`, `gemini-brief.live.test.ts`, `gemini-copy.live.test.ts`.
- **May touch:** `src/main/providers/gemini/index.ts`; `src/main/providers/registry.ts` (`defaultModels.layout` and `.text` only).
- **Read:** `spec/providers-adapters.md` "Gemini" (all of it); `spec/providers.md` "Rules for every adapter"; `spec/ai-jobs.md` "Provider interfaces", "Security notes"; `spec/test-harnesses.md` (live runs).
- **Check first:** Google's public model list for a current model that takes a picture and gives JSON. Change the registry ID if `gemini-2.5-flash` is retired.
- **Tests:** in `tests/unit/main/providers/gemini/`: `layout.test.ts`, `text.test.ts`, `text-errors.test.ts` (cases in `spec/providers-adapters.md`), `environment.test.ts` extended to a text call; a key planted in an error answer is redacted from every detail. Live: the three files, run once each by the developer (D-085).
- **Class:** E. Security class, full review (new outbound calls; every adapter rule). **After:** P4-1.

### P4-5 — A plain sentence per failure cause (OI-68) (built)

- **Exists when done:** a picture or video job that fails for a local cause ends with its own reason and sentence; nothing from the error reaches the row, the sentence or the log; the shared helpers `readPictures` and `storeResult` exist; the run failure component lives in `ui/`.
- **New files:** `src/main/jobs/local-failure.ts`, `read-pictures.ts`, `store-result.ts`; `src/renderer/ui/run-failure/` (moved from `screens/campaign/run-failure/`).
- **May touch:** `src/main/jobs/run-job.ts`; `src/main/jobs/kinds/image-generation.ts`, `video-generation.ts` (use the two helpers); `src/shared/providers/messages.ts` (`fillMarks` gains `provider`); `src/main/mcp/tools/agent-job-view.ts` (fills `{provider}`); `src/renderer/screens/campaign/run-row/` (the import of the moved component).
- **Read:** `spec/ai-jobs.md` "A plain sentence per failure cause", "Shared job helpers"; `spec/jobs.md` "Errors inside a job"; `spec/assets.md` "Reading a picture to send it", "Creating the assets folder".
- **Tests:** `tests/integration/jobs/local-failure.test.ts`, one case per cause, each queued then broken before its turn (key removed; reference file deleted; replaced by a file over 32 MiB; replaced by a text file; assets folder removed; assets folder made read-only; `asset.addGenerated` refused through a stand-in bus): the row ends `failed`, kind `other`, the reason; `error_detail` is the reason name; no path, code or message of the error in the row, and in **every** log line the test's log holds (this closes the H4 O-3 gap in `review-leftovers.md`); another `AppError` gives no reason and `error_detail` `app_error`. `tests/unit/shared/providers/messages-local.test.ts` (each sentence with `{provider}` filled). `tests/unit/main/mcp/tools/agent-job-view.test.ts` gains the filled sentence. Approved edits: `tests/integration/generation/image-kind-errors.test.ts` (`error_detail` is now the reason name), the run-failure and run-row tests (import path only).
- **Class:** B + E + D. Security class, short review. **After:** P4-1.

### P4-6 — Firefly stub (built)

- **Exists when done:** `src/main/providers/firefly/` implements `ImageProvider` from Adobe's public documentation, tested on recorded examples, never called at run time; `adapterFor` refuses an unavailable provider.
- **New files:** `src/main/providers/firefly/index.ts`, `image.ts`, `token.ts`, `pinned-origin.ts`.
- **May touch:** `src/main/providers/adapters.ts`.
- **Read:** `spec/providers-adapters.md` "Adobe Firefly (stub)"; `spec/providers.md` "How an adapter is reached", "Rules for every adapter".
- **Tests:** `tests/unit/main/providers/firefly/` (`token.test.ts`: the token request's form and host; `image.test.ts`: the generate request and a recorded answer; `pinned-origin.test.ts`: each host refuses the other; `environment.test.ts`); `tests/unit/main/providers/adapters-available.test.ts` (`adapterFor` on `firefly` and on `fal-seedance` gives `INVALID_INPUT`; Gemini and the fake still resolve).
- **Class:** E. Security class, short review. **After:** P4-1.

### P4-7 — Layout job, the picture without text, `layer.updateMany` (built)

- **Exists when done:** `generation.proposeLayout` enqueues an attached job that sends the variant drawn without text and keeps clamped boxes; `layer.updateMany` applies many layer patches as one undo entry; `layoutPatches` turns a result into that command's input.
- **New files:** the bodies of `src/main/commands/generation/propose-layout.ts`, `src/main/jobs/kinds/layout-proposal.ts`, `src/main/commands/layer/update-many.ts`; `src/shared/generation/layout-clamp.ts`, `layout-patches.ts`.
- **May touch:** `src/main/thumbnails/service.ts`, `types.ts`, `scene-input.ts` (`renderPictures`, a scene with text layers left out).
- **Read:** `spec/ai-jobs.md` "Layout proposal"; `spec/editor-commands.md` "Rules for every layer and variant command", "`layer.update`"; `spec/scene.md` "The render service".
- **Tests:** `tests/unit/shared/generation/layout-clamp.test.ts` (each clamp, rounding, unknown key, repeated key, bad colour, palette snap, align fallback), `layout-patches.test.ts`; `tests/integration/generation/propose-layout.test.ts` (each refusal in order; no text layer; enqueued attached with campaign and variant); `layout-kind.test.ts` (with a stand-in adapter: the scene handed to the draw has no text layers; the picture's longest side is 1024; items, palette and fonts as specified; boxes clamped; no box gives `other`; a deleted variant gives `target_gone`; a cancelled job keeps no result); `tests/integration/commands/layer-update-many.test.ts` (one undo entry and one `rev` bump; undo restores every layer; all or nothing on one bad item; a layer of another variant `NOT_FOUND`; a repeated layer refused; asset checks per item; the agent stamps `agent_changed_at`). Plus the scene reference run of class C.
- **Class:** B + A + C. Security class, short review (a new command open to agents). **After:** P4-1.

### P4-8 — Copy options job and brief reading job (built)

- **Exists when done:** `generation.copyOptions` and `brief.extract` enqueue their attached jobs; the jobs call the text adapter and keep clean results.
- **New files:** the bodies of `src/main/commands/generation/copy-options.ts`, `src/main/jobs/kinds/copy-options.ts`, `src/main/commands/brief/extract.ts`, `src/main/jobs/kinds/brief-extraction.ts`; `src/shared/brief/brief-file-kind.ts`, `primary-language.ts`.
- **May touch:** `src/main/commands/brief/parse.ts` (uses `primaryLanguageOf`, nothing else changes).
- **Read:** `spec/ai-jobs.md` "Copy options", "Brief reading"; `spec/brief-and-templates.md` "The `brief.parse` command", "The brief's shape".
- **Tests:** `tests/unit/shared/brief/brief-file-kind.test.ts`, `primary-language.test.ts`; `tests/integration/generation/copy-options.test.ts` (each refusal, the headline included; role and `maxChars` from the slot; the job's cleaning: trimmed, empty, too long and repeated options dropped, cut to `count`; none left gives `other`; the campaign gone gives `target_gone`); `tests/integration/campaigns/brief-extract.test.ts` (relative path, wrong ending, missing file, unreadable file, empty file, provider without `text`; a fake run gives the draft and `primaryLanguage`; a wrong-typed field in the answer is dropped; no brief text in any log line; the agent is denied). `brief-parse.test.ts` must pass unchanged.
- **Class:** B + A. Security class, short review (`brief.extract` reads a path). **After:** P4-1.

### P4-9 — ComfyUI cut-out workflow and adapter (built)

- **Exists when done:** the `birefnet-cutout` workflow ships as `trial`; `adapterFor(deps, 'comfyui', 'cutout')` makes a cut-out against the stand-in; the check lists its model and nodes; case 8 has run once on the real server and its result is reported. Case 8's real run is still owed: the server lacks the model file.
- **New files:** `src/main/providers/comfyui/workflows/birefnet-cutout.json`, `workflows/birefnet.ts`, `src/main/providers/comfyui/cutout.ts`.
- **May touch:** `src/main/providers/comfyui/index.ts`, `workflows/index.ts`, `workflows/types.ts` (`prompt` optional), `fill.ts`, `run.ts` (`RunAsk.prompt` optional); `src/shared/schemas/queries/comfy.ts` (`WORKFLOW_IDS`, `WorkflowJob`); `src/main/queries/comfy.ts` (the `offered` mark for the `cutout` job, if it lists jobs by name); `tests/comfy/cases.ts`, `comfy.test.ts` (case 8); the ComfyUI stand-in's node and model lists (approved data edit).
- **Read:** `spec/ai-jobs.md` "Cut-out"; `spec/comfyui-workflows.md` "The workflow description", "Filling a run"; `spec/comfyui.md` (a picture run); `spec/comfyui-trials.md` (`test:comfy` rules).
- **Tests:** `tests/unit/main/providers/comfyui/fill-no-prompt.test.ts` (no prompt slot: a prompt value refused, none accepted; with a prompt slot, a missing prompt still refused); `workflows.test.ts` gains the new spec (every pointer exists, links point at nodes that exist, node 6 is the output); `tests/integration/providers/comfyui-cutout.test.ts` against the stand-in (one upload under `uploadName`, the graph sent holds that name at node 1 and no other value from the caller, the result read from node 6, details from the spec, a cancel before submission sends nothing); `comfy-check` shows `birefnet.safetensors` in `background_removal` when missing; `comfy.getInfo` marks `birefnet-cutout` `offered` with dev tools on and not with them off. Real server: `ADMAN_COMFY_CUTOUT=1 npm run test:comfy`, once.
- **Class:** E. Security class, full review (graph filling, what is sent). **After:** P4-1.

### P4-10 — Attached jobs and the close warnings (built)

- **Exists when done:** the window remembers the attached jobs it started; closing a variant tab, a campaign tab or an owning dialog with one running asks first; closing a project or quitting with jobs running asks first and stops them on confirm.
- **New files:** `src/renderer/stores/attached-store.ts`; `src/renderer/ui/close-warning/`; `src/main/quit-question.ts` (the pure wording).
- **May touch:** `src/renderer/screens/campaign/variant-tabs/`, `src/renderer/app/campaign-tabs/`, `src/renderer/app/project-switcher/`; `src/main/index.ts` (`before-quit`); `src/main/core.ts` (`closeAllStopping`).
- **Read:** `spec/screens-ai.md` "Attached jobs and the close warning"; `spec/jobs.md` "Job kinds and their two classes", "Closing a project and quitting"; `spec/editor.md` "Navigation".
- **Tests:** `tests/unit/renderer/stores/attached-store.test.ts` (register, end, finish runs once on success only, a cancelled job never finishes, per-owner lists); `tests/unit/renderer/ui/close-warning.test.tsx` (titles for one and several tasks; the paid line only with a paid provider; "Keep open" focused and closes nothing; "Stop and close" sends `job.cancel` for each then closes; axe); `tests/unit/renderer/screens/campaign/variant-tabs-warning.test.tsx` and `tests/unit/renderer/app/campaign-tabs-warning.test.tsx` (no job: closes at once; a job: warns); `tests/unit/renderer/app/project-switcher-close.test.tsx` (the wording, then `project.close` with `'stop'`); `tests/unit/main/quit-question.test.ts`; `tests/integration/core/close-all-stopping.test.ts` (no row stays `queued` or `running`). Shots: `tests/shots/p4-10.shots.ts`.
- **Class:** D + G. Not security class. **After:** P4-1, Phase 3.

### P4-11 — Cut-out command and job (built)

- **Exists when done:** `generation.cutOut` checks and enqueues a `cutout` job; the job makes a new asset with see-through pixels, kept through `toPng`; retry runs the ComfyUI checks again.
- **New files:** the bodies of `src/main/commands/generation/cut-out.ts` and `src/main/jobs/kinds/cutout.ts`; `tests/e2e/cutout-alpha.spec.ts`.
- **May touch:** `src/main/commands/generation/comfy-checks.ts` (`checkComfyCutout`); `src/main/commands/job/retry.ts`; `src/main/commands/asset/add-generated.ts` (`gen_prompt` null without a prompt); `src/main/jobs/png-details.ts` (the `cutout` kind in the details, if its type needs it).
- **Read:** `spec/ai-jobs.md` "Cut-out", "Shared job helpers"; `spec/api-commands.md` "`generation.runImages`" (the checks it copies); `spec/export-and-checks.md` "Embedded generation details".
- **Tests:** `tests/integration/generation/cut-out.test.ts` (each refusal in order; a layer with no picture; ComfyUI with no address, no offered workflow (dev tools off) and with one (dev tools on); the source read in `prepare`; enqueued with the layer; the agent ticked is accepted; `licenceConfirmed: true` from the agent is ignored, so an unconfirmed licence still refuses); `cutout-kind.test.ts` (fake provider: one new asset, `gen_prompt` null, `gen_run_id` the job, details embedded with kind `cutout`, the source asset unchanged; a source deleted after enqueue gives `picture_missing`); `tests/integration/commands/job-retry-cutout.test.ts`; `tests/e2e/cutout-alpha.spec.ts` (in Electron, a fake cut-out run ends with a PNG of colour type 6, a corner pixel alpha 0 and the centre 255, read with `nativeImage`). `asset-add-generated.test.ts` gains the no-prompt case.
- **Class:** B + G (the e2e file). Security class, short review. **After:** P4-3, P4-5, P4-9.

### P4-12 — Run confirmation dialog and the paid count (built)

- **Exists when done:** one dialog confirms every Phase 4 run, with provider choice, count, what the run does and the campaign's paid count; the campaign overview shows the paid count.
- **New files:** `src/renderer/dialogs/run-dialog/` (`run-dialog.tsx`, `provider-choice.tsx`, `run-summary.ts`); `src/renderer/ui/paid-count/`.
- **May touch:** `src/renderer/screens/campaign/campaign-view/` (the paid count line).
- **Read:** `spec/screens-ai.md` "The run confirmation dialog", "The paid count"; `spec/screens.md` "Rules for every screen"; `spec/screens-campaign.md` "The trial mark in the panels".
- **Tests:** `tests/unit/renderer/dialogs/run-dialog.test.tsx` (provider list per job; unavailable and not-offered providers disabled with their words; the default choice, ComfyUI first for cut-outs; each summary line, ComfyUI's with address and workflow; count bounds; retry mode fixed; Confirm disabled until the caller resolves; no provider enabled; axe); `tests/unit/renderer/dialogs/run-summary.test.ts`; `tests/unit/renderer/ui/paid-count.test.tsx` (wording with and without text requests; reads again on a `job.updated` of its campaign only). Shots: `tests/shots/p4-12.shots.ts` (the dialog for Gemini, ComfyUI and a retry; the overview line).
- **Class:** D. Not security class. **After:** P4-2, Phase 3.

### P4-13 — The picture section: generate fields and reference dialog (built)

- **Exists when done:** a picture or background layer shows "Make pictures with AI" in the properties panel; Generate goes through the run dialog to `generation.runImages` for that layer; reference pictures are chosen in a dialog that also lists generated pictures; a layer run asks for the layer box's shape (OI-70).
- **New files:** `src/renderer/editor/picture-ai/`, `editor/generate-fields/`, `src/renderer/dialogs/reference-dialog/`, `src/renderer/stores/generate-drafts.ts`; `src/renderer/ui/reference-picker/` (moved from `screens/campaign/reference-picker/`).
- **May touch:** `src/renderer/editor/properties-panel/` (mounts `picture-ai`); `src/renderer/screens/campaign/generate-panel/` (the import of the moved picker only); `src/main/commands/generation/run-images.ts` (the box shape).
- **Read:** `spec/screens-ai.md` "The picture section of the properties panel" (generate fields, reference dialog); `spec/api-commands.md` "`generation.runImages`"; `spec/assets.md` "Which pictures a run sends".
- **Tests:** `tests/unit/renderer/editor/generate-fields.test.tsx` (prompt prefilled; the subjects' reference pictures chosen the first time; draft kept per layer; Generate opens the run dialog and Confirm sends one `generation.runImages` with `layerId`; the status line follows the job; locked layer disabled; axe); `tests/unit/renderer/dialogs/reference-dialog.test.tsx` (two lists; ticks in order across both; the limit; Done and Cancel; axe); `tests/integration/generation/run-images-box.test.ts` (an image layer 400 × 200 gives that request size; a background its own box; a slot the variant's size). Approved edits: the reference picker's tests and `generate-panel` tests (import path only). Shots: `tests/shots/p4-13.shots.ts`. Shots also hold the run dialog for Gemini and ComfyUI (owed by P4-12).
- **Class:** D + B. Not security class. **After:** P4-12.

### P4-14 — The activity panel (built)

- **Exists when done:** an "Activity" button and panel list the shown project's jobs with what, where, status and marks; "Go there" opens the place in one action; Cancel and Retry work from a row.
- **New files:** `src/renderer/app/activity-button/`, `app/activity-panel/`, `app/activity-row/`; `src/renderer/stores/activity-store.ts`; `src/renderer/ui/go-there.ts`; `src/renderer/ui/cancel-shown.ts` (moved from `screens/campaign/run-row/`).
- **May touch:** `src/renderer/app/app-shell/` (mounts the button and the panel); `src/renderer/screens/campaign/run-row/` (the import of `cancel-shown` only).
- **Read:** `spec/screens-ai.md` "The activity panel"; `spec/screens.md` "Run list and run row"; `spec/editor.md` "What each tab keeps"; `spec/jobs.md` "The job record in use" (marks).
- **Tests:** `tests/unit/renderer/stores/activity-store.test.ts` (load, apply an update, read again for a new ID, a late reply dropped); `tests/unit/renderer/app/activity-row.test.tsx` (what and where wording per kind; deleted parts; marks; Cancel by the rule; Retry for background kinds only, paid through the run dialog; the failure sentence; axe); `activity-panel.test.tsx` (two lists and their order; the start-screen line; Escape closes; axe); `tests/unit/renderer/ui/go-there.test.ts` (layer, gone layer, gone variant, video job, brief job, gone campaign). Approved edit: `tests/unit/main/jobs/cancel-shown.test.ts` (import path only). Shots: `tests/shots/p4-14.shots.ts`, and the run dialog in retry mode (owed by P4-12).
- **Class:** D. Not security class. **After:** P4-2, P4-5, P4-12.

### P4-15 — Reading a Markdown or text brief (built)

- **Exists when done:** a `.md` or `.txt` brief loaded from the project home goes through the run dialog to `brief.extract`, shows a reading dialog, and opens the brief form filled; with no key, cancelling the key dialog opens the empty form.
- **New files:** `src/renderer/dialogs/brief-reading-dialog/`.
- **May touch:** `src/renderer/screens/project-home/brief-load/`.
- **Read:** `spec/screens-ai.md` "Reading a brief with AI"; `spec/screens-campaign.md` "The brief form"; `spec/ai-jobs.md` "Brief reading".
- **Tests:** `tests/unit/renderer/screens/project-home/brief-load-text.test.tsx` (`.json` still goes to `brief.parse`; `.md` opens the run dialog, then `brief.extract`; success opens the filled form and sends `job.markSeen`; failure shows the sentence, "Try again" and "Fill the form by hand"; a cancelled key dialog opens the empty form); `tests/unit/renderer/dialogs/brief-reading-dialog.test.tsx` (Stop; closing while running warns; axe). `brief-load.test.tsx` must pass unchanged. Shots: `tests/shots/p4-15.shots.ts`.
- **Class:** D. Security class, short review (a path to a new command). **After:** P4-8, P4-10, P4-12.

### P4-16 — Place text with AI (built)

- **Exists when done:** "Place text with AI…" in the editor's top bar runs the layout job through the run dialog; the banner follows it; on success the text layers move in one undo entry, also when the tab is not the one shown.
- **New files:** `src/renderer/editor/layout-run.ts`.
- **May touch:** `src/renderer/editor/top-bar/`, `editor/editor-banner/`, `editor/editor/` (passes the banner its line).
- **Read:** `spec/screens-ai.md` "Place text with AI", "Attached jobs and the close warning"; `spec/ai-jobs.md` "Layout proposal"; `spec/editor.md` "Top bar", "Banner".
- **Tests:** `tests/unit/renderer/editor/layout-run.test.tsx` (disabled with no text; dialog then `generation.proposeLayout`; registered as attached with a finish step; success sends one `layer.updateMany` built by `layoutPatches`; success while another tab shows still applies; a cancelled job sends nothing; failure banner and Dismiss); `editor-banner` and `top-bar` tests gain the new lines (approved additions). Shots: `tests/shots/p4-16.shots.ts` (before and after, using the fake provider; the close warning on a tab, owed by P4-10).
- **Class:** D. Not security class. **After:** P4-7, P4-10, P4-12.

### P4-17 — Copy options dialog (built)

- **Exists when done:** "Suggest copy…" beside a text layer's Copy field opens the copy options dialog; options are made through the run dialog and one is used with a `layer.update`.
- **New files:** `src/renderer/dialogs/copy-options-dialog/`.
- **May touch:** `src/renderer/editor/text-fields/` (the button).
- **Read:** `spec/screens-ai.md` "Copy options"; `spec/ai-jobs.md` "Copy options".
- **Tests:** `tests/unit/renderer/dialogs/copy-options-dialog.test.tsx` (the newest earlier options shown; Make new options goes through the run dialog to `generation.copyOptions`; "Writing options…" and Stop; "Use this text" sends `layer.update { copy }` and closes; `job.markSeen`; a failure's sentence; closing while running warns; axe); `text-fields` test gains the button (hidden for the headline, disabled when locked). Shots: `tests/shots/p4-17.shots.ts` (and the close warning on a dialog, owed by P4-10).
- **Class:** D. Not security class. **After:** P4-8, P4-10, P4-12.

### P4-18 — Earlier options (built)

- **Exists when done:** the picture section lists every earlier run of the layer with its options; choosing one sets the layer's picture with no provider call; results are marked looked at when shown.
- **New files:** `src/renderer/editor/earlier-options/`.
- **May touch:** `src/renderer/editor/picture-ai/` (mounts it).
- **Read:** `spec/screens-ai.md` "Earlier options"; `spec/ai-jobs.md` "The three queries"; `spec/data-rules.md` "Generation".
- **Tests:** `tests/unit/renderer/editor/earlier-options.test.tsx` (runs newest first with their status; "In use" on the layer's picture; Use sends one `layer.update` with `source` and `crop: null` and no generation command; missing file disabled; `job.markSeen` once per unseen run; reads again on a `job.updated` for the layer; Show more; failed run's sentence and Retry; axe). Shots: `tests/shots/p4-18.shots.ts`.
- **Class:** D. Not security class. **After:** P4-13.

### P4-19 — Cut-out button (built)

- **Exists when done:** "Cut out the subject…" in a picture layer's fields runs a cut-out through the run dialog; its result shows in the layer's earlier options.
- **May touch:** `src/renderer/editor/picture-fields/`.
- **Read:** `spec/screens-ai.md` "Cut-out"; `spec/ai-jobs.md` "Cut-out".
- **Tests:** `tests/unit/renderer/editor/picture-fields-cutout.test.tsx` (shown only when a provider can cut out and the layer has a picture; the run dialog lists ComfyUI first; Confirm sends `generation.cutOut`; the status line; axe). Shots: `tests/shots/p4-19.shots.ts` (a cut-out over a coloured background, with the fake provider).
- **Class:** D. Not security class. **After:** P4-11, P4-12.

### P4-20 — Workflow 5.1 end to end and the exit check

- **Exists when done:** the exit criteria above pass; the spec's `Not built` marks for Phase 4 are listed for the orchestrator to turn to `Built`.
- **New files:** `tests/e2e/workflow-5-1.spec.ts`; `tests/shots/p4-20.shots.ts`.
- **May touch:** `tests/e2e/screen-tour.ts` and `screen-tour.spec.ts` (approved: the activity button and the picture section in the tour).
- **Read:** `REQUIREMENTS.md` workflows 5.1 and 5.8; `spec/screens-ai.md`; `spec/test-harnesses.md`.
- **Tests:** `workflow-5-1.spec.ts` with `ADMAN_FAKE_PROVIDERS=1`: load a Markdown brief, read it with AI, correct and create the campaign, open the master, generate pictures for the background through the run dialog, use one from earlier options, place text with AI, suggest copy for the call to action and use one, cut out the subject picture and use it; then start a run, open another campaign, see the mark, go there from the activity panel. A loop over the six error kinds (fake `fail`) checks each message and Retry in earlier options and the activity panel. The fake provider's `fail` can be set only in-process, not from an end-to-end run, so part of this loop is checked in renderer tests.
- **Class:** G (end to end). Not security class. **After:** every other slice. The developer lists the stakeholder's hand checks: workflow 5.1 with a real Gemini key; the cut-out workflow's owner check toward `proven`; Windows (D-087).

## Carried in and settled here

- **Agent runs for the new jobs** [D-080]: P4-1 (policy and gate rows); tools in Phase 10 (A-66).
- **The option-placing handler and the box shape** (OI-70): no new command (A-59); the box shape in P4-13. `bumpVariantRev` and its user-and-agent test already exist from Phase 3.
- **A plain sentence per failure cause** (OI-68): P4-5.
- **Slice CO, the AI cut-out** (OI-55, FR-307): ComfyUI route, P4-9 and P4-11 and P4-19; fal in Phase 7.
- **References in the generate flow:** a generated picture as a reference is ruled in (A-68, P4-13); removing a reference waits for the asset library screen.
- **A generated picture tied to a subject:** not needed by Phase 4 or a later planned phase (A-67).
- **Q-039** (closing with work running): the build asks (A-64, P4-10).

## Not designed yet

Nothing in Phase 4. Left open on purpose: whether a cut-out workflow becomes `proven` (the stakeholder's check), and the MCP tools for the Phase 4 commands (Phase 10).

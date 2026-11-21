# Phase 2 leftovers, group 3: agents generate through the MCP server

This is group 3 of the Phase 2 leftovers. Groups 1, 2, 4 and 5 are in `spec/phases/phase-02-leftovers.md`.

**Goal.** An agent connected through the MCP server can start, follow and cancel its own picture and video runs on every provider the user has allowed for agents in Settings [D-080].

**Rules these slices build.** The agent-run rules are written in full in `spec/mcp-and-agents.md` (the gate, the tick, the limit, unticking, what stays shut) and `spec/cancel.md`. Each entry below repeats every value it must meet, so a brief can quote it.

**State on `main`.** None of this is built. There is no `src/main/commands/agent-run-gate.ts` and no `src/main/commands/agent-runs/`. There is no `agentRunsOffered`, `agentRunLimit`, `agentRuns.setLimit`, `openHandles`, `project.listOpen`, `job.get` or `agentJobView` in `src/`. `agent-policy.ts` still maps `tick` to `deny`. `offered.ts` still refuses any actor other than the user. `src/main/mcp/tools/table.ts` has four tools: `get_project`, `list_assets`, `get_campaign`, `create_campaign`. No screen says "Started by an agent".

## Order

1. AR-1 and MCP-D in parallel. Neither touches the other's files.
2. After AR-1 merges: AR-2, AR-3 and MCP-G in parallel. MCP-G also waits for MCP-D, since both edit `src/main/mcp/tools/table.ts`.
3. Merge order: AR-1 and MCP-D (either first), then AR-3 and MCP-G, then AR-2. With AR-1, AR-3 and MCP-G merged, an agent can make ComfyUI pictures and video. AR-2 adds Gemini.
4. Then the first agent run on the user's ComfyUI server (last entry).

- **Target date.** MCP generation working by the end of 2026-11-22. LO-1a (group 1) rewrites every import in `src/`, so it collides with every slice here. If the date holds, run this group before LO-1a, or start LO-1a only once this group has merged.
- **Cut line, first to last:** the run row mark in AR-3; AR-2 (agents then use ComfyUI only, and Gemini cannot be ticked); MCP-D's pickers for `get_project` and `get_campaign` (the reply-keys test still guards them). Never cut: AR-1, AR-3's ticks, `list_projects`, `get_slots`, `get_job`, MCP-G.
- **Checks.** AR-1 and AR-2: lint, typecheck, `npm test` (class B with E). MCP-D and MCP-G: class E plus `npm test`. AR-3: class D. The full gate runs before a release, not per slice.
- **Paid calls and keys.** Automatic tests never make a paid call. Gemini cases use recorded responses in `tests/fixtures/providers/` or a fake provider row with `local: false`. No slice adds a live case to the suite. No agent reads a key file (D-049). Under D-085 one low-cost paid run may confirm the agent Gemini path once, after AR-2, at the smallest size.
- **What each brief names.** Only: the agent-run rules in `spec/mcp-and-agents.md`, the agent-run limit (1 to 16, default 4, per provider), the unticking rule, the MCP tool list (was Section 4.5), and for MCP-D the reply rules for MCP tools (allow-list pickers, no path, address or secret).

## AR-1 — The gate

- **Class:** B and E. **Security class.** Full review.
- **Depends on:** `main` with CU-6b merged (done). It edits three CU-6b test files.
- **Owns:** `src/shared/config/agent-runs.ts` (`agentRunsOffered`, the limit bounds); `src/shared/schemas/settings.ts`, the settings defaults and loader (`agentRunLimit`); the `settings.update` schema (it refuses `agentRunLimit`; one test); `src/main/commands/agent-run-gate.ts`; `src/main/commands/agent-runs/` (`set-allowed.ts`, `set-limit.ts`, `index.ts`) and their registration; `src/main/commands/agent-policy.ts`; the gate call in `src/main/commands/bus.ts`; `ProjectRegistry.openHandles()` if no read-only way to list open handles exists; `src/main/providers/comfyui/workflows/offered.ts`; the test edits below.

**Must build:**

- **`offeredWorkflow`** (`offered.ts`): a `proven` workflow first, for anyone; else a `trial` one when `who.devTools` is true, whoever asks; else null (`comfy_job_not_offered`). A `draft` is never returned. Remove the `who.actor !== 'user'` test. The parameter keeps its shape. Correct the head comment, and the comments in `comfy-checks.ts` and `comfy-video-checks.ts` that say "an agent never gets one". A packaged app never has dev tools, so an agent there gets nothing on ComfyUI until a workflow is `proven`.
- **`agentRunsOffered(info: ProviderInfo): null | 'agent_runs_not_offered' | 'agent_runs_not_ready'`**, in `src/shared/config/agent-runs.ts` (shared, so Settings shows the list the gate checks). In order:
  1. `available` is false, or `jobs` holds neither `image` nor `video`: `agent_runs_not_offered`. This covers `fal-seedance` until slice J, Firefly and the storage providers.
  2. `local` is false: `agent_runs_not_ready`. AR-2 deletes this step.
  3. Otherwise null.
  - It is the only "tick offered" function. The gate, `agentRuns.setAllowed` and the runner's check (AR-2) all call it. There is no second copy and no `tickOffered`.
  - A `settings.json` entry for a provider it refuses is never read as a set tick. A hand-edited file can hold such an entry (for example `{ "fal-seedance": { "allowed": true } }`); the loader keeps it as written, and the gate and runner refuse it.
  - `src/main/commands/agent-run-gate.ts` is the only reader of `settings.agentRuns`.
- **Policy.** `agentPolicyFor` returns `tick` for a `tick` row. `denyCheck` lets `tick` through for the agent. It still refuses `deny` and any unknown value.
- **Bus order:** deny check, find handler and validate, find project, gate, ask, run. The gate runs only for actor `agent` with policy `tick`: `await agentRunGate(gateDeps, name, parsed.input)`. It runs before `prepare`, so a refused agent causes no file read and no provider call.
- **Commands the gate knows:** `generation.runImages`, `generation.startVideo`, `job.cancel`. Any other `tick` command is refused with `AGENT_DENIED` and `denialMessage(name)`. So `generation.runFill` and the `test.failClosed` raw-tick case stay refused.
- **Gate steps for a run.** Each refusal is `AGENT_DENIED` with the sentence given. Nothing is enqueued or sent. `{Provider}` is the registry `label`.
  1. The registry row for `input.provider` exists and `agentRunsOffered` gives null. Else "Agents cannot start runs with {Provider}." For an unknown ID: "Agents cannot start runs with that provider." `provider` is required for an agent, so the user's default provider is never used.
  2. The tick is on, read at this moment through the one reader. Else "The user has not allowed agents to start runs with {Provider}. They can allow it in Adman's Settings."
  3. The count of jobs with `started_by = 'agent'`, status `queued` or `running`, and that provider, over every open project (one SQL count per open project), is below `settings.agentRunLimit`. Else "Agents already have {n} runs waiting or running with {Provider}. That is the limit set in Adman's Settings." A user's runs are never counted or held back. The runner's own limit (4 per provider, anyone) is separate.
  - No `workflowId` step: neither input schema has the field, and the parse drops unknown keys.
- **`job.cancel` by an agent:** the job is found in the project (else `NOT_FOUND`). `started_by` must be `agent`, else "Agents can cancel only runs they started." No tick is needed. Then `cancelRefusal` applies as for the user (a Gemini run, `cancel` `none`, is refused).
- **After the gate** the command runs as for the user: the same checks and job kind, `startedBy: 'agent'`, `seenAt` null, the count limit of 8 pictures, the reference rule, the picture checks. Refusals reach the agent in the app's own words (`comfy_job_not_offered`, `video_too_long` with `maxMs`, `too_many_references`, `picture_not_usable`, `NEEDS_KEY`, and so on). None holds an address, path or key.
- **`agentRunLimit`:** a whole number 1 to 16, default 4 (`AGENT_MAX_ACTIVE_RUNS`), per provider. Both bounds live in `src/shared/config/agent-runs.ts`. It is not in the `settings.update` schema, which refuses it. A loaded value out of range (for example 99) loads as 4. An agent can neither read nor change it.
- **`agentRuns.setLimit { limit }`:** app scope, not undoable, returns `{ limit }`, sets `changesAppState`. New `AGENT_POLICY` row: `'agentRuns.setLimit': deny('change agent run limits')`.
- **`agentRuns.setAllowed { provider, allowed }`** (its policy row exists, `deny`; the handler is missing): app scope, not undoable, returns `{ provider, allowed }`, sets `changesAppState`. Unknown provider: `INVALID_INPUT`. A provider `agentRunsOffered` refuses: `RULE_VIOLATION`, `details.reason` = the value it gave, message = the step 1 sentence. `allowed: false` is always accepted.
- **No spending cap.** With a paid tick on, the limit bounds how fast an agent spends, not how much. A cap is OI-91.
- **Decide and write down:** whether `jc.system` may keep sending as `actor: 'user'` for a job an agent started. Today the job contract sends every `jc.system` command as the user, whoever started the job, so an agent job's follow-up commands (storing results, for example) run with user rights. The developer reports what those commands are; the architect rules before AR-1 merges.

**Approved edits to existing tests.** These are the only ones, besides the tool snapshot and any test that lists every settings key or every policy row (each gains one entry). Each edit keeps its file and place.

1. `tests/integration/commands/agent-tick.test.ts`, whole file. Name: "the agent policy value tick goes to the gate". For each of the four `tick` rows: `tick` in the table and from `agentPolicyFor`. Through the fixture's `setValueHandler`, `generation.runFill` is refused with `denialMessage` and the value stays null; the user's call runs. The gate cases for the three commands move to AR-1's new gate test file.
2. `tests/integration/generation/run-images-comfy.test.ts:47-51` becomes three cases: (a) tools on, ComfyUI ticked through the user's `agentRuns.setAllowed`: accepted, one job row, `startedBy: 'agent'`, `seenAt` null; (b) tools on, no tick: `AGENT_DENIED` with the step 2 sentence, no job row, the stand-in saw nothing; (c) tools off, ticked: `comfy_job_not_offered`.
3. `tests/integration/generation/start-video-comfy.test.ts:134-142`: cases (a) and (b) for a prompt start.
4. `tests/integration/generation/start-video-picture-checks.test.ts:113-126`: cases (a) and (b) for each picture start.
5. `tests/integration/jobs/job-commands.test.ts:188-200`: `job.cancel` leaves the `it.each` list (`job.retry` and `job.markSeen` stay). New case: the agent's `job.cancel` of a user's job gives `AGENT_DENIED` "Agents can cancel only runs they started."
6. `tests/unit/main/commands/generation/comfy-checks.test.ts:22-23`: rows `[true, 'agent', 0]` and `[true, 'agent', 1]` become `'accepted'`. New row `[false, 'agent', 0, 'comfy_job_not_offered']`.
7. `tests/unit/main/commands/generation/comfy-video-checks.test.ts`: line 24 `[true, 'agent']` becomes `'accepted'`; line 25 stays; lines 63 and 65 leave the refused list; the "gets the workflow" table (lines 53-59) gains the agent with dev tools on for each pair.
8. `tests/unit/main/providers/comfyui/offered.test.ts:38-40`: "gives a trial workflow to an agent with dev tools on, as to the user [D-080]". New: an agent with dev tools off gets null; a `draft`-only list gives null to both actors.

- **Not changed:** `bus-fail-closed.test.ts`, `tools-door.test.ts` (`subject.create` stays deny), `agent-caller.test.ts`, `comfy-get-info.test.ts`, `job-server-message.test.ts`, and every other `AGENT_DENIED` test of a deny command. Any other existing test that fails: stop and report.

**New tests** (a new file under `tests/integration/commands/`, real handlers, fake runner, ComfyUI stand-in):

- `agentRunsOffered`: Gemini as registered gives `agent_runs_not_ready`; ComfyUI and the fake provider give null; `fal-seedance`, S3 and Firefly give `agent_runs_not_offered`.
- Each gate step's refusal, sent as the agent through the bus: no job row, nothing sent.
- A ticked ComfyUI run as the agent: accepted, `startedBy: 'agent'`, `seenAt` null. (This is also the test owed for the `startedBy: 'agent'` branch of `generation.runImages`.)
- A hand-edited `settings.json` `{ "fal-seedance": { "allowed": true }, "gemini": { "allowed": true } }` loads with both entries kept, and each is refused at step 1.
- Limit 2: two agent jobs held `queued`; a third is refused "Agents already have 2 runs…". A user's queued job is not counted. Another provider's jobs are not counted.
- Untick: the next agent call is refused at step 2.
- The agent's `job.cancel` on its own queued job: cancelled. On a user's job: refused.
- `agentRuns.setAllowed` and `agentRuns.setLimit` as the agent: `AGENT_DENIED`. `setLimit(0)` and `setLimit(17)` as the user: `INVALID_INPUT`. `"agentRunLimit": 99` in the file loads as 4.

## MCP-D — Read tools

- **Class:** E and B. **Security class.** Short review.
- **Depends on:** `main`. Starts beside AR-1.
- **Owns:** the query `project.listOpen`, the query `job.get` and their schemas; the tools `list_projects`, `get_slots`, `get_job`, `list_jobs`; the reply pickers for `get_project` and `get_campaign`; `agentJobView`; the tool-list snapshot (8 tools).

**Must build:**

- **Query `project.listOpen`:** `{ id, name }[]` for open projects only, never `filePath`. Its row in the queries table (`spec/api-queries-events.md`) is `allow` for the agent. `list_projects` maps to it one to one. `app.getState.openProjects` must not be wrapped instead, since it carries `filePath`. Without this tool an agent cannot learn a `project_id` and the user must paste it.
- **`get_project` and `get_campaign`:** allow-list pickers over today's fields, as `list_assets` already has. Today both pass whole wire rows, bounded only by the Zod row schemas, so a path, URL or address field added later to a campaign, variant, subject, rule set or direction row would leave with no MCP code change.
- **`get_slots`** (input `project_id`, `campaign_id`): over `template.slots` (exists, `src/main/queries/template.ts`). The reply, per slot of the master variant: `{ slotId, type, state, candidates }` from `slot.id`, `slot.type`, `state` (`filled` or `empty`) and `candidates` (asset IDs).
- **New query `job.get`** for `get_job` (input `project_id`, `job_id`). Add its row to the queries table.
- **`list_jobs`** (input `project_id`, `campaign_id?`, `variant_id?`, `state?`, `limit?`; newest first) over `job.list` (exists, `src/main/queries/job.ts`).
- **`agentJobView(row, providers)`**, in its own file in `src/main/mcp/tools/`. It gives exactly:
  - `id`, `kind`, `status`, `startedBy`, `campaignId`, `variantId`, `layerId`, `slot`, `progress`, `paidCalls`, `seenAt`, `errorKind`, `errorReason`, `createdAt`, `updatedAt`;
  - `stage` and `queuePosition` from `result`, only when a string and a whole number;
  - `assetIds`: `result.assetIds` for a picture job, `[result.assetId]` for a video job, else `[]`; strings only;
  - `failures` for a picture job: error kind to count;
  - `message`: for an `errorReason`, the `reasonMessage` sentence with `{address}` replaced by "the saved ComfyUI address" and `{n}` by "some"; else for an `errorKind`, `plainMessage(kind, provider label)`; else null.
  - Left out: `provider`, `model`, `remoteJobId`, `request`, and the rest of `result`.
- **Inputs:** the command's or query's own Zod schema, with snake_case top-level keys.
- The `get_job` description says to poll no more than once every 5 seconds.

**Tests:**

- `list_projects` gives only `id` and `name`.
- The `get_slots`, `get_job` and `list_jobs` replies pass `riskyKeys` (`tests/integration/mcp/reply-keys.test.ts`) and hold no key outside their allow-lists, over a job row with every column filled, `model`, `remoteJobId`, and a `result` with a made-up missing-items list.
- `job.get` with an unknown ID gives `NOT_FOUND`.
- A failed job's `message` holds "the saved ComfyUI address" and not the stand-in's origin.

## AR-2 — Unticking, and the paid tick

- **Class:** B. **Security class** (cost). Short review.
- **Depends on:** AR-1 merged.
- **Owns:** the runner's check in `src/main/jobs/run-job.ts` (`jc.call`) and in the live job (`src/main/jobs/live.ts`); the deletion of step 2 of `agentRunsOffered` and its test row.

**Must build:**

- **The runner's check.** Just before an agent-started job's first call, `jc.call` and the live job check `agentRunsOffered` and the tick, through the one reader in `agent-run-gate.ts` (gate steps 1 and 2).
  - It runs only when `startedBy` is `agent` and no call has gone out. The live job gains `startedBy` and a "a call has gone out" mark.
  - Off: the job ends `cancelled` with no flag, the job's signal fires, and `jc.call` throws `ProviderCancelled`. Nothing is sent. `paid_calls` stays 0. Same rule for every provider, local included, however the tick became off (hand-edited `settings.json` included).
  - "Sent" means the first call to the provider has gone out. A request waiting in the provider's own queue has been sent. A job with a `remote_job_id` counts as sent. A run past its first call goes on and is waited for. The user can still cancel it by hand.
  - A waiting run stays listed `queued` until its turn, then is cancelled. If the tick is set again before that turn, it is sent.
  - If lint refuses the import from `src/main/commands/` into `src/main/jobs/`, stop and report.
- **Then delete step 2** of `agentRunsOffered`, so Gemini can be ticked. With the Gemini tick on, an agent can start up to `agentRunLimit` Gemini runs at a time, each up to 8 pictures, with no click [D-080].

**Tests** (the runner fixture with a small `jobsAtOnce`):

1. An agent job waits behind a full provider; the tick is unset; the place frees: the job ends `cancelled`, `jc.call`'s function never ran, `paid_calls` is 0, and the agent's next request is refused at the gate.
2. An agent job whose first call is out; the tick is unset: the second `jc.call` runs and the job ends `succeeded`.
3. A user's job with the tick off runs to the end.
4. The tick is unset, then set again before the job's turn: the job runs.
5. A hand-edited tick for a provider `agentRunsOffered` refuses, with an agent job already queued: the job ends `cancelled`, nothing sent.
6. Gemini (recorded responses) gives null from `agentRunsOffered` and can be ticked.
7. A Gemini agent job queued behind a full provider, then unticked, ends `cancelled` with `paid_calls` 0.

- Not written: a test "tick unset, the job still runs to its end" for a job not yet sent. Case 1 replaces it.

## AR-3 — Agent runs in Settings

- **Class:** D. Not security class. Short review.
- **Depends on:** AR-1 merged.
- **Owns:** a new component for the agent-runs block under `src/renderer/screens/settings/` (`agent-runs-section`, in its own folder if LO-1b has landed) and its place in the Settings screen, below the MCP section; the run row mark in `run-row`; the `video-panel.test.tsx` edit; the renderer fake API's two commands and `agentRunLimit`.

**Must build:**

1. One checkbox per provider for which `agentRunsOffered` gives null, labelled "Let agents start runs with {label}". It calls `agentRuns.setAllowed` and shows the command's refusal as other sections do.
2. Under a provider whose `local` is false: "Paid. Each run an agent starts is charged to your account, with no click from you." None shows until AR-2 has merged.
3. A number field "Most runs agents may have waiting or running, per provider", 1 to 16, saved by `agentRuns.setLimit` on change, with its refusal shown.
4. The block shows whether or not the MCP server is on.
5. A run row says "Started by an agent" under the kind when `startedBy` is `agent`.

- Styling comes only from the shared tokens and `layout.module.css` (D-084).
- **Approved test edit:** `tests/unit/renderer/screens/campaign/video-panel.test.tsx`, the case at lines 168-174. Replace `p.queryByText(/first frame|reference/i)` with two checks under the default start: no region named "Picture to start from", and no text "Tip: call the picture <Picture 1> in the prompt.". Rename the case "shows no server address and no picture choice under the default start". Keep the address line and the axe check. (The old line passes only by accident: the card says "A first-frame picture", hyphenated, and the fixture has no reference workflow.)
- **End-to-end reach-table row, once built:** Settings · Agent runs: one tick per provider, the limit · Yes, offline · clicks, no agent and no run needed.

## MCP-G — Start and cancel tools

- **Class:** E. **Security class.** Full review.
- **Depends on:** AR-1 and MCP-D merged.
- **Owns:** the tools `generate_images`, `generate_video`, `cancel_job`; the serial for the start tools; the tool descriptions; the tool-list snapshot (11 tools); `tests/integration/mcp/every-tool.ts` gains the new tools' arguments.

**Must build:**

- **`generate_images`:** the input of `generation.runImages` as built, with snake_case top-level keys: `project_id`, `variant_id`, `slot` or `layer_id`, `prompt`, `reference_asset_ids`, `count`, `provider`. Reply `{ jobId }` only. Policy `tick`.
- **`generate_video`:** the input of `generation.startVideo`: `project_id`, `variant_id`, `prompt`, `duration_ms`, `provider`, `start`, `use_references`, `reference_asset_ids`. Reply `{ jobId }`. Policy `tick`.
- **`cancel_job`:** `job.cancel` (`project_id`, `job_id`). Reply `{ jobId }`. Own runs only.
- **One at a time.** The two start tools run one at a time through one `createSerial()` (`src/main/mcp/serial.ts`), made once when `toolSetup` is called and shared by every session. The bus is not changed for this.
- **Replies** go through allow-list pickers. Refusals are returned as the command gives them. No picture or clip bytes are returned (OI-92). No picture is added from disk by an agent (OI-93).
- **Display names in refusals stay.** `list_assets` already gives display names. What must never appear is a folder or path on disk: `missingFile` takes asset IDs, and a file-system error inside `readPicture` is not an `AppError`, so the bus returns the fixed `INTERNAL` reply with no error text.
- **Descriptions** (MCP-G owns the final words):
  - The run makes options for the user to choose from, so leave the choice to the user unless asked. Provisional text: "A run you start makes options for the user to choose from. Leave the choice to the user unless they asked you to choose." This is wording only: an agent may pick a result, and `layer.update` and `layer.create` by an agent check neither `started_by` nor `seen_at`.
  - `provider` is `comfyui` (the user's own ComfyUI server, no charge) or `gemini` (pictures only; paid, charged to the user's Google account with no click).
  - Runs are refused unless the user allowed agents for that provider in Adman's Settings.
  - `generate_video` names the three starts, and says a picture is named by an asset ID from `list_assets`.

**Tests** (a door over the real core, the ComfyUI stand-in, dev tools on, ComfyUI ticked by the user):

- `generate_images` with a slot from `get_slots`: a `jobId`; `get_job` later shows `succeeded` and new asset IDs.
- `generate_video` from a first frame named by asset ID: the stand-in saw one upload named `uploadName(...)`; `get_job` shows the clip's asset ID.
- Tick off: `AGENT_DENIED` with the step 2 sentence, no job row, the stand-in saw nothing.
- `cancel_job` on its own running job: `cancelled`. On a user's job: refused.
- A reference asset whose linked file is gone, and one over the size limit: the replies hold the display name or ID, and not the test's root folder, the file's folder, or its file name on disk.
- Two `generate_images` together with limit 1: one `jobId` and one refusal with the limit sentence (gate step 3).
- The word test over a recorded reply of each of the 11 tools, success and refusal: none holds `comfyui` (case-sensitive), `baseUrl`, `agentRuns`, or the stand-in's origin.
- The secret-leak test passes with `every-tool.ts`'s new arguments.

**Accepted risk (linked assets).** A linked asset's path comes from the project file, so a picture start uploads whatever PNG or JPEG it points to. A project from someone else, opened by the user, with an agent ticked, could send a picture from the user's computer to a provider the user ticked. The agent gets no bytes back. Any later tool that returns bytes (OI-92) must be judged with this.

## First agent run on the user's ComfyUI server

- **When:** after AR-1, AR-3 and MCP-G merge.
- **Who:** the stakeholder, by hand. He turns the MCP server on, ticks ComfyUI (not Gemini), and pastes the Connect line into the agent's Claude Code.
- **What:** the agent makes one picture and one video from a first frame through the tools, one attempt each, dev tools on. No Gemini run here. Each run leaves on the server what `spec/comfyui.md` lists as left behind by a run.

## If OI-90 is answered "no ticks"

- Gate step 2 always passes (one line), and the Settings tick block of AR-3 is removed. Nothing else moves.

# Phase 2 leftovers, group 3: agents generate through the MCP server

This is group 3 of the Phase 2 leftovers. Groups 2, 4 and 5 are in `spec/phases/phase-02-leftovers.md`.

**Goal.** An agent connected through the MCP server can start, follow and cancel its own picture and video runs on every provider the user has allowed for agents in Settings [D-080].

**Rules these slices build.** The agent-run rules are written in full in `spec/agent-runs.md` (the gate, the tick, the limit, unticking, what stays shut), `spec/mcp-and-agents.md` and `spec/cancel.md`. Each entry below repeats every value it must meet, so a brief can quote it.

**State on `main`.** The read tools are built: `list_projects`, `get_slots`, `get_job`, `list_jobs`, the queries `project.listOpen` and `job.get`, `agentJobView`, and the pickers for `get_project` and `get_campaign` (`spec/mcp-and-agents.md`). The tool table holds 8 tools. The gate is built (`spec/agent-runs.md`): `agentRunsOffered` and the limit bounds in `src/shared/config/agent-runs.ts`, the settings key `agentRunLimit`, the user-only commands `agentRuns.setAllowed` and `agentRuns.setLimit` in `src/main/commands/agent-runs/`, the `tick` policy, `src/main/commands/agent-run-gate.ts` and its call in the bus, and `offeredWorkflow` giving a `trial` workflow to both actors with dev tools on. `agentRunsOffered` still refuses a provider whose `local` is false (`agent_runs_not_ready`). The runner has no untick check. Gate step 3's refusal still shows the run count. No screen says "Started by an agent". There is no start or cancel tool.

## Order

1. AR-2, AR-3 and MCP-G in parallel.
2. Merge order: AR-3 and MCP-G, then AR-2. With AR-3 and MCP-G merged, an agent can make ComfyUI pictures and video. AR-2 adds Gemini.
3. Then the first agent run on the user's ComfyUI server (last entry).

- **Cut line, first to last:** the run row mark in AR-3; AR-2 (agents then use ComfyUI only, and Gemini cannot be ticked). Never cut: AR-3's ticks, MCP-G.
- **Checks.** AR-2: lint, typecheck, `npm test` (class B with E). MCP-G: class E plus `npm test`. AR-3: class D. The full gate runs before a release, not per slice.
- **Paid calls and keys.** Automatic tests never make a paid call. Gemini cases use recorded responses in `tests/fixtures/providers/` or a fake provider row with `local: false`. No slice adds a live case to the suite. No agent reads a key file (D-049). Under D-085 one low-cost paid run may confirm the agent Gemini path once, after AR-2, at the smallest size.
- **What each brief names.** Only: the agent-run rules in `spec/agent-runs.md`, the agent-run limit (1 to 16, default 4, per provider), the unticking rule, the MCP tool list in `spec/mcp-and-agents.md`, and for MCP-G the reply rules for MCP tools (allow-list pickers, no path, address or secret).

## AR-2 — Unticking, and the paid tick

- **Class:** B. **Security class** (cost). Short review.
- **Depends on:** `main` (the gate is merged).
- **Owns:** the runner's check in `src/main/jobs/run-job.ts` (`jc.call`) and in the live job (`src/main/jobs/live.ts`); the deletion of step 2 of `agentRunsOffered` and its test row; the step 3 sentence in `src/main/commands/agent-run-gate.ts`.

**Must build:**

- **The runner's check.** Just before an agent-started job's first call, `jc.call` and the live job check `agentRunsOffered` and the tick, through the one reader in `agent-run-gate.ts` (gate steps 1 and 2).
  - It runs only when `startedBy` is `agent` and no call has gone out. The live job gains `startedBy` and a "a call has gone out" mark.
  - Off: the job ends `cancelled` with no flag, the job's signal fires, and `jc.call` throws `ProviderCancelled`. Nothing is sent. `paid_calls` stays 0. Same rule for every provider, local included, however the tick became off (hand-edited `settings.json` included).
  - "Sent" means the first call to the provider has gone out. A request waiting in the provider's own queue has been sent. A job with a `remote_job_id` counts as sent. A run past its first call goes on and is waited for. The user can still cancel it by hand.
  - A waiting run stays listed `queued` until its turn, then is cancelled. If the tick is set again before that turn, it is sent.
  - If lint refuses the import from `src/main/commands/` into `src/main/jobs/`, stop and report.
  - *Why it comes first.* ComfyUI is marked local in the registry, but its saved address can point at a remote or rented server. So this check, which cancels a queued agent run at its turn once the provider is no longer ticked, is what protects the user after an untick. It must be in place before any paid provider can be ticked.
- **The limit sentence.** In `src/main/commands/agent-run-gate.ts`, gate step 3's refusal becomes "Agents already have the most runs allowed with {Provider}. Wait for one to finish." (`{Provider}` is the registry `label`; no number). Approved test edit: the cases that pin the old sentence in `tests/integration/commands/agent-run-gate.test.ts` and `tests/integration/commands/agent-run-gate-together.test.ts`.
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
- **Depends on:** `main` (the gate is merged).
- **Owns:** a new component for the agent-runs block, the folder `src/renderer/screens/settings/agent-runs-section/`, and its place in the Settings screen, below the MCP section; the run row mark in `run-row`; the `video-panel.test.tsx` edit; the renderer fake API's two commands and `agentRunLimit`.

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
- **Depends on:** `main` (the gate is merged).
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
- When the licence dialog (LD-1 in `spec/phases/phase-02-leftovers.md`) is built, the gate's tests gain the `licence_not_confirmed` refusal for an agent.

**Accepted risk (linked assets).** A linked asset's path comes from the project file, so a picture start uploads whatever PNG or JPEG it points to. A project from someone else, opened by the user, with an agent ticked, could send a picture from the user's computer to a provider the user ticked. The agent gets no bytes back. Any later tool that returns bytes (OI-92) must be judged with this.

## First agent run on the user's ComfyUI server

- **When:** after AR-3 and MCP-G merge.
- **Who:** the stakeholder, by hand. He turns the MCP server on, ticks ComfyUI (not Gemini), and pastes the Connect line into the agent's Claude Code.
- **What:** the agent makes one picture and one video from a first frame through the tools, one attempt each, dev tools on. No Gemini run here. Each run leaves on the server what `spec/comfyui.md` lists as left behind by a run.

## If OI-90 is answered "no ticks"

- Gate step 2 always passes (one line), and the Settings tick block of AR-3 is removed. Nothing else moves.

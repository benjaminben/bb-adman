# Agent runs

Picture and video runs an agent starts through the MCP server: what is open and shut, the per-provider tick, the gate, the limit, unticking, and paid runs. Read with `spec/mcp-and-agents.md` (the server, the tools, the permissions and the agent policy table), `spec/cancel.md` and `spec/jobs.md`.

Built: `agentRunsOffered` and the limit bounds, the settings key `agentRunLimit`, the commands `agentRuns.setAllowed` and `agentRuns.setLimit`, the `tick` policy, the gate, the `trial` workflow rule, the runner's untick check, the paid tick, the Settings block, and the tools `generate_images`, `generate_video` and `cancel_job`. Security class. [REQ: FR-272, FR-279, FR-280, FR-281, FR-292; D-053 item 8; D-059 items 1 and 5; D-080]

The stakeholder's decision: "Agent can generate anything thru mcp door" [D-080].

## End state

An agent connected through the MCP server can start, follow and cancel its own picture and video runs on every provider the user has allowed for agents in Settings. The rule for which providers can be allowed lives only in `agentRunsOffered` (`src/shared/config/agent-runs.ts`). The tick is read only through `src/main/commands/agent-run-gate.ts`.

**Open to an agent:**

- `generation.runImages` and `generation.startVideo` (all three video starts; the picture is named by asset ID).
- Every provider the app offers for those jobs (today ComfyUI and Gemini). Gemini is paid, and an agent's run has no per-run click.
- ComfyUI `trial` workflows on the same terms as the user: only while dev tools are on. A `draft` is never sent.
- `job.cancel` of a run an agent started (all agent clients are one actor; see 'Gate steps for a run').

**Stays shut:**

- The MCP server is off until the user turns it on. The token rules of `spec/mcp-and-agents.md` stand.
- No file path, key, address or token in any reply [REQ: FR-198].
- No agent reads or changes Settings, keys, storage, the ComfyUI address, a tick or the limit. `agentRuns.setAllowed` and `agentRuns.setLimit` are `deny`. An agent learns a tick is off only from the refusal sentence.
- Nothing on the ComfyUI server is cleared. No new client call; cancel uses the own-ID rule (`spec/cancel.md`, 'ComfyUI').
- Still `deny` for an agent: `job.retry`, `job.markSeen`, `job.getServerMessage`, `comfy.getInfo`, `comfy.check`, `asset.import`, `export.run`, `publish.run`.
- No picture or clip bytes are returned to an agent (OI-92). No picture is added from disk by an agent (OI-93).

## `trial` workflows, same rule for both actors

`offeredWorkflow` (`src/main/providers/comfyui/workflows/offered.ts`): a `proven` workflow first, for anyone; else a `trial` one when `who.devTools` is true, whoever asks; else null (`comfy_job_not_offered`). A `draft` is never returned. The parameter keeps its shape. A packaged app never has dev tools, so an agent there gets nothing on ComfyUI until a workflow is `proven`.

## The tick

- `settings.agentRuns` is a map from provider ID to `{ allowed: boolean }`, default empty (every tick off) [REQ: FR-279, FR-280]. The user ticks "ComfyUI" and, separately, "Google Gemini" in Settings before an agent can start a run there.
- The loader keeps `agentRuns` as the file has it. The rule "which provider may have a tick" is held where a tick is used, not only where it is written: a loader that drops entries would have to know the registry, and the next save would wipe them.
- OI-90 is open: whether D-080's "anything" keeps the per-provider tick. The build keeps it, off by default. If the answer is "no ticks", gate step 2 always passes (one line) and the Settings block is removed. Nothing else moves.

**`agentRunsOffered(info: ProviderInfo): null | 'agent_runs_not_offered'`**, in `src/shared/config/agent-runs.ts` (shared, so Settings shows the list the gate checks). `available` false, or `jobs` holds neither `image` nor `video`: `agent_runs_not_offered` (covers `fal-seedance` until slice J, Firefly, storage providers). Otherwise null. So Gemini can be ticked.

- It is the only "tick offered" function. Three callers and no other copy: the gate (step 1), `agentRuns.setAllowed`, and the runner's untick check (through the one reader). A `settings.json` entry for a provider it refuses is never read as a set tick, however it got there (a hand-edited file included).
- **One reader.** `agentRunAllowed` in `agent-run-gate.ts` is the only code in `src/main/` that reads `settings.agentRuns`: true when `agentRunsOffered` gives null for the provider's row and the entry's `allowed` is `true`. An entry for an ID the registry does not have is never read.
- *Why this matters.* Whoever can edit `settings.json` works as the user's own account and can do much else. The rule still holds at the point of use, because it costs one function and a paid tick must never be set without the user.
- **fal.ai Seedance.** Once slice J sets `available: true`, step 1 no longer refuses it. Slice J offers its tick only once fal's cancel is proven (U-25).

## Commands for the tick and the limit

- **`agentRuns.setAllowed { provider, allowed }`**: app scope, not undoable, returns `{ provider, allowed }`, sets `changesAppState`, agent policy `deny`, not in the `settings.update` schema. Unknown provider: `INVALID_INPUT`. A provider `agentRunsOffered` refuses: `RULE_VIOLATION`, `details.reason` = the value it gave, message = the gate's step 1 sentence. `allowed: false` is always accepted.
- **`agentRunLimit`**: settings key, whole number 1 to 16, default 4 (`AGENT_MAX_ACTIVE_RUNS`), both bounds in `src/shared/config/agent-runs.ts`, per provider. Not in the `settings.update` schema, which refuses it. A loaded value that is not a whole number in range (for example 99) loads as 4. An agent can neither read nor change it.
- **`agentRuns.setLimit { limit }`**: the one writer. App scope, not undoable, returns `{ limit }`, sets `changesAppState`, agent policy `deny`.
- The settings shape can take more fields per provider later with no migration.

## Policy and bus

- Bus order: deny check, find handler and validate, find project, **gate**, ask, run.
- The gate runs only for actor `agent` with policy `tick` (`agentPolicyFor` returns `tick`): `agentRunGate(gateDeps, name, parsed.input)` in `src/main/commands/agent-run-gate.ts`. It runs before `prepare`, so a refused agent causes no file read and no provider call. Its refusals are `AGENT_DENIED` with a plain sentence; nothing is enqueued or sent.
- On a pass the gate returns a release function. The bus calls it in a `finally` once the command has ended, whatever the outcome.
- The gate knows three commands: `generation.runImages`, `generation.startVideo`, `job.cancel`. Any other `tick` command is refused with `AGENT_DENIED` and `denialMessage(name)`, so `generation.runFill` and the raw-tick case of `bus-fail-closed.test.ts` stay refused. Built (Phase 4, P4-1): `generation.proposeLayout`, `generation.copyOptions` and `generation.cutOut` join the run commands, with the same three steps (`spec/ai-jobs.md`).

## Gate steps for a run

`{Provider}` is the registry `label`. Each refusal is `AGENT_DENIED` with the sentence given.

1. The registry row for `input.provider` exists and `agentRunsOffered` gives null. Else "Agents cannot start runs with {Provider}." For an unknown ID: "Agents cannot start runs with that provider." `provider` is required for an agent, so the user's default is never used.
2. The tick is on, read at that moment through the one reader. Else "The user has not allowed agents to start runs with {Provider}. They can allow it in Adman's Settings."
3. Agent runs for that provider are fewer than `settings.agentRunLimit`. The count is jobs with `started_by = 'agent'`, status `queued` or `running`, and that provider, over every open project (one SQL count per project from the registry's `all()`), plus agent runs for that provider that have passed the gate and have no job row yet. Else "Agents already have the most runs allowed with {Provider}. Wait for one to finish." (`agentRunLimitMessage(label)`, exported from `agent-run-gate.ts`). The sentence holds no number, so an agent learns neither the limit nor how many runs other projects hold. Two agent calls sent together with limit 1 give one job and one refusal.

- No `workflowId` step: neither input schema has the field, and the parse drops unknown keys. An agent never names a server, a workflow, a node or a model file.
- A user's runs are never counted or held back by the agent limit. The runner's own limit (`JOBS_AT_ONCE_PER_PROVIDER`, 4 per provider, anyone; `spec/jobs.md`) is separate.

**`job.cancel` for an agent:** the job is found in the project (else `NOT_FOUND`); its `started_by` must be `agent`, else "Agents can cancel only runs they started." No tick needed. All agent clients are one actor: the job row records only `started_by = 'agent'`, not which MCP client started it, and every client shares one token. So "its own run" means any run an agent started, in any open project, and never a run the user started. Then `cancelRefusal` applies as for the user (`spec/cancel.md`): on a provider whose `cancel` is `none` (Gemini), a running picture job is accepted (no further call is sent, the pictures already made are kept), and any other running background job is refused with `cancel_not_supported`.

## After the gate

- The command runs as for the user: same checks and job kind, the run enqueued with `startedBy: 'agent'`, `seenAt` null, the count limit of 8 pictures, the reference rule, the picture checks. One variant, in an open project.
- **No dialog** [REQ: FR-280].
- **Refusals reach the agent in the app's own words**, as the command gives them. The full set from `generate_images`, `generate_video` and `cancel_job`:

  | From | Code | Details, reason |
  |------|------|-----------------|
  | Bus | `INVALID_INPUT` | `issues` |
  | Bus | `NOT_FOUND` | `projectId`, reason `project_not_open` |
  | Bus | `INTERNAL` | `commandId` |
  | Gate | `AGENT_DENIED` | none |
  | Command | `INVALID_INPUT` | `provider` ("That provider cannot make pictures." / "videos."), or none (not a picture layer, not a picture slot, "Choose one picture for this video.") |
  | Gate or command | `NOT_FOUND` | none (variant, layer or asset not found), or `jobId` ("That job is not in this project.") |
  | Command | `NEEDS_KEY` | `provider` |
  | Command | `MISSING_FILE` | `assetIds` |
  | Command | `RULE_VIOLATION` | reason `comfy_address_needed`, `comfy_job_not_offered`, `too_many_references` (`max`), `video_too_long` (`maxMs`), `picture_not_usable`, `asset_not_a_picture`, `asset_too_large`, `job_wrong_state`, `cancel_not_supported`, `licence_not_confirmed` (`workflow`) |

  - None holds a file path, a folder name, a key, the saved server address or raw server text. The messages of `asset_not_a_picture` and `asset_too_large` hold the asset's display name, for both actors.
  - Accepted: `NEEDS_KEY` tells an agent that the user has no key saved for a ticked paid provider.
  - A ComfyUI run of a workflow whose model needs a commercial licence is refused with `licence_not_confirmed` (`details.workflow`) until the user has saved that model in Settings; an agent's `licenceConfirmed` flag is ignored (`spec/comfyui-workflows.md`).
- **Marked and waiting.** `JobRow.startedBy` is on the wire, so the activity panel and the run row can say "Started by an agent". The activity log line carries the actor. The result has `seen_at` null and waits for the user. An agent cannot mark it seen.
- **An agent may pick a result** [D-059 item 5]. `layer.update` and `layer.create` by an agent make no check of `started_by` or `seen_at`. The tool descriptions ask it not to; no command refuses the pick. The test "a run started as the agent has `started_by = 'agent'` and `seen_at` null" stays.
- **`jc.system` sends as the user.** A job's `jc.system` commands are sent as actor `user`, whoever started the job. The only command a job sends this way is `asset.addGenerated` (from the picture and the video job kinds, and the cut-out kind from Phase 4; the Phase 4 layout, copy and brief kinds send none). It is `internal` and `deny` for agents. Its input is built by app code: the job's own project, an asset ID the app makes, a fixed `png` or `mp4` extension, and the model name from the provider's result (for ComfyUI, the shipped workflow). The agent controls only what it already chose within its allowed run: the prompt text and the provider recorded on the asset. A new `jc.system` command is ruled on by itself before it is added.

## Unticking

[D-059 item 1]

- Unticking refuses new requests at once: gate step 2 reads the setting on every call.
- **The runner's check.** Before an agent-started job's first call, and before every call of an agent's `image_generation` job, `jc.call` (`src/main/jobs/run-job.ts`) checks the provider through the one reader, `agentRunAllowed` (gate steps 1 and 2 again). The live job (`src/main/jobs/live.ts`) has `startedBy` and `sent`.
- **Unticked after a picture job's first send.** The runner sets `cancelAsked`, the call is not sent (`ProviderCancelled`), the calls in flight finish and stay counted, and the job ends `cancelled` with the pictures that arrived (`spec/cancel.md`, "Pictures"). Every provider, `cancel: 'none'` included.
- **`sent`** starts true when the row already has a `remote_job_id`. It is set by the first call that passes the check, and by `jc.setRemoteJobId`. A request waiting in a provider's own queue has been sent (OI-62 is open: whether the stakeholder agrees; the build says yes).
- **Cancelled at its turn** when all three hold: started by an agent, not yet sent, and the provider is not allowed (not in the registry, refused by `agentRunsOffered`, or not ticked). Then the job ends `cancelled` with no flag, its signal fires, `jc.call` throws `ProviderCancelled`, the call's function never runs and `paid_calls` is not raised. Same rule for every provider, local included, however the tick became off (a hand-edited `settings.json` included).
- The row stays `queued` while it waits, is marked `running` at its turn, then ends `cancelled`. A tick set again before the turn lets it run.
- A user's job is never checked. Any other kind past its first call goes on and is waited for; the user can cancel it by hand.
- Tests: `tests/integration/jobs/runner-untick.test.ts`, `tests/integration/generation/image-kind-no-cancel.test.ts`.

## Paid runs and spending

- With the Gemini tick on, an agent can start up to `agentRunLimit` Gemini runs at a time, each up to 8 pictures, with no click. The limit bounds the rate, not the total. The app has no spending ceiling and none is planned: the cap is set on the provider's own account [D-093]. The only other record is `started_by`.
- A paid run charged either way is left to finish (`cancel_would_still_charge`, `spec/cancel.md`, 'fal.ai Seedance'; not built, slice J).
- **Linked assets (U-2).** A linked asset's path comes from the project file, so a picture start uploads whatever PNG or JPEG it points to. Accepted: a project from someone else, opened by the user, with an agent ticked, could send a picture from the user's computer to a provider the user ticked. The agent gets no bytes back. Any tool that returns bytes (OI-92) must be judged with this.

## Settings block "Agent runs"

Built. `src/renderer/screens/settings/agent-runs-section/`, below "Agent access" in `settings-screen/`. Its items and words are in `spec/screens.md`, 'Agent runs': the heading, one tick per offered provider, the paid line under a provider whose `local` is false, the limit field (1 to 16), and "Started by an agent" on a run row. End-to-end case: `tests/e2e/screen-tour.spec.ts`, "Settings · Agent runs: one tick per provider, the limit".

The UI pass decides whether the job list should say more about a queued agent run that will be cancelled at its turn.

## What an agent can never do or see

| Never | How it is held |
|-------|----------------|
| Read, set or change the ComfyUI address | No tool returns settings; `comfy.setAddress`, `comfy.check` are deny and `comfy.getInfo` is user only; no error, job row, job view or event holds it |
| Read, set or change a tick or the limit | `agentRuns.setAllowed` and `agentRuns.setLimit` are deny; no tool returns settings. An agent learns a tick is off only from the refusal sentence. |
| Name a server, a workflow, a node or a model file | The command inputs have no such field; unknown keys are dropped |
| Read the server's own words | `job.getServerMessage` is user only; `error_detail` is not on the wire; the job view gives the app's own sentence |
| Mark a result seen; retry | `job.markSeen` and `job.retry` are deny |
| Get a file path, a key or the token | Allow-list pickers on every reply |

## Tests that must exist

- **The word test** (`tests/integration/mcp/reply-words.test.ts`). It lists every MCP tool's output schema (the tools register none) and a recorded reply of each of the 11 tools, success and refusal, and fails if any holds the words `comfyui` (case-sensitive), `baseUrl` or `agentRuns`, or the stand-in's address.
- `agentRunsOffered`: Gemini, ComfyUI and the fake provider give null; `fal-seedance`, S3 and Firefly give `agent_runs_not_offered`.
- Each gate step's refusal sent as the agent through the bus: no job row, nothing sent. A ticked ComfyUI run as the agent is accepted with `startedBy: 'agent'` and `seenAt` null; with tools off and ticked, `comfy_job_not_offered`.
- A hand-edited `settings.json` `{ "fal-seedance": { "allowed": true }, "gemini": { "allowed": true } }` loads with both kept and its other keys as written; each is refused at step 1; an agent job already queued for such a provider ends `cancelled` with nothing sent.
- Limit 2: two agent jobs held `queued`, the third refused with the step 3 sentence, which holds no number; a user's queued job and another provider are not counted. Two agent calls sent together with limit 1: one job, one refusal with the limit sentence (`tests/integration/commands/agent-run-gate-together.test.ts`, and through the tools in `tests/integration/mcp/run-tools.test.ts`).
- Untick, then the next agent call is refused at step 2.
- The agent's `job.cancel`: its own queued job is cancelled, its own running job ends `cancelled`; a user's job is refused "Agents can cancel only runs they started."
- `tests/integration/generation/image-kind-no-cancel.test.ts` (FIX-E), on a provider whose `cancel` is `none`: a running picture job of 8 cancelled by the user or by the agent after 2 calls ends `cancelled` with 2 pictures, 2 paid calls and no further call; an agent's picture job unticked after 3 calls ends the same way with 3; with the cancel wait run out the job waits for the calls in flight and has no `outcomeUnknown`; a running video job is still refused with `cancel_not_supported`.
- `agentRuns.setAllowed` and `agentRuns.setLimit` as the agent: `AGENT_DENIED`. `setLimit(0)` and `setLimit(17)` as the user: `INVALID_INPUT`. `"agentRunLimit": 99` loads as 4. `settings.update` refuses `agentRunLimit`.
- The untick check (`tests/integration/jobs/runner-untick.test.ts`, runner fixture, small `jobsAtOnce`): an agent job waits behind a full provider, the tick is unset, the place frees: it ends `cancelled`, `jc.call`'s function never ran, `paid_calls` 0, and the agent's next request is refused at the gate. An agent video job whose first call is out, tick unset: its second `jc.call` runs and it ends `succeeded`. A user's job with the tick off runs to the end. Tick unset then set again before the turn: the job runs. A Gemini agent job (recorded responses) queued behind a full provider, then unticked, ends `cancelled` with `paid_calls` 0.
- Through the tools (`tests/integration/mcp/run-tools.test.ts`, `run-tools-refusals.test.ts`, `tests/unit/main/mcp/tools/run-tools.test.ts`; a door over the real core, the ComfyUI stand-in, dev tools on, ComfyUI ticked by the user): `generate_images` with a slot from `get_slots` gives a `jobId`, and `get_job` later shows `succeeded` and new asset IDs; `generate_video` from a first frame by asset ID makes the stand-in see one upload named `uploadName(...)`, and `get_job` shows the clip's asset ID; with the tick off, `AGENT_DENIED` with the step 2 sentence, no job row, and the stand-in saw nothing; a reference asset whose linked file is gone, and one over the size limit, give replies that hold the display name or ID and not the test's root folder, the file's folder or its file name on disk.
- The secret-leak test passes with the new tools' arguments in `tests/integration/mcp/every-tool.ts`.

## Open items

- OI-62: whether a request waiting in a provider's queue counts as sent.
- OI-90: whether the per-provider tick stays.
- OI-92: whether a tool may return picture bytes to an agent (judged with 'Linked assets').

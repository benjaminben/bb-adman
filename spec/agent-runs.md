# Agent runs

Picture and video runs an agent starts through the MCP server: what is open and shut, the per-provider tick, the gate, the limit, unticking, and paid runs. Read with `spec/mcp-and-agents.md` (the server, the tools, the permissions and the agent policy table), `spec/cancel.md` and `spec/jobs.md`. Old section 6.11.3 onward.

Not built (Phase 2, agent-run slices). Security class. [REQ: FR-272, FR-279, FR-280, FR-281, FR-292; D-053 item 8; D-059 items 1 and 5; D-080]

The stakeholder's decision: "Agent can generate anything thru mcp door" [D-080]. These rules hold whether or not built.

## End state

An agent connected through the MCP server can start, follow and cancel its own picture and video runs on every provider the user has allowed for agents in Settings. The rule for which providers can be allowed lives only in `agentRunsOffered` (`src/shared/config/agent-runs.ts`). The tick is read only through `src/main/commands/agent-run-gate.ts`.

**Open to an agent:**

- `generation.runImages` and `generation.startVideo` (all three video starts; the picture is named by asset ID).
- Every provider the app offers for those jobs (today ComfyUI and Gemini). Gemini is paid, and an agent's run has no per-run click.
- ComfyUI `trial` workflows on the same terms as the user: only while dev tools are on. A `draft` is never sent.
- `job.cancel` of a run the agent started.

**Stays shut:**

- The MCP server is off until the user turns it on. The token rules of `spec/mcp-and-agents.md` stand.
- No file path, key, address or token in any reply [REQ: FR-198].
- No agent reads or changes Settings, keys, storage, the ComfyUI address, a tick or the limit. `agentRuns.setAllowed` and `agentRuns.setLimit` are `deny`. An agent learns a tick is off only from the refusal sentence.
- Nothing on the ComfyUI server is cleared. No new client call; cancel uses the own-ID rule (`spec/cancel.md`, 'ComfyUI').
- Still `deny` for an agent: `job.retry`, `job.markSeen`, `job.getServerMessage`, `comfy.getInfo`, `comfy.check`, `asset.import`, `export.run`, `publish.run`.
- No picture or clip bytes are returned to an agent (OI-92). No picture is added from disk by an agent (OI-93).

## `trial` workflows, same rule for both actors

`offeredWorkflow` (`src/main/providers/comfyui/workflows/offered.ts`): a `proven` workflow first, for anyone; else a `trial` one when `who.devTools` is true, whoever asks; else null (`comfy_job_not_offered`). A `draft` is never returned. The parameter keeps its shape. A packaged app never has dev tools, so an agent there gets nothing on ComfyUI until a workflow is `proven`. Today's code refuses a `trial` workflow to any actor but the user; that line goes, and the comments in `offered.ts`, `comfy-checks.ts` and `comfy-video-checks.ts` that say "an agent never gets one" are corrected.

## The tick

- `settings.agentRuns` is a map from provider ID to `{ allowed: boolean }`, default empty (every tick off) [REQ: FR-279, FR-280]. The user ticks "ComfyUI" and, separately, "Google Gemini" in Settings before an agent can start a run there.
- The loader keeps `agentRuns` as the file has it. The rule "which provider may have a tick" is held where a tick is used, not only where it is written: a loader that drops entries would have to know the registry, and the next save would wipe them.
- OI-90 is open: whether D-080's "anything" keeps the per-provider tick. The build keeps it, off by default. If the answer is "no ticks", gate step 2 always passes (one line) and the Settings block is removed. Nothing else moves.

**`agentRunsOffered(info: ProviderInfo): null | 'agent_runs_not_offered' | 'agent_runs_not_ready'`**, in `src/shared/config/agent-runs.ts` (shared, so Settings shows the list the gate checks). In order:

1. `available` false, or `jobs` holds neither `image` nor `video`: `agent_runs_not_offered` (covers `fal-seedance` until slice J, Firefly, storage providers).
2. `local` false: `agent_runs_not_ready`. This step exists only until the untick check below is built; then it is deleted and Gemini can be ticked.
3. Otherwise null.

- It is the only "tick offered" function. Three callers and no other copy: the gate (step 1), `agentRuns.setAllowed`, and the runner's untick check. A `settings.json` entry for a provider it refuses is never read as a set tick, however it got there (a hand-edited file included).
- **One reader.** `agent-run-gate.ts` exports the only code in `src/main/` that reads `settings.agentRuns`: true when `agentRunsOffered` gives null for the provider's row and the entry's `allowed` is `true`. An entry for an ID the registry does not have is never read.
- *Why this matters.* Whoever can edit `settings.json` works as the user's own account and can do much else. The rule still holds at the point of use, because it costs one function and a paid tick must never be set without the user.
- **fal.ai Seedance.** Once slice J sets `available: true`, step 1 no longer refuses it. Slice J offers its tick only once fal's cancel is proven (U-25).

## Commands for the tick and the limit

- **`agentRuns.setAllowed { provider, allowed }`**: app scope, not undoable, returns `{ provider, allowed }`, sets `changesAppState`, agent policy `deny`, not in the `settings.update` schema. Unknown provider: `INVALID_INPUT`. A provider `agentRunsOffered` refuses: `RULE_VIOLATION`, `details.reason` = the value it gave, message = the gate's step 1 sentence. `allowed: false` is always accepted. (The policy row exists; the handler does not.)
- **`agentRunLimit`**: settings key, whole number 1 to 16, default 4 (`AGENT_MAX_ACTIVE_RUNS`), both bounds in `src/shared/config/agent-runs.ts`, per provider. Not in the `settings.update` schema, which refuses it. A loaded value that is not a whole number in range (for example 99) loads as 4. An agent can neither read nor change it.
- **`agentRuns.setLimit { limit }`**: the one writer. App scope, not undoable, returns `{ limit }`, sets `changesAppState`, agent policy `deny`.
- The settings shape can take more fields per provider later with no migration.

## Policy and bus

- Bus order: deny check, find handler and validate, find project, **gate**, ask, run.
- The gate runs only for actor `agent` with policy `tick`: `await agentRunGate(gateDeps, name, parsed.input)` in `src/main/commands/agent-run-gate.ts`. It runs before `prepare`, so a refused agent causes no file read and no provider call. Its refusals are `AGENT_DENIED` with a plain sentence; nothing is enqueued or sent.
- The gate knows three commands: `generation.runImages`, `generation.startVideo`, `job.cancel`. Any other `tick` command is refused with `AGENT_DENIED` and `denialMessage(name)`, so `generation.runFill` and the raw-tick case of `bus-fail-closed.test.ts` stay refused.

## Gate steps for a run

`{Provider}` is the registry `label`. Each refusal is `AGENT_DENIED` with the sentence given.

1. The registry row for `input.provider` exists and `agentRunsOffered` gives null. Else "Agents cannot start runs with {Provider}." For an unknown ID: "Agents cannot start runs with that provider." `provider` is required for an agent, so the user's default is never used.
2. The tick is on, read at that moment through the one reader. Else "The user has not allowed agents to start runs with {Provider}. They can allow it in Adman's Settings."
3. Jobs with `started_by = 'agent'`, status `queued` or `running`, and that provider, counted over every open project (one SQL count per open project), are fewer than `settings.agentRunLimit`. Else "Agents already have {n} runs waiting or running with {Provider}. That is the limit set in Adman's Settings."

- No `workflowId` step: neither input schema has the field, and the parse drops unknown keys. An agent never names a server, a workflow, a node or a model file.
- A user's runs are never counted or held back by the agent limit. The runner's own limit (`JOBS_AT_ONCE_PER_PROVIDER`, 4 per provider, anyone; `spec/jobs.md`) is separate.
- Open projects are listed through `ProjectRegistry.openHandles()` if no read-only way to list open handles exists.

**`job.cancel` for an agent:** the job is found in the project (else `NOT_FOUND`); its `started_by` must be `agent`, else "Agents can cancel only runs they started." No tick needed. Then `cancelRefusal` applies as for the user (a running Gemini job, `cancel: 'none'`, is refused with `cancel_not_supported`; `spec/cancel.md`).

## After the gate

- The command runs as for the user: same checks and job kind, the run enqueued with `startedBy: 'agent'`, `seenAt` null, the count limit of 8 pictures, the reference rule, the picture checks. One variant, in an open project.
- **No dialog** [REQ: FR-280].
- **Refusals reach the agent in the app's own words** (`comfy_job_not_offered`, `video_too_long` with `maxMs`, `too_many_references`, `picture_not_usable`, `NEEDS_KEY`, …), as the command gives them. None holds an address, path or key. Display names in `assets.read` refusals stay, for both actors; `missingFile` takes asset IDs.
- **Marked and waiting.** `JobRow.startedBy` is on the wire, so the activity panel and the run row can say "Started by an agent". The activity log line carries the actor. The result has `seen_at` null and waits for the user. An agent cannot mark it seen.
- **An agent may pick a result** [D-059 item 5]. `layer.update` and `layer.create` by an agent make no check of `started_by` or `seen_at`. The tool descriptions ask it not to; no command refuses the pick. The test "a run started as the agent has `started_by = 'agent'` and `seen_at` null" stays.
- Review R-03 is open: whether `jc.system` sends as the user for a job an agent started.

## Unticking

[D-059 item 1]

- Unticking refuses new requests at once: gate step 2 reads the setting on every call.
- **The runner's check before the first send.** Just before an agent-started job's first call, in `jc.call` (`src/main/jobs/run-job.ts`) and the live job (`src/main/jobs/live.ts`), the one reader checks `agentRunsOffered` and the tick (gate steps 1 and 2 again). Only when `startedBy` is `agent` and no call has gone out; the live job gains `startedBy` and a "a call has gone out" mark. Off: the job ends `cancelled` with no flag, the job's signal fires, `ProviderCancelled` is thrown, nothing is sent and `paid_calls` stays 0. Same rule for every provider, local included, and however the tick became off (a hand-edited `settings.json` included). If lint refuses the import from `src/main/commands/` into `src/main/jobs/`, the developer stops and reports.
- **"Sent"**: a run is sent once its first call to the provider has gone out. After that its later calls are made and it is waited for. A request waiting in a provider's own queue has been sent. A job with a `remote_job_id` counts as sent. The user can cancel any of these by hand. (OI-62 is open: whether the stakeholder counts a request in a provider's queue as sent; the build says yes.)
- A waiting run stays listed `queued` until its turn, then is cancelled. If the tick is set again before that turn, it is sent.
- A run past its first call goes on.

## Paid runs and spending

- With the Gemini tick on, an agent can start up to `agentRunLimit` Gemini runs at a time, each up to 8 pictures, with no click. The limit bounds the rate, not the total. There is no spending cap; the only other record is `started_by`. OI-91 is open: whether to add a spending guard.
- A paid run charged either way is left to finish (`cancel_would_still_charge`, `spec/cancel.md`, 'fal.ai Seedance').
- **Linked assets (U-2).** A linked asset's path comes from the project file, so a picture start uploads whatever PNG or JPEG it points to. Accepted: a project from someone else, opened by the user, with an agent ticked, could send a picture from the user's computer to a provider the user ticked. The agent gets no bytes back. Any tool that returns bytes (OI-92) must be judged with this.

## Settings block "Agent runs"

Not built (Phase 2). New `src/renderer/screens/settings/agent-runs-section.tsx`, placed below the MCP section in `settings-screen.tsx`.

1. One checkbox per provider for which `agentRunsOffered` gives null, labelled "Let agents start runs with {label}", calling `agentRuns.setAllowed`, showing the command's refusal as other sections do.
2. Under a provider whose `local` is false: "Paid. Each run an agent starts is charged to your account, with no click from you." (None shows until Gemini can be ticked.)
3. Number field "Most runs agents may have waiting or running, per provider", 1 to 16, saved by `agentRuns.setLimit` on change, refusal shown.
4. The block shows whether or not the MCP server is on.
5. The run row says "Started by an agent" under the kind when `startedBy` is `agent` (`run-row.tsx`).

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

- **The word test.** One test lists every MCP tool's output schema and a recorded reply of each, success and refusal, and fails if any holds the words `comfyui` (case-sensitive), `baseUrl` or `agentRuns`, or the stand-in's address.
- `agentRunsOffered`: Gemini as registered gives `agent_runs_not_ready` (until the untick check lands, then null); ComfyUI and the fake provider give null; `fal-seedance`, S3 and Firefly give `agent_runs_not_offered`.
- Each gate step's refusal sent as the agent through the bus: no job row, nothing sent. A ticked ComfyUI run as the agent is accepted with `startedBy: 'agent'` and `seenAt` null; with tools off and ticked, `comfy_job_not_offered`.
- A hand-edited `settings.json` `{ "fal-seedance": { "allowed": true }, "gemini": { "allowed": true } }` loads with both kept and its other keys as written; each is refused at step 1; an agent job already queued for such a provider ends `cancelled` with nothing sent.
- Limit 2: two agent jobs held `queued`, the third refused "Agents already have 2 runs…"; a user's queued job and another provider are not counted. Two `generate_images` calls together with limit 1: one `jobId`, one refusal with the limit sentence.
- Untick, then the next agent call is refused at step 2.
- The agent's `job.cancel`: its own queued job is cancelled, its own running job ends `cancelled`; a user's job is refused "Agents can cancel only runs they started."
- `agentRuns.setAllowed` and `agentRuns.setLimit` as the agent: `AGENT_DENIED`. `setLimit(0)` and `setLimit(17)` as the user: `INVALID_INPUT`. `"agentRunLimit": 99` loads as 4. `settings.update` refuses `agentRunLimit`.
- The untick check (runner fixture, small `jobsAtOnce`): an agent job waits behind a full provider, the tick is unset, the place frees: it ends `cancelled`, `jc.call`'s function never ran, `paid_calls` 0, and the agent's next request is refused at the gate. An agent job whose first call is out, tick unset: its second `jc.call` runs and it ends `succeeded`. A user's job with the tick off runs to the end. Tick unset then set again before the turn: the job runs. A Gemini agent job (recorded responses) queued behind a full provider, then unticked, ends `cancelled` with `paid_calls` 0.
- Through the tools (a door over the real core, the ComfyUI stand-in, dev tools on, ComfyUI ticked by the user): `generate_images` with a slot from `get_slots` gives a `jobId`, and `get_job` later shows `succeeded` and new asset IDs; `generate_video` from a first frame by asset ID makes the stand-in see one upload named `uploadName(...)`, and `get_job` shows the clip's asset ID; with the tick off, `AGENT_DENIED` with the step 2 sentence, no job row, and the stand-in saw nothing; a reference asset whose linked file is gone, and one over the size limit, give replies that hold the display name or ID and not the test's root folder, the file's folder or its file name on disk.
- `list_projects` gives only `id` and `name`. `get_slots`, `get_job` and `list_jobs` replies pass `riskyKeys` and hold no key outside their allow-lists, over a job row with every column filled, `model`, `remoteJobId` and a `result` with a made-up missing list. `job.get` with an unknown ID gives `NOT_FOUND`. A failed job's `message` holds "the saved ComfyUI address" and not the stand-in's origin.
- The secret-leak test passes with the new tools' arguments in `tests/integration/mcp/every-tool.ts`.

## Open items

- OI-62: whether a request waiting in a provider's queue counts as sent.
- OI-90: whether the per-provider tick stays.
- OI-91: a spending guard on paid agent runs.
- OI-92: whether a tool may return picture bytes to an agent (judged with 'Linked assets').
- R-03: whether `jc.system` sends as the user for a job an agent started.

# Cancel

What cancel does for each provider (Gemini, ComfyUI, fal.ai Seedance, the fake provider), the provider contract it rests on, what a project close does to running jobs, and what happens to a left-over run. Read with `spec/jobs.md` (the job record and the runner), `spec/providers.md` (the registry) and `spec/comfyui.md` ('The own-ID set, and who may remove or interrupt'). Cancel by an agent is in `spec/agent-runs.md`, 'Gate steps for a run'.

[REQ: FR-257, FR-270, FR-272, FR-281; D-051 answers 5, 10, 14; D-052 answer 20]

## Provider contract

Built. `src/main/providers/types.ts`, `src/shared/schemas/queries/app.ts`, `src/main/providers/registry.ts`.

```ts
// src/main/providers/types.ts
type RunProgress = { stage: 'waiting' | 'working'; queuePosition?: number; fraction?: number }
type RunOptions = { signal?: AbortSignal; onProgress?: (p: RunProgress) => void }
type CancelOutcome = 'stopped' | 'finished' | 'unknown'
class ProviderCancelled extends Error {}   // thrown by generate or extend: the signal fired and the provider stopped or never started the work
// The constructor has the default message 'The run was cancelled.' and sets `name` to 'ProviderCancelled'.
// Callers tell it apart with `instanceof`, never by `name` or by the message.

interface ImageProvider {
  generate(input: { … }, opts?: RunOptions): Promise<ImageResult[]>
  extend(input: { … }, opts?: RunOptions): Promise<ImageResult>
}
interface VideoProvider {
  // The size the run is made at; a first frame is fitted to it before start.
  // A provider without it makes the run at the variant's own size.
  runSize?(width: number, height: number, videoStart: VideoStart): { width: number; height: number }
  // A signal that fires before submission stops start with ProviderCancelled, with no more pictures uploaded.
  start(
    input: { image: ImageFile | null; references: ImageFile[]; prompt: string; durationMs: number; width: number; height: number },
    opts?: Pick<RunOptions, 'signal'>,
  ): Promise<{ remoteJobId: string }>
  check(remoteJobId: string): Promise<{ status: 'waiting' | 'running' | 'succeeded' | 'failed' | 'cancelled'; queuePosition?: number; progress?: number; error?: ProviderError }>
  fetchResult(remoteJobId: string): Promise<VideoResult>     // the caller never fetches an address a provider returned
  cancel(remoteJobId: string): Promise<CancelOutcome>
}
type VideoResult = { bytes: Uint8Array; mime: 'video/mp4'; model: string }
type VideoStart = { firstFrame: boolean; references: boolean }

// src/shared/schemas/queries/app.ts
type ProviderError = { kind: …; reason?: ProviderErrorReason; detail: string; missing?: Array<{ what: 'model' | 'node' | 'version' | 'add_on'; name: string; folder?: string }> }
type ProviderInfo = { …; local: boolean; cancel: 'stops' | 'may_finish' | 'none'; serverText: boolean }
```

- `PROVIDER_ERROR_REASONS` is one list beside `PROVIDER_ERROR_KINDS` (`src/shared/schemas/queries/app.ts`). The reasons are listed in `spec/comfyui.md`, 'Failures, and the server's own words'.
- `image: null` and `references` on `VideoProvider.start` are what FR-286 needs. Whether fal video offers the same choices is CQ-29; the shape allows both answers.
- `JobRunContext` has `signal: AbortSignal`; `EnqueueRequest` has `startedBy: 'user' | 'agent'`, required, with no default.

| Provider | `local` | `cancel` | Basis |
|----------|---------|----------|-------|
| `comfyui` | true | `stops` | A run is stopped by its ID (`spec/comfyui.md`, 'The own-ID set, and who may remove or interrupt') |
| `fal-seedance` | false | `may_finish` | A waiting request is removed; a running one "may still complete" (analyst V-34). U-25 is open: whether fal charges for a started request that is cancelled (treated as charged). |
| `gemini` | false | `none` | No documented way to cancel a started picture request (analyst V-35). L-4 is open: whether a way exists. |
| `fake` | true | `stops` | Can be told to finish anyway, or to not confirm, for tests |
| `firefly`, storage and verification providers | false | `none` | Not generation runs |

**Migration `0002`** (`src/main/db/migrations/0002_job_started_by_and_error_reason.sql`, two added columns, no rebuild), in drizzle-kit's spelling with the CHECK named `job_started_by`:

```sql
ALTER TABLE job ADD COLUMN started_by   TEXT NOT NULL DEFAULT 'user' CHECK (started_by IN ('user','agent'));
ALTER TABLE job ADD COLUMN error_reason TEXT;      -- one of PROVIDER_ERROR_REASONS, checked by the row schema
```

Wire fields `startedBy` and `errorReason` on `JobRow`. A failed job's missing items go into `job.result` as `{ missing: […] }`.

### `available` is a build fact

- `available` means this build has a working adapter for the provider. It is a constant in `registry.ts`, never worked out from settings, the address or a workflow's status.
- "No address yet" and "no offered workflow" are not `available: false`. They are the refusals `comfy_address_needed` and `comfy_job_not_offered` at the moment of a run (`spec/api-commands.md`), so the user can pick ComfyUI and be led to the address dialog [REQ: FR-254, FR-255].
- The `comfyui` row: label `ComfyUI`, `jobs: ['image', 'video']`, `available: true`, `secrets: []`, `defaultModels: {}` (the model is the workflow, `spec/export-and-checks.md`), `local: true`, `cancel: 'stops'`, `serverText: true`. It sits after `fal-seedance`, before `firefly`.
- `fal-seedance` is `available: true` (P7-15).

### Paid calls

- **Local providers are never counted** [REQ: FR-257; D-051 answer 14]. The runner counts a call unless the provider's `local` is exactly `true`. A job whose provider is not in the registry is counted: when in doubt the count goes up, never down.
- The count is added just before the call is handed to the adapter. A call that fails stays counted, and so does a call the adapter refuses before anything leaves the computer. `paid_calls` is "calls the job tried to send": it can be higher than what the provider charged and is never lower than what was sent.
- No call is counted once a cancel was asked for, because none is sent: `jc.call` throws `ProviderCancelled` and does not run its function after a stop was asked or when the job's project is not open. Calls already sent stay counted, including those of a running Gemini picture job that was cancelled and still finish.

### Runner context for cancel

Built. `src/main/jobs/types.ts`, `src/main/jobs/progress.ts`, `src/main/jobs/live.ts`, `src/main/jobs/job-end.ts`.

```ts
type JobService = {
  …
  // Sets seen_at on each named job that succeeded and has none, inside the calling command's
  // transaction. Emits job.updated for each row it changed, after the command has ended.
  markSeen(ctx: ProjectContext, jobIds: string[]): void
}
type JobRunContext = {
  …
  // What a provider reports while it works. Written into the job: `progress` from `fraction`,
  // and `result.stage`, `result.queuePosition` while the job runs.
  onProgress(p: RunProgress): void
  // Stores the provider's own ID for the run in `remote_job_id`, and emits job.updated.
  setRemoteJobId(id: string): void
  // What has arrived so far, for example { assetIds: [...] }. Each call replaces the last.
  // It is in `result` while the job runs and stays there if the job does not succeed.
  keep(value: Record<string, unknown>): void
}
```

- `progress(fraction)` is for a handler that counts its own steps (two of four pictures done). `onProgress` is for what a provider says. An adapter reports only when the stage, the queue position or the whole percent changed.
- A handler hands its provider `runOptions(jc)` (`src/main/jobs/progress.ts`, exported by `runner.ts`), which is exactly `{ signal: jc.signal, onProgress: jc.onProgress }`.
- `setRemoteJobId` exists so that only the runner writes `remote_job_id`. It does nothing once the job has ended. The video job kind calls it right after `VideoProvider.start` answers.
- `jc.cancelled()` is true once a stop was asked or the job has ended.
- **Handler rule.** Before writing a file or sending a system command, a handler checks `jc.cancelled()`. It calls `jc.keep` after each option is stored. It returns only when all the work is done. When it was stopped it calls `keep` with what arrived and ends with `ProviderCancelled`. It never returns a part result after a stop; that would read as "finished before it could be stopped". A system command already sent when the job ends still completes.

**The final result.** Every end goes through one function that builds it.

- While the job runs, `result` is what was kept, plus the runner's running fields: `stage`, `queuePosition`, `cancelAsked`.
- `stage` and `queuePosition` are never in the result of a job that has ended. The runner's field names win over a kept value that uses one of them. A kept key `outcomeUnknown: false` does not hide the runner's `true`.

| End | Status | Final result |
|-----|--------|--------------|
| Provider stopped (`ProviderCancelled`) | `cancelled` | kept + `cancelAsked: true` |
| Attached cancel | `cancelled` | kept alone |
| No confirmation | `cancelled` | kept + `cancelAsked` + `outcomeUnknown` |
| `ProviderFailure` with `missing` | `failed` | kept + `missing` |
| `ProviderFailure` after a stop was asked | `failed` (with that kind) | kept + `cancelAsked` |
| Success | `succeeded` | the returned value only, plus `finishedAfterCancel` when a stop had been asked |

With nothing kept and no end field the result is null.

## `job.cancel`

Built. `src/main/commands/job/cancel.ts`, `src/main/jobs/cancel.ts`, `src/main/jobs/cancel-wait.ts`. [REQ: FR-281, FR-270]

The provider is asked to stop, and the job says what really happened. Refusals are decided in the command and again in the runner, both through the one function `cancelRefusal(row, provider)` in `src/main/jobs/cancel.ts`.

| The job is | What `job.cancel` does |
|------------|------------------------|
| Ended (any status other than `queued` or `running`) | Refused: `RULE_VIOLATION`, reason `job_wrong_state`, "This job has already ended." |
| `queued`, nothing sent | `cancelled` at once. Every provider. |
| `running`, provider `cancel` is `stops` or `may_finish` | The runner writes `result.cancelAsked = true` (the window shows "Stopping…"), fires the job's signal and starts the provider's wait. For a video job the handler then calls `cancel(remoteJobId)`. Then the outcome table below. |
| `running`, an `image_generation` job, provider `cancel` is `none` (Gemini) | Accepted. The runner writes `result.cancelAsked = true` and fires the signal, with no wait: no further call is sent, the calls in flight finish under the adapter's own time limit and stay counted, and the pictures they bring are kept. The end follows "Pictures" below. |
| `running`, any other background job, provider `cancel` is `none` | Refused: `RULE_VIOLATION`, reason `cancel_not_supported`, "{Provider} cannot stop a request once it is sent." [REQ: FR-281] |
| `running`, an attached job (`spec/jobs.md`) | The app stops waiting and applies nothing [D-036]. This is not a provider cancel. Calls already sent stay counted. |
| Not in the project, or a row that cannot be read | `NOT_FOUND` "That job is not in this project." (an unreadable row may give `INTERNAL`) |

A job already asked to stop is not asked again.

The window offers Cancel exactly when `cancelRefusal` accepts: `cancelShown(row, provider)` in `src/renderer/ui/cancel-shown.ts`, held to the same answer for every kind, status and provider by `tests/unit/main/jobs/cancel-shown.test.ts`.

| Outcome | Job ends as | Shown |
|---------|-------------|-------|
| `stopped`: the provider confirms, or the work never started | `cancelled` | "Cancelled" |
| `finished`: the provider finished anyway | `succeeded`, with `result.finishedAfterCancel = true`. The result is fetched and stored like any other and waits for the user. | "Finished before it could be stopped" |
| `unknown`: no confirmation within the provider's wait | `cancelled`, with `result.outcomeUnknown = true` | "Stop was asked for. {Provider} did not confirm; it may still finish." For a paid provider: "…and may still charge." |

- A job is never shown as cancelled when its result arrived [REQ: FR-281].
- Options that finished before the cancel are kept: stored, listed in `result`, offered [REQ: FR-267, FR-281].
- The variant or layer keeps what it had in every case.

### How the runner learns the outcome

One way, for pictures and video. The runner fires the job's signal and starts one timer (none for a provider whose `cancel` is `none`). It never calls an adapter.

| What the job kind handler does after the signal | Outcome |
|--------------------------------------------------|---------|
| Ends with `ProviderCancelled` | `stopped` |
| Returns its result | `finished` |
| Neither, before the timer ends | `unknown` |

- **Pictures** (`src/main/jobs/kinds/image-generation.ts`). After the signal, a call not yet sent is skipped. A provider answer already in hand was paid for, so it is converted and stored whatever the stop state. If every asked picture arrived, the handler returns and the job ends `succeeded` with `finishedAfterCancel: true`. If some were never sent, or the provider confirmed the stop (`ProviderCancelled`), the job ends `cancelled` and keeps the pictures that arrived.
- **Video** (`src/main/jobs/kinds/video-generation.ts`). When the signal fires, the handler calls the adapter's `cancel` once, with the ID it stored through `jc.setRemoteJobId`. `stopped`: it throws `ProviderCancelled`. `finished`: it fetches and stores the result and returns it. `unknown`: it keeps checking until it knows, for at most the provider's wait. A signal that fires before `start` stops the run with no more pictures uploaded.
- **The wait has one owner:** `cancelWaitFor(providerId)` in `src/main/jobs/cancel-wait.ts`. An adapter has no cancel wait of its own; it keeps asking until it knows or until its own time limit for a run.

  | Provider | Wait | Why |
  |----------|------|-----|
  | `comfyui` | 60 s | |
  | `fal-seedance` | 10 minutes | |
  | `fake` | 5 s | It answers at once. A short wait lets the hand-test screen show "did not confirm" without a long pause |
  | A provider whose `cancel` is `none` (`gemini`) | None | `askToStop` starts no timer: the picture job ends when its calls in flight end |
  | Any other | 60 s | Reached only by a provider added later whose `cancel` is not `none` |

  The runner options `cancelWaitMs` and `closeWaitMs` let tests hand in short waits; when left out, the runner uses this table and `CLOSE_WAIT_MS`. `core.ts` leaves them out. The runner fixture (`tests/integration/jobs/runner-fixture.ts`) defaults `cancelWaitMs` to 2,000 and `closeWaitMs` to 50.
- **A row that has ended never changes.** A result that arrives after the timer ended the job as `outcomeUnknown` is dropped. The message already says the run may still finish.
- An answer that arrives after the job has ended (the cancel wait ran out, or the project closed) still writes its file; `asset.addGenerated` is then refused, so the file has no row in the assets folder (A-38).

## Cancel for each provider

### ComfyUI

Built. `src/main/providers/comfyui/cancel.ts` (`cancelOwnRun`), `run.ts`, `video.ts`, `own-ids.ts`. [REQ: FR-270, FR-271, FR-289]

- Only the app's own IDs are ever named (security class). The adapter keeps one set, for the life of the app process, of the IDs `submit` gave it. Only the adapter's `cancel` calls `adopt`, and then `removeFromQueue` or `interrupt`, and only for an ID in that set. For any other ID it sends nothing and answers `unknown`. An ID that only a job row or project file supplied may be checked and fetched, never removed or interrupted. Video cancel goes through the same set. Test: `cancel` for an ID this process did not submit sends no `POST` to the stand-in and answers `unknown`.
- `cancelOwnRun` reads the queue:
  - ID waiting in the queue: `removeFromQueue(id)`, outcome `stopped`.
  - ID running: `interrupt(id)` only when the server's version is readable and at least `MIN_TARGETED_INTERRUPT` (`'0.30.0'`, `limits.ts`), outcome `stopped`; otherwise nothing is sent and the outcome is `unknown`.
  - Neither: a history entry gives `finished`, none gives `unknown`.
  - Any error gives `unknown`.
- So a cancel of a running ComfyUI job, by an agent or the user, ends `cancelled` at once only when the server still lists the run in its queue or as running. When the server no longer lists it and has no history for it, the outcome is `unknown` and the job ends after the 60-second cancel wait.
- Video: the adapter marks the run as cancel-asked; a later `execution_interrupted` (`server_stopped`) or a cancelled state is then read as `cancelled`.
- Pictures (`run.ts`): the run ends cancelled only when `cancelOwnRun` answers `stopped`. On `finished` the picture is fetched and returned. On `unknown` polling goes on under the run's own waiting and working limits, so the runner's wait decides; the 5-minute lost-contact count starts again, the other limits do not. Tests: `tests/unit/main/providers/comfyui/image-cancel.test.ts`.
- A cancel does not stop an HTTP call already in flight. Nuisance, noted, nothing built.
- Nothing else on the server is cleared. Uploads and finished files stay (`spec/comfyui.md`).

### fal.ai Seedance

The adapter is built (P7-14) and switched on (P7-15: `available: true`). The cancel rule below is built (P7-13): `src/main/jobs/leave-running.ts`, `src/main/jobs/cancel.ts`, `src/renderer/ui/cancel-shown.ts`.

- The queue cancel call. A request that still completes is `finished`, kept.
- **A paid run charged either way is left to finish.** One test, `leftRunningOnClose(row, provider)` in `leave-running.ts`, says which runs these are. It is true only when all of these hold:
  - the job kind is `video_generation` and the row is `running`;
  - the row has a `remote_job_id`;
  - the provider is in the registry, is not `local`, and its `cancel` is `may_finish`;
  - `result.stage` is `working` (the provider has started the request).
- **What `job.cancel` does** for such a provider:
  - `queued`, nothing sent: cancelled at once.
  - `running`, still in the provider's queue (`result.stage` is `waiting`), or with no remote ID yet: asked to stop as for any `may_finish` provider; the handler sends the queue cancel.
  - `running` and `leftRunningOnClose` is true: refused, `RULE_VIOLATION`, reason `cancel_would_still_charge`, "{Provider} has started this and will charge for it. The app lets it finish and keeps the result."
- `cancelRefusal` checks in this order: an ended job (`job_wrong_state`); a running background job other than pictures on a provider whose `cancel` is `none` (`cancel_not_supported`); then `cancel_would_still_charge`. The command and the runner both call it.
- `cancelShown` gives the same answer: no Cancel on such a row. `tests/unit/main/jobs/cancel-shown.test.ts` holds the two together.
- A cancel crossing with the start is `finished`, kept.
- A cancelled started request is treated as charged (U-25; OI-60 part 2 stays open). Closing a project leaves such a run running for the next open (A-174; "Closing a project" below).

### Gemini

Built (no cancel). `cancel: 'none'`.

- A queued Gemini job can be cancelled. A running picture job can too: no further call is sent, the calls in flight finish and their pictures are kept, and the job ends as "Pictures" says (`cancelled` with the pictures that arrived, or `succeeded` with `finishedAfterCancel` when all arrived). There is no cancel wait. Any other running background Gemini job is refused with `cancel_not_supported`.
- The adapter does not honour `opts.signal`; it has its own time limit only. If a way to cancel is verified later (L-4), `cancel` in `registry.ts` changes and the adapter honours `opts.signal`; nothing else changes.

### The fake provider

Built. `src/main/providers/fake/behaviour.ts`, `src/main/providers/fake/video.ts`. Reachable only with `ADMAN_FAKE_PROVIDERS=1`.

- `cancel: 'stops'`, `local: true` (never counted), wait 5 s.
- `FakeBehaviour.onCancel`: `'stop'` (default) confirms; `'finish'` finishes anyway; `'no_confirm'` never answers, so the job ends `outcomeUnknown`. Set by `setFakeBehaviour`, reset by `resetFakeBehaviour`.
- **Video runs live in the run ID,** so they survive a restart of the app. The remote ID is `fake-video-v1-{startedAtMs}-{waitMs}-{width}x{height}-{durationMs}`. `check` and `fetchResult` work from the ID and the clock: the run is ready once `startedAtMs + waitMs` has passed. So a fresh process answers for a run an earlier process started.
- The ID is read strictly: whole numbers with no sign and no leading zero, of bounded length; width and height at most 16,384 and the duration at most 120,000 ms. A malformed ID is a failed run (kind `other`), and the failure never holds the ID's text.
- What a test told the process (a failure, the cancel answer, a confirmed stop) is kept in memory only. A run this process did not start has no failure, its cancel confirms (`stop`), and it succeeds once its wait is over.
- Test and hand-test use only.

## Closing a project

Built. `JobService.cancelAll(projectId)`, `src/main/jobs/close-jobs.ts`.

| The job is | What close does | Row at the end |
|------------|-----------------|----------------|
| `queued`, nothing sent | Ends it at once | `cancelled` |
| `running`, an attached job | Stops waiting, as `job.cancel` does | `cancelled` |
| `running`, a background job, provider `cancel` is `none` | Stops waiting. The provider is not asked: it cannot stop | `cancelled`, with `result.stoppedWaiting = true` |
| `running`, a paid video run the provider has started (`leftRunningOnClose` is true, "fal.ai Seedance" above) | Not asked to stop and not waited for. The runner lets go of it (`leaveRunning` in `src/main/jobs/leave-running.ts`): it clears the job's wait, drops it from its own jobs, and drops any later write from this process | `running`, with `result.leftRunning = true` and its `remote_job_id`. The next `projectOpened` of the project picks it up as a left-over and collects the clip (A-174) |
| `running`, a background job, provider `cancel` is `stops` or `may_finish` (or the provider is not in the registry) | Asks it to stop, exactly as `job.cancel` does, then waits | Whatever the outcome table gives if it comes within the close wait; otherwise `cancelled` with `result.outcomeUnknown = true` |

- **Every signal is fired,** with one exception. Close fires the signal of every running job it ends, attached and `none` included, so a handler that listens stops its own work. An adapter that cannot stop ignores it. The exception is a run left running: its signal is not fired, because the video handler would then send the provider's cancel. Which runs are left running is read from their rows when the close starts.
- A job already asked to stop joins the wait and is not asked twice. The wait leaves no timer behind.
- **The close wait** is at most 5 s for the whole project, not per job: `CLOSE_WAIT_MS = 5_000` in `cancel-wait.ts`. The wait ends as soon as no job of the project is running. After it, every job of the project still `queued` or `running` is ended at once, a job started during the wait included, apart from the runs left running. Then `cancelAll` returns and the file closes.
- **A closing project starts no job.** `RunnerState.closing` (`src/main/jobs/live.ts`) holds closing project IDs. `cancelAll` adds the ID before ending queued rows and removes it in a `finally`; `pump` skips rows of a project in the set. `enqueue` still writes the row; it stays `queued` and ends `cancelled` with nothing sent when the wait is over.
- **A paid call already sent stays counted.** A close does not change `paid_calls`. A request that could not be stopped may still be charged, and its result is not kept: the file is closed when it arrives.
- **What the user is told before closing.** The window builds the warning from what it already has: `job.list` with `state: 'active'` and the provider list of `app.getState`. A running background job whose provider has `cancel: 'none'` cannot be stopped; one whose provider is not `local` may be charged. `jobs_running` has no field for this.
- **What the user is told after** (waits for the UI pass; the row holds the facts either way). For `stoppedWaiting`: "The project was closed while {Provider} was working. The request could not be stopped. Its result was not kept." For a provider that is not local: "…could not be stopped and may still be charged. Its result was not kept." The outcome sentences above cover the rest.
- OI-51 is open: whether, for a paid request that cannot be stopped, the app should keep the project open in the background until the answer arrives instead. The 5 s close wait is the architect's number, to confirm with it.

## Left-over runs

Built. `src/main/jobs/start-up.ts` (`projectOpened`), `src/main/jobs/kinds/video-generation.ts`.

On opening a project, every job left `queued` or `running` by a process that is gone is settled. A row this process enqueued or is running is its own, not a left-over.

| Left-over row | What happens |
|---------------|--------------|
| ComfyUI, any kind | Never picked up: the app does not contact the ComfyUI address on open. Ends `failed`, kind `offline`, reason `lost_contact`, detail `interrupted`. |
| Video job with a `remote_job_id`, another provider | Picked up by the video job kind: checked and fetched only |
| Any other `queued` row | `cancelled` (it sent nothing) |
| Any other `running` row | `failed`, kind `other`, detail `interrupted` |
| A row that cannot be read | `failed`, kind `other`, detail `unreadable_row`, no event |

**A left-over video run is only checked and fetched, never started again** (security, cost). When the video job kind gets a row that has a `remote_job_id`, it never calls the adapter's `start`. It calls `check`, fetches the result if there is one, and stores it. A remote ID the provider does not know ends the job `failed` with nothing kept. It is never removed or interrupted. This holds for any project file, packaged copies included.

**fal rows** (built, P7-15). A status, result or download call is not a paid call: `paid_calls` counts only the submit, and stays as it was when a left-over row is picked up. A started fal run is left running on close and on quit and is collected at the next open. So opening a project file that holds a running fal row (someone else's file included) sends the user's fal key to the fal queue host for status and result only; it never submits. Whether fal charges for a status call is still the stakeholder's check on his fal usage page (A-173, P7-24).

# Jobs

Work that calls a provider, or takes longer than a few seconds, runs as a job: one `job` row, run by the job runner in the main process. This file covers the job record in use, job kinds and their two classes, the runner and its limit, paid-call counting, left-over runs on project open, and the fake provider.

Read with: `spec/data-model.md` (the `job` table and its columns), `spec/cancel.md` (stopping a job, for every provider), `spec/providers.md` (error kinds and messages), `spec/api-commands.md` and `spec/api-queries-events.md` (`job.*` commands, `job.list`, `job.updated`). Runs started by an agent: `spec/mcp-and-agents.md`.

[REQ: FR-124, FR-152, FR-210, FR-215 to FR-218, D-036]

## The job record in use

Built. Row schema: `src/shared/schemas/rows/job.ts`. Store: `src/main/jobs/job-store.ts`. Column definitions are in `spec/data-model.md`; this section says what each value means while the app runs.

| Field (wire name) | Meaning in use |
|-------------------|----------------|
| `kind` | One of the job kinds (see "Job kinds"): nine, and `cutout` from Phase 4. |
| `status` | `queued`, `running`, `succeeded`, `failed`, `cancelled`. Five values only. |
| `campaignId`, `variantId`, `layerId`, `slot` | Where the job belongs [REQ: FR-217]. A job for a campaign has `campaignId`; for a variant also `variantId`; for one layer also `layerId`; for a template slot that has no layer yet, `slot`. Plain text, no foreign key: the job record outlives what it was for. If the layer is gone, "go to that place" leads to the variant; if the variant is gone, to the campaign. |
| `provider`, `model` | The provider ID and model the job calls. |
| `request` | JSON, enough to retry. Shape per kind (see "Job kinds on `main`"). |
| `remoteJobId` | The provider's own ID for the run. Set by `jc.setRemoteJobId`. Used to pick up a video run again (see "Left-over runs on project open"). |
| `result` | JSON. While running: what has arrived so far (`jc.keep`), plus `stage` and `queuePosition`. When ended: see "Final result". Holds the asset IDs a run produced. |
| `errorKind`, `errorReason` | Why a job failed: a provider error kind and an optional reason (`spec/providers.md`). |
| `error_detail` | Main-process only. Not in the wire row, so it is in no `job.updated`, no `job.list` reply and no MCP reply. The raw provider text is written to this column only, never to the log. One reader outside the main process: the user-only query `job.getServerMessage`, for a ComfyUI job, when the user asks. No job column ever holds the ComfyUI address. |
| `progress` | A fraction, written from `jc.progress` or `jc.onProgress`. |
| `paidCalls` | Provider calls this job sent that may be charged (see "Paid-call counting"). |
| `seenAt` | When the user looked at the finished result; null means not yet. |
| `startedBy` | `user` or `agent`. Every caller of `enqueue` says which. |
| `createdAt`, `updatedAt` | Times of insert and last write. `createdAt` orders the queue. |

Rules on the record:

- **A job row is never deleted by the app** [REQ: FR-216, FR-248]. Reopening a result reads the row and its assets and calls no provider. The options of every earlier run for a layer are the `asset` rows whose `gen_run_id` is a job with that `layer_id` or `slot`. Phase 4 adds the query for it; no further stored value is needed.
- **"Finished, not yet looked at" is not a status** [REQ: FR-218]. A job is finished and not looked at when `status = 'succeeded'` and `seen_at` is null. `job.markSeen` sets `seen_at`. The window sends it when it shows the result itself (the options of a picture run, the clip of a video run), not when it shows the list entry. A failed job is never "not looked at"; it is listed as failed with retry [REQ: FR-069].
- **Marks.** A variant or campaign "has a job running" when a job row with its ID is `queued` or `running`, and "has a result not yet looked at" when one is `succeeded` with `seen_at` null. Both are computed from the `job` table (`job.list` with `state` `active` or `unseen`). Nothing else stores them. As built (P4-T3): the campaign tab marks are read again on job events in `use-project.ts`. `layout-run.ts` marks a handled layout result seen, also when the result was refused or its variant is gone.
- A result nobody looked at is still there after a close and reopen, because `seen_at` is in the project file.
- **Retry** is `job.retry`: a new job from the old row's `request`, with the same campaign, variant, layer and slot. The old row stays. For an `image_generation` row that kept pictures, the new request asks only for the pictures not yet made: `count` minus kept, at least 1 (`keptPictureCount` and `picturesLeft` in `src/shared/generation/pictures-left.ts`). Every other row's request is sent as stored. Only a `failed` or `cancelled` row can be retried. The key guard runs again; a ComfyUI picture or video retry passes the same checks as the command that first started it (`src/main/commands/job/retry.ts`). Agents are denied `job.retry`.

### Final result

Built (`src/main/jobs/job-end.ts`). Every end goes through one function that builds the final result. `stage` and `queuePosition` are removed from every ended row; `cancelAsked` is kept.

| End | Status | Final result |
|-----|--------|--------------|
| Provider stopped (`ProviderCancelled`) | `cancelled` | kept + `cancelAsked: true` |
| Attached cancel | `cancelled` | kept alone |
| No confirmation | `cancelled` | kept + `cancelAsked` + `outcomeUnknown` |
| `ProviderFailure` with `missing` | `failed` | kept + `missing` |
| `ProviderFailure` after a stop was asked | `failed` | kept + `cancelAsked` |
| Success | `succeeded` | returned value only |

"Kept" is the last value handed to `jc.keep`. A kept key `outcomeUnknown: false` does not hide the runner's `true`. What each cancel outcome means per provider: `spec/cancel.md`.

## Job kinds and their two classes [D-036]

Built as a table: `src/shared/config/job-kinds.ts` (frozen contract). It owns the kinds, their class, the statuses and the runner's limit. Used by the runner and the window.

| Class | Kinds | Rule |
|-------|-------|------|
| Background | `image_generation`, `video_generation`, `export`, `publish`, `cutout` (Phase 4) | Keeps running when its dialog, panel or tab closes. Nothing in the window can stop it except `job.cancel` from the activity list. |
| Attached | `generative_fill`, `layout_proposal`, `copy_options`, `translation`, `brief_extraction` | Belongs to the dialog or tab that started it. Before that dialog or tab closes while the job is `queued` or `running`, the window warns the user. If the user confirms, the window sends `job.cancel` and then closes. If the user cancels the warning, nothing closes and the job carries on. |

- The stakeholder's words cover the first two background kinds and the first four attached kinds. `export`, `publish` and `brief_extraction` were placed by the architect: the first two were already designed as jobs in the activity list, and brief extraction is a wait inside the intake dialog. To confirm (OI-31: which kinds are attached, and whether partial results of a cancelled attached job are offered, are open).
- The main process does not know about tabs or dialogs. The window keeps the attached jobs it started in `src/renderer/stores/attached-store.ts`, one store per window: `register(jobId, owner, finish?)` when a command replies (owner a variant tab or a dialog, each with its `projectId`), `end(jobId)` on Stop. It follows `job.updated`, runs `finish` once when a job succeeds, never for a cancelled or failed one, and forgets the job when it ends. The store decides when to warn (`spec/screens-ai.md`, "Attached jobs and the close warning"). Nothing about owners is stored in the project.
- `job.cancel` on an attached job leaves the variant as it was. An attached job writes to the variant only through one last command when everything has arrived, and a cancelled job never sends it. For a layout proposal that command is the window's own `layer.updateMany`, sent when the job succeeds while its tab is open (`spec/ai-jobs.md`); the job writes nothing itself. What had already arrived is kept in `result` with status `cancelled`. The data allows the app to offer those partial results or not (OI-31).

## Job kinds on `main`

Built: `image_generation`, `video_generation`, and from Phase 4 `layout_proposal`, `copy_options`, `brief_extraction` and `cutout` (`spec/ai-jobs.md`). Handlers are listed in `src/main/jobs/kinds/index.ts`; request and result shapes in `src/shared/schemas/jobs/`. `export`, `publish`, `generative_fill` and `translation` exist in the table and the `kind` check only; no handler exists for them. `generative_fill` (Phase 5, attached): request, run and the window's last command `generation.applyFill` are in `spec/links-and-sync.md`, "Generative fill"; its owner in the window is the fill's variant.

### `image_generation`

Built. Handler `src/main/jobs/kinds/image-generation.ts`. Started by `generation.runImages`, which checks the variant and the layer or slot, calls the key guard, checks reference pictures in `prepare` (`spec/assets.md`, "Reference pictures"), then enqueues.

```ts
// src/shared/schemas/jobs/image-generation.ts
imageJobRequest = z.object({
  prompt: z.string().min(1),
  referenceAssetIds: z.array(z.string().min(1)),
  count: z.number().int().min(1).max(MAX_IMAGES_PER_RUN),   // MAX_IMAGES_PER_RUN = 8
  width: z.number().int().positive(),
  height: z.number().int().positive(),
})
// A key of `failures` is a provider error kind; its value is how many calls failed that way.
imageJobResult = z.object({
  assetIds: z.array(z.string()),
  failures: z.record(z.string(), z.number().int()),
})
```

- The handler calls the key guard (`requireProviderKeys`) again before its first call. A key removed while the job waited means no call goes out.
- It reads the reference pictures again with `AssetService.read`.
- It calls `generate` once per picture with `count: 1`, `PICTURES_AT_ONCE = 2` at a time, so each call is counted and one failure does not lose the others.
- Every picture goes through `deps.toPng` whatever its `mime`. The PNG that comes back gets the generation details embedded (`spec/export-and-checks.md`, "Embedded generation details"), is written with `AssetService.writeManaged`, then added with the system command `asset.addGenerated`. Its asset ID goes into `result` and `jc.keep`.
- A run where some calls fail ends `succeeded` with the pictures it got and the failures counted in `result.failures`. A run with none ends `failed`. No file is written for a failed picture.
- The pre-filled prompt and the choice of its ending ("no text" with no picture sent, "keep printing" with one or more) live in one pure file, `src/shared/generation/prompt.ts`. The handler calls `promptToSend(request.prompt, { pictures: request.referenceAssetIds.length })`; the video handler does the same (`spec/providers-adapters.md`, "Prompt and text rules"; SP-9).

### `video_generation`

Built for ComfyUI and the fake provider. Handler `src/main/jobs/kinds/video-generation.ts`. Started by `generation.startVideo` (three starts: from a prompt, from a first-frame picture, with a reference picture; checks in `spec/comfyui.md`).

```ts
// src/shared/schemas/jobs/video-generation.ts
videoJobRequest = z.object({
  prompt: z.string().min(1),
  durationMs: z.number().int().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  start: z.enum(['none', 'first_frame']),
  referenceAssetIds: z.array(z.string().min(1)),
})
// `details: 'pending'` marks a clip whose file holds no details of the app yet (Phase 7).
videoJobResult = z.object({
  assetId: z.string(),
  width: z.number().int(),
  height: z.number().int(),
  durationMs: z.number().int(),
  hasSound: z.boolean(),
  details: z.literal('pending'),
})
```

- It reads the picture again with `readPictures` (`AssetService.read`), which gives a clean PNG: a WebP is turned into PNG first, then every picture is re-encoded by `toPng`. First frame: `image = { bytes: deps.fitPicture(bytes, runSize), mime: 'image/png' }`, `references = []`. Reference: `image = null`, `references = [that clean PNG]`, not fitted.
- It calls the adapter's `start` once, stores the provider's ID with `jc.setRemoteJobId`, asks where the run is every `VIDEO_POLL_MS = 2_000`, fetches the clip, checks it with `checkMp4`, writes it with `writeManaged` and adds it with `asset.addGenerated`. The clip is stored as returned, sound included. No clip is put on a track (Phase 7).
- It calls the adapter's `cancel` when the signal fires (`spec/cancel.md`).
- **A row that already has a `remote_job_id` is only checked and fetched** (security class, cost). The handler never calls `start` for it: it calls `check`, fetches the result if there is one, and stores it. A remote ID the provider does not know ends the job `failed` with nothing kept. This covers any project file, packaged copies included, so a row the app did not make cannot start paid work.
- A clip's asset row has `width` and `height` empty until Phase 7's FFmpeg step fills them; the job result holds them.

## The runner

Built. `src/main/jobs/runner.ts` (`createJobRunner`), with `run-job.ts`, `live.ts`, `job-store.ts`, `progress.ts`, `start-up.ts`, `cancel.ts`, `close-jobs.ts`, `cancel-wait.ts`, `job-end.ts`, `job-error-log.ts`.

### Contract (frozen, `src/main/jobs/types.ts`)

```ts
type EnqueueRequest = {
  kind: JobKind
  campaignId: string | null
  variantId: string | null
  layerId: string | null
  slot: string | null
  provider: string
  model: string
  request: unknown              // JSON, enough to retry
  startedBy: 'user' | 'agent'   // required: every caller says
}

type JobService = {             // on CoreDeps.jobs
  enqueue(ctx: ProjectContext, job: EnqueueRequest): string
  cancel(projectId: string, jobId: string): Promise<void>
  cancelAll(projectId: string): Promise<void>
  activeCount(projectId: string): number
  projectOpened(projectId: string): Promise<void>
  markSeen(ctx: ProjectContext, jobIds: string[]): void
}

type JobRunContext = {          // `jc`, handed to a handler
  deps: CoreDeps
  projectId: string
  signal: AbortSignal                       // fired by job.cancel
  call<T>(fn: () => Promise<T>): Promise<T> // one provider call
  progress(fraction: number): void
  cancelled(): boolean
  system(command: string, input: unknown): Promise<Result<unknown>>
  onProgress(p: RunProgress): void          // RunProgress from ../providers/types
  setRemoteJobId(id: string): void
  keep(value: Record<string, unknown>): void
}

type JobKindHandler = {
  kind: JobKind
  run(jc: JobRunContext, job: JobRow): Promise<unknown>   // returns the value for job.result
}
```

`runOptions(jc)` (`src/main/jobs/progress.ts`, exported by `runner.ts`) returns `{ signal: jc.signal, onProgress: jc.onProgress }`. A handler hands it to its provider.

### Starting

- A `generation.*` command checks its input, calls the key guard (`spec/api-principles.md`), and calls `enqueue`, which inserts one `queued` row inside the command's transaction and returns `{ jobId }` at once. It never waits for the provider.
- `enqueue` starts the job from a microtask, after the transaction has ended. A command that fails after `enqueue` starts nothing; a rolled-back ID is dropped.
- Commands check what they can before they enqueue: an `AppError` thrown inside a handler ends the job `failed` (see "Errors inside a job").
- The user can always start another job. Starting never waits for a running one [REQ: FR-215].

### Order and the parallel limit

- `JOBS_AT_ONCE_PER_PROVIDER = 4` (`src/shared/config/job-kinds.ts`): at most four jobs run at once per provider, one number for every provider, ComfyUI included. Not a user setting. A job that has to wait stays `queued`. `tests/unit/shared/schemas/contracts.test.ts` pins it at 4. `JobRunnerOptions.jobsAtOnce` overrides it in tests only.
- Inside one picture job, calls run two at a time, so up to eight calls can be out at one provider.
- A run's time limit counts time waiting in the server's queue.
- `pump` gathers the startable `queued` rows of all open projects into one order, by `created_at` then ID, and starts them in that order under the limit. A project with a long queue does not hold back another.
- **What the limit counts:** jobs this process is running (rows that are `running` and that the runner holds). Two cases can put more than four calls out at one provider, both accepted. (a) Video jobs picked up at project open are all resumed, however many: they were sent before and resuming only asks how they are doing. They do count against new jobs. (b) A job the app stopped waiting for (an attached cancel, a stop nobody confirmed, a close) frees its place at once, though its last call may still be open; otherwise one call that never answers could block a provider until restart.
- **The runner starts only its own rows** (security, cost). It keeps the IDs it enqueued and has not started or ended. `pump` starts a `queued` row only when its ID is among them. A `queued` row from a process that is gone, or from a file made elsewhere, is never started, whatever calls the runner; running it could send a paid call nobody asked for. Such a row waits for the open rule (below), which cancels it. That rule may run late or twice and does no harm, since it skips every row this process enqueued or is running.
- A closing project starts no job: `RunnerState.closing` (`src/main/jobs/live.ts`) holds closing project IDs and `pump` skips their rows (`spec/cancel.md`, "Closing a project").
- Agent-started runs have their own limit and an untick check before first send: `spec/mcp-and-agents.md`. The runner's limit of four applies to everyone and is separate.

### Writing

- **The runner is the only writer of `job` rows.** Every write to a `job` row is made by a function in `src/main/jobs/`, reached through `JobService` or `JobRunContext`. No command writes a job row with its own SQL; `job.markSeen` calls `JobService.markSeen`.
- After every write the runner emits `job.updated` with the wire row. `markSeen` emits `job.updated` for each row it marked, after the command has ended; a rolled-back mark sends nothing.
- A job that changes any other table sends a system command through the bus (`jc.system`, as the user), so the change gets a transaction, `touch` and `project.changed` like every other change. For a picture or video run that command is `asset.addGenerated` (internal, denied to agents). `jc.system` sends as actor `user` whoever started the job, an agent included; why this is safe, and that a new `jc.system` command is ruled on by itself first, is in `spec/agent-runs.md`, 'After the gate'.
- `onProgress` writes `progress`, `result.stage` and `result.queuePosition` while running. Each call is one write and one event; an adapter reports only when the stage, the queue position or the whole percent changed.
- `jc.setRemoteJobId(id)` writes `remote_job_id` and does nothing once the job has ended.
- `jc.keep(value)` holds the value on the live job and writes it as the running result. Each call replaces the last.
- `jc.cancelled()` is true once a stop was asked or the job has ended.
- **Handler rule:** before writing a file or sending a system command, a handler checks `jc.cancelled()`; it calls `jc.keep` after each option is stored. A system command already sent when the job ends still completes. A cancel landing between `writeManaged` and `asset.addGenerated` leaves a file with no row; accepted nuisance.
- `jc.call` throws `ProviderCancelled` and does not run its function when the job's project is not open, or after a stop was asked. Nothing is added to `paid_calls`.
- Every line the runner writes to the log uses actor `system`.

### A job row that cannot be read

Built (security class, low). A project file from elsewhere can hold a job row that fails its schema or whose `request` is not JSON. `readJob` (`job-store.ts`) catches it, writes one `error` log line (`event: 'job'`, `name: 'rows.read'`, `context` with table and row key, no value) and returns null. Such a row never stops the runner and is never run. `emitJob` sends nothing for it. `projectOpened` and `pump`, on a `queued` or `running` row that reads as null, end it with `updateJob` alone as `failed`, `error_kind` `other`, `error_detail` `unreadable_row`, with no event, and go on. `job.cancel` on such a row answers `NOT_FOUND` or `INTERNAL`; `job.list` leaves it out.

### Errors inside a job

Built.

- `jc.call` turns a `ProviderFailure` into the job's error kind and reason. The plain message for each error kind has one owner, `src/main/providers/messages.ts`.
- **A local cause** (security class) ends the job `failed`, kind `other`, with its own reason and sentence (`spec/ai-jobs.md`, "A plain sentence per failure cause"). `src/main/jobs/local-failure.ts` holds `LocalFailure`, which carries a reason only. `readPictures` turns `AssetService.read`'s refusals into `picture_missing`, `picture_too_large` or `picture_changed`; `storeResult` turns a failed write into `assets_folder_missing` or `assets_not_writable`, and a refused `asset.addGenerated` into `results_not_added`. `error_detail` holds the reason name. The reason is picked by comparing the error's code and `details.reason` with fixed values, so no path, code or message reaches the row, the sentence or a log line; `logEnd` writes `errorKind` and `reason` only.
- **Any other `AppError` met after enqueue** ends the job `failed`, kind `other`. `NEEDS_KEY` gives reason and detail `key_missing`; any other gives no reason and detail `app_error`, with the sentence "{Provider} could not finish this request." Retry goes through the command again, so a missing key opens the key dialog and a missing reference file gets its own refusal. Test: `tests/integration/generation/image-kind-errors.test.ts`.
- **Unforeseen errors** are logged through `jobErrorContext(error, secrets, noMessage)` in `src/main/jobs/job-error-log.ts`, which builds `context.error`. Secrets are `deps.secrets.get(name)` for each of the provider's `secrets`; `noMessage` is the provider's `serverText`; a provider not in the registry gets the flag set. A secret is removed in plain, URL-encoded and base64 forms from message and stack. `framesOf` cuts the header (name and message, all lines) off the stack before keeping only frame lines. With the flag, message is null. An error whose `message` was changed after it was made, with the flag set, gives `stack` null. A thrown value that is not an `Error` gives its type as the name and no stack. The row's `error_detail` is `internal`. Test: `tests/integration/jobs/runner-secret-log.test.ts`.
- The job's log line holds the job ID, kind, provider, error kind and reason, never the raw provider text.
- No code under `src/main/providers/` or `src/main/jobs/` assigns to an error's `message`.

## Paid-call counting [REQ: FR-230]

Built (`src/main/jobs/run-job.ts`). `paid_calls` gains one each time `jc.call` sends a call to a provider whose registry row has `local` false, at the moment of sending, so a run that failed half way still counts what it sent. Local providers (ComfyUI, the fake provider) never count. A call refused before sending (project closed, stop asked, agent tick off) adds nothing. A campaign's total is the sum over its job rows, split by `kind`. It is a count of calls, not money; usage and estimated cost come later (slice US, OI-52).

A paid call is made only when a person presses a button (with the paid confirm, `spec/screens.md`), an agent with its tick on starts a run, or the project owner runs the live tests. Nothing in CI calls a real provider. Spending the user did not ask for is treated as in the threat scope (OI-63: not yet confirmed by the stakeholder); the rules on left-over video runs, own rows only, and closing projects stand either way.

## Left-over runs on project open

Built. `src/main/jobs/start-up.ts`.

`project.open` (`src/main/commands/project/open.ts`) calls `jobs.projectOpened`, and only when it really opened the file. Opening a file that is already open calls nothing, so a running job is left alone. `project.create` calls nothing (a new file has no job rows). `project.package` calls nothing: it never opens the copy, and the copy's left-over rows are settled when someone opens it. A copy made in Finder or Explorer is opened by `project.open` like any file.

On open, the runner looks at every job left `queued` or `running` that this process did not enqueue and is not running:

| Row | Becomes |
|-----|---------|
| Cannot be read | `failed`, `other`, detail `unreadable_row` (see above) |
| Provider `comfyui`, any kind | `failed`, kind `offline`, reason `lost_contact`, detail `interrupted`. The app does not contact the ComfyUI address on open, so no ComfyUI row is ever resumed. |
| `video_generation` with a `remote_job_id`, a handler for the kind, provider not `comfyui` | Started again; the handler only checks and fetches (see `video_generation`). |
| `queued` (never sent a call) | `cancelled` |
| Any other `running` row | `failed`, kind `other`, detail `interrupted`, offered for retry |

Today the only video provider that reaches the resume row is the fake one; ComfyUI rows are failed and fal.ai has no adapter yet.

## Closing a project and quitting

Built: the refusal, `'stop'`, the close and quit warnings (P4-10, worded in `spec/screens-ai.md`) and quitting through `project.close` with `'stop'`. What a stop does per provider: `spec/cancel.md`.

- `project.close` refuses with `RULE_VIOLATION`, `details.reason = 'jobs_running'` and `details.count`, when the project has a `queued` or `running` job, unless its input has `runningJobs: 'stop'`. With `'stop'` the runner (`cancelAll`, `src/main/jobs/close-jobs.ts`) asks the providers that can stop, waits at most `CLOSE_WAIT_MS = 5_000` for their answers, ends what is left, and the project closes. A job row never stays `queued` or `running` in a file the app closed this way.
- Whether to ask, stop or keep running on close is not decided (Q-039). The one input serves each answer: Ask (the window shows a warning on the refusal and on confirm sends `runningJobs: 'stop'`); Stop (it always sends `'stop'`); Keep running (it does not close the project when the user goes to another one; the main process already holds several open projects by ID).
- **Quitting** (`src/main/index.ts`): with jobs queued or running in any open project, `before-quit` is stopped and a system message box asks first (wording from `quitQuestion` in `src/main/quit-question.ts`; "Cancel" is the default, so Enter or Escape keeps the app open). Closing the app window asks the same question, since closing it quits the app. "Quit" runs `closeAllStopping` (`src/main/core.ts`): `project.close` with `'stop'` for every open project, then `closeAll` for anything a refused close left open; then the app quits. With nothing running, no box, and `closeAll` closes the files.
- `project.setAssetsDir` refuses with `RULE_VIOLATION`, `jobs_running` while `jobs.activeCount(projectId) > 0`: a job writes its file and then adds its row, and both must see one folder. `campaign.delete` refuses with `jobs_running` too (OI-69: provisional).
- One or several projects at once (Q-038) and remembered tabs (Q-040) are not decided. The main process keeps any number of open projects, each named by `projectId`, which serves either answer.

## The fake provider

Built. `src/main/providers/fake/` (`behaviour.ts`, `image.ts`, `video.ts`, `layout.ts`, `text.ts`, `cutout.ts`, `run.ts`, `png.ts`, `mp4.ts`).

- Registry row `fake`, label "Fake provider", `jobs: ['image', 'layout', 'text', 'video', 'cutout', 'storage', 'verification']`, `available: true`, `secrets: []`, `local: true`, `cancel: 'stops'`, `serverText: false`. It is listed only when `ADMAN_FAKE_PROVIDERS=1` (`src/main/providers/registry.ts`). It makes no network call and counts no paid call.
- Tests set its behaviour with `setFakeBehaviour({ fail, waitMs, onCancel })` and `resetFakeBehaviour()`. `fail` is any provider error kind (detail `FAKE_FAILURE_DETAIL = 'Fake provider failure'`); `waitMs` makes it wait; `onCancel` is `'stop'` (confirms), `'finish'` (finishes anyway) or `'no_confirm'` (never answers).
- Its picture is a real PNG, a plain grey picture of the asked size (`png.ts`). Its clip is a small MP4 of box headers only, holding the fields `checkMp4` reads and no picture data (`mp4.ts`).
- The fake video provider keeps its runs in memory (tests and hand tests only). It is how the resume path is tested, since no ComfyUI row is resumed.
- Runner tests use a test-only job kind handler. `tests/integration/jobs/runner-fixture.ts` takes `cancelWaitMs` (default 2_000), `closeWaitMs` (default 50), `jobsAtOnce` (default 3, so older tests keep running at three) and `secrets`, and returns `project` and `projects`.

## What later phases add

Not built.

- **Phase 7: video resume into the ad.** Resume already checks and fetches a left-over run. Phase 7 adds the clip to the variant's track (first free position) when the run ends, also for a resumed run, embeds details in the MP4 through FFmpeg (`details: 'pending'` goes away), and fills the clip row's `width`, `height`, `duration_ms`. The fal.ai Seedance adapter (slice J) must first find out whether fal charges for a status call or fetch: if it does, or that cannot be shown, fal rows are not resumed and end as interrupted. Slice J also says whether a resumed status call counts in `paid_calls`, and how a close treats a fal run that will still be charged (OI-51, OI-60).
- **`export` and `publish`** become background job kinds with the phases that build them (`spec/export-and-checks.md`, `spec/storage-and-publish.md`). `generative_fill` and `translation` become attached kinds with theirs.

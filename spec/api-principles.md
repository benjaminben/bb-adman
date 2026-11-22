# API principles

How commands, queries and events work between the window and the main process; the result shape, every error code and refusal reason with its message, and undo. Read with `spec/api-commands.md` (every command) and `spec/api-queries-events.md` (every query and event). MCP tools and the agent policy rules are in `spec/mcp-and-agents.md`.

The app has no HTTP API of its own. It has two interfaces: the internal interface between the window and the main process, and the MCP tools.

## Channels, actor and scope

Built. `src/main/commands/bus.ts`, `src/main/queries/queries.ts`, `src/main/ipc.ts`, `src/preload/`, `src/shared/schemas/`.

- **Three channels.** `command` changes data. `query` reads data. `event` goes from the main process to the window.
- **One schema set.** Every command, query and MCP tool input is a Zod schema in `src/shared/schemas/`. MCP tool handlers call the same commands as the window.
- **Actor.** Every command carries `actor: 'user' | 'agent'`. It is set in the main process and never taken from the caller. A call from the window always runs as `user`: the IPC handler (`src/main/ipc.ts`) sets it and ignores any actor the page sends. The preload script passes only the name and the input. The MCP server always sets `agent`. Neither side can choose. Queries carry the same actor, set the same way. User-only queries check it: `mcp.getConnectInfo`, `comfy.getInfo`, `job.getServerMessage`.
- **Project scope.** Every command and query that reads or writes a project has `projectId` as a required top-level input field, beside its entity IDs. This holds for every row marked project-scope in `spec/api-commands.md` and `spec/api-queries-events.md`, `history.undo`, `history.redo` and `history.state` included. Reasons: variant, subject and campaign IDs are unique only inside one project (`spec/data-model.md`, "ID formats"); the bus must know which file to open a transaction on before the handler runs; MCP tools already take `project_id`; and a window tab always knows its own project.
  - The bus never searches the open projects. A `projectId` that is not open returns `NOT_FOUND` with `details.reason = 'project_not_open'`. An entity ID that the named project does not hold returns `NOT_FOUND`, even if another open project holds it.
- **One base schema.** `src/shared/schemas/commands/project-scoped.ts` exports the base object `projectScoped = z.object({ projectId: z.string().min(1) })`. Every project-scope command and query schema extends it, so the field has one name, one type and one place.
- **Names.** Commands and queries are `domain.action`. MCP tools are `snake_case`.
- **One `index.ts`** per command domain (`src/main/commands/{domain}/index.ts`), per query domain and per schema domain. `src/main/core.ts` spreads one line per command domain, in alphabetical order.
- **No rate limiting, pagination or versioning** for the internal interface. MCP list tools return at most 500 items and say when more exist.

## How the bus runs a command

Built. `src/main/commands/bus.ts`, `src/main/commands/types.ts`, `src/main/commands/run-in-project.ts`.

Order:

1. **Deny check** (`denyCheck`). For actor `agent`, any policy that is not `allow`, `ask` or `tick` is refused with `AGENT_DENIED` and `denialMessage(name)`. The bus fails closed: an unknown policy value is refused too. Test: `tests/integration/commands/bus-fail-closed.test.ts`.
2. **Find the handler and validate the input.** A name that does not exist is `INVALID_INPUT` "Unknown command: {name}". A failed schema check is `INVALID_INPUT` "Some values are not valid." with `details.issues`.
3. **Find the project** (project-scope commands only).
4. **Gate** (agent runs; Built, `src/main/commands/agent-run-gate.ts`). Runs only for actor `agent` with policy `tick`, before `prepare`. The rules are in `spec/agent-runs.md` and `spec/mcp-and-agents.md`.
5. **Ask** (`askCheck`) for actor `agent` with policy `ask`. A refusal is `AGENT_REFUSED`. Until the permission dialog is built (Phase 10), `src/main/index.ts` passes `askPermission: async () => false`, so every `ask` row is refused for an agent.
6. **Run.**

- **Two-step handlers.** A project-scope handler may have `prepare` and `undoPrepare`. The bus awaits `prepare` outside the transaction, checks the project is still open, runs `run` inside the transaction, and calls `undoPrepare` if `run` throws. When `undoPrepare` throws, the bus writes one `warn` log line ("Clean-up after a failed command did not finish.") and still returns the original error.
- `defineCommand` accepts `internal: true`. An internal command sent from a window is answered exactly as a name that does not exist (`INVALID_INPUT`). `isInternal` is a required field of `IpcTargets` (`src/main/core.ts`), so the IPC edge cannot be built without the check. One test. The job runner and the app's own triggers call the bus directly.
- A handler that changes app state sets `changesAppState`; the bus then emits `app.stateChanged` (`spec/api-queries-events.md`, "Events").
- The bus does not hold other commands back while a `prepare` step runs.

## Result format

Built. `src/shared/schemas/result.ts`.

The same shape internally and over MCP:

```json
{ "ok": true, "data": {} }
```

```json
{
  "ok": false,
  "error": {
    "code": "NEEDS_KEY",
    "message": "Add your Google Gemini key to generate images.",
    "details": { "provider": "gemini" }
  }
}
```

```ts
export const ERROR_CODES = [
  'INVALID_INPUT', 'NOT_FOUND', 'RULE_VIOLATION', 'NEEDS_KEY', 'PROVIDER_ERROR',
  'MISSING_FILE', 'PROJECT_LOCKED', 'AGENT_DENIED', 'AGENT_REFUSED', 'INTERNAL',
] as const
export type ErrorBody = { code: ErrorCode; message: string; details?: Record<string, unknown> }
export type Result<T> = { ok: true; data: T } | { ok: false; error: ErrorBody }
```

A handler throws `AppError(code, message, details?)`; the bus and the query runner turn it into the error body.

## Error codes

| Code | Meaning |
|------|---------|
| `INVALID_INPUT` | The input is wrong whatever the state of the app. A failed schema check is the usual case. The others are in "Choosing a code" below. |
| `NOT_FOUND` | Unknown ID |
| `RULE_VIOLATION` | Breaks a rule, for example deleting a master variant on its own [REQ: FR-073] |
| `NEEDS_KEY` | A key is missing. The window opens the key dialog and retries. [REQ: FR-171] |
| `PROVIDER_ERROR` | Provider failed. `details.kind` is one of `bad_key`, `quota`, `refused`, `timeout`, `offline`, `other`. [REQ: FR-069] |
| `MISSING_FILE` | A linked file cannot be found. Message "A file this project uses cannot be found.", `details.assetIds`. [REQ: FR-009, R-06] |
| `PROJECT_LOCKED` | The project file is open elsewhere. Message "This project is open in another copy of the app." |
| `AGENT_DENIED` | The agent policy is deny. `message` says why: "Agents cannot {action} in this version. Ask the user to do it in the app." (`denialMessage`, `src/main/commands/agent-policy.ts`). The query `thumbnail.get` refuses an agent itself with "Agents cannot read thumbnails in this version. Ask the user to do it in the app." (`src/main/queries/render.ts`). [REQ: workflow 5.7] |
| `AGENT_REFUSED` | The user refused, or did not answer in 120 seconds. Message "The user did not allow this action." [REQ: FR-197] |
| `INTERNAL` | The app failed in a way no other code covers: a bug, a full disk, a failed migration. |

### Choosing a code

Use the first row that fits.

| Situation | Code |
|-----------|------|
| The input is wrong whatever the state of the app: wrong type, bad format, a command or query name that does not exist, a path that is not absolute, a file that is not what the command needs, a provider chosen for a job it does not do | `INVALID_INPUT` |
| An ID or a file path names nothing | `NOT_FOUND` |
| The input is well formed, but the present state of the project or the computer does not allow the action | `RULE_VIOLATION` |
| Anything not foreseen | `INTERNAL` |

A refusal caused by a link on disk is `RULE_VIOLATION`: the input was fine, the state of the computer was not.

## Refusal reasons (`details.reason`)

When the window or an agent has to tell cases of one code apart, the error carries `details.reason`: a fixed snake_case word. The window may branch on `code` and `details.reason`. It never branches on `message`. A phase that adds a case adds a row here.

Built unless marked.

| Case | Code | `details.reason` | Message |
|------|------|------------------|---------|
| The `projectId` is not an open project. `details.projectId` kept. | `NOT_FOUND` | `project_not_open` | "That project is not open." |
| The project file was made by a newer version of the app (`spec/data-rules.md`, "Migration") | `RULE_VIOLATION` | `newer_version` | "This project was made with a newer version of the app. Download the latest version to open it." |
| `project.create`: a file with that name is already in the folder | `RULE_VIOLATION` | `file_exists` | "A file with this name already exists in that folder." |
| `project.open`: another open project has the same `project_id` (a copy made outside the app) | `RULE_VIOLATION` | `duplicate_project` | "A copy of this project is already open. Close it first. To work on both, make the copy with Package project." |
| `project.open`: the file is not an Adman project, or is damaged | `INVALID_INPUT` | `not_a_project` | "This file is not an Adman project, or it is damaged." |
| `secret.set`: this computer cannot store keys securely (Electron `safeStorage` not available) | `RULE_VIOLATION` | `secure_storage_unavailable` | "This computer cannot store keys securely." |
| `brief.parse`: the file or text cannot be read as JSON or YAML | `INVALID_INPUT` | `brief_unreadable` | "The brief is malformed. It could not be read as JSON or YAML." For YAML with a known first bad line: "The brief is malformed. The first line that could not be read is line {n}: {text}" (ends "line {n}." when the text is empty), with `line` and `lineText` in `details`. |
| `brief.parse`: a file path whose name ends in anything but `.json`, `.yaml` or `.yml`, or has no ending | `RULE_VIOLATION` | `brief_type_not_supported` | "This kind of brief file cannot be read yet. Use a JSON or YAML file." |
| `brief.parse`: the file is there but cannot be read | `RULE_VIOLATION` | `file_not_readable` | "That file could not be read." |
| `asset.import`, `asset.relink`: a file is there but cannot be read. The OS error code goes to a `warn` log line only. | `RULE_VIOLATION` | `file_not_readable` | "{file name} could not be read." |
| `asset.remove`; `asset.update` moving an asset into the reference library: a layer, a font, a clip or a rule set uses it | `RULE_VIOLATION` | `asset_in_use` | "This file is in use. Take it off every post and out of every rule set first." |
| `asset.relink`: the new file is not of the asset's kind | `RULE_VIOLATION` | `relink_kind_mismatch` | "Choose a file of the same kind: {kind}." |
| `asset.import`: more than 500 files after folders are opened up | `INVALID_INPUT` | `too_many_files` | "That is too many files for one import. The limit is 500." |
| A managed file is to be written, the assets folder does not exist, and it would lie outside the project file's folder (`spec/assets.md`) | `RULE_VIOLATION` | `assets_folder_missing` | "The assets folder could not be found. Choose the assets folder again." |
| `AssetService.read`, reached through a command that sends a picture to a provider: the file is over the picture byte limit | `RULE_VIOLATION` | `asset_too_large` | "{display name} is too large to send. The limit is 32 MB." |
| The same: the asset is not a picture, its file no longer holds one, or it is a WebP (PNG and JPEG only until slice WP) | `RULE_VIOLATION` | `asset_not_a_picture` | "{display name} is not a picture the app can send." |
| `project.close`: a job is queued or running and the input does not say `runningJobs: 'stop'`. `details.count` holds how many. | `RULE_VIOLATION` | `jobs_running` | "Work is still running in this project. Stop it, or wait for it to finish." |
| `project.setAssetsDir`: a job is queued or running in the project | `RULE_VIOLATION` | `jobs_running` | "Wait for the running work to finish, then change the assets folder." |
| `campaign.delete`: a job for the campaign or one of its variants is queued or running. `details.count` holds how many. | `RULE_VIOLATION` | `jobs_running` | "Work is still running in this campaign. Stop it, or wait for it to finish." |
| `history.undo` / `history.redo`: the list is empty | `RULE_VIOLATION` | `nothing_to_undo` / `nothing_to_redo` | "Nothing to undo." / "Nothing to redo." |
| `job.cancel`: the job is not queued or running | `RULE_VIOLATION` | `job_wrong_state` | "This job has already ended." |
| `job.retry`: the job did not fail and was not cancelled, or its row has no provider | `RULE_VIOLATION` | `job_wrong_state` | "Only a job that failed or was cancelled can be tried again." |
| `job.markSeen`: a named job has not succeeded | `RULE_VIOLATION` | `job_wrong_state` | "Only a job that succeeded can be marked as seen." |
| `job.cancel`: a running background job other than `image_generation` whose provider cannot cancel (`spec/cancel.md`) | `RULE_VIOLATION` | `cancel_not_supported` | "{Provider} cannot stop a request once it is sent." |
| `job.cancel`: a paid request the provider has started and will charge for (P7-13). | `RULE_VIOLATION` | `cancel_would_still_charge` | "{Provider} has started this and will charge for it. The app lets it finish and keeps the result." |
| `settings.update`: an S3 region in China | `INVALID_INPUT` | `storage_not_supported` | "Amazon S3 regions in China are not supported in this build." |
| `settings.update`: a value that is not an Amazon region name | `INVALID_INPUT` | `storage_not_supported` | "That is not an Amazon S3 region. Storage services that copy S3 are not supported in this build." |
| A storage command or `publish.run`: the chosen storage has no settings saved (no bucket or region, or no Dropbox root folder). `details` is `{ reason, provider }`. Built for `storage.checkS3`, `publish.inspect` and `publish.run`. | `RULE_VIOLATION` | `storage_not_set_up` | For S3: "Amazon S3 is not set up yet. Enter a bucket and a region, then try again." |
| `storage.dropboxSignIn` while a sign-in already waits; `storage.dropboxSignOut` while a sign-in waits (P9-5, P9-6) | `RULE_VIOLATION` | `sign_in_in_progress` | "A Dropbox sign-in is already waiting for the browser." (`src/shared/publish/messages.ts`) |
| `storage.dropboxSignIn` while a sign-out runs | `RULE_VIOLATION` | `sign_in_in_progress` | "Adman is signing out of Dropbox. Try again when that has finished." |
| `storage.dropboxSignOut` while another sign-out runs | `RULE_VIOLATION` | `sign_out_in_progress` | "Adman is already signing out of Dropbox." |
| `mcp.setEnabled(true)` or `mcp.regenerateToken` with the setting on: the MCP port is taken | `RULE_VIOLATION` | `port_in_use` | "Port {port} is in use. Choose another." |
| `comfy.setAddress`: the address is wrong (`spec/comfyui.md`, "Address"). Messages in `COMFY_ADDRESS_MESSAGES`, `src/shared/comfy/address.ts`. | `INVALID_INPUT` | `address_empty` | "Enter the address of your ComfyUI server." |
| | `INVALID_INPUT` | `address_unreadable` | "That address cannot be read. Enter it as it is shown, for example http://127.0.0.1:8188." |
| | `INVALID_INPUT` | `address_scheme` | "The address must start with http:// or https://." |
| | `INVALID_INPUT` | `address_credentials` | "The address must not hold a user name or password." |
| | `INVALID_INPUT` | `address_extra` | "Enter only the server address, with no path after it." |
| | `INVALID_INPUT` | `address_host_refused` | "That address cannot be used for a ComfyUI server." |
| `comfy.check`, or a `generation.*` command or `job.retry` for provider `comfyui`, with no address saved. Before any job row. [REQ: FR-255] | `RULE_VIOLATION` | `comfy_address_needed` | "Enter your ComfyUI server's address to use it." |
| A ComfyUI picture run with no offered workflow [REQ: FR-254] | `RULE_VIOLATION` | `comfy_job_not_offered` | "ComfyUI cannot make this kind of picture yet." |
| A ComfyUI video run with no offered workflow for its start pair, or `first_frame` with `useReferences` true | `RULE_VIOLATION` | `comfy_job_not_offered` | "ComfyUI cannot make this kind of video yet." |
| More references than the chosen workflow takes. `details.max`. | `RULE_VIOLATION` | `too_many_references` | "ComfyUI takes one reference picture for this run." when `max` is 1, else "ComfyUI takes at most {max} reference pictures for this run." (`src/shared/providers/messages.ts`) |
| A ComfyUI run, or a retry of one, whose workflow's model needs a commercial licence, with no `licenceConfirmed: true` from the user and the model not in `settings.licenceConfirmed`. `details.workflow`. Checked in `src/main/commands/generation/licence-check.ts`, after the workflow is chosen and before any job row. | `INVALID_INPUT` | `licence_not_confirmed` | "{model} requires a commercial license. Confirm that you have one first." (`src/shared/providers/messages.ts`) |
| A clip longer than the workflow makes. `details.maxMs`. | `RULE_VIOLATION` | `video_too_long` | "ComfyUI makes clips of at most {maxMs / 1000} seconds with this workflow." |
| `generation.startVideo`, `job.retry` of a video: the start picture is not an image asset of type PNG, JPEG or WebP | `RULE_VIOLATION` | `picture_not_usable` | "This picture cannot be used for a video yet. Use a PNG, JPEG or WebP." |
| `agentRuns.setAllowed`: a provider `agentRunsOffered` refuses. | `RULE_VIOLATION` | `agent_runs_not_offered` | "Agents cannot start runs with {Provider}." |
| `layer.delete`, `layer.reorder` naming the background layer | `RULE_VIOLATION` | `background_layer` | "The background layer stays at the bottom and cannot be deleted." |
| A layer command naming an asset in the reference library (`spec/editor-commands.md`) | `RULE_VIOLATION` | `reference_library` | "This file is in the reference library. Move it to the asset library to use it on a post." |
| `layer.restore`: a layer with that ID is anywhere in the project file, or the variant has a layer with that key | `RULE_VIOLATION` | `layer_exists` | "That layer is already there." |
| `variant.render`: the draw failed or timed out | `RULE_VIOLATION` | `render_failed` | "The picture could not be drawn. Try again." |

Not built (Phase 5): the reasons of the variant, direction, sync and fill commands (`not_linked`, `master_changed`, `not_in_campaign`, `too_many_variants`, `variant_exists`, `no_background_picture`, `background_turned`, `background_cropped`, `background_covers`, `fill_outdated`, `not_a_master`, `direction_name_taken`, `last_direction`, `direction_exists`, `master_variant`, and `jobs_running` for a variant or direction) are listed with their messages in `spec/links-and-sync.md`, beside each command, to keep this file within its size. `not_built` is the Phase 5 stub refusal, "This is not built yet.", gone when the last stub is filled.

`brief_too_large` does not exist: a brief has no size limit.

A job's own failure reasons (`job.error_reason`, for example `server_refused`, `missing_items`, `bad_result`) are not command refusals. They are in `spec/providers.md` and `spec/comfyui.md`.

### Refusals with a fixed message and no reason

These carry no `details.reason`; each has one fixed message.

| Command | Code | Message |
|---------|------|---------|
| `subject.create`: the ID is taken | `RULE_VIOLATION` | "A subject with that ID is already in this project." |
| `subject.delete`: a campaign uses it | `RULE_VIOLATION` | "This subject is used by a campaign. Remove it from every campaign first." |
| `campaign.create`, `campaign.update`: a right-to-left language | `RULE_VIOLATION` | "Right-to-left languages are not supported yet." |
| `campaign.update`: `languages` lacks the primary language | `RULE_VIOLATION` | "The campaign's first language cannot be removed." |
| `campaign.update`: `sizes` lacks the master's size | `RULE_VIOLATION` | "The size of the master cannot be removed or changed." |
| `asset.import`: the project changed while files were read | `RULE_VIOLATION` | "The project changed while the files were read. Try again." |
| A job command: the job is not in the project. `details.jobId`. | `NOT_FOUND` | "That job is not in this project." |
| `generation.startVideo`: bad start pair | `INVALID_INPUT` | "Choose one picture for this video." |
| `generation.runImages`: unknown provider or one that cannot make pictures | `INVALID_INPUT` | "That provider cannot make pictures." |
| `generation.startVideo`: provider not available or without `video` | `INVALID_INPUT` | "That provider cannot make videos." |
| `generation.runImages`: a text layer | `INVALID_INPUT` | "Pictures can only be made for a picture layer." |
| `generation.runImages`: a copy slot or an unknown slot | `INVALID_INPUT` | "That slot does not take a picture." |

## What `details` may hold

`details` holds only fixed words (`reason`, `kind`, a shipped ComfyUI workflow ID in `workflow`), IDs (`projectId`, `commandId`, `jobId`, an entity ID, `assetIds`), a provider ID, counts and limits (`count`, `max`, `maxMs`), `line` and `lineText` of a brief, a job kind (`job`), and `issues`. It never holds a file path or a folder path, whatever the command's agent policy is today. Reason: an MCP tool error carries the command's `details` unchanged, and no path may reach an agent. A rule that holds for every error cannot be broken later by changing one policy cell.

- `project.create` `file_exists` has `details = { reason: 'file_exists' }`, no `filePath`.
- `project.open` `NOT_FOUND` (no file at the path) has no `details.filePath`.
- `project_not_open` keeps `details.projectId`: it is the ID the caller sent.
- A `message` may repeat a file name or display name the caller sent, never a full path.
- **`details.issues`.** An `INVALID_INPUT` from a failed schema check carries `details.issues`: a list of sentences, each a field name and a fixed message, for example "name: Enter a name." An issue may name a field or an unknown key the caller sent. It never repeats a value the caller sent, so no path can be in it. Test: a command sent with a path of the wrong type and an unknown key returns issues that hold the field names and not the path text.

## `INTERNAL`

Built. `src/main/commands/bus.ts`, `src/main/queries/queries.ts`, `src/shared/schemas/result.ts`.

The command bus and the query runner catch everything. They never throw to the caller, and the window's call never rejects.

- The reply is `{ ok: false, error: { code: 'INTERNAL', message: 'Something went wrong. The details are in the activity log.', details: { commandId } } }` (`INTERNAL_MESSAGE`, `internalError`). The message is fixed. The thrown error's own text and stack are never in the reply, because they can hold file paths, and no path may reach an agent [REQ: FR-198].
- The log line has `level: 'error'`, `errorKind: 'INTERNAL'`, the same `commandId`, and the error's name, message and stack in `context.error` (`spec/testing.md`, "Logging").
- **Queries.** A query has no command, but its `INTERNAL` reply has the same shape. The query runner makes a ULID for the failed call and puts it in `details.commandId` and in the log line's `context.commandId`. The log line has `event: 'query'` and `name` the query's name. A query that succeeds writes no log line.
- Reasons for a code instead of a rejected call: a caller handles one result shape; an MCP client gets an ordinary tool error with a plain sentence instead of a protocol failure carrying raw text; `history.undo` can put its entry back when the replayed command fails.
- A handler never returns `INTERNAL` on purpose. If a failure can be foreseen, it gets one of the other codes.

`message` is always plain language. Raw provider text never reaches a reply [REQ: FR-069]. For a job it goes to `job.error_detail` only (`spec/jobs.md`). A command that calls a provider with no job row (`storage.checkS3`) logs it, since it has no column.

## `NEEDS_KEY`

Built. `src/main/providers/require-keys.ts`; window half in the key dialog. [REQ: FR-171]

- **Main-process half: one guard.** `requireProviderKeys(deps, providerId, purpose)`. `deps` is the `CoreDeps` object (`spec/structure.md`). It looks up the provider in the registry and checks that every name in its `secrets` list is saved in the secrets store. If one is not, it throws `NEEDS_KEY` with message "Add your {label} key to {purpose}." and `details = { provider: providerId }`. `purpose` is a short phrase from the caller, for example "generate images". The details hold nothing else.
- The guard checks only that the keys are saved. It does not test a key [REQ: FR-172], does not read a key value out to its caller, and does not look at `available`. A provider with an empty `secrets` list, `fake` included, always passes. A provider ID that is not in the registry is a bug in the caller and becomes `INTERNAL`.
- **Who calls it.** Every command or job that is about to call a provider calls the guard first, before any file work and before a job row is made: `generation.runImages`, `generation.startVideo`, `job.retry` (purpose "try this again"), the other `generation.*` commands and their job kinds, `storage.checkS3` ("test the connection"), `publish.inspect` and `publish.run` ("publish"), and the approvals parts ("share approval links"). No other code decides that a key is missing or builds a `NEEDS_KEY` error.
- **Window half.** On `NEEDS_KEY` the window opens the key dialog for `details.provider`, saves what the user types with `secret.set`, and sends the same command again. It learns which secret names the provider needs from `app.getState`.
- **Test.** An integration test with the real registry and secrets store: `gemini` with nothing saved gives `NEEDS_KEY` with `details.provider = 'gemini'`; after `secret.set` of `gemini.apiKey` it passes; `s3` with one of its two secrets saved gives `NEEDS_KEY`; `fake` passes. Through the bus, a test-only command whose handler calls the guard returns an ordinary `{ ok: false }` with code `NEEDS_KEY` (not `INTERNAL`), writes a log line with `errorKind: 'NEEDS_KEY'`, and succeeds when sent again after `secret.set`.

The same retry pattern serves `comfy_address_needed` (the address dialog saves with `comfy.setAddress`, then the command is sent again) and `licence_not_confirmed` (the licence dialog; the command is sent again with `licenceConfirmed: true`), for the three run commands only. Each kind of dialog is asked at most once per call (`src/renderer/stores/app-store.ts`, `run-asks.ts`; `spec/screens-campaign.md`). An agent just gets the refusal.

## Undo and redo

Built for the variant and campaign lists the built commands use. `src/main/commands/history/run-history.ts`, `src/main/history/undo-lists.ts`. [REQ: FR-095, R-17]

Undo scope of each command is in `spec/api-commands.md`: **V** = the variant's list, **C** = the campaign's list, **—** = not undoable.

- `history.undo`, `history.redo` and `history.state` take `projectId` and `scope` (`variant:{id}` or `campaign:{id}`, schema `undoScopeSchema` in `src/shared/schemas/commands/history.ts`). Undo lists are held per project, then per scope. Nothing searches other projects.
- An undo entry is a full command call: name and input, `projectId` included. Undo takes the newest entry and runs it through the bus like any command, so it gets the same validation, transaction, events and log line. The inverse that run returns goes onto the redo list. Redo works the same way in the other direction.
- **A replayed command can be refused.** If it returns any error (`RULE_VIOLATION` from a rule such as the grid test of `spec/data-rules.md`, "Changing a variant's format"; `NOT_FOUND`; `INTERNAL`), nothing in the project changes, the entry goes back to the same place on the list it was taken from, the other list is not touched, and `history.undo` or `history.redo` returns that error. The user can try again once the cause is gone.
- An empty list returns `RULE_VIOLATION` with `details.reason` `nothing_to_undo` or `nothing_to_redo`.
- A new edit in a scope empties that scope's redo list. A replay does not.
- A campaign-scope command that changes a variant clears that variant's undo list. Undoing the campaign entry restores the variant from a snapshot held in the entry (Not built, Phase 5: the handler names the lists in `HandlerResult.clearScopes` and the bus clears them; `spec/links-and-sync.md`, "The campaign undo list").
- Each undo list holds at most 200 entries (`UNDO_LIMIT`). All lists of a project are dropped when it closes [REQ: FR-006].
- Agents are denied `history.undo` and `history.redo`.

# Queries and events (was 4.3, 4.4)

Every query, the native pickers, the computed badges, every event, and the wire row form in which rows leave the main process. Read with `spec/api-principles.md` (actor, scope, errors). Table and column definitions are in `spec/data-model.md`. MCP tools that wrap queries are in `spec/mcp-and-agents.md`.

## Queries (was 4.3)

Built unless marked. Runner `src/main/queries/queries.ts` (`queryTable` merges one map per domain); query functions in `src/main/queries/`; input schemas and reply types in `src/shared/schemas/queries/`.

| Query | Returns | Built |
|-------|---------|-------|
| `app.getState` | `AppState = { settings, recentProjects, openProjects, providers, secrets, devTools }`: settings (no secrets), recent projects, open projects, provider list with availability, secret names with last four characters, and whether the hand-test tools are on. This holds for every secret, `mcp.token` included. No full value is ever in this reply. | Built |
| `mcp.getConnectInfo` | `ConnectInfo` for the Connect panel (below). User only. | Built |
| `project.get` | `ProjectGet = { meta, subjects, campaigns: CampaignSummary[], missingAssetCount }`. `meta` leaves out `assetsDirRel` and `assetsDirAbs`. | Built |
| `asset.list` | `AssetList = Array<AssetRow & { missing: boolean }>`, filtered by library, kind, subject; ordered by `id` ascending (ULIDs: oldest first, stable). The window sorts for display. | Built |
| `campaign.get` | `CampaignGet` (below) | Built |
| `variant.get` | Variant, layers, clips, computed out-of-date detail, latest check result | Not built (Phase 3) |
| `template.list` | `TemplateList = Template[]` | Built |
| `template.slots` | `TemplateSlots = SlotState[]`, `SlotState = { slot, state: 'filled' \| 'empty', candidates: string[] }` (asset IDs), for the slots of the campaign's master [REQ: FR-042]. A picture slot is one whose `slot.type` is not `copy`. | Built |
| `sync.preview` | `SyncPreview[]` for a direction (`spec/data-rules.md`, "Links, follow rules and sync") | Not built (Phase 5) |
| `job.list` | `JobRow[]` for the activity panel, as wire rows, newest first [REQ: FR-152, FR-217] | Built |
| `job.get` | One `JobRow`, or `NOT_FOUND` "That job was not found." | Not built (MCP-D) |
| `job.getServerMessage` | `{ text: string \| null }`: the cleaned server text for a failed ComfyUI job, or null (`spec/comfyui.md`) [REQ: FR-267]. User only. | Built |
| `comfy.getInfo` | Shipped ComfyUI workflow data (below). User only. | Built |
| `project.listOpen` | `{ id, name }[]` for open projects only, never `filePath` | Not built (MCP-D) |
| `report.list` / `report.get` | Saved reports [REQ: FR-151] | Not built (Phase 8) |
| `history.state` | `UndoStateResult = { canUndo, canRedo }` for a scope | Built |
| `publish.inspect` | Whether the campaign's cloud folder already has files [REQ: FR-164], and the component files a publish would upload, each with its full local path [REQ: R-06, 8.4] | Not built (Phase 9) |

Phase 4 adds two queries not yet named: paid generations per campaign, split into pictures and videos, from `job.paid_calls` [REQ: FR-230]; and the earlier options of a layer, listing the assets of earlier runs by `job.layer_id` or `job.slot` [REQ: FR-248, FR-216].

### Query inputs

`app.getState`, `mcp.getConnectInfo`, `comfy.getInfo` and `project.listOpen` are app-scope and take no input. Every other query is project-scope and takes `projectId` (`spec/api-principles.md`) plus:

| Query | Input beside `projectId` |
|-------|--------------------------|
| `project.get` | — |
| `asset.list` | library? (`reference`, `asset`), kind? (`image`, `video`, `font`, `text`), subjectId? |
| `campaign.get` | campaignId |
| `variant.get` | variantId |
| `template.list` | — |
| `template.slots` | campaignId |
| `sync.preview` | directionId |
| `history.state` | scope |
| `job.list` | campaignId?, variantId?, layerId?, state? (`active` = queued or running, `unseen` = succeeded with no `seenAt`, `failed`; left out = all), limit? (positive whole number, default 200) |
| `job.get` | jobId |
| `job.getServerMessage` | jobId |
| `report.list`, `report.get`, `publish.inspect` | Fixed by the phase that builds each (8, 8, 9) |

### Runner rules

- The query runner follows the same rules as the bus: it validates the input, finds the open project, never throws, and returns `INTERNAL` for anything unforeseen (`spec/api-principles.md`, "`INTERNAL`"). A name that does not exist is `INVALID_INPUT` "Unknown query: {name}".
- A query function may be asynchronous; the runner awaits it.
- A query never writes to a project.
- A row that fails its schema when a query reads it means the file was damaged or made by hand: the row is logged (`level: 'error'`, table and row key, no values) and left out of the reply (`spec/security.md`).

### Who may call which query

- **User only:** `mcp.getConnectInfo`, `comfy.getInfo`, `job.getServerMessage`. Each refuses actor `agent` with `AGENT_DENIED`, and no MCP tool calls them. `mcp.getConnectInfo` refuses with "Agents cannot read the agent access settings in this version. Ask the user to do it in the app." (`CONNECT_INFO_DENIED`).
- **Both actors:** `job.get` (the MCP tool cuts the reply down to its allow-list) and `project.listOpen` (policy `allow` for the agent). Which tool wraps which query is in `spec/mcp-and-agents.md`.

### `mcp.getConnectInfo`

Built. `src/main/queries/mcp.ts`, type in `src/shared/schemas/queries/mcp.ts`. [REQ: FR-191, R-10, D-014]

```ts
type ConnectInfo = {
  enabled: boolean
  running: boolean
  problem: 'port_in_use' | 'token_missing' | 'start_failed' | null
  address: string          // http://127.0.0.1:{port}/mcp
  port: number
  token: string | null     // the full MCP access token, or null if none has been made yet
  claudeCode: string | null
}
```

- `claudeCode` is `claude mcp add --transport http adman {address} --header "Authorization: Bearer {token}"`, or null with no token.
- This is the only query, command or event whose reply holds a secret value. The named `mcp.getConnectInfo` test checks that an agent is refused.
- `problem` is null while the setting is off. The meaning of each value is in `spec/mcp-and-agents.md`.
- One setup block until bridge mode. The Claude Desktop block is Not built (Phase 10).

### `comfy.getInfo`

Built. `src/main/queries/comfy.ts`, types in `src/shared/schemas/queries/comfy.ts`. [REQ: FR-253, FR-263, FR-285]

Returns `{ address: string | null, workflows: [{ id, label, job, videoStart?, status, model, needs, size, video?, licence, leavesOnServer }], leavesOnServer: string[] }`. The list is the app's own shipped data, readable before any run. It contacts nothing. The graph, slots and source of a workflow stay in the main process. Field meanings are in `spec/comfyui.md`.

### `job.get`

Not built (MCP-D). Input `{ projectId, jobId }`. Gives one wire row, or `NOT_FOUND` "That job was not found." Open to both actors; the MCP tool `get_job` passes the row through `agentJobView` (`spec/mcp-and-agents.md`). Test: an unknown ID gives `NOT_FOUND`.

### `project.listOpen`

Not built (MCP-D). No input. `{ id, name }[]` for open projects only, never `filePath`. The MCP tool `list_projects` maps to it one to one. Test: the reply holds only `id` and `name`.

## Native pickers: the `dialog.*` queries

Built: `dialog.pickFolder`, `dialog.pickProjectFile`, `dialog.pickFiles`. `src/main/windows/dialogs.ts`, schemas in `src/shared/schemas/queries/dialog.ts`, file types in `src/shared/config/file-types.ts`.

The window is sandboxed and cannot open a file or folder picker, so it asks the main process. This is the one pattern for every picker in the app. Do not add a picker any other way.

| Query | Input | Returns | Used for | Built |
|-------|-------|---------|----------|-------|
| `dialog.pickFolder` | title?, defaultPath? | `{ path: string \| null }` | New project location, default project folder, assets folder (`project.setAssetsDir`), package target (`project.package`), export folder | Built |
| `dialog.pickProjectFile` | defaultPath? | `{ path: string \| null }` | Open project | Built |
| `dialog.pickFiles` | purpose (`import`, `relink` or `brief`), kind? (for `relink`: the asset's kind), multiple? (default true for `import`, false otherwise), defaultPath? | `{ paths: string[] }` | Asset import, relink, brief file | Built |
| `dialog.pickSaveFile` | purpose (`translation-sheet`), defaultPath? | `{ path: string \| null }` | Translation sheet | Not built (Phase 6) |

- A picker only returns paths. It never reads, creates or changes a file. The window passes the path to a command, and the command checks the path as if the user had typed it.
- Cancelling is not an error: the reply is `ok` with `path: null` or `paths: []`.
- The file types a picker offers come from `file-types.ts` by `purpose` and `kind`. `dialog.pickProjectFile` offers `.adman` only. The `brief` picker offers txt, md, json and yaml. No picker has its own list of extensions.
- These queries need Electron, so they live in `src/main/windows/dialogs.ts` and are joined to the query channel in `src/main/index.ts`. They are not part of `core.ts`. The MCP server calls `core` only, so no agent can reach them, and no MCP tool wraps one.
- A new picker is a new `purpose` value where one of the four shapes fits, and a new `dialog.*` query only when none does.
- Each picker's input is a strict Zod schema: an unknown key is refused. An input that fails is `INVALID_INPUT`. No picker checks its input by hand.
- **A picker never rejects.** The `dialog.*` queries do not go through the query runner, so `runDialogQuery` has its own catch: if Electron's dialog call throws, the reply is the fixed `INTERNAL` result with a ULID in `details.commandId`, and one log line with `event: 'query'`.
- **Modal to the asking window.** The IPC handler (`src/main/ipc.ts`) passes the window that sent the call, and the picker is modal to that window. It does not use the focused window or the first window in the list, because from Phase 3 the hidden render window is in that list.

## Computed badges and job marks

Built in part. `src/main/queries/campaign.ts`, `src/main/queries/campaign-reads.ts`. [REQ: 6.1, FR-218]

| Badge | True when | Built |
|-------|-----------|-------|
| `outOfDate` | The rule of `spec/data-rules.md`, "Links, follow rules and sync": not a plain compare of `syncedRevs` and `revs`; it depends on the follow rule of each group and on layer keys the two variants do not share. A master is never out of date. | Always false until Phase 5 puts in the link engine's function |
| `overflow` | Any layer of the variant has `overflow` true | Built |
| `translationUnapproved` | Any layer has `translationStatus` `missing` or `proposed` | Built |
| `checkWarning` | The latest `variant_check` has a `brand-legal` warning and `checked_rev = rev` | False until Phase 6 |
| `checkStale` | `checked_rev < rev`. A variant with no check row has `checkStale: false`. | False until Phase 6 |
| `missingFile` | Any layer's `source.assetId` is in `AssetService.missingAssetIds(project)`; a null source does not count | Built for layer sources. Fonts join in Phase 3, background clips in Phase 7. |
| `jobRunning` | A `job` row with the variant's ID is `queued` or `running` | Built |
| `resultUnseen` | A `job` row with the variant's ID is `succeeded` with `seen_at` null | Built |

- `JobMarks = { jobRunning, resultUnseen }`. `campaign.get` (`marks`) and each `CampaignSummary` in `project.get` carry the same two for the campaign, counted over jobs whose `campaign_id` is the campaign. A job with only `variant_id` does not set the campaign's mark.
- The window keeps the marks current from `job.updated` events. Which of them a tab shows is for the UI pass; Q-042 (other states on tabs) is not decided here.
- `job.list` and the job marks carry `startedBy` and `errorReason` with the rest of `JobRow`.

## The `campaign.get` reply

Built. Query `src/main/queries/campaign.ts` (`campaignQueries` returns exactly `{ 'campaign.get': ... }`; `campaignGet` takes `Pick<CoreDeps, 'projects' | 'assets' | 'log'>`). Types in `src/shared/schemas/queries/campaign.ts`.

Input `{ projectId, campaignId }` (`campaignScopedInput`). A campaign the project does not hold is `NOT_FOUND`; no `campaignId` is `INVALID_INPUT`. Reads `deps.assets.missingAssetIds(project)` once per call. Writes nothing.

```ts
export type JobMarks = { jobRunning: boolean; resultUnseen: boolean }

export type VariantBadges = JobMarks & {
  outOfDate: boolean
  overflow: boolean
  translationUnapproved: boolean
  checkWarning: boolean
  checkStale: boolean
  missingFile: boolean
}

export type VariantSummary = VariantRow & {
  isMaster: boolean
  subjectIds: string[]
  badges: VariantBadges
}

export type CampaignGet = {
  campaign: CampaignRow
  subjects: SubjectRow[]
  ruleSet: RuleSetRow
  directions: DirectionRow[]
  variants: VariantSummary[]
  marks: JobMarks
}

export type CampaignSummary = Pick<
  CampaignRow,
  'id' | 'name' | 'region' | 'primaryLanguage' | 'createdBy' | 'createdAt'
> & JobMarks & { variantCount: number }
```

- `campaign` is the whole wire row, the stored `brief` included. `subjects` are the rows named by `campaign_subject`, by ID. `ruleSet` is the campaign's row; a campaign without one is a broken file and the query answers `INTERNAL`. `directions` are in `sort` order, then by ID.
- `variants` holds every variant of every direction: by the direction's order, the master first inside a direction, then by `createdAt`, then by ID. Each is the whole `VariantRow` (`id`, `directionId`, `title`, `width`, `height`, `sizeLabel`, `language`, `format`, `durationMs`, `durationOverridden`, `rev`, `createdBy`, `createdAt`, `agentChangedAt`). `subjectIds` come from `variant_subject`, by ID.
- `isMaster` is true when the variant's own direction's `masterVariantId` names it. As built it is true when any direction names it; the fix is pending (F-5).
- **No layers.** A variant's layers come from `variant.get` (Phase 3). `template.slots` gives the slots of the master.
- `variantCount` in `CampaignSummary` is the number of variants in all the campaign's directions.
- **Contracts the window imports** (the window imports nothing from `src/main/`): `ProjectGet`, `CampaignSummary`, `CampaignGet`, `VariantSummary`, `VariantBadges` from `src/shared/schemas/queries/campaign.ts`; `BriefParsed` from `src/shared/schemas/commands/brief.ts`; `SubjectCreated` from `src/shared/schemas/commands/subject.ts`; `CampaignCreated` from `src/shared/schemas/commands/campaign-edit.ts`; `BriefDraft`, `Brief` from `src/shared/schemas/brief.ts`; `TemplateSlots` and `SlotState` from `src/shared/templates/types.ts`. The variant list reads `title`, `width`, `height`, `sizeLabel`, `language`, `format`, `isMaster`.

## Events (was 4.4)

Built: `project.changed`, `app.stateChanged`, `job.updated`, `asset.changedOnDisk`. `EventMap` and `EVENT_NAMES` in `src/shared/schemas/events.ts`.

| Event | Payload | Built |
|-------|---------|-------|
| `project.changed` | `ProjectChangedPayload` (below) | Built |
| `job.updated` | The job row, as a `JobRow` wire row. Carries no separate project ID. | Built |
| `asset.changedOnDisk` | `{ projectId, assetIds }`: the linked assets whose content changed outside the app. Sent after `asset.checkChanged` succeeds with a non-empty list. The signal to draw those pictures again; thumbnails are Phase 3. | Built |
| `app.stateChanged` | Empty (`Record<string, never>`). Something `app.getState` returns has changed: a project was opened or closed, settings changed, a key was saved or deleted, or agent access changed. Each window reads `app.getState` again. | Built |
| `agent.permissionRequested` | requestId, tool, target summary, expiresAt | Not built (Phase 10) |
| `agent.activity` | Tool name and target, for a "the agent is working" indicator | Not built (Phase 10) |
| `mcp.status` | enabled, port, connected client names | Not built (Phase 10) |

- `app.stateChanged` exists because not every change starts in the window that needs to hear of it. A project opened by double-click starts in the operating system, and an agent access change can start in another window.
- The event carries no data on purpose. `app.getState` stays the one source of that state, and no secret detail can leak through an event.
- A command handler says it changes app state with one flag (`changesAppState`), and the bus emits the event after the command succeeds. Handlers do not emit it themselves. Built handlers with the flag: `project.create`, `project.open`, `project.close`, `settings.update`, `secret.set`, `secret.delete`, `mcp.setEnabled`, `mcp.regenerateToken`, `comfy.setAddress`.
- An MCP port taken at start sets `ConnectInfo.problem`; it sends no new event.
- Every event goes to every window. A window ignores a `project.changed` for a project it does not show.
- Events go to windows only. No event is passed on to an agent. MCP replies are built from queries.
- `job` rows are the one exception to "rows reach the window through `project.changed`": the job runner writes them and emits `job.updated` after every write to a job row (`spec/jobs.md`). An event for a project the window does not know yet may be dropped; the window reads `job.list` after an open.

### `project.changed`

Built. Change recorder `src/main/commands/change-recorder.ts`, bus `src/main/commands/bus.ts`.

```ts
type ProjectChangedPayload = {
  projectId: string
  actor: 'user' | 'agent'
  changed: { [table in TableName]?: WireRow[] }   // whole rows, as stored after the command
  removed: { [table in TableName]?: string[] }    // row keys
}
```

- One event for each command that succeeded and changed the project. It describes the difference between the project file before the command and after it. A command that changed nothing emits no event.
- `changed[table]` holds every row the command added or updated, each the whole row as stored after the command, never a part of a row.
- `removed[table]` holds the row key of every row that is gone.
- A row is in an event at most once, and never in both lists. A table with nothing to report is left out.
- **Rows SQLite changed by itself count.** A delete that cascades (`ON DELETE CASCADE`) removes child rows, and `ON DELETE SET NULL` updates rows (deleting a subject clears `asset.subject_id`). The event names every one of them. The handler reads the keys of those rows before it deletes.
- A change to a variant's layers or clips bumps `variant.rev` (`spec/data-rules.md`), so that `variant` row is in `changed` too.
- **How the event is built.** A handler does not hand rows to the bus. It names them: `ctx.changes.touch(table, key)`, where `key` is an object holding the key fields (a whole row is accepted). When `run` returns, still inside the transaction, the bus reads every named row through `rows.ts`. A row that is there goes to `changed`; a row that is not goes to `removed`. So the event always shows what is really stored.
- `ctx.changes` exists only for project-scope handlers. An app-scope handler has no project to change.
- **A row that fails its schema** in the read after `run` means the command wrote a bad value: the bus throws, the transaction rolls back and the result is `INTERNAL`. So no command can save a row the app cannot read. A looser second schema for the same value is not allowed.
- **Test.** `tests/integration/expect-changes.ts` copies every table before and after a command and compares the difference with the event: same rows changed, same rows removed, each changed row equal to the stored row in wire form. The success test of every project-scope command uses it (`spec/testing.md`).

## Wire rows

Built. `src/main/db/rows.ts`, `src/shared/schemas/rows/`.

One form for a row everywhere it leaves the main process: in `project.changed`, in `job.updated` and in every query reply that returns rows.

| Part | Rule |
|------|------|
| Table name | The SQL name (`spec/data-model.md`), snake_case: `campaign_subject`, `rule_set`. `TableName` is the set of the 14 names. |
| Field name | The column name in camelCase: `variant_id` is `variantId`, `font_publish_allowed` is `fontPublishAllowed`. These are the property names of the Drizzle schema. No snake_case field name is ever on the wire. |
| JSON column | The parsed value, checked with its Zod schema (`spec/data-model.md`). Never a string of JSON. |
| Flag column (`font_publish_allowed`, `duration_overridden`, `visible`, `locked`, `linked`, `overflow`) | `true` or `false`, not 1 or 0 |
| Empty column | `null`. A field is never left out. |
| Main-only column | `job.error_detail` is the only one. It is never in a wire row. `rows.ts` holds the one list of main-only columns (table name to column names) and drops them when it builds a wire row; `JobRow` has no such field. Writing the column goes through `rows.ts` like any other. Reading it is one function, `readJobErrorDetail(db, jobId)`, which gives the text or null. Only main-process code calls it, and no query returns its value. Test: a job row stored with an error detail comes back from `readWireRow` without that field. |
| Everything else | As stored: text as a string, numbers as numbers, timestamps as ISO 8601 text |
| `project_meta` | `{ key, value }`, both text as stored. `key` keeps its stored name (`assets_dir_rel`), because it is data and not a field name. |

### Row keys

A row is identified by its table and its key fields. The row key text is the values of the key fields joined with `/`, in the order below. No ID format can hold a `/` (`spec/data-model.md`, "ID formats").

| Table | Key fields | Row key example |
|-------|------------|-----------------|
| `subject`, `asset`, `campaign`, `direction`, `variant`, `layer`, `background_clip`, `job`, `report` | `id` | `k3f9q2` |
| `project_meta` | `key` | `assets_dir_rel` |
| `rule_set` | `campaignId` | `summer-splash-k3f9q2` |
| `variant_check` | `variantId` | `k3f9q2` |
| `campaign_subject` | `campaignId`, `subjectId` | `summer-splash-k3f9q2/bottle-1` |
| `variant_subject` | `variantId`, `subjectId` | `k3f9q2/bottle-1` |

### One owner for each part

| What | Where | Rule |
|------|-------|------|
| Table names, key fields, row key text | `src/shared/schemas/rows/keys.ts` | Exports `ROW_KEYS` (table name to its key fields, all 14 tables), the `TableName` type, and `rowKey(table, row)`. Nothing else joins key fields or guesses which field is the key. |
| Wire row schemas | `src/shared/schemas/rows/` (`ROW_SCHEMAS`) | One Zod schema per table, named after the table: `SubjectRow`, `AssetRow`, `CampaignSubjectRow`, `JobRow`. They reuse the JSON column schemas (`layer.ts`, `brief.ts`, `commands/campaign.ts`). Built for the ten tables Phase 2 writes and `job`. `variant_check`, `background_clip` and `report` are added by Phases 6, 7 and 8, on `main` before that phase's work splits. |
| Stored row to wire row, and back | `src/main/db/rows.ts` | The only code that converts in either direction, and the only code that parses or builds the JSON text of a column. A handler or query never calls `JSON.parse` or `JSON.stringify` on a column and never renames a field. The building half is one pure function, `storedJson(table, field, value)`: it gives the text to store for a JSON column, or null for null. It writes nothing, so `rows.ts` has no write functions. Code that writes a JSON column with SQL or through `project.orm` gets the text from it. |

- `readWireRows` leaves out a row that fails its schema; `readWireRow` throws.
- **The Drizzle schema files** may give a JSON column or a flag column a typed mode, as long as drizzle-kit then reports no difference from migration `0000`. This changes no SQL and needs no migration. The Zod check in `rows.ts` is required either way.
- **The window store** (`src/renderer/stores/project-store.ts`) keeps `tables[table][rowKey]`. It gets the key from `rowKey` and from nowhere else.

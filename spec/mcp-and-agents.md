# MCP and agents

How an outside agent (an MCP client such as Claude Code) reaches the app: the MCP server, its token, bridge mode, every MCP tool, the permissions of each actor and the agent policy table. Runs an agent starts (the tick, the gate, the limit) are in `spec/agent-runs.md`. Read with `spec/api-principles.md` (the bus, errors, actors), `spec/api-commands.md` (the commands the tools run) and `spec/cancel.md` (what cancel does). Security rules in general are in `spec/security.md`.

## Status on `main`

- **Built:** the server (`src/main/mcp/`), the token, the request checks, the on and off switch, the port, the Connect panel with one block, the Settings section "Agent access (MCP)", 11 tools (`list_projects`, `get_project`, `list_assets`, `get_campaign`, `create_campaign`, `get_slots`, `get_job`, `list_jobs`, `generate_images`, `generate_video`, `cancel_job`), the agent policy table with the `tick` value, the fail-closed bus, and agent runs: the gate, the tick, the limit, the untick check and the Settings block "Agent runs" (`spec/agent-runs.md`).
- **Not built (Phase 10):** bridge mode, the Claude Desktop block, the ask flow, the delete tools, `agent.activity`, and the other tools of "MCP tools" below.

## The MCP server

Built. `src/main/mcp/server.ts`, `service.ts`, `request-guard.ts`, `sessions.ts`, `serial.ts`, `agent-caller.ts`. MCP TypeScript SDK pinned exactly: `@modelcontextprotocol/sdk` `1.32.2`.
**Direction:** inbound. **Protocol:** MCP, Streamable HTTP. **Authentication:** bearer token. [REQ: FR-190, FR-191, IR-003, R-04]

- **Endpoint:** `http://127.0.0.1:{mcp.port}/mcp`. Default port 47821 (`DEFAULT_MCP_PORT`, `src/main/settings/defaults.ts`). Any other path gets 404.
- **Setting:** `mcp: { enabled: false, port, autoApproveDestructive: false }`, port 1024 to 65535. The server starts only while `settings.mcp.enabled` is true. It is off on first run [REQ: FR-191]. `settings.update` cannot change `mcp.enabled`.
- It binds to `127.0.0.1` only, never `0.0.0.0` (a test shows it is not on `::1` or any other address of the computer).
- **Request checks, in this order** (`request-guard.ts`). A refused request reaches no session and no command. No reply names a header value or says anything about the token.

  | Check | Refusal |
  |-------|---------|
  | Any `Origin` header | 403 "Requests from web pages are not accepted." |
  | `Host` other than `127.0.0.1:{port}` or `localhost:{port}` | 403 "This address is not accepted." |
  | Missing or wrong token | 401 "A valid access token is needed." |

  The first two stop web pages and DNS rebinding.
- **Actor.** Every request runs as actor `agent`, set by the server through the agent caller. No header, input or tool argument can change it (unknown keys, an actor among them, are dropped by the parse). Agent policy is enforced in core (the bus and each query), not in the server. The MCP server has no other path to data.
- **Commands** (both `deny` for an agent, "change agent access"): `mcp.setEnabled { enabled }` and `mcp.regenerateToken {}`, app scope, both set `changesAppState`. Neither reply holds the token. **Query:** `mcp.getConnectInfo`, user only, the only reply that holds a secret.
- `ConnectInfo` (`src/shared/schemas/queries/mcp.ts`): `enabled`, `running`, `problem: 'port_in_use' | 'token_missing' | 'start_failed' | null`, `address`, `port`, `token: string | null`, `claudeCode: string | null`. `problem` is null while the setting is off. `start_failed` is a start that failed for any reason other than a taken port while the setting is on. No Claude Desktop field until bridge mode (Phase 10).
- **Turning on.** `mcp.setEnabled(true)` makes a token if none exists, then listens, and saves the setting only once the server is listening. On a taken port it leaves the setting as it was and returns `RULE_VIOLATION`, `details.reason` `port_in_use`, "Port {port} is in use. Choose another." (`portInUseMessage`).
- **Port taken at app start or on a port change** (setting already on): `settings.mcp.enabled` stays true; `running: false`, `problem: 'port_in_use'`. It tries again at the next start, on a port change, or on `mcp.setEnabled(true)`. No event for this.
- **Setting on, no token** (at app start): the app never makes a token on its own here. The server stays off with a warn log line (no token in it); `running: false`, `problem: 'token_missing'`, `token: null`.
- **Port change while running** (`settings.update` of `mcp.port`): close the listener, drop open sessions, listen on the new port. `settings.update` is not refused; the port is saved either way. A port change never throws.
- **New token.** `mcp.regenerateToken` saves a new token and, if the setting is on, closes the listener, drops every session and listens again with the new token. With the port taken it keeps the new token and replies `RULE_VIOLATION` / `port_in_use`. The screen fetches `getConnectInfo` again after.
- **Turning off**, or a new token, closes the listener and drops open sessions. `stop()` always closes the socket (`try`/`finally`), even if a session close fails. Start, stop, new token and port change run one at a time through `createSerial()`.

### Bridge mode

Not built (Phase 10).

- `"{app executable}" --mcp-bridge` speaks MCP over stdio and forwards to the endpoint.
- It opens no window and does not take the single-instance lock. It reads the port and token from the app data folder, then relays MCP messages between stdio and the HTTP endpoint.
- If the app is not running or the server is off, it answers every request with "Open the app and turn on agent access in Settings."
- `mcp.getConnectInfo` gains a Claude Desktop field, and the Connect panel a second block: a JSON entry with `command` set to the app executable path and `args` set to `["--mcp-bridge"]`.
- To check first, in Phase 10: how the current Claude Desktop connects to local servers. If it can reach `http://127.0.0.1` with a header directly, bridge mode is dropped.

### Connect panel

Built with one block. `src/renderer/screens/settings/mcp-section/`, `connect-panel/`.

- Content comes only from `mcp.getConnectInfo`. The token may be shown in full [D-014].
- The block to copy, for Claude Code: `claude mcp add --transport http adman http://127.0.0.1:{port}/mcp --header "Authorization: Bearer {token}"`. The user copies it into the agent. An agent never reads the token any other way.
- The Settings section "Agent access (MCP)": the switch, the port, the Connect panel. Its wording is in `spec/screens.md`. The Copy button uses `navigator.clipboard.writeText` in the renderer on click only: no preload, IPC, CSP or permission-handler change. A permission handler added later must allow `clipboard-sanitized-write`. On failure: "Copy did not work. Select the line and copy it." Nothing about the token is logged.

## Token and sessions

Built. `src/main/mcp/token.ts`, `service.ts`, `sessions.ts`.

- **User:** no sign-in. The app is single-user [REQ: 8.4]. **Agent:** bearer token, `Authorization: Bearer {token}`.
- Token: opaque, 32 random bytes in base64url (`makeToken`), no expiry, replaced on demand ("Make a new token"; connected agents are dropped).
- Storage: `secrets.bin` as `mcp.token`, encrypted with Electron `safeStorage` (Keychain on macOS, DPAPI on Windows).
- Comparison: constant time. Both sides are hashed with SHA-256 first, so the time does not depend on the length sent (`bearerMatches`).
- Viewing: the token is for use on the same computer, so the user may see it in full in the Connect panel [D-014]. It reaches the window only as the reply to `mcp.getConnectInfo`. The window keeps it in the Connect panel's own state while the panel is open. It is never put in a zustand store, sent in any event, or written to a log line, error, tool reply, test output, report, project file or `settings.json`.
- After "Make a new token" the panel calls `mcp.getConnectInfo` again to show the new one.
- Sessions: MCP session IDs are held in memory and dropped when the server is turned off, the token is replaced, the port changes, or the app quits.

## MCP tools

### Rules for every tool

Built for the 11 tools that exist; every future tool follows them.

- Every tool that takes a `project_id` works only on projects open in the app [REQ: FR-201].
- **Inputs.** A tool's input is its command's or query's own Zod schema, with top-level keys in snake_case and nested keys as the command has them (camelCase). That schema is the one owner. `project_id` reaches the command as `projectId`. Arguments that do not match the published input schema get the MCP SDK's own validation error before any command runs.
- **Replies.** A reply is one MCP text content item holding JSON. A tool error is the command's own `code`, `message` and `details`, `INTERNAL` included, as an MCP tool error (`isError: true`).
- **Every reply goes through an allow-list picker** in `src/main/mcp/tools/` (`read-replies.ts`, `project-replies.ts`, `agent-job-view.ts`). Each picker names every field it returns, so a field added to a row later cannot leave without a change there. No reply passes a whole row through. Query targets are pinned to an allowed list (`tools/table.ts`); a tool name is never used as a command or query name. Still open: `create_campaign` runs a command, and its reply has no picker yet.
- **What a reply to an agent may never hold** [REQ: FR-198]: file contents; file or folder paths; settings; keys; the MCP access token (the agent sends it on each request, and no reply ever contains it); the ComfyUI address; a tick or the limit; the server's own words. Display names of assets may appear (`list_assets` gives them); a path may not. A file-system error is not an `AppError`, so the bus returns the fixed `INTERNAL` reply with no error text.
- **Tool descriptions.** Every tool that starts a run, and every tool that puts an asset on a layer, carries this sentence (final words are owned by the slice that builds the tool): "A run you start makes options for the user to choose from. Leave the choice to the user unless they asked you to choose." [D-059 item 5]. No command refuses an agent's pick.

### The tool table

25 tools, 11 built. Policy is the agent policy of the command the tool runs (see 'Agent policy table').

| Tool | Runs | Input | Output | Policy | Status | Requirements |
|------|------|-------|--------|--------|--------|--------------|
| `list_projects` | query `project.listOpen` | — | Open projects: `id`, `name` | allow | Built | FR-192, FR-201 |
| `get_project` | query `project.get` | project_id | Project meta, subjects, campaign summaries, missing asset count | allow | Built | FR-192 |
| `list_subjects` | a subject list (query named in Phase 10) | project_id | id, name, description, attached asset IDs | allow | Not built (Phase 10) | FR-192 |
| `list_assets` | query `asset.list` | project_id, library?, kind?, subject_id? | id, display name, kind, library, subject ID, width, height, duration, font family | allow | Built | R-11 |
| `get_campaign` | query `campaign.get` | project_id, campaign_id | Campaign fields, rule set, directions, variant summaries with badges | allow | Built | FR-192 |
| `get_variant` | query `variant.get` | project_id, variant_id | Variant, layers (all values), clips, out-of-date detail | allow | Not built (Phase 10) | FR-192 |
| `render_variant` | the render service (no command) | project_id, variant_id, time_ms? (default 0), max_dimension? (default 1024, max 2048), hide_text? | One PNG image | allow | Not built (Phase 10; calls the built `variant.render`) | FR-193 |
| `create_campaign` | command `campaign.create` | The command's input as built: project_id, brief (`spec/brief-and-templates.md`), subject_map, sizes, languages, template_id, rule_set?, copy_rule_set_from? | campaign_id, master variant_id (and direction_id) | allow | Built | FR-195, R-01 |
| `add_variant` | command `variant.add` | project_id, direction_id, size_label, language, format | variant_id | allow | Not built (Phase 10) | FR-195 |
| `set_variant_format` | command `variant.setFormat` | project_id, variant_id, format (`image` or `video`) | variant_id, format | allow | Not built (Phase 10) | R-20, D-025 |
| `create_layer` | command `layer.create` | project_id, variant_id, type (`text` or `image`), copy?, asset_id?, geometry, style?, timing?, animation? | layer_id | allow | Not built (Phase 10) | FR-194 |
| `update_layer` | command `layer.update` | project_id, layer_id, any of copy, geometry, style, asset_id, timing, animation, visible, name | Updated layer | allow | Not built (Phase 10) | FR-194 |
| `delete_layer` | command `layer.delete` | project_id, layer_id | — | allow | Not built (Phase 10) | FR-197 notes |
| `reorder_layers` | command `layer.reorder` | project_id, variant_id, layer_ids | — | allow | Not built (Phase 10) | FR-194 |
| `set_translation` | command `translation.set` | project_id, layer_id, text, apply_to_same_language? | Updated layer, status `proposed` | allow | Not built (Phase 10) | FR-194, FR-200 |
| `run_checks` | command `check.run` | project_id, campaign_id or variant_ids | Check results | allow | Not built (Phase 10) | FR-196 |
| `get_check_results` | the latest check results (query named in Phase 10) | project_id, campaign_id | Latest results per variant | allow | Not built (Phase 10) | FR-196 |
| `delete_variant` | command `variant.delete` | project_id, variant_id | — | ask | Not built (Phase 10) | FR-197 |
| `delete_campaign` | command `campaign.delete` | project_id, campaign_id | — | ask | Not built (Phase 10) | FR-197 |
| `get_slots` | query `template.slots` | project_id, campaign_id | Per slot of the master variant: `slotId`, `type`, `state` (`filled` or `empty`), `candidates` (asset IDs) | allow | Built | FR-192, D-080 |
| `generate_images` | command `generation.runImages` | The command's input as built: project_id, variant_id, slot or layer_id, prompt, reference_asset_ids, count, provider | `{ jobId }` | tick | Built | FR-062, FR-279, D-080 |
| `generate_video` | command `generation.startVideo` | The command's input as built: project_id, variant_id, prompt, duration_ms, provider, start, use_references, reference_asset_ids | `{ jobId }` | tick | Built | FR-262, FR-279, D-080 |
| `get_job` | query `job.get` | project_id, job_id | The job view (below) | allow | Built | FR-279, D-080 |
| `list_jobs` | query `job.list` | project_id, campaign_id?, variant_id?, state?, limit? | The job view per job, newest first | allow | Built | FR-279, D-080 |
| `cancel_job` | command `job.cancel` | project_id, job_id | `{ jobId }` | tick (own runs only) | Built | FR-281, D-080 |

Each new tool maps one to one to its command or query, with an allow-list reply picker, and the tool-list snapshot is updated.

### Notes on single tools

- **`list_projects`.** Query `project.listOpen`: `{ id, name }[]` for open projects only, never `filePath`. Agent policy allow. `app.getState.openProjects` is not wrapped, since it carries `filePath`.
- **`get_project`, `get_campaign`.** Allow-list pickers over today's fields (`projectFields`, `campaignFields` in `tools/project-replies.ts`), so a field added later to a campaign, variant, subject, rule set or direction row (a path, say) cannot leave. Whether `get_project` keeps `meta` and `missingAssetCount` is LP-7 (`spec/phases/review-leftovers.md`).
- **`list_assets`.** Cut to the nine fields above by an allow-list (`assetFields` in `tools/read-replies.ts`), so no file path is returned.
- **`create_campaign`.** OI-25 is open: whether, when the agent sends no sizes or languages, the tool falls back to the brief's own values, then the three default sizes and the region table's language, or requires both. Phase 10 builds the fallback unless told otherwise.
- **`get_slots`** reads `template.slots` (`src/main/queries/template.ts`) for the campaign's master variant, from `slot.id`, `slot.type`, the slot's state and its candidate asset IDs.
- **`get_job` and `list_jobs`.** `get_job` runs query `job.get` (a job ID unknown in the project gives `NOT_FOUND` "That job was not found."); `list_jobs` runs over `job.list` (`src/main/queries/job.ts`). `list_jobs` leaves out the `layer_id` filter of `job.list` on purpose. The `get_job` description tells the agent to poll no more than once every 5 seconds. Both replies are built by `agentJobView(row, providers)` in `src/main/mcp/tools/agent-job-view.ts`, which names every field an agent sees of a job:
  - `id`, `kind`, `status`, `startedBy`, `campaignId`, `variantId`, `layerId`, `slot`, `progress`, `paidCalls`, `seenAt`, `errorKind`, `errorReason`, `createdAt`, `updatedAt`;
  - `stage` and `queuePosition` from `result`, only when a string and a whole number; otherwise left out;
  - `assetIds`: `result.assetIds` for a picture job, `[result.assetId]` for a video job, else `[]`, strings only;
  - `failures` for a picture job only: known error kind to count;
  - `message`: for an `errorReason`, the `reasonMessage` sentence with `{address}` replaced by "the saved ComfyUI address" and `{n}` by "some"; else for an `errorKind`, `plainMessage(kind, provider label)`, where a provider this build does not list is called "The provider"; else null.
  - Left out: `provider`, `model`, `remoteJobId`, `request`, and the rest of `result`. A failed run is reported to the agent in the app's own words.
- **`generate_images`, `generate_video`** (`src/main/mcp/tools/run-tools.ts`). Reply `{ jobId }` only, through the picker `jobIdOnly`. Refusals pass through as the command gives them; the full set, `licence_not_confirmed` (not built, S2-4) included, is in `spec/agent-runs.md`, 'After the gate'. The two start tools run one at a time through one `createSerial()` (`src/main/mcp/serial.ts`), made when `toolSetup` is called and shared by every session (`oneAtATime` on the tool definition); the bus is not changed for this. A tool's published input schema does not carry the "slot or layer, not both" rule; the command enforces it. The tools register no output schema. Descriptions say: the run makes options for the user to choose from, so leave the choice to the user unless asked; `provider` is `comfyui` (the user's own ComfyUI server, no charge) or `gemini` (pictures only; paid, charged to the user's Google account with no click); runs are refused unless the user allowed agents for that provider in Adman's Settings. `generate_video`'s description names the three starts (from a prompt, from a first-frame picture, with a reference picture; the shapes are in `spec/api-commands.md`) and says a picture is named by an asset ID from `list_assets`.
- **`cancel_job`.** Only a run the agent started (`spec/agent-runs.md`, 'Gate steps for a run'). Reply `{ jobId }` through `jobIdOnly`. Not run one at a time.
- **`render_variant` writes no file** [REQ: FR-193, D-030]. The picture goes back to the agent inside the tool reply and nowhere else.
  - The reply is one MCP image content item: the PNG bytes in base64 with the type `image/png`. It holds no path and no address (not an `adman-asset://` address either).
  - The picture is made in memory from start to finish. The render service draws the variant in the hidden window, captures it, scales it to `max_dimension` and turns it into PNG bytes with `nativeImage.toPNG()`. No step writes it to disk: not to an export folder, the assets folder, the app data folder, or the system's temporary folder, not even for a moment.
  - It creates no `asset` row, no `job` row and no report, does not change the project, and emits no `project.changed`.
  - The log line for the call holds the tool name, the IDs and the picture's width and height, not the picture.
  - The render service function this tool calls takes no file path and returns bytes. Image export (`spec/export-and-checks.md`) is a different caller, and it is the one that writes a file.
  - Named test in `spec/testing.md`.
- **`run_checks`** runs all six checks (`spec/export-and-checks.md`): the four brand and legal checks FR-196 names, and the two readiness checks [REQ: FR-116]. The readiness results come from translation status and overflow values the agent can already read through `get_variant`.
- **`delete_campaign`** asks for permission for every campaign, including one the agent created [D-023].
- **`set_variant_format`** runs `variant.setFormat` in either direction with no permission dialog [D-025]. Same rules as for the user: the grid test can refuse it with `RULE_VIOLATION`, and the user can undo it from the variant's list. An agent can also choose a format when it adds a variant. The agent has no clip tools, so on a video variant it changes layer timing and animation only.
- **`add_variant`** by an agent creates the variant as one fan-out cell (`spec/data-rules.md`) with background fit `scale` and no translation job. Text layers in another language get `translation_status = 'missing'` until the agent or the user supplies text.
- **Picture and clip bytes.** No tool returns the bytes of a picture or clip an agent made (OI-92: whether a `view_asset` tool for generated pictures should exist; to be judged with `spec/agent-runs.md`, 'Paid runs and spending', linked assets). `render_variant` is the only image reply.

### Ask flow

Not built (Phase 10). No `ask` tool exists until the delete tools land. [REQ: FR-197]

1. The server emits `agent.permissionRequested`. The window shows a dialog naming the agent, the action and the target.
2. The tool call waits up to 120 seconds.
3. Allow runs the command (the window answers with `agent.answerPermission`, `deny` for an agent). Refuse or timeout returns `AGENT_REFUSED`.
4. If `settings.mcp.autoApproveDestructive` is true, step 1 is skipped and the action is logged as auto-approved.

`agent.activity` (the event that tells the window what agents did) is also Phase 10.

### Refusals

A request for something not offered returns `AGENT_DENIED` with `denialMessage(name)`: "Agents cannot {action} in this version. Ask the user to do it in the app.", for example "Agents cannot export in this version. Ask the user to do it in the app." [REQ: workflow 5.7]. `{action}` is the action text of the command's row in the policy table. A command not in the table gets "do this".

## Permissions

Policy-based, with two actors.

| Role | Description | Permissions summary |
|------|-------------|---------------------|
| Creative User | The person at the computer | Everything |
| External Agent | An MCP client with the token | Only commands whose agent policy is `allow`, `ask` or `tick` (under the gate) |

| Permission | Creative User | External Agent |
|------------|---------------|----------------|
| Read open projects, variants, layers, rule sets, asset names | ✓ | ✓ |
| Render a picture of a variant | ✓ | ✓ |
| Create, edit, delete, reorder layers | ✓ | ✓ |
| Set translations | ✓ | ✓ (always unapproved) |
| Approve translations | ✓ | ✗ |
| Create a campaign, add a variant | ✓ | ✓ |
| Change a variant's format, either direction | ✓ | ✓ |
| Run checks | ✓ | ✓ |
| Delete a variant or campaign | ✓ | With the user's permission, for every campaign and variant |
| Fan-out, sync, undo | ✓ | ✗ |
| Picture and video generation | ✓ | ✓ through the MCP server, on every provider the app offers for the job (today ComfyUI and Gemini), and on `trial` ComfyUI workflows while dev tools are on, only for a provider the user ticked, within the limit [D-080]. |
| AI layout and copy suggestions | ✓ | Under the Gemini tick, when Phase 4 builds them |
| Cancel a run | ✓ where the provider can stop it | Only a run an agent started (all agent clients are one actor); no tick needed. |
| Retry a run; mark a result seen; read the server's own words | ✓ | ✗ |
| Export, publish | ✓ | ✗ |
| Import files, add pictures from disk | ✓ | ✗ (OI-93) |
| Subjects, assets, rule sets, settings | ✓ | ✗ |
| The ComfyUI address; the agent ticks; the agent run limit | Set, change, remove, view | ✗ never: not read, not set |
| Provider and storage keys | Set, replace, delete. Never view. | ✗ never |
| MCP access token | View and copy in the Connect panel. Replace. | ✗ No tool returns it or changes it. |

Enforcement is in the command bus, before the handler runs, and in each query.

## Agent policy table

Built. `src/main/commands/agent-policy.ts` is the single owner [ADR-009]. Allowing a deferred ability later is a change to this table only. `tests/unit/main/commands/agent-policy-table.test.ts` compares the whole table ("and nothing else").

`AgentPolicy` is `'allow' | 'ask' | 'deny' | 'tick'`. Each row has a policy and an action text for `denialMessage`.

| Policy | Commands |
|--------|----------|
| `allow` | `campaign.create`, `variant.add`, `variant.update`, `variant.setFormat` [D-025], `layer.create`, `layer.update`, `layer.delete`, `layer.reorder`, `translation.set`, `check.run` |
| `ask` | `campaign.delete`, `variant.delete` |
| `tick` | `generation.runImages`, `generation.runFill`, `generation.startVideo`, `job.cancel` |
| `deny` | `project.create`, `project.open`, `project.close`, `project.setAssetsDir`, `project.package`, `subject.create`, `subject.update`, `subject.delete`, `asset.import`, `asset.update`, `asset.relink`, `asset.remove`, `asset.addGenerated`, `asset.checkChanged`, `brief.parse`, `campaign.update`, `ruleSet.update`, `ruleSet.copyFrom`, `direction.createFromMaster`, `direction.rename`, `direction.delete`, `variant.fanOut`, `layer.clearOverride`, `layer.reportOverflow`, `clip.add`, `clip.update`, `clip.remove`, `translation.propose`, `translation.approve`, `translation.exportSheet`, `sync.apply`, `generation.proposeLayout`, `generation.copyOptions`, `job.retry`, `job.markSeen`, `export.run`, `publish.run`, `history.undo`, `history.redo`, `settings.update`, `secret.set`, `secret.delete`, `storage.dropboxSignIn`, `storage.dropboxSignOut`, `dev.storage`, `mcp.setEnabled`, `mcp.regenerateToken`, `agent.answerPermission`, `comfy.setAddress`, `comfy.check`, `agentRuns.setAllowed`, `agentRuns.setLimit`, `dev.comfyExtend` |

- A command not in the table is `deny`.
- Not built (Phase 4): `generation.proposeLayout` and `generation.copyOptions` become `tick` under the Gemini tick when Phase 4 builds them.
- `job.retry` stays `deny` (it re-sends a stored request). `job.markSeen` stays `deny`: picking a result does not mark it looked at.
- User-only queries refuse an agent: `mcp.getConnectInfo` (named test), `comfy.getInfo`, `job.getServerMessage`, and the built `thumbnail.get` ("Agents cannot read thumbnails in this version. Ask the user to do it in the app.", `src/main/queries/render.ts`). The built `variant.render` answers both actors. Whether `job.getServerMessage` should ever be open to an agent is what is left of OI-84; it stays user only.
- **The bus fails closed** (`denyCheck` in `src/main/commands/bus.ts`). For the agent actor, any policy that is not `allow`, `ask` or `tick` is refused with `AGENT_DENIED` and `denialMessage(name)`. `agentPolicyFor` returns `tick` for a `tick` row, and the bus sends it to the agent-run gate (`spec/agent-runs.md`), which refuses any `tick` command it does not know. Test: `tests/integration/commands/bus-fail-closed.test.ts` (raw `tick`, a made-up fifth value, `allow`).
- No agent sets a ComfyUI workflow's status to `proven`.

## Named tests (built)

In `tests/integration/mcp/`, unless named otherwise. The tests the agent-run slices add are in `spec/agent-runs.md`, 'Tests that must exist'.

- `server.test.ts`: binds `127.0.0.1` only; port taken; missing or wrong token gets 401 and reaches no session or command; any `Origin` and a wrong `Host` get 403 even with the right token; both allowed `Host` values open a session; actor is `agent` whatever the headers and arguments say; turning off closes the listener and forgets every session; another path gets 404.
- `secret-leak.test.ts`: calls every listed tool, with good and bad arguments, with the ComfyUI address and an asset path planted; no secret (`mcp.token` included, old and new) appears.
- `reply-keys.test.ts` (`riskyKeys`): no reply key named like a path, address or secret.
- `tool-list.test.ts`: a snapshot of the tools built so far (8).
- `read-tools.test.ts`: `list_projects` gives only `id` and `name`; `get_slots` gives its four fields per slot; `get_job` and `list_jobs` give the job view and nothing outside it, over a job row with every column filled; an unknown job ID or campaign gives `NOT_FOUND` as a tool error; a failed job's `message` holds "the saved ComfyUI address" and not the stand-in's origin; the `get_job` description says to poll no more than once every 5 seconds. Unit tests: `tests/unit/main/mcp/tools/agent-job-view.test.ts`; query: `tests/integration/queries/job-get.test.ts`.
- `mcp.getConnectInfo` refuses an agent (`tests/integration/queries/mcp-connect-info.test.ts`).

## Open items

- OI-25: `create_campaign` fallback when sizes or languages are missing.
- OI-84: whether `job.getServerMessage` is ever open to an agent (stays user only).
- OI-92: whether a tool may return picture bytes to an agent.
- OI-93: whether an agent may add pictures from disk.
- Bridge mode: whether Claude Desktop can reach the HTTP endpoint directly (Phase 10).
- The open items of agent runs (OI-62, OI-90) are in `spec/agent-runs.md`.

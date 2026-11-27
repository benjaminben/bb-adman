# MCP and agents

How an outside agent (an MCP client such as Claude Code) reaches the app: the MCP server, its token, bridge mode, every MCP tool, the permissions of each actor and the agent policy table. Runs an agent starts (the tick, the gate, the limit) are in `spec/agent-runs.md`. Read with `spec/api-principles.md` (the bus, errors, actors), `spec/api-commands.md` (the commands the tools run) and `spec/cancel.md` (what cancel does). Security rules in general are in `spec/security.md`.

## Status on `main`

- **Built:** the server (`src/main/mcp/`), the token, the request checks, the on and off switch, the port, the Connect panel with both blocks, bridge mode, the Settings section "Agent access (MCP)", every tool of the tool table, the ask flow and its dialog, `agent.activity` and the client name, the agent undo guard (A-261), the agent policy table with the `tick` value, the fail-closed bus, and agent runs: the gate, the tick, the limit, the untick check and the Settings block "Agent runs" (`spec/agent-runs.md`). The design as built is in `spec/phases/phase-10.md` and `phase-10-slices.md`. The end-to-end agent workflow (workflow 5.7) is `tests/e2e/mcp-workflow.spec.ts`.

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
- `ConnectInfo` (`src/shared/schemas/queries/mcp.ts`): `enabled`, `running`, `problem: 'port_in_use' | 'token_missing' | 'start_failed' | null`, `address`, `port`, `token: string | null`, `claudeCode: string | null`, `claudeDesktop: string | null`. `problem` is null while the setting is off. `start_failed` is a start that failed for any reason other than a taken port while the setting is on. `claudeDesktop` is described under "Bridge mode".
- **Turning on.** `mcp.setEnabled(true)` makes a token if none exists, then listens, and saves the setting only once the server is listening. On a taken port it leaves the setting as it was and returns `RULE_VIOLATION`, `details.reason` `port_in_use`, "Port {port} is in use. Choose another." (`portInUseMessage`).
- **Port taken at app start or on a port change** (setting already on): `settings.mcp.enabled` stays true; `running: false`, `problem: 'port_in_use'`. It tries again at the next start, on a port change, or on `mcp.setEnabled(true)`. No event for this.
- **Setting on, no token** (at app start): the app never makes a token on its own here. The server stays off with a warn log line (no token in it); `running: false`, `problem: 'token_missing'`, `token: null`.
- **Port change while running** (`settings.update` of `mcp.port`): close the listener, drop open sessions, listen on the new port. `settings.update` is not refused; the port is saved either way. A port change never throws.
- **New token.** `mcp.regenerateToken` saves a new token and, if the setting is on, closes the listener, drops every session and listens again with the new token. With the port taken it keeps the new token and replies `RULE_VIOLATION` / `port_in_use`. The screen fetches `getConnectInfo` again after.
- **Turning off**, or a new token, closes the listener and drops open sessions. `stop()` always closes the socket (`try`/`finally`), even if a session close fails. Start, stop, new token and port change run one at a time through `createSerial()`.

### Bridge mode

Built. `src/main/bridge/` (`run-bridge.ts`, `relay.ts`, `closed-answer.ts`, `launch-command.ts`, `session-folder.ts`). Security class full.

- **The switch.** `--mcp-bridge` on the command line is the only one. With it, the app runs the bridge and nothing else: no window, no single-instance lock, no core, no server, no listener, nothing written into the app data folder.
- **Chromium's own files.** Before anything else the bridge sets Chromium's `sessionData` to a fresh folder in the system temp folder (`session-folder.ts`) and removes it when the bridge ends. If that folder cannot be made, the bridge does not start (exit code 1).
- **The relay.** After `app.whenReady()` it reads `mcp.port` and `mcp.enabled` from `settings.json` and `mcp.token` from `secrets.bin` (through `safeStorage`). It relays MCP messages, unchanged, between stdio and `http://127.0.0.1:{port}/mcp`, with the bearer token in the `Authorization` header. Every request goes to that one address; redirects are refused. A message from the client may be at most 4 MiB. The server decides everything, as actor `agent`.
- **Output.** stdout carries only MCP messages. Nothing is written to stderr, and an error never opens Electron's error box. Nothing read from the client is logged or echoed.
- **Any failure** (the app not running, agent access off, no token, the token refused, the server unreachable) gives every request one fixed JSON-RPC error: code `-32000`, "Open the app and turn on agent access in Settings." A notification or a response gets nothing.
- **`ConnectInfo.claudeDesktop`**: pretty-printed JSON `{ "mcpServers": { "adman": { "command", "args" } } }`. A packaged app gives its own executable and `["--mcp-bridge"]`; an unpackaged one gives Electron and `[appPath, "--mcp-bridge"]`. It holds no token and no port (the bridge reads both itself). It is null while agent access is off. The Connect panel shows it as a second block with its own Copy button.
- **Accepted:** the bridge sends the token to whatever listens on that local port, as the Claude Code line does.
- **Open, for the stakeholder's hand check:** on macOS the bridge process may keep the app from opening from the Dock while Claude Desktop runs it; Windows stdio in a packaged build; on Windows, `safeStorage`'s key lives in Chromium's `Local State` file, which moves with `sessionData`, so the bridge may not be able to decrypt the token there (`spec/open-items.md`, "Windows test").
- A packaged app ignores `ADMAN_USER_DATA_DIR` (`spec/infra-and-settings.md`). Owed: the packaging slice sets the Electron fuses (`spec/phases/review-leftovers.md`).

### Connect panel

Built with both blocks (Claude Code and Claude Desktop). `src/renderer/screens/settings/mcp-section/`, `connect-panel/`.

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

Built for every tool; every future tool follows them.

- Every tool that takes a `project_id` works only on projects open in the app [REQ: FR-201].
- **Inputs.** A tool's input is its command's or query's own Zod schema, with top-level keys in snake_case and nested keys as the command has them (camelCase). That schema is the one owner. `project_id` reaches the command as `projectId`. Arguments that do not match the published input schema get the MCP SDK's own validation error before any command runs.
- **Replies.** A reply is one MCP text content item holding JSON. A tool error is the command's own `code`, `message` and `details`, `INTERNAL` included, as an MCP tool error (`isError: true`).
- **Every reply goes through an allow-list picker** in `src/main/mcp/tools/` (`read-replies.ts`, `project-replies.ts`, `agent-job-view.ts`). Each picker names every field it returns, so a field added to a row later cannot leave without a change there. No reply passes a whole row through. Query targets are pinned to an allowed list (`tools/table.ts`); a tool name is never used as a command or query name. `create_campaign`'s reply goes through `createdFields` (`campaign-replies.ts`, P10-10).
- **What a reply to an agent may never hold** [REQ: FR-198]: file contents; file or folder paths; settings; keys; the MCP access token (the agent sends it on each request, and no reply ever contains it); the ComfyUI address; a tick or the limit; the server's own words. Display names of assets may appear (`list_assets` gives them); a path may not. A file-system error is not an `AppError`, so the bus returns the fixed `INTERNAL` reply with no error text.
- **Tool descriptions.** Every tool that starts a run, and every tool that puts an asset on a layer, carries this sentence (final words are owned by the slice that builds the tool): "A run you start makes options for the user to choose from. Leave the choice to the user unless they asked you to choose." [D-059 item 5]. No command refuses an agent's pick.

### The tool table

All built. `ALL_TOOLS` in `src/main/mcp/tools/table.ts` holds the tools and their listing order; `tests/unit/main/mcp/tools/tool-plan.test.ts` pins the names and that none is still not built, and `tests/integration/mcp/tool-list.test.ts` pins the names, descriptions and input schemas. Policy is the agent policy of the command the tool runs (see 'Agent policy table'). Inputs and replies as built are in `spec/phases/phase-10.md`, "Design additions", where they differ from this table.

| Tool | Runs | Input | Output | Policy | Status | Requirements |
|------|------|-------|--------|--------|--------|--------------|
| `list_projects` | query `project.listOpen` | — | Open projects: `id`, `name` | allow | Built | FR-192, FR-201 |
| `get_project` | query `project.get` | project_id | Project meta, subjects, campaign summaries, missing asset count | allow | Built | FR-192 |
| `list_subjects` | query `subject.list` | project_id | id, name, description, attached asset IDs | allow | Built (P10-2) | FR-192 |
| `list_assets` | query `asset.list` | project_id, library?, kind?, subject_id? | id, display name, kind, library, subject ID, width, height, duration, font family | allow | Built | R-11 |
| `get_campaign` | query `campaign.get` | project_id, campaign_id | Campaign fields, rule set, directions, variant summaries with badges | allow | Built | FR-192 |
| `get_variant` | query `variant.get` | project_id, variant_id | Variant with its badges (`outOfDate`, `checkWarning`, `checkStale` among them; no out-of-date detail and no check results, A-165), layers (all values), its video clips (P10-13; the tool's description names them), assets used, by an allow-list (`variantFields`) | allow | Built (P10-2) | FR-192 |
| `render_variant` | query `variant.render` | project_id, variant_id, max_dimension, time_ms | One PNG image, nothing else | allow | Built (P10-3): the complete ad, every layer drawn wherever its source lives (A-234) | FR-193 |
| `create_campaign` | command `campaign.create` | The command's input as built: project_id, brief (`spec/brief-and-templates.md`), subject_map, sizes, languages, template_id, rule_set?, copy_rule_set_from? | campaign_id, master variant_id, direction_id, through `createdFields`; sizes and languages left out are filled in (P10-10, A-246) | allow | Built | FR-195, R-01 |
| `create_campaign_from_brief` | command `campaign.createFromBrief`, or `campaign.createFromBriefWithFiles` when the brief names a file path (the tool picks by reading the text) | project_id, text (a brief in JSON, YAML or Markdown) | campaign_id, direction_id, master variant_id, subject_ids; plus asset_ids for the files imported | allow; ask when the brief names a file path | Built (R2P-7) | Round 2 item 12, R-4 |
| `create_project` | command `project.createInDefaultFolder` | name (one file name, at most 100 characters) | project_id, name | allow | Built (R2P-8) | Round 2 item 12, R-5 |
| `import_assets` | command `asset.importFiles` | project_id, paths (1 to 20 absolute paths), library? (`asset` or `reference`) | asset_ids, one per path, in order | ask (never auto-approved) | Built (R2P-5) | Round 2 item 16, R-3 |
| `add_variant` | command `variant.add` | project_id, direction_id, size_label, language, format (`image` only) | variant_id | allow | Built (P10-11) | FR-195 |
| `set_variant_format` | command `variant.setFormat` | project_id, variant_id, format (`image` or `video`); no undo-only field | variant_id, format | allow | Built (P10-13) | R-20, D-025 |
| `create_layer` | command `layer.create` | project_id, variant_id, type (`text` or `image`), copy?, asset_id?, geometry, style?, timing?, animation? | layer_id | allow | Built (P10-4) | FR-194 |
| `update_layer` | command `layer.update` | project_id, layer_id, any of copy, geometry, style, asset_id, timing, animation, visible, name | layer_id | allow | Built (P10-4) | FR-194 |
| `update_layers` | command `layer.updateMany` | project_id, variant_id, updates (1 to 100) | layer IDs | allow | Built (P10-4) | FR-061, FR-194 |
| `delete_layer` | command `layer.delete` | project_id, layer_id | layer_id | allow | Built (P10-4) | FR-197 notes |
| `reorder_layers` | command `layer.reorder` | project_id, variant_id, layer_ids | variant_id | allow | Built (P10-4) | FR-194 |
| `set_translation` | command `translation.set` | project_id, layer_id, text, apply_to_same_language? | layer IDs changed; the status is always `proposed` | allow | Built (P10-12) | FR-194, FR-200 |
| `run_checks` | command `check.run` | project_id, campaign_id or variant_ids | Check results | allow | Built (P10-12) | FR-196 |
| `get_check_results` | query `check.results` | project_id, campaign_id | Latest results per variant | allow | Built (P10-12) | FR-196 |
| `delete_variant` | command `variant.delete` | project_id, variant_id | — | ask | Built (P10-11) | FR-197 |
| `delete_campaign` | command `campaign.delete` | project_id, campaign_id | — | ask | Built (P10-6) | FR-197 |
| `delete_subject` | command `subject.delete` | project_id, subject_id | `{ subjectId }` | ask | Built (SUBJ-1) | FR-197, D-101 |
| `propose_layout`, `copy_options`, `cut_out` | commands `generation.proposeLayout`, `generation.copyOptions`, `generation.cutOut` | as the commands, no licence field | `{ jobId }`; results through `get_job` | tick | Built (P10-5) | FR-045, FR-061, FR-307 |
| `get_slots` | query `template.slots` | project_id, campaign_id | Per slot of the master variant: `slotId`, `type`, `state` (`filled` or `empty`), `candidates` (asset IDs) | allow | Built | FR-192, D-080 |
| `generate_images` | command `generation.runImages` | The command's input as built: project_id, variant_id, slot or layer_id, prompt, reference_asset_ids, count, provider, workflow_id? | `{ jobId }` | tick | Built | FR-062, FR-279, D-080, D-104 |
| `generate_video` | command `generation.startVideo` | The command's input as built: project_id, variant_id, prompt, duration_ms, provider, start, use_references, reference_asset_ids, workflow_id? | `{ jobId }` | tick | Built | FR-262, FR-279, D-080, D-104 |
| `list_comfy_workflows` | query `comfyWorkflow.list` | — | `workflows`: `id`, `name`, `job`, `start`, `isDefault` | allow | Built | D-104 |
| `add_comfy_workflow` | command `comfyWorkflow.add` | name, workflow_json (the file's text, at most 2 MiB), video? | `workflowId` | ask, kind `workflow` (never auto-approved) | Built | D-104, FR-327 |
| `remove_comfy_workflow` | command `comfyWorkflow.remove` | workflow_id | `workflowId` | ask, kind `delete` | Built | D-104, FR-327 |
| `create_direction` | command `direction.createFromMaster` | project_id, master_variant_id, name | `{ directionId, variantId }` | allow | Built | FR-074, D-105 |
| `rename_direction` | command `direction.rename` | project_id, direction_id, name | `{ directionId }` | allow | Built | FR-072, D-105 |
| `delete_direction` | command `direction.delete` | project_id, direction_id | `{ directionId }` | ask, kind `delete` | Built | D-099, D-105 |
| `get_job` | query `job.get` | project_id, job_id | The job view (below) | allow | Built | FR-279, D-080 |
| `list_jobs` | query `job.list` | project_id, campaign_id?, variant_id?, state?, limit? | The job view per job, newest first | allow | Built | FR-279, D-080 |
| `cancel_job` | command `job.cancel` | project_id, job_id | `{ jobId }` | tick (own runs only) | Built | FR-281, D-080 |

Each new tool maps one to one to its command or query, with an allow-list reply picker, and the tool-list snapshot is updated.

### Notes on single tools

- **`list_projects`.** Query `project.listOpen`: `{ id, name }[]` for open projects only, never `filePath`. Agent policy allow. `app.getState.openProjects` is not wrapped, since it carries `filePath`.
- **`get_project`, `get_campaign`.** Allow-list pickers over today's fields (`projectFields`, `campaignFields` in `tools/project-replies.ts`), so a field added later to a campaign, variant, subject, rule set or direction row (a path, say) cannot leave. `get_project`'s description names every field the picker gives: `meta` (project ID, name, schema version, the app version that made it, created time), `subjects`, `campaigns` and `missingAssetCount`.
- **`list_assets`.** Cut to the nine fields above by an allow-list (`assetFields` in `tools/read-replies.ts`), so no file path is returned.
- **`create_campaign`** (P10-10; OI-25 settled). Sizes and languages an agent leaves out are filled in by `fillCreateDefaults` (`src/shared/campaign/create-defaults.ts`): the brief's own values, then the three default sizes and the region table's language. The reply is exactly three IDs.
- **`import_assets`** (R2P-5, R2P-5b; `src/main/mcp/tools/import-tools.ts`). The user is asked every time and sees each full path (the "Ask flow" below); `mcp.autoApproveDestructive` never covers it. Before the ask only the text of each path is checked, so nothing on disk is touched until the user allows; the rules and refusals are in `spec/security.md`, "Rules: agents and cost", and the design in `spec/phases/round-2-platform.md`, D5. Each file is copied, never linked; text files, SVG and folders are refused. Every message names a file by its place ("File 3 …"), never by path or name. Reply `{ assetIds }` in input order. The agent then sees each asset's display name, kind and size through `list_assets`, never a path. It carries the "leave the choice" sentence.
- **`create_campaign_from_brief`** (R2P-7; `brief-tools.ts`). Reads the text with the same fixed rules as a pasted brief (`spec/brief-and-templates.md`, "Brief text"). A subject's pictures are asset IDs from `list_assets` (no ask) or full file paths (the call asks, as `import_assets` does; image files only; at most 20). A relative path is refused with no disk read. Missing required fields are refused with their names. Sizes and languages left out are filled as for `create_campaign`. The campaign is made with the starter template; the brief text itself is not stored and the stored brief holds no picture. Reply: campaign, direction, master variant and subject IDs, plus the imported asset IDs. Any refusal writes nothing and removes every copy.
- **`create_project`** (R2P-8; `project-tools.ts`). Makes an empty project in the user's default projects folder and opens it. The input is a name only; nothing names a place. An existing file at that name, or any entry there (a dangling link too), is never replaced or followed: `RULE_VIOLATION`, `file_exists`. Reply `{ projectId, name }`; never the folder or path. The window lists the new project in the switcher and does not show it. With no project open, every other project tool still gives `NOT_FOUND`: an agent works only on projects the user opened and projects it created.
- **`get_slots`** reads `template.slots` (`src/main/queries/template.ts`) for the campaign's master variant, from `slot.id`, `slot.type`, the slot's state and its candidate asset IDs.
- **`get_job` and `list_jobs`.** `get_job` runs query `job.get` (a job ID unknown in the project gives `NOT_FOUND` "That job was not found."); `list_jobs` runs over `job.list` (`src/main/queries/job.ts`). `list_jobs` leaves out the `layer_id` filter of `job.list` on purpose. The `get_job` description tells the agent to poll no more than once every 5 seconds. Both replies are built by `agentJobView(row, providers)` in `src/main/mcp/tools/agent-job-view.ts`, which names every field an agent sees of a job:
  - `id`, `kind`, `status`, `startedBy`, `campaignId`, `variantId`, `layerId`, `slot`, `progress`, `paidCalls`, `seenAt`, `errorKind`, `errorReason`, `createdAt`, `updatedAt`;
  - `stage` and `queuePosition` from `result`, only when a string and a whole number; otherwise left out;
  - `assetIds`: `result.assetIds` for a picture or cut-out job, `[result.assetId]` for a video job, else `[]`, strings only;
  - `failures` for a picture job only: known error kind to count;
  - `layout: { boxes }` for a succeeded layout run and `copyOptions` (strings) for a succeeded copy run (A-232); the `get_job` description names both;
  - `message`: for an `errorReason`, the `reasonMessage` sentence with `{address}` replaced by "the saved ComfyUI address" and `{n}` by "some"; else for an `errorKind`, `plainMessage(kind, provider label)`, where a provider this build does not list is called "The provider"; else null.
  - Left out: `provider`, `model`, `remoteJobId`, `request`, and the rest of `result`. A failed run is reported to the agent in the app's own words.
- **`generate_images`, `generate_video`** (`src/main/mcp/tools/run-tools.ts`). Reply `{ jobId }` only, through the picker `jobIdOnly`. Refusals pass through as the command gives them; the full set, `licence_not_confirmed` included, is in `spec/agent-runs.md`, 'After the gate'. The two start tools run one at a time through one `createSerial()` (`src/main/mcp/serial.ts`), made when `toolSetup` is called and shared by every session (`oneAtATime` on the tool definition); the bus is not changed for this. A tool's published input schema does not carry the "slot or layer, not both" rule; the command enforces it. The tools register no output schema. Descriptions say: the run makes options for the user to choose from, so leave the choice to the user unless asked; `provider` is `comfyui` (the user's own ComfyUI server, no charge) or `gemini` (pictures, not videos; paid, charged to the user's Google account with no click); runs are refused unless the user allowed agents for that provider in Adman's Settings. `generate_video`'s description names the starts (from a prompt, from a first-frame picture, with reference pictures, and from the variant's background; the shapes are in `spec/api-commands.md`), says a picture is named by an asset ID from `list_assets`, and adds `fal-seedance` for video (paid, charged to the user's fal.ai account with no click; its lengths and reference count from `src/shared/config/video-offers.ts`). Both take an optional `workflow_id`, and both descriptions add: "workflow_id names a workflow from list_comfy_workflows; leave it out for the default." The command checks the ID after the gate (`spec/comfyui-custom.md`, "Which workflow a run gets").
- **`list_comfy_workflows`, `add_comfy_workflow`, `remove_comfy_workflow`** (D-104; `src/main/mcp/tools/workflow-tools.ts`, `workflow-replies.ts`). Rules, descriptions and refusals: `spec/comfyui-custom.md`, "MCP tools" and "The agent's ask". No reply holds a graph, a node, an input, a title, a file path or the address. An agent can never read a workflow back or change one.
- **`cancel_job`.** Only a run the agent started (`spec/agent-runs.md`, 'Gate steps for a run'). Reply `{ jobId }` through `jobIdOnly`. Not run one at a time.
- **`render_variant` writes no file** [REQ: FR-193, D-030]. The picture goes back to the agent inside the tool reply and nowhere else.
  - The reply is one MCP image content item: the PNG bytes in base64 with the type `image/png`. It holds no path and no address (not an `adman-asset://` address either).
  - The picture is made in memory from start to finish. The render service draws the variant in the hidden window, captures it, scales it to `max_dimension` and turns it into PNG bytes with `nativeImage.toPNG()`. No step writes it to disk: not to an export folder, the assets folder, the app data folder, or the system's temporary folder, not even for a moment.
  - It creates no `asset` row, no `job` row and no report, does not change the project, and emits no `project.changed`.
  - The log line for the call holds the tool name, the IDs and the picture's width and height, not the picture.
  - The render service function this tool calls takes no file path and returns bytes. Image export (`spec/export-and-checks.md`) is a different caller, and it is the one that writes a file.
  - Named test in `spec/testing.md`.
- **`run_checks`** runs all six checks (`spec/export-and-checks.md`): the four brand and legal checks FR-196 names, and the two readiness checks [REQ: FR-116]. The readiness results come from translation status and overflow values the agent can already read through `get_variant`. It replaces the variant's stored check row (`ranBy: 'agent'`), the user's included; export runs the checks again itself. `get_variant` carries only the check badges (A-165); the results are `get_check_results`'.
- **`delete_variant`** asks as `delete_campaign` does. A delete has no undo (D-099), and deleting a variant clears the campaign's undo list (A-141); the description says both.
- **`delete_subject`** asks as `delete_campaign` does, and the delete tick covers it. The target line is `Subject "{name}" ({n} photos) in "{project}"`, names only. It deletes the subject row only: its photos stay in the project without a subject. A subject a campaign or variant uses is refused by the command after the allow. The reply is the subject ID only (SUBJ-1, D-101).
- **Directions** (D-105; `src/main/mcp/tools/direction-tools.ts`). An agent reads a campaign's directions with `get_campaign` (each direction's `id`, `name`, `masterVariantId`, `sort`); there is no separate read tool. `create_direction` copies a master into a new direction, as the screen's "New direction" does: no ask, no undo (D-099), and the new master's `createdBy` is `agent`. `rename_direction` runs with no ask and lands on the campaign's undo list, where the user can undo it. `delete_direction` asks as `delete_campaign` does, and the delete tick covers it. The target line is `Direction "{name}" ({n} variants) in campaign "{campaign}" in "{project}"`, names only, each cleaned. The dialog's last line reads "This cannot be undone. Every variant of this direction is deleted too, and the undo list of this campaign is cleared." The command's own refusals still apply after the allow (the campaign's last direction, work still running). Each reply holds IDs only. An agent still cannot make many variants at once (`variant.fanOut`) or sync a direction.
- **`delete_campaign`** asks for permission for every campaign, including one the agent created [D-023].
- **`set_variant_format`** runs `variant.setFormat` in either direction with no permission dialog [D-025]. Same rules as for the user: the grid test can refuse it with `RULE_VIOLATION`, and the user can undo it from the variant's list. `add_variant` adds an image variant only; to make a video variant the agent then calls `set_variant_format`. The agent has no clip tools, so on a video variant it changes layer timing and animation only.
- **`add_variant`** by an agent creates the variant as one fan-out cell (`spec/data-rules.md`) with background fit `scale` and no translation job, always from the master. Text layers in another language get `translation_status = 'missing'` until the agent or the user supplies text. Its boxes and text sizes follow `spec/make-variants.md` like every new variant, and its description says "Boxes are placed for the new size and text is sized to fit, as the app does." Words set with `set_translation` are not fitted; the agent reads `overflow` with `get_variant` and changes the size itself.
- **Picture and clip bytes.** No tool returns the bytes of a picture or clip an agent made (OI-92: whether a `view_asset` tool for generated pictures should exist; to be judged with `spec/agent-runs.md`, 'Paid runs and spending', linked assets). `render_variant` is the only image reply.

### Ask flow

Built (words in `spec/phases/phase-10-slices.md`, P10-7). [REQ: FR-197]

Every `ask` command has a kind in `ASK_KINDS` (`src/main/mcp/ask-kinds.ts`, its one owner): `campaign.delete`, `variant.delete`, `subject.delete`, `direction.delete` and `comfyWorkflow.remove` are `'delete'`; `asset.importFiles` and `campaign.createFromBriefWithFiles` are `'import'`; `comfyWorkflow.add` is `'workflow'`. An `ask` command with no kind is refused at once, so a new `ask` row cannot slip past.

1. The server emits `agent.permissionRequested` with `kind` (`'delete'`, `'import'` or `'workflow'`) and `fileCount` (0 for a delete or a workflow); no ID, input or path. For a `workflow` ask the event carries only the target line; the dialog reads the name, job, start, reference count and node types with the user-only query `agent.askWorkflow { requestId }` (`{ name, job, start, references, nodeTypes }`, held in memory for the request's life only). Before a `workflow` ask the broker checks the text (`checkWorkflowText`) and refuses a taken name (`workflow_name_taken`) or a full list (`workflow_limit`) with no event (`spec/comfyui-custom.md`, "The agent's ask"). The window shows a dialog naming the agent, the action and the target. For a delete its cost line says the delete cannot be undone, and for a variant that it clears the campaign's undo list. For an import the dialog reads the full paths with the user-only query `agent.askFiles { requestId }` (`{ files }` while the request is open, else `NOT_FOUND` "That request has ended."; the list is held in memory for the request's life only) and shows each one (`spec/security.md`, "Paths in the renderer"). "Allow" ("Import") can be pressed only 750 ms after the dialog opens, and for an import only once the list is shown.
2. The tool call waits up to 120 seconds.
3. Allow runs the command (the window answers with `agent.answerPermission`, `deny` for an agent). Refuse or timeout returns `AGENT_REFUSED`.
4. If `settings.mcp.autoApproveDestructive` is true, step 1 is skipped for a `'delete'` ask and the action is logged as auto-approved. An `'import'` or `'workflow'` ask always shows the dialog. A `'workflow'` ask is never auto-approved, its dialog has no "Don't ask again" tick, and "remember" in `agent.answerPermission` is ignored for it.

`agent.activity` (the event that tells the window what agents did) is built.

**The agent undo guard** (A-261, built). An agent's command is refused at the 101st agent entry in a row on one undo list since the user last acted there: `RULE_VIOLATION`, `agent_undo_limit`, "This ad has too many agent changes in a row. Ask the user to look before going on.", with nothing written. A user edit, undo or redo on that list resets the count; an agent's undo does not.

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
| Create a campaign, add a variant | ✓ | ✓ (a campaign from brief text too; asked first when the brief names a file path) |
| Create a project | ✓ | ✓ an empty one, by name, in the default folder only; listed, not shown |
| Change a variant's format, either direction | ✓ | ✓ |
| Run checks | ✓ | ✓ |
| Delete a variant or campaign | ✓ | With the user's permission, for every campaign and variant |
| Add or rename a direction | ✓ | ✓ (`create_direction`, `rename_direction`; D-105) |
| Delete a direction | ✓ | With the user's permission, as a delete (`delete_direction`) |
| Make many variants at once ("Make variants", `variant.fanOut`, from the master or from any variant), sync, undo | ✓ | ✗ |
| Picture and video generation | ✓ | ✓ through the MCP server, on every provider the app offers for the job (today ComfyUI and Gemini, and fal.ai Seedance for video), and on `trial` ComfyUI workflows while dev tools are on, only for a provider the user ticked, within the limit [D-080]. May name a ComfyUI workflow by ID, a custom one included [D-104]. |
| List ComfyUI workflows (ID, name, job, start, default) | ✓ | ✓ (`list_comfy_workflows`) |
| Add a ComfyUI workflow | ✓ from a file chosen in the system picker, in Settings | With the user's permission, every time, seeing the name, job and every node type; never auto-approved; sends the text, never a path (`add_comfy_workflow`) |
| Remove a ComfyUI workflow | ✓ | With the user's permission, as a delete (`remove_comfy_workflow`) |
| Change a ComfyUI workflow; read a graph; the remembered workflow choice | ✓ | ✗ |
| AI layout and copy suggestions, cut-outs | ✓ | Under the provider's tick (`propose_layout`, `copy_options`, `cut_out`) |
| Cancel a run | ✓ where the provider can stop it | Only a run an agent started (all agent clients are one actor); no tick needed. |
| Retry a run; mark a result seen; read the server's own words | ✓ | ✗ |
| Export, publish | ✓ | ✗ |
| Approval links: make, update, read sign-offs, turn off | ✓ | ✗ |
| Import files by path | ✓ | With the user's permission, every time, seeing each full path; at most 20 per call; copied, never linked (`import_assets`) |
| Import folders, relink, package, the user's own picks and drops | ✓ | ✗ |
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
| `allow` | `project.createInDefaultFolder` ("create projects"), `campaign.create`, `campaign.createFromBrief` ("make campaigns from a brief"), `direction.createFromMaster` and `direction.rename` [D-105], `variant.add`, `variant.update`, `variant.setFormat` [D-025], `layer.create`, `layer.update`, `layer.updateMany`, `layer.delete`, `layer.reorder`, `layer.setFonts` (A-166), `translation.set`, `check.run` |
| `ask` | `campaign.delete`, `variant.delete`, `subject.delete` ("delete subjects", D-101), `direction.delete` ("delete directions", D-105), `asset.importFiles` ("import files"), `campaign.createFromBriefWithFiles` ("make campaigns that import files"), `comfyWorkflow.add` ("add ComfyUI workflows"), `comfyWorkflow.remove` ("remove ComfyUI workflows") |
| `tick` | `generation.runImages`, `generation.runFill`, `generation.proposeLayout`, `generation.copyOptions`, `generation.cutOut`, `generation.startVideo`, `job.cancel` |
| `deny` | `project.create`, `project.open`, `project.close`, `project.setAssetsDir`, `project.package`, `subject.create`, `subject.update`, `asset.import`, `asset.update`, `asset.relink`, `asset.remove`, `asset.addGenerated`, `asset.checkChanged`, `brief.parse`, `brief.extract`, `campaign.update`, `ruleSet.update`, `ruleSet.copyFrom`, `variant.fanOut` ("make many variants at once"), `variant.setSound`, `layer.clearOverride`, `layer.reportOverflow`, `clip.add`, `clip.update`, `clip.remove`, `clip.reorder`, `translation.propose`, `translation.approve`, `translation.exportSheet`, `sync.apply`, `job.retry`, `job.markSeen`, `export.run`, `publish.run`, `publish.setFontConsent`, `history.undo`, `history.redo`, `settings.update`, `secret.set`, `secret.delete`, `storage.dropboxSignIn`, `storage.dropboxSignOut`, `storage.checkS3`, `storage.setDropboxFolder`, `mcp.setEnabled`, `mcp.regenerateToken`, `agent.answerPermission`, `comfy.setAddress`, `comfy.check`, `comfyWorkflow.addFromFile` ("add ComfyUI workflows from a file"), `comfyWorkflow.update` ("change ComfyUI workflows"), `agentRuns.setAllowed`, `agentRuns.setLimit`, `dev.comfyExtend` (the command is not built and will not be; the row stays), `generation.applyFill`; the system commands `report.add`, `variant.remove`, `variant.restore`, `variant.restoreLayers`, `layer.restore`, `layer.revert`, `clip.restore`, `clip.addGenerated`, `clip.swap` ("swap background clips", R2E-7), `translation.write`, `translation.restore`; approvals: `approvals.setService`, `approvals.check`, `approvals.createLink`, `approvals.setPassword`, `approvals.publish`, `approvals.refresh`, `approvals.endLink`, `approvals.cancelUpdate` ("stop approval gallery updates", R2V-7) |

- A command not in the table is `deny`.
- `generation.runFill` is one of the gate's run commands, with the same per-provider tick and limit; no MCP tool wraps it.
- The gate knows the three AI-job `tick` commands (`generation.proposeLayout`, `generation.copyOptions`, `generation.cutOut`; `spec/ai-jobs.md`). The tick is per provider, so a provider ticked for pictures is ticked for these too [D-093]. Their MCP tools are `propose_layout`, `copy_options` and `cut_out`.
- `job.retry` stays `deny` (it re-sends a stored request). `job.markSeen` stays `deny`: picking a result does not mark it looked at.
- User-only queries refuse an agent: `mcp.getConnectInfo` (named test), `agent.askFiles` (the paths of an open import ask), `agent.askWorkflow` (the name, job, start, reference count and node types of an open workflow ask), `comfy.getInfo`, `job.getServerMessage`, and the built `thumbnail.get` ("Agents cannot read thumbnails in this version. Ask the user to do it in the app.", `src/main/queries/render.ts`). `variant.render` is open to an agent through `render_variant`: the complete ad, every layer drawn wherever its source lives (A-234). With video clips drawn this includes frames of a linked video; whether A-234 covers that is open with the stakeholder. Whether `job.getServerMessage` should ever be open to an agent is what is left of OI-84; it stays user only.
- **The bus fails closed** (`denyCheck` in `src/main/commands/bus.ts`). For the agent actor, any policy that is not `allow`, `ask` or `tick` is refused with `AGENT_DENIED` and `denialMessage(name)`. `agentPolicyFor` returns `tick` for a `tick` row, and the bus sends it to the agent-run gate (`spec/agent-runs.md`), which refuses any `tick` command it does not know. Test: `tests/integration/commands/bus-fail-closed.test.ts` (raw `tick`, a made-up fifth value, `allow`).
- No agent sets a ComfyUI workflow's status to `proven`. `comfyWorkflow.list` is open to both actors (`list_comfy_workflows`).
- **Approvals by link** (`spec/approvals.md`): every approvals command is `deny`, because it publishes work outside the machine and holds other people's email addresses. The queries `approvals.forCampaign` and `approvals.getPassword` are user only ("Agents cannot read approvals in this version. Ask the user to do it in the app."). No tool returns approvals data, a link address or a slug.
- **Export reports:** the queries `report.list` and `report.get` are user only ("Agents cannot read export reports in this version. Ask the user to do it in the app.").

## Named tests (built)

In `tests/integration/mcp/`, unless named otherwise. The tests the agent-run slices add are in `spec/agent-runs.md`, 'Tests that must exist'.

- `server.test.ts`: binds `127.0.0.1` only; port taken; missing or wrong token gets 401 and reaches no session or command; any `Origin` and a wrong `Host` get 403 even with the right token; both allowed `Host` values open a session; actor is `agent` whatever the headers and arguments say; turning off closes the listener and forgets every session; another path gets 404.
- `secret-leak.test.ts`: calls every listed tool, with good and bad arguments, with the ComfyUI address and an asset path planted; no secret (`mcp.token` included, old and new) appears.
- `reply-keys.test.ts` (`riskyKeys`): no reply key named like a path, address or secret.
- `tool-list.test.ts`: the pinned names, descriptions and input schemas of every listed tool.
- `read-tools.test.ts`: `list_projects` gives only `id` and `name`; `get_slots` gives its four fields per slot; `get_job` and `list_jobs` give the job view and nothing outside it, over a job row with every column filled; an unknown job ID or campaign gives `NOT_FOUND` as a tool error; a failed job's `message` holds "the saved ComfyUI address" and not the stand-in's origin; the `get_job` description says to poll no more than once every 5 seconds. Unit tests: `tests/unit/main/mcp/tools/agent-job-view.test.ts`; query: `tests/integration/queries/job-get.test.ts`.
- `mcp.getConnectInfo` refuses an agent (`tests/integration/queries/mcp-connect-info.test.ts`).

## Open items

- OI-84: whether `job.getServerMessage` is ever open to an agent (stays user only).
- OI-92: whether a tool may return picture bytes to an agent.
- OI-93 (an agent adding pictures from disk) is answered by Round 2 (R-3): yes, through `import_assets`, asked every time.
- Bridge mode: the two hand checks under "Bridge mode" (macOS Dock, Windows stdio).
- The open items of agent runs (OI-62, OI-90) are in `spec/agent-runs.md`.

# Phase 10 — MCP server

Bullets carry `[logic]` (main process, shared code, commands, queries, the MCP server) or `[UI]` (screens, dialogs, panels and controls in `src/renderer/`). Both are built in this phase (D-084): each slice builds its screens with its logic, as modular components styled only from the shared tokens.

**Goal:** Claude can read and edit open projects.
**Class:** E, D

**Already built** (Phase 2, `spec/mcp-and-agents.md`): the server on `127.0.0.1` with the token, the Origin, Host and token checks, `mcp.setEnabled`, `mcp.getConnectInfo` (user actor only), `mcp.regenerateToken`, the MCP section and Connect panel in Settings (Claude Code line only), and the tools `get_project`, `list_assets`, `get_campaign`, `create_campaign`. The Phase 2 leftovers group 3 (`spec/phases/phase-02-agent-generation.md`) adds `list_projects`, `get_slots`, `get_job`, `list_jobs`, `generate_images`, `generate_video` and `cancel_job`, for 11 tools.

## Scope

- [logic] Every tool in the MCP tool list (`spec/mcp-and-agents.md`) over the existing commands, `set_variant_format` included [D-025]. The tool-list snapshot matches (`spec/testing.md`). The 14 tools left after group 3:
  - `list_subjects`, `get_variant`, `render_variant` (needs the Phase 3 Scene), `add_variant`, `set_variant_format`, `create_layer`, `update_layer`, `delete_layer`, `reorder_layers`, `set_translation`, `run_checks`, `get_check_results`;
  - `delete_variant` and `delete_campaign` (policy `ask`) [REQ: FR-197].
  - Each maps one to one to its command or query. Inputs are that command's own Zod schema with snake_case top-level keys. Each reply goes through an allow-list picker in `src/main/mcp/tools/`; no reply passes a whole row through. No tool returns file contents, paths, settings or secrets [REQ: FR-198]. The snapshot is updated with each.
- [logic] Ask flow, automatic permission setting (`autoApproveDestructive`). No `ask` tool exists until the delete tools land.
- [logic] Bridge mode: `"{app executable}" --mcp-bridge` speaks MCP over stdio and forwards to the endpoint. `mcp.getConnectInfo` gains a Claude Desktop field.
- [logic] `agent.activity` event, agent marking in the log. `variant.agent_changed_at` is written by the built `variant.rev` helper (`spec/data-model-campaign.md`); this phase adds one test through an MCP tool [REQ: FR-239].
- [UI] Permission dialog for the ask flow; agent activity indicator; the Connect panel's second block, for Claude Desktop. (The on and off switch and the Connect panel with the token are built.)

## Exit criteria

- Workflow 5.7 passes with an MCP test client.
- By hand, Claude Code places copy on a variant, and the edits appear live and can be undone.
- An MCP test client changes a variant's format in both directions with no permission dialog.
- The named secret-leak test and the named `mcp.getConnectInfo` test pass.

## Dependencies

- Phase 6 (commands exist). Phase 7 for `variant.setFormat`. Phase 3 for `render_variant`.
- Claude Desktop connection checked (`spec/mcp-and-agents.md`).
- The Phase 2 leftovers group 3.

## Carried in from earlier work

- **Tool wording for runs and picks.** On every tool that starts a run and every tool that puts an asset on a layer: "A run you start makes options for the user to choose from. Leave the choice to the user unless they asked you to choose." The built run tools (`generate_images`, `generate_video`) carry it; this phase owns the final words for every tool. It is wording only: an agent may pick a result, and `layer.update` and `layer.create` by an agent check neither `started_by` nor `seen_at`.
- **OI-25's fallback** for `create_campaign` when sizes or languages are missing.
- **Tools for the Phase 4 commands** (A-66). `generation.proposeLayout`, `generation.copyOptions` and `generation.cutOut` are `tick` and known to the gate, and `layer.updateMany` is `allow`, from Phase 4; no tool calls them yet. This phase adds one tool each (one at a time through `createSerial()`, as the other start tools), with allow-list replies, and decides whether `agentJobView` shows a layout's boxes or copy options to the agent. The queries `job.earlierOptions` and `job.activity` get a tool only if this phase wants one.
- **Claude Desktop block.** Today the Connect panel shows only the Claude Code line, and `ConnectInfo` has no Claude Desktop field. Bridge mode adds the field and the second block.
- **Every new reply** passes `riskyKeys` (`tests/integration/mcp/reply-keys.test.ts`), and the word test (no `comfyui`, case-sensitive; no `baseUrl`, no `agentRuns`, no server origin) covers each new tool's recorded success and refusal replies.
- **`render_variant`** returns one PNG image. It is the first tool that returns picture bytes, so it is judged with the linked-asset risk recorded in group 3 (a linked asset's path comes from the project file) and with OI-92.

## Not designed yet

- The ask flow's steps are written (`spec/mcp-and-agents.md`); the dialog's layout is designed here.
- `agent.activity`: the event's fields and the activity indicator.
- OI-25's fallback for `create_campaign`.
- OI-92 (picture or clip bytes returned to an agent) and OI-93 (an agent adding a picture from disk): both stay shut until ruled.

# Phase 10 — The remaining agent tools

Bullets carry `[logic]` (main process, shared code, commands, queries, the MCP server) or `[UI]` (screens in `src/renderer/`). Both are built in this phase (D-084).

**Goal:** Claude can read and edit open projects through the app's MCP server.
**Class:** E, D (B for the two queries, C for `render_variant`, G for the bridge's start branch).
**Slices:** `spec/phases/phase-10-slices.md` (P10-1 to P10-14).

**Already built** (`spec/mcp-and-agents.md`): the server on `127.0.0.1`, the token and request checks, `mcp.setEnabled`, `mcp.getConnectInfo`, `mcp.regenerateToken`, the Agent access section with the Claude Code block, the agent policy table (`allow`, `ask`, `deny`, `tick`), the fail-closed bus, the agent-run gate (which already knows `generation.proposeLayout`, `generation.copyOptions`, `generation.cutOut`), and 11 tools in `src/main/mcp/tools/` (`table.ts`, `run-tools.ts`, the pickers in `read-replies.ts`, `project-replies.ts`, `agent-job-view.ts`). Every policy row the new tools need already exists in `src/main/commands/agent-policy.ts`; **no slice of this phase edits that file.** No migration is needed (`variant.agent_changed_at` and `mcp.autoApproveDestructive` exist).

## The tools left, and what each waits for

The outline's 14, plus four for the Phase 4 commands (A-66, A-231): 18 new tools, 29 in all.

| Tool | Wraps | Exists today? | Policy | Built by | Waits for |
|------|-------|---------------|--------|----------|-----------|
| `list_subjects` | query `subject.list` (new, A-235) | No; P10-1 registers it, P10-2 builds it | both actors | P10-2 | P10-1 |
| `get_variant` | query `variant.get` | Yes | both actors | P10-2 | P10-1 |
| `render_variant` | query `variant.render` | Yes, user only today | agent, complete picture (A-234) | P10-3 | P10-1 |
| `create_layer` | `layer.create` | Yes | allow | P10-4 | P10-1 |
| `update_layer` | `layer.update` | Yes | allow | P10-4 | P10-1 |
| `update_layers` | `layer.updateMany` | Yes | allow | P10-4 | P10-1 |
| `delete_layer` | `layer.delete` | Yes | allow | P10-4 | P10-1 |
| `reorder_layers` | `layer.reorder` | Yes | allow | P10-4 | P10-1 |
| `propose_layout` | `generation.proposeLayout` | Yes | tick | P10-5 | P10-1 |
| `copy_options` | `generation.copyOptions` | Yes | tick | P10-5 | P10-1 |
| `cut_out` | `generation.cutOut` | Yes | tick | P10-5 | P10-1 |
| `delete_campaign` | `campaign.delete` | Yes | ask | P10-6 | P10-1 |
| `add_variant` | `variant.add` | No (Phase 5) | allow | P10-11 | Phase 5's `variant.add` |
| `delete_variant` | `variant.delete` | No (Phase 5) | ask | P10-11 | Phase 5's `variant.delete`; P10-6 |
| `set_translation` | `translation.set` | No (Phase 6) | allow | P10-12 | Phase 6's `translation.set` |
| `run_checks` | `check.run` | No (Phase 6) | allow | P10-12 | Phase 6's `check.run` |
| `get_check_results` | query `check.results` (A-236) | No (Phase 6 table) | both actors | P10-12 | Phase 6's `check.run` and `variant_check` row schema |
| `set_variant_format` | `variant.setFormat` | No (Phase 7) | allow | P10-13 | Phase 7's `variant.setFormat` |

Twelve can be built as soon as P10-1 merges. Six wait, each for exactly the command named.

## Scope

- [logic] The 18 tools above, one group file each slice owns (A-230), with allow-list replies and the tool-list snapshot updated as each lands.
- [logic] The ask flow and `agent.answerPermission`; `autoApproveDestructive` honoured and logged (P10-6).
- [logic] `agent.activity` and the agent's client name on every log line (P10-8).
- [logic] Bridge mode and the Claude Desktop field of `ConnectInfo` (P10-9).
- [logic] OI-25's fallback for `create_campaign` and its reply picker (P10-10).
- [UI] The permission dialog and the Settings checkbox for deletes without asking (P10-7); the agent activity line (P10-8); the Connect panel's Claude Desktop block (P10-9).

## Exit criteria

1. Workflow 5.7 passes with an MCP test client against the built app (`tests/e2e/mcp-workflow.spec.ts`, P10-14): steps 1 to 4 once P10-4 is in; step 5 once P10-12 is in; step 6 once P10-11 and Phase 5's sync are in.
2. An MCP test client changes a variant's format in both directions with no permission dialog (P10-13).
3. Named tests pass: `secret-leak.test.ts` over all 29 tools; `mcp-connect-info.test.ts`; "`render_variant` writes no file" (P10-3); "An agent `set_translation` never yields `approved`" (P10-12).
4. The ask flow: allow, refuse, time-out, busy and auto-approve each tested through `delete_campaign` (P10-6), and the dialog answers by keyboard (P10-7).
5. The tool-list snapshot holds 29 tools, and `tests/unit/main/mcp/tools/tool-plan.test.ts` finds no `notBuilt` row left.
6. **Hand checks by the stakeholder** (listed by P10-14, not run by agents): Claude Code places copy on a variant, the edits show live and can be undone; Claude Desktop connects through the bridge block; Windows (D-087).

## Rules for these slices

- Test first; one slice per developer run, well under 300k tokens; `HANDOFF.md` if near it.
- **Shared files.** Only P10-1 edits `src/main/mcp/tools/table.ts`, `src/main/mcp/tools/index.ts`, `src/main/mcp/agent-caller.ts`, `src/main/commands/bus.ts`, `src/main/core.ts`, `src/shared/schemas/events.ts`, `src/main/queries/queries.ts`, `src/shared/schemas/queries/mcp.ts`, `src/shared/schemas/commands/generation.ts`, `src/renderer/app/app-shell/app-shell.tsx`, `tests/integration/mcp/every-tool.ts` and `tests/unit/main/mcp/tools/table.test.ts`. Two named exceptions: P10-9 adds the bridge branch to `src/main/index.ts`; P10-12 may add one line to `queries.ts` (see that slice).
- **Tool rows.** P10-1 puts every new tool in a group file as a `notBuilt` row. A `notBuilt` row is not registered with the MCP server, so an agent never sees a tool that cannot work. The slice that owns the group file replaces its rows with full ones and touches no other tool file.
- **The two tool lists in tests.** Each tool slice adds its names to `BUILT_TOOLS` in `tests/integration/mcp/tool-client.ts`, at the place the table gives them, and updates the snapshot (`npx vitest run tests/integration/mcp/tool-list.test.ts -u`). These two files are the only test files two slices both edit. On a merge conflict in either, the merger re-applies the slice's names and re-makes the snapshot; the diff must only add that slice's tools (A-248).
- **Replies.** Every reply goes through a picker in the slice's own reply file that names every field. No reply holds a file path, file contents, a setting, a key, the token, the ComfyUI address, a tick or the limit, a signed address, a picture note, an approvals slug or a reviewer's email. Each slice's tests run `riskyKeys` and the word test over its recorded replies, success and refusal.
- **Security class.** Every slice that makes a command or query reachable by an agent is "full" and states what the agent can read and what it can change. A full slice merges only after its review.
- **Screens.** One folder per component, CSS from `src/renderer/ui/tokens.css` only, no new token. Shots in `tests/shots/p10-{n}.shots.ts`, picture names from 290 to 299.
- Nothing leaves the machine. No agent runs Claude Code's or Claude Desktop's own set-up against the user's accounts; those are the stakeholder's hand checks. No paid call: this phase adds no paid feature (the AI tools run the existing Phase 4 jobs under the tick); tests use the fake provider.

## Order and side-by-side work

| Slice | Needs | May run beside | Must not run beside |
|-------|-------|----------------|---------------------|
| P10-1 Contracts | Phases 1 to 4 | Any slice of another phase that edits none of its shared files | Any other phase's contracts slice or slice editing `core.ts`, `events.ts`, `queries.ts`, `bus.ts`, `generation.ts` (schemas) or `app-shell.tsx` |
| P10-2 Read tools | P10-1 | P10-3 to P10-10 | Nothing |
| P10-3 `render_variant` | P10-1 | P10-2, P10-4 to P10-10 | Phase 7 or 8 slices editing `src/main/thumbnails/` or `src/main/queries/render.ts`; any slice editing `src/main/assets/path-resolver.ts` |
| P10-4 Layer tools | P10-1 | P10-2, P10-3, P10-5 to P10-10 | Nothing |
| P10-5 AI tools | P10-1 | P10-2 to P10-4, P10-6 to P10-10 | Any slice editing `agent-job-view.ts` (none planned) |
| P10-6 Ask flow, `delete_campaign` | P10-1 | P10-2 to P10-5, P10-8 to P10-10 | Nothing |
| P10-7 Permission dialog | P10-6 | P10-8 to P10-10 | Any slice editing `mcp-section/` (none planned) |
| P10-8 Activity, client name | P10-1 | P10-2 to P10-7, P10-9, P10-10 | Nothing |
| P10-9 Bridge, Claude Desktop block | P10-1 | P10-2 to P10-8, P10-10 | Any slice editing `src/main/index.ts` or `connect-panel/` |
| P10-10 `create_campaign` fallback | P10-1 | P10-2 to P10-9 | Nothing |
| P10-11 Phase 5 tools | P10-2, P10-6; Phase 5's `variant.add`, `variant.delete`, out-of-date detail in `variant.get` | P10-12, P10-13 if their phases are in | P10-12, P10-13 (`variant-replies.ts`) at the same time |
| P10-12 Phase 6 tools | P10-2; Phase 6's `translation.set`, `check.run`, `variant_check` row | P10-11, P10-13 | P10-11, P10-13 (`variant-replies.ts`); any slice editing `queries.ts` |
| P10-13 Phase 7 tool | P10-2; Phase 7's `variant.setFormat`, clips in `variant.get` | P10-11, P10-12 | P10-11, P10-12 (`variant-replies.ts`) |
| P10-14 Workflow, shots, exit | Every other P10 slice | Slices of other phases | Nothing |

## Can start now

- **P10-1** needs only what Phases 1 to 4 built.
- As soon as P10-1 merges, with nothing from Phases 5 to 9: **P10-2, P10-3, P10-4, P10-5, P10-6, P10-8, P10-9, P10-10**, all side by side. P10-7 follows P10-6.

## Shared files

Files more than one slice, or another phase, is likely to edit:

- `src/main/core.ts`, `src/shared/schemas/events.ts`, `src/main/queries/queries.ts`, `src/shared/schemas/commands/generation.ts`: P10-1 here; the contracts slices of Phases 5 to 9.
- `src/main/commands/bus.ts`: P10-1 (the ask signature). No other phase is expected to.
- `src/main/index.ts`: P10-1 (removes one line), P10-9 (the bridge branch); Phase 8 or 9 window or sign-in work.
- `src/renderer/app/app-shell/app-shell.tsx`: P10-1 (two mounts); any phase adding a shell-level panel.
- `src/main/thumbnails/service.ts`, `types.ts`, `scene-input.ts`, `src/main/queries/render.ts`: P10-3; Phase 7 (clips, time) and Phase 8 (export frames).
- `src/main/assets/path-resolver.ts`: P10-3 (one function); any phase touching asset paths.
- `src/main/mcp/tools/variant-replies.ts`: P10-2 makes it; P10-11, P10-12, P10-13 each add one part.
- `src/main/mcp/tools/agent-job-view.ts`: P10-5 only.
- `tests/integration/mcp/tool-client.ts` and `tests/integration/mcp/__snapshots__/tool-list.test.ts.snap`: every tool slice (merge rule above).
- `src/renderer/screens/settings/mcp-section/mcp-section.tsx`: P10-7. `connect-panel/connect-panel.tsx`: P10-9.
- `tests/unit/renderer/fake-api.ts`: make-it-compile edits in P10-1 and P10-9.

## Design additions

Where the design is silent. The orchestrator folds these into `spec/mcp-and-agents.md`, `spec/api-queries-events.md`, `spec/api-commands.md`, `spec/security.md` and `spec/screens.md`.

**Tool rows and group files (A-230).** `ToolDef` gains `notBuilt?: true`, `content?: 'json' | 'png'` (default `json`) and `prepareInput?(input)`. `ALL_TOOLS` in `table.ts` joins the group files; `MCP_TOOLS = ALL_TOOLS.filter((t) => !t.notBuilt)` is what core registers. Group files: `campaign-tool.ts` (`create_campaign`, moved unchanged), `read-more-tools.ts`, `render-tool.ts`, `layer-tools.ts`, `ai-tools.ts`, `delete-tools.ts`, `variant-edit-tools.ts`, `translation-check-tools.ts`, `format-tool.ts`. Listing order: the 11 built tools as today, then the group files in that order.

**Inputs follow the built schemas (A-233).** The tool table's older input lists give way to the commands as built: `create_layer` takes `project_id, variant_id, type, values` (`layerCreateInput`); `update_layer` takes `project_id, layer_id, patch`; `update_layers` takes `project_id, variant_id, updates`; `render_variant` takes `project_id, variant_id, max_dimension` (`variantRenderInput`). `time_ms` arrives by itself when Phase 7 or 8 adds `timeMs` to `variantRenderInput`; `hide_text` is dropped. Replies are the command's own: `{ layerId }`, `{ layerIds }`, `{ variantId }`, through a picker.

**Ask flow (A-237 to A-240).**
- The bus passes `{ command, agentClient, projectId, input }` (the parsed input) to `askPermission`, which answers `true`, `false` or one of `'allowed' | 'refused' | 'timed_out' | 'busy'` (`true` is `allowed`, `false` is `refused`).
- Refusals, all `AGENT_REFUSED`: `refused` "The user did not allow this action."; `timed_out` "The user did not answer in time."; `busy` "Another request is waiting for the user's answer. Try again after it." Each with `details.reason`.
- One request at a time. A second ask while one is open is `busy` at once, with no event.
- `agent.permissionRequested` payload: `{ requestId, agentClient: string | null, action, target, expiresAt }`. `action` is the policy row's action text ("delete campaigns"). `target` is one line built by `askTarget` from the open project: `Campaign "{name}" ({n} variants) in "{project}"`, or for a variant `Variant "{title} · {sizeLabel} · {language}" in campaign "{name}"`; an unknown target gives "Something that no longer exists" and the command then refuses as usual. The payload holds no ID, no input and no path.
- The wait is 120 seconds (`ASK_WAIT_MS` in `src/shared/config/agent-ask.ts`). The window closes its dialog at `expiresAt`. An answer for a request that has ended is `NOT_FOUND` "That request has ended."
- `agent.answerPermission { requestId, allow, rememberAuto }`: user only (policy `deny` exists). `rememberAuto: true` with `allow: true` also saves `mcp.autoApproveDestructive = true`.
- With `autoApproveDestructive` true, no event is sent and the answer is `allowed`.
- Every outcome writes one log line `event: 'ask'`: command, agentClient, projectId, outcome (`allowed`, `refused`, `timed_out`, `busy`, `auto_approved`). No input values.

**Activity and the client name (A-241, A-242).** The client name is the MCP `clientInfo.name` from `initialize`, cleaned by `cleanClientName` (control and reordering characters removed, trimmed, cut to 60 code points; empty is null). It is passed as `agentClient` on every command an agent sends, so the bus's log lines carry it. Each tool call ends with one log line `event: 'tool'` (tool, agentClient, projectId, ok, errorKind; no arguments, no reply) and one `agent.activity` event `{ tool, projectId: string | null, ok, at }`. The client name is untrusted text: drawn as text content only.

**`mcp.status` is not built (A-243).** `app.stateChanged` with `mcp.getConnectInfo` already gives on, off and port. Connected client names are not shown.

**Bridge (A-244, A-245).** Kept: Claude Desktop's config file starts local servers over stdio and does not take an address with a header; its connectors are reached from Anthropic's side, not from `127.0.0.1`. `ConnectInfo` gains `claudeDesktop: string | null`, the JSON text `{"mcpServers":{"adman":{"command":"{exe}","args":[...]}}}` with `args` `["--mcp-bridge"]` in a packaged app and `["{appPath}", "--mcp-bridge"]` unpackaged; null while the setting is off. It holds no token: the bridge reads it itself.

**`list_subjects` (A-235).** Query `subject.list { projectId }`, both actors: `Array<{ id, name, description, assetIds }>`, subjects by ID, `assetIds` the IDs of asset rows whose `subject_id` is the subject, by ID.

**`get_check_results` (A-236).** Query `check.results { projectId, campaignId }`, both actors: per variant of the campaign, its latest stored check row and whether it is stale (`checkedRev < rev`). Fields picked from Phase 6's `VariantCheckRow`.

**`render_variant` and linked pictures (A-234).** Ruled by the stakeholder: the agent's picture is the complete ad, every layer drawn wherever its source file lives, the same picture the user sees. `variant.render` for the agent actor draws managed and linked assets alike and leaves nothing out. The limits that stay: the reply is the drawn PNG only (no path, file name or hash of any source), the size cap of `max_dimension`, and the asset rules already in force for linked files (a linked path is one the user chose through a picker or relink; a project file cannot make the app read a new path by itself, `spec/assets.md`). P10-3 tests that a linked picture outside the project folder is drawn for the agent and that no path reaches the reply or a log.

**AI tool results (A-232).** `agentJobView` adds: `assetIds` for a `cutout` job (from `result.assetIds`, strings only); `layout: { boxes }` for a succeeded `layout_proposal` (each box's `slot, x, y, width, height, fontSize, align, color`, numbers and strings only); `copyOptions: string[]` for a succeeded `copy_options`. Nothing else of `result`.

**`create_campaign` (A-246).** The tool's `sizes` and `languages` become optional (`campaignCreateAgentInput`). `prepareInput` fills them before the command: sizes from `brief.sizes` through `parseSize`, else the brief form's three default sizes; languages from `brief.languages`, else `primaryLanguageFor(brief.region)`. Reply picker `{ campaignId, directionId, variantId }`.

**Tool words (A-247).** `src/main/mcp/tools/tool-words.ts` owns `LEAVE_THE_CHOICE` (the built sentence) and `PROVIDER_WORDS`. Every run tool and every tool that can put an asset on a layer (`create_layer`, `update_layer`, `update_layers`) carries it.

**`get_variant` reply (A-249).** The variant as `get_campaign` gives it, every layer field of `LayerRow`, the assets with `id, displayName, kind, library, subjectId, width, height, durationMs, fontFamily, missing` (never `absPath`, `relPath`, `contentHash`, `mime`, `byteSize`, `mtimeMs`), and `campaignId`. Fields Phases 5 to 7 add to `variant.get` stay out until P10-11, P10-12 and P10-13 add them.

## Assumptions

| ID | Assumption | Undo |
|----|------------|------|
| A-230 | Not-built tools are in the table but not listed to agents; each group file belongs to one slice | Easy |
| A-231 | Four tools beyond the 14: `propose_layout`, `copy_options`, `cut_out`, `update_layers`; 29 in all | Easy |
| A-232 | An agent reads a layout's boxes, copy options and a cut-out's asset ID through `get_job` | Easy |
| A-233 | Tool inputs and replies follow the built command schemas; `hide_text` dropped | Easy |
| A-234 | `render_variant` draws the complete ad for an agent, linked pictures outside the project's folder included (stakeholder ruling) | Settled |
| A-235 | `list_subjects` wraps a new query `subject.list` | Easy |
| A-236 | `get_check_results` wraps a query `check.results`, P10-12's unless Phase 6 builds it | Easy |
| A-237 | One ask at a time; a second is refused `busy` | Easy |
| A-238 | The permission event holds action text and a target line, no IDs or input | Easy |
| A-239 | Dialog: focus on Refuse, Escape refuses, "Don't ask again for deletes" off by default | Easy |
| A-240 | Every ask outcome is one `event: 'ask'` log line | Easy |
| A-241 | `agent.activity` is `{ tool, projectId, ok, at }`; the shell shows a line for 10 seconds | Easy |
| A-242 | The client name comes from MCP `clientInfo.name`, cleaned, cut to 60 | Easy |
| A-243 | No `mcp.status` event | Easy |
| A-244 | Bridge mode is built; the stakeholder checks Claude Desktop by hand | Medium |
| A-245 | `claudeDesktop` is a JSON text with no token | Easy |
| A-246 | `create_campaign` falls back for missing sizes and languages (OI-25) in the tool | Easy |
| A-247 | One file owns the tool words | Easy |
| A-248 | The tool list in tests and the snapshot are re-made on a merge conflict | Easy |
| A-249 | `get_variant` gives asset names and sizes, never asset paths or hashes | Easy |

## Open questions

1. **May an agent see pictures a project links from outside its folder?** (OI-92, U-2.) Settled by the stakeholder: yes. The agent's rendered preview is the complete picture with every layer, wherever its source comes from (A-234).
2. **Who builds `check.results`?** Phase 6 stores the checks and shows results on its screen. *Recommendation:* the Phase 6 architect builds `check.results { projectId, campaignId }` with the shape in A-236; P10-12 then only adds the tool. If Phase 6 does not, P10-12 builds it.
3. **OI-25:** fall back, or require sizes and languages? *Recommendation:* fall back (A-246), as `spec/mcp-and-agents.md` already plans.
4. **Translation by an agent** (`translation.propose`, Phase 6's open item) has no tool in this plan. If Phase 6 opens it, it is one more row in `translation-check-tools.ts`.

## Found in the existing design

- `spec/mcp-and-agents.md` lists 25 tools with inputs for `create_layer`, `update_layer` and `render_variant` that differ from the built commands (A-233); this plan gives 29.
- `spec/security.md`, "Rules: agents and cost", says "the agent cannot place the result"; the Phase 10 outline and D-059 say an agent may pick one. The outline's wording is used.
- `spec/data-model-campaign.md` says "No command bumps `variant.rev` yet"; the layer commands do, and `tests/integration/commands/layer-update-agent.test.ts` is built.
- `spec/mcp-and-agents.md`, "Named tests", says the snapshot holds 8 tools; it holds 11.
- `spec/api-queries-events.md` gives `agent.permissionRequested` a `tool` field; the bus knows the command, not the tool (A-238). It lists `mcp.status` as Phase 10; the outline does not (A-243).
- `src/main/index.ts` passes `askPermission: async () => false`; the bus sends only the command and client, so no dialog could name the target (P10-1 fixes the signature).

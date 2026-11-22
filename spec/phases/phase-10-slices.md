# Phase 10: the slices

P10-1 to P10-15 (P10-15 was added later and merges before P10-14). Rules, exit criteria, the wave table, the design additions and the assumptions are in `spec/phases/phase-10.md`. Design: `spec/mcp-and-agents.md`, `spec/agent-runs.md`, `spec/api-principles.md`, `spec/api-commands.md`, `spec/api-queries-events.md`, `spec/security.md`, `spec/screens.md`, `spec/testing.md`.

Every slice reads `spec/phases/DEV-RULES.md` first, then `spec/phases/phase-10.md` ("Rules", "Design additions"), then the sections named below.

**The five shared tool-list test files** every tool slice edits (merge rule: `phase-10.md`, "Rules"): `BUILT_TOOLS` in `tests/integration/mcp/tool-client.ts`; the tool-list snapshot; `STILL_NOT_BUILT` in `tests/unit/main/mcp/tools/tool-plan.test.ts` (a unit test; it is not under `tests/integration/mcp/`); `tests/integration/mcp/reply-words.test.ts` (one row per tool, in tool list order); `SECTION_4_5_TOOLS` in `tests/integration/mcp/no-tools.test.ts`.

---

### P10-1 — Contracts (built)

- **Exists when done:** every new tool is a `notBuilt` row in its group file; the tool registration handles `notBuilt`, picture replies, `prepareInput`, the client name and a call hook; the bus hands the ask its project and input and maps the four answers; the permission broker, the activity recorder and the client-name cleaner exist as stubs wired in core; `agent.answerPermission` and `subject.list` are registered against stubs; the two new events and `ConnectInfo.claudeDesktop` exist; the shell mounts two empty components.
- **New files:**
  - `src/main/mcp/tools/not-built.ts`: `notBuilt(name, kind, target): ToolDef` (input `z.object({})`, description "Not built yet.", `notBuilt: true`).
  - Group files, each exporting one array of `notBuilt` rows: `read-more-tools.ts` (`list_subjects` → `subject.list`, `get_variant` → `variant.get`); `render-tool.ts` (`render_variant` → `variant.render`); `layer-tools.ts` (`create_layer`, `update_layer`, `update_layers`, `delete_layer`, `reorder_layers`); `ai-tools.ts` (`propose_layout`, `copy_options`, `cut_out`); `delete-tools.ts` (`delete_campaign`); `variant-edit-tools.ts` (`add_variant`, `delete_variant`); `translation-check-tools.ts` (`set_translation`, `run_checks`, `get_check_results` → `check.results`); `format-tool.ts` (`set_variant_format`). `campaign-tool.ts`: the built `create_campaign` row moved out of `table.ts` unchanged.
  - `src/main/mcp/tools/tool-words.ts`: `LEAVE_THE_CHOICE` and `PROVIDER_WORDS` moved from `run-tools.ts` (same text; `run-tools.ts` imports them).
  - Stubs: `src/main/mcp/permissions.ts` (`createPermissionBroker({ emit, settings, log, now, projects })`: `ask` answers `'refused'`, `answer` throws `NOT_FOUND` "That request has ended."); `src/main/mcp/activity.ts` (`createAgentActivity({ emit, log, now })`: `record(call)` does nothing); `src/main/mcp/client-name.ts` (`cleanClientName(raw): string | null` answers null); `src/main/commands/agent/index.ts` and `answer-permission.ts` (the command, user only by its `deny` row, calling `broker.answer`); `src/main/queries/subject-list.ts` (refuses with `RULE_VIOLATION` "This is not built yet." `details.reason: 'not_built'`).
  - Schemas: `src/shared/schemas/commands/agent.ts` (`agentAnswerPermissionInput = { requestId: string, allow: boolean, rememberAuto: boolean }`, strict); `src/shared/schemas/queries/subject.ts` (`subjectListInput = projectScoped`, type `SubjectList`); `src/shared/config/agent-ask.ts` (`ASK_WAIT_MS = 120_000`).
  - Renderer stubs returning null: `src/renderer/app/permission-dialog/` and `src/renderer/app/agent-activity/` (each `index.ts` and its `.tsx`).
- **May touch:** `src/main/mcp/tools/table.ts` (`ALL_TOOLS`, `MCP_TOOLS` filter, the `ToolDef` fields); `src/main/mcp/tools/index.ts` (skip `notBuilt`; `content: 'png'` gives one MCP image item `{ type: 'image', data: base64, mimeType: 'image/png' }` from `data.png`, nothing else; `prepareInput` after the snake-case mapping; `toolSetup(table, providers, hooks?)` with `hooks.onCall({ tool, agentClient, projectId, ok, errorKind })` after every call; the client name from `server.server.getClientVersion()?.name` through `cleanClientName`); `src/main/mcp/tools/run-tools.ts` (imports from `tool-words.ts`); `src/main/mcp/agent-caller.ts` (`execute(name, input, agentClient?)`); `src/main/commands/bus.ts` (`PermissionRequest` gains `projectId`, `input`; `askPermission` returns `Promise<boolean | AskAnswer>`; `askCheck` maps answers to the three refusals of the design additions); `src/main/core.ts` (broker, activity, `askPermission: opts.askPermission ?? broker.ask`, `agentCommands(broker)` spread line, `onCall: activity.record`); `CoreOptions.askPermission` becomes optional; `src/main/index.ts` (remove `askPermission: async () => false`, nothing else); `src/main/queries/queries.ts` (one line for `subjectListQueries`); `src/shared/schemas/events.ts` (`agent.permissionRequested`, `agent.activity` with the design-addition payloads; `EVENT_NAMES`); `src/shared/schemas/queries/mcp.ts` (`claudeDesktop: string | null`) and `src/main/queries/mcp.ts` (answers null); `src/shared/schemas/commands/generation.ts` (`generationCutOutAgentInput`, the input without `licenceConfirmed`); the reasons list in `spec/api-principles.md`'s code home, if typed (`not_built`, `refused`, `timed_out`, `busy`); `src/renderer/app/app-shell/app-shell.tsx` (mount `<PermissionDialog />` and `<AgentActivity />`, two lines and imports).
- **Needs:** Phases 1 to 4 as built.
- **Tests first:**
  - `tests/unit/main/mcp/tools/tool-plan.test.ts`: `ALL_TOOLS` names equal the 29 of `spec/phases/phase-10.md`, in the listing order of its design additions (A-230); each name once; each `notBuilt` row names a target; no `notBuilt` row is in `MCP_TOOLS`. (A placeholder test per `spec/testing.md`: each tool slice removes its names from a `STILL_NOT_BUILT` list in this file; P10-14 checks it is empty.)
  - `tests/unit/main/mcp/tools/tool-setup-hooks.test.ts` (table test with its own made-up rows): a `notBuilt` row is not registered; a `png` row gives one image item and no text; `prepareInput` runs before the call; `onCall` sees tool, ok and errorKind; a client name reaches `execute`.
  - `tests/integration/commands/ask-answers.test.ts` (table): `askPermission` answering `true`, `false`, `'allowed'`, `'refused'`, `'timed_out'`, `'busy'` gives run, refused, run, refused, timed out, busy, each with its reason; the request carries `projectId` and the parsed input; nothing written on a refusal.
  - `tests/integration/agent/answer-permission-stub.test.ts`: the agent gets `AGENT_DENIED`; the user gets `NOT_FOUND` "That request has ended."
  - `tests/unit/shared/schemas/agent-schemas.test.ts`: the answer input refuses unknown keys and missing fields.
  - Approved edits: `tests/unit/main/mcp/tools/table.test.ts` (add `subject.list`, `variant.get`, `variant.render`, `check.results` to the allowed queries; add `generation.proposeLayout`, `generation.copyOptions`, `generation.cutOut` to `TICK_TARGETS`); `tests/integration/mcp/every-tool.ts` (add `layer_id`, `layer_ids`, `values`, `patch`, `updates`, `type`, `max_dimension`, `direction_id`, `size_label`, `language`, `format`, `text`, `apply_to_same_language`, `variant_ids`, `request_id`); `tests/integration/mcp/secret-leak.test.ts` (plant a stored approvals link with a made-up reviewer email and gallery address, if not planted already); registration tests that list command, query or event names exactly; `tests/unit/renderer/fake-api.ts` and any hand-built `ConnectInfo` (make-it-compile: `claudeDesktop: null`).
- **Exit check:** class E + B + D: lint, typecheck, `npm test`; the tool-list snapshot is unchanged (no tool added or changed).
- **Security:** short (the bus ask path, the agent caller, events to the window). No agent-reachable change: every new tool is unlisted; the stub broker refuses as today.
- **Size:** medium.

### P10-2 — Read tools: `list_subjects`, `get_variant` (built)

- **Exists when done:** both tools listed and working; `subject.list` built.
- **New files:** the body of `src/main/queries/subject-list.ts`; the rows of `read-more-tools.ts`; `src/main/mcp/tools/variant-replies.ts` (`subjectListFields`, `variantFields` per A-249).
- **May touch:** the five shared tool-list test files.
- **Needs:** P10-1.
- **Agent reads:** subject names and descriptions, asset IDs per subject; one variant's fields, every layer value, asset names, kinds and sizes. **Never:** an asset path, hash or MIME type; the brief's picture paths or notes (not stored); approvals data. **Agent changes:** nothing.
- **Tests first:** `tests/integration/queries/subject-list.test.ts` (both actors; unknown project `NOT_FOUND`; asset IDs in ID order; a damaged subject row left out and logged); `tests/integration/mcp/read-more-tools.test.ts` (each tool over a project with every asset column filled and a linked asset outside the folder: no path in the reply; `riskyKeys` empty; the word test; an unknown variant `NOT_FOUND` as a tool error); a picker unit test naming every field.
- **Exit check:** class E + B.
- **Security:** full. **Size:** small.

### P10-3 — `render_variant` (built)

- **Exists when done:** the agent gets one PNG of a variant drawn in memory, the complete ad with every layer, linked pictures outside the project's folder included (A-234, stakeholder ruling); the user's `variant.render` is unchanged.
- **New files:** the row of `render-tool.ts` (`content: 'png'`, picker `pngOnly` taking `png` from `VariantRender`; inputs `project_id`, `variant_id`, `max_dimension`, `time_ms`).
- **May touch:** `src/main/queries/render.ts` (the agent's draw shows every layer wherever its source lives, A-234; no source is dropped); the shared tool-list test files (`phase-10.md`, "Rules").
- **Needs:** P10-1.
- **Agent reads:** the pixels of the complete variant, every layer drawn, linked pictures included wherever they live (A-234, stakeholder ruling). The reply is the PNG only. **Never:** a path, a file name, a hash or an `adman-asset://` address of any source. **Agent changes:** nothing; no file written, no row, no event.
- **Tests first:** the named test `tests/integration/mcp/render-variant-no-file.test.ts` (`spec/testing.md`, with a stand-in `drawScene` returning a fixed PNG; lists the four folders before and after; one `image/png` item; no path); `tests/integration/queries/variant-render-agent.test.ts` (the scene input given to the stand-in keeps every source, a linked picture outside the project folder included, and the font; no path in the reply or a log line).
- **Exit check:** class E + C (the reference-picture spec must still pass).
- **Security:** full. **Size:** medium.

### P10-4 — Layer tools (built)

- **Exists when done:** `create_layer`, `update_layer`, `update_layers`, `delete_layer`, `reorder_layers` listed and working; edits by an agent stamp `agent_changed_at` and land on the variant's undo list.
- **New files:** the rows of `layer-tools.ts`; `src/main/mcp/tools/layer-replies.ts` (`layerIdOnly`, `layerIdsOnly`, `variantIdOnly`).
- **May touch:** the five shared tool-list test files.
- **Needs:** P10-1.
- **Agent reads:** the layer or variant ID it changed. **Agent changes:** layers of open projects, any field the command accepts, any asset of the project as a source (a pick is allowed; descriptions carry `LEAVE_THE_CHOICE`). Policy `allow`, rows exist.
- **Tests first:** `tests/integration/mcp/layer-tools.test.ts` (table over the five: success through the tool equals the same command sent by the user apart from the actor; `project.changed` has `actor: 'agent'`; `variant.agent_changed_at` set, the FR-239 test through a tool; the user can undo each with `history.undo` on `variant:{id}`; each refusal comes back as the command's own code and message; a closed project `NOT_FOUND`; `riskyKeys` and the word test).
- **Exit check:** class E + B.
- **Security:** full. **Size:** small.

### P10-5 — AI tools: `propose_layout`, `copy_options`, `cut_out` (built)

- **Exists when done:** the three start tools work under the tick, one at a time through the shared serial; `get_job` shows a layout's boxes, copy options and a cut-out's asset ID (A-232).
- **New files:** the rows of `ai-tools.ts` (`oneAtATime`, reply `jobIdOnly`; `cut_out` uses `generationCutOutAgentInput`; descriptions name `get_job` and, for a layout, `update_layers`).
- **May touch:** `src/main/mcp/tools/agent-job-view.ts`; `tests/unit/main/mcp/tools/agent-job-view.test.ts` (new cases only); the five shared tool-list test files.
- **Needs:** P10-1. The gate rows exist (Phase 4).
- **Agent reads:** a job ID; through `get_job`, the boxes (numbers, a key, an alignment, a colour), the option texts, the cut-out's asset ID. **Never:** the request, the prompt sent, the model, the server's words. **Agent changes:** starts runs only for a ticked provider within the limit; cannot confirm a licence.
- **Tests first:** `tests/integration/mcp/ai-tools.test.ts` (table: each tool refused unticked, over the limit and with an unknown provider, with no job row; ticked, a job with `startedBy: 'agent'` from the fake provider; two calls sent together run one at a time; `licence_confirmed` is not in the published input); agent-job-view cases (each kind gives only the named fields over a result with extra planted keys; a failed layout job gives no `layout`).
- **Exit check:** class E.
- **Security:** full. **Size:** small to medium.

### P10-6 — The ask flow and `delete_campaign` (built)

- **Exists when done:** an agent's `delete_campaign` asks the user and waits; allow runs it, refuse or time-out refuses, a second ask is busy, auto-approve skips the ask; `agent.answerPermission` works.
- **New files:** the bodies of `src/main/mcp/permissions.ts` and `src/main/commands/agent/answer-permission.ts`; `src/main/mcp/ask-target.ts` (`askTarget(projects, request): string`, the target lines of the design additions); the row of `delete-tools.ts` (reply `{ campaignId }`; description says the user is asked every time, the agent waits up to two minutes, and a refusal is final).
- **May touch:** the five shared tool-list test files.
- **Needs:** P10-1.
- **Agent reads:** the outcome only. **Never:** the dialog's wording beyond the refusal sentence, the setting. **Agent changes:** deletes a campaign only after the user's allow, or with the user's auto-approve on; cannot answer a request (`agent.answerPermission` is `deny`), cannot change `autoApproveDestructive` (`settings.update` is `deny`).
- **Tests first:** `tests/integration/mcp/ask-flow.test.ts` (fake clock: allow runs the delete and `project.changed` follows; refuse, time-out at 120 s, busy, each `AGENT_REFUSED` with its reason and nothing written; the event payload holds exactly the five fields and no ID; auto-approve sends no event and writes the `auto_approved` log line; an answer after the end `NOT_FOUND`; the project closed during the wait gives the command's own `NOT_FOUND`; `rememberAuto` saves the setting; the agent sending `agent.answerPermission` gets `AGENT_DENIED`); `tests/unit/main/mcp/ask-target.test.ts` (each line; a name with control characters cleaned; unknown target).
- **As built:** a request ended because its project closed during the wait writes the `event: 'ask'` log line with outcome `project_closed`.
- **Exit check:** class E + B.
- **Security:** full. **Size:** medium.

### P10-7 — Permission dialog and the delete setting (built, with its follow-up P10-7b)

- **Exists when done:** the dialog shows on `agent.permissionRequested` and answers; Settings has the checkbox for deletes without asking.
- **New files:** the body of `src/renderer/app/permission-dialog/` (Radix Dialog, its CSS module from tokens); `src/renderer/screens/settings/auto-approve-setting/`.
- **May touch:** `src/renderer/screens/settings/mcp-section/mcp-section.tsx` (mount, a few lines); `src/main/mcp/ask-target.ts` (`clean()`: turn `"` into `'`, collapse each run of white space to one space, cut each name to 60 code points ending in "…"; from the P10-6 review, needed because the dialog shows this line) and `tests/unit/main/mcp/ask-target.test.ts` (one row per rule).
- **The client name** in the dialog is text the agent chose. It is drawn as text only and shown as the agent's own label, never as something Adman checked.
- **Needs:** P10-6.
- **Words** (as built with P10-7b): title "An agent asks to delete"; body "{agent} wants to {action}: {target}." where `{agent}` is "Agent named {client name}" or "An agent"; the variant target line names the project (` in "{project}"`), and a count of one reads "(1 variant)"; a cost line under the body (D-099: deletes have no undo): for a variant "This cannot be undone. It also clears the undo list of this campaign.", for a campaign "This cannot be undone."; "Answer within 2 minutes."; checkbox "Don't ask again for deletes"; buttons "Refuse" (focused first) and "Allow". "Allow" can be pressed only 750 ms after the dialog opens. Escape refuses. At `expiresAt` the dialog closes with no answer. Settings checkbox under Agent access: "Let agents delete campaigns and variants without asking", with the line "An agent can then delete work with no click from you. Deletes cannot be undone, and deleting a variant clears its campaign's undo list." Saved with `settings.update { mcp: { autoApproveDestructive } }`. The shared dialog frame gained an optional `describedBy`.
- **Name cleaning** (as built): one cleaner, `cleanName` in `src/main/mcp/clean-name.ts`, for the target names and the client name (`spec/phases/phase-10.md`, "Activity and the client name"). A tool call that throws is logged too (`errorKind` `INTERNAL`).
- **Tests first:** `tests/unit/renderer/app/permission-dialog.test.tsx` (keyboard path; axe; Refuse focused; Escape sends `allow: false`; the client name with markup shows as text; closes at `expiresAt` with nothing sent; a refused answer shows its message); `tests/unit/renderer/screens/settings/auto-approve-setting.test.tsx`. Shots `tests/shots/p10-7.shots.ts`: 290 the dialog, 291 the dialog with a long target, 292 the Settings checkbox.
- **Exit check:** class D + `npm run test:e2e`.
- **Security:** short. **Size:** small to medium.

### P10-8 — Activity, the client name, agent marking (built)

- **As built:** the line reads "Agent working: {tool}", then " · {project name}" when the project is open in the app.

- **Exists when done:** every tool call writes one `event: 'tool'` log line and sends `agent.activity`; commands from an agent carry the cleaned client name; the shell shows the activity line.
- **New files:** the bodies of `src/main/mcp/activity.ts`, `src/main/mcp/client-name.ts` and `src/renderer/app/agent-activity/` ("Agent working: {tool}", plus the project's name from the app store's open projects when known; `role="status"`; hidden 10 seconds after the last event).
- **Needs:** P10-1.
- **Agent reads:** nothing new. **Window gets:** tool name, project ID, ok, time; never arguments or replies.
- **Tests first:** `tests/unit/main/mcp/client-name.test.ts` (table: control, reordering and zero-width characters gone; 61 code points cut to 60; empty is null); `tests/integration/mcp/activity.test.ts` (one log line and one event per call, success and refusal; no argument value in either; the bus's command line carries `agentClient`); `tests/unit/renderer/app/agent-activity.test.tsx` (shows, then hides after 10 s with fake timers; a tool name with markup as text). Shots `tests/shots/p10-8.shots.ts`: 293 the line, 294 with a project name.
- **Exit check:** class E + D.
- **Security:** short. **Size:** small.

### P10-9 — Bridge mode and the Claude Desktop block (built)

- **As built:** see `spec/mcp-and-agents.md`, "Bridge mode". `--mcp-bridge` on the command line is the only switch. No stderr text at all (not even fixed sentences); an error never opens a box. Hand checks and owed hardening are listed there.

- **Exists when done:** `"{app}" --mcp-bridge` relays MCP between stdio and `http://127.0.0.1:{port}/mcp`; `ConnectInfo.claudeDesktop` is filled; the Connect panel shows the second block.
- **New files:** `src/main/bridge/run-bridge.ts` (no window, no single-instance lock; reads `mcp.port` from `settings.json` and `mcp.token` from `secrets.bin` with `safeStorage` after `app.whenReady()`); `src/main/bridge/relay.ts` (Electron-free: the SDK's `StdioServerTransport` to `StreamableHTTPClientTransport` with the bearer header, each message passed on unchanged); `src/main/bridge/closed-answer.ts` (with the app not running, the setting off or no token: every request answered with a JSON-RPC error "Open the app and turn on agent access in Settings."; notifications dropped); `src/renderer/screens/settings/connect-panel/desktop-block/`.
- **May touch:** `src/main/index.ts` (the branch at the top: with `--mcp-bridge` in `process.argv`, run the bridge and nothing else); `src/main/queries/mcp.ts` (build `claudeDesktop`); `connect-panel/connect-panel.tsx` (mount); `tests/unit/renderer/fake-api.ts` (make-it-compile).
- **Needs:** P10-1.
- **Rules:** stdout carries only MCP messages; stderr only fixed sentences; the token is in neither, nor in any log line. The bridge writes no file. It sends nothing but to `127.0.0.1`.
- **Tests first:** `tests/integration/bridge/relay.test.ts` (in-process: a client on a stream pair, through the relay, to the real server, lists the tools and calls `list_projects`; a wrong token gives the closed answer; the server off gives the closed answer; no token in anything written to the two streams); `tests/integration/queries/mcp-connect-info-desktop.test.ts` (the JSON text for packaged and unpackaged; null while off; no token in it); `connect-panel` component test (the block as text, Copy). Shots `tests/shots/p10-9.shots.ts`: 295 both blocks, 296 the setting off. `tests/e2e/bridge.spec.ts`: the built app started with `--mcp-bridge` opens no window and answers `initialize`.
- **Exit check:** class E + G (`npm run test:e2e -- tests/e2e/bridge.spec.ts`) + D.
- **Security:** full (reads the token, a new way in). **Size:** medium.

### P10-10 — `create_campaign`: the fallback and its reply (built; OI-25 settled by it)

- **Exists when done:** sizes and languages may be left out by an agent (A-246); the reply goes through a picker.
- **New files:** `src/shared/campaign/create-defaults.ts` (pure `fillCreateDefaults(input)`); `src/shared/schemas/commands/campaign-agent.ts` (`campaignCreateAgentInput`); `src/main/mcp/tools/campaign-replies.ts` (`createdFields`). If the three default sizes live only in the renderer, they move to `src/shared/config/default-sizes.ts` and the brief form imports them (one import line).
- **May touch:** `campaign-tool.ts`; the brief form's file that holds the default sizes (import only); the snapshot.
- **Needs:** P10-1.
- **Agent reads:** three IDs. **Agent changes:** as today, plus defaults filled for it.
- **Tests first:** `tests/unit/shared/campaign/create-defaults.test.ts` (table: both given; sizes from the brief; bad brief sizes skipped; none, the defaults; languages from the brief; none, the region's language; an unknown region refused by the command as before); `tests/integration/mcp/create-campaign-fallback.test.ts` (the reply holds exactly three IDs).
- **Exit check:** class E + A.
- **Security:** full. **Size:** small.

### P10-11 — Phase 5 tools: `add_variant`, `delete_variant` (built)

- **Exists when done:** both listed; `delete_variant` asks as `delete_campaign` does. `get_variant` gives only the `outOfDate` badge, not a detail of what is out of date (A-165; the detail is `sync.preview`'s, which agents have no tool for).
- **As built:** a delete has no undo (D-099), and deleting a variant clears the campaign's undo list (A-141); the tool description says both. The test line below about undoing the delete does not apply.
- **New files:** the rows of `variant-edit-tools.ts`. Targets for `askTarget`'s variant line are already in P10-6.
- **May touch:** `variant-replies.ts` (the out-of-date part, its fields named); the five shared tool-list test files.
- **Needs:** Phase 5's `variant.add` and `variant.delete` commands and the out-of-date detail in `variant.get` (the Phase 5 slices that build them); P10-2; P10-6.
- **Agent changes:** adds a variant as one fan-out cell with fit `scale` and no translation job (`spec/mcp-and-agents.md`); deletes one only after the user's allow; a master is refused by the command.
- **Tests first:** `tests/integration/mcp/variant-edit-tools.test.ts` (add: the cell, `createdBy: 'agent'`, text layers in another language `missing`; a taken cell refused; delete: allow, refuse, a master refused; the user can undo the delete from the campaign list).
- **Exit check:** class E + B. **Security:** full. **Size:** small.

### P10-12 — Phase 6 tools: `set_translation`, `run_checks`, `get_check_results` (built)

- **Exists when done:** the three tools listed; the named test "An agent `set_translation` never yields `approved`" passes. `get_variant` carries only the check badges (`checkWarning`, `checkStale`; A-165); the results are `get_check_results`'.
- **As built:** `run_checks` by an agent replaces the variant's stored check row (`ranBy: 'agent'`), the user's included; export runs the checks again itself. `variant-replies.ts` has no check part (the "May touch" line below named one that does not exist). The P10-5 review lows went in here.
- **New files:** the rows of `translation-check-tools.ts`; `src/main/mcp/tools/check-replies.ts`. If Phase 6 built no `check.results`: `src/main/queries/check-results.ts` and one line in `src/main/queries/queries.ts`.
- **May touch:** `variant-replies.ts` (the check part); the five shared tool-list test files.
- **Needs:** Phase 6's `translation.set`, `check.run` and the `variant_check` row schema; P10-2.
- **Agent changes:** sets text, always `proposed`, `translation_source: 'agent'`; runs checks (writes check rows). Cannot approve (`translation.approve` is `deny`).
- **Tests first:** `tests/integration/mcp/translation-check-tools.test.ts` (the named test, with `apply_to_same_language` both ways; check results with a stale variant; replies through `riskyKeys`).
- **Exit check:** class E + B. **Security:** full. **Size:** small to medium.

### P10-13 — Phase 7 tool: `set_variant_format` (built; its input is `variantSetFormatBaseInput`, without the undo-only fields)

- **Exists when done:** the tool changes format both ways with no dialog [D-025]; `get_variant` gives the clips (IDs, asset IDs, times, placement; no path).
- **New files:** the row of `format-tool.ts`.
- **May touch:** `variant-replies.ts` (the clip part); the five shared tool-list test files.
- **Needs:** Phase 7's `variant.setFormat` and clips in `variant.get`; P10-2.
- **Tests first:** `tests/integration/mcp/format-tool.test.ts` (image to video and back; no `agent.permissionRequested` sent; a taken cell `RULE_VIOLATION`; the user's undo works).
- **Exit check:** class E. **Security:** full. **Size:** small.

### P10-15 — The agent undo guard (built; the count is taken at check time, so a batch of 100 passes)

- **Exists when done:** A-261 holds: an agent command that would be the 101st agent entry in a row on one undo list since the user last acted there is refused with nothing written; any user action on that list resets the count.
- **New files:** none needed; a small helper file beside `undo-lists.ts` is allowed if it keeps that file under 200 lines.
- **May touch:** `src/main/history/undo-lists.ts` (a per-list count of agent entries in a row; reset by a user entry, a user undo or a user redo; never by an agent's undo or redo); `src/main/commands/bus.ts`, only the place where an inverse is recorded (`recordUndo` and the check before it), a named exception to the P10-1 rule. The refusal is `RULE_VIOLATION`, `details.reason: 'agent_undo_limit'`, "This ad has too many agent changes in a row. Ask the user to look before going on."; if reasons are typed in a shared list, add it there (one line, named in the report). The refusal must leave nothing written: if the list is known only from the command's result, the check runs before the command's write is kept, so the refusal undoes it. If that cannot be done in these files, stop and report.
- **Needs:** P10-4 (agent layer edits land on undo lists).
- **Agent reads:** the refusal sentence only. **Agent changes:** nothing new; it loses the 101st change in a row.
- **Tests first:** `tests/integration/history/agent-undo-guard.test.ts`: 100 agent edits on one variant pass and the 101st is refused `RULE_VIOLATION`, `agent_undo_limit`, with the variant and its `rev` unchanged and no event; one user edit in between resets the count (100 more pass); a user undo or redo resets it; an agent's undo does not; an agent layer delete followed by 100 agent edits can still be undone back to the delete by the user, and the layer returns; two undo lists count apart. A unit table for the count in `undo-lists.ts`.
- **Exit check:** class E + B. **Security:** full (shared code every agent edit passes through; keeps the user able to undo an agent's work). **Size:** small. Must merge before P10-14.

### P10-14 — Workflow 5.7, shots, exit check

- **Exists when done:** the phase's exit criteria are met or listed as the stakeholder's.
- **New files:** `tests/e2e/mcp-workflow.spec.ts` (the built app with fake providers; an MCP client from the test process: read the campaign, render each variant, create and move text layers, see `project.changed` in the window, undo one; then a translation set and shown unapproved; then a master edit marking linked variants out of date); `tests/shots/p10-14.shots.ts`: 297 the campaign after an agent's edits, 298 a variant tab with an agent-made layer, 299 the activity line during the run.
- **May touch:** `tool-plan.test.ts` (assert `STILL_NOT_BUILT` is empty).
- **Needs:** every other P10 slice, P10-15 (the agent undo guard) included.
- **Also:** read every tool description once against A-247 and the rules for every tool; report wording changes needed (the owning slice's file is edited here only for words). List for the stakeholder: Claude Code places copy on a variant by hand; Claude Desktop through the bridge block; Windows. List for the orchestrator: the topic-file edits from "Design additions".
- **Exit check:** class E + D + `npm run test:e2e`; the full checks on `main`. **Security:** none. **Size:** medium.

# ComfyUI: workflows added by a person or an agent

How a person, or an agent through the MCP server, adds a ComfyUI workflow of their own, how the app finds the values it fills, how a run picks a workflow, and the security rules. Decided by D-104 (inside D-058 items 1 and 3). The shipped workflows, filling, sizes and video runs are in `spec/comfyui-workflows.md`; the client, the check and failures in `spec/comfyui.md`; agent runs in `spec/agent-runs.md`. Build slices: `spec/phases/custom-workflows-slices.md`.

Not built. Security class.

**End state in one sentence.** Each added workflow has one owner, its file `{userData}/comfy-workflows/{id}.json`; the app reads every such file into one store at start, and every other piece of code gets workflows only through `allWorkflows()` and `checkedWorkflows()`.

## What a custom workflow is

- A ComfyUI "API format" JSON file (made with ComfyUI's "Export (API)"), copied into the app's own data folder on this computer. Not into a project, a package or a brief.
- It is offered as soon as it is added, to the person and to an agent (under the ComfyUI tick). It has no `draft`, `trial` or `proven` status.
- It serves exactly one job: a picture from a prompt (`image`), a picture from a prompt and reference pictures (`image_refs`), or a video (`video`) from a prompt, from a first frame, or from reference pictures. No extend and no cut-out in this round.
- A project never brings a workflow. A job row holds only a workflow ID. An ID that is not on this computer is refused.
- Assumption: the app does not watch the file the person picked. Changing the workflow means removing it and adding the new export.

## Marks: how the app finds what to fill

A person marks a step in ComfyUI's own screen by giving it a title. ComfyUI saves the title in the export as `_meta.title`.

**The title rule.**

- A title is a mark title when, after trimming spaces, it starts with `adman:` in any letter case. Other titles are ignored.
- After `adman:` come one or more marks, split by spaces or commas.
- A mark is one word from the table below, in any letter case.
- A mark may name the input to fill: the word, then `=`, then the input's name exactly as the file has it, with no spaces. Example: `adman: seed=noise_seed`.
- Examples: `adman: prompt`, `adman: width height`, `adman: prompt width height frames`, `adman: ref1`, `adman: output`.

**The marks.** Without `=`, the app tries the inputs in the order given and takes the first one the node has that holds a plain value of the right kind. A plain value is not a link (a link is a two-item list: a node ID and a whole number).

| Mark | What the app fills | Inputs tried, in order | Kind of value | How many |
|------|--------------------|------------------------|---------------|----------|
| `prompt` | The run's prompt | `text`, `prompt`, `positive`, `value`, `string` | text | exactly 1 |
| `seed` | A new random number for each option | `seed`, `noise_seed`, `value` | whole number | 1 or more |
| `width` | The run's width | `width`, `value` | whole number | 0 or 1, with `height` |
| `height` | The run's height | `height`, `value` | whole number | 0 or 1, with `width` |
| `ref1` … `ref8` | Reference picture 1 … 8, the name the server gave the upload | `image` | text | each 0 or 1; numbered from 1 with no gap |
| `first-frame` | The first frame, the name the server gave the upload | `image` | text | 0 or 1 |
| `frames` | The frame count of a video | `length`, `frames`, `num_frames`, `frame_count`, `video_frames`, `value` | whole number | 0 or 1 |
| `output` | Nothing. The app fetches the run's result from this node | none | none | exactly 1 |

- Two marks may never point at the same input. One node may carry several marks.
- The app fills only marked inputs. Everything else is sent as the file has it.
- Assumption: no negative prompt mark, no frames-per-second mark and no free "extra value" mark in this round (Draft 5 FR-316, FR-318). Their values stay as the file has them.

**The job comes from the marks.** No one picks it.

| Marks present | Job | Video start |
|---------------|-----|-------------|
| `frames` and `first-frame` | `video` | first frame |
| `frames` and `ref1`… | `video` | reference pictures |
| `frames` only | `video` | prompt only |
| `ref1`… and no `frames` | `image_refs` | none |
| none of the three | `image` | none |

- `first-frame` with any `ref` mark is refused: no workflow kind for that yet (as U-20 for shipped ones).
- `first-frame` without `frames` is refused.
- Assumption: a custom workflow takes exactly as many reference pictures as it has `ref` marks (`minReferences` = the slot count). Fewer or more is refused before any job row. Dropping unused picture nodes is not done for custom workflows.
- Assumption: at least one `seed` mark is required, so that the options of one run differ (FR-257).

## The stored shape

One JSON file per workflow: `{userData}/comfy-workflows/{id}.json`. The folder is the list. Written the way `settings.json` is written (a temporary file, then a rename). Only the app writes it.

```ts
// src/main/providers/comfyui/custom/stored.ts
type StoredCustomWorkflow = {
  format: 1
  id: CustomWorkflowId              // 'custom-' + 12 lowercase hex characters, from crypto.randomBytes(6)
  name: string                      // 1 to 60 characters, no control or format characters, unique (any letter case)
  addedBy: 'user' | 'agent'
  addedAt: string                   // ISO 8601
  size: SizeRule | null             // null when the graph has no width and height marks
  video: WorkflowVideo | null       // set exactly when the job is video
  graph: Graph                      // per node only class_type, inputs and _meta.title are kept
}
```

- **Not stored:** the job, the video start, the slots and the node types. They are worked out from the graph each time the file is read, by the same function the add uses. So the marks in the graph are their one owner.
- **Read at start.** The store reads every file whose name is `custom-{12 hex}.json`, runs the file checks below on it, and keeps the ones that pass. A file that fails is skipped. One warn log line says "a stored workflow was skipped" with its ID only. Other files in the folder are ignored. No folder means no workflows.
- **Limits.** Assumption: at most 50 workflows (`MAX_CUSTOM_WORKFLOWS`), each file at most 2 MiB with at most 500 nodes (the file checks). Real API exports are far smaller; a 2 MiB text still fits in one MCP message (the bridge takes 4 MiB).

**Defaults** (constants in `src/shared/comfy/custom-workflow.ts`):

| Value | Default | Allowed |
|-------|---------|---------|
| `size` for `image` and `image_refs` | `{ multiple: 16, minPixels: 838_861, maxPixels: 1_048_576 }` (about 1 MP) | `multiple` 8, 16, 32 or 64; `maxPixels` 0.25, 0.4, 0.5, 1, 2 or 4 MP, where 0.4 is exactly 409,600 pixels (640 × 640) and every other option is that many times 1,048,576; `minPixels` is always 80% of `maxPixels`, rounded up |
| `size` for `video` | `{ multiple: 32, minPixels: 327_680, maxPixels: 409_600 }` (about 0.4 MP) | as above |
| `video.fps` | 24 | whole number 1 to 60 |
| `video.maxMs` | 5,000 | 1,000 to 60,000, in whole seconds |
| `video.frameStep`, `video.frameOffset` | 4 and 1 (frame counts 1, 5, 9, 13 …) | `frameStep` 1 to 64, `frameOffset` 0 to 64 |

- The frame count is worked out by the existing `frameCount(durationMs, video)` (`spec/comfyui-workflows.md`, "A video run", "Length").
- With no width and height marks the app sends no size, as for Flux: a picture comes back at the size the graph makes; for video the first frame is fitted to the variant's own size.
- Assumption: these defaults suit common models (Flux, SDXL, Wan-style video at 4k+1 frames). The person can change them in Settings.

**In memory.** `toCustomSpec(stored)` gives a normal `WorkflowSpec`, so filling, running and the check need no second path:

| Field | Value for a custom workflow |
|-------|-----------------------------|
| `id`, `label` | the stored ID and name |
| `job`, `videoStart`, `slots` | from the marks |
| `status` | `'custom'` (a fourth value of `WorkflowStatus`) |
| `version` | 1 |
| `model` | `{ label: 'Custom workflow', mainFile: 'custom ComfyUI workflow' }` |
| `needs` | `{ minComfyVersion: '0.0.0', checkedWith: '', models: [], nodeClasses: every class_type, sorted, once each, addOns: [] }` |
| `size` | the stored size, or the job's default when null (no run reads it then) |
| `licence` | `{ name: 'Not known', url: '', commercialNote: null }` |
| `leavesOnServer` | "What the app leaves on the server" below |
| `source` | `{ template: 'added by a person' or 'added by an agent', exportedFrom: '', changes: [] }` |
| `slots.references` | one slot per `ref` mark, in order, each with an empty `dropWhenUnused`; `minReferences` = their count |
| `slots.seedBelow` | 2^32 |

- `WorkflowSlots` gains `seedBelow?: number`. `fillWorkflow` makes each seed a whole number below it (default 2^53, as today). Reason: some community nodes refuse seeds above 2^32.

**The ID type, with the least ripple.**

- `WORKFLOW_IDS` stays the fixed list of shipped IDs. `ShippedWorkflowId` is its member type.
- `CustomWorkflowId` is `` `custom-${string}` ``. `WorkflowId` becomes `ShippedWorkflowId | CustomWorkflowId`.
- `src/shared/comfy/custom-workflow.ts` owns `CUSTOM_WORKFLOW_ID` (`/^custom-[0-9a-f]{12}$/`) and `workflowIdSchema` (a shipped ID or that form). Every input that takes a workflow ID uses `workflowIdSchema`.
- `WORKFLOWS` and `NON_DRAFT_WORKFLOWS` stay shipped only. New, in `workflows/all.ts`: `allWorkflows()` (the shipped list, then the custom ones by `addedAt`) and `checkedWorkflows()` (`NON_DRAFT_WORKFLOWS`, then the custom ones). Code that today reads `WORKFLOWS` for runs, the check or `comfy.getInfo` reads these instead.

## The file checks

One pure function, `checkWorkflowText(text): Result<CheckedWorkflow>` (the app's usual result: the data, or an error body from the refusal table), in `src/main/providers/comfyui/custom/check-file.ts`. The person's add and the agent's add (before the ask and again after the allow) use it. The start-up read holds a parsed record, so it calls `checkWorkflowValue(graph)`, the same function from step 3 on; the store measures the stored file's bytes before parsing (CW-2: a stored file is the graph plus a small wrapper, written as compact JSON, so its limit is `MAX_WORKFLOW_BYTES` plus 4,096). Steps in this order; the first failure ends the check.

1. At most 2 MiB of UTF-8 (`MAX_WORKFLOW_BYTES`).
2. Parses as JSON. The app's own parse; the parser's error is dropped.
3. The top level is an object. If it has `nodes` and `links` lists, it is the canvas format.
4. 1 to 500 nodes (`MAX_WORKFLOW_NODES`).
5. Each key (node ID) is 1 to 64 characters of `A-Z a-z 0-9 _ : . -`. The node ID `__proto__` and the input name `__proto__` are refused (`workflow_bad_shape`); every lookup by a name from the file checks the object's own keys only. Each node has `class_type`: text of 1 to 128 characters with no control or format character (Unicode Cc, Cf) and no line break; and `inputs`: an object. Each input name is 1 to 128 characters with no control or format character. Each value is text, a number, true, false, null, or a list or object of these, at most 8 levels deep.
6. Every link names a node in the graph. A link is a two-item list of text and a number, read only at an input's top level; its number must be a whole number from 0. A link that fails either rule is `workflow_bad_link`. A two-item list of text and text is a plain value.
7. The marks, by the rules above.
8. The job, by the table above.

`CheckedWorkflow` holds the graph (per node only `class_type`, `inputs`, `_meta.title`), the job, the video start, the slots, the node types and the node count.

**Refusals.** Each is `RULE_VIOLATION` with `details.reason` and a fixed sentence. A sentence never holds text from the file. `{mark}` is filled only with a word from the marks table. One owner: `src/shared/providers/custom-workflow-messages.ts`.

| Reason | Sentence |
|--------|----------|
| `workflow_too_large` | "This file is larger than 2 MB. A ComfyUI workflow is much smaller." |
| `workflow_not_json` | "This file is not a ComfyUI workflow." |
| `workflow_canvas_format` | "This is a ComfyUI canvas file. In ComfyUI, choose Export (API) and add that file." |
| `workflow_bad_shape` | "This file is not a ComfyUI workflow in API format." |
| `workflow_too_many_nodes` | "This workflow has more than 500 nodes. Adman takes at most 500." |
| `workflow_bad_link` | "A node in this workflow links to a node that is not there." |
| `workflow_unknown_mark` | "A step title starts with adman: but holds a mark Adman does not know." |
| `workflow_mark_no_input` | "A marked step has no input Adman can fill. Name the input in the title, for example adman: seed=noise_seed." |
| `workflow_mark_shared` | "Two marks point at the same input." |
| `workflow_mark_repeated` | "The {mark} mark is used more than once." |
| `workflow_mark_missing` | "This workflow has no {mark} mark. Add it to a step title in ComfyUI." (for `prompt`, `seed`, `output`) |
| `workflow_size_marks` | "Mark both width and height, or neither." |
| `workflow_ref_gap` | "Reference marks must be numbered from ref1 with no gap." |
| `workflow_first_frame_needs_frames` | "A workflow with a first frame must also mark its frame count." |
| `workflow_job_not_offered` | "Adman cannot run a workflow with both a first frame and reference pictures yet." |
| `workflow_limit` | "You can add at most 50 workflows. Remove one first." |
| `workflow_name_taken` | "A workflow with that name already exists." |
| `workflow_file_unreadable` | "Adman could not read that file." |
| `workflow_not_picked` | "Choose the file again." |
| `workflow_add_in_settings` | "Add a workflow in Settings." |

A `ref9` or higher is `workflow_unknown_mark` (8 is `MAX_REFERENCES_PER_RUN`).

## Which workflow a run gets

`offeredWorkflow(choice, who, workflowId?)` (`workflows/offered.ts`) stays the one rule. It reads `allWorkflows()`.

- **A named workflow.** Found in `allWorkflows()`, not a `draft`, and a `trial` one only while dev tools are on (as today, for both actors). A custom one always. It must fit the job and, for video, the start pair. Refusals, before any job row:
  - not found, or a draft: `RULE_VIOLATION`, `comfy_workflow_not_found`, "That ComfyUI workflow is not on this computer."
  - a `trial` one with dev tools off: `comfy_job_not_offered`, as today.
  - the wrong job or start: `comfy_workflow_wrong_job`, "That workflow cannot make this kind of picture or video."
- **No workflow named.** As today: the `proven` shipped one, else the `trial` one with dev tools on. When no shipped one fits, the oldest custom one that fits. That is the default (`isDefault`).
- **Reference count.** After the choice, more pictures than slots is `too_many_references` (as today). Fewer than `minReferences` is new: `RULE_VIOLATION`, `too_few_references`, `details.min`, "This workflow needs {min} reference pictures." ("needs 1 reference picture" for one). Owner: `src/shared/providers/messages.ts`.
- **Stored on the job.** `generation.runImages` and `generation.startVideo` take an optional `workflowId` (`workflowIdSchema`), for the person and for an agent. The command writes the chosen workflow's ID into the job's `request.workflowId`. The picture and video job kinds pass it to the adapter (`ImageProvider.generate`, `VideoProvider.start` and `runSize` gain an optional `workflowId`; other adapters ignore it). `workflowForRun` takes it and looks it up in `allWorkflows()`.
- **Retry** (`job.retry`, the person only) uses `request.workflowId` when present, with the same checks. A row without it (made before this change) gets the default.
- **Removed before its turn.** A queued job whose custom workflow was removed fails at its turn: kind `other`, reason `workflow_gone`, "The workflow for this run was removed before it started." Nothing is sent. A run already started keeps its copy in memory and goes on.
- **No licence dialog** for a custom workflow: its `commercialNote` is null, so the D-088 check passes.
- Cut-out and extend stay shipped only. `checkComfyCutout` and `checkComfyExtend` never take a workflow ID.

**The remembered choice.** New settings key `comfyWorkflowChoice: Partial<Record<ChoiceKey, WorkflowId>>`, `ChoiceKey` = `image`, `image_refs`, `video_prompt`, `video_first_frame`, `video_references`. Default `{}`; a bad value in the file loads as `{}`. Written only by `settings.update` (agent `deny`). The window writes it after the person's run command is accepted with a workflow picked in the run dialog. An agent's choice never changes it, and no agent reads it. An ID in it that is no longer offered is ignored where it is read. Assumption: remembered per computer and per job, not per project.

## Commands, queries and events

All four commands are app scope, not undoable, and set `changesAppState`, so the window hears `app.stateChanged` and reads `comfy.getInfo` again. Each change empties the check's kept results (`serverChecks.forget()`), so a run never meets a kept check without its workflow.

| Name | Input | Reply | Agent policy | Notes |
|------|-------|-------|--------------|-------|
| `comfyWorkflow.addFromFile` | `{ filePath }` | `{ workflowId, name }` | `deny` ("add ComfyUI workflows from a file") | The person's add. The path must be the one `dialog.pickFiles` with purpose `comfy-workflow` gave in the last 10 minutes, taken once (`rememberWorkflowPath` and `takeWorkflowPath`, built like `chosen-sheet-path.ts`); else `workflow_not_picked`. A regular file only, at most `MAX_WORKFLOW_BYTES` (read size checked first). Name: the file name without `.json`, cleaned by the shared name cleaner, cut to 60; " 2", " 3" … added when taken. `addedBy: 'user'`. The path is never stored, logged or replied. |
| `comfyWorkflow.add` | `{ name, workflowJson, video? }` | `{ workflowId }` | `ask` ("add ComfyUI workflows"), ask kind `workflow` | The agent's add. `workflowJson` is the file's text, at most 2 MiB; `video` is `{ fps, maxMs, frameStep, frameOffset }` within the allowed ranges, and refused for a non-video graph. Actor `user` is refused with `workflow_add_in_settings`. `addedBy: 'agent'`. Assumption: the agent sends the text, not a path, so the app reads nothing from disk for an agent. |
| `comfyWorkflow.update` | `{ workflowId, name?, size?, video? }` | `{ workflowId }` | `deny` ("change ComfyUI workflows") | Name, size (`{ multiple, maxMegapixels }`, only when the graph has size marks) and video values. The graph never changes. |
| `comfyWorkflow.remove` | `{ workflowId }` | `{ workflowId }` | `ask` ("remove ComfyUI workflows"), ask kind `delete` | Deletes `{userData}/comfy-workflows/{id}.json`. The path is built from an ID that passed `CUSTOM_WORKFLOW_ID`, never from other text. Unknown ID: `NOT_FOUND`, "That workflow is not on this computer." Nothing on the server is touched. |

- `workflowId` in `update` and `remove` must match `CUSTOM_WORKFLOW_ID`; a shipped ID is `INVALID_INPUT`.
- A name from `add` or `update` passes the shared name cleaner first, then the name rule; one that cleans to nothing is `INVALID_INPUT`. A taken name (compared trimmed and without letter case) is `workflow_name_taken` in `add` and `update`. Only `addFromFile` adds " 2".
- `takeWorkflowPath` gives back the remembered path, and the command reads only that path, never the text it was sent (a path with a link and `..` in it can pass a text comparison and still open another file). The file is read through one handle that follows no link, as an imported picture is (`src/main/assets/checked-file.ts`). `chosen-sheet-path.ts` follows the same rule.
- Two refusals are `INVALID_INPUT` with a fixed sentence: video values for a graph that makes no video ("This workflow makes no video, so it takes no video values."), and a size for a graph with no size marks ("This workflow has no width and height marks, so it takes no size.").
- The store is on the deps as `comfyWorkflows`. `allWorkflows(store)`, `checkedWorkflows(store)` and `defaultWorkflow(choice, who, store)` take it as an argument; where this file writes `allWorkflows()`, read it so. No module keeps the list.
- Every refusal is the fixed table above. No refusal holds `issues` from parsing the graph: the input schema checks only that `workflowJson` is text within the size; the graph is read by `checkWorkflowText`.

**Queries.**

- `comfyWorkflow.list {}`, both actors. `{ workflows: Array<{ id, name, job, start, isDefault }> }`: every workflow the caller may name for `image`, `image_refs` or `video` (shipped ones as `offeredWorkflow` allows that caller, and every custom one). `start` is `'prompt' | 'first_frame' | 'references'` for video, else null. `isDefault` is true for the one a run of that job and start gets with no ID named. Never a graph, a node, a file path or the address.
- `agent.askWorkflow { requestId }`, user only. `{ name, job, start, nodeTypes }` for the open `workflow` ask, else `NOT_FOUND` "That request has ended." Held in memory for the ask's life only, like `agent.askFiles`.
- `comfy.getInfo` (user only) lists the custom workflows after the shipped ones, as `WorkflowInfo` with `status: 'custom'` and a new optional `custom: { addedBy, addedAt, nodeCount }`. `WorkflowInfo` gains `isDefault`. `offered` now means "the person may pick it now": true for every custom one.

**Events.** No new event. `agent.permissionRequested.kind` gains `'workflow'` (`fileCount` 0). Its `target` is the line in "The agent's ask" below. `agent.activity` is unchanged (tool name, project, ok; no input).

**Settings key and folder** (`spec/infra-and-settings.md`): `comfyWorkflowChoice` above; the folder `{userData}/comfy-workflows/`.

## MCP tools

Each maps one to one to its command or query, with an allow-list reply picker (`src/main/mcp/tools/workflow-tools.ts`, `workflow-replies.ts`).

| Tool | Runs | Input | Reply | Policy |
|------|------|-------|-------|--------|
| `list_comfy_workflows` | query `comfyWorkflow.list` | none | `workflows`: `id`, `name`, `job`, `start`, `isDefault` | allow |
| `add_comfy_workflow` | command `comfyWorkflow.add` | `name`, `workflow_json`, `video?` | `workflowId` | ask, every time; never auto-approved |
| `remove_comfy_workflow` | command `comfyWorkflow.remove` | `workflow_id` | `workflowId` | ask (delete); the delete tick covers it |
| `generate_images`, `generate_video` | as today | as today, plus `workflow_id?` | as today | tick, as today |

- Assumption: listing needs no tick. Running a workflow is under the ComfyUI tick, as every ComfyUI run (D-058 item 3).
- **Descriptions** (final words owned by the slice):
  - `list_comfy_workflows`: "List the ComfyUI workflows you may name in generate_images and generate_video: id, name, job (image, image_refs or video), start for a video (prompt, first_frame or references) and whether it is the default. For a video, start prompt means start none with use_references false; first_frame means start first_frame; references means start none with use_references true."
  - `add_comfy_workflow`: "Add a ComfyUI workflow in API format (Export (API) in ComfyUI). Send the file's text in workflow_json, at most 2 MB. Mark each step Adman fills by starting its title with adman: and a mark: prompt, seed, width, height, ref1 to ref8, first-frame, frames, output; name an input with =, as in adman: seed=noise_seed. The user is asked every time and sees the name, the job and every node type; you wait up to two minutes, and a refusal is final. Gives the new workflow's id. You cannot read a workflow back."
  - `remove_comfy_workflow`: "Remove a workflow you or the user added. This cannot be undone. The user is asked in the app, and this call waits up to two minutes. A refusal is final."
  - `generate_images` and `generate_video` add: "workflow_id names a workflow from list_comfy_workflows; leave it out for the default."
- The tool-list snapshot grows from 32 to 35 tools.

## The agent's ask

Built on the ask flow of `spec/mcp-and-agents.md`. `ASK_KINDS` gains `'comfyWorkflow.add': 'workflow'` and `'comfyWorkflow.remove': 'delete'`.

- Before the ask, the broker runs `checkWorkflowText` on the input. A refused file never reaches the screen; the agent gets the refusal. Nothing on disk is read.
- `mcp.autoApproveDestructive` never answers a `workflow` ask, and the dialog has no "Don't ask again" tick. "Remember" in `agent.answerPermission` is ignored for it.
- The broker holds `{ name, job, start, nodeTypes }` for the open request; the dialog reads it with `agent.askWorkflow`. No event holds a node type.
- After "Add", the command checks the text again and saves it. Refuse or two minutes without an answer: `AGENT_REFUSED`, nothing saved.

**Words** (`ask-words.ts`, `permission-dialog`):

- Title: "An agent asks to add a ComfyUI workflow". Action button: "Add".
- Target line: `Workflow "{name}": {job words}, {n} node types`. The name passes the shared name cleaner.
- A list headed "Node types it uses", each type as plain text, one per line, in a box that scrolls.
- The last line of the body, also in the accessible description: "This workflow will run on your ComfyUI server and can use any node installed there, including nodes that read files on that computer, reach the internet or use paid services."
- "Add" can be pressed only 750 ms after the dialog opens and only once the list is shown.
- The remove ask uses the delete dialog. Target line: `Workflow "{name}"`. Consequence line: "This cannot be undone. Runs that have not started yet will fail."

**Job words** (one owner, `src/shared/comfy/workflow-words.ts`; used by Settings, the ask and the picker): `image` "Picture from a prompt"; `image_refs` "Picture from a prompt and {n} reference pictures" ("1 reference picture"); video "Video from a prompt", "Video from a first frame", "Video from {n} reference pictures" ("1 reference picture").

## Screens

**Settings: "ComfyUI workflows".** A new Section, `src/renderer/screens/settings/comfy-workflows-section/`, placed right after "ComfyUI server". It is not part of `ComfySection`, so the first-run setup does not change. Summary: "{n} added".

- Intro: "Add a workflow you made in ComfyUI. Start the title of each step Adman fills with adman:, then use Export (API)."
- A folded part "How to mark steps": the marks table in short form ("adman: prompt", "The prompt", and so on) and one example title.
- The licence line, muted, always shown: "Adman cannot know the licence of a workflow you add. Check the licence of every model it uses before you use what it makes." There is no licence dialog for a custom workflow.
- Empty list: "No workflows added yet."
- One row per workflow: the name; under it "{job words} · {n} nodes", plus " · Added by an agent" when `addedBy` is `agent`. Buttons: "Change" and a trash icon named "Remove {name}".
- "Add workflow…" opens the system file picker (`dialog.pickFiles`, purpose `comfy-workflow`, `.json` only, one file), then sends `comfyWorkflow.addFromFile`. On success a line "Added {name}." On refusal the command's sentence as a danger line. No other question. At 50 the button is disabled with the title "You can add at most 50 workflows."
- **Change** (a form dialog, "Change workflow"): "Name"; when the graph has size marks, "Largest size" (0.25, 0.4, 0.5, 1, 2, 4 megapixels) and "Sides are a multiple of" (8, 16, 32, 64); for video, "Frames per second", "Longest clip, in seconds", and "Frame counts it takes: a multiple of {n}, plus {m}". Buttons "Cancel" and "Save" (`comfyWorkflow.update`). A refusal shows in the dialog.
- **Remove** (a confirm dialog, built like `dialogs/delete-subject/`): title "Remove {name}?"; body "This removes the workflow from this computer and cannot be undone. Runs that have not started yet will fail."; foot "Keep" (first focus) and "Remove workflow" (danger). No undo.
- "On the server" gains the custom sentence below when any custom workflow exists.

**The workflow picker** (`src/renderer/dialogs/run-dialog/workflow-choice/`). In `RunSetup`, under the provider choice, only when ComfyUI is chosen, the run is not a retry, and two or more workflows fit the job and start (`offered`, same `job`, same `videoStart`).

- A `select` named "Workflow", one option per fitting workflow by name, a custom one added by an agent followed by " (added by an agent)".
- It starts at the remembered choice for the `ChoiceKey` when it fits, else the `isDefault` one.
- `onConfirm` gains the chosen `workflowId`. `generate-fields.tsx` and `video-fields.tsx` send it in `generation.runImages` and `generation.startVideo`. After an accepted reply the window sends `settings.update { comfyWorkflowChoice }` for that key.
- The cost line names the chosen workflow, as today: "… with the workflow {name}." For a retry it reads "… with the same workflow as before." The retry sends no ID; the main process uses the stored one.
- Every place a ComfyUI picture or video run starts goes through `RunSetup`, so this is the one picker.

## The check and what is missing

- `comfy.check` and every run hand the check `checkedWorkflows()`, so the 60-second memory per address stays one list. `serverChecks.forget()` empties it on every add, change and remove.
- **Can check:** every node type of a custom workflow, one `GET /object_info/{class}` each, the class name passed through `encodeURIComponent` as today. A missing type usually means an add-on is not installed.
- **Cannot check:** model files (the file does not say which server folder an input reads from), the ComfyUI version, and whether a node does what its name says. A missing model is found by the server when the run is sent: a 400 (`server_refused`), with the server's words on request as today.
- The Settings check result lists a custom workflow under its name with the status word "Added" and its missing node types. These names reach only the person's own window, in the reply to the user-only `comfy.check`.
- **A run that fails `missing_items` on a custom workflow** stores no names on the job row: `result.missing` is `[]` and `result.missingCount` is the count. The row's sentence is "The server is missing {n} thing(s) this workflow needs. Press Check in Settings to see them." Reason: a project file may be shared, and job rows reach the window through events.
- The check makes many calls when many node types are listed. That is a nuisance (time), noted, not designed for.

## What the app leaves on the server

A custom workflow's `leavesOnServer`, in the order of `LEAVES`:

- "Reference pictures and first frames that Adman uploads stay in the server's input folder, under adman/." (only with `ref` or `first-frame` marks)
- New, `LEAVES.custom`: "A workflow you add can leave files on the server wherever its own steps save them."
- "The server keeps its own record of each run, the prompt included."

The app removes none of them and has no call that could [FR-271].

## Security

**The risk, plainly.** An added graph can use any node installed on the user's ComfyUI server: nodes that read or write the server's files, fetch from or send to the internet, run code, or call paid services with keys kept on the server. Adman cannot tell what a node does. Once added, a workflow runs as written for the person, and for any agent while the ComfyUI tick is on. Any of that happens on the server and on what the server can reach, not on the computer running Adman. A graph may also hold a secret the person typed into a node (a key, a path); it must not leak through Adman.

**What the design does about it.**

- A person adds a workflow only by choosing the file in the system picker. Nothing adds one by itself.
- An agent's add always asks on screen, shows every node type and says what the workflow can do. It is never approved without the person.
- An agent can never read a graph or change one, and never learns a file path or the server address.
- A project, package or brief never brings a workflow.
- The graph goes only to the user's saved ComfyUI address. What comes back passes the same checks as today. Adman reads nothing from the graph as a path, an address or a command on this computer.

**Rules, each a test.**

1. A custom graph is sent only in the body of `POST /prompt`, to the saved ComfyUI origin, through the existing client. No other code sends it, and it is never written outside `{userData}/comfy-workflows/`.
2. No log line, event payload, MCP reply, error message, job row or project file holds text from a graph (node IDs, class names, input names, input values, titles). The exceptions reach only the person's own window through user-only replies: the node types in the ask dialog (`agent.askWorkflow`), the missing node types in the Settings check result (`comfy.check`), and `comfy.getInfo`. The server's own words in `job.error_detail` may quote the graph; they keep their existing rule (user only, `job.getServerMessage`, never to an agent). Test: a graph whose every text holds a marker string, put through both adds, the list, a run, a failed run, a refused add and a remove; the marker appears in none of those places.
3. The app uses no value from a graph as a path on this computer, an address to call, or a command. It reads class names (for the check), titles (for marks), and whether a marked input is a link or a value of the right kind.
4. A custom run's result passes `pictureType` and `toPng` (pictures) or `checkMp4` (video), under the same byte limits, fetched only through `viewFile` with its existing name checks.
5. Uploads are unchanged: only the bytes of the request's own assets, under `uploadName(bytes)`, after the check answered `ok`.
6. An agent's add runs only after the person presses "Add" in the dialog. `mcp.autoApproveDestructive` never answers it. A refusal or a timeout saves nothing. The reply holds the new ID only.
7. No tool or agent-readable query returns a graph, a node, an input, a title, a file path or the address. `comfyWorkflow.addFromFile` and `comfyWorkflow.update` are `deny`; `comfy.getInfo` and `agent.askWorkflow` refuse an agent.
8. A job request holds only a workflow ID. A run or retry whose ID is not on this computer is refused or fails with nothing sent.
9. `comfyWorkflow.addFromFile` reads only a path the system picker gave in the last 10 minutes, once.
10. `comfyWorkflow.remove` deletes only `{userData}/comfy-workflows/{id}.json`, built from an ID that matches `CUSTOM_WORKFLOW_ID`. It sends nothing to the server.
11. Node types are drawn as plain text, never as a link or markup.
12. Every refusal sentence of the file checks is fixed; none repeats text from the file.
13. A custom workflow shows no licence dialog. Settings shows the one fixed licence sentence.

**Accepted** (follows D-104; to be listed in `spec/security.md`, "Accepted risks"): once added, a workflow can do on the server whatever its nodes can do, including spending on paid services from the server; the ask dialog and the person's own choice of file are the only controls. A person who adds a file from an untrusted source carries that risk, as for a brief (D-100).

**Nuisance, noted only:** a slow check with many node types; a run refused by the server for a wrong seed range, a size the model dislikes or a missing model; wrong video defaults until the person changes them.

## Spec text and requirement lines this replaces

For the orchestrator to edit; not edited here.

- `spec/comfyui-workflows.md`: "The workflow description" ("Both are bundled by the build and are the only workflows the app can send"; the `WORKFLOW_IDS` block and `WorkflowStatus`; "`NON_DRAFT_WORKFLOWS` is the one list the check and every run use"); "Which workflow a run gets" (named workflows, custom default, new refusals); "Filling a run" (`seedBelow`; custom reference slots take an exact count); "Licence text" (the custom sentence); "What the app leaves on the server" (the custom sentence).
- `spec/comfyui-trials.md`: "Not built: Krea 2 and custom workflows" (the custom bullet becomes a pointer here); "The hand-test screen's ComfyUI part" (the bullet saying `workflowId` is accepted only with dev tools and the user).
- `spec/comfyui.md`: "The check" step 2 and "Rules" (the list is `checkedWorkflows()`; `forget()`); "A picture run" step 2 (`workflowForRun` with an ID); the "Retry" bullet ("The chosen workflow is not stored on the job row"); "Failures" table (`workflow_gone`; `missing_items` for a custom workflow); the command refusals list (`comfy_workflow_not_found`, `comfy_workflow_wrong_job`, `too_few_references`); "Generation details" (a custom workflow names no model files).
- `spec/agent-runs.md`: "Gate steps for a run" ("No `workflowId` step … An agent never names a server, a workflow, a node or a model file"); "What an agent can never do or see", row "Name a server, a workflow, a node or a model file"; "After the gate" refusal table; "Open to an agent".
- `spec/mcp-and-agents.md`: the tool table and its count (32 to 35); "Ask flow" (kind `workflow`); "Permissions" (add, list and remove workflows); "Agent policy table" (four rows); the user-only query list (`agent.askWorkflow`); the notes on `generate_images` and `generate_video`.
- `spec/security.md`: threat model row "A workflow of someone else's choosing run on the user's server" [FR-278]; "Rules: agents and cost" (an agent's add); "Accepted risks"; "Named security tests".
- `spec/api-commands.md`: the four new commands; `workflowId` on `generation.runImages` and `generation.startVideo`; `job.retry`.
- `spec/api-queries-events.md`: `comfy.getInfo` (custom entries, `isDefault`, the new meaning of `offered`); `comfyWorkflow.list`; `agent.askWorkflow`; `agent.permissionRequested.kind`.
- `spec/infra-and-settings.md`: "settings.json" (`comfyWorkflowChoice` and its writer); the app data folder (`comfy-workflows/`).
- `spec/data-model.md`: the job `request` notes (`workflowId`).
- `spec/screens.md`: "AI services" (the new Section). `spec/screens-ai.md`: "The run dialog" (the picker, the retry line, `onConfirm`).
- `spec/open-items.md`: OI-57 is answered by D-104 and this file.
- `REQUIREMENTS-ComfyUI.md`: FR-278 (replaced); FR-280 notes ("the agent uses only the shipped workflows"); FR-290 notes.
- `REQUIREMENTS-ComfyUI-Draft5.md`, where D-104 differs: FR-309 (linked per project becomes copied per computer); FR-311 (per-project list, a description); FR-312 (linked-file rules do not apply); FR-314 and FR-315 (no review screen, no marking in the app this round); FR-316 and FR-318 (no negative prompt, fps or extra values this round); FR-320 (an exact reference count); FR-321 (one job per workflow, from the marks; remembered choice per computer, not a project default); FR-322 (the `output` mark is required); FR-323 (a seed mark is required); FR-325 (no model check); FR-326 (nothing packaged); FR-327 (an agent may add and remove, by ask); FR-328 (sources); FR-330 (no warning dialog for a person's add; the agent's ask instead); FR-331 (met by the licence line).

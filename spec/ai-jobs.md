# AI jobs: layout, copy options, brief reading, cut-out

The Phase 4 jobs beside picture and video generation: what each command checks, what each job sends and keeps, the cut-out workflow, the plain sentence for each failure cause, the fake provider's parts, and the agent rows. Read with `spec/jobs.md` (the job record, the runner, the two classes), `spec/providers.md` (interfaces, adapter rules, size limits), `spec/providers-adapters.md` (the Gemini calls), `spec/comfyui-workflows.md` (shipped workflows) and `spec/screens-ai.md` (the screens that start these jobs).

Everything here is Built (Phase 4), slices in `spec/phases/phase-04.md`. [REQ: FR-022, FR-045, FR-061, FR-069, FR-230, FR-248, FR-307; D-036, D-080]

## Contracts

### Job kinds

- `src/shared/config/job-kinds.ts` gains `cutout: 'background'`. Ten kinds.
- Migration `0003_job_kind_cutout` rebuilds the `job` table so its `job_kind` CHECK lists `cutout` (drizzle-kit rebuilds a table for a changed CHECK; the runner's foreign-key rule in `spec/data-rules.md` covers it). Test `tests/integration/db/migration-0003.test.ts`: four tags in order; `schema_version` 4; a version-3 file with a job row and an asset naming it keeps both unchanged; `cutout` is accepted and `'robot'` refused in old and new files.

Request and result schemas, one file each in `src/shared/schemas/jobs/`:

```ts
// layout-proposal.ts. The job reads the variant when it runs, so the request holds nothing.
layoutJobRequest = z.object({}).strict()
layoutJobResult = z.object({ boxes: z.array(layoutBox) })   // clamped, see "Layout proposal"
// layoutBox = { slot (the text layer's key), x, y, width, height, fontSize: whole numbers;
//               color: '#RRGGBB' | null; align: 'left' | 'center' | 'right' }

// copy-options.ts
copyJobRequest = z.object({
  role: z.enum(['call_to_action', 'text']), language: z.string().min(1),
  count: z.number().int().min(1).max(MAX_COPY_OPTIONS), maxChars: z.number().int().positive(),
})
copyJobResult = z.object({ options: z.array(z.string().min(1)) })

// brief-extraction.ts. The brief's whole text, so a retry needs no file.
briefJobRequest = z.object({ text: z.string().min(1) })
briefJobResult = z.object({ draft: BriefDraft, primaryLanguage: z.string().nullable() })

// cutout.ts
cutoutJobRequest = z.object({ sourceAssetId: z.string().min(1) })
cutoutJobResult = z.object({ assetIds: z.array(z.string()) })   // one ID, a list so the
                                                                 // earlier-options code reads both kinds alike
```

`MAX_COPY_OPTIONS = 8` and `COPY_MAX_CHARS = { call_to_action: 40, text: 120 }` live in `src/shared/config/copy-options.ts`, their one owner.

### Provider interfaces

`src/main/providers/types.ts`. No adapter implements layout or text before Phase 4, so these change freely.

```ts
export interface LayoutProvider {
  propose(input: {
    background: ImageFile; width: number; height: number
    items: Array<{ slot: string; text: string }>; palette: string[]; fonts: string[]
  }, opts?: RunOptions): Promise<LayoutBox[]>
}

export type CopyRole = 'call_to_action' | 'text'

export interface TextProvider {
  extractBrief(input: { text: string }, opts?: RunOptions): Promise<BriefDraft>
  copyOptions(input: {
    role: CopyRole; brief: Brief; language: string; count: number; maxChars: number
  }, opts?: RunOptions): Promise<string[]>
  translate(input: { /* as before */ }, opts?: RunOptions): Promise<Array<{ key: string; text: string }>>
}

// A picture in, the same picture with a see-through background out (PNG with alpha).
export interface CutoutProvider {
  cutOut(input: { image: ImageFile }, opts?: RunOptions): Promise<ImageResult>
}
```

- `ProviderAdapters` gains `cutout?: (ctx: AdapterContext) => CutoutProvider`; `AdapterJob` gains `'cutout'`.
- `ProviderJob` (`src/shared/schemas/queries/app.ts`) gains `'cutout'`. Registry rows: `comfyui` `jobs: ['image', 'video', 'cutout']`; `fake` adds `'cutout'`. No default provider is kept for cut-outs: the run dialog lists ComfyUI first (OI-55).
- `extractBrief` returns a `BriefDraft`, not a `Brief`: the user confirms the form before anything is a brief [REQ: FR-023].

### Commands, queries and agent rows

| Command | Input | Undo | Agent | Job kind |
|---------|-------|------|-------|----------|
| `generation.proposeLayout` | projectId, variantId, provider | — (the apply is V) | tick | `layout_proposal` (attached) |
| `generation.copyOptions` | projectId, variantId, layerId, count (1 to 8), provider | — | tick | `copy_options` (attached) |
| `generation.cutOut` | projectId, variantId, layerId, provider, licenceConfirmed? | — | tick | `cutout` (background) |
| `brief.extract` | projectId, filePath, provider | — | deny ("read brief files") | `brief_extraction` (attached) |
| `layer.updateMany` | projectId, variantId, updates[] of { layerId, patch } (1 to 100) | V | allow | none |

| Query | Input beside `projectId` | Returns |
|-------|--------------------------|---------|
| `job.earlierOptions` | layerId | The runs of a layer with their pictures (below) |
| `job.activity` | limit? (1 to 500, default 200) | Job rows with the names of where each belongs (below) |
| `campaign.paidCount` | campaignId | `{ pictures, videos, text }` (below) |

- Each `generation.*` here returns `JobStarted = { jobId }`. `brief.extract` too.
- **The gate** (`src/main/commands/agent-run-gate.ts`) knows `generation.proposeLayout`, `generation.copyOptions` and `generation.cutOut` with the same three steps as `generation.runImages`; each input requires `provider`. Gate tests as for `generation.runImages`: each refused at steps 1, 2 and 3 with no job row; ticked, accepted with `startedBy: 'agent'`.
- No MCP tool calls these commands or queries in Phase 4. Phase 10 adds the tools with its layer tools (A-66).
- `job.retry` is `deny` for an agent (`agent-policy.ts`), so an agent never re-runs one of these jobs; a retried job is always the user's.
- The three queries are open to both actors, as `job.get` is; no tool wraps them.

### The three queries

- **`job.earlierOptions { projectId, layerId }`** (`src/main/queries/earlier-options.ts`) [REQ: FR-248, FR-216]. The layer missing: `NOT_FOUND` "That layer was not found." It lists the `image_generation` and `cutout` jobs with `layer_id` = the layer, or, when the layer has a `slot`, with that `slot` and the layer's `variant_id`; newest first, at most 50. Reply `EarlierOptions = Array<{ job: JobRow; assets: Array<{ assetId; width; height; missing }> }>`: the assets are the IDs in `result.assetIds` whose rows still exist, in that order. Running and failed runs are listed too, with no assets or the ones kept. It calls no provider.
- **`job.activity { projectId, limit? }`** (`src/main/queries/activity.ts`) [REQ: FR-152, FR-217]. Every job of the project, newest first. Reply `JobActivity = Array<{ job: JobRow; place: { campaignName; variantLabel; layerName } }>`, each name null when the job has no such ID or the row is gone. `variantLabel` is "{title} · {sizeLabel} · {language}". An unreadable row is left out, as `job.list` does.
- **`campaign.paidCount { projectId, campaignId }`** (`src/main/queries/paid-count.ts`) [REQ: FR-230]. Unknown campaign: `NOT_FOUND` "That campaign was not found." Sums `paid_calls` over jobs with that `campaign_id`: `pictures` for `image_generation`, `generative_fill` and `cutout`; `videos` for `video_generation`; `text` for `layout_proposal`, `copy_options` and `translation`. A count of calls sent to paid providers, not money.

## Layout proposal

[REQ: FR-061, workflow 5.1 step 6]

**`generation.proposeLayout`** (`src/main/commands/generation/propose-layout.ts`). In `prepare`, in this order:

1. The provider is available and lists `layout`, else `INVALID_INPUT` "That provider cannot place text." with `details.provider`.
2. The variant exists, else `NOT_FOUND` "That variant was not found."
3. The variant has at least one visible text layer whose copy is not blank, else `INVALID_INPUT` "Add text to a text layer first."
4. The key guard, purpose "place text with AI".

Then it enqueues `layout_proposal` with the variant's campaign and variant, no layer, no slot.

**The job** (`src/main/jobs/kinds/layout-proposal.ts`):

1. The key guard again. The variant is read again; gone is the local failure `target_gone`.
2. The picture: the render service draws the variant with its text layers left out (`RenderService.renderPictures(project, variantId, LAYOUT_PICTURE_SIDE)`, `LAYOUT_PICTURE_SIDE = 1024`, the longest side), as PNG. A failed draw ends the job `failed`, kind `other`, with no reason, before any call.
3. `items`: each visible text layer with copy, as `{ slot: layer.key, text: layer.copy }`, in `z` order. `palette`: the campaign rule set's palette. `fonts`: "Inter" and the family name of each font a text layer uses.
4. One `jc.call` to `propose` with `width` and `height` the variant's own pixels; the boxes come back in those pixels.
5. `clampLayout(boxes, { width, height, palette, keys })` (`src/shared/generation/layout-clamp.ts`, pure): keeps the first box for each known key; drops a box with any number not finite; rounds every number; clamps `x` to 0 … width − 1, `y` to 0 … height − 1, `width` to 1 … width − x, `height` to 1 … height − y, `fontSize` to 1 … height; an `align` outside the three is `center`; a colour that is not `#RRGGBB` is null (the layer keeps its own); with a palette, a colour becomes the nearest palette colour (smallest sum of squared red, green and blue differences), written in upper case.
6. No box left: `ProviderFailure` of kind `other`, detail "No usable layout in the answer". Else the result is `{ boxes }`.

The job checks for the variant only before the call. If the variant is deleted while the call is out, the job still ends `succeeded` with its boxes and writes nothing; `target_gone` is only for a variant gone before the call.

The job writes nothing to the variant. **Applying** is the window's `layer.updateMany`, built by `layoutPatches(boxes, layers)` (`src/shared/generation/layout-patches.ts`, pure): for each box whose key matches a text layer of the variant, `geometry { x, y, width, height, rotation: 0 }` and `style { fontSize, align }` plus `color` when not null. The window sends it once, when the job succeeds while its tab is open (`spec/screens-ai.md`, "Place text with AI"). So one undo entry puts the text back. A job cancelled by its tab closing sends nothing.

**`layer.updateMany`** (`src/main/commands/layer/update-many.ts`). Every item follows `layer.update` (`spec/editor-commands.md`): the patch schema, merging, the type, style and asset checks, the counters. Then:

- Every `layerId` is a layer of `variantId`, each named once, else `NOT_FOUND` "That layer was not found." or `INVALID_INPUT` "Name each layer once."
- All or nothing: any refusal refuses the whole command and writes nothing.
- `variant.rev` is bumped once, through `bumpVariantRev` (which also stamps `agent_changed_at` for an agent).
- The inverse is one `layer.updateMany` with each item's inverse patch, on the list `variant:{variantId}`. Items that changed nothing are left out; nothing changed at all is the no-op rule.
- Reply `{ layerIds }` (the layers that changed).

## Copy options

[REQ: FR-045]

**`generation.copyOptions`** (`src/main/commands/generation/copy-options.ts`). In `prepare`:

1. The provider is available and lists `text`, else `INVALID_INPUT` "That provider cannot write copy."
2. The layer is in the variant (`NOT_FOUND` "That layer was not found in this variant."), is a text layer (`INVALID_INPUT` "Copy options are for text layers."), and its `slot` is not `headline` (`INVALID_INPUT` "The headline is the campaign message. Change the message instead.") [REQ: FR-043].
3. The key guard, purpose "suggest copy".

The request: `role` is `call_to_action` when the layer's slot is `call-to-action`, else `text`; `language` is the variant's; `maxChars` from `COPY_MAX_CHARS`. Enqueued with campaign, variant and layer.

**The job** (`src/main/jobs/kinds/copy-options.ts`): the key guard; reads the campaign's stored `brief` (the campaign gone is `target_gone`); one `jc.call` to `copyOptions`; then each option is trimmed, empty ones and ones over `maxChars` code points are dropped, repeats are dropped (compared in lower case), and the list is cut to `count`. None left: `ProviderFailure` `other`, "No usable copy in the answer". Result `{ options }`. Picking one is the window's `layer.update { copy }`.

## Brief reading

[REQ: FR-022, FR-171, workflow 5.1 step 2]

- `briefFileKind(path)` (`src/shared/brief/brief-file-kind.ts`) reads the ending in any letter case: `.json`, `.yaml`, `.yml` give `structured`; `.md`, `.markdown`, `.txt` give `text`; anything else null. The window sends `structured` files to `brief.parse` and `text` files to `brief.extract`. `brief.parse` keeps refusing `.md` and `.txt` with `brief_type_not_supported`.
- **`brief.extract`** (`src/main/commands/brief/extract.ts`). `filePath` absolute, else `INVALID_INPUT` "The file path must be absolute."; kind `text`, else `RULE_VIOLATION`, reason `brief_type_not_supported`, with the message "Choose a Markdown or plain-text brief to read with AI."; the provider available with `text`, else `INVALID_INPUT` "That provider cannot read briefs."; the key guard, purpose "read a brief with AI"; then `prepare` reads the file as UTF-8 with the errors of `brief.parse` (`NOT_FOUND`, `file_not_readable`). Blank after trimming: `INVALID_INPUT` "The brief file is empty." No size limit (D-059 item 2). The text never goes to a log line. It enqueues `brief_extraction` with no campaign, variant, layer or slot.
- **The job** (`src/main/jobs/kinds/brief-extraction.ts`): the key guard; one `jc.call` to `extractBrief`; the answer goes through `briefDraftFrom` (unknown and wrong-typed fields dropped); `primaryLanguage` by `primaryLanguageOf(draft)` (`src/shared/brief/primary-language.ts`, the rule of `brief.parse`, which then uses it too). A draft with no field at all: `ProviderFailure` `other`, "No brief fields in the answer". Result `{ draft, primaryLanguage }`, which opens the brief form.
- Its paid call counts in no campaign: the campaign does not exist yet.

## Cut-out

[REQ: FR-307; OI-55]

**Route.** ComfyUI on the stakeholder's own server, with ComfyUI's built-in background removal: core nodes only, no add-on. fal comes in Phase 7 (slice J) as a second, paid route behind the same `CutoutProvider`. The fake provider does it for tests.

**The workflow** `birefnet-cutout` (`src/main/providers/comfyui/workflows/birefnet-cutout.json`, spec `birefnet.ts`), an agent draft shipped as `trial` and set to `proven` by D-103, so it is offered without dev tools:

| Node | `class_type` | Inputs |
|------|--------------|--------|
| 1 | `LoadImage` | `image`: the uploaded name (reference slot 1) |
| 2 | `LoadBackgroundRemovalModel` | `bg_removal_name`: `birefnet.safetensors` |
| 3 | `RemoveBackground` | `bg_removal_model` ← 2, `image` ← 1. Gives the subject's mask |
| 4 | `InvertMask` | `mask` ← 3 |
| 5 | `JoinImageWithAlpha` | `image` ← 1, `alpha` ← 4 |
| 6 | `PreviewImage` | `images` ← 5 (the output node) |

- Why node 4: `JoinImageWithAlpha` stores `1 − mask` as the alpha, and `RemoveBackground` gives 1 for the subject. Inverting first leaves the subject solid and the background see-through.
- Spec values: `job: 'cutout'` (a new `WorkflowJob` value), `slots = { seed: [], references: [one slot at node 1, nothing dropped], minReferences: 1, outputNode: '6' }`, no prompt, no size slot. `size` `{ multiple: 1, minPixels: 1, maxPixels: MAX_PICTURE_PIXELS }` (read by no run). `model { label: 'BiRefNet', mainFile: 'birefnet.safetensors' }`. `needs.models` `[{ folder: 'background_removal', file: 'birefnet.safetensors' }]`; `needs.nodeClasses` the six classes above; `minComfyVersion` `'0.0.0'` (no number is published; the check's node list catches an old server). `licence` MIT, `commercialNote` null, so no licence dialog. `leavesOnServer`: uploads, preview, record.
- `WorkflowSlots.prompt` becomes optional; `fillWorkflow` refuses a prompt value for a workflow without the slot and a missing one for a workflow with it, as for every other slot. `RunAsk.prompt` becomes optional. Nothing else in the fill rule changes.
- **The first real run decides two points.** Run once on the real server (`test:comfy` case 8, below; D-092). If the subject comes out see-through and the background solid, node 4 is dropped and node 5 takes its alpha from node 3 (one data fix, one re-run). If `JoinImageWithAlpha` refuses the mask's shape (ComfyUI issue 14008 reports an extra dimension on that mask), the workflow stays `draft`, the developer reports it, and cut-out ships through the fake provider only until a ComfyUI release fixes it or fal arrives.

**The adapter** (`src/main/providers/comfyui/cutout.ts`, exported as `cutout` from `comfyui/index.ts`). `cutOut` does what `generate` does for one picture: the saved address, `workflowForRun('cutout')`, the server check, one upload under `uploadName(bytes)`, one submission, polling, the result from node 6, `pictureType`. Details from the shipped workflow file, as for pictures.

**`generation.cutOut`** (`src/main/commands/generation/cut-out.ts`). In `prepare`:

1. The provider is available and lists `cutout`, else `INVALID_INPUT` "That provider cannot cut out pictures."
2. The layer is in the variant (`NOT_FOUND`), is an image or background layer (`INVALID_INPUT` "Cut-outs are made from a picture layer."), and has a picture (`INVALID_INPUT` "Choose a picture for this layer first.").
3. The key guard, purpose "cut out a picture".
4. For ComfyUI: `checkComfyCutout` (beside `checkComfyRun` in `comfy-checks.ts`): `comfy_address_needed`, then `offeredWorkflow({ job: 'cutout' })` else `comfy_job_not_offered`, then the licence check as for pictures.
5. `AssetService.read` of the layer's picture (a clean PNG, A-55); its refusals as for reference pictures.

The request is `{ sourceAssetId }`, the layer's picture at that moment. Enqueued with campaign, variant and layer. `job.retry` of a ComfyUI cut-out runs step 4 again (`src/main/commands/job/retry.ts`).

**The job** (`src/main/jobs/kinds/cutout.ts`): the key guard; the source read again through `readPictures` (below), so what is sent is the clean PNG `AssetService.read` re-encodes, never the file's own bytes; one `jc.call` to `cutOut`; `deps.toPng`; details embedded with `kind: 'cutout'` and an empty prompt; stored through `storeResult` (below). `asset.addGenerated` writes `gen_prompt` null when the job's request has no prompt. Result `{ assetIds: [id] }`. The source asset is never changed [REQ: FR-307].

**See-through pixels through `toPng`.** A cut-out goes through `toPng` like every picture, and its alpha survives: the decoder keeps four channels and the encoder writes a PNG with alpha. Fully see-through and fully solid pixels keep their alpha exactly. A fully see-through pixel's colour may come back as black, and a partly see-through edge pixel's colour may move by a rounding step, because the decoder holds colours multiplied by alpha. Both look the same when drawn. Accepted. Test: `tests/e2e/cutout-alpha.spec.ts` (Electron's real decoder).

**The real-server case.** `tests/comfy/cutout-case.ts` (case 8), on only with `ADMAN_COMFY_CUTOUT=1`. It runs at the client level like cases 5 to 7, not through `cutout.cutOut`, and sends the same graph the adapter sends (`fillWorkflow` of the shipped spec with the uploaded name). It checks the server first and skips when an item is missing. Input: the test's own ~768 × 768 picture of plain shapes. Passes when the answer is a PNG whose header colour type is 6 (red, green, blue, alpha); prints time, pixel size, byte size and the count of see-through pixels; writes the result to the temporary folder. Looking at it is a hint, not a pass rule.

## Shared job helpers

- **`readPictures(jc, project, ids)`** (`src/main/jobs/read-pictures.ts`): `AssetService.read` for each ID, turning its refusals into local failures (next section). Used by the picture, video and cut-out kinds.
- **`storeResult(jc, project, { jobId, bytes, ext, model })`** (`src/main/jobs/store-result.ts`): `writeManaged`, then `asset.addGenerated`, turning their failures into local failures. Used by the picture, video and cut-out kinds. Returns the asset ID.

## A plain sentence per failure cause (OI-68)

[REQ: FR-069]. A job that fails after it was queued, for a reason that is not the provider's, ends `failed`, kind `other`, with its own reason. Each sentence is in `src/shared/providers/messages.ts` beside the ComfyUI reasons, and its reason is a value of `PROVIDER_ERROR_REASONS`. `{provider}` is filled with the registry label by `fillMarks`.

| Cause | Reason | Sentence |
|-------|--------|----------|
| The key was removed after the run was queued (`NEEDS_KEY` from the key guard inside the job) | `key_missing` | "Your {provider} key was removed after this run was queued. Add it in Settings, then try again." |
| A picture the run uses is gone (`MISSING_FILE`, or `NOT_FOUND` from the read) | `picture_missing` | "A picture this run uses can no longer be found. Find it again from the project page, then try again." |
| It is now over the size limit (`asset_too_large`) | `picture_too_large` | "A picture this run uses is now larger than 32 MB. Choose a smaller picture, then try again." |
| It is no longer a PNG, JPEG or WebP the app can turn into a PNG (`asset_not_a_picture`, `picture_not_usable`) | `picture_changed` | "A picture this run uses has changed and can no longer be sent. Choose another picture, then try again." |
| The assets folder is gone (`assets_folder_missing`) | `assets_folder_missing` | "The project's assets folder could not be found, so the results were not saved. Choose the assets folder again from the project page, then try again." |
| A result file could not be written (any error from `writeManaged`) | `assets_not_writable` | "The results could not be saved in the project's assets folder. Check that the folder can be written to, then try again." |
| `asset.addGenerated` refused | `results_not_added` | "The results were made but could not be added to the project. Try again." |
| The variant, layer or campaign the job was for was deleted | `target_gone` | "The layer or variant this run was for has been deleted." |

- **How it is decided** (security class). `LocalFailure` (`src/main/jobs/local-failure.ts`) carries a reason only. `readPictures` and `storeResult` throw it, comparing the `AppError`'s `code` and `details.reason` with the fixed values above and reading nothing else. The runner (`run-job.ts`) turns a `NEEDS_KEY` `AppError` into `key_missing` the same way. Any other `AppError` stays kind `other` with no reason and the sentence "{Provider} could not finish this request. Try again."
- **Nothing from the error leaves.** For a local failure the row's `error_detail` is the reason name; for another `AppError` it is `app_error`; never the error's code, message or details. A `ProviderFailure` keeps the provider's own detail there, as before (`run-job.ts`); it never goes into `job.updated`, a log line or a reply. The log line holds the error kind and reason only. A write error's own code (for example `EACCES`) goes to one `warn` line with `event: 'job'` and no path.
- A failure that arrives after some pictures were kept ends as today: the run keeps them and counts the failure.
- The window shows the sentence wherever a failed run shows (`ui/run-failure/`, the activity panel, the earlier options); the agent job view gives it with `{provider}` filled.

## The fake provider's parts

`src/main/providers/fake/` (`layout.ts`, `text.ts`, `cutout.ts`). Each honours `setFakeBehaviour` (`fail`, `waitMs`, `onCancel`) like the picture and video parts, makes no network call and counts no paid call.

- **Layout** (`fake/layout.ts`): for each item, the box and text style of the default layout (`SLOT_LAYOUTS` in `src/shared/config/default-layout.ts`) for the slot named like the item's key, placed by the shared box rules (`frameOf`, `geometryOf` in `src/shared/templates/layout-rules.ts`); else `OTHER_COPY_BOX`, placed one box-height lower for each earlier such item and kept inside the canvas. The font size is the style's largest, `fontSizeOfSmaller × S`, rounded. Colour the first palette colour, else `#FFFFFF`; `align` from the style.
- **Extract brief:** reads lines of the form `Label: value`, labels in any letter case: "Campaign name", "Region", "Audience", "Message", "Offer", "Call to action", "Tone", "Languages" and "Sizes" (comma lists), and "Subject" (repeatable; `Name - description`). Other lines are ignored. So a test's Markdown brief gives a known draft.
- **Copy options:** the first `count` of a fixed list of eight short English lines per role (for `call_to_action`: "Shop the collection", "Find your fit", …), each within `maxChars`.
- **Translate** (built, P6-5): each text comes back as `[{to}] {text}`, so a test knows the answer.
- **Cut-out:** a PNG of the input's pixel size (from `pictureSize`), colour type 6: grey and solid in the middle half, see-through elsewhere. `png.ts` gains the alpha form.

## Security notes

- **Model answers are untrusted data.** A layout, a brief draft and copy options pass a schema, the clamps and cleaning above, and are shown as text, never as markup. A brief that tells the model what to answer only changes values the user then reviews in the form [REQ: FR-023].
- **What leaves the machine.** Layout: a picture of the variant without its text, the text of its text layers, the palette and font names. Copy options: the campaign's stored brief. Brief reading: the brief file's text. Cut-out on ComfyUI: one picture's bytes under `uploadName`, nothing else about it. Each only after the user's confirm, or an agent run under its tick.
- `brief.extract` reads a path, so agents are denied it, as `brief.parse`.
- `layer.updateMany` makes every check `layer.update` makes, for every item.
- **An agent never confirms a licence.** `generation.cutOut` ignores `licenceConfirmed` when the actor is the agent, as `generation.runImages` and `generation.startVideo` do.
- **Job rows for agents.** `job.earlierOptions`, `job.activity` and `campaign.paidCount` have no MCP tool. When Phase 10 adds one, each job row passes through `agentJobView` first; the raw row (prompts, result, error detail) is never returned to an agent.

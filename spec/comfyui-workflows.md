# ComfyUI: workflows, sizes, video and trials

The workflows Adman can send to a ComfyUI server, how a run fills one, sizes, video runs, extend, what is left on the server, and the trials that move a workflow from `trial` to `proven`. The adapter itself (address, client, check, picture run, failures) is in `spec/comfyui.md`; read it first. Cancel is in `spec/cancel.md`; runs started by an agent are in `spec/mcp-and-agents.md`.

## The workflow description (was 6.10.4; security class) [REQ: FR-258, FR-278]

Built. `src/main/providers/comfyui/workflows/` (`types.ts`, `common.ts`, `moss.ts`, `h3.ts`, `flux3.ts`, `index.ts`, `offered.ts`, one `.json` graph per workflow); the window-visible part in `src/shared/schemas/queries/comfy.ts`.

A workflow is a JSON graph file in the repository plus a typed description. Both are bundled by the build and are the only workflows the app can send. No function in the adapter takes a workflow, a node or a model file name from its caller.

```ts
// src/shared/schemas/queries/comfy.ts: what comfy.getInfo may show a window
export const WORKFLOW_IDS = [
  'moss-text-to-image', 'moss-edit-references', 'moss-extend',
  'h3-text-to-video', 'h3-image-to-video', 'h3-reference-to-video',
  'flux3-klein-edit-references',
] as const
type WorkflowJob = 'image' | 'image_refs' | 'extend' | 'video'
type WorkflowStatus = 'draft' | 'trial' | 'proven'
type WorkflowNeeds = {
  minComfyVersion: string           // '0.0.0' means no minimum known
  checkedWith: string               // server version the owner check passed on; '' until then
  models: Array<{ folder: string; file: string }>
  nodeClasses: string[]
  addOns: Array<{ name: string; url: string }>   // empty for every shipped workflow
}
type WorkflowVideo = { fps: number; maxMs: number; frameStep: number; frameOffset: number }
type WorkflowLicence = { name: string; url: string; commercialNote: string | null }  // FR-285
type WorkflowInfo = {
  id: WorkflowId; label: string; job: WorkflowJob
  videoStart?: { firstFrame: boolean; references: boolean }
  status: WorkflowStatus
  model: { label: string; mainFile: string }
  needs: WorkflowNeeds
  size: SizeRule                    // { multiple, minPixels, maxPixels }, "Sizes" below
  video?: WorkflowVideo
  licence: WorkflowLicence
  leavesOnServer: string[]          // plain sentences, FR-271
}
type ComfyInfo = { address: string | null; workflows: WorkflowInfo[]; leavesOnServer: string[] }

// src/main/providers/comfyui/workflows/types.ts: main process only
type Pointer = { node: string; input: string }      // one input of one node in the graph
type Graph = Record<string, { class_type: string; inputs: Record<string, unknown> }>  // "API" form (V-3)
type ReferenceSlot = {
  image: Pointer                                         // the LoadImage input that takes the uploaded name
  dropWhenUnused: { nodes: string[]; inputs: Pointer[] } // removed when this slot gets no picture
}
type WorkflowSlots = {
  prompt: Pointer; seed: Pointer[]; width?: Pointer; height?: Pointer
  references?: ReferenceSlot[]      // in order; its length is the most the workflow takes
  minReferences?: number            // fewest pictures it runs with; default 1
  alwaysDrop?: { nodes: string[]; inputs: Pointer[] }  // kept as data, removed on every fill; only with references
  firstFrame?: Pointer; frames?: Pointer; outputPrefix?: Pointer
  pad?: { left: Pointer; top: Pointer; right: Pointer; bottom: Pointer }  // extend only
  outputNode: string                // the one node whose result the app fetches
}
type WorkflowSpec = WorkflowInfo & {
  version: number                   // bumped whenever the graph file changes
  graph: Graph
  slots: WorkflowSlots
  source: { template: string; exportedFrom: string; changes: string[] }  // where the graph came from, each hand change
}
```

- **Status.** `draft`: a stand-in graph for the tests, never sent to any server and never compared by the check. `trial`: a real graph, not yet proven; offered only to the user with dev tools on. `proven`: passed the owner check ("Trials and `proven`").
- `WORKFLOWS` (`workflows/index.ts`) lists all seven; `NON_DRAFT_WORKFLOWS` is the one list the check and every run use.
- **Owners.** A graph's owner is its file in `src/main/providers/comfyui/workflows/`. `comfy-workflows/` holds hand-test copies (canvas copies in `ui/`) that no code reads. Where `comfy-workflows/REFERENCE-NOTES.md` and `comfy-workflows/README.md` differ, the notes win. How many pictures a workflow takes has one owner: the length of `slots.references`; the window holds no copy.
- Stock workflows use ComfyUI core nodes only. `needs.addOns` is empty for every shipped workflow, and one test holds that.

## The seven workflows

| ID | What it does | Job | Status on `main` | Min. ComfyUI | Model | Result node | Size rule in use | Limits |
|----|--------------|-----|------------------|--------------|-------|-------------|------------------|--------|
| `moss-text-to-image` | Picture from a prompt [REQ: FR-259] | `image` | `trial` | 0.42.0 | MOSS-Image | node 9 `PreviewImage` | first-run `{16, 840,000, 1,050,000}` | no references |
| `moss-edit-references` | Picture from a prompt and reference pictures, the "Image Edit" workflow (V-23); the first reference is the source photo [REQ: FR-260] | `image_refs` | `draft` | 0.43.0 | MOSS-Image with its edit LoRA | node 17 `PreviewImage` | full `{16, 1,000,000, 2,000,000}` | 1 to 2 references (two slots declared) |
| `moss-extend` | Extend a background [REQ: FR-261] | `extend` | `draft` | 0.43.0 | MOSS-Image with its edit LoRA | node 18 `PreviewImage` | full `{16, 1,000,000, 2,000,000}` | the picture to extend, as one reference |
| `h3-text-to-video` | Video from a prompt, no start picture | `video` | `trial` | 0.33.0 | MiniMax H3 (`fl2va`) | node 14 `SaveVideo` | first-run `{32, 330,000, 420,000}` | clip at most 15 s |
| `h3-image-to-video` | Video from a first frame | `video` | `trial` | 0.33.0 | MiniMax H3 (`fl2va`) | node 14 `SaveVideo` | first-run `{32, 330,000, 420,000}` | one first frame; at most 15 s |
| `h3-reference-to-video` | Video from reference pictures, no first frame | `video` | `trial` | 0.33.0 | MiniMax H3 (`ref2va`) | node 14 `SaveVideo` | first-run `{32, 330,000, 420,000}` | exactly 1 reference (model takes up to 9); at most 15 s |
| `flux3-klein-edit-references` | Picture from a prompt and one reference picture; the result takes the reference's shape | `image_refs` | `trial` | none known (`'0.0.0'`) | FLUX 3 klein | node 15 `PreviewImage` | not set by the app: about 1 MP in the graph | exactly 1 reference |

- No workflow is `proven` on `main`; every `checkedWith` is `''`.
- For `image_refs` the only non-draft workflow is Flux, so every ComfyUI reference-picture run uses it. Whether Flux or `moss-edit-references` serves references for good is OI-75 (open).
- **Four kinds of video start** [REQ: FR-286]: three have a workflow. "First frame and references together" has none, because nothing public shows one run taking both (**U-20**). It is not offered and the app says so ("ComfyUI cannot make this kind of video yet."). It becomes its own workflow file if a trial finds a way.

### Model files (`needs.models`, from `workflows/common.ts`)

| Workflow | Folder / file |
|----------|---------------|
| All MOSS | `diffusion_models/moss_image_sft_int8_convrot.safetensors` (the `mainFile`), `text_encoders/qwen3.5_9b_w4a8_gptq.safetensors`, `vae/flux2-vae_small.safetensors` |
| MOSS edit and extend, plus | `loras/moss_image_edit_lora_rank_64_bf16.safetensors` |
| All H3 | `text_encoders/qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors`, `vae/minimax_h3_video_vae_int8_convrot.safetensors`, `vae/minimax_h3_audio_vae_fp32.safetensors` |
| H3 text and first frame, plus | `diffusion_models/minimax_h3_fl2va_pruned_int8_convrot.safetensors` |
| H3 references, plus | `diffusion_models/minimax_h3_ref2va_pruned_int8_convrot.safetensors` |
| Flux | `diffusion_models/flux3-image-klein-base-int8-convrot.safetensors`, `text_encoders/qwen3vl_4b_int8_convrot.safetensors`, `vae/flux2-vae.safetensors` (not `flux2-vae_small`) |

The MOSS version is `SFT`; `SFT` or `Base` is decided with the MOSS trial (OI-34, CQ-15). Changing it is one file name in `needs` and in the graph.

### MOSS-Image

- `moss-text-to-image` (version 2). Graph from the official template `image_moss_image_t2i.json`, flattened by an agent; `source.exportedFrom` is `'agent draft, never opened in ComfyUI'` (OI-65). Slots: node 4 `text` (prompt), node 7 `seed`, node 6 `width`/`height`, output node 9. Node classes: `UNETLoader`, `CLIPLoader`, `VAELoader`, `CLIPTextEncode`, `EmptyFlux2LatentImage`, `KSampler`, `VAEDecode`, `PreviewImage`. Prompt rewriting and the skip-layer boost are off.
- `moss-edit-references` and `moss-extend` (version 1) are drafts: stand-in graphs (`exportedFrom: 'draft stand-in for the tests, not an export'`). Their slots and needs are written; real graphs arrive as data. The hand-test drafts are `comfy-workflows/moss-image-references.json` and `moss-image-extend.json`.
- **Licence:** `{ name: 'Apache 2.0', url: 'https://huggingface.co/Comfy-Org/MOSS-Image', commercialNote: null }` (V-24, U-18).

### MiniMax H3

All three are `trial`, version 2, graphs from agent drafts in `comfy-workflows/`. Shared slots: node 5 `prompt`, `width`, `height`, `length` (frames); node 6 `noise_seed`; node 14 `filename_prefix` (output prefix); output node 14. Node classes: `UNETLoader`, `CLIPLoader`, `VAELoader`, the conditioning node, `RandomNoise`, `KSamplerSelect`, `BasicScheduler`, `BasicGuider`, `SamplerCustomAdvanced`, `VAEDecode`, `VAEDecodeAudio`, `CreateVideo`, `SaveVideo`.

- `h3-text-to-video`: the official template `video_minimax_h3_t2v.json`, flattened (20 steps, no speed-up LoRA). Conditioning node `MiniMaxH3ImageToVideo` with `prompt`, `width`, `height`, `length`, `clip`, `vae`, no first frame.
- `h3-image-to-video`: the text graph plus node 15 `LoadImage` into `first_frame` (`slots.firstFrame` = node 15 `image`); `needs` adds `LoadImage`. The first frame goes straight from `LoadImage`, as the template does. H3 stretches a first frame of another shape; the fix is `fitPicture`'s crop in the app ("A video run"), never a resize node in the graph. An edit to `_meta.title` only is not a graph change.
- `h3-reference-to-video`: the official two-reference template through `h3-video-references.json`: the `ref2va` model, `MiniMaxH3ReferenceToVideo` with `audio_vae`, nodes 15 and 16 `LoadImage` into `ref_images.ref_image_0` and `ref_image_1`, `ref_image_size "match"` (the server sizes the references). One reference slot is declared (node 15, `minReferences: 1`); node 16 and the input `ref_images.ref_image_1` are in `alwaysDrop` and are removed on every fill.
- `video` = `H3_VIDEO = { fps: 24, frameStep: 17, frameOffset: 5, maxMs: 15_000 }`.
- **Licence:** `{ name: 'MiniMax H3 Community License', url: 'https://comfy.org/minimax/license', commercialNote: 'Commercial use of what this model makes may need a paid MiniMax licence, and in some regions the free licence does not cover it. Holding the licence is your responsibility. Read it at comfy.org/minimax/license.' }`.

### FLUX 3 klein (`flux3.ts`)

| Field | Value |
|-------|-------|
| `label` | `FLUX 3 klein: picture from a prompt and one reference picture` |
| `model` | `{ label: 'FLUX 3 klein', mainFile: 'flux3-image-klein-base-int8-convrot.safetensors' }` |
| `needs.nodeClasses` | `UNETLoader`, `CLIPLoader`, `VAELoader`, `LoadImage`, `CLIPTextEncode`, `ReferenceMultiLatent`, `KSampler`, `VAEDecode`, `PreviewImage` |
| Graph settings | `CLIPLoader` type `flux3`; `KSampler` 50 steps, cfg 1, `euler`, `simple`, denoise 1; `ReferenceMultiLatent` with `resolution "resize"`, `resolution.megapixels 1`; empty negative prompt |
| Slots | prompt node 6 `text` (the positive `CLIPTextEncode`; the reference file passes the prompt through helper nodes first, OI-78); seed node 9 `seed`; one reference node 10 `image`, nothing to drop, `minReferences: 1`; no `width`/`height`; output node 15 |
| `size` | `{ multiple: 16, minPixels: 1000000, maxPixels: 1000000 }` (the type needs a value; no run reads it) |
| `licence` | `{ name: 'Not verified', url: '', commercialNote: 'The licence of this model has not been checked. Commercial use may need a licence from its maker. Holding it is your responsibility.' }` (OI-76) |
| `source` | template `'stakeholder reference file, Flux 3 klein image edit'`; an agent draft; `changes` list the left-out nodes of `REFERENCE-NOTES.md` "Flux 3 klein edit" and the `PreviewImage` swap |

- **Size follows the reference.** The app sends no width or height; the server makes the result in the uploaded picture's shape at about one megapixel. `fitSize` is skipped. The job request still holds the variant's size, unused for this run. The stored asset's size is read from the PNG. A size the app sets for Flux is OI-77.
- **One reference only.** Two or more pictures are refused by the command with `too_many_references` and `details.max` 1, before a job row. A second Flux reference slot (`images.image1`) is a guess and not shipped.
- No minimum version: the node-class check catches an old server (no `ReferenceMultiLatent`).
- If the server refuses the graph, the first suspects are the prompt typed straight into `CLIPTextEncode` and the `PreviewImage` swap. A fix needing a left-out helper node (`Flux3LayoutPrompt`, the prompt rewriter) is a different graph shape and goes to the architect (OI-78).
- `LoadImage` reads a JPEG uploaded under a `.png` name (`spec/comfyui.md`, "Uploads").

### Minimum versions

- Never set higher than known: a minimum set too high stops a run on a server that could make it.
- Not raised to 0.45.0. If a real check prints a version below a `moss-*` or `h3-*` minimum while it finds every node and model of that workflow, that minimum is lowered to the printed version by a one-line edit to its file. No new ruling is needed.
- `needs.checkedWith` is the server version of the workflow's first good `test:comfy` run (not filled yet).

## Which workflow a run gets

Built. `offeredWorkflow` (`workflows/offered.ts`) for the commands; `workflowForRun` (`comfyui/image.ts`) in the adapter. Security class.

- A `proven` workflow for the job (and, for video, the matching `videoStart` pair) first.
- With `deps.devTools` true and the actor the user, a `trial` one where no `proven` one exists, so the plain screens can run it. Test it with `ADMAN_DEV_TOOLS=1 npm run dev`. Never in a packaged app.
- An agent never gets a `trial` workflow. A `draft` is never sent to any server.
- Otherwise `generation.runImages`, `generation.startVideo` and `job.retry` refuse with `comfy_job_not_offered` before any job row, and the app says why [REQ: FR-254].
- Tests: dev tools off refuses a `trial`; dev tools on with actor `agent` refuses; dev tools on with the user runs against the stand-in.

## Where a graph comes from, and how one is fixed

- **Source.** ComfyUI's own template for the model, in "Export (API)" form (V-3), changed by hand only as `source.changes` records: `PreviewImage` for pictures, the video prefix under `adman/`, app-filled values left at template defaults, a first-run size. Who exports is OI-38. Today's `trial` graphs are agent drafts flattened from the official templates.
- **Entering.** A drafted or exported graph enters `src/main/providers/comfyui/workflows/` as `trial` under its ID with `source` filled in, each in its own small commit. The tests on shipped files run on every one.
- **Fixing one that fails on the real server.** Fix the shipped file, bump `version`, add one line to `source.changes`; in the same commit copy the graph over `comfy-workflows/{file}.json` and add one line under "Not verified" in `comfy-workflows/README.md` (canvas copies in `ui/` are not remade). A fix may change only an input name or value the server's answer names, a missing input, or a `class_type` spelling, each checked against ComfyUI's public source. A fix that needs an add-on, a model file outside the README's table, or a different graph shape goes to the architect. The tests on shipped files must pass: the graph is fixed, not the test.
- **Licence text** [REQ: FR-285]. `licence.commercialNote` is shown wherever a workflow is described: the list of what a workflow needs, Settings, and the confirmation dialog. The app checks no licence.
- **Commercial-licence dialog** [D-088]. Not built (Phase 2 leftovers, LD-1). A workflow whose `licence.commercialNote` is not null runs a model that needs a commercial licence. When the user starts a run with such a workflow, the app first shows a dialog: "{model} requires a commercial license, please confirm that you have one before production use", with the workflow's `model` name in place of `{model}`, the buttons "Cancel" and "Confirm", and a checkbox "don't show again for {model}". Cancel starts nothing. Confirm starts the run. With the box ticked, Confirm also saves the model's name in the settings value `licenceConfirmed` (a list of model names, default empty), and the dialog is not shown again for that model. Settings lists the confirmed models with a "Forget" button for each. The main process makes the check, because only it knows which workflow a run gets (A-40): `generation.runImages`, `generation.startVideo` and `job.retry` take `licenceConfirmed: true` for such a workflow or refuse with `INVALID_INPUT`, `details = { reason: 'licence_not_confirmed', workflow }`, message "{model} requires a commercial license. Confirm that you have one first." (`licenceNotConfirmedMessage`), unless the model is in the saved list. The refusal comes after the workflow is chosen and before any job row or request. The window shows the dialog on that refusal and, on Confirm, sends the same command again with the flag, as the key dialog does for `NEEDS_KEY`. `{model}` is the workflow's `model.label`, and the saved list holds model labels. An agent cannot press Confirm: for an agent the flag is ignored, so its run of such a workflow is refused with that reason until the user has ticked the box for that model. Today this covers MiniMax H3 and FLUX 3 klein; MOSS-Image has no note and no dialog. Slices: S2-4 (main process), S2-6 (dialog), S2-8 (Settings list).

## Filling a run

Built. `fillWorkflow(spec, values)` in `comfyui/fill.ts` (pure); the values are made by `fillValuesFor` in `run.ts`.

```ts
type FillValues = {
  prompt: string
  width?: number; height?: number
  references?: string[]          // uploaded names as the server gave them, in slot order
  firstFrame?: string
  frames?: number
  pad?: { left: number; top: number; right: number; bottom: number }
  promptId?: string              // gives the output prefix adman/{promptId}
}
```

- It copies the graph and sets exactly the inputs the slots name: the prompt (a JSON text value, never joined into anything), width and height, a fresh random seed in every `seed` slot (a whole number below 2^53), the uploaded file names, the frame count, the pad numbers, the output prefix `adman/{promptId}`.
- It adds no node and changes no `class_type`. The only removals are what a shipped spec declares: for each reference slot past the last picture, its `dropWhenUnused` nodes and inputs; and the `alwaysDrop` parts. After removing, it checks that no input left links to a deleted node. What is removed is shipped data, never a value from the caller, a project file or the server.
- **Strict fill.** A missing value for a slot the workflow has, or a value for a slot it lacks (`references: []` included), throws a plain `Error`. The caller sets a key only when the slot is there (for `moss-text-to-image`: prompt, width, height). Such an `Error` is an app fault, not a refusal to show the user.
- Pictures fill reference slots in order. Fewer pictures than `minReferences`, or more than there are slots, is refused by the command before any call (`too_many_references` for too many). The slot count is the most that workflow takes; "up to four" (MOSS) and "up to nine" (H3) are model limits, not a promise.
- Each option is its own submission with its own seed, kept or cancelled on its own [REQ: FR-257].
- If a model fails a slot-dropped graph, that workflow alone falls back to one file per reference count, by a ruling.

**Tests on the shipped files** (`tests/unit/main/providers/comfyui/workflows*.test.ts`, normal run): every pointer names a node and input that exist; every `class_type` is in `needs.nodeClasses`; no input value is text starting with `http://` or `https://`; a picture graph has exactly one `PreviewImage`, it is the `outputNode`, and there is no `SaveImage`; each video graph has exactly one `SaveVideo`; for every reference count from `minReferences` to the slot count, every link points at a node that exists, `outputNode` exists, the removed nodes and inputs are exactly the declared ones, and with every slot used the filled graph differs from the shipped one only at the pointed inputs; two fills give different seeds; `needs.addOns` is empty.

## Sizes (was 6.10.5) [REQ: FR-259, FR-262, A-C3]

Built. `fitSize(asked, rule)` in `src/shared/comfy/fit-size.ts`; constants in `workflows/common.ts`.

MOSS-Image needs sides in multiples of 16 (V-22), MiniMax H3 multiples of 32 near one megapixel (V-19). As for every provider (`spec/providers.md`), `width` and `height` state a shape: the adapter asks for the nearest size the model can make, nobody resizes the result, and the fit happens when the picture is placed in a layer.

1. `r = width / height`. `p = width × height`, moved into `minPixels`…`maxPixels`.
2. The ideal sides are `√(p·r)` and `√(p/r)`. Each is rounded down and up to the multiple (never below one multiple), giving up to four pairs.
3. Pairs whose area is outside `minPixels`…`maxPixels` are dropped, unless that drops all of them.
4. The pair whose ratio is closest to `r` wins (smallest `|ln((w/h)/r)|`). On a tie, the area closest to `p`; then the wider one.

Full sizes (`MOSS_FULL_SIZE`, `H3_FULL_SIZE`); these rows are unit tests, with one custom size:

| Asked | MOSS-Image `{16, 1,000,000, 2,000,000}` | MiniMax H3 `{32, 589,824, 1,048,576}` |
|-------|------------------------------------------|----------------------------------------|
| 1080 × 1080 | 1072 × 1072 | 1024 × 1024 |
| 1080 × 1920 | 1056 × 1872 | 768 × 1344 |
| 1920 × 1080 | 1872 × 1056 | 1344 × 768 |
| 1080 × 1350 | 1088 × 1360 | 896 × 1120 |

H3 at 768 × 1344 for 9:16 is accepted; the H3 numbers stay provisional until a trial (U-19). A video clip is therefore smaller in pixels than the variant, as FR-262 expects.

**First-run sizes ("start small").** The `trial` specs use `MOSS_FIRST_RUN_SIZE = { 16, 840000, 1050000 }` and `H3_FIRST_RUN_SIZE = { 32, 330000, 420000 }` (1080 × 1080 gives 576 × 576 on H3); `draft` specs use the full sizes. Each first-run spec has one `source.changes` line: "first-run size; full size is { multiple: …, minPixels: …, maxPixels: … }". Moving to full size is one line per spec, by a ruling, after the stakeholder has seen a small run work. Video frames stay 56 on first runs.

## A video run (was 6.10.7) [REQ: FR-262, FR-283, FR-286]

Built for all three start pairs. `src/main/providers/comfyui/video.ts`, `video-pictures.ts`, `frames.ts`; `src/main/jobs/kinds/video-generation.ts`; `src/main/commands/generation/start-video.ts`, `start-pair.ts`, `comfy-video-checks.ts`; `src/main/picture-fitter.ts`; `src/main/providers/video-check.ts`.

`VideoProvider` (`spec/providers.md`): `start`, `check`, `fetchResult`, `cancel`, and optional `runSize`.

**The command** (`generation.startVideo`, `spec/api-commands.md`), before any job row. `startPair` turns `start`, `useReferences` and `referenceAssetIds` into one of three pairs: a prompt alone, one first-frame picture, or reference pictures; first frame plus references is not offered. Then `checkComfyVideo`: `comfy_address_needed`; `comfy_job_not_offered` ("ComfyUI cannot make this kind of video yet."); `video_too_long` with `maxMs` ("ComfyUI makes clips of at most {s} seconds with this workflow."); `too_many_references`. `comfy.getInfo` gives each workflow's `maxMs`, so the window can warn and send the most.

**The job kind** reads each picture again with `AssetService.read`. First frame: `image = { bytes: deps.fitPicture(bytes, runSize), mime: 'image/png' }`, `references = []`. Reference: `image = null`, `references = [file as read]`, not fitted. `runSize` is the provider's `runSize(width, height, videoStart)`: for ComfyUI, `fitSize(variant size, workflowForRun('video', videoStart).size)`, the size the fill sends; without it, the variant's own size. `start` takes an optional `{ signal }`.

**`start`** picks `workflowForRun('video', { firstFrame: image !== null, references: references.length > 0 })`. A first frame whose PNG does not state exactly the run size throws before anything is sent. Then the check; each picture is uploaded as in a picture run (bytes only, under `uploadName(bytes)`), and the server's kept name fills `firstFrame` or `references`. A cancel before submission uploads and submits nothing more. Each run's origin, workflow and waits are kept in memory, so only a run this adapter started is asked about. `check` looks once, with the picture run's short-break, `server_stopped`, `too_long` (`VIDEO_WORK_MS`) and `lost_contact` rules (`spec/comfyui.md`). `fetchResult` fetches the `SaveVideo` result under `MAX_VIDEO_BYTES` and runs `checkMp4`; a refusal is `bad_result`. Cancel: `spec/cancel.md`.

**The first frame is never distorted** [REQ: FR-286]. `fitPicture(bytes, { width, height }): Uint8Array` (PNG out), on `CoreDeps`, filled in `src/main/index.ts` with Electron's `nativeImage`. Security class.

- Before decoding, the same checks as `toPng`, in the same order: `MAX_PICTURE_BYTES`, `pictureType` PNG or JPEG, stated size within `MAX_PICTURE_SIDE` and `MAX_PICTURE_PIXELS`, not empty after decoding; plus a run width or height that is not a whole number from 1 to `MAX_PICTURE_SIDE`. Each refusal throws `toPng`'s fixed error.
- Crop the largest centred rectangle with the run's ratio, then `resize({ width, height, quality: 'best' })`; never stretch. An exact-size picture is only re-encoded; a smaller one is scaled up.
- Until Phase 7 the first frame is the picture asset the user chose. Phase 7 swaps in the rendered background layer (`spec/providers.md`, fal step 1).
- **Not built (conditional):** if a real photo comes out turned, `fitPicture` turns it upright from its orientation tag before the crop.

**Length.** Frames are the allowed count (`frameStep × k + frameOffset`, k a whole number from 0) nearest to `round(durationMs / 1000 × fps)`, never above the largest allowed count that fits `maxMs` (`frameCount` in `frames.ts`). For H3: 5, 22, 39, 56 …; two seconds gives 56. `maxMs` stays 15 s (V-19) until a trial shows what the server can make (U-19).

**The result is a file in the server's output folder** (V-38) [D-052 answer 26], under the prefix `adman/{promptId}`, so the user can find and remove the app's clips. The app removes none [REQ: FR-271]; a temporary way is a later pass [REQ: FR-291].

**`checkMp4(bytes)`** (`src/main/providers/video-check.ts`, `MP4_REFUSED`; security class, any change ruled on its own). One shared pure function, used by this adapter and later by fal. It reads box headers only and never decodes. Each refusal is a plain `Error` with a fixed message.

1. Over `MAX_VIDEO_BYTES`: refused.
2. The first box is not `ftyp`: refused. Nothing but MP4 is stored.
3. Walk the boxes with bounds checks: a box size that is 0, below 8 or past the end of the file is refused; at most 10,000 boxes; at most 8 levels deep (separate from folder import depth).
4. There must be a `moov` box with at least one track whose handler is `vide`.
5. A width or height over `MAX_VIDEO_SIDE`, or a length over `MAX_VIDEO_MS`: refused.
6. A video track must list at least one sample: its `stsz` sample count is above 0, or, for a fragmented file, a `trun` inside a `traf` whose `tfhd` names a video track has a count above 0. Otherwise refused with `noFrames` ("The MP4 file has no video frames."). Only `stsz` is read, not the compact `stz2` table. This is checked last.
7. It reports `{ width, height, durationMs, hasSound }`; `hasSound` means a track whose handler is `soun`.

- Fake `mp4File` clips (`src/main/providers/fake/mp4`) carry one sample entry, so they pass `checkMp4`, but do not play: never use one in a test that plays a clip.
- The main process never decodes video; the sandboxed window plays it through `adman-asset://`.

**Sound** [REQ: FR-300, FR-283; D-053 item 12]. Generated video keeps its sound. Shipped video graphs keep the link that feeds sound into the video-building node (`VAEDecodeAudio` into `CreateVideo`). The clip is stored as returned, after `checkMp4`; sound or none is not a fault, and `clip_has_sound` is never raised. The window plays it with sound (format and playback not verified).

**Into the project.** The checked MP4 is written with `writeManaged` (`ext: 'mp4'`) and added with `asset.addGenerated`; the job's `result` holds `{ assetId, …, details: 'pending' }`. No clip is put on a track (Phase 7).

- OI-36 (as built): with no FFmpeg before Phase 7, the clip is stored as the server sent it; its details are on the `asset` row only and the file may hold text the server wrote. `details: 'pending'` marks it for Phase 7 to rewrite, and Phase 7's FFmpeg fills the asset's `width` and `height`.

**Not built: two-reference video.** Declaring the second slot of `h3-reference-to-video` needs one real two-reference run first, then a ruling.

**Not built: an optional enlarging step** [REQ: FR-293]. Off unless the user turns it on. Waits for the stakeholder's hand test of `comfy-workflows/h3-video-first-frame-upscaled.json` (OI-59). Known from the draft: core nodes only (SeedVR2 3B, `diffusion_models/seedvr2_3b_int8_convrot.safetensors` and `vae/seedvr2_ema_vae_fp16.safetensors`); 1.5× gives 1152 × 2016, within `MAX_VIDEO_SIDE`; sound goes round the step. Not designed further.

## Extend a background (was 6.10.8) [REQ: FR-261]

Not built (Phase 5; the hand-test path earlier, see below). `ImageProvider.extend` exists in the adapter and throws "Extending a picture with ComfyUI is not built yet". There is no extend job kind.

- `ImageProvider.extend({ image, placement, width, height, prompt }, opts)`. The adapter uploads the picture, works out the run size with `fitSize`, scales `placement` by the same factor, and fills the four `pad` slots and the scaled picture size, so the server does the canvas work. The rest is a picture run.
- The picture to extend goes in a one-slot `references` with `minReferences: 1`; there is no source-picture slot (`moss-extend` is declared this way). If the real graph of the extend trial needs another shape, it is ruled then.
- No documented way to extend a picture with MOSS-Image was found (**U-13**). The adapter, `fillWorkflow` and the slots are tested against the stand-in; the real graph is made in the trial. The hand-test draft `comfy-workflows/moss-image-extend.json` pads with a grey border (`ImagePadForOutpaint`; each pad a multiple of 8) and repaints only the border. Until the trial passes, ComfyUI is not offered for "generate fill" [REQ: FR-254].
- `generation.runFill` is Phase 5. Before then the trial runs from the hand-test screen with `dev.comfyExtend` (below).
- If the extend trial fails, Krea 2 may become the fallback for extend (CQ-27).

## What the app leaves on the server (was 6.10.10) [REQ: FR-271, FR-282]

Built. `comfy.getInfo` returns these sentences (each workflow's `leavesOnServer`, in the fixed order of `LEAVES` in `workflows/common.ts`), and Settings shows them where the address is entered, with the privacy note of `REQUIREMENTS-ComfyUI.md` 3.3:

- "Reference pictures and first frames that Adman uploads stay in the server's input folder, under adman/."
- "Each picture leaves a file in the server's temporary folder until the server restarts."
- "Each video run leaves a file in the server's output folder, under adman/."
- "The server keeps its own record of each run, the prompt included." (**U-16**)

The app removes none of them and has no call that could.

## Trials and `proven` (was 6.10.11) [REQ: FR-284]

Everything in the adapter is built and tested against the stand-in. A trial on a real server decides: that the graphs run; the real shape of a history entry and of `/api/jobs/{id}` (fixtures are hand-made until then); whether each model fits the server's card and how long a run takes (U-11), and so the time limits; whether references keep a product recognisable (U-17); whether extend works (U-13); the frame rule.

- **Ready for a test:** the check shows nothing missing, and its `test:comfy` and adapter cases passed. It stays `trial`.
- **The owner check, to `proven`** [REQ: 3.3 Maintainability], per workflow: (1) `comfy.check` shows nothing missing; (2) `npm run test:comfy` passes its case; (3) the stakeholder runs it from the test-path screens with dev tools on, at the three default sizes, and accepts what he sees: for a reference workflow with a real product's pictures, and with the smallest and largest reference count; for video with the clip played; and four runs at once. Then a one-line change sets `status: 'proven'` and records `needs.checkedWith`. **No agent sets `proven`.** Not done for any workflow yet.
- **Order of trials.** MiniMax H3 first; MOSS-Image once installed, and nothing waits for it. A failed reference trial sends the choice of model back to the stakeholder [L-2]; a failed extend trial, CQ-27.
- **Not built: time limits after the trial.** See `spec/comfyui.md`, "Limits on every answer".

### Trials on a real server: `test:comfy` (was 6.10.12)

Built, except where marked. Shared harness rules: `spec/testing.md`; variables: `spec/infra-and-settings.md`. The ComfyUI run is separate from the paid one, so it can never spend money or load a paid key.

| | |
|---|---|
| Script | `"test:comfy": "vitest run --config vitest.comfy.config.ts"` |
| Config | `vitest.comfy.config.ts` exports a function and reads `.env.local` only inside it, nothing at the top level, as the live config does |
| Files | `COMFY_INCLUDE = ['tests/comfy/**/*.test.ts']`, in `tests/comfy/env-file.ts` |
| Names taken from the file | One: `COMFY_BASE_URL` (`COMFY_ENV_NAMES`). Not in `LIVE_ENV_NAMES`; the comfy config takes no name from that list. A value set in the terminal wins. |
| No address | Each test skips itself with one line naming the variable |
| Switches, terminal only, never from the file | `ADMAN_COMFY_VIDEO=1` (case 2), `ADMAN_COMFY_MOSS=1` (case 3), `ADMAN_COMFY_FLUX=1` (case 5), `ADMAN_COMFY_FRAME=1` (case 6), `ADMAN_COMFY_REFVIDEO=1` (case 7), `ADMAN_COMFY_PICTURE` (absolute path of a given picture). Each is checked before any call; with a switch unset the stand-in sees nothing for that case. |

- The address goes through `parseComfyAddress`; a refused one is a skip that prints the reason code only. No agent opens `.env.local`.
- **The address is never printed**: not in output, test names, snapshots, errors or reports. Everything printed goes through `hideAddress(text, origin)` (`tests/comfy/print.ts`), which replaces the origin, the host and `host:port` with `[test server]` (one unit test; rare forms, which can only arrive inside the server's own text, are not handled).

**Rules every ComfyUI test follows** [REQ: FR-289]. The test server is someone's working machine and may hold real work.

- A test talks to the server only through `createComfyClient` (and the adapter where a case says so), which has no clearing call. Each test wraps the client in a recorder and ends by asserting the calls made were only the ones it meant.
- A test cancels only an ID it submitted. It never asks for a clean queue. It waits behind other work, with a 30-minute limit per case.
- **Interrupt gate** (security class). On a time-out a case always sends `removeFromQueue` for its own ID. It sends `interrupt` only when all three hold: the run was seen working; `/api/jobs` answered at least once; the version from the case's own check is readable and at least `0.30.0` (a constant in `tests/comfy/`). Otherwise it prints that its own run may still be running, and fails.
- A test removes nothing from the server. Runs are the smallest that prove the point: one option, the smallest size the workflow allows, 56 frames. Each picture run leaves one file in the temporary folder and at most one in `input/adman/`; each video case leaves a file in the output folder that nothing can remove, so one video attempt per graph change. A case runs once per change to its graph, and at most six times in all without asking the stakeholder. A failed run may be re-run once after a fix to its data.
- **What it may print from the server:** a refusal's `type`, `message`, `details`, and per node error the node ID, the app's own `class_type`, `inputName`, `type`, `message`, `details`; a failed run's exception type and message. Control characters removed, cut to 500 characters (`SAFE_LINE_CHARS`), through `hideAddress`. Never the traceback, a received value, or the address.
- **The picture sent.** `ADMAN_COMFY_PICTURE` (rules for pictures given by path: `spec/testing.md`): only its bytes are sent, under `uploadName(bytes)`; its path and file name are never sent or printed. Without it the test makes its own ~768 × 768 PNG of plain shapes with `node:zlib`, never a file from the user's disk, a project or an asset. No JPEG run is made.

**Cases** (`tests/comfy/cases.ts`, `comfy.test.ts`):

1. The check, always. Prints the server version and, per `trial` workflow, "complete" or the missing items by the app's names; if not `ok` although `systemStats` answered, which call failed with its kind, reason and detail; per `draft` workflow, its model files present or missing (GETs only).
2. Video on `h3-text-to-video`, only when nothing is missing: passes when the server accepted the graph, the run ended without error, and the bytes pass `checkMp4` under `MAX_VIDEO_BYTES` (else `checkMp4 refused the clip: <reason>`, a fixed `MP4_REFUSED` name). Prints times, byte size, width, height, duration and sound (a fact, not a pass rule); writes the clip to the system temporary folder and prints the path.
3. Picture on `moss-text-to-image`: passes when `pictureType` says PNG or JPEG; prints time, pixel size, byte size.
4. Field names of the first ended run's history entry and job state: the names the client keeps, no values.
5. Picture from a reference on `flux3-klein-edit-references` through `image.generate`: passes like case 3; writes the result to the temporary folder. Looking at it is a hint, not a pass rule.
6. and 7. H3 from a first frame and from one reference, client level: `uploadImage`, `fillWorkflow`, `submit`, poll, `viewFile` under `MAX_VIDEO_BYTES`, `checkMp4`, a temp file, time and size printed.

**Not built: the rest of `test:comfy`.** A cancel case (one cancel of the test's own run, asserting `stopped` or `finished`); a four-at-once case; printing through `cleanServerText` in place of `hideAddress`-only printing. And, after the first real run, a tests-only pass that corrects the stand-in's fixtures to the shapes the real server showed; if a real shape breaks a client schema, stop and report (a client change, ruled on its own).

**Who may run what.** Project agents may run `npm run test:comfy` without asking each time [D-052 answer 22]; that covers this script only. `npm run test:live` runs only when the stakeholder asks [D-049], and no agent makes a paid call. An agent sets a video switch only when its task is the video path. The real-app run `test:e2e:real` is in `spec/testing.md`.


## The hand-test screen's ComfyUI part (was 6.10.13) [REQ: FR-290]

Not built (Phase 2; whether still wanted is OI-64). Dev-only, like `dev.storage`: shown only when `app.getState` says `devTools`, never in a packaged app. Owns the ComfyUI section of `src/renderer/dev/` and `src/main/commands/dev/comfy-extend.ts`. It uses the product commands. The test-path screens with dev tools on stand in for it.

- The address field (`comfy.setAddress`), "Check" (`comfy.check`), the missing items and licence notes per workflow, the "left on the server" sentences.
- A workflow picker that includes `trial` ones: `generation.runImages` and `generation.startVideo` take an optional `workflowId` from `WORKFLOW_IDS`, accepted only when `deps.devTools` is true and the actor is the user; otherwise `INVALID_INPUT`.
- Prompt, size, count, reference pictures from the project's library; for video the start choice and length. Generate. Waiting or working, with the place in the queue. Cancel. The result through `adman-asset://`, a video played muted. "Show the server's message" on a failure.
- Extend: the dev command `dev.comfyExtend { projectId, assetId, width, height, prompt }`, registered only with `devTools`, agent policy deny (the row exists). It enqueues an `image_generation` job whose request has `mode: 'extend'`, with the picture centred on the new canvas. Phase 5's `generation.runFill` replaces it.

## Not built: Krea 2 and custom workflows

- **Krea 2** (OI-58, CQ-27). Nothing is built until MOSS-Image and MiniMax H3 pass their trials. It may provide alternate workflows, including the extend fallback; which jobs it gets is not decided. `job` plus `model` already allow a second model for one job; the run input then gains a model choice. `comfy-workflows/krea2-*.json` are for hand tests only. Its licence limits commercial use.
- **Custom (user-added) workflows** (OI-57, D-058). Not designed. Answered so far: a value the app fills is marked by the step's title set in ComfyUI; an agent may run a listed custom workflow under the ComfyUI tick; pictures and video first, after the stock workflows pass on the test machine; workflows are treated like assets, as external files (CQ-38, differing from FR-309 and FR-326). It needs its own ruling on "the only workflows the app can send" (this file, "The workflow description") and FR-278, and waits for the analyst's revision 2 of `REQUIREMENTS-ComfyUI-Draft5.md`.

## What a server needs (operator facts)

Update ComfyUI (0.45.0 or later advised); install no add-on. Put the model files of the table above in `ComfyUI/models/{folder}` (from the Hugging Face repos `Comfy-Org/MiniMax-H3`, `Comfy-Org/MOSS-Image`), then restart. Flux reference pictures need only the three Flux files; MOSS-Image is needed only for pictures from a prompt alone. Reference pictures as PNG or JPEG, not WebP.

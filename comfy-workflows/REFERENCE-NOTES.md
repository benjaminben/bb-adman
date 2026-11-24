# Notes from the five reference workflows

On 2026-11-21 the drafts were checked against five ComfyUI workflow files sent by the stakeholder. All five are API-format exports, not canvas files:

| Short name | What it is |
|---|---|
| **i2v** | Official template, MiniMax H3 image to video |
| **r2v** | Official template, MiniMax H3 reference to video (two references) |
| **moss-edit** | MOSS-Image edit (official-style: every node is comfy-core) |
| **qwen-edit** | Qwen Image 2.1 edit (every node is comfy-core) |
| **community** | A community H3 workflow. Used for reference only; it uses add-on nodes |

None of these files was copied here. Only facts were taken from them. Nothing has been run yet.

Marks used in the tables:
- **official**: confirmed by an official template (i2v, r2v or moss-edit)
- **community**: seen in the community file only
- **inferred**: not in any reference; my reasoning

## Summary

- **All four H3 drafts:** two fixes, both confirmed by i2v and r2v. `CreateVideo` now carries all five settings the templates send. `SaveVideo` also gets the extra `codec` key the templates send. Everything else in the H3 drafts already matched the templates.
- **MOSS drafts:** no change. Every node, input name, model file and setting that the moss-edit file can confirm already matched.
- **Krea 2 drafts:** not checked (out of scope).
- **Canvas copies (`ui/`):** not changed. Details below.

## `h3-video-text.json` (tomorrow's test)

No official text-to-video file was among the five. This draft is the i2v graph with the first-frame input left out.

| What | Before | After | Mark |
|---|---|---|---|
| `CreateVideo` (node 13) | only `fps: 24` | `fps 24`, `bit_depth 8`, `color_space "sRGB"`, `chroma_subsampling "auto"`, `codec "none"` | official |
| `SaveVideo` (node 14) | `format`, `format.codec` | `format "auto"`, `format.codec "auto"`, `codec "auto"` | official |

Why the fixes matter: an API run fails if a required input is missing. The templates send all of these, so the drafts now do too. Extra keys are ignored by ComfyUI, so sending more is the safer side.

**Checked and unchanged**

| What | Value | Mark |
|---|---|---|
| Model loader | `UNETLoader`, `minimax_h3_fl2va_pruned_int8_convrot.safetensors`, `weight_dtype "default"` | official |
| Text encoder | `CLIPLoader`, `qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors`, `type "minimax"`, `device "default"` | official |
| Video VAE | `VAELoader`, `minimax_h3_video_vae_int8_convrot.safetensors` | official |
| Audio VAE | `VAELoader`, `minimax_h3_audio_vae_fp32.safetensors`, decoded with `VAEDecodeAudio` from the sampler's latent | official |
| Conditioning node | `MiniMaxH3ImageToVideo` with `prompt`, `width`, `height`, `length`, `clip`, `vae`. It takes no `audio_vae`; the sound comes out of the same latent | official |
| Text-to-video = that node with no `first_frame` | `first_frame` left out | **inferred**. No reference shows the node without it. If ComfyUI says `first_frame` is required, this draft cannot work as built |
| Sampler path | `RandomNoise` → `SamplerCustomAdvanced`, `KSamplerSelect "res_multistep"`, `BasicScheduler "simple"`, 20 steps, denoise 1, `BasicGuider` | official |
| No speed-up LoRA | template default (switch off) | official |
| Latent | output 1 of the conditioning node; conditioning is output 0 | official |
| fps | 24 | official |
| Frame count rule | frames = 17k + 5. The templates turn seconds into frames with `max(5, round(s*24))` rounded up to the next 17k+5. 56 fits the rule | official |
| Frame count 56 | the template default is 5 s, which gives **124** frames | inferred (kept short for the 3090) |
| Size 768x1344 | both numbers are multiples of 32, as the templates' `ResolutionSelector` (`multiple 32`) uses | official (the rule); size from the spec |
| Size in pixels | the templates use **0.4 MP**. 768x1344 is about 1.0 MP, 2.5 times as many | see open question 2 |
| Save to `adman/` in the output folder | `SaveVideo` writes to the output folder; the template prefix is `video/MiniMax_H3` | official (node); prefix from README |

**App fills:** node 5 `prompt`, `width`, `height`, `length`; node 6 `noise_seed`; node 14 `filename_prefix`. Output node: 14.

## `moss-image-plain.json` (tomorrow's test)

No change. The moss-edit file confirms the parts both graphs share. The text-to-picture parts are not in it.

| What | Value | Mark |
|---|---|---|
| Model | `UNETLoader`, `moss_image_sft_int8_convrot.safetensors`, `weight_dtype "default"` | official |
| Text encoder | `CLIPLoader`, `qwen3.5_9b_w4a8_gptq.safetensors`, `type "moss_image"`, `device "default"` | official |
| VAE | `VAELoader`, `flux2-vae_small.safetensors` | official |
| Latent | `EmptyFlux2LatentImage` with `width`, `height`, `batch_size 1` | official |
| Decode | `VAEDecode` | official |
| Prompt nodes | plain `CLIPTextEncode` (`clip`, `text`) for positive and negative | **inferred**. moss-edit uses `TextEncodeMOSSImageEdit` with a picture. No reference shows MOSS with `CLIPTextEncode` |
| Negative text | `nsfw, worst quality, bad anatomy, watermark, jpeg artifact` | official (same text as moss-edit) |
| Sampler | `KSampler`, 25 steps, cfg 2.5, `er_sde`, `simple` | **not confirmed**. moss-edit uses 30 steps, cfg 4, `euler`, `normal`. Those are edit settings (with the edit LoRA), so I kept the draft's text-to-picture values, which README says came from the official text-to-picture template |
| No `SkipLayerGuidanceDiTSimple` | left out | **not confirmed**. moss-edit always uses it (`single_layers "22"`, `double_layers ""`, 0 to 1). README says the text-to-picture template has it as an optional extra, off by default |
| Size 1056x1872 | multiples of 16, as moss-edit uses (`resolution_steps 16`) | official (the rule) |
| Size in pixels | moss-edit works at **1 MP**. 1056x1872 is about 2.0 MP | see open question 2 |
| Output | `PreviewImage` (temp folder). moss-edit uses `SaveImage` (output folder) | kept on purpose (README) |

If the first run fails or looks poor, the fallback is moss-edit's sampler settings: 30 steps, cfg 4, `euler`, `normal`, with `SkipLayerGuidanceDiTSimple` between model and sampler.

**App fills:** node 4 `text`; node 6 `width`, `height`; node 7 `seed`. Output node: 9.

## `h3-video-first-frame.json`

Same two fixes as the text draft (nodes 13 and 14), confirmed by i2v.

| What | Mark |
|---|---|
| `MiniMaxH3ImageToVideo` with `first_frame` from a `LoadImage` | official |
| Same models, sampler, steps and fps as the text draft | official |
| The template feeds the first frame straight from `LoadImage`, while the size comes from a separate `ResolutionSelector`. So the template itself does not size the picture to match | official |
| The community file scales the first frame to 1 MP first (`ResizeImageMaskNode`, a core node) | community |

**App fills:** node 5 `prompt`, `width`, `height`, `length`; node 6 `noise_seed`; node 15 `image`; node 14 `filename_prefix`. Output node: 14.

## `h3-video-references.json`

Same two fixes (nodes 13 and 14), confirmed by r2v.

| What | Mark |
|---|---|
| `UNETLoader` with the separate `minimax_h3_ref2va_pruned_int8_convrot.safetensors` | official |
| `MiniMaxH3ReferenceToVideo` takes `audio_vae` as well as `vae` (the i2v node does not) | official |
| `ref_image_size "match"` | official |
| References wired as `ref_images.ref_image_0`, `ref_images.ref_image_1`, straight from `LoadImage` | official |
| Prompt names them `<Picture 1>`, `<Picture 2>` | official |
| A run with only one reference (`ref_image_0` only) | community |
| Up to 9 references | **not confirmed**. No reference states a maximum; the figure comes from README's reading of the source |

**Dropping unused reference slots:** these are "grow as you connect" inputs. An export lists only the slots that are wired, which is why the community file has only `ref_image_0`. So for N pictures the app should keep `ref_image_0` to `ref_image_{N-1}` and delete both the unused `ref_images.ref_image_K` keys and their `LoadImage` nodes. Not known: whether zero references works, and whether a gap (0 and 2 but not 1) works. Keep the slots numbered from 0 with no gaps.

**Speed-up LoRA:** r2v's is a different file from i2v's: `minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors` (`loras`), at **4** steps. README only names the i2v one (`minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors`, 8 steps).

**App fills:** node 5 `prompt`, `width`, `height`, `length`; node 6 `noise_seed`; nodes 15 and 16 `image`; node 14 `filename_prefix`. Output node: 14.

## `h3-video-first-frame-upscaled.json`

Same two fixes (nodes 13 and 14). The upscaler part was not checked; no reference covers it.

## `moss-image-references.json` and `moss-image-extend.json`

No change. Both already match moss-edit in every shared part:
- `LoraLoaderModelOnly` with `moss_image_edit_lora_rank_64_bf16.safetensors`, strength 1
- `SkipLayerGuidanceDiTSimple` (`single_layers "22"`)
- `TextEncodeMOSSImageEdit` with `prompt`, `edit_format "Moss-Image-Edit"`, `image_strength 1`, `clip`, `vae`, `images.image_0`. The negative gets the first picture too.
- `ImageScaleToTotalPixels` (`lanczos`, 1 MP, `resolution_steps 16`) before each picture
- `KSampler` 30 steps, cfg 4, `euler`, `normal`

All of that is **official**. Still **inferred**: the second reference (`images.image_1`), the fixed size instead of the template's "size from the photo" (`GetImageSize`), and the whole extend method.

Reference count: moss-edit uses one picture. The maximum (README says four) is **not confirmed**. The same rule for dropping slots should apply: number from `image_0` with no gaps.

**App fills (references):** node 6 `prompt`; node 8 `width`, `height`; node 9 `seed`; nodes 10 and 11 `image`. Output node: 15.
**App fills (extend):** node 10 `image`; node 11 `width`, `height`; node 12 `left`, `top`, `right`, `bottom`; node 6 `prompt`; node 9 `seed`. Output node: 15.

## Canvas copies in `ui/`

Not changed. The H3 canvas copies now differ from their API files in two places:
- `CreateVideo` lists only `24`. The other four values are not set, so the canvas uses its own defaults.
- `SaveVideo` lists three values. The extra `codec` key may be an old name and may not appear in the canvas at all.

I did not edit them because the order of these values in the canvas list is not in any reference, and a wrong order would put values in the wrong boxes. The copies should still load. For a run that matches the templates, use the API files.

## Model files

All loaders and folders below are confirmed by the references unless marked.

| Folder under `ComfyUI/models/` | File | Loader | Used by |
|---|---|---|---|
| `diffusion_models` | `minimax_h3_fl2va_pruned_int8_convrot.safetensors` | `UNETLoader` | H3 text, first frame, upscaled |
| `diffusion_models` | `minimax_h3_ref2va_pruned_int8_convrot.safetensors` | `UNETLoader` | H3 references |
| `text_encoders` | `qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors` | `CLIPLoader`, type `minimax` | all H3 |
| `vae` | `minimax_h3_video_vae_int8_convrot.safetensors` | `VAELoader` | all H3 |
| `vae` | `minimax_h3_audio_vae_fp32.safetensors` | `VAELoader` | all H3 |
| `diffusion_models` | `moss_image_sft_int8_convrot.safetensors` | `UNETLoader` | all MOSS |
| `text_encoders` | `qwen3.5_9b_w4a8_gptq.safetensors` | `CLIPLoader`, type `moss_image` | all MOSS |
| `vae` | `flux2-vae_small.safetensors` | `VAELoader` | all MOSS |
| `loras` | `moss_image_edit_lora_rank_64_bf16.safetensors` | `LoraLoaderModelOnly` | MOSS references, extend |
| `loras` (optional) | `minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors` | `LoraLoaderModelOnly` | H3 speed-up, 8 steps |
| `loras` (optional) | `minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors` | `LoraLoaderModelOnly` | H3 references speed-up, 4 steps |

The folder names follow from the loader: `UNETLoader` reads `diffusion_models`, `CLIPLoader` reads `text_encoders`, `VAELoader` reads `vae`, `LoraLoaderModelOnly` reads `loras`. The references give only file names, not folders.

The community file uses a different video VAE, `minimax_h3_video_vae_fp16.safetensors`. It may be a larger alternative to the int8 one (community).

For tomorrow's two tests: the five H3 files in the first five rows (minus `ref2va`), and the three MOSS files.

## ComfyUI version

No reference states a minimum version. Each node in an export carries the version of ComfyUI that saved it:
- i2v and r2v: `0.33.0`
- moss-edit and qwen-edit: `0.45.0`
- community: `0.30.0`

So a ComfyUI of 0.45.0 had every node used here. That is an upper bound for the minimum, not the minimum itself. Neither 0.33.0 (as a minimum) nor README's "0.43.0 or later" for MOSS is confirmed. The safest advice: update to 0.45.0 or later.

## Where the references differ from `README.md`

1. README "Not verified" item 4 (`SaveVideo` input names): confirmed. The templates also send a third key, `codec "auto"`, now added.
2. README item 5: the templates set four more `CreateVideo` values, not just bit depth. All are now set.
3. README item 8 names one speed-up LoRA. The reference graph uses a different one at 4 steps (see above).
4. README says H3 drafts come from `video_minimax_h3_t2v.json`. That file was not among the five, so the text-to-video form is not confirmed.
5. Template defaults are 0.4 MP and 5 s (124 frames) for H3, and 1 MP for MOSS edit. The drafts use about 1.0 MP / 56 frames and about 2.0 MP.
6. README says the MOSS edit node needs ComfyUI 0.43.0. The references show only 0.45.0 as a saving version.

## Community file: add-on nodes kept out of the drafts

The community file uses these add-on nodes. None is in the drafts.
- `VHS_VideoCombine` (pack `comfyui-videohelpersuite`): saves the MP4 with sound. Settings there: 24 fps, `video/h264-mp4`, `yuv420p`, crf 18.
- `FloatConstant`, `StringConstant`, `StringConstantMultiline`, `PathchSageAttentionKJ` (pack `comfyui-kjnodes`). The last one is a speed patch ("sage attention").
- `Any Switch (rgthree)` (pack `rgthree-comfy`).

Other facts from it: 30 steps; both H3 nodes in one graph behind a switch; one reference scaled to 1 MP; a prompt that names `<Audio 1>`, which hints that the reference node can also take sound. That last point is not confirmed.

## Qwen Image 2.1 edit (notes only, not a draft)

- **Models:**
  - `qwen_image_2.1_int8_convrot.safetensors` (`diffusion_models`, `UNETLoader`)
  - `qwen3vl_8b_int8_convrot.safetensors` (`text_encoders`, `CLIPLoader` type `qwen_image`)
  - `qwen_image_2.1_vae_bf16.safetensors` (`vae`)
  - Optional prompt rewriter: `qwen3.5_9b_qwen_image_2.1_pe_i2i.int8_convrot.safetensors` (`text_encoders`). It is off by default in the file.
- **Nodes:** all comfy-core.
  - `QwenImage21Cache` (`device "auto"`, `dtype "default"`) between model and sampler.
  - `TextEncodeQwenImage21` with `prompt`, `negative_prompt ""`, `resolution 0`, `clip`, `vae`, `images.image_1`, `images.image_2`. It gives positive (output 0), negative (output 1) and a latent (output 2).
  - `KSampler` 25 steps, cfg 1, `euler`, `simple`.
  - `SaveImageAdvanced` (png). The rewriter path uses `TextGenerate`, marked deprecated.
- **References:** the file uses two. Note that its slots start at `image_1`, not `image_0`. No maximum is stated.
- **Size:** by default the latent comes from the encode node, so the output size follows the input pictures. A switch can instead use `EmptyLatentImage` at a set size. The app would need that switch path so it can set the size.
- **To offer it:**
  - a project decision to add a fourth model
  - about three new model files
  - a flattened draft (cache → encode → sampler → decode → preview)
  - a 9:16 size rule
  - a test run
  - a licence check (none is stated in the file)

## Open questions

1. **Text-to-video node:** does `MiniMaxH3ImageToVideo` accept a run with no `first_frame`? Tomorrow's test answers this. If not, is there an official t2v template file to compare with?
2. **Sizes:** the official defaults are about 0.4 MP for H3 and 1 MP for MOSS. The drafts use about 1.0 MP and 2.0 MP, from the spec. On a 3090, should the first test use the template sizes, to separate "does the graph work" from "does it fit"?
3. **MOSS text-to-picture sampler:** keep the draft's values (25 steps, cfg 2.5, `er_sde`, `simple`, no skip-layer), or use moss-edit's confirmed values? Only the official text-to-picture template can settle this.
4. **Reference limits:** what are the real maximums for H3 references (README says 9) and MOSS edit pictures (README says 4)? Does an H3 reference run with zero pictures work?
5. **Qwen Image 2.1:** is it worth a decision? It is all core nodes and takes several pictures. It would be a fourth model.

## Flux 3 klein edit

Draft: `flux3-klein-image-references.json`. It was written from one more reference file sent by the stakeholder, a Flux 3 klein image edit workflow in API format. The file was not copied here; only facts were taken from it. The draft has never been run and has no canvas copy in `ui/`.

Marks in this section:
- **from the reference file**: the value is in the file as written
- **inferred**: my reasoning; not shown in the file

### What the draft is

The reference file's main path, flattened, with its prompt helpers left out:

`LoadImage` → `ReferenceMultiLatent` (with the positive and negative prompt and the VAE) → `KSampler` → `VAEDecode` → `PreviewImage`

### Node classes in the draft

| Draft node | Class | Inputs | Mark |
|---|---|---|---|
| 1 | `UNETLoader` | `unet_name`, `weight_dtype "default"` | from the reference file |
| 4 | `CLIPLoader` | `clip_name`, `type "flux3"`, `device "default"` | from the reference file |
| 5 | `VAELoader` | `vae_name` | from the reference file |
| 10 | `LoadImage` | `image` | from the reference file (class); the file name `adman-reference-1.png` follows the other drafts |
| 6 | `CLIPTextEncode` (positive) | `clip`, `text` | class and inputs from the reference file. Typing the prompt straight into `text` is **inferred** (see "Prompt path") |
| 7 | `CLIPTextEncode` (negative) | `clip`, `text ""` | from the reference file |
| 8 | `ReferenceMultiLatent` | `positive`, `negative`, `vae`, `images.image0`, `resolution "resize"`, `resolution.megapixels 1` | from the reference file |
| 9 | `KSampler` | see "Sampler settings" | from the reference file |
| 14 | `VAEDecode` | `samples`, `vae` | from the reference file |
| 15 | `PreviewImage` | `images` | **inferred** swap. The reference file ends in `SaveImage` with a `filename_prefix`. The project's rule for picture graphs is `PreviewImage` and no `SaveImage`, as in the MOSS drafts |

`ReferenceMultiLatent` gives three outputs, and the sampler uses all three: output 0 is the positive, output 1 the negative, output 2 the latent (from the reference file).

### Model files

| Folder under `ComfyUI/models/` | File | Loader | Mark |
|---|---|---|---|
| `diffusion_models` | `flux3-image-klein-base-int8-convrot.safetensors` | `UNETLoader` | file name from the reference file; folder inferred |
| `text_encoders` | `qwen3vl_4b_int8_convrot.safetensors` | `CLIPLoader`, type `flux3` | file name from the reference file; folder inferred |
| `vae` | `flux2-vae.safetensors` | `VAELoader` | file name from the reference file; folder inferred |
| `text_encoders` (not used by the draft) | `qwen3.5_9b_flux3_prompt_upsampler_w4a8.safetensors` | `CLIPLoader`, type `flux3` | file name from the reference file; folder inferred. Only the prompt rewriter needs it |

The reference file gives file names only. The folders follow from the loader class, the same rule as in "Model files" above.

Two things to watch:
- The VAE is `flux2-vae.safetensors`. The MOSS drafts use `flux2-vae_small.safetensors`. They are different files.
- The text encoder is `qwen3vl_4b_int8_convrot.safetensors`. Krea 2 uses `qwen3vl_4b_fp8_scaled.safetensors`. They are different files.

File sizes, the download place and the licence are not in the reference file. All three are unknown.

### Sampler settings

All from the reference file: `KSampler`, 50 steps, cfg 1, `euler`, `simple`, denoise 1. The model goes from `UNETLoader` straight into the sampler, with no LoRA and no patch node in between. The reference seed was a fixed number; the draft uses `1` and the app fills it.

One thing in the reference file does not add up. The model file is named "klein-base", but the save prefix there says "klein_distilled", and cfg 1 with 50 steps is an unusual pair (cfg 1 normally means the negative prompt has no effect, and distilled models normally need few steps). The draft keeps the file's values as they are. Whether 50 steps is needed is a guess to settle by a test run.

### How references are numbered

- **Input slots** on `ReferenceMultiLatent`: `images.image0` (from the reference file). Note there is no underscore, unlike MOSS (`images.image_0`), and the count starts at 0, unlike Qwen Image 2.1 (`image_1`).
- **Maximum the file shows: one.** Only `images.image0` is wired. No maximum is stated anywhere in the file.
- **The draft has one reference** (node 10), the same number the reference file wires.
- **A second reference** would be a new `LoadImage` wired to `images.image1`. That slot name is **inferred** from the pattern; the file does not show it.
- **Dropping unused slots:** with one slot there is nothing to drop. If more are added, the rule from the other drafts should apply: number from `image0` with no gaps, and delete both the unused `images.imageK` key and its `LoadImage` node (inferred).
- **In the prompt text:** the reference file's raw prompt names a picture as `<ref_image_0>` and a boxed area as `<obj_1>`. Those tags are read by helper nodes the draft leaves out. The draft's prompt says "the first image" in plain words instead (see next part).
- The reference feeds `LoadImage` straight into `ReferenceMultiLatent`, with no scaling node in front (from the reference file).

### Prompt path (the biggest change from the reference)

In the reference file the typed prompt does not go straight to the text encoder. It goes through:
1. `Flux3LayoutPrompt`, which takes the typed prompt and a list of boxes drawn on the picture (`CreateBoundingBoxes`).
2. A switch (`ComfySwitchNode`). As saved, the switch is `false`, which picks the **prompt rewriter**: `TextGenerate` with its own text encoder file, a long system prompt, and the reference pictures (`BatchImagesNode`). So in the reference file the rewriter is **on** by default.
3. The result goes into `CLIPTextEncode`.

The draft leaves all of that out and types the prompt straight into `CLIPTextEncode`. This matches the other drafts ("the prompt-rewriting step is turned off"), but here it is **inferred**, for two reasons:
- The reference's own "rewriter off" path still passes the prompt through `Flux3LayoutPrompt`. No path in the file skips that node.
- With the rewriter on, the model gets a long, detailed instruction. A short plain prompt may give a weaker result.

Why plain words like "the first image" in the draft prompt: the rewriter's system prompt (from the reference file) tells it to write one block of plain English, with no angle-bracket tags, and to name pictures in order ("the first image, the second image"). So that is the kind of text the model gets in the reference's default path. Whether a raw `<ref_image_0>` tag also works in `CLIPTextEncode` is not known.

### Size behaviour

**The size follows the input.** The sampler's latent comes from output 2 of `ReferenceMultiLatent`, set to `resolution "resize"` with `resolution.megapixels 1` (from the reference file). My reading (**inferred**): the result has the shape of the reference picture, scaled to about 1 megapixel. With more than one reference, which picture sets the shape is not known.

What the app can set in this draft: `resolution.megapixels` on node 8 (the total pixel count), but not the width and height. So to get a 9:16 result, the app would give it a 9:16 reference picture.

A possible way to a settable size, **not in the draft**: the reference file contains an `EmptyFlux2LatentImage` node (`width 1024`, `height 1024`, `batch_size 1`), but nothing is wired to it, so the file never uses it. Wiring one into the sampler's `latent_image` in place of output 2 of node 8 is how the MOSS draft sets its size. For Flux 3 klein this is **inferred** and unproven: the file does not show it working. The `resolution` setting may also have other choices besides `"resize"`; the file shows only that one.

### ComfyUI version

Every node in the reference file is stamped `comfy-core`, version `0.45.0` (from the reference file). So ComfyUI 0.45.0 had every node used here. As with the other references, that is an upper bound for the minimum version, not the minimum itself.

### Add-on nodes

**None.** All 21 nodes in the reference file are stamped `comfy-core`. Nothing had to be replaced.

Core nodes in the reference that the draft leaves out, and why:

| Class | What it does there | Why left out |
|---|---|---|
| `Flux3LayoutPrompt` | joins the typed prompt with drawn boxes | needs boxes drawn in the canvas |
| `CreateBoundingBoxes` | the box drawing tool | canvas tool; its saved state is editor data |
| `TextGenerate` (titled "DEPRECATED" in the file) | the prompt rewriter | prompt rewriting is off in all drafts; the node is marked deprecated |
| `CLIPLoader` (second one) | loads the rewriter's model | only the rewriter needs it |
| `PrimitiveStringMultiline` | the rewriter's system prompt | only the rewriter needs it |
| `BatchImagesNode` | gives the pictures to the rewriter (`images.image0`) | only the rewriter needs it |
| `ComfySwitchNode` | rewriter on or off | flattened away |
| `PreviewAny` (two) | show the prompt text | display only |
| `ImageCompare` | before and after view | display only |
| `EmptyFlux2LatentImage` | nothing; it is not wired | unused in the reference |
| `SaveImage` | saves to the output folder | swapped for `PreviewImage` |

### App fills

Node 6 `text`; node 9 `seed`; node 10 `image`. Output node: 15. Optional: node 8 `resolution.megapixels`.

### Still a guess

1. The whole draft: it has never been run or opened in ComfyUI.
2. A prompt typed straight into `CLIPTextEncode`, with no `Flux3LayoutPrompt` and no rewriter.
3. Plain words ("the first image") in place of the `<ref_image_0>` tag.
4. The folders of the model files.
5. That the result takes the shape of the reference picture at about 1 MP.
6. The slot name `images.image1` for a second reference, and any maximum.
7. A settable size through `EmptyFlux2LatentImage`.
8. `PreviewImage` in place of `SaveImage` (a safe swap in the other drafts, but not shown in this file).
9. Whether 50 steps at cfg 1 is right for the "base" model file, and whether it fits and how long it takes on a 3090. File sizes are unknown.

### Open questions for this draft

1. **Size:** the app needs a set shape (9:16). Is "give it a 9:16 reference picture" enough, or should a test try the `EmptyFlux2LatentImage` path?
2. **Prompt rewriter:** the reference has it on by default. Should the draft stay without it (as the other drafts do), or is the rewriter part of what makes this model work well? It needs one more model file and a node marked deprecated.
3. **Number of references:** the reference shows one. Is one enough, or should a test try `images.image1`?
4. **Which model:** is the "klein-base" file the one wanted, given the "distilled" name in the reference's save prefix? A distilled file would likely need far fewer steps.
5. **Is this a new model for the project?** It would need three model files, a licence check (none is stated in the file) and a spec decision, like Qwen Image 2.1 above.

## H3 text to video, official template

The stakeholder later sent the official MiniMax H3 text-to-video template, in API format. `h3-video-text.json` was checked against it. The template was not copied here; only facts were taken from it. Nothing has been run.

Marks in this section:
- **from the template**: the value is in the template as written
- **inferred**: my reasoning; not shown in the template

### What changed in the draft

**Nothing.** The draft already matched the template in every node class, input name, model file and setting on the template's default path. The file was not edited.

What changed is how sure we are. The draft's main guess is now confirmed: text-to-video is the image-to-video node with no first frame.

This replaces three earlier lines in these notes:
- "`h3-video-text.json`", row "Text-to-video = that node with no `first_frame`", marked inferred: now **from the template**.
- "Where the references differ from `README.md`", item 4: the text-to-video template has now been seen, and README's claim holds.
- Open question 1 (does the node accept a run with no `first_frame`): the official template does exactly that. A real run is still the final proof.

### The node that makes the conditioning and the latent

`MiniMaxH3ImageToVideo` (from the template). There is no separate text-to-video node. The template gives it only `prompt`, `width`, `height`, `length`, `clip` and `vae`. It has no `first_frame` input and no `LoadImage` node anywhere. Output 0 is the conditioning (into `BasicGuider`) and output 1 is the latent (into `SamplerCustomAdvanced`). The draft's node 5 is the same.

### Checked against the template, item by item

| What | Template | Draft | Mark |
|---|---|---|---|
| Model | `UNETLoader`, `minimax_h3_fl2va_pruned_int8_convrot.safetensors`, `weight_dtype "default"` | same (node 1) | from the template |
| Text encoder | `CLIPLoader`, `qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors`, `type "minimax"`, `device "default"` | same (node 2) | from the template |
| Video VAE | `VAELoader`, `minimax_h3_video_vae_int8_convrot.safetensors` | same (node 3) | from the template |
| Audio VAE | `VAELoader`, `minimax_h3_audio_vae_fp32.safetensors` | same (node 4) | from the template |
| Noise | `RandomNoise`, `noise_seed` | same (node 6) | from the template |
| Sampler | `KSamplerSelect`, `res_multistep` | same (node 7) | from the template |
| Scheduler | `BasicScheduler`, `simple`, denoise 1, 20 steps on the default path | same (node 8) | from the template |
| Guider | `BasicGuider` with `model` and `conditioning`. No cfg value and no negative prompt anywhere | same (node 9) | from the template |
| Sampling | `SamplerCustomAdvanced` with `noise`, `guider`, `sampler`, `sigmas`, `latent_image` | same (node 10) | from the template |
| Frames | `VAEDecode` of the sampler's output 0 with the video VAE | same (node 11) | from the template |
| Sound | `VAEDecodeAudio` of the same sampler output with the audio VAE, wired into `CreateVideo` `audio` | same (node 12) | from the template |
| `CreateVideo` | `fps 24`, `bit_depth 8`, `color_space "sRGB"`, `chroma_subsampling "auto"`, `codec "none"`, `images`, `audio` | same (node 13) | from the template |
| `SaveVideo` | `format "auto"`, `format.codec "auto"`, `codec "auto"`, `video` | same (node 14) | from the template |
| Save prefix | `video/MiniMax_H3` | `adman/test-h3-text` | draft convention, kept on purpose |

### Model files

The text-to-video template uses the **same** `fl2va` model file as first-frame: `minimax_h3_fl2va_pruned_int8_convrot.safetensors` (from the template). It needs no model file beyond the four already listed for H3 text in "Model files" above. The folders are inferred from the loader classes, as before.

Optional speed-up LoRA: `minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors` through `LoraLoaderModelOnly`, strength 1, with 8 steps in place of 20 (from the template). It is behind a switch that is saved as off, so the draft leaves it out. It is the same LoRA file the first-frame template uses.

### Default size, frames and fps

| What | Template default | Draft | Mark |
|---|---|---|---|
| Size | `ResolutionSelector`: `aspect_ratio "16:9 (Widescreen)"`, `megapixels 0.4`, `multiple 32`. Its two outputs feed `width` and `height` | 768x1344, typed in | settings from the template |
| Size in pixels | not written in the template. About 832x480 or 864x480, depending on how the node counts a megapixel | 768x1344 (about 1.0 MP, 9:16) | **inferred** |
| Length | 5 seconds, which the rule below turns into **124** frames | 56 frames | 5 s from the template; 124 worked out from its formula |
| fps | 24 | 24 | from the template |

The draft keeps its own size and length so the app can set them (node 5 `width`, `height`, `length`). They are plain numbers there. The template's `ResolutionSelector` and its length maths are left out, as flattening did before. So the draft differs from the template's defaults in three ways: upright instead of wide, about 2.5 times the pixels, and under half the frames. Both draft size numbers are multiples of 32, which fits the template's `multiple 32`.

### The frame rule

From the template, word for word: `max(5, round(a * 24)) + (5 - (max(5, round(a * 24)) % 17)) % 17`, where `a` is the length in seconds (a `PrimitiveFloat`, default 5). It runs in a `ComfyMathExpression` node (input `values.a`), and that node's output 1 feeds `length`.

In plain words: seconds times 24, at least 5, then rounded **up** to the next number of the form 17k + 5. For 5 s: 120 becomes 124. The draft's 56 fits the form (17 x 3 + 5), and is about 2.3 s.

The app must do this maths itself, because the draft sends `length` as a plain number (inferred from the flattening; the rule itself is from the template).

### ComfyUI version

Every node in the template is stamped `comfy-core`, version `0.33.0` (from the template). All 22 nodes are core; there are no add-on nodes. As before, this shows that 0.33.0 had these nodes; it is not a stated minimum.

### Template nodes not in the draft

All core, all left out by flattening: `ResolutionSelector`, `ComfyMathExpression`, `PrimitiveFloat` (length in seconds), `PrimitiveBoolean` (LoRA on or off, saved as off), two `ComfySwitchNode` (model and steps), two `PrimitiveInt` (20 and 8 steps), `LoraLoaderModelOnly`.

### Still a guess

1. The draft has still never been run or opened in ComfyUI.
2. The draft's size, 768x1344 upright at about 1.0 MP. The template shows only 16:9 at 0.4 MP. Whether H3 gives a good upright clip at that size, and whether it fits a 3090, is not known.
3. The 56-frame length. It fits the rule, but the template's default is 124. The lower limit of what looks good is not known.
4. The exact pixel size the template's defaults give.
5. That typed-in numbers behave the same as the template's `ResolutionSelector` and maths nodes (they should; the node only sees numbers).
6. The canvas copy in `ui/` was not touched or checked.

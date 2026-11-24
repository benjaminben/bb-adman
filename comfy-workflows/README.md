# Draft ComfyUI workflows for hand testing

**Status, 2026-11-23.** This folder is the record of how the drafts were made. The text below was written before any run and has not been updated since.

- The graphs the app sends are in `src/main/providers/comfyui/workflows/`. No code reads this folder.
- Which workflows have since been run on a real server, and which are still drafts, is in `spec/comfyui-workflows.md`.
- `marked/` holds two MOSS-Image copies whose step titles carry the `adman:` marks. They can be added as they are under Settings, "ComfyUI workflows".

These are drafts for you to load into your own ComfyUI and try by hand. Nothing here has been run.

- The top folder holds the **API-format** files ("Export (API)" shape). These are what the app will send.
- `ui/` holds a **canvas copy** of each one, with the same file name, for drag and drop. A script made them from the API files. They have not been opened in ComfyUI yet. If a canvas copy looks wrong, use the API file instead.

**2026-11-21:** the drafts were checked against five reference workflows. See `REFERENCE-NOTES.md` for what changed, what is confirmed and what is still a guess.

Please send back an **"Export (API)"** of any workflow you had to fix. Fixing the graph is the useful part. We copy your fix into the app.

## How the drafts were made

The H3, MOSS-Image and Krea 2 graphs come from ComfyUI's official templates in `Comfy-Org/workflow_templates` (MIT licence). The official templates use subgraphs, switches and a prompt-rewriting step. I flattened each one into plain nodes and kept the template's default path:

- **H3:** 20 steps, no speed-up LoRA.
- **MOSS-Image and Krea 2:** the prompt-rewriting step is turned off, so your prompt goes in unchanged.

I checked every node name and input name against ComfyUI's own source code on its main branch, as of 2026-11-20. I checked every model file name against the Hugging Face repos. The upscaler and the two extend workflows are my own builds from core nodes (details below).

## What you need on the server

Everything is a **ComfyUI core node**. No community node pack is needed for any file here. Update ComfyUI first: the MOSS edit node needs ComfyUI 0.43.0 or later.

| Folder under `ComfyUI/models/` | File | Size | Used by |
|---|---|---|---|
| `diffusion_models` | `minimax_h3_fl2va_pruned_int8_convrot.safetensors` | 21.0 GB | H3 text, H3 first frame, H3 upscaled |
| `diffusion_models` | `minimax_h3_ref2va_pruned_int8_convrot.safetensors` | 21.0 GB | H3 references |
| `text_encoders` | `qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors` | 15.7 GB | all H3 |
| `vae` | `minimax_h3_video_vae_int8_convrot.safetensors` | 2.8 GB | all H3 |
| `vae` | `minimax_h3_audio_vae_fp32.safetensors` | 0.6 GB | all H3 (the sound) |
| `diffusion_models` | `seedvr2_3b_int8_convrot.safetensors` | 3.5 GB | H3 upscaled |
| `vae` | `seedvr2_ema_vae_fp16.safetensors` | 0.5 GB | H3 upscaled |
| `diffusion_models` | `moss_image_sft_int8_convrot.safetensors` | 5.4 GB | all MOSS |
| `text_encoders` | `qwen3.5_9b_w4a8_gptq.safetensors` | 7.3 GB | all MOSS |
| `vae` | `flux2-vae_small.safetensors` | 0.25 GB | all MOSS |
| `loras` | `moss_image_edit_lora_rank_64_bf16.safetensors` | 0.3 GB | MOSS references, MOSS extend |
| `diffusion_models` | `krea2_turbo_fp8_scaled.safetensors` | 13.1 GB | Krea 2 |
| `text_encoders` | `qwen3vl_4b_fp8_scaled.safetensors` | 5.2 GB | Krea 2 |
| `vae` | `qwen_image_vae.safetensors` | 0.25 GB | Krea 2 |

Download them from the Hugging Face repos `Comfy-Org/MiniMax-H3`, `Comfy-Org/SeedVR2`, `Comfy-Org/MOSS-Image` and `Comfy-Org/Krea-2`. Each file sits in a subfolder with the same name as its ComfyUI folder.

**Licences:**
- MOSS-Image and SeedVR2 are Apache 2.0.
- MiniMax H3 uses the "minimax-h3-community-license-agreement".
- Krea 2 uses the "krea-2-community-license".
- Both of those limit commercial use. The requirements file (V-25, V-31) has the details.
- ComfyUI itself is GPL-3.0.

**Input pictures:** put them in `ComfyUI/input/` with the names the workflow uses, or pick your own file in each "Load Image" node. The names are `adman-first-frame.png`, `adman-reference-1.png`, `adman-reference-2.png` and `adman-background.png`.

## Will it fit on a 3090 (24 GB)?

None of the sources gives a memory figure. Here is my reading of the file sizes:

- **MOSS-Image** (5.4 GB model + 7.3 GB text encoder): should fit with room to spare.
- **Krea 2 Turbo** (13.1 GB + 5.2 GB): should fit.
- **MiniMax H3** (21 GB model + 15.7 GB text encoder): the two cannot sit on the card together. ComfyUI loads them one after the other and moves the spare one to system memory. Expect it to need a lot of system memory (my guess is 64 GB) and to be slow. The 21 GB model on its own leaves little room for the video itself, so start with the short clip in the files (56 frames, about 2.3 s).
- **SeedVR2 3B upscaler** (3.5 GB): small, but enlarging every frame is heavy. If it runs out of memory, lower the factor in node 22 (for example 1.25), or shorten the clip.

## The workflows

The spec's planned ID is in brackets. "APP" in a node title marks a value the app will fill in.

### `h3-video-text.json` [`h3-text-to-video`]: video from a prompt
- **Source:** official template `video_minimax_h3_t2v.json`, flattened.
- **Settings:** size 768x1344 (the spec's 9:16 size for H3), 56 frames at 24 fps.
- **App fills:**
  - node 5: `prompt`, `width`, `height`, `length`
  - node 6: `noise_seed`
  - node 14: `filename_prefix`
- **Sound:** sound is kept. Node 12 decodes the sound and node 13 (`CreateVideo`) joins it to the frames.
- **Output:** node 14 (`SaveVideo`) writes an MP4 to the server's **output** folder under `adman/`, not the temp folder.

### `h3-video-first-frame.json` [`h3-image-to-video`]: video from a first frame
- **Source:** official template `video_minimax_h3_i2v.json`, flattened.
- **App fills:** the same nodes as above, plus node 15 `image` (the uploaded first frame).
- **Picture size:** H3 stretches a first frame that has a different shape. Give it a picture that is already exactly 768x1344. The app will crop it to that size before it uploads it (spec 6.10.7).

### `h3-video-references.json` [`h3-reference-to-video`]: video from reference pictures
- **Source:** official template `video_minimax_h3_r2v.json`. It uses the separate `ref2va` model.
- **References:** two pictures, nodes 15 and 16, wired to `ref_images.ref_image_0` and `ref_image_1`. The node takes up to 9. To add more, wire extra Load Image nodes into the next free `ref_image` input.
- **Prompt:** the prompt names the pictures as `<Picture 1>`, `<Picture 2>`, the same way the template does.
- **App fills:** node 5 (`prompt`, `width`, `height`, `length`), node 6 (`noise_seed`), nodes 15 and 16 (`image`), node 14 (`filename_prefix`).

### `h3-video-first-frame-upscaled.json` (optional): first frame, then enlarged
- **Built from:** the H3 first-frame graph above, plus the core SeedVR2 3B upscaler, copied from the official template `utility_seedvr2_3b_int8_upscale_video.json`.
- **How it runs:**
  - The frames go through SeedVR2 at 1.5x (node 22), which gives 1152x2016.
  - The sound skips the upscaler and is joined back on in node 13.
  - SeedVR2 makes one pass (node 26: 1 step, cfg 1), as in its template.
- **App fills:** the same nodes as the first-frame workflow, and node 26 `seed` as well.
- **Built-in alternative:** ComfyUI also has an H3-specific enlarger, `MiniMaxH3LatentUpscaleWithModel`. I did not use it because I could not find which model file it needs.

### `moss-image-plain.json` [`moss-text-to-image`]: picture from a prompt
- **Source:** official template `image_moss_image_t2i.json`. The prompt-rewriting step is off, and so is the optional "skip layer" boost.
- **Settings:** size 1056x1872 (the spec's 9:16 size for MOSS), 25 steps, cfg 2.5, `er_sde`.
- **App fills:** node 4 `text`, node 6 `width` and `height`, node 7 `seed`.
- **Output:** node 9 (`PreviewImage`) writes to the **temp** folder only. Nothing goes in the output folder.

### `moss-image-references.json` [`moss-edit-references`]: picture from a prompt and reference pictures
- **Source:** official template `image_moss_image_edit.json`, with the edit LoRA.
- **References:**
  - Reference 1 (node 10) is the source photo.
  - Reference 2 (node 11) is one extra picture. The template has only one; I added the second.
  - The edit node takes up to four. To add more, wire them into `images.image_2` and `images.image_3` through an "Image Scale To Total Pixels" node, as nodes 12 and 13 do.
- **Size (a change from the template):** the template sets the size from the source photo, at 1 MP. Here the size is fixed at 1056x1872 so the app can set it.
- **App fills:** node 6 `prompt`, node 8 `width` and `height`, node 9 `seed`, nodes 10 and 11 `image`.

### `moss-image-extend.json` [`moss-extend`]: extend a background (my own build)
- **Why it is a guess:** there is no official MOSS template for extending a picture (U-13), so I built this from core nodes.
- **How it works:**
  1. The background is scaled (node 11) and given a grey border (node 12).
  2. The MOSS edit LoRA gets the padded picture and an instruction to fill the grey.
  3. A noise mask (node 17) means only the border is repainted. The middle stays as it was.
- **Example numbers:** a square 1056x1056 picture with 408 px added at the top and bottom gives 1056x1872.
- **App fills:**
  - node 10: `image`
  - node 11: `width` and `height` (the picture's size once placed)
  - node 12: `left`, `top`, `right`, `bottom` (the pad)
  - node 6: `prompt`
  - node 9: `seed`
- **Pad rule:** keep each pad a multiple of 8, because the pad node steps in 8s.

### `krea2-image-plain.json` (optional): picture from a prompt with Krea 2 Turbo
- **Source:** official template `image_krea2_turbo_t2i.json`. The prompt-rewriting step and the style LoRA are off.
- **Settings:** 8 steps, cfg 1, `euler`, and an empty negative.
- **App fills:** node 4 `text`, node 6 `width` and `height`, node 7 `seed`.

### `krea2-image-extend.json` (optional): extend a background with Krea 2 (my own build)
- **Why it is a guess:** there is no official Krea 2 extend template, and the community add-on (V-33) was not used. This uses only core nodes.
- **How it works:** it pads the picture with a grey border, masks the border, and repaints only that part. `DifferentialDiffusion` softens the seam.
- **Prompt:** describe the whole finished scene, not an instruction.
- **App fills:** the same as MOSS extend: nodes 10, 11, 12 and 4, plus node 7 `seed`.

### `flux3-klein-image-references.json` (optional): picture from a prompt and one reference picture with Flux 3 klein
- Never run, core nodes only, no canvas copy. Built from facts in one reference file; models, settings, size behaviour and guesses are in `REFERENCE-NOTES.md` under "Flux 3 klein edit". App fills: node 6 `text`, node 9 `seed`, node 10 `image`.

## How to test one by hand

1. Update ComfyUI. Put the model files in the folders above, then restart ComfyUI.
2. Drag the file from `ui/` onto the ComfyUI canvas. If that fails, drag the API-format file from the top folder instead; recent ComfyUI versions open API files too (not verified). If neither opens, tell me what ComfyUI said.
3. If ComfyUI reports missing nodes, write down their names. Do not install add-ons to fix this. Every node here should be in core.
4. In each Load Image node, pick a picture.
5. Click Run. Watch the console for errors and for the peak memory in use (`nvidia-smi` in another terminal).
6. Look at the result:
   - **Pictures:** they show in the Preview Image node.
   - **Videos:** they are saved in `ComfyUI/output/adman/`. Check that the video has sound.
7. If you changed anything, use Workflow > Export (API) and send me the file.

## Checklist (copy one per workflow)

```
Workflow: ______________________
[ ] Loads without missing nodes   (canvas copy / API file: which one?)
[ ] Runs to the end without errors
[ ] Result looks right            (notes: ________________________ )
[ ] Video only: has sound
Time taken: ________   Peak VRAM: ________   System RAM used: ________
ComfyUI version: ________
Fixed anything? [ ] no  [ ] yes, Export (API) attached
```

## Not verified

Each item below is a guess or comes only from reading the source code. None of it has been run.

**All files**
1. No workflow has been run. None of the files has been opened in ComfyUI.
2. The canvas copies in `ui/` were made by a script. The order of the widget values comes from the official templates and the node source. The canvas may move or reset some values when it loads them.
3. I flattened the templates and dropped their switches, subgraphs and prompt-rewriting step. I believe this keeps the template's default behaviour, but I have not compared the outputs.

**H3 video**
4. `SaveVideo` inputs are `"format": "auto", "format.codec": "auto"`. This is how I read the new "dynamic combo" naming in ComfyUI's source, not from a real export. If ComfyUI rejects it, set format and codec in the canvas and export again.
5. `CreateVideo` gets only `fps: 24`. The template also sets bit depth 8. The default ("auto") gives 8 bit for normal colour, so this should not change the result.
6. Whether H3 fits a 3090 at all, and how long it takes. No source gives a figure.
7. The H3 frame count of 56, which follows the "17k+5" rule from the docs. The node says its trained range is about 124 to 362 frames, so a 56-frame clip may look worse. Try 124 (about 5 s) if the short one looks poor.
8. The 20-step default with no LoRA. The templates offer a speed-up LoRA (`minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors` in `loras`, 8 steps), which may be much faster on a 3090. To try it, add a "LoraLoaderModelOnly" between node 1 and nodes 8 and 9, and set steps to 8.

**Upscaler**
9. The SeedVR2 upscale step inside an H3 graph, and the 1.5 factor. The SeedVR2 template is for a video loaded from a file; I fed it frames directly.

**MOSS-Image**
10. MOSS references: the second reference, the fixed 1056x1872 size, and giving the negative only the first reference (as the template does with one).

**Extend**
11. Both extend workflows as a whole: the noise-mask method, the feather of 24, the prompts, and whether a 2 MP output looks right.

## Things that differ from SPEC.md on purpose

- **Sound is kept** in every video file, because you asked for it. SPEC 6.10.4 and 6.10.7 say the shipped graphs have the sound link removed and that a clip with sound is refused (FR-283). This needs a ruling (see questions).
- **File names:** the file names are the ones in the brief. The spec's IDs are in brackets above.
- **Krea 2:** SPEC 6.10.4 says Krea 2 enters only as a fallback for extend (CQ-27). The plain Krea 2 file is extra, for testing only.

## Open questions

1. **Sound:** should the app keep sound on generated video? If yes, SPEC 6.10.7 and FR-283 need to change.
2. **Number of references:** when the app sends fewer pictures than a workflow has Load Image nodes, the spare nodes point at files that do not exist, and ComfyUI will refuse the run. Should there be one workflow file per count of references, or should the app remove the unused nodes? (SPEC 6.10.4 says `fillWorkflow` removes no node.)
3. **H3 speed:** if 20 steps is too slow on the 3090, should the shipped H3 files use the 8-step speed-up LoRA?
4. **Upscaler:** is the upscaler wanted in the app, or only for your own tests? If it is wanted, what size should the clip come out at?
5. **Which MOSS file:** SFT or Base (CQ-15)? These drafts use SFT, the default in the spec and the template.

## Sources

- ComfyUI official templates (MIT): https://github.com/Comfy-Org/workflow_templates. The files used are `templates/video_minimax_h3_t2v.json`, `video_minimax_h3_i2v.json`, `video_minimax_h3_r2v.json`, `image_moss_image_t2i.json`, `image_moss_image_edit.json`, `image_krea2_turbo_t2i.json` and `utility_seedvr2_3b_int8_upscale_video.json`.
- ComfyUI node source (GPL-3.0): https://github.com/Comfy-Org/ComfyUI, the files `comfy_extras/nodes_minimax_h3.py`, `nodes_moss_image.py`, `nodes_video.py`, `nodes_seedvr.py`, `nodes_post_processing.py`, `nodes_slg.py`, `nodes_flux.py`, `nodes_differential_diffusion.py`, `nodes_resolution.py`, and `nodes.py`.
- MiniMax H3 native guide: https://docs.comfy.org/tutorials/video/minimax/minimax-h3-native
- MiniMax H3 tutorial: https://docs.comfy.org/tutorials/video/minimax/minimax-h3
- Workflow API format: https://docs.comfy.org/development/api-development/workflow-api-format
- Model repos: https://huggingface.co/Comfy-Org/MiniMax-H3, https://huggingface.co/Comfy-Org/MOSS-Image, https://huggingface.co/Comfy-Org/Krea-2, https://huggingface.co/Comfy-Org/SeedVR2

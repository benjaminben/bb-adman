# Generation details, export, reports and checks

The generation details written into generated files, the export of variants to disk (pictures and video), the report, the translation sheet, and the six checks run before export. Read with `spec/data-model.md` (the `report`, `variant_check`, `asset`, `variant` and `layer` tables), `spec/api-commands.md` (`export.run`, `check.run`, `translation.exportSheet`), `spec/storage-and-publish.md` (publish runs a fresh export) and `spec/infra-and-settings.md` (FFmpeg packaging, `settings.export`).

## Embedded generation details

[REQ: FR-068, OI-05]

| File type | Where | Content | State |
|-----------|-------|---------|-------|
| PNG (every generated picture) | One uncompressed `iTXt` chunk with keyword `generation`, placed just before `IEND` | JSON below | Built |
| MP4 (generated video) | Container tag `comment`, written by FFmpeg | JSON below | Not built (Phase 7) |

```json
{
  "app": "Adman",
  "appVersion": "1.0.0",
  "provider": "gemini",
  "model": "gemini-2.5-flash-image",
  "prompt": "the full prompt sent",
  "kind": "image_generation",
  "createdAt": "2026-11-20T14:30:00Z"
}
```

This follows ComfyUI, which writes JSON into PNG text entries and MP4 container tags. Any tool that reads PNG text chunks, or `ffprobe`, can read it. The same values are stored on the `asset` row (`gen_provider`, `gen_model`, `gen_prompt`, `gen_run_id`) and used by the report [REQ: FR-150].

### PNG

Built. `src/main/jobs/png-details.ts` (`embedGenerationDetails`, `GenerationDetails`), called by `pngOf` in `src/main/jobs/kinds/image-generation.ts` and by the cut-out kind (`kinds/cutout.ts`). Tests: `tests/unit/main/jobs/png-details.test.ts`, `tests/integration/generation/image-kind.test.ts`, fixture `tests/fixtures/png-chunks.ts`.

```ts
export type GenerationDetails = {
  app: 'Adman'
  appVersion: string
  provider: string
  model: string
  prompt: string
  kind: 'image_generation' | 'cutout'        // a cut-out has an empty prompt
  createdAt: string
  models?: string[]                          // ComfyUI only
  workflow?: { id: string; version: number } // ComfyUI only
}
```

- The PNG comes from the app's own encoder (`deps.toPng`), so `IEND` is its last chunk. `embedGenerationDetails` throws "The picture is not a PNG" or "The PNG does not end with IEND" otherwise. It returns new bytes and does not change its input.
- The `iTXt` data: keyword, NUL, compression flag 0, method 0, empty language tag, NUL, empty translated keyword, NUL, then the JSON as UTF-8.
- `model` is the model the provider's result reports. The asset row's `gen_model` comes from the job row and is empty for the fake provider.
- **ComfyUI** [REQ: FR-264]: `provider` is `"comfyui"`, `model` is the workflow's main model file name, plus `models` (every model file name the workflow names) and `workflow` (`{ id, version }`). All come from the app's shipped workflow file, never from the server (`ImageResult.details`, filled in `src/main/providers/comfyui/run.ts`). The server's address is never written [REQ: FR-253].
- Other providers leave `models` and `workflow` out. No key is written as `undefined`, and the order of the other keys does not change: Gemini and fake details stay byte for byte as their tests pin them.

### MP4

Not built (Phase 7, with FFmpeg). Today a generated clip is stored as the provider returned it, after `checkMp4`, and the video job's result says `details: 'pending'`. A video result may set `details` for the asset row.

- FFmpeg writes the same JSON into the `comment` tag with stream copy (`-c:v copy -metadata comment=...`), with `kind: "video_generation"`. For ComfyUI it adds `models` and `workflow` as for PNG (OI-36: what a ComfyUI clip carries before Phase 7).
- The sound stream is kept (copied as it is). No `-an` on a generated clip.

## Export

Not built (Phase 8). Needs Phase 7 (FFmpeg fetch script, video data). [REQ: FR-126, FR-130 to FR-132, FR-140 to FR-143, FR-150, FR-151]

**Trigger:** `export.run` with `projectId, campaignId, variantIds[], outputDir, imageFormat, jpgQuality, fps, proceedDespiteWarnings`, and an optional reason for proceeding past warnings [REQ: FR-236]. `deny` for an agent. Job kind `export` (class `background`). Defaults come from `settings.export = { imageFormat: 'png' | 'jpg', jpgQuality: 1..100, fps: 30 | 60 }` (built).

`outputDir` is a folder the user picked in a system dialog. Export writes through `localStorageAt(outputDir)` (`spec/storage-and-publish.md`, "Local storage"); no agent input names it.

### Output layout

`output-paths.ts`:

```
{outputDir}/{campaignId}/{postTitle}/{sizeLabel}/{language}-{variantId}.{ext}
{outputDir}/{campaignId}/report-{YYYYMMDD-HHmmss}.html
{outputDir}/{campaignId}/report-{YYYYMMDD-HHmmss}.json
```

`postTitle` is the variant title with every character outside `A–Z a–z 0–9 + - _ space` replaced by `-`. It must then pass the storage path rules (a part may not end in a dot or a space, nor be a reserved device name), so the name is made safe before it reaches the adapter. `ext` is `png`, `jpg` or `mp4`.

### Flow

1. Run the checks on the chosen variants ("Checks" below).
2. If any warn, show them. The user fixes them or proceeds, optionally with a reason. Proceeding is recorded [REQ: FR-115, FR-236].
3. Variants with a missing file are listed as failures and skipped [REQ: FR-009, R-06].
4. Export each variant. Each file is written to `{name}.partial` and renamed when complete.
5. Write the report files and insert the `report` row (`id`, `campaign_id`, `created_at`, `output_dir`, `body`).

### Image variant

The render service draws the full Scene at the variant's pixel size and captures it. PNG through `nativeImage.toPNG()`; JPG through `toJPEG(quality)`, default quality 90. An imported picture with a transparent background keeps its transparency in the exported ad [REQ: FR-245]. Exported files are written fresh and carry no generation details [REQ: FR-068].

### Video variant

1. Frame count = `ceil(durationMs / 1000 × fps)`. Frame `i` is drawn at time `i × 1000 / fps`. Time comes from the frame number, never from a clock, so every machine makes the same frames [REQ: FR-131].
2. The render service draws the Scene with the background left out on a transparent page, and captures each frame as PNG. If no layer changes between two frames (no animation running, no layer starting or ending), the previous frame is sent again without redrawing.
3. Frames are piped to FFmpeg as `-f image2pipe -framerate {fps} -c:v png -i -`.
4. FFmpeg builds the background: a black base of the variant's size and duration, then each clip trimmed (`trim`, `setpts`), scaled and cropped by `background-placement.ts`, and overlaid in its time range. Stills are looped for their length.
5. FFmpeg overlays the frame stream on the background and encodes.

```
Encoder:  macOS   -c:v h264_videotoolbox -b:v 12M
          Windows -c:v h264_mf -b:v 12M
Common:   -pix_fmt yuv420p -r {fps} -movflags +faststart
Sound:    -an when the variant's sound source is "none"
```

`fps` is 30 by default and can be raised to 60 [REQ: FR-132, A-07].

**Named tests:** determinism (the same variant exports to the same frames) and frame count. Exit proof: a whole-campaign export of the example gives the layout above and a report, on macOS and on Windows.

### Sound in export

Not built (data and preview Phase 7, export Phase 8). OI-54 [REQ: FR-301, FR-302, FR-051 as changed]. Waits for CQ-32.

- A video variant has one sound source at a time: the clips' own sound, one added audio file, or none. Each clip's sound can be switched off.
- An added file starts at the variant's start and is cut at the variant's end. No mixing, no volume control.
- Audio files: MP3, WAV, M4A, AAC (a new audio asset kind).
- With source "none" the export is silent (`-an`). Otherwise FFmpeg maps the one chosen source into the output.

## Report

Not built (Phase 8). [REQ: FR-150, FR-151]

```ts
type Report = {
  campaignId: string; campaignName: string; createdAt: string; appVersion: string; outputDir: string
  proceededDespiteWarnings: boolean
  variants: Array<{
    variantId: string; title: string; sizeLabel: string; language: string; format: 'image' | 'video'
    file: string | null                       // path relative to outputDir, null if it failed
    assets: Array<{ assetId: string; displayName: string; role: 'background' | 'image' | 'font' | 'clip'
                    origin: 'generated' | 'imported'; provider?: string; model?: string; prompt?: string }>
    checks: CheckResult[]
    failure: string | null
  }>
}
```

`report.html` is one self-contained file with no scripts. The report view in the app draws the same JSON [REQ: FR-151]. Saved reports are read with `report.list` and `report.get` (`spec/api-queries-events.md`).

A report never holds a secret, the ComfyUI address [REQ: FR-253], or the path or file name of a picture given to a test by path.

### Report additions, not yet designed

Phase 8. Each is one addition to `Report`, to be specified when Phase 8 is prepared. Requirement text: `REQUIREMENTS-Client-Input.md` (and `REQUIREMENTS-D053.md` for FR-230 as changed).

| Requirement | Addition |
|-------------|----------|
| FR-230 | The campaign's paid generation count, split into pictures and videos. A run on a local provider (ComfyUI) is never counted. Changed by FR-303 and FR-305 to usage with an estimated price (slice US, OI-52, before Phase 8). |
| FR-231 | A summary at the top (exported, passed every check, with warnings, failed), then the list of warnings exported past, before any per-ad detail. |
| FR-232 | Asked for against delivered: each size and language pair from the campaign's lists with no exported ad, and why (no variant, not in this export, export failed). |
| FR-233 | A small picture of each ad inside the one HTML file; one still frame for a video ad. |
| FR-234 | Header: market (region), audience, campaign ID, export time, exporter's name, export number. Each ad names its subjects by ID and display name, its size, language and format. |
| FR-235 | Settings value "Name shown in reports", optional. Empty shows "name not set". The report says the name is typed by the user and not checked. Also needs the Settings field (UI). |
| FR-236 | Who proceeded past each warning, when, and the reason given or "no reason given". `export.run` gains the optional reason; the proceed dialog gains the field. |
| FR-237 | For each ad not in the main language: where its translation came from (AI, an agent, the user, the brief) and whether it is approved. |
| FR-238 | From the second export on, each ad marked changed or not since the previous export, from each variant's `rev` stored in the report. |
| FR-239 | The last agent change per ad from `variant.agent_changed_at` (column built): "last changed by an agent on (date)" or "no agent changes". |
| FR-240 | Not a report field: an addition to the prohibited-words check ("Checks" below). |
| FR-241 | Publish only: the published report starts with the publish time and publish number (`spec/storage-and-publish.md`, "Publishing"). |

## Translation sheet

Not built. [REQ: FR-103]

`translation.exportSheet` writes a CSV in UTF-8 with a byte-order mark, so Excel opens it correctly. Columns: `variant_id, title, size, language, layer, source_text, text, status`. One row per text layer of every variant not in the primary language. Publishing includes it as `translations.csv`.

## Checks

Not built (Phase 8 for export; `check.run` with the editor data it reads). The `variant_check` table is built. [REQ: FR-110 to FR-116, R-03, R-13, R-18]

```ts
type CheckResult = {
  checkId: 'required-assets' | 'text-colours' | 'prohibited-words' | 'required-words'
         | 'unapproved-translations' | 'text-overflow'
  group: 'brand-legal' | 'readiness'
  status: 'pass' | 'warn' | 'skipped'
  findings: Array<{ layerId?: string; message: string }>
}
```

| Check | Group | Rule |
|-------|-------|------|
| `required-assets` | `brand-legal` | For each asset in the rule set: a layer in the variant uses it, is visible, has opacity above 0 and overlaps the canvas. For video, its timing overlaps the duration. Skipped if the list is empty. |
| `text-colours` | `brand-legal` | Every text layer's `style.color` equals a palette colour, ignoring letter case. Skipped if the palette is empty. |
| `prohibited-words` | `brand-legal` | No entry in the list for the variant's language appears in any text layer. Skipped if there is no list for that language. |
| `required-words` | `brand-legal` | Every entry in the list for the variant's language appears in the variant's text layers joined together. Skipped if there is no list for that language. |
| `unapproved-translations` | `readiness` | No text layer has `translation_status` of `missing` or `proposed`. Skipped for variants in the primary language. [REQ: FR-116, R-18] |
| `text-overflow` | `readiness` | No visible text layer has `overflow = 1`. [REQ: FR-116, R-18] |

The checks read values the app already stores, so they add no second source for those facts. All six run in `check.run` (input `projectId`, and `campaignId` or `variantIds[]`; `allow` for an agent), before export and on demand, for the user and for an agent alike. All six appear in the report [REQ: FR-114, FR-116]. The `checkWarning` badge counts only the `brand-legal` group, because unapproved translations and overflow have their own badges.

`check.run` writes `variant_check` (`variant_id`, `checked_rev`, `ran_at`, `ran_by` in `user`, `agent`, `export`, `results`) and returns the results. Export runs it first, always [REQ: FR-114].

**Word matching.** Both sides are normalised with Unicode NFKC and lowercased. For languages written with spaces, a match must sit on word boundaries found with `Intl.Segmenter`. For Chinese, Japanese and Korean, a match is a plain substring. A list entry may be a phrase. A prohibited entry made only of punctuation or symbols (for example `!`) is matched wherever it appears in a text layer [REQ: FR-240, addition to FR-113].

**Colours inside pictures.** FR-112 (colours inside background images, P2) is not built. The `VerificationProvider` interface (`checkImageColours`, in `src/main/providers/types.ts`) and the disabled `jev` registry entry are its place [REQ: OI-01]. OI-01, the assessment FR-112 depends on, is due after this build; nothing in this build waits on it.

## MP4 file check

Built. `checkMp4` in `src/main/providers/video-check.ts` checks every clip before it is stored; its refusal texts are `MP4_REFUSED`. The full rules are in `spec/comfyui-workflows.md` (`checkMp4(bytes)`), including the rule that a video track must list at least one sample (`noFrames`). It is security class: any change is ruled on its own. Fake `mp4File` clips (`src/main/providers/fake/mp4`) pass `checkMp4` but cannot be decoded by the window: fit for `checkMp4` and adapter tests, never for a test that plays a clip.

# Round 2: the editor, generation and first run

Items 1, 2, 3, 4, 7, 23 and 24 of the stakeholder's first hand-testing list (2026-11-21), with the orchestrator's rulings R-12 and R-13. Other round-2 files plan the campaign page (tabs), the rename, two windows, approvals and the agent tools.

## Goal

The default picture prompt no longer asks for the ad's own words. A finished run shows where it went and what to click. "Place text with AI" gives text that can be read and offers type styles when the project has no fonts. Pictures and videos are both made from the selected media layer in the editor; a generated clip takes the place of the still on the timeline. A first start walks the user through adding keys, every step skippable.

## Status

Built and merged on `main`: R2E-1 to R2E-11. R2E-9 removed the "Make a video" card; the campaign page's "Make pictures" panel, slot view and "Runs" list are still there and leave in the design wave (`design-wave.md`, CAMP-7). The rules now live in `spec/editor.md`, `spec/screens-ai.md` and `spec/screens.md`; this file keeps the design for reference.

## Rules for these slices

- Read `spec/phases/DEV-RULES.md` first, then this file's "Design additions" part for your slice, then the topic sections the slice names.
- Test first; one slice per developer run, well under 300k tokens; `HANDOFF.md` if near it.
- Screens: one folder per component with its CSS module; every colour, space, radius and type size from `src/renderer/ui/tokens.css`. **No new token**: the existing ones cover every part below (`--option-thumb` for picture choices, `layout.notice` and `layout.info` for lines, `layout.seg` for two-way switches). No semicolons. Files aim for 200 lines, 300 at most.
- No test makes a paid call; every provider in a test is the fake one or the ComfyUI stand-in.
- Shots: `tests/shots/r2e-{n}.shots.ts`, picture numbers 320 to 339 (R2E-1 none; R2E-2 320-321; R2E-3 322-323; R2E-4 324-325; R2E-5 326-327; R2E-6 328-329; R2E-8 330-333; R2E-10 334-337; R2E-11 338-339). The orchestrator checks no other round-2 file uses these numbers.
- **Shared files** (also edited by other round-2 planners' slices; merge by keeping both sides): `src/renderer/app/app-shell/app-shell.tsx` (R2E-6, R2E-10: one mount line each), `src/main/index.ts` and `src/main/core.ts` (R2E-2: one dependency line each), `src/renderer/screens/campaign/campaign-view/campaign-view.tsx` (R2E-9; the campaign tabs work also edits it: never run R2E-9 beside a campaign-tabs slice that edits this file), `src/renderer/screens/settings/settings-screen/settings-screen.tsx` (R2E-10).
- A shot script of an earlier slice that the changes below break may be fixed by the slice that breaks it, but only the locator or the words named under "Approved edits"; it keeps its picture names.

## Design additions

### D1. The default prompt without the ad's words (item 1)

Today `prefilledPrompt` (`src/shared/generation/prompt.ts`) ends with "The advertisement's message: {message}". The brief's message is also the copy of the master's headline layer (`src/main/commands/campaign/fills.ts`), so the model is told the words and often draws them, even with the "no text" ending.

- `PromptFacts` gains two optional fields: `wordsOnLayers?: boolean` (default false) and `kind?: 'picture' | 'video'` (default `'picture'`). Old callers get the old text, word for word.
- New pure function `hasWordsOnLayers(layers)` in the same file: true when any layer has `type: 'text'`, `visible: true` and copy that is not blank after trimming (the same test `canPlaceText` in `layout-run.ts` makes; `canPlaceText` then calls it).
- With `wordsOnLayers: true` the message sentence is left out and replaced:
  `{What} for an advertisement aimed at {audience} in {region}. Leave clear space for the advertisement's words, which are added separately.`
- `{What}` is "A picture of {subjects}" / "A picture" as today, or "A video of {subjects}" / "A video" for `kind: 'video'`.
- The endings (`NO_TEXT_ENDING`, `KEEP_PRINTING_ENDING`) and `promptToSend` do not change.
- Callers: the editor's first draft (`use-first-draft.ts`) passes `wordsOnLayers: hasWordsOnLayers(the variant's layers)`. The campaign page's "Make pictures" panel reads `variant.get` once for its variant and passes the same; until that answer it shows the prompt as today, and replaces it once when the answer comes if the user has not typed in the box.
- A first draft is made once per layer and kept (A-70). Text added later does not rewrite a draft.

### D2. Text that can be read after "Place text with AI" (item 4a)

The cause today: `clampLayout` snaps the model's colour to the nearest brand colour by RGB distance and never looks at the picture.

**Where.** In the `layout_proposal` job (`src/main/jobs/kinds/layout-proposal.ts`), after `clampLayout`, in the main process, with the picture the job already drew for the call (`renderPictures`: the variant without its text layers, longest side `LAYOUT_PICTURE_SIDE`). No extra provider call.

**Pixels.** New `CoreDeps.readPixels(png: Uint8Array): { width: number; height: number; rgba: Uint8Array }`. `src/main/pixel-reader.ts` exports `pixelReader(decode)`, where `decode` is Electron's `nativeImage.createFromBuffer`; it reads `toBitmap()` (BGRA, as `stitch.ts` notes) and swaps to RGBA. `index.ts` fills it; `CoreOptions.readPixels` is optional and defaults to a function that throws, as `toPng` does. A throw (or an empty picture) skips the check for the whole run: the boxes go out as the model gave them after the clamp, with no new fields, and one log line `level: 'warn', event: 'job', name: 'layout.contrast', errorKind: 'pixels_unreadable'` (no picture data in it).

**The rule** (`src/shared/generation/contrast.ts`, pure; numbers in `src/shared/config/contrast.ts`):

1. `luminance(hex or r,g,b)`: WCAG 2 relative luminance (each channel `c/255`, then `c ≤ 0.04045 ? c/12.92 : ((c+0.055)/1.055)^2.4`; `0.2126 R + 0.7152 G + 0.0722 B`). `contrastRatio(a, b) = (lighter + 0.05) / (darker + 0.05)`.
2. **The ground under a box.** The box is scaled into the picture (`scale = pixels.width / variant.width`; left and top floored, right and bottom rounded up, clamped to the picture). Pixels are sampled on a grid with step `max(1, floor(sqrt(area / 4096)))`. A pixel with alpha below 255 is laid over black first (the Scene's root is black). The ground is two numbers: the 10th and the 90th percentile of the samples' luminance (`dark`, `light`). A box with no area has no ground and is left as it is.
3. If the text layer already has a text box colour (`style.boxColor` not null), the ground is that colour (`dark = light = luminance(boxColor)`), since the text sits on it.
4. `readable(colour, ground) = min(contrastRatio(colour, dark), contrastRatio(colour, light))`. The bar is `TEXT_CONTRAST_MIN = 4.5` (WCAG AA for normal text) for every text layer.
5. Per box, in this order:
   - **kept**: the colour the box will draw with (the box's `color`, else the layer's own colour) reaches the bar. Nothing changes.
   - **colour**: else the brand colour (the rule set's palette, valid `#RRGGBB` only) with the highest `readable` that reaches the bar; if none does, `#FFFFFF` or `#000000`, whichever is higher, if it reaches the bar. The box's `color` becomes it.
   - **box**: else (a busy picture: no single colour reaches the bar against both its dark and light parts) a solid text box is added. Its colour is the first of: the brand colours by contrast with the text colour from step 5 highest first, then `#000000`, then `#FFFFFF`, that reaches the bar with that text colour. If none does, the text becomes `#FFFFFF` on `#000000`. `boxPadding` is the layer's own when above 0, else `round(0.25 × fontSize)`, clamped to `LOOK_LIMITS.boxPadding`. The fill covers the whole layer box (`spec/scene.md`, "Text layers"); this is the "shade behind the text".
6. Each box gets `readable: 'kept' | 'colour' | 'box'`.

**Schema.** `layoutBox` (`src/shared/schemas/jobs/layout-proposal.ts`) gains optional `boxColor: #RRGGBB` (set only for `box`), `boxPadding: whole number ≥ 0` (only for `box`) and `readable`. Optional, so a result stored before this still parses.

**Applying.** `layoutPatches` adds `boxColor` and `boxPadding` to the style patch when the box has them. Still one `layer.updateMany`, one undo entry.

**Banner.** `LayoutBannerLine` gains `{ kind: 'changed'; count: number; onDismiss }`, set by the finish step when any applied box has `readable` `colour` or `box`. Info tone, with "Dismiss":
- 1: "Text placed. The colour of 1 text was changed so it stands out from the picture."
- n: "Text placed. The colours of {n} texts were changed so they stand out from the picture."
It is shown like the failure line (kept per variant by the window) and cleared by Dismiss or by the next run.

### D3. Font options when the project has no fonts (item 4b)

**What ships.** One font: Inter 4.1 variable, weights 100 to 900, SIL Open Font Licence 1.1 (`src/shared/scene/fonts/InterVariable.woff2` with `OFL.txt`; `spec/scene.md`, "Fonts"). `resources/` holds only FFmpeg. The look pack adds no font. No other font file's licence can be confirmed from the repository, so **no font file is added**. The choice is built from Inter's weights, capitals and spacing.

**Type styles** (`src/shared/config/type-styles.ts`, `TYPE_STYLES`, in this order):

| `id` | Label | `fontWeight` | `allCaps` | `letterSpacing` (em) |
|---|---|---|---|---|
| `regular` | Regular | 400 | false | 0 |
| `bold` | Bold | 700 | false | 0 |
| `black-caps` | Black capitals | 900 | true | 0.02 |
| `light` | Light | 300 | false | 0 |
| `spaced-caps` | Spaced capitals | 500 | true | 0.12 |

A style sets those three fields and `fontAssetId: null`; size, colour, line height and the box stay.

**"No fonts of its own"** means the project's asset library (`library: 'asset'`, kind `font`) holds no font.

**In "Place text with AI".**
- When the project has no font, the job adds `typeStyles: [{ id, words }]` to the layout input (`words`, e.g. "Bold: Inter at weight 700"), and the Gemini instruction (`layoutInstruction` in `src/main/providers/gemini/prompts.ts`) gains two lines: "This ad has no brand fonts. For each box also give typeStyle, one of: {ids}." and "Choose a heavier style for the headline and a plainer one for small text." Without `typeStyles` the instruction is unchanged, word for word.
- The Gemini answer schema gains `typeStyle` (string, enum of the five ids, not required). The fake layout gives `bold` for the `headline` slot and `regular` for every other when `typeStyles` is given, nothing otherwise.
- `clampLayout` keeps `typeStyle` only when it is one of the ids it was given; else null. `layoutBox` gains optional `typeStyle: id | null`. `layoutPatches` adds the style's three fields when `typeStyle` is set. Never `fontAssetId` (a layout keeps the user's font, `spec/starter-layouts.md`).

**In the editor.** New component `editor/type-styles/` (`type-styles.tsx`, CSS module), mounted by `TextFields` right after the font field. Shown only when the project has no font: it reads `asset.list { projectId, library: 'asset', kind: 'font' }` on mount and again on each `project.changed` of that project that names an asset.
- A group labelled "Built-in styles" of five buttons (the labels above), `aria-pressed` on the one whose three fields match the layer. Disabled on a locked layer.
- Under it, the line "This project has no fonts of its own. Use Upload font… to add one."
- A click sends one `layer.update { style: { fontAssetId: null, fontWeight, allCaps, letterSpacing } }` (one undo entry). A refusal shows its message under the group.

**Agents.** `agentJobView` adds `boxColor`, `boxPadding` and `typeStyle` to each layout box it shows (A-232), so an agent applying a layout with `update_layers` can put the same look. Strings and numbers only.

### D4. The Generate panel (items 7, 23, 24; R-13)

**Where.** The properties panel's "Make pictures with AI" section (`editor/picture-ai/`) is replaced by `editor/generate-panel/`: a `fieldset` with the legend **"Generate"**, in the same place (image and background layers, between "Shade" and "Position and size"). Text layers have none.

**Picture or video.** A two-way switch, a group labelled "Make" with the buttons "Picture" and "Video" (`aria-pressed`, `layout.seg`), shown only on the **background layer of a video post**. There "Video" is chosen first. Video is not offered elsewhere because a clip only lives on the background's timeline track. Lines in place of the switch:
- the background layer of an image post: "To make a video, set Format to Video in the top bar first."
- an image layer of a video post: "Videos are made on the background layer."
- a video post with no available video provider: the switch shows with "Video" disabled and the line "No video service is set up. Add a key in Settings."
- On a video post's background with "Picture" chosen: "On a video post, the clips on the timeline show over this picture."

**Start from.** A radio group "Start from", by kind:

| Choice | Picture run sends | Video run sends | Shown when |
|---|---|---|---|
| A prompt only | `generation.runImages`, the chosen reference pictures | `generation.startVideo`, `start: 'none'` | Always. The first choice |
| This layer's picture | the layer's picture first, then the chosen references | `start: 'background'` (the background drawn at time 0 as the first frame) | Picture: the layer has a picture that is not missing (else shown disabled with the description "This layer has no picture yet."). Video: some available video provider offers `background` |
| Another picture of the same shape… | that picture first, then the chosen references | `start: 'first_frame'`, that picture | Picture: always. Video: some provider offers `first_frame` |
| Reference pictures | (pictures use the separate "Reference pictures" field) | `start: 'none'`, `useReferences: true`, the chosen pictures (`VideoPictureChoice`, subject photos chosen first as SP-7 does) | Video only: some provider offers `reference` |

- **Same shape**: a picture whose width-to-height ratio is within 1% of the layer box's (`sameShape` in `src/shared/generation/same-shape.ts`, pure). The list (region "Pictures of the same shape") holds the project's image assets of either library that are not missing, the layer's own picture left out, as `--option-thumb` radio buttons named by the asset's display name, plus "Add pictures…" (the picker and `asset.import` as `VideoPictureChoice` does). Empty: "No other picture in this project has this layer's shape ({w} × {h})." An added picture of another shape is imported and the line "{name} has another shape, so it is not listed." shows. Images only; no video asset is a start.
- A picture run sends at most `MAX_REFERENCES_PER_RUN` pictures: the start picture first, duplicates dropped, the rest cut off.
- The starts offered are those of any available provider; the run dialog then disables the providers that cannot start that way (below).

**Other fields.**
- "Prompt": one text area for both kinds, kept in the layer's draft. While the user has not typed in it, it follows the kind (D1's `kind`).
- Picture: "Reference pictures" with "Choose reference pictures…", as built.
- Video: "Clip length (seconds)", a whole number, default `START_SECONDS` (2), at least 1. (Not "Length (seconds)": the top bar's post length has that name.)
- "Generate…" opens the run dialog. Disabled on a locked layer, while the draft is being made, and for a start that needs a picture with none chosen.

**The run dialog** (`dialogs/run-dialog/`), for a video:
- `RunJob` gains `'video'`; `RunDialogProps` gains `video?: { start: VideoStartKind; seconds: number }`. Title "Make a video", confirm "Generate", no count. Pictures keep their title "Make pictures" and confirm "Generate".
- Provider choice: a provider with an offer (`video-offers.ts`) that lacks the start is disabled as "{label} (cannot start this way)"; ComfyUI follows `offeredFor(info, 'video', pair)` as the card did; the start is `settings.defaultProviders.video` when enabled.
- The length sent: `videoSeconds(info, providerId, start, wanted)` (pure, in `generate-panel/video-lengths.ts`, from today's `lengthsFor`): an offer's bounds, rounded to its step; ComfyUI at most its workflow's `maxMs`; else as typed. The caller sends this same number.
- Summary line, paid: "This will use 1 video generation of {s} seconds with {Provider}." plus " It sends {m} picture(s)." when `m > 0` (`m`: 1 for `background` and `first_frame`; for `reference`, the chosen pictures cut to the provider's `maxReferences`). When `s` differs from what was typed, a second line: "{Provider} makes clips of {min} to {max} seconds, so this one will be {s} seconds." ComfyUI and the fake provider keep their lines.
- **Paid rule.** Nothing is sent before the dialog's Confirm; the line is on screen first; the length and picture count it names are the ones sent. The licence dialog (D-088) still opens from the command's refusal through the app store's `command`, as for every run.

**Video command.** The panel sends `generation.startVideo { …, layerId }` (D5).

**Draft.** `GenerateDraft` (`stores/generate-drafts.ts`) gains `kind: 'image' | 'video'`, `start`, `startAssetId: string | null`, `videoPictureIds: string[]`, `seconds: string`, `promptTyped: boolean`; `GenerateRun` gains `kind`. New `wantKind(key, kind)`: kept until the layer's first draft is made, which then starts with that kind (used by D7).

**Code moved.** `card-starts.ts` and `video-length.ts` move from `screens/campaign/video-panel/` to `editor/generate-panel/` (R2E-8), where they serve the panel; `use-post.ts` is deleted with the card. `VideoPictureChoice`, `ProviderSelect`, `video-start.ts`, `offered-workflow` and `use-comfy-info` stay where they are.

### D5. A generated clip takes the still's place (item 24)

Today `clip.addGenerated` puts the clip at the first free position, so it queues behind the still `addFirstClip` made from the background picture, which runs to the post's end.

- `generation.startVideo`'s **user** input gains `layerId?: string` (added beside `licenceConfirmed`, not to `startVideoFields`, so `generationStartVideoAgentInput` and the `generate_video` tool stay as they are; the tool-list snapshot does not change). It must name the variant's background layer, else `INVALID_INPUT` "Videos are made on the background layer." It is stored in `job.layer_id`. `job.retry` keeps it, as it keeps every place field.
- The job asks `clip.addGenerated { projectId, variantId, assetId, replaceStill: job.layerId !== null }`.
- **The still to replace** (only when `replaceStill`): the clip on the variant's track whose asset is a picture and is the background layer's current source; else, when the track holds exactly one clip and it is a picture, that one; else none.
- **Replacing.** The new clip starts where the still started, `inMs` 0, `outMs` the file's length cut to fit before the next clip on the track and before the post's end; if that leaves less than `MIN_CLIP_MS`, nothing is replaced and the clip goes to the first free position as today. The still is removed and the clip written in one transaction.
- **Undo.** A replacement gives one undo entry on `variant:{id}`: the inverse is a new internal command `clip.swap { projectId, variantId, remove: string[], put: BackgroundClipRow[] }` that removes the named clips and writes the rows (each checked as `clip.restore` checks: schema bounds, a usable asset of this project, no overlap); its own inverse is the swap the other way. A plain add keeps no undo entry, as today. Policy row `'clip.swap': deny('swap background clips')`.
- `videoJobResult` gains optional `replacedStill: boolean`.
- Agent video runs have no layer, so they add at the first free position as today.

### D6. Where a finished run is (item 3)

**In the editor (runs started from the Generate panel).** The line under "Generate…" (`run-status.tsx`), `aria-live="polite"`:

| State | Words |
|---|---|
| Picture run waiting or working | "Making 1 picture…" / "Making {n} pictures…" |
| Picture run done, put on the empty layer | "Done. The first new picture is on the layer. Click another below to use it instead." |
| Picture run done, the layer had a picture | "Done. Click a new picture below to put it on the layer." |
| Picture run done, nothing kept | "The run ended with no pictures." |
| Video waiting or working | "Making the video. {videoRunningText}." (e.g. "Making the video. Working, 1 min.") |
| Video done, the still replaced | "Done. The new clip is on the timeline below, in place of the still." |
| Video done, added | "Done. The new clip is on the timeline below." |
| Video done, not on the track (`clipId` null) | "Done, but the clip could not be put on the timeline. Add it with Add clip… on the timeline." |
| Failed / cancelled | the failure sentence (`ui/run-failure/`) / "Cancelled." |

- **New pictures first.** `EarlierOptions` gains `newJobId?: string`. That run's block is drawn first under the plain title "New pictures" (its own region, `aria-labelledby`); the other runs follow under "Earlier options". Same option buttons, "In use" mark and seen marking as today.
- **A done video** shows the clip under the line: `editor/clip-preview/`, `<video controls preload="metadata" aria-label="Video result">`, no autoplay; it sends `job.markSeen` once when first drawn.
- **An empty layer gets the first picture.** New window store `stores/placed-runs.ts` (one per `window.api`, as `layout-run.ts` keeps its runs): the panel registers a picture run it started with `{ projectId, variantId, layerId, wasEmpty }`. When the job succeeds and `wasEmpty` is true, it reads `variant.get`; if the layer is there and still has no source, it sends `layer.update { source: { assetId: first kept }, geometry: { crop: null } }` through `window.api` (one undo entry; a refusal is dropped quietly) and records `placed[jobId]`. The latest row of up to 20 unregistered picture jobs is kept for a reply that comes after the first row. This runs whether or not the layer is selected, while the window is open.

**Elsewhere (runs that finish out of view: another layer, tab or campaign; an agent's run; the campaign page's "Make pictures").**
- **Result notice.** New `app/result-notice/`, mounted by the project frame under the error banner. When a job of kind `image_generation`, `video_generation`, `cutout` or `generative_fill` of the shown project turns `succeeded` with `seenAt` null, and the window is not showing its layer (or its variant, for a job with no layer), one line shows, info tone, `role="status"`:
  - "New pictures are ready: {where}." / "A new video is ready: {where}." / "A cut-out is ready: {where}." / "An extended picture is ready: {where}."
  - `{where}` is the activity row's place, "{campaign} › {variant} › {layer}" (`row-text.ts`).
  - Buttons "Show" (goes there, then the line closes) and an icon button `aria-label="Dismiss"`.
  - Only the newest shows; a newer one replaces it. It closes when that job is marked seen. It sends no `job.markSeen`.
- **Going there.** New `ui/show-result.ts`, `showResult(api, nav, projectId, job, place?)`, used by the notice, the activity row's "Go there" and the run rows below. It follows `goTarget`, with two changes: a video job is no longer sent to the campaign overview (with a layer it goes to the layer, else to the variant, where the timeline is); and a job with a slot and no layer opens the variant and selects the layer whose `slot` is the job's (read from `variant.get`), else the variant.
- **The campaign page's run list** (stays for now, see the open questions): a done picture row gets "Choose in the editor", a done video row "See it in the editor"; both call `showResult`.

### D7. Pointing to where videos are made (item 23)

- On a video post the timeline's clip track gets "Make a video…" beside "Add clip…". It selects the background layer, calls `wantKind(key, 'video')` (or `change` when the draft exists), and moves focus to the Generate panel's "Prompt". `ClipTrack` gets `onMakeVideo`, passed by `Timeline` from the editor.
- The properties panel with no layer selected, on a video post: "Select a layer to change it. To make a video, select the background layer."

### D8. The first-run setup (item 2, R-12)

**Mark.** `settings.json` gains `setup: { done: boolean }`, default `{ done: false }`; an older file loads with the default (the store's merge). `settingsPatchSchema` gains `setup: z.object({ done: z.boolean() }).partial().strict()`. Written only through `settings.update` (agent policy `deny`, unchanged).

**When it shows.** New `app/first-run/` (`first-run.tsx` with the dialog, `use-first-run.ts` with the rule), mounted once in `AppShell` beside the other dialogs. It opens by itself once per window, when the app state first arrives, if: the window shows the start screen, `settings.setup.done` is false, and `app.secrets` is empty (no key of any kind saved). A user who already has keys never sees it. A window that opens straight into a project does not show it.

**The dialog** (`ui/dialog-frame/`, `--width-dialog-wide`), title "Set up AdManager":
1. Welcome: "AdManager makes pictures, videos and text with AI services. Each service needs a key from its own website. Add the keys you have now; you can skip any step and add keys later in Settings." Buttons "Skip for now", "Start".
2. "Step 1 of 3: AI keys" — the Settings `KeysSection` as it is. Line: "With at least one key, or a ComfyUI server, you can make pictures and videos. Without either, you can still lay out ads by hand."
3. "Step 2 of 3: ComfyUI server" — the Settings `ComfySection`. Line: "Optional. A ComfyUI server you run yourself makes pictures and videos at no charge."
4. "Step 3 of 3: Cloud storage" — the Settings `S3Section` (it holds the Dropbox part). Line: "Optional. This is where Publish sends finished ads."
- Steps 2 to 4 have "Back", "Skip for now" and "Next" ("Finish" on the last). "Next" never needs anything filled in, so every step can be skipped.
- Every ending (Finish, Skip for now, Escape, the frame's close) sends `settings.update { setup: { done: true } }` once and closes. A refusal is not shown; the flow then shows again on a later start, which is harmless.
- On each step change the step's heading (`tabIndex={-1}`) takes the focus. The step words are the dialog's description.

**From Settings.** A first card in Settings, heading "Setup", line "Walk through adding keys again.", button "Open the setup…", which opens the same dialog at its welcome step whatever the mark says.

**Keys.** A key is typed only into `KeyRow`, which sends `secret.set` as today; the flow adds no command, no event and no log line. The typed value lives only in `KeyRow`'s own state and is cleared before the call, as built. Nothing of the flow reaches an agent.

### Commands, queries, settings and policy rows, in one place

| Change | Where | Agent policy |
|---|---|---|
| `generation.startVideo` user input `layerId?` | D5 | unchanged (`tick`); the agent input does not gain it |
| `clip.addGenerated` input `replaceStill?: boolean` | D5 | unchanged (`deny`, internal) |
| New `clip.swap` (internal) | D5 | `deny('swap background clips')` |
| `videoJobResult.replacedStill?` | D5 | — |
| `layoutBox` `boxColor?`, `boxPadding?`, `readable?`, `typeStyle?` | D2, D3 | `agentJobView` shows `boxColor`, `boxPadding`, `typeStyle` |
| `CoreDeps.readPixels` | D2 | — |
| `settings.setup.done` | D8 | `settings.update` stays `deny` |

No new query, no new event, no new agent tool.

## Slices

### R2E-1 — The prompt leaves out the ad's words

- **Exists when done:** D1. The editor's first draft and the campaign page's picture panel leave out the message when the variant's text layers hold words.
- **New files:** `src/renderer/screens/campaign/generate-panel/use-words-on-layers.ts`.
- **May touch:** `src/shared/generation/prompt.ts`; `src/renderer/editor/generate-fields/use-first-draft.ts` and `generate-fields.tsx` (a `layers` prop passed on); `src/renderer/editor/picture-ai/picture-ai.tsx` and `properties-panel.tsx` (pass the layers); `src/renderer/editor/layout-run.ts` (`canPlaceText` calls `hasWordsOnLayers`); `src/renderer/screens/campaign/generate-panel/generate-panel.tsx`.
- **Tests first:** `tests/unit/shared/generation/prompt-words.test.ts` (with and without words, with and without subjects, `kind: 'video'`; the old text unchanged when the new fields are absent; `hasWordsOnLayers` over hidden, blank and image layers); `tests/unit/renderer/editor/generate-fields-words.test.tsx` (a variant with a filled headline: the draft has no message; one without text: the old prompt); `tests/unit/renderer/screens/campaign/generate-panel-words.test.tsx` (the prompt changes once when `variant.get` answers; not after the user typed).
- **Approved edits to existing tests:** none expected (the new fields are optional and the `layers` prop defaults to no words).
- **Exit check:** class A + D: `npm run lint`, `npm run typecheck`, `npx vitest run tests/unit/shared/generation tests/unit/renderer/editor tests/unit/renderer/screens/campaign`.
- **Security:** none. **Depends on:** nothing.

### R2E-2 — Readable text after "Place text with AI"

- **Exists when done:** D2, the type styles excepted.
- **New files:** `src/shared/generation/contrast.ts`; `src/shared/generation/layout-readable.ts` (`keepReadable(boxes, { pixels, scale, palette, layers })`); `src/shared/config/contrast.ts`; `src/main/pixel-reader.ts`.
- **May touch:** `src/main/jobs/kinds/layout-proposal.ts`; `src/shared/schemas/jobs/layout-proposal.ts`; `src/shared/generation/layout-patches.ts`; `src/main/core-deps.ts`; `src/main/core.ts` (the option and its default, one line each); `src/main/index.ts` (one line filling `readPixels`); `src/renderer/editor/layout-run.ts`; `src/renderer/editor/editor-banner/editor-banner.tsx`.
- **Tests first:** `tests/unit/shared/generation/contrast.test.ts` (luminance of white, black and `#777777`; ratio 21 for white on black; the percentile ground over a made-up half-white, half-black RGBA picture; alpha over black; a box past the picture's edge); `tests/unit/shared/generation/layout-readable.test.ts` (table: a readable colour kept; a brand colour chosen over white; white or black when no brand colour reaches 4.5; a box added over a striped picture, with its padding; an existing text box colour used as the ground; no palette; a box with no area); `tests/unit/main/pixel-reader.test.ts` (BGRA in, RGBA out, through a stand-in decoder); `tests/integration/jobs/layout-contrast.test.ts` (the fake layout over a stand-in `readPixels`: white text on a white ground comes back changed; `readPixels` throwing: boxes as before, no new keys, one warn line with no picture data); `tests/unit/shared/generation/layout-patches-box.test.ts`; `tests/unit/renderer/editor/layout-changed-line.test.tsx` (the banner's two wordings, Dismiss).
- **Approved edits to existing tests:** tests that build `CoreDeps` by hand as a full object (make-it-compile: add `readPixels`); `tests/unit/renderer/editor/editor-banner*.test.tsx`, only if one lists the line kinds exactly.
- **Exit check:** class A + B + G: lint, typecheck, `npx vitest run tests/unit/shared/generation tests/unit/main tests/integration/jobs tests/unit/renderer/editor`, `npm run build`, `npx playwright test tests/e2e/workflow-5-1.spec.ts` (the layout step still passes in the built app with the real `nativeImage`).
- **Security:** none (no new input from outside; the picture is the app's own drawing). **Depends on:** nothing. **Shots:** `tests/shots/r2e-2.shots.ts`, 320 (the "colours were changed" banner), 321 (a headline with the added text box over a busy picture).

### R2E-3 — Type styles

- **Exists when done:** D3.
- **New files:** `src/shared/config/type-styles.ts`; `src/renderer/editor/type-styles/` (`index.ts`, `type-styles.tsx`, `type-styles.module.css`).
- **May touch:** `src/main/jobs/kinds/layout-proposal.ts` (the font check and `typeStyles`); `src/main/providers/types.ts` (the layout input type); `src/main/providers/gemini/prompts.ts` and `layout.ts`; `src/main/providers/fake/layout.ts`; `src/shared/generation/layout-clamp.ts`; `src/shared/schemas/jobs/layout-proposal.ts`; `src/shared/generation/layout-patches.ts`; `src/renderer/editor/text-fields/text-fields.tsx` (one mount); `src/main/mcp/tools/agent-job-view.ts`.
- **Tests first:** `tests/unit/shared/config/type-styles.test.ts` (five ids, weights inside Inter's 100 to 900); clamp cases (a known style kept, an unknown one null, none given: null); `tests/unit/main/providers/gemini/layout-type-styles.test.ts` (the two lines only with `typeStyles`; the schema's optional enum); `tests/integration/jobs/layout-type-styles.test.ts` (a project with no font gets `typeStyles` and the fake's `bold` headline; a project with one font gets none); patches apply the three fields and never `fontAssetId`; `tests/unit/renderer/editor/type-styles.test.tsx` (shown only with no font; the pressed style; one `layer.update`; disabled when locked; gone after a font is added).
- **Approved edits to existing tests:** `tests/unit/main/mcp/tools/agent-job-view.test.ts`: the layout box's allowed field list grows by `boxColor`, `boxPadding`, `typeStyle`; the Gemini layout tests: an expected schema gains the optional `typeStyle` property (instruction tests without type styles keep their text).
- **Exit check:** class A + E + D: lint, typecheck, `npx vitest run tests/unit/shared tests/unit/main/providers tests/unit/main/mcp tests/integration/jobs tests/integration/mcp/ai-tools.test.ts tests/unit/renderer/editor`.
- **Security:** short (an agent's job view gains three plain fields; `riskyKeys` and the word test over the recorded layout reply). **Depends on:** R2E-2. **Shots:** `tests/shots/r2e-3.shots.ts`, 322 (Built-in styles in Text settings), 323 (an ad placed with type styles).

### R2E-4 — The Generate panel, pictures

- **Exists when done:** D4 for pictures: the "Generate" fieldset replaces "Make pictures with AI"; "Start from" with its three picture choices and the same-shape list; the draft's new fields. No video yet (no "Make" switch); the lines for video posts of D4 show.
- **New files:** `src/renderer/editor/generate-panel/` (`index.ts`, `generate-panel.tsx`, `generate-panel.module.css`, `start-from.tsx`, `same-shape-list.tsx`); `src/shared/generation/same-shape.ts`.
- **May touch:** `src/renderer/editor/generate-fields/` (its start picture joins the references); `src/renderer/stores/generate-drafts.ts`; `src/renderer/editor/properties-panel/properties-panel.tsx` (mount the panel in place of `PictureAi`); delete `src/renderer/editor/picture-ai/`.
- **Tests first:** `tests/unit/shared/generation/same-shape.test.ts` (1% either way; zero sizes); `tests/unit/renderer/editor/generate-panel.test.tsx` (the legend; the choices and their disabled state; "This layer's picture" sends the layer's asset first; a same-shape pick; the list's empty line and the other-shape line; at most 8 sent; the video-post lines); draft store cases for `wantKind` and the new fields.
- **Approved edits to existing tests:** `tests/unit/renderer/editor/picture-ai.test.tsx` and `picture-ai-earlier.test.tsx`: import `GeneratePanel`, the group name "Make pictures with AI" becomes "Generate" (the section order list too); `tests/unit/renderer/editor/ai-style.test.tsx`: the module path `editor/picture-ai/picture-ai.module.css` becomes `editor/generate-panel/generate-panel.module.css`; `tests/e2e/workflow-5-1-steps.ts` (`pictureSection`), `tests/e2e/screen-tour.ts` (line 117): the group name; shots `p4-13`, `p4-18`, `st-9`: the group name only.
- **Exit check:** class D + e2e: lint, typecheck, `npx vitest run tests/unit/renderer tests/unit/shared/generation`, `npm run test:e2e -- tests/e2e/workflow-5-1.spec.ts` (it also runs the workflow 5.8 steps).
- **Security:** none. **Depends on:** R2E-1. **Shots:** `tests/shots/r2e-4.shots.ts`, 324 (the panel on a picture layer), 325 (the same-shape list).

### R2E-5 — Results in the editor

- **Exists when done:** D6 "In the editor" for pictures: the new words, "New pictures" first, the first picture put on an empty layer.
- **New files:** `src/renderer/stores/placed-runs.ts`; `src/renderer/editor/earlier-options/new-options.tsx` (the "New pictures" block).
- **May touch:** `src/renderer/editor/generate-fields/run-status.tsx` and `generate-fields.tsx` (register the run, `wasEmpty`); `src/renderer/editor/generate-panel/generate-panel.tsx` (pass `newJobId`); `src/renderer/editor/earlier-options/earlier-options.tsx`.
- **Tests first:** `tests/unit/renderer/stores/placed-runs.test.ts` (an empty layer gets the first picture once; a layer that got a picture meanwhile is left; a gone layer or variant: nothing, no banner; a row before the reply); `tests/unit/renderer/editor/run-status-words.test.tsx` (each picture row of the D6 table); `tests/unit/renderer/editor/new-options.test.tsx` (the new run first under "New pictures", the rest under "Earlier options", seen marked once).
- **Approved edits to existing tests:** "Done. Choose one under Earlier options." becomes the D6 words in `tests/unit/renderer/editor/generate-fields.test.tsx`, `tests/e2e/workflow-5-1-steps.ts` (line 103), shots `p4-13` and `st-9`; where such a test then expects the layer to stay empty after a run on an empty layer, it now expects the first picture "In use".
- **Exit check:** class D + e2e: lint, typecheck, `npx vitest run tests/unit/renderer`, `npm run test:e2e -- tests/e2e/workflow-5-1.spec.ts`.
- **Security:** none. **Depends on:** R2E-4. **Shots:** `tests/shots/r2e-5.shots.ts`, 326 (done, the picture on the layer, "New pictures"), 327 (done on a layer that had a picture).

### R2E-6 — Results elsewhere

- **Exists when done:** D6 "Elsewhere": the result notice, `showResult`, the two `goTarget` changes, the run rows' buttons.
- **New files:** `src/renderer/app/result-notice/` (`index.ts`, `result-notice.tsx`, CSS module, `use-result-notice.ts`); `src/renderer/ui/show-result.ts`.
- **May touch:** `src/renderer/ui/go-there.ts`; `src/renderer/app/activity-row/` (Go there calls `showResult`); `src/renderer/screens/campaign/run-row/run-row.tsx`; `src/renderer/app/app-shell/app-shell.tsx` (one mount in the project frame).
- **Tests first:** `tests/unit/renderer/app/result-notice.test.tsx` (each kind's words; not shown while its layer is shown; the newest replaces; Show goes there and closes; Dismiss; closes on seen; no `job.markSeen` sent); `tests/unit/renderer/ui/show-result.test.ts` (a video job with and without a layer; a slot job selects the slot's layer; a gone slot layer: the variant); run-row buttons.
- **Approved edits to existing tests:** `tests/unit/renderer/ui/go-there.test.ts` line 45: a video job with a variant now leads to `{ to: 'variant', … }` (and to the layer when it has one); activity-row tests that assert `goThere` was called directly may assert the same place reached through `showResult`.
- **Exit check:** class D: lint, typecheck, `npx vitest run tests/unit/renderer`.
- **Security:** none. **Depends on:** nothing (R2E-7 makes video jobs carry a layer in real use). **Shots:** `tests/shots/r2e-6.shots.ts`, 328 (the notice on another variant's tab), 329 (the run list's "Choose in the editor").

### R2E-7 — Clips take the still's place (main process)

- **Exists when done:** D5.
- **New files:** `src/main/commands/clip/swap.ts`; `src/main/clips/still-to-replace.ts` (pure: the still, the new clip's start and length, or none).
- **May touch:** `src/shared/schemas/commands/generation.ts` (user input only); `src/main/commands/generation/start-video.ts` (the layer check, `layerId` on the job); `src/shared/schemas/commands/clip.ts` (`replaceStill`, `clip.swap` input); `src/main/commands/clip/add-generated.ts`, `index.ts`; `src/main/jobs/video-store.ts`; `src/shared/schemas/jobs/video-generation.ts`; `src/main/commands/agent-policy.ts` (one row).
- **Tests first:** `tests/unit/main/clips/still-to-replace.test.ts` (the background's still; the only clip; a still that is not the background's among several: none; cut before the next clip and the post's end; too short: none); `tests/integration/commands/clip-add-generated-replace.test.ts` (replaced in one write; undo puts the still back and removes the clip; redo swaps again; `replaceStill` false: first free position as before); `tests/integration/commands/clip-swap.test.ts` (refuses overlap, another project's asset, a clip of another variant; agent `AGENT_DENIED`); `tests/integration/commands/start-video-layer.test.ts` (an image layer or another variant's layer refused; the background stored on the job; `job.retry` keeps it); `tests/integration/generation/video-replaces-still.test.ts` (a fake video job on a post with its still: one clip at 0, `replacedStill: true`); the tool-list snapshot is unchanged (`generate_video` gains no field).
- **Approved edits to existing tests:** `tests/unit/main/commands/agent-policy-table.test.ts`, `tests/integration/commands/clip-access.test.ts` and `tests/integration/commands/video-stubs.test.ts`: add `clip.swap` where they list command names or internal commands; `tests/unit/shared/schemas/clip-schemas.test.ts`: the add-generated input accepts `replaceStill`.
- **Exit check:** class B + E: lint, typecheck, `npx vitest run tests/unit/main tests/unit/shared/schemas tests/integration/commands tests/integration/generation tests/integration/mcp/tool-list.test.ts`.
- **Security:** short (a new internal command behind `deny`; a user-only input field; an undo entry from a system command). **Depends on:** nothing.

### R2E-8 — The Generate panel, videos

- **Exists when done:** D4 for videos (the "Make" switch, the video starts, "Clip length (seconds)", the run dialog's video mode) and D6's video rows with the clip preview. The campaign page's "Make a video" card still exists.
- **New files:** `src/renderer/editor/generate-panel/video-fields.tsx`, `make-switch.tsx`, `video-lengths.ts`; `src/renderer/editor/clip-preview/` (`index.ts`, `clip-preview.tsx`, CSS module).
- **May touch:** move `card-starts.ts` and `video-length.ts` into `src/renderer/editor/generate-panel/` and change the imports in `src/renderer/screens/campaign/video-panel/video-panel.tsx` (imports only); `src/renderer/editor/generate-panel/generate-panel.tsx`, `start-from.tsx`; `src/renderer/editor/generate-fields/run-status.tsx`; `src/renderer/dialogs/run-dialog/run-dialog.tsx`, `run-summary.ts`, `provider-choice.tsx`; `src/renderer/stores/generate-drafts.ts`.
- **Tests first:** `tests/unit/renderer/editor/generate-panel-video.test.tsx`, ported from the card's tests so their cases still hold in the panel: the offers (`video-offer.test.tsx`), the starts (`video-start.test.tsx`), the pictures and their refusals (`video-picture.test.tsx`), the subject photos chosen first (`video-picture-pre-choice.test.tsx`), the licence dialog (`video-card-licence.test.tsx`), the trial mark (`trial-mark.test.tsx`, video part); plus: "Video" first on a video post's background; Video disabled with no provider; `layerId` sent; the prompt follows the kind until typed. `tests/unit/renderer/dialogs/run-dialog-video.test.tsx` (a provider that cannot start this way is disabled; the length line for fal at 2 s says 4 s and the command sends 4,000 ms; the picture count; nothing sent before Confirm); `tests/unit/renderer/editor/clip-preview.test.tsx`; the video rows of the D6 table.
- **Approved edits to existing tests:** none to the card's own tests (R2E-9 removes them); search `tests/e2e/` and `tests/shots/` for a picture run on a video post's background layer: there, click "Picture" in the "Make" group first.
- **Exit check:** class D + e2e: lint, typecheck, `npx vitest run tests/unit/renderer`, `npm run test:e2e -- tests/e2e/video-variant.spec.ts tests/e2e/workflow-5-1.spec.ts`.
- **Security:** short (the paid-call path: the confirm line, the length and picture count sent). **Depends on:** R2E-5, R2E-7. **Shots:** `tests/shots/r2e-8.shots.ts`, 330 (the panel on a video post's background), 331 (the run dialog, fal.ai with the length line, no run sent), 332 (working), 333 (done, the clip in place of the still, with its preview).

### R2E-9 — The "Make a video" card leaves the campaign page

- **Exists when done:** the card and what only served it are gone; every test that drove it drives the editor panel.
- **New files:** none (helpers change in place).
- **May touch:** `src/renderer/screens/campaign/campaign-view/campaign-view.tsx` (remove the `VideoPanel` mount and import; the header comment); delete `src/renderer/screens/campaign/video-panel/` (`video-panel.tsx`, `use-post.ts`, `index.ts`). Keep `video-picture-choice/`, `video-start.ts`, `provider-select/`, `run-list/`, `run-row/`, `video-result/` (the run list still shows video rows).
- **Tests first:** `tests/unit/renderer/screens/campaign/no-video-card.test.tsx` (the overview has no "Make a video" region).
- **Approved edits to existing tests:**
  - Delete `tests/unit/renderer/screens/campaign/video-panel.test.tsx`, `video-offer.test.tsx`, `video-offer-fixture.tsx`, `video-start.test.tsx`, `video-start-fixture.tsx`, `video-picture.test.tsx`, `video-picture-pre-choice.test.tsx`, `video-card-licence.test.tsx` (their cases live on in R2E-8's tests).
  - `trial-mark.test.tsx`: drop the video-card cases; `run-panels-style.test.tsx`: drop `'video-panel'`; `campaign-view.test.tsx`: the read count at line 93 no longer includes the card's own `variant.get`.
  - `tests/e2e/screens.ts`: `videoPanel(page)` returns the editor's "Generate" group after opening the master's tab, selecting the background layer and choosing "Video"; `startVideo` fills "Prompt" and "Clip length (seconds)", clicks "Generate…", chooses the provider in the run dialog and clicks "Generate"; `startFromAddedPicture` uses the panel's "Start from" and its picture list; `clipHasMetadata` finds "Video result" in the panel.
  - `tests/e2e/video-variant-steps.ts` `startFromBackground`, `tests/e2e/video-screens.ts`: the same path ("This layer's picture").
  - Where an e2e test starts a video from an added first-frame picture (`comfy-stand-in.spec.ts`, `jpeg-orientation.spec.ts`), it may make that picture at the post's shape; a test about how a picture is read (orientation) may use the reference start instead; each keeps its checks on the upload.
  - `tests/e2e/video-variant.spec.ts` from line 88: the run's clip takes the still's place (clip 1, from 0 to the start of `tiny.mp4`); the later steps that moved and trimmed "clip 3" act on the run's clip in its new place and keep what they check (a gap left, an end trimmed). `tests/e2e/video-resume.spec.ts` lines 82-83: one clip, the run's, starting at 0.
  - `tests/e2e-real/` steps that use these helpers follow them (no real run is made by this slice).
  - Shots `p7-22` (retire it: delete the file), `p7-24`, `s2-6`, `s2-7`: the new helpers.
- **Exit check:** class D + e2e: lint, typecheck, `npx vitest run tests/unit/renderer`, `npm run test:e2e` (the whole e2e suite: this slice moves many of its paths).
- **Security:** none. **Depends on:** R2E-8. Never beside a campaign-tabs slice that edits `campaign-view.tsx`.

### R2E-10 — First-run setup

- **Exists when done:** D8.
- **New files:** `src/renderer/app/first-run/` (`index.ts`, `first-run.tsx`, `first-run.module.css`, `use-first-run.ts`, `steps.tsx`); `src/renderer/screens/settings/setup-section/` (`index.ts`, `setup-section.tsx`).
- **May touch:** `src/shared/schemas/settings.ts`; `src/main/settings/defaults.ts`; `src/renderer/app/app-shell/app-shell.tsx` (one mount); `src/renderer/screens/settings/settings-screen/settings-screen.tsx` (one mount, first).
- **Tests first:** `tests/unit/main/settings/settings-setup.test.ts` (an old file loads `done: false`; the patch accepts `setup.done` and refuses unknown keys); `tests/integration/commands/settings-setup.test.ts` (the user sets it; an agent `AGENT_DENIED`); `tests/unit/renderer/app/first-run.test.tsx` (shown on the start screen with no mark and no secret; not with a saved key; not with the mark; not in a project view; each step's words and focus; Next with nothing filled; every ending sends `setup.done` once; after a key is saved in step 1 the dialog stays open; the typed key is not in the document after Save; no command other than `secret.set` and `settings.update` is sent); `tests/unit/renderer/screens/settings/setup-section.test.tsx` (opens at the welcome step with the mark set).
- **Approved edits to existing tests:** `tests/e2e/launch.ts` `makeSandbox`: the written settings gain `setup: { done: true }`, so no e2e run meets the flow; `tests/unit/renderer/fake-api.ts`: the fake settings gain `setup: { done: true }`; tests that type a full `Settings` object by hand (make-it-compile: add `setup`).
- **Exit check:** class A + B + D: lint, typecheck, `npx vitest run tests/unit/main/settings tests/integration/commands/settings-update.test.ts tests/integration/commands/settings-setup.test.ts tests/unit/renderer`, `npm run test:e2e -- tests/e2e/phase1.spec.ts`, and one e2e test of its own in `tests/e2e/first-run.spec.ts` (a sandbox without the mark: the dialog shows, "Skip for now" closes it, a second launch does not show it).
- **Security:** short (the key entry rows shown in a new place; the review checks no key value reaches state outside `KeyRow`, an event, a log line or an agent). **Depends on:** nothing. **Shots:** `tests/shots/r2e-10.shots.ts`, 334 (welcome), 335 (AI keys), 336 (ComfyUI), 337 (the Settings card).

### R2E-11 — Pointing to where videos are made

- **Exists when done:** D7.
- **New files:** none.
- **May touch:** `src/renderer/editor/clip-track/clip-track.tsx`; `src/renderer/editor/timeline/timeline.tsx`; `src/renderer/editor/editor/editor.tsx` (pass `onMakeVideo`); `src/renderer/editor/properties-panel/properties-panel.tsx` (the empty line); `src/renderer/editor/generate-panel/generate-panel.tsx` (take the focus request).
- **Tests first:** `tests/unit/renderer/editor/make-video-button.test.tsx` (shown on a video post only; selects the background, "Video" chosen, focus on "Prompt"; a draft that exists switches to video); the empty line on a video post and its absence on an image post.
- **Approved edits to existing tests:** `tests/unit/renderer/editor/clip-track.test.tsx`: where it lists the track header's buttons exactly, add "Make a video…"; properties-panel tests that assert the empty text exactly, for video posts only.
- **Exit check:** class D: lint, typecheck, `npx vitest run tests/unit/renderer/editor`.
- **Security:** none. **Depends on:** R2E-8. **Shots:** `tests/shots/r2e-11.shots.ts`, 338 (the timeline's "Make a video…"), 339 (the empty properties line).

## Waves

At most two developers at once. Each pair owns disjoint files.

| Wave | Slices side by side | Why this order |
|---|---|---|
| 1 | R2E-1 ‖ R2E-10 | Both need nothing; prompt files vs settings and first-run files |
| 2 | R2E-2 ‖ R2E-7 | Layout job, contrast and `index.ts` vs the clip and video commands |
| 3 | R2E-3 ‖ R2E-4 | R2E-3 needs R2E-2 (same layout files); R2E-4 needs R2E-1. Disjoint: `text-fields.tsx` vs `properties-panel.tsx` |
| 4 | R2E-5 ‖ R2E-6 | R2E-5 needs R2E-4; R2E-6 needs nothing but goes after the panel so its notice can be seen beside it. Disjoint: editor vs app, ui and campaign run row |
| 5 | R2E-8 | Needs R2E-5 and R2E-7; touches the run dialog and the panel |
| 6 | R2E-9 ‖ R2E-11 | Both need R2E-8. Campaign page and tests vs timeline and editor. R2E-9 also waits for, or runs before, the campaign-tabs slice that edits `campaign-view.tsx` |

## Assumptions

| ID | Assumption | Undo |
|---|---|---|
| A-320 | The prompt leaves out the brief's message whenever any visible text layer of the variant has words, and asks for clear space for them instead | Easy |
| A-321 | The campaign page's "Make pictures" panel follows the same rule, from one `variant.get` | Easy |
| A-322 | Readable means a WCAG contrast of 4.5:1 against both the 10th and 90th percentile brightness of the picture under the box (text left out), or against the box's own fill | Easy |
| A-323 | Fallback order: the AI's colour, the best brand colour, white or black, then a solid text box (brand colour, else black or white) with padding of a quarter of the font size | Easy |
| A-324 | If the drawn picture cannot be read, the AI's colours are kept and a warning is logged | Easy |
| A-325 | A banner line says how many text colours were changed | Easy |
| A-326 | Only Inter ships with a licence in the repository, so no font file is added; five built-in type styles are made from Inter | Easy |
| A-327 | The layout AI is offered the type styles only when the project's asset library has no font; unknown answers are dropped | Easy |
| A-328 | "Built-in styles" shows in Text settings only when the project has no font of its own | Easy |
| A-329 | The panel is named "Generate"; video is offered only on the background layer of a video post, and is chosen first there | Easy |
| A-330 | "Another asset at the same size" means another picture of the same shape (ratio within 1%); pictures only, not videos | Easy |
| A-331 | The provider is still chosen in the run dialog for both kinds; a video's length is fitted to the provider, and the dialog states the length and picture count actually sent | Easy |
| A-332 | A video started from the panel records the background layer; its clip replaces the background's still (or the only clip, when it is a still), cut to fit, as one undo entry; agent video runs add at the first free position as before | Medium |
| A-333 | A picture run started on a layer with no picture puts its first picture on the layer when it ends, while the window is open; one undo entry | Easy |
| A-334 | The newest run's pictures show first under "New pictures", above "Earlier options" | Easy |
| A-335 | A one-line notice names a result that finished out of view, with "Show" and "Dismiss"; only the newest shows | Easy |
| A-336 | "Go there" for a video job opens its variant (and the background layer); a slot run selects the slot's layer | Easy |
| A-337 | The first-run mark is `settings.setup.done`; the flow shows on the start screen when the mark is unset and no secret is saved; any way of closing it sets the mark; its steps are AI keys, ComfyUI and Cloud storage | Easy |
| A-338 | The e2e sandbox and the renderer's fake settings carry `setup.done: true`, so no other test meets the flow | Easy |
| A-339 | The campaign page keeps its "Make pictures" panel and "Runs" list for now; only the video card leaves (R-13) | Easy |

## Open questions

1. **Should the campaign page's "Make pictures" panel and "Runs" list go too?** Item 7 says both pictures and videos are made from a media layer, and the spec already calls that panel a placeholder. R-13 removes only the video card, and removing the picture panel means rewriting about a hundred uses in the e2e and real-server tests (`picturePanel`, `chooseSlot`, `generate`). *Recommendation:* yes, in a later slice once the campaign tabs work has landed. Planned here as: kept (A-339), with "Choose in the editor" on its done rows.
2. **"Same size": the same shape, or the same pixels?** Exact pixel matches are rare between a generated picture and a layer box. *Recommendation:* the same shape within 1% (A-330). Planned that way.
3. **One contrast bar for all text, or 3:1 for large headlines?** WCAG allows 3:1 for large text, which keeps more brand colours. *Recommendation:* 4.5:1 for every text for now (A-322); one number in `src/shared/config/contrast.ts` if he wants it lower.
4. **May the app ship more fonts?** Only Inter ships today. Two or three families under the SIL Open Font Licence (a serif and a condensed display face, for example), each checked in with its licence text, would give real font choices. *Recommendation:* yes, as a later slice, with the families he picks. Planned here as Inter type styles only (A-326).

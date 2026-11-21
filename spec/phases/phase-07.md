# Phase 7 — Video and timeline

**Goal:** Video variants preview as they will export.
**Classes:** A, B, C, D, E, G (each slice names its own).

**Where things are.** This file: what is built already, exit criteria, rules, the wave table, the lists, the design additions, assumptions A-170 to A-189 and open questions. Slices P7-1 to P7-13: `spec/phases/phase-07-slices.md`. Slices P7-14 to P7-24: `spec/phases/phase-07-slices-2.md`.

## Already built (not planned again)

- `generation.startVideo` with ComfyUI and the fake provider: three starts (prompt, first-frame picture, reference picture), the start checks (`src/main/commands/generation/video-start-checks.ts`, `start-pair.ts`, `comfy-video-checks.ts`), `job.retry` checks for ComfyUI video rows.
- The `video_generation` job kind (`src/main/jobs/kinds/video-generation.ts`): start once, poll every 2 s, fetch, `checkMp4`, store through `storeResult`. A row with a `remote_job_id` is only checked and fetched. Left-over video rows of a provider other than ComfyUI are picked up on project open (`src/main/jobs/start-up.ts`).
- `checkMp4` (`src/main/providers/video-check.ts`) already reads width, height, duration and `hasSound` from the box headers. Sound is kept; no code refuses a clip with sound. The `clip_has_sound` sentence in `src/shared/providers/messages.ts` and the reason in `src/shared/schemas/queries/app.ts` are unused leftovers.
- The "Make a video" card (`src/renderer/screens/campaign/video-panel/`), the run row, the clip result.
- The `background_clip` table (no commands), `layer.timing` and `layer.animation` (stored and patched by `layer.update`, not drawn), `variant.duration_ms`, the Scene's `timeMs` prop (unused), the policy rows `clip.add`, `clip.update`, `clip.remove` (deny) and `variant.setFormat` (allow).
- The `fal-seedance` registry row (`available: false`), its secret `fal.apiKey`, its cancel wait (10 minutes), an empty adapter folder.
- `media-src adman-asset:` in the page policy; `video` is a served kind of the asset protocol (no byte ranges).

## Exit criteria

1. **Workflow 5.5 passes with the fake provider** (`tests/e2e/video-variant.spec.ts`, P7-24): an image variant with a background picture is changed to video; the duration is set to 8 s; the still is the first clip; an imported MP4 is added; a fake run started from the post's background lands on the track at the first free position; clips are moved and trimmed and a gap is drawn black (a `variant.render` at a time inside the gap); a text layer gets a start, an end, an entrance and an exit preset; play moves the playhead, pause stops it, scrub sets the time; the editor is usable while the run works [REQ: FR-124].
2. **The named tests pass:** the format round trip and the refused format change (`spec/testing.md`), with the OI-20 case (an emptied track stays empty after a round trip).
3. **Preset reference pictures pass on macOS** (`tests/e2e/scene-reference.spec.ts`, the time cases); Windows is the stakeholder's check (D-087).
4. **A running video job survives closing and reopening the app:** `tests/e2e/video-resume.spec.ts` ends the app process while a fake run works, starts the app again, opens the project, and the clip lands on the track. `tests/integration/jobs/close-leaves-charged-run.test.ts` shows a graceful close leaves a started paid run running and the next open collects it.
5. **FFmpeg:** `npm run fetch:ffmpeg` has placed an LGPL FFmpeg on this Mac once and its licence check passed; `tests/integration/media/embed-real.test.ts` passes with it (it skips with a message when no binary is present, so CI stays green).
6. **One paid fal run** (`tests/live/seedance.live.test.ts`, 4 s, 480p, from a still) turned one picture into one MP4 (D-085, D-089).
7. Full checks on `main`: lint, typecheck, `npm test`, build, `test:build`, `npm run test:e2e`. Shots 220 to 249 made and named in the reports.

## Dependencies, as they really are

- **Phase 6: none.** No slice uses translations or checks. The only overlap is shared files (below).
- **Phase 5: one slice.** P7-23 (video in fan-out) waits for Phase 5's `variant.fanOut` slice. Nothing else needs Phase 5.
- **OI-09:** only P7-3 (the fetch script) and exit criterion 5. Everything else runs against a stand-in media tool.
- **OI-30:** answered by A-170 (no client package); P7-14 can start now.
- **The migration number.** P7-2 needs no other phase's code, only that no other migration slice is in flight; it takes the next number (0007 expected).

## Rules for these slices

- Test first; one table test where cases are alike. A slice that touches `src/renderer/` also runs `npm run test:e2e`.
- **Only P7-1 edits** `agent-policy.ts`, `events.ts` (if needed), `src/main/queries/queries.ts`, `core.ts`, `core-deps.ts`, the command folder indexes it creates, and `src/shared/video/messages.ts`. **Only P7-2** edits the Drizzle schema files, the migration, and `src/shared/schemas/rows/index.ts`. A later slice that finds it must change one of these stops and reports.
- **Stubs.** P7-1 registers every new command against a stub that refuses in `prepare` with `RULE_VIOLATION`, reason `video_not_built`, "This part of video editing is not built yet." The owning slice replaces the body and touches no index.
- **FFmpeg is run only through `src/main/media/run-ffmpeg.ts`** (P7-4). No other file spawns a process. No slice uses `exec`, a shell, `PATH` lookup, or a path from settings or a project file for the binary.
- **No new token.** Screens take CSS from `src/renderer/ui/tokens.css` only. One folder per component. Each screen slice adds `tests/shots/p7-{n}.shots.ts`, picture names from its numbers.
- **Test clips.** Tests that need a playable video use `tests/fixtures/video/tiny.mp4` and `tiny-sound.mp4`, made once by P7-3 with the fetched FFmpeg and committed (each under 50 KB). Tests that need only box headers keep using the fake MP4 builder (`src/main/providers/fake/mp4.ts`).
- **Paid calls:** the fake provider and recorded answers only, except the one fal run in P7-24. `test:live` runs only there.
- **Nothing leaves this machine** (D-086). The fetch script downloads; nothing is uploaded, pushed or released.
- Budget: one slice per run, well under 300k tokens; hand off with `HANDOFF.md` if near it.

## Order and side-by-side work

| Slice | Needs | May run beside | Must not run beside |
|-------|-------|----------------|---------------------|
| P7-1 Contracts | Phases 1 to 4 | P7-2, P7-3, P7-5, P7-6, P7-7, P7-13, P7-14 | Any other phase's contracts slice (`agent-policy.ts`, `core.ts`, `core-deps.ts`, `queries.ts`) |
| P7-2 Migration and row schemas | No migration in flight elsewhere | P7-1, P7-3, P7-4, P7-6, P7-7, P7-13, P7-14 | Any slice that adds a migration or edits `rows/index.ts` (Phase 6's contracts) |
| P7-3 FFmpeg fetch script | Nothing | Everything | Any slice editing `package.json` scripts (none planned here) |
| P7-4 Media runner | P7-1; P7-3 for its exit check (the real binary and test clips) | Everything but P7-1 | Any slice editing `src/main/index.ts` |
| P7-5 Video facts, audio types | P7-2 | P7-4, P7-6, P7-7, P7-13, P7-14 | Any slice editing `inspect.ts`, `sniff.ts`, `file-types.ts` |
| P7-6 Asset protocol ranges | Nothing | Everything | Any slice editing `asset-url.ts`, `asset-protocol.ts` |
| P7-7 Presets and time | Nothing | Everything but P7-8 | P7-8 (`scene.tsx`, `scene-input.ts`) |
| P7-8 Background track drawn | P7-1, P7-2, P7-3 (test clips), P7-7 | P7-9 to P7-15 | P7-7; P7-16 (`thumbnails/service.ts`) |
| P7-9 Clip commands | P7-1, P7-2, P7-5 | P7-8, P7-11, P7-13, P7-14 | Phase 5 or 6 slices editing `queries/variant.ts` or `campaign-reads.ts` |
| P7-10 Format and duration | P7-9 | P7-11 to P7-15 | Phase 5 slices editing `commands/variant/index.ts` |
| P7-11 Video start checks and offers | P7-1 | P7-8, P7-9, P7-10, P7-13, P7-14 | P7-15, P7-16 (`run-tools.ts`, `generation.ts` schemas) |
| P7-12 Sound data | P7-1, P7-2, P7-5 | P7-10, P7-11, P7-13, P7-14 | Any slice editing `assets/in-use.ts` |
| P7-13 Runs that would still charge | Nothing | Everything | Any slice editing `src/main/jobs/` or `close-words.ts` |
| P7-14 fal adapter | Nothing | Everything | Any slice editing `src/main/providers/gemini/pinned-origin.ts` |
| P7-15 fal switched on | P7-11, P7-13, P7-14 | P7-10, P7-12, UI slices | P7-16 (`run-tools.ts`) |
| P7-16 Video job into the ad | P7-4, P7-8, P7-9, P7-11 | P7-12, P7-17 to P7-22 | P7-15 |
| P7-17 Format and duration controls | P7-10 | Other UI slices | Phase 5/6 slices editing `editor/top-bar/` |
| P7-18 Timeline frame and playback | P7-1 | P7-17, logic slices | Phase 5/6 slices editing `editor/editor/`, `canvas-view/` or `shortcuts.ts` |
| P7-19 Layer tracks | P7-18 | P7-20, P7-21, P7-22 | Phase 6 slices editing `properties-panel.tsx` |
| P7-20 Clip track | P7-18, P7-9 | P7-19, P7-22 | P7-21 (`variant-store.ts`) |
| P7-21 Sound controls and preview | P7-18, P7-12, P7-6, P7-20 | P7-19, P7-22 | P7-20 |
| P7-22 "Make a video" card | P7-11 | Other UI slices | Nothing planned |
| P7-23 Video in fan-out | Phase 5 `variant.fanOut`; P7-10 | Every Phase 7 slice | The Phase 5 slice that owns the fan-out file |
| P7-24 End to end, shots, paid run, exit | All others | Nothing | Nothing |

## Can start now (need only Phases 1 to 4)

P7-1, P7-2 (once no other migration is in flight), P7-3, P7-6, P7-7, P7-13, P7-14. After P7-1 merges: P7-11, P7-18, and P7-4 (its exit check also needs P7-3). After P7-2: P7-5.

## Shared files

Existing files that more than one slice here, or another phase, is likely to edit:

- `src/main/commands/agent-policy.ts`, `src/main/core.ts`, `src/main/core-deps.ts`, `src/main/queries/queries.ts` — contracts slices of Phases 5, 6, 7.
- `src/shared/schemas/rows/index.ts` and the Drizzle schema files, the migration journal — P7-2, Phase 6 (`variant_check`), Phase 5 if it adds columns.
- `src/main/commands/variant/index.ts`, `src/shared/schemas/commands/variant.ts` — P7-1, P7-10, Phase 5 (fan-out, delete, sync).
- `src/main/queries/variant.ts`, `src/shared/schemas/queries/variant.ts` (`VariantGet`) — P7-9, Phase 5 (out-of-date detail), Phase 6 (check result).
- `src/main/queries/campaign-reads.ts` (`badgesOf`) — P7-9 (clips in `missingFile`), Phase 5 (computed badges), Phase 6.
- `src/shared/schemas/commands/generation.ts`, `src/shared/schemas/jobs/video-generation.ts` — P7-11, Phase 5 (`runFill`).
- `src/main/mcp/tools/run-tools.ts` — P7-11, P7-15.
- `src/main/thumbnails/scene-input.ts`, `service.ts` — P7-7, P7-8, P7-16.
- `src/shared/scene/scene.tsx`, `text-layer.tsx`, `picture-layer.tsx` — P7-7, P7-8.
- `src/renderer/editor/editor/editor.tsx`, `canvas-view/canvas-view.tsx`, `properties-panel/properties-panel.tsx`, `top-bar/top-bar.tsx`, `src/renderer/stores/variant-store.ts`, `src/renderer/ui/shortcuts.ts` — P7-17 to P7-21, Phases 5 and 6 (sync banner, translation fields).
- `src/main/assets/in-use.ts`, `src/main/assets/inspect.ts`, `src/main/assets/sniff.ts`, `src/shared/config/file-types.ts` — P7-5, P7-12.
- `src/main/index.ts` — P7-4 (one line); other phases' Electron-edge slices.
- `package.json` — P7-3 (one script line).

## Design additions

These fill gaps in the topic files. The orchestrator folds them in later; developers follow them now.

### fal.ai Seedance (P7-14, P7-15) [A-170 to A-174]

- **No client package** (OI-30, A-170). Four HTTPS calls through the adapter's own pinned `fetch` wrapper: submit `POST https://queue.fal.run/{endpoint}`, status `GET https://queue.fal.run/bytedance/seedance-2.0/requests/{id}/status`, result `GET .../requests/{id}`, cancel `PUT .../requests/{id}/cancel`. Header `Authorization: Key {key}`, sent to the queue host only. Status and result addresses are built by the adapter from the fixed owner and app and the request ID, never taken from an answer or a row. A request ID must match the UUID form before it is put in a path.
- **Two origins.** The queue origin `https://queue.fal.run` (key sent) and the media hosts, `https://` plus a host matching `^([a-z0-9-]+\.)*fal\.media$` (no key, no other header). Every other origin, every redirect and every `http:` address is refused before sending. The answer limit is `MAX_PROVIDER_ANSWER_BYTES` for JSON and `MAX_VIDEO_BYTES` for the download.
- **Endpoints by start** (A-172): a prompt start uses `bytedance/seedance-2.0/text-to-video`; a first-frame or background start `bytedance/seedance-2.0/image-to-video` (`image_url`); a reference start `bytedance/seedance-2.0/reference-to-video` (`image_urls`, at most 9). Body: `prompt`, `resolution: '720p'`, `duration` as whole seconds in a string (4 to 15), `aspect_ratio` the nearest of `21:9, 16:9, 4:3, 1:1, 3:4, 9:16` to the variant (ties to the wider), `generate_audio: true` (D-053 item 12; the price is the same with or without sound). The app's `<Picture n>` names in a reference prompt are written as `@Image{n}` for fal. The registry's `defaultModels.video` stays `bytedance/seedance-2.0/image-to-video`; the job row's `model` is the endpoint used.
- **Pictures as data addresses** (A-171): each picture is sent as `data:image/png;base64,...` in the JSON body. No fal upload call, no upload host. If the live run shows fal refuses data addresses, P7-24 stops and reports; the architect then adds the upload call.
- **Status mapping:** `IN_QUEUE` is `waiting` with `queue_position`; `IN_PROGRESS` is `running`; `COMPLETED` with an `error` is `failed` (mapped like the error table); `COMPLETED` is `succeeded`. A `404` on status is `failed`, kind `other`, detail `unknown_request` (the job ends with nothing kept). The result answer must hold `video.url` on a media host; the file is downloaded, read under `MAX_VIDEO_BYTES`, and returned as bytes.
- **Cancel:** `200` is `stopped`; `400 ALREADY_COMPLETED` is `finished`; `202` and any other answer are `unknown`. The cancel call is sent only for a run still `waiting`: a started run is refused before by `cancel_would_still_charge` (P7-13).
- **Charges and resume** (U-25, A-173): status, result and media downloads are treated as free, so left-over fal rows are picked up on open. Only `start` goes through `jc.call`, so only the submit counts in `paid_calls`; a picked-up row adds nothing. A cancelled started request is treated as charged (OI-60 assumption stands).
- **Closing with a started fal run** (OI-51 for fal, A-174): the row is left `running` with its remote ID (P7-13), so the next open collects the clip.
- **Start kinds and lengths** live in one shared table, not a `VideoProvider` member (A-175): `src/shared/config/video-offers.ts`, `videoOffer(providerId)` gives `{ starts, minMs, maxMs, stepMs, maxReferences }` or null for ComfyUI (its workflows decide, as built). `fal-seedance`: all four starts, 4,000 to 15,000 ms, step 1,000, 9 references. `fake`: all four, 1,000 to 120,000, step 1,000, 4 references. The card reads it; `generation.startVideo` refuses outside it.

### The format switch and the start [A-176]

- `generation.startVideo` and `job.retry` refuse a variant whose format is `image`: `RULE_VIOLATION`, reason `video_needs_video_post`, "Change this post to video before making a clip for it."
- A new start `background`: the first frame is the variant's background layer drawn by the Scene at the run size (`RenderService.renderBackground`, P7-16), at job time, so a retry uses the background as it is then. The picture first-frame start stays. Refused before any job when the background layer has no `source`: reason `background_empty`, "This post has no background picture yet. Add one, or start from a prompt."
- A picture start on a provider whose offer lacks it: reason `video_start_not_offered`, "{Provider} cannot start a video this way." ComfyUI keeps its own refusals.
- `job.retry` runs the start pair and picture checks (checks 2 and 4) for every provider, not only ComfyUI, plus the offer and format checks.

### Clip facts, FFmpeg and the details [A-177 to A-179, A-189]

- Width, height and duration of a clip come from the app's own box reader, not FFmpeg (A-177). Generated clips: from `checkMp4`, written to the asset row by `asset.addGenerated`. Imported MP4 and MOV: `videoFileFacts(handle)` (P7-5) reads box headers and the `moov` box only (at most 32 MiB), with `checkMp4`'s limits on side and depth; it fills `width`, `height`, `duration_ms` at import, relink and the change check. An MP4 or MOV with no video track is refused at import (this also stops HEIC, AVIF and M4A files named `.mp4`). A row made before Phase 7 with no facts is read when `clip.add` needs them.
- WebM stays importable but is refused on the track: reason `clip_asset_not_usable` (A-178).
- **FFmpeg in Phase 7 only writes the details** into a generated clip: stream copy of video and sound, global `comment` from an ffmetadata file (not a command-line value, because of the Windows line limit). The details JSON is the one of `spec/export-and-checks.md`, "Embedded generation details", with `kind: "video_generation"`. The output must pass `checkMp4` with the same width, height, duration and `hasSound` as the input, else the original is kept. The job result says `details: 'embedded'`, or `'pending'` when no FFmpeg is present or the run failed (A-179); a `warn` line names the reason only.
- **Where FFmpeg comes from** (OI-09, A-189): Windows x64, a dated LGPL release of a public builder on GitHub, pinned by address and SHA-256. macOS arm64 and x64, built on this machine by the fetch script from the pinned FFmpeg release source archive (address and SHA-256 pinned), with fixed configure flags: `--disable-gpl --disable-nonfree --disable-network --disable-autodetect --disable-doc --disable-ffplay --disable-ffprobe --enable-videotoolbox`, plus the parts list of `spec/infra-and-settings.md`, "FFmpeg", and `ffmetadata` and `mov` demuxers, `mp4` and `mov` muxers, `file` and `pipe` protocols, and the few parts P7-3 adds to make test clips. Every binary must pass the licence check: `ffmpeg -hide_banner -L` names the GNU Lesser General Public License and `-buildconf` holds neither `--enable-gpl` nor `--enable-nonfree`; a binary that fails is deleted. Phase 11 moves the macOS build into the release pipeline.
- **How FFmpeg is run** (P7-4): `spawn(binary, args, { shell: false, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'], env: {}, cwd: runFolder })`. The binary path is fixed: `process.resourcesPath/ffmpeg/{platform}-{arch}/ffmpeg[.exe]` when packaged, `{appPath}/resources/ffmpeg/...` in development; it must be a regular file by `lstat`, not a link. Arguments come only from builder functions with fixed flags; every path is prefixed `file:`, each input gets `-protocol_whitelist file`, output uses `-n`. Every path is inside `{userData}/media-temp/run-{ULID}/`, made by the app, with fixed file names (`in.mp4`, `meta.txt`, `out.mp4`) written with `wx`; the folder is removed after the run, and left-over `run-*` folders (real folders, not links) are removed at app start. One run at a time, 60 s limit then kill, standard error read up to 64 KiB and never logged or shown.

### Clips and the track [A-180 to A-183]

- **Commands** (all on the variant's undo list except `clip.addGenerated`; agent policy deny, as the table already has for three of them): `clip.add { variantId, assetId, startMs?, lengthMs? }`, `clip.update { clipId, startMs?, inMs?, outMs?, placement?, soundOn? }`, `clip.remove { clipId }`, `clip.reorder { variantId, clipIds }` (A-181: every clip of the variant, laid back to back from the earliest start in the given order, gaps closed), internal `clip.restore` (inverse of remove) and internal `clip.addGenerated { variantId, assetId }` (A-182).
- **Rules.** Whole milliseconds. `startMs >= 0`; `inMs >= 0`; `outMs - inMs >= 100`. A video clip's `outMs` is at most the asset's `duration_ms`: reason `clip_trim_out_of_range`, "That trim reaches past the end of the clip's file." Clips may not overlap, `[startMs, startMs + outMs - inMs)`: reason `clip_overlap`, "Clips on the track cannot overlap." A clip may run past the variant's end; the part past it is not drawn. A clip's asset is a picture (PNG, JPEG, WebP) or an MP4 or MOV video in the asset library, not missing: else `clip_asset_not_usable`, "Use a picture, or an MP4 or MOV video, from the assets library." A video whose facts cannot be read: `clip_video_unreadable`, "The app could not read this video's length."
- **Placement:** `startMs` left out means the first free position: the earliest time from 0 at which the clip's length fits without overlap. A still's default length is the time left to the variant's end, or 3,000 ms when none is left; a video's default is its whole file.
- `clip.addGenerated` runs from the video job through `jc.system` (ruled here: it writes only into the job's own project; the variant comes from the job row; the asset must be a generated video of that project). It is not an undo entry. A variant that is gone gives `{ clipId: null }`, never a refusal. A clip is added whatever the variant's format.
- **OI-20 settled** (A-180): `variant.first_clip_made` (0 or 1). `variant.setFormat` image to video creates the first clip only when it is 0, there are no clips and the background has a `source`; then sets it to 1. Any clip add sets it to 1. Undo of a change that made the clip removes it and sets it back to 0.
- **Sound** (A-184): `variant.sound` `'clips' | 'file' | 'none'` (default `'clips'`), `variant.sound_asset_id` (an audio asset or null), `background_clip.sound_on` (default 1). `variant.setSound { variantId, sound, assetId? }`: `'file'` needs an audio asset in the asset library (`sound_asset_not_audio`, "Choose an audio file (MP3, WAV, M4A or AAC) from the assets library."); leaving `'file'` keeps the asset ID. Agent deny. `asset.remove` is refused while a variant names it as its sound.
- **Video thumbnails** (A-183) are drawn at the poster time: the latest end of any entrance block, at most `duration_ms - 1`, or 0.
- **Drawing.** For a video variant the background layer's own `source` is not drawn; the clip under the time is, placed by `placePicture` with `cover` in the clip's `placement` or the background layer's geometry, with the background layer's opacity, fill colour and shade. No clip: black. Timing and presets apply only to video variants (A-188); an image variant draws every layer at its full state, as today.

### Presets [A-187]

`src/shared/scene/presets.ts`, pure. Entrance progress `p` runs 0 to 1 over the entrance block, exit progress over the exit block; `e(p) = 1 - (1 - p)^3` for an entrance and `p^3` for an exit. A layer is drawn while `timing.startMs <= t < (timing.endMs ?? durationMs)`.

| Preset | Entrance at `e` (exit uses `1 - e`) |
|--------|--------------------------------------|
| `none` | Full state |
| `fade` | opacity `e` |
| `fade-up` | opacity `e`, moved down by `(1 - e) × 5 %` of the variant height |
| `slide` | opacity `e`, moved left by `(1 - e) × 10 %` of the variant width |
| `stagger-words` | each word `i` of `n` (split on white space, kept in place with `position: relative` spans) fades up with its own progress `clamp((p - 0.5 × i / max(n - 1, 1)) / 0.5)` |

Movement uses `transform: translate(...)` on the box (a word span uses `top`), so the text layout and the overflow measure do not change.

## Assumptions

| ID | Assumption | Undo |
|----|------------|------|
| A-170 | OI-30: no `@fal-ai/client`; four HTTPS calls through a pinned wrapper | Easy |
| A-171 | fal pictures go as base64 data addresses, no upload host | Easy |
| A-172 | fal endpoint per start; 720p; nearest ratio; 4 to 15 s; sound on | Easy |
| A-173 | fal status, result and download calls are free; fal rows are resumed; only submit counts | Easy |
| A-174 | Close or quit with a started fal run leaves the row running for the next open | Some rework |
| A-175 | Start kinds and lengths in one shared table, not a provider member | Easy |
| A-176 | New `background` start, drawn at job time; picture first frame kept | Easy |
| A-177 | Clip facts from the app's box reader; FFmpeg only writes details in Phase 7 | Easy |
| A-178 | WebM refused on the track in Phase 7 | Easy |
| A-179 | No FFmpeg: the clip is stored with `details: 'pending'`, no failure | Easy |
| A-180 | OI-20: `variant.first_clip_made`; any clip add sets it | Hard once released |
| A-181 | `clip.reorder` lays clips back to back from the earliest start | Easy |
| A-182 | A generated clip is added by internal `clip.addGenerated`, not an undo entry | Easy |
| A-183 | A video thumbnail is drawn at the end of the last entrance | Easy |
| A-184 | Sound fields as above; setting the sound is denied to agents, like clips | Some rework |
| A-185 | Audio import checks the signature only and reads no duration | Easy |
| A-186 | Duration 500 to 86,400,000 ms (a number guard; FR-120 has no maximum); a non-master's duration edit sets `duration_overridden` | Easy |
| A-187 | Preset easing and distances as in the table | Easy (reference pictures change) |
| A-188 | Timing and presets are drawn for video variants only | Easy |
| A-189 | OI-09 sources: Windows from a public LGPL builder, macOS built here from source, both licence-checked (agreed by the stakeholder) | Settled |

## Open questions (the plan proceeds on the recommendation)

1. **OI-09, the FFmpeg sources.** Settled: the stakeholder agreed to A-189.
2. **FR-291, a temporary place for video files.** The requirement is about the ComfyUI server's disk; ComfyUI has no call to delete an output. Recommendation: not in Phase 7. A later ComfyUI pass tries saving clips to the server's temporary output folder, proven on the stakeholder's server. Phase 7's own run folder (`media-temp`) covers the app's side.
3. **Slices US (usage and cost, OI-52), OA (OpenAI pictures, OI-53) and cut-out through fal (FR-307, OI-55).** Not sliced here: each needs its own design pass. Recommendation: three small plans after P7-15, outside Phase 7's exit.
4. **A `<video>` frame in the hidden render window.** It is not proven that `capturePage()` of an offscreen window holds video frames. P7-8 checks it first. Recommendation if it fails: thumbnails and `variant.render` draw a video clip as black with a log line, and Phase 8 export is unaffected (it builds the background with FFmpeg, ADR-006).
5. **Agents and clips.** Clip commands and `variant.setSound` stay denied to agents. Recommendation: revisit with Phase 10's tools.
6. **OI-51 for Gemini** is unchanged by A-174.

## Found in the existing design

- The outline said a clip with sound is refused (`clip_has_sound`); the code keeps sound, and the sentence and reason are unused. P7-16 removes both.
- `spec/infra-and-settings.md` says the FFmpeg source is decided in Phase 8; the outline and OI-09 say Phase 7. This plan: Phase 7 (P7-3), packaging Phase 11.
- `spec/providers-adapters.md` says fal goes through `@fal-ai/client`, is built "only if OI-30 is yes", polls every 5 s and uploads pictures to fal storage. D-045 answered OI-30 long ago; the code polls every 2 s. This plan: A-170, A-171, the 2 s poll.
- `spec/jobs.md` and `spec/assets.md` say FFmpeg fills a clip's width and height; `checkMp4` already reads them (A-177).
- `spec/export-and-checks.md` puts the details on the command line (`-metadata comment=...`); this plan uses an ffmetadata file.
- The registry's default model (image-to-video) needs a start picture; a prompt start needs the text-to-video endpoint (A-172).
- fal's shortest clip is 4 s; the card's default is 2 s, least 1 (the card follows the offer table, P7-22).
- FR-132 ("All video is silent") conflicts with the sound decisions (D-053); known, settled for export in Phase 8.
- The FFmpeg parts list in `spec/infra-and-settings.md` lacks the `ffmetadata` demuxer and the protocols the embed needs.

# Phase 7: slices P7-14 to P7-24

Rules, exit criteria, the wave table and the design additions: `spec/phases/phase-07.md`. Slices P7-1 to P7-13: `spec/phases/phase-07-slices.md`.

### P7-14 — The fal.ai Seedance adapter (built)

- **Exists when done:** `src/main/providers/fal-seedance/` implements `VideoProvider` (`start`, `check`, `fetchResult`, `cancel`) as `phase-07.md`, "fal.ai Seedance", says, tested on recorded answers. The registry row stays `available: false` (P7-15 turns it on).
- **New files:** in `src/main/providers/fal-seedance/`: `index.ts` (`adapters.video`), `video.ts`, `fal-fetch.ts` (the pinned wrapper: two origins, the key only to the queue origin, no redirect, `http:` refused, limits), `origins.ts` (the two constants), `endpoints.ts` (the start to endpoint table, the body builder, the nearest ratio, the duration string, the `@Image{n}` names), `status.ts` (the status and cancel tables), `failure.ts` (the error table of `spec/providers-adapters.md`); `src/main/providers/read-limited.ts` (`readLimited`, moved from the Gemini wrapper, unchanged).
- **May touch:** `src/main/providers/gemini/pinned-origin.ts` (imports `readLimited`; no change of behaviour; its tests pass unchanged). The adapter factory takes an optional `fetch` for tests, defaulting to the global one.
- **Needs:** nothing.
- **Tests first** (recorded answers, no network), `tests/unit/main/providers/fal-seedance/`: `start.test.ts` (each start kind: endpoint, exact body, the key header to the queue origin only; data addresses; a signal fired before submit gives `ProviderCancelled` and sends nothing); `check.test.ts` (each status row; `404`); `fetch.test.ts` (the media host only and no `Authorization`; another host, a redirect and `http:` refused before sending; over `MAX_VIDEO_BYTES` stopped); `cancel.test.ts` (each answer row); `failure.test.ts` (one case per error kind; the key removed by `redactSecret` from every detail); `environment.test.ts` (`FAL_KEY` and proxy variables set to other values change nothing); `request-id.test.ts` (an ID that is not a UUID is refused before any request).
- **Exit check:** lint, typecheck, `npm test`.
- **Class:** E. **Security:** full (outbound calls, the key, a downloaded file). **Size:** medium.

### P7-15 — fal switched on

- **Exists when done:** `fal-seedance` is `available: true`; users can start fal video runs with the paid confirm; agents can, once ticked; the MCP start tool names it.
- **May touch:** `src/main/providers/registry.ts` (`available: true`; the comment); `src/main/mcp/tools/run-tools.ts` (the descriptions name `fal-seedance` and its lengths); approved test edits: the `app-state.test.ts` row becomes `['fal-seedance', true]`; `tests/integration/commands/agent-runs-settings.test.ts` ("gives agent_runs_not_offered for fal-seedance, S3 and Firefly" loses `fal-seedance`); the `fal-seedance` rows of `tests/integration/commands/agent-run-gate.test.ts`; approved addition to `tests/integration/mcp/secret-leak.test.ts` (plants `fal.apiKey`).
- **Needs:** P7-11 (the offer row), P7-13 (the cancel refusal), P7-14.
- **Tests first:** `tests/integration/generation/start-video-fal.test.ts` (with the adapter on recorded answers through the kind's `videoFor` option: a user start is enqueued, `paid_calls` is 1 after submit and stays 1 after the status calls; a picked-up row adds nothing; a cancel while waiting sends the queue cancel; a cancel while working is refused).
- **Exit check:** lint, typecheck, `npm test`, `npm run test:e2e`.
- **Class:** E + B. **Security:** full (opens a paid provider, and to agents). **Size:** small.

### P7-16 — The video job into the ad

- **Exists when done:** a finished run (new or picked up) stores the clip with its facts on the asset row and its details embedded, and adds it to the variant's track at the first free position; a `background` start draws the first frame from the variant's background.
- **New files:** `src/main/jobs/video-store.ts` (`stored()` moved out of `video-generation.ts`: `checkMp4`, the embed, `checkMp4` again and the facts compared, `storeResult` with the facts, then `clip.addGenerated` through `jc.system`); `src/main/jobs/background-frame.ts` (asks `deps.render.renderBackground`, then `fitPicture` to the run size; a failure is `LocalFailure` `background_not_drawn`).
- **May touch:** `src/main/jobs/kinds/video-generation.ts`; `src/main/jobs/store-result.ts` (passes `width`, `height`, `durationMs`); `src/main/jobs/local-failure.ts` and the failure-sentence owner (`background_not_drawn`, "The post's background could not be drawn for the first frame."); `src/shared/schemas/commands/asset.ts`, `src/main/commands/asset/add-generated.ts` (optional facts for a video); `src/main/thumbnails/types.ts`, `service.ts`, `scene-input.ts` (`renderBackground(project, variantId, size)`: the background layer and the clip track only, through the same queue, no file kept); `src/main/commands/generation/start-video.ts` (removes the P7-11 guard); `src/shared/providers/messages.ts`, `src/shared/schemas/queries/app.ts` (remove the unused `clip_has_sound`).
- **The details** embedded are those of `spec/export-and-checks.md`, "Embedded generation details", with `kind: "video_generation"`; for ComfyUI `models` and `workflow` as for PNG.
- **Needs:** P7-4, P7-8, P7-9, P7-11.
- **Tests first:** `tests/integration/generation/video-into-track.test.ts` (fake provider: the clip lands at the first free position; a variant that became an image still gets it; a deleted variant keeps the asset with `clipId: null`; a picked-up row adds the clip; the asset row has the facts; `details: 'embedded'` with a stand-in media tool and `'pending'` with `noMediaTool`; a stand-in that returns changed facts keeps the original); `tests/integration/generation/video-background-start.test.ts` (a stand-in `renderBackground` is called with the run size; its failure ends the job with `background_not_drawn`); approved edits to existing video job tests whose result shape gains `clipId` and `details`.
- **Exit check:** lint, typecheck, `npm test`.
- **Class:** B + E. **Security:** short (`jc.system` with a new command; files written). **Size:** medium to large; if large, hand off after the store part.

### P7-17 — Format and duration controls

- **Exists when done:** the editor's top bar has a format choice and, for a video, a length field.
- **New files:** `src/renderer/editor/format-fields/` (`format-fields.tsx`, its CSS module, its test): a radio group "Format" with "Image" and "Video" sending `variant.setFormat`; for a video, "Length (seconds)", a number field with one decimal, 0.5 to 86,400, sending `variant.update { durationMs }` on Enter or leaving the field, Escape puts the stored value back. A refusal shows its sentence under the controls (`role="alert"`) and the controls keep the stored values.
- **May touch:** `src/renderer/editor/top-bar/top-bar.tsx` (the mount, a few lines).
- **Needs:** P7-10.
- **Tests first:** component and accessibility tests (names, keyboard, the refusal line); `tests/e2e/format-switch.spec.ts` (switch to video and back; the grid refusal shown).
- **Shots:** `tests/shots/p7-17.shots.ts`: 220 (image variant), 221 (video variant with length).
- **Exit check:** lint, typecheck, the component tests, `npm run test:e2e`.
- **Class:** D. **Security:** none. **Size:** small.

### P7-18 — Timeline frame and playback

- **Exists when done:** a video variant's editor has a timeline row along the foot with a ruler, one row per layer (names only), a background row, a playhead, play, pause and scrub, and the canvas draws the Scene at the playhead's time. An image variant shows no timeline.
- **New files:** `src/renderer/stores/playback-store.ts` (per variant tab: `timeMs`, `playing`; one `requestAnimationFrame` loop while playing; stops at the end; a clock passed in for tests); folders under `src/renderer/editor/`: `timeline/` (the row and its grid), `time-ruler/` (seconds marks; a press or drag scrubs), `playhead/`, `transport-bar/` (a button "Play" or "Pause" by state; the time as `m:ss.s / m:ss.s`); stub folders replaced later: `layer-tracks/` (one row per layer, its name only), `clip-track/` (one row named "Background"), `sound-fields/` (renders nothing).
- **May touch:** `src/renderer/editor/editor/editor.tsx` and its CSS module (the timeline row, sizes from existing tokens); `src/renderer/editor/canvas-view/canvas-view.tsx` (passes `timeMs`, `playing`, `clips` when the store has them, and `sound` to the Scene); `src/renderer/ui/shortcuts.ts` (`Space` plays or pauses when focus is on the timeline or the canvas, never in a text field).
- **Needs:** P7-1.
- **Tests first:** `tests/unit/renderer/stores/playback-store.test.ts` (a stand-in clock: play advances, pause holds, the end stops, scrub sets); component tests for each folder; `tests/e2e/timeline-playback.spec.ts` (play moves the playhead, pause stops it, a drag on the ruler sets the time, `Space`).
- **Shots:** `tests/shots/p7-18.shots.ts`: 222 (timeline at 0), 223 (playing), 224 (scrubbed to the middle).
- **Exit check:** lint, typecheck, component tests, `npm run test:e2e`.
- **Class:** D. **Security:** none. **Size:** medium.

### P7-19 — Layer tracks and animation blocks

- **Exists when done:** each layer's row shows its timing bar, and a text layer's row its entrance and exit blocks; bars and blocks move and resize; text layers choose entrance and exit presets.
- **New files:** `src/renderer/editor/timeline-math/timeline-math.ts` (pure: pixels to milliseconds, snapping to 100 ms and to the playhead); `timing-bar/` (drag to move, its ends to resize; `layer.update { timing }` once at the end of a drag; a null end drawn to the variant's end); `animation-block/` (entrance and exit blocks inside the bar, moved and resized the same way, `layer.update { animation }`; arrow keys move 100 ms, with Shift 1 s); `animation-fields/` (in the properties panel of a text layer: "Entrance" and "Exit", each a preset select "None", "Fade", "Fade up", "Slide", "Words one by one", and a length in seconds); the body of `layer-tracks/`.
- **May touch:** `src/renderer/editor/properties-panel/properties-panel.tsx` (the mount for text layers, a few lines).
- **Needs:** P7-18.
- **Tests first:** `tests/unit/renderer/editor/timeline-math.test.ts` (table); component tests (keyboard moves, names "Timing of {layer}", "Entrance of {layer}", "Exit of {layer}"); `tests/e2e/timeline-layers.spec.ts` (drag a bar, resize a block, choose a preset; the Scene at a time shows it; one undo step per drag).
- **Shots:** `tests/shots/p7-19.shots.ts`: 225 to 228 (bars, blocks, preset fields, a drag).
- **Exit check:** lint, typecheck, component tests, `npm run test:e2e`.
- **Class:** D. **Security:** none. **Size:** medium.

### P7-20 — The clip track

- **Exists when done:** the background row shows the clips as blocks; they can be added, moved, trimmed at either end, reordered by dragging past another, removed, and a video clip's sound switched on and off.
- **New files:** `src/renderer/editor/clip-block/` (move, trim handles, "Remove" and the Delete key, "Sound" on and off for a video clip; a drag judged by `src/shared/clips/track.ts` before sending, and a drag that would overlap snaps back); `add-clip/` (a button "Add clip…" listing the asset library's pictures and MP4 and MOV videos, with "Import…" through the existing import flow); the body of `clip-track/` (gaps drawn as empty track; a refusal sentence under the row with `role="alert"`).
- **May touch:** `src/renderer/stores/variant-store.ts` (holds `clips` from `variant.get`; applies `background_clip` rows and removed IDs from `project.changed`).
- **Needs:** P7-18, P7-9.
- **Tests first:** component tests (names "Clip {n}: {display name}", keyboard move and trim, the refusal line); `tests/e2e/timeline-clips.spec.ts` (add `tiny.mp4`, add a still, move, trim, reorder, remove, undo).
- **Shots:** `tests/shots/p7-20.shots.ts`: 229 to 233 (empty track, two clips with a gap, a trim, the add list, a refusal).
- **Exit check:** lint, typecheck, component tests, `npm run test:e2e`.
- **Class:** D. **Security:** none. **Size:** medium.

### P7-21 — Sound controls and preview

- **Exists when done:** the transport bar has a "Sound" choice ("The clips' own sound", "An audio file", "None") and an audio file picker; the preview plays the chosen sound in time with the playhead.
- **New files:** the body of `src/renderer/editor/sound-fields/` (sends `variant.setSound`; the audio list from the asset library, kind `audio`, with "Add audio…" through import); `src/renderer/editor/sound-player/` (one `<audio>` for `'file'`, kept to the playback time, started at 0 and stopped at the variant's end; with `'clips'` the Scene gets `sound` true; with `'none'` nothing plays).
- **May touch:** nothing beyond its folders (P7-18 left the mount).
- **Needs:** P7-18, P7-12, P7-6, P7-20.
- **Tests first:** component tests; `tests/e2e/timeline-sound.spec.ts` (each choice: which element is unmuted; the `<audio>` time follows a scrub; pause stops it).
- **Shots:** `tests/shots/p7-21.shots.ts`: 234 to 236.
- **Exit check:** lint, typecheck, component tests, `npm run test:e2e`.
- **Class:** D. **Security:** none. **Size:** small.

### P7-22 — The "Make a video" card

- **Exists when done:** the card offers the starts and lengths of the chosen provider's offer (ComfyUI as built), the new start "The post's background" (the default when the background has a picture), up to the offer's reference count, and for an image variant the line "Change this post to video first." with "Start" disabled.
- **May touch:** `src/renderer/screens/campaign/video-panel/video-panel.tsx` and its CSS module; `src/renderer/screens/campaign/video-picture-choice/` (hidden for the background start). Approved edits to the existing video card tests and e2e for the new start and lengths.
- **Needs:** P7-11.
- **Tests first:** component tests (fake and a stand-in fal offer: the starts shown, the length bounds, the default length `max(2 s, min)`, the image-variant line).
- **Shots:** `tests/shots/p7-22.shots.ts`: 237 to 239.
- **Exit check:** lint, typecheck, component tests, `npm run test:e2e`.
- **Class:** D. **Security:** none. **Size:** small.

### P7-23 — Video in fan-out

- **Exists when done:** fan-out's step 7 (`spec/data-rules.md`, "Fan-out") makes each new video variant's first clip with `addFirstClip`, which sets `first_clip_made`.
- **May touch:** the Phase 5 file that holds fan-out's steps (named by the Phase 5 plan), one call.
- **Needs:** Phase 5's `variant.fanOut` slice merged; P7-10.
- **Tests first:** `tests/integration/commands/fan-out-video.test.ts` (each new video variant has one clip from 0 to its duration from the background picture, and `firstClipMade` true; a background with no picture gives no clip; image variants get none; one undo removes the variants and their clips).
- **Exit check:** lint, typecheck, `npm test`.
- **Class:** B. **Security:** none. **Size:** small.

### P7-24 — End to end, shots, the paid run, exit check

- **Exists when done:** every exit criterion of `phase-07.md` is met and reported.
- **New files:** `tests/e2e/video-variant.spec.ts` (workflow 5.5, exit criterion 1); `tests/e2e/video-resume.spec.ts` (a fake run with a 10 s wait; the app process is ended while it works; a new launch opens the project; the clip lands on the track); `tests/live/seedance.live.test.ts` (one still to one MP4, 4 s, through the adapter with `resolution: '480p'` passed for the test only, into a temporary folder; prints the endpoint, the length and size returned, `hasSound`, the time taken; never the key or any address); `tests/shots/p7-24.shots.ts`: 240 to 249 (a video variant at three times; the run row of a fal run; the close warning for a started fal run; the whole editor with the timeline).
- **May touch:** test files only.
- **The paid run:** once, under D-085 and D-089, with the key the stakeholder set in the environment for `test:live`. Report OI-04's facts (lengths, sizes, sound, the price shown by fal if any). If fal refuses data addresses (A-171), stop and report. Ask the stakeholder to check his fal usage page for a status-call charge (A-173).
- **Exit check:** lint, typecheck, `npm test` (with `embed-real` not skipped), build, `test:build`, `npm run test:e2e`; `test:live -- seedance` once; `npm run shots` once. List Windows references and the Windows FFmpeg check as the stakeholder's (D-087).
- **Class:** all of the above. **Security:** none new. **Size:** medium.

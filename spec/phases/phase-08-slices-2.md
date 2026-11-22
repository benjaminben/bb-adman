# Phase 8 — slices P8-13 to P8-19

Late plug-ins, video, packaging and the end-to-end proof. Rules, order and the design: `spec/phases/phase-08.md` ("Rules for these slices", "Interfaces with other phases", "Design additions"). Slices P8-1 to P8-12: `spec/phases/phase-08-slices.md`.

### P8-13 — Checks and usage in the report (built: the checks part only; the part that needs slice US is not built)

- **Exists when done:** the export gate and the report use Phase 6's six checks; `checksRun` is true; the results are stored with `ranBy: 'export'`. If slice US is built, the report carries the campaign's usage with its estimated price.
- **New files:** the body of `src/main/export/checks-port.ts`; `tests/unit/main/export/check-types.test.ts` (compile-time: `CheckResult` and `ReportCheck` assignable both ways).
- **May touch:** `src/shared/schemas/report.ts` (one optional `usage` field, only with US); `src/main/export/report/facts.ts`, `build.ts`, `html-parts.ts`, `src/renderer/dialogs/report-view/report-summary.tsx` (the usage line, only with US).
- **Needs:** P8-9; Phase 6's check engine merged (name: open question 2). The usage part needs slice US merged; each part may be done alone when its need is met.
- **Read:** `spec/export-and-checks.md` "Checks"; Phase 6's check files as built; slice US's design.
- **Tests first:** `tests/integration/export/export-checks.test.ts` (a rule set that makes `prohibited-words` warn: `export.run` refuses with `export_has_warnings` naming that check; with proceed, the report lists the warning with `seenBeforeExport: true`, the who, when and reason; `variant_check` holds `ran_by` `export` and the drawn `rev`; a variant edited between the gate and the job to add a warning shows `seenBeforeExport: false`); with US, one case for the usage line.
- **Exit check:** class B checks.
- **Class:** B. **Security:** none. **Size:** small.

### P8-14 — Video frames (built)

- **Exists when done:** the frame plan and the frame pipe: frame count, frame times, frames written in order to an encoder's input with back-pressure, cancel between frames. The two named tests [REQ: FR-131].
- **New files:** `src/shared/export/frames.ts` (`frameCount(durationMs, fps)`, `frameTimeMs(i, fps)`, pure); `src/main/export/video/frame-pipe.ts` (`pipeFrames({ count, draw(i), sameAsPrevious(i), sink, signal })`; `sameAsPrevious` defaults to always false until P8-17); `src/main/export/video/encoder-process.ts` (the `EncoderProcess` type: `stdin`, `done`, `kill`; no spawn here).
- **Needs:** P8-1. Uses `drawFull` through a fake in unit tests.
- **End-to-end case moved:** `tests/e2e/export-frames.spec.ts` belongs to P8-19, which reaches `drawFull` through a real export (no test hook into the main process, `phase-08.md` "Rules for these slices").
- **Read:** `spec/export-and-checks.md` "Video variant" steps 1 to 3; `spec/phases/phase-08.md` "Drawing at full size".
- **Tests first:** `tests/unit/shared/export/frames.test.ts` (table: 0 ms → 0 frames; 1,000 ms at 30 → 30; 1,001 ms at 30 → 31; 15,000 ms at 60 → 900; frame 7 at 30 is 233.33… ms; never reads a clock); `tests/unit/main/export/video/frame-pipe.test.ts` (a fake sink that is slow: no more than one frame waits; frames arrive in order; `sameAsPrevious` true sends the earlier bytes again without a draw; abort stops before the next draw and kills the process); named `tests/integration/export/frame-count.test.ts` (a fixed 2,000 ms variant at 30 fps through the pipe into a counting sink: exactly 60 PNGs).
- **Exit check:** class A and C checks.
- **Class:** A + C. **Security:** none. **Size:** medium.

### P8-15 — FFmpeg arguments (built)

- **Exists when done:** pure builders for the whole FFmpeg argument list of a video ad and of the report still, from the variant, its clips and the platform.
- **New files:** `src/main/export/video/filter-graph.ts` (black base, each clip cut to its time range with `trim`, scaled and cropped from `background-placement.ts`, overlaid, then the frame stream on top; `assertSafeGraph` checks the graph); `src/main/export/video/encoder-args.ts` (inputs with `-protocol_whitelist file,pipe`, one pinned demuxer per file type and `file:` paths; the encoder table; `-pix_fmt yuv420p -r {fps} -movflags +faststart`, `-an`); `src/main/export/video/still-args.ts`.
- **Clip timing by input options, not `setpts`.** Each clip is moved to its place on the track by options on its own input: `-t` (its length) and `-itsoffset` (its start); a video clip also gets `-ss` (its in point); a still gets `-pattern_type none -loop 1 -framerate {fps}` so it is looped for its length. A `setpts` expression or an `enable=` option would need characters the graph's character rule refuses. The first real FFmpeg run (P8-16) proves the timing.
- **Needs:** P8-1. The `background_clip` table and `background-placement.ts` are built. Sound mapping is P8-17.
- **Read:** `spec/export-and-checks.md` "Video variant"; `spec/data-model-campaign.md` "background_clip"; `spec/phases/phase-08.md` "Video".
- **Tests first:** `tests/unit/main/export/video/filter-graph.test.ts` (table: no clip → black only; one video clip with trim; a still for 3 s; two clips with a gap; a clip with its own placement; every graph passes the allowed-character rule and holds no `movie` or `amovie`); `tests/unit/main/export/video/encoder-args.test.ts` (macOS and Windows encoders; any other platform throws the sentence; every input path starts with `file:` and follows `-protocol_whitelist file,pipe`; a path starting with `-` or holding `:` or `|` stays one argument; the output is the work file, never a path outside the work folder).
- **Exit check:** class A checks.
- **Class:** A. **Security:** short (builds a command line from project data; the full review is P8-16's). **Size:** medium.

### P8-16 — Video export in the job (built)

- **As built:** there is no `spawn-ffmpeg.ts`. FFmpeg is run through one runner only, `src/main/media/run-ffmpeg.ts` (Phase 7's reviewed runner), which this slice extended to feed frames on stdin; no other file spawns FFmpeg. A bad clip row fails that ad. A gap between clips is black in the MP4, as in the editor. The four lows of its review are in P8-17.

- **Exists when done:** a video ad exports to MP4 through FFmpeg: work folder, spawn, frame pipe, copy into the output folder through the target, the report still; the work folder is cleaned at the end and at app start.
- **New files:** the body of `src/main/export/video-port.ts`; `src/main/export/video/video-ad.ts`; `src/main/export/video/spawn-ffmpeg.ts` (`child_process.spawn` with an argument array, `shell: false`, `windowsHide: true`, stdin for frames, stderr kept to 64 KiB and never logged as text); `src/main/export/video/work-dir.ts` (make, check, remove; `cleanLeftovers(userDataDir)`); `src/main/export/video/still.ts`.
- **May touch:** `src/main/index.ts` (call `cleanLeftovers` once at start, one line), only if Phase 7 has no start-up hook to add it to.
- **Needs:** P8-6, P8-14, P8-15; Phase 7's FFmpeg locator and the fetched binary on the developer's machine; Phase 7's clip commands (to make clips in tests).
- **Read:** `spec/phases/phase-08.md` "Video", "Export run"; `spec/export-and-checks.md` "Video variant"; Phase 7's FFmpeg files as built; `spec/phases/phase-07.md` "How FFmpeg is run" (its rules for later FFmpeg slices apply here); `spec/security.md`.
- **Clip rows are checked again** (from the P7-9 review): the export checks every `background_clip` row when it reads it, with the same bounds as the clip commands (rows from a project file never passed the commands); it measures stills itself rather than trusting stored sizes; it clamps and rounds placement numbers before they reach a filter graph.
- **Tests first:** `tests/unit/main/export/video/work-dir.test.ts` (a job ID that is not a ULID is refused; a link at `export-work` is refused; clean-up removes only `export-work/{ULID}` folders); `tests/integration/export/video-export.test.ts` (with the real binary, skipped with "FFmpeg is not fetched." when absent: a 2 s variant with one still clip exports one MP4 at the layout's name; the named frame count is read back from the file and equals 60; FFmpeg's exit other than 0 fails that ad with "The video could not be made." and leaves no `.partial` and no work folder; cancel mid-way kills the process, removes the work folder; the report still is a JPEG; no FFmpeg argument holds the output folder); `tests/integration/export/ffmpeg-no-network.test.ts` (an asset whose stored path is `http://127.0.0.1:{port}/x.mp4` or `concat:a|b`: the ad fails as a missing file and the local listener gets no request).
- **Exit check:** class C and B checks; the integration file run with the binary present, and its output named in the report.
- **Class:** C + B. **Security:** full (spawns a process with project-supplied file paths). **Size:** large: if it nears the budget, hand off after the work folder and spawn, leaving the still for a fresh run.

### P8-17 — Video after Phase 7 (built)

- **As built:** sound is encoded by FFmpeg's own `aac` at 192k and mixed with `adelay` and `amix` only. The overlay-only draw of the background's shade is `ShadeOnly` in `src/shared/scene/scene.tsx`; it draws only where a clip covers the time, so frame reuse also redraws at a clip's start and end. A clip's picture and sound share one demuxer table, `src/main/export/video/clip-demuxers.ts`.

- **Exists when done:** frames that do not change are sent again without a draw; text over a clip keeps the background's shade; the variant's one sound source goes into the MP4.
- **New files:** `src/main/export/video/frame-reuse.ts` (from Phase 7's timing functions: no animation running and no layer starting or ending between two frame times); `src/main/export/video/sound-args.ts`.
- **May touch:** `src/shared/scene/` (the one file that draws the background in `overlay-only`, to keep its shade, A-202; name it in the report); `src/main/export/video/encoder-args.ts` (map the chosen sound source or `-an`); `tests/e2e/scene-cases.ts` (one case `overlay-only-shade`, with its new reference).
- **Needs:** P8-16; Phase 7's Scene time, presets, clip and sound data merged. CQ-32 is ruled: the MP4 carries the one sound source the editor plays (the clips' own sound, the chosen audio file, or none).
- **Sound rules:** each audio input gets the `file` protocol whitelist, a pinned `-f` and a copied file; no `amovie` or `concat`; `amix` and `adelay` take numbers only; `assertSafeGraph` stays; frames are never reused from a clip.
- **Also in this slice** (P8-16 review lows): a real hostile MOV with a `url ` data reference (a loopback listener and a marker file) in `ffmpeg-no-network.test.ts`; the work-folder base name typed as the two constants; the timer limit capped with `Math.min(limit, 2 ** 31 - 1)` in `video-ad.ts`; a rejected promise, not a throw, when the spawn throws at once in `run-ffmpeg.ts`.
- **Read:** `spec/export-and-checks.md` "Video variant" step 2, "Sound in export"; `spec/scene.md` "Left for later phases" (the shade note); Phase 7's timing and sound files as built.
- **Tests first:** `tests/unit/main/export/video/frame-reuse.test.ts` (table: still layers → reuse; a preset running → draw; a layer starting at that frame → draw); `tests/unit/main/export/video/sound-args.test.ts` (none → `-an`; the clips' sound → the clip's audio mapped; an added file → its audio, cut at the end with `-t`); the `overlay-only-shade` reference case; the named frame-count test still passes with reuse on.
- **Exit check:** class C checks.
- **Class:** C. **Security:** short (an added audio file is one more FFmpeg input; same `file:` rule). **Size:** medium.

### P8-18 — Packaging FFmpeg and the notices (built)

- **Exists when done:** the packaged app carries `resources/ffmpeg/{platform}-{arch}/ffmpeg[.exe]` and finds it; `THIRD-PARTY-NOTICES.md` has the FFmpeg part (LGPL text, the exact build flags, the source link).
- **New files:** `THIRD-PARTY-NOTICES.md` if Phase 11 has not made it (FFmpeg part only); `tests/unit/config/ffmpeg-packaging.test.ts`.
- **May touch:** `electron-builder.json` (`extraResources` for the platform's folder only); Phase 7's locator file (the packaged path, `process.resourcesPath`), if it lacks it.
- **Needs:** Phase 7's fetch script; OI-09 answered (open question 1).
- **Read:** `spec/infra-and-settings.md` "Release and packaging", "FFmpeg"; Phase 7's fetch script.
- **Tests first:** the packaging test (the `extraResources` entry names only `resources/ffmpeg/${platform}-${arch}`; the locator gives the packaged path when packaged and the development path otherwise; the notices file holds the flags from `ffmpeg-sources.json`).
- **Exit check:** lint, typecheck, unit tests, `test:build`; one local `electron-builder --dir` run for macOS that finds the binary, named in the report. Nothing is published.
- **Class:** F (local part only). **Security:** short (a binary shipped and run). **Size:** small.

### P8-19 — End-to-end proof, shots, exit check (built)

- **As built:** the five end-to-end files share `tests/e2e/export-steps.ts`. `offline-export.spec.ts` turns the network off from the test process only: every session is set offline and any request it still makes is cancelled and counted; the main process's `fetch` fails and counts; a socket to any host but this computer is refused and counted. The test first proves the guard catches a fetch and a socket, then asserts the count stays empty.

- **Exists when done:** the workflows run through the screens; the exit criteria in `spec/phases/phase-08.md` are met and listed with their proof.
- **New files:** `tests/e2e/export.spec.ts` (load `examples/brief.yaml`, make the campaign with the fake provider, open Export, choose a temporary folder, export everything; the folder holds exactly the layout's files; the report row and both report files exist; export again after editing one ad: the second report marks that ad changed and the others not changed; the export number is 2); `tests/e2e/export-warnings.spec.ts` (a prohibited word: the warnings step, a reason, "Export anyway"; the report shows the reason); named `tests/e2e/offline-export.spec.ts` (no secret saved, the network turned off for the app's session: import, a hand layout, an image export all succeed) [REQ: 8.2]; named `tests/e2e/export-picture.spec.ts` (from P8-4: through the real export, `export.run` sent from `window.api` with a temporary output folder, wait for the job, read the PNG written: the `transparent-hole` scene matches its scene reference [REQ: FR-245]; the PNG has no `generation` chunk [REQ: FR-068], read with `tests/fixtures/png-chunks.ts`; a variant wider than 2,048, 3,000 × 1,000, comes out at exactly that size); named `tests/e2e/export-frames.spec.ts` (from P8-14: the same frame drawn twice gives identical bytes, checked through a real video export once P8-16 is merged); `tests/shots/p8-19.shots.ts` (shots `257-report-html` of the HTML file in a hidden window, `258-video-export-done`).
- **May touch:** `examples/` only if the example brief cannot make the campaign (stop and report first).
- **Needs:** every other P8 slice.
- **Read:** `spec/phases/phase-08.md` (exit criteria); `spec/test-harnesses.md`.
- **Tests first:** the five e2e files above. Each reaches the app only through `window.api` and the screens: no test hook or new entry into the main process (`phase-08.md`, "Rules for these slices"). No paid run: Phase 8 adds no paid feature.
- **Exit check:** lint, typecheck, `npm test`, build, `test:build`, `npm run test:e2e`; the list of Windows checks left for the stakeholder (D-087): the reference pictures, `h264_mf`, the packaged binary.
- **Class:** C + D + G. **Security:** none (tests only). **Size:** medium.

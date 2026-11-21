# Phase 2 leftovers

Every piece of Phase 2 work that is not on `main`, in a proposed build order. Group 1 (renderer layout and the styling source) is built. Group 3 (agents generate through the MCP server) is built; its one hand run on the real server, and one change that waits on OI-90, are in `spec/phases/phase-02-agent-generation.md`. Groups 4 and 5 (the Phase 2 screens) are in `spec/phases/phase-02-screens.md`.

`[UI]` work is built now, with its logic (D-084). Every screen follows the renderer layout rule in `spec/structure.md` and takes all styling from the shared tokens.

Work that belongs with a later phase is in that phase's file: Dropbox (slice G) in Phase 9; the fal.ai Seedance adapter (slice J) in Phase 7; extending a background (CU-8 and the extend job) in Phase 5; the remaining MCP tools, bridge mode and the ask flow in Phase 10.

## Group 2 — Small fixes and helpers

### "After the test" list

One short run in the main folder, class B, unless an item says otherwise. State is as checked on `main`. F-1 to F-7, F-10 to F-12 and F-14 to F-17 are built.

- **F-8. A limit on reference pictures per run.** Not built.
  - One constant `MAX_REFERENCES_PER_RUN` in `src/shared/config/defaults.ts`, used by the `generation.runImages` schema, the job request schema and the picker. A duplicate ID in the list is refused. One test each.
  - The number is 8 (A-56), until a real Gemini test shows a different limit. It also closes the security review's note that `referenceAssetIds` had no upper bound for an agent.
- **F-9. `toPng` on a reference before a ComfyUI upload.** Ruled yes (A-55): built with slice WP, in `readPicture`, for every provider.
  - Whether a reference picture passes through `toPng` before upload, so the bytes match the `.png` name and nothing the user's file carries beside the picture is sent. It needs `toPng` reachable from `AdapterContext`, which it is not today.
  - Also covers a JPEG named `.png` that `LoadImage` fails on. The JPEG pass of the ComfyUI harness waits for it.
- **F-18. Stand-in fixtures from the real server.** Tests only. Partly done.
  - After real ComfyUI runs, correct CU-4's hand-made stand-in fixtures to the shapes the real server showed. The Flux run showed the picture history shape holds. Still to check: the job-state status words and the video history entry, after a real video run.
  - If a real shape breaks a client schema, stop and report: that is a client change, ruled on its own.

### EXIF rotation fix (only if needed)

- Whoever runs the real first-frame video case (`ADMAN_E2E_VIDEO_FRAME=1`) reports whether the clip starts upright. The stakeholder checks again in his first app run from a phone photograph.
- Only if a real photograph comes out turned: a **security-class** fix in `src/main/picture-fitter.ts` turns it upright from its orientation tag before the crop, with one test.

### Slice WP — WebP converted to PNG

- **Class:** A, B, G. **Security class.** [REQ: FR-298, FR-051, FR-245; D-053 item 20]
- **When:** not beside another run that edits `src/main/core.ts`, `core-deps.ts` or `src/main/index.ts`.
- **Rule:** a picture is never refused only because it is WebP. Import, showing, placing and export need nothing new. A conversion happens only where the main process hands picture bytes on (a reference picture, a first frame, an extend source): the provider and workflow always get a PNG. The user's file is never changed.
- **Must build:**
  - `CoreDeps.webpToPng(bytes: Uint8Array): Promise<Uint8Array>`. The default throws (like `fitPicture`). `src/main/index.ts` fills it. Approved edit to the frozen `core-deps.ts`.
  - `webpInfo(bytes): { width; height; animated }` in `src/main/providers/webp-size.ts`. Pure: it reads the RIFF header and the first chunk (`VP8 `, `VP8L`, `VP8X`) and throws when it cannot. Limits `MAX_PICTURE_BYTES`, `MAX_PICTURE_SIDE` and `MAX_PICTURE_PIXELS` apply; a file over a limit never reaches the window.
  - After decoding, the result must be a PNG by `pictureType`, its header size must equal `webpInfo`'s, and it then goes through `toPng`. Transparency is kept.
  - Animated WebP: first frame only. The import notice is slice S2-17 (`spec/phases/phase-02-screens.md`); `webpInfo(...).animated` is its test.
  - Called in `readPicture` (`src/main/assets/read-picture.ts`): WebP by the `sniff.ts` signature, then check `webpInfo`, convert, and return `{ bytes, mime: 'image/png' }`. A failed conversion gives `asset_not_a_picture`; over the byte limit gives `asset_too_large`. No new reason.
  - **Decoder window:** one hidden window with the app window's `webPreferences` (`src/main/windows/app-window-options.ts`): sandbox on, context isolation on, no Node, no preload, a fixed bundled page, and a session that lets no request leave. One conversion at a time, a 10 s time limit; a crash or timeout is a failed conversion, and the window is made again on next use. Recommended: `createImageBitmap` on a `Blob`, draw to a canvas, read back a PNG. New files under `src/main/windows/`, each under 200 lines.
  - The main-process decoder (`toPng`, `src/main/png-converter.ts`) is still handed only PNG or JPEG.
- **Conditions checked first.** (1) `nativeImage.createFromBuffer` gives an empty image for WebP. (2) A hidden sandboxed window decodes still and animated WebP, and animated gives the first frame. (3) Up to `MAX_PICTURE_BYTES` goes in and a PNG comes out, without a channel the app window could also call. If any fails, stop; the architect rules.
- **Not chosen:** a decoder package; sending WebP as is to providers; the system's thumbnail maker.
- **Tests:**
  - Unit `webpInfo`: the three chunk kinds, the animation flag, a cut-off file, a RIFF size past the end, a zero side.
  - `readPicture` with a stand-in converter: WebP becomes PNG; a throwing converter gives `asset_not_a_picture`; pixels over the limit are refused and the converter is never called; a non-PNG or wrong-size PNG result is refused; PNG and JPEG never call it.
  - End-to-end (class G): a still and an animated WebP through the real window. The window-security test covers the new window.
  - Approved change: the existing test that a WebP reference is refused before any job row (commit 1882e20) now expects the run to be accepted.
- Until it merges, the WebP reference refusal stays as a stopgap.

### Hand-test file picker (slice I part 2, only if OI-64 keeps it)

- The text field "File to upload (full path)" in `src/renderer/dev/storage-actions/storage-actions.tsx` becomes a "Choose a file" button that calls `dialog.pickFiles` and sends the path it gives to `dev.storage`. `dev.storage` does not change.
- Whether slice I part 2 and CU-8 are still wanted is OI-64. The hand-test screen is removed in Phase 9 anyway.

### TP-2 end-to-end test

- `tests/e2e/test-path.spec.ts`: create a project, load `examples/brief.yaml` through the picker's test hook, create the campaign, run a picture. One short run, touching only `tests/e2e/`.
- First check whether `tests/e2e/comfy-stand-in.spec.ts` and `screen-tour.spec.ts` already cover these steps. If they do, drop this item and say so.

### ComfyUI follow-ups

- **F-19. An interrupted run marked `error`.** `endedEntry` in `src/main/providers/comfyui/run.ts` checks `status_str === 'error'` before it looks for an `execution_interrupted` message. If the real server marks an interrupted run `error`, a run stopped on the server ends `run_failed` instead of `server_stopped`. Fix: look for `execution_interrupted` first, with one test whose entry has `status_str: 'error'` and that message, for a picture run and a video run. Built with CU-5b, whose real cancel run shows what the server writes.
- **CU-5b, the rest of `test:comfy`.** Add the cancel case, the four-runs-at-once case, and anything else the real-server harness list (`spec/testing.md`) names that is not yet in `tests/comfy/`. Change the `hideAddress` printing in `tests/comfy/print.ts` to `cleanServerText`. The ruling on B-1 (single check items marked "could not check" instead of failing the whole check) is made with CU-5b, from what the real server showed. A names-only view of raw server answers (key names, never values) needs a change to the ComfyUI client and is **security class**.
- **The two real video runs.** The real end-to-end cases for video from a first-frame picture (`ADMAN_E2E_VIDEO_FRAME=1`) and from a reference picture (`ADMAN_E2E_VIDEO_REF=1`) each run once, one attempt each, no Retry. Each leaves one clip and one input file on the ComfyUI server. They prove the "Campaign · Make a video, from a picture" reach-table row. Not yet recorded as run.
- **After the first good real run of each workflow.** Fill `needs.checkedWith` with that run's server version (Flux: `flux3.ts` has `checkedWith: ''`; `common.ts` `needs()` writes `''`). G-16: if the printed version is below a `moss-*` or `h3-*` minimum while that workflow's nodes and models are all found, lower that minimum to the printed version (one line; today `0.42.0` and `0.43.0`).
- **Workflows to `proven`.** After the stakeholder accepts a `trial` workflow in the app, a one-line change sets `status: 'proven'` and records `needs.checkedWith`. No agent does this on its own. The four other workflows stay `draft` until their own data step. MOSS-Image is not installed on the test server yet; its trial waits, and `SFT` or `Base` is chosen with it (OI-34). The trials (`spec/comfyui-trials.md`), including four runs at once and the smallest and largest reference count per workflow, set `proven`.
- **ComfyUI time limits.** The waiting and working limits in `limits.ts` are provisional. If the measured video work time is over the video working limit (`VIDEO_WORK_MS`, 120 min today), set it to twice the measured time, rounded up to ten minutes. Not a protection.
- **Two-reference video.** `h3-reference-to-video` declares one reference. Two references need one real two-reference run first, then a ruling.
- **Splitting `comfy-stand-in.spec.ts`.** The next slice that adds a case to `tests/e2e/comfy-stand-in.spec.ts` splits it, for example into `comfy-stand-in-video.spec.ts`.

## Groups 4 and 5 — Phase 2 screens (slices S2-4 to S2-17)

In `spec/phases/phase-02-screens.md`.

## Phase 2 exit check

- **In CI (built):** the brief example, relink and package tests, and the fake-provider generation tests.
- **By hand, with real keys, by the stakeholder:** one Gemini picture generated and seen in the app; one file uploaded to, listed in and removed from a real S3 bucket. Dropbox follows with slice G and OI-18 (Phase 9). Live tests exist (`tests/live/gemini-image.live.test.ts`, `s3.live.test.ts`). Not recorded as done.

## Waiting on a ruling

Each is built only after its own ruling.

- A second Flux reference slot (`images.image1`; a guess, not shipped).
- A size the app sets for the Flux workflow (OI-77).
- The Flux prompt helper nodes (OI-78).
- Full sizes for H3 and MOSS: one line per workflow, by a ruling, after a small run worked.
- A generated result used as a reference; removing a reference from the project; a reference library screen.
- Asset questions with no design yet: OI-44 (a managed file to the system bin on `asset.remove`), OI-47 (remember outside assets folders the user chose; ask again for a foreign project), OI-49 (a first-bytes check in the asset protocol; what the change check stores).
- Stakeholder answers still open, no code until answered: the stricter project names (`LPT0` and similar), Q-032 sub-question 5 (a style note per direction), Q-039, Q-040, OI-64, OI-90.

## Not planned for this build

- **Custom workflows added by the user** (OI-57, D-058). Not designed. Known answers: a variable is marked by the step's title set in ComfyUI; an agent may run a listed custom workflow under the ComfyUI tick; pictures and video first, after the stock workflows pass on the test machine. CQ-38 was answered "treat workflows like assets which are external files", which differs from the recommendation and from FR-309 and FR-326. It needs its own ruling on the rule that the shipped workflows are the only ones the app can send, and on FR-278. Waits for the analyst's revision of the ComfyUI requirements.
- **Krea 2** (OI-58). Nothing built until MOSS-Image and MiniMax H3 pass their trials. Which jobs it gets is not decided.
- **An optional enlarging step for video** [REQ: FR-293]. Off unless the user turns it on. Waits for the stakeholder's hand test of `comfy-workflows/h3-video-first-frame-upscaled.json` (OI-59). Known from the draft: core nodes only (SeedVR2 3B); 1.5× gives 1152 × 2016, within `MAX_VIDEO_SIDE`; sound goes round the step. Not designed.

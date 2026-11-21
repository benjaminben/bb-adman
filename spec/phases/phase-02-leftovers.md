# Phase 2 leftovers

Every piece of Phase 2 work that is not on `main`, in a proposed build order. Group 1 (renderer layout and the styling source) is built. Group 3 (agents generate through the MCP server) is built; its one hand run on the real server, and one change that waits on OI-90, are in `spec/phases/phase-02-agent-generation.md`. Groups 4 and 5 (the Phase 2 screens) are in `spec/phases/phase-02-screens.md`.

`[UI]` work is built now, with its logic (D-084). Every screen follows the renderer layout rule in `spec/structure.md` and takes all styling from the shared tokens.

Work that belongs with a later phase is in that phase's file: Dropbox (slice G) in Phase 9; the fal.ai Seedance adapter (slice J) in Phase 7; extending a background (CU-8 and the extend job) in Phase 5; the remaining MCP tools, bridge mode and the ask flow in Phase 10.

## Group 2 — Small fixes and helpers

### "After the test" list

One short run in the main folder, class B, unless an item says otherwise. State is as checked on `main`. F-1 to F-12 and F-14 to F-17 are built.

- **F-8. A limit on reference pictures per run.** Built.
  - At most 8 pictures per run (A-56), until a real Gemini test shows a different limit: one constant `MAX_REFERENCES_PER_RUN` in `src/shared/config/defaults.ts`. A list over 8, or one naming a picture twice, is refused ("A run takes at most 8 reference pictures.", "A reference picture is in the list twice.").
  - One schema, `referenceIds` in `src/shared/schemas/reference-ids.ts`, is used by `generation.runImages` and `generation.startVideo`, both job request schemas (`image_generation`, `video_generation`) and both agent tools' inputs. The reference picker stops new ticks at 8 and shows the same line. This closes the security review's note that `referenceAssetIds` had no upper bound for an agent.
- **F-9. `toPng` on a reference before a ComfyUI upload.** Built with slice WP (A-55), in `readPicture`, for every provider: every picture sent is a clean PNG, so the bytes match the `.png` name and nothing the file carries beside the picture is sent.
- **F-18. Stand-in fixtures from the real server.** Tests only. Partly done.
  - After real ComfyUI runs, correct CU-4's hand-made stand-in fixtures to the shapes the real server showed. The Flux run showed the picture history shape holds. Still to check: the job-state status words and the video history entry, after a real video run.
  - If a real shape breaks a client schema, stop and report: that is a client change, ruled on its own.

### EX-1 — A JPEG's rotation tag is applied (built)

- **Class:** A, B. **Security class** (it reads bytes of a user's file). Built: `src/main/jpeg-orientation.ts`, `turn-pixels.ts`, `image-turner.ts`.
- **Why:** every picture sent to a provider passes through `toPng` (A-55), which drops the file's orientation tag. Without the turn, a phone photograph would be sent on its side.
- **As built:**
  - A pure reader for the JPEG orientation tag (values 1 to 8). It reads only the first APP1 "Exif" segment, with every offset checked against the segment's length. A missing, broken or out-of-range tag is read as 1 (upright); it never throws.
  - `toPng` and the picture fitter (`src/main/png-converter.ts`, `src/main/picture-fitter.ts`) turn and mirror the decoded pixels by that tag before they encode or crop. The limits are checked on the header before any decode, as before (turning swaps the sides but keeps the pixel count). PNG and WebP are not touched. Built without a turner (tests only), both refuse a JPEG whose tag asks for a turn rather than send it on its side.
  - The user's file is never changed.
- **Tests:** a table over the eight tag values with a small two-colour JPEG each (the marked corner ends where it should, the size swaps for 5 to 8); broken segments (cut off, offsets past the end, a huge count) read as upright; one test through `pngConverter` and one through the fitter; `tests/e2e/jpeg-orientation.spec.ts` checks a reference and a first frame through the built app.

### Slice WP — WebP converted to PNG (built)

- **Class:** A, B, G. **Security class.** [REQ: FR-298, FR-051, FR-245; D-053 item 20] Built: `src/main/providers/webp-size.ts`, `src/main/assets/read-picture.ts`, `src/main/windows/webp-window.ts`, `webp-decoder.ts`, `src/renderer/webp.html`, `src/renderer/webp-worker/main.ts`.
- **Rule:** a picture is never refused only because it is WebP. A conversion happens only where the main process hands picture bytes on (a reference picture, a first frame, an extend source): the provider and workflow always get a PNG. The user's file is never changed.
- **As built:**
  - `CoreDeps.webpToPng(bytes: Uint8Array): Promise<Uint8Array>`, filled in `src/main/index.ts`. `readPicture` checks the WebP's size with `webpInfo` before the window sees it, requires a PNG of that size back, then sends it through `toPng`. A failure is `asset_not_a_picture` or `asset_too_large`; no new reason.
  - The decoder window is hidden, sandboxed, with no preload. The main process passes the bytes as a base64 argument of `executeJavaScript` and takes the PNG as the call's result. Rules: `spec/security.md`, "Rules: the WebP decoder window".
  - The refusals that stood in before are gone: `generation.runImages`, `generation.startVideo`'s start check and the reference picker all accept a WebP picture. Animated WebP gives its first frame; the import notice is S2-17 (built).
  - Full description: `spec/assets.md`, "WebP to PNG conversion".
- **Tests:** unit `webpInfo`; `readPicture` with a stand-in converter; `tests/e2e/webp-decoder.spec.ts` (a still and an animated WebP through the real window, and the window's walls); `tests/build/built-page.test.ts` (the page's policy, no preload).

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

In `spec/phases/phase-02-screens.md`. S2-4 to S2-17 are built.

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

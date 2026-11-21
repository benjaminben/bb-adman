# Phase 2 leftovers

Every piece of Phase 2 work that is not on `main`, in a proposed build order. Group 1 (renderer layout and the styling source) is built. Group 3 (agents generate through the MCP server) is in `spec/phases/phase-02-agent-generation.md`.

`[UI]` work is built now, with its logic (D-084). Every screen follows the renderer layout rule in `spec/structure.md` and takes all styling from the shared tokens.

Work that belongs with a later phase is in that phase's file: Dropbox (slice G) in Phase 9; the fal.ai Seedance adapter (slice J) in Phase 7; extending a background (CU-8 and the extend job) in Phase 5; the remaining MCP tools, bridge mode and the ask flow in Phase 10.

## Group 2 — Small fixes and helpers

### "After the test" list

One short run in the main folder, class B, unless an item says otherwise. State is as checked on `main`. F-1 to F-6, F-10 and F-14 to F-17 are built.

- **F-7. Parser reading pass.** **Security class** (low). Not built.
  - A reading pass over `src/main/`: every call that parses text from a project file, a settings file, a brief or a server (`JSON.parse`, the YAML reader, any other parser). For each, say whether its error can reach `errorContext` with a piece of that text in its message.
  - Each one that can is wrapped the way `parsedJson` is: its own error, naming the place only, no cause, with one test. `errorContext` itself keeps logging `message` and `stack`.
  - A file the main folder does not own: list it and report, do not edit.
- **F-8. A limit on reference pictures per run.** Not built.
  - One constant `MAX_REFERENCES_PER_RUN` in `src/shared/config/defaults.ts`, used by the `generation.runImages` schema, the job request schema and the picker. A duplicate ID in the list is refused. One test each.
  - The number is ruled from what Gemini accepted in the stakeholder's test. **Needs that number before it is briefed.**
- **F-9. `toPng` on a reference before a ComfyUI upload.** Waits for a ruling.
  - Whether a reference picture passes through `toPng` before upload, so the bytes match the `.png` name and nothing the user's file carries beside the picture is sent. It needs `toPng` reachable from `AdapterContext`, which it is not today.
  - Also covers a JPEG named `.png` that `LoadImage` fails on. The JPEG pass of the ComfyUI harness waits for it.
- **F-11 and F-12** (the Settings check sentences from one owner, and the Settings form of `redirect_refused`): slice S2-1 below.
- **F-18. Stand-in fixtures from the real server.** Tests only. Partly done.
  - After real ComfyUI runs, correct CU-4's hand-made stand-in fixtures to the shapes the real server showed. The Flux run showed the picture history shape holds. Still to check: the job-state status words and the video history entry, after a real video run.
  - If a real shape breaks a client schema, stop and report: that is a client change, ruled on its own.

### FL-1 — The flaky `generate-panel.test.tsx` case

- **Class:** G, tests only. Not built. Which case is flaky is not recorded; the developer finds it.
- Find the cause: run the file alone many times, then the full suite under load. Look for shared state, timers or a missing wait. Fix the test only. If the cause is in app code, stop and report.

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
  - Animated WebP: first frame only. The import notice is slice S2-17 below; `webpInfo(...).animated` is its test.
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
- **CU-9, live progress.** **Security class.** Class E. Depends on CU-4 (built). Owns `src/main/providers/comfyui/live.ts`. It reports "how far along" from ComfyUI's live connection [REQ: FR-269]. It listens only. A run never depends on it: on failure the run carries on by polling.
  - Conditions checked first and reported before any code: Electron's main process has a built-in `WebSocket`; it does not follow a redirect; it sends no `Origin`; one incoming message's size can be limited (text messages kept under 64 KiB, every binary message dropped). If any fails, stop; the architect rules; no package on the developer's own decision.
  - The host is resolved and checked against the address rules (`spec/comfyui.md`) just before the connection opens. The gap between check and connect is accepted.
  - `onProgress` is called only when the stage, the queue position or the whole percent changed. Each call is one database write and one `job.updated` event.
  - Note: AR-2 also edits a file named `live.ts` in `src/main/jobs/`. They are different files.
- **The two real video runs.** The real end-to-end cases for video from a first-frame picture (`ADMAN_E2E_VIDEO_FRAME=1`) and from a reference picture (`ADMAN_E2E_VIDEO_REF=1`) each run once, one attempt each, no Retry. Each leaves one clip and one input file on the ComfyUI server. They prove the "Campaign · Make a video, from a picture" reach-table row. Not yet recorded as run.
- **After the first good real run of each workflow.** Fill `needs.checkedWith` with that run's server version (Flux: `flux3.ts` has `checkedWith: ''`; `common.ts` `needs()` writes `''`). G-16: if the printed version is below a `moss-*` or `h3-*` minimum while that workflow's nodes and models are all found, lower that minimum to the printed version (one line; today `0.42.0` and `0.43.0`).
- **Workflows to `proven`.** After the stakeholder accepts a `trial` workflow in the app, a one-line change sets `status: 'proven'` and records `needs.checkedWith`. No agent does this on its own. The four other workflows stay `draft` until their own data step. MOSS-Image is not installed on the test server yet; its trial waits, and `SFT` or `Base` is chosen with it (OI-34). The trials (`spec/comfyui-workflows.md`), including four runs at once and the smallest and largest reference count per workflow, set `proven`.
- **ComfyUI time limits.** The waiting and working limits in `limits.ts` are provisional. If the measured video work time is over the video working limit (`VIDEO_WORK_MS`, 120 min today), set it to twice the measured time, rounded up to ten minutes. Not a protection.
- **Two-reference video.** `h3-reference-to-video` declares one reference. Two references need one real two-reference run first, then a ruling.
- **Splitting `comfy-stand-in.spec.ts`.** The next slice that adds a case to `tests/e2e/comfy-stand-in.spec.ts` splits it, for example into `comfy-stand-in-video.spec.ts`.

## Groups 4 and 5 — Phase 2 screens (slices S2-1 to S2-17)

Group 4 is the ComfyUI failures and refusals on the campaign page (TP-4a), the commercial-licence dialog (LD-1, D-088), the Settings check sentences (F-11, F-12) and the confirm count on Retry (review item FN-4). Group 5 is the Phase 2 screens never built: import by button and by drop, relink, package, the brief form, the slot view and the campaign grid. Every screen, its controls, states, sentences and focus are in `spec/screens-campaign.md`. The slices below say who builds what, in which files, with which tests.

**What these slices do not build**, by decision (`spec/open-items.md`):

- The run dialog of FR-256 (the address and the workflow before a ComfyUI run) is Phase 4's run confirmation dialog (A-49). The Settings parts the hand-test screen once stood in for are built: the check lists each workflow with its missing items and licence note, and the section lists what Adman leaves on the server.
- No extra line for a queued agent run that will be cancelled at its turn (A-49).
- The campaign page still does not read `campaign.get` again on `project.changed`, and shows no message when `campaign.get` is refused (a nuisance; not built unprompted).

**Main-process work these screens need.** Every command and query the screens call exists, except:

- the licence check in `generation.runImages`, `generation.startVideo` and `job.retry`, the settings key `licenceConfirmed`, and the `offered` mark on `comfy.getInfo` (S2-4);
- the drop bridge in the preload (S2-3);
- the animated-WebP list in the `asset.import` reply (S2-17, after slice WP).

Each comes first in its own slice, before the screen that needs it.

### Rules for these slices

- Every slice: write the failing tests first, then the code; run lint, typecheck and `npm test` in full; plus what its class asks (`spec/testing.md`). A class G slice runs its end-to-end spec and `tests/e2e/screen-tour.spec.ts`.
- A slice edits only the files it owns and the existing files it is told it may touch. A change needed elsewhere: stop and report. An existing test is edited only where the slice lists the edit as approved.
- New tests get their own fixture files. No slice edits a shared fixture (`campaign-fixture.ts`, `project-fixture.ts`, `comfy-fixture.ts`, `video-fixture.ts`) unless it is listed.
- Every new component follows the folder rule and takes every CSS value from a token (`spec/structure.md`). No slice adds a token: stop and report if one is needed. Each file stays under 200 lines.
- No slice extends the hand-test screen (`src/renderer/dev/`).
- Budget: one slice per developer run, well under 300k tokens; hand off with `HANDOFF.md` if near it.

### Order and side-by-side work

Slices in one wave may run side by side in separate git worktrees: no two of them edit the same file. A slice starts only when every slice it comes after has merged. Every slice from wave 1 on comes after S2-2.

| Wave | Slices (side by side) | Each comes after |
|------|-----------------------|------------------|
| 0 | S2-1, S2-2, S2-3 | nothing (AR-3 may run beside them: no shared file) |
| 1 | S2-4, S2-5, S2-9, S2-11, S2-13, S2-15, S2-16 | S2-4: S2-1 and AR-3 (both edit `tests/unit/renderer/fake-api.ts`). S2-5: S2-1 and AR-3 (both edit `run-row/`). The rest: S2-2 only |
| 2 | S2-6, S2-7, S2-8, S2-10, S2-12, S2-14 | S2-6: S2-4. S2-7: S2-4. S2-8: S2-4. S2-10: S2-3 and S2-9. S2-12: S2-11. S2-14: S2-13 |
| 3 | S2-17 | S2-9 and slice WP |

- **Shared files and who goes first.** The run row (`run-row/`): AR-3, then S2-5. The Settings screen: AR-3 mounts its block in `settings-screen.tsx`; S2-8 mounts its list inside `comfy-section/`, so they share no file. `src/main/settings/settings-store.ts`: S2-4 does not run beside F-7 (the parser reading pass may wrap the settings parse). The app store and the app shell: S2-6 only.
- **Phase 3** starts after these slices. It builds on S2-16's `variant-tile/` and `variant-grid/`, and on S2-2's `dialog-frame/`.

### S2-1 — Check sentences from one owner (F-11, F-12)

- **Exists when done:** `src/shared/providers/messages.ts` owns `checkMessage(outcome)` (the six Settings check sentences; `redirect_refused` in its Settings form "The server tried to send Adman to another address. Adman did not follow."), `fillMarks(text, { address?, n? })` and `licenceNotConfirmedMessage(model)`. `comfy-check-result.tsx` holds no sentence of its own for an outcome and no missing-item text; it uses `checkMessage`, `fillMarks` and `missingItemText`.
- **New files:** `src/renderer/ui/missing-item-text.ts`.
- **May touch:** `src/shared/providers/messages.ts`, `src/renderer/screens/settings/comfy-check-result/comfy-check-result.tsx`. Approved test edit: in `tests/unit/renderer/screens/settings/comfy-check-result.test.tsx`, only the `redirect_refused` case, which now expects the Settings form. Every other pinned text stays as it is.
- **Read:** `spec/screens-campaign.md` "Shared pieces"; `spec/comfyui.md` "Failures, and the server's own words".
- **Tests:** `tests/unit/shared/providers/check-messages.test.ts` (each of the six outcomes; the Settings form of `redirect_refused` holds no "run", while `reasonMessage('redirect_refused')` still ends "and the run was stopped."; `fillMarks` fills `{address}` and `{n}`, and an unknown address reads "the saved address"; the licence sentence names the model), `tests/unit/renderer/ui/missing-item-text.test.ts` (the four kinds, with and without a folder), `tests/unit/renderer/screens/settings/check-sentence-owner.test.ts` (the source of `comfy-check-result.tsx` holds none of the six sentences).
- **Class:** D (+ B for the shared file). Not security class.

### S2-2 — Screen wiring and shared pieces

- **Exists when done:** the dialog frame; the privacy paragraph and the `useComfyInfo` hook in their shared places; the project home in its sections with four empty components mounted; the slot view's empty component mounted on the campaign page; a made campaign opens at once. Nothing new is visible yet but the section headings and the opening of a new campaign.
- **New files:** `src/renderer/ui/dialog-frame/` (component, CSS module with the overlay and box styles `key-dialog.module.css` uses, `index.ts`); `src/renderer/ui/comfy-privacy.ts`; `src/renderer/screens/campaign/use-comfy-info.ts`; component folders that draw nothing yet, each exporting its final props type from `index.ts`: `screens/project-home/import-files/`, `missing-files/`, `package-project/`, `drop-import/`, `screens/campaign/slot-view/`.
- **May touch:** `screens/project-home/project-home/project-home.tsx` and its CSS module (the sections and mounts of `spec/screens-campaign.md`, "Project home"; `onCreated` opens the campaign); `screens/project-home/brief-load/brief-load.tsx` (props `onCreated(campaignId)` and `campaigns: CampaignSummary[]`; calls `onCreated` with `campaign.create`'s `campaignId`); `screens/campaign/campaign-view/campaign-view.tsx` (mounts `SlotView` above the picture panel, nothing else); `screens/campaign/video-panel/video-length.ts` (the hook moves out; imports it); `screens/settings/comfy-section/comfy-section.tsx` (imports the privacy paragraph).
- **Read:** `spec/screens-campaign.md` "Rules for these screens", "Shared pieces", "Project home"; `spec/structure.md` "One folder per component", "One styling source".
- **Tests:** `tests/unit/renderer/ui/dialog-frame.test.tsx` (title and description; Escape and a click outside call `onClose`; with `closable` false neither does; focus goes back to the opener; axe), `tests/unit/renderer/screens/project-home/project-sections.test.tsx` (headings "Start a campaign", "Files", "Package" after the campaign list; after "Create campaign" succeeds, `campaign.get` is read for the returned campaign ID and "Back to project" shows). Every existing test passes unchanged.
- **Class:** D. Not security class.

### S2-3 — The drop bridge

- **Exists when done:** `window.drop.pathOf(file)` gives a dropped file's full path, and `droppedPaths(files)` in the renderer uses it.
- **New files:** `src/shared/schemas/drop-api.ts` (`DropApi`), `src/renderer/ui/dropped-paths.ts`.
- **May touch:** `src/preload/index.ts` (one more `exposeInMainWorld('drop', …)`, using `webUtils.getPathForFile`), `src/renderer/env.d.ts`.
- **Check first:** in Electron 45 a sandboxed preload can import `webUtils`, and `webUtils.getPathForFile` gives the full path of a file put on an `<input type="file">` by Playwright's `setInputFiles`. If either fails, stop and report.
- **Read:** `spec/screens-campaign.md` "Importing by dropping files"; `spec/security.md` "Rules: renderer and windows".
- **Tests:** `tests/unit/renderer/ui/dropped-paths.test.ts` (with a stand-in `window.drop`: paths in order; empty answers left out; no `window.drop` gives an empty list), `tests/e2e/drop-bridge.spec.ts` (`window.drop` has exactly the key `pathOf`; `window.api` still has exactly `command`, `query`, `on`; `pathOf` of a `File` the page made gives `''`; `pathOf` of a file put on a hidden input with `setInputFiles` gives that file's full path; a drop event holding a page-made file leaves the page address unchanged).
- **Class:** G + D. **Security class, full review** (a new source of paths the window may send).

### S2-4 — Licence check and offered workflows (main process)

- **Exists when done:** the main half of LD-1 (`spec/comfyui-workflows.md`, "Commercial-licence dialog") and the `offered` mark on `comfy.getInfo`.
  - Settings key `licenceConfirmed: string[]` (model labels, each 1 to 100 characters, at most 50), default `[]`, written by `settings.update`. A loaded value that fails reads as `[]` and the other keys are kept.
  - `generation.runImages`, `generation.startVideo` and `job.retry` take `licenceConfirmed: true` (optional). After the workflow is chosen, a workflow whose `licence.commercialNote` is not null runs only when its `model.label` is in `settings.licenceConfirmed`, or the actor is the user and the input holds `licenceConfirmed: true`. Otherwise `INVALID_INPUT`, `details = { reason: 'licence_not_confirmed', workflow }`, message `licenceNotConfirmedMessage(model.label)`, before any job row and before anything is sent. For an agent the flag is ignored.
  - `WorkflowInfo.offered: boolean`: true for the workflow `offeredWorkflow` gives the user for its job (and, for video, its start pair) with the app's dev-tools setting.
- **New files:** `src/main/commands/generation/licence-check.ts`.
- **May touch:** `src/shared/schemas/settings.ts`, `src/main/settings/defaults.ts`, `src/main/settings/settings-store.ts`, `src/shared/schemas/commands/generation.ts`, `src/shared/schemas/commands/job.ts`, `src/main/commands/generation/comfy-checks.ts`, `comfy-video-checks.ts`, `src/main/commands/job/retry.ts`, `src/main/queries/comfy.ts`, `src/shared/schemas/queries/comfy.ts`. Approved test edits: each test that lists every settings key gains `licenceConfirmed` (`tests/integration/commands/settings-update.test.ts` and any other the developer finds, named in the report); `tests/unit/renderer/fake-api.ts` (`licenceConfirmed: []` in `baseState`); each `WorkflowInfo` fixture gains `offered` (`tests/unit/renderer/screens/settings/comfy-fixture.ts`, the video fixtures); the agent gate's ComfyUI test gains one refusal case.
- **Read:** `spec/comfyui-workflows.md` "Which workflow a run gets", "Commercial-licence dialog"; `spec/api-principles.md` the reason table and "What `details` may hold"; `spec/infra-and-settings.md` "settings.json"; `spec/agent-runs.md` (the gate's order of checks).
- **Tests:** `tests/integration/generation/licence-check.test.ts` (an H3 video and a FLUX 3 klein picture with no flag: refused with the reason and `details.workflow`, no job row, the stand-in got no request; with the flag: accepted; with the model saved and no flag: accepted; a MOSS picture with no flag: accepted; `job.retry` of a failed H3 run: the same three; as the agent with the flag in the input and ComfyUI ticked: refused; as the agent after the model is saved: accepted), `tests/unit/main/settings/settings-licence.test.ts` (default; a bad loaded value; `settings.update` takes a list and refuses a non-text entry), `tests/integration/queries/comfy-info-offered.test.ts` (dev tools off: no `trial` workflow offered; on: exactly one offered per job and per video start pair; the agent still gets `AGENT_DENIED`).
- **Class:** B. Not security class; short review (it changes what an agent is refused).

### S2-5 — ComfyUI failures in the run row (TP-4a, FN-4)

- **Exists when done:** `spec/screens-campaign.md`, "Campaign page: ComfyUI failures in the run row", including the Retry count of FN-4. When merged, FN-4 is removed from `spec/phases/review-leftovers.md`.
- **New files:** `src/renderer/screens/campaign/run-failure/`.
- **May touch:** `src/renderer/screens/campaign/run-row/run-row.tsx` (draws `RunFailure` for a failed row; the Retry count).
- **Read:** `spec/screens-campaign.md` that section; `spec/comfyui.md` "Failures, and the server's own words"; `spec/security.md` "What the window may draw".
- **Tests:** `tests/unit/renderer/screens/campaign/run-failure.test.tsx` (`out_of_memory` shows its sentence; `no_answer` fills the address from `comfy.getInfo`, and reads "the saved address" before it answers; `missing_items` lists each item's text and fills `{n}`, and drops a malformed entry; the seven reasons show "Open Settings" and pressing it shows Settings; `run_failed` does not; no reason gives the kind's sentence; "Show the server's message" sends `job.getServerMessage` once and draws the text; a reply holding `<a href="https://x.test">y</a>` shows those characters and the row holds no link; a null reply shows its sentence; a provider without `serverText` has no button; axe), `tests/unit/renderer/screens/campaign/run-row-retry-count.test.tsx` (a cancelled picture row with `count: 4` and two kept asset IDs: "This sends 2 paid request(s)"; a video row keeps the stored count; Retry on a failed ComfyUI row sends `job.retry` with no confirm line).
- **Class:** D. Not security class; the review checks that server text is drawn as text only.

### S2-6 — The address dialog and the licence dialog (TP-4a, LD-1)

- **Exists when done:** `spec/screens-campaign.md`, "The address dialog" and "The commercial-licence dialog". The app store asks and sends again for the three run commands.
- **New files:** `src/renderer/dialogs/address-dialog/`, `src/renderer/dialogs/licence-dialog/`, `src/renderer/stores/run-asks.ts` (which refusal of which command opens which dialog; pure).
- **May touch:** `src/renderer/stores/app-store.ts` (state `addressRequest` and `licenceRequest`; the ask-then-send-again step, at most once per call), `src/renderer/app/app-shell/app-shell.tsx` (mounts both dialogs beside the key dialog).
- **Read:** `spec/screens-campaign.md` those two sections; `spec/api-principles.md` "`NEEDS_KEY`"; `spec/comfyui-workflows.md` "Commercial-licence dialog".
- **Tests:** `tests/unit/renderer/stores/run-asks.test.ts` (with the fake API: `comfy_address_needed` on `generation.runImages` opens the address request; after a save the same input is sent once more; Cancel returns the refusal, sends nothing more and leaves the banner empty; `licence_not_confirmed` opens the licence request with the workflow; Confirm sends the same input plus `licenceConfirmed: true`; a ticked box sends `settings.update` with the model added before the run; a second refusal is not asked again and goes to the banner; `comfy.check` and `asset.import` refusals open nothing), `tests/unit/renderer/dialogs/address-dialog.test.tsx` (privacy paragraph; a refused address shows its sentence under the field and the dialog stays; Saving state; Cancel; focus on the field; axe), `tests/unit/renderer/dialogs/licence-dialog.test.tsx` (the ruled sentence with the model from `comfy.getInfo`, and "This model" when it is not found; the box's label; Cancel; Confirm with and without the box; focus on the box; axe), `tests/e2e/comfy-asks.spec.ts` (offline, ComfyUI stand-in, dev tools on: with no address, Generate with ComfyUI opens the address dialog, saving the stand-in's address starts the run; an H3 video start opens the licence dialog, Cancel leaves no run row, Confirm with the box ticked starts it, and a second start shows no dialog). A new spec file, not a case added to `comfy-stand-in.spec.ts`.
- **Class:** D + G. Not security class.

### S2-7 — The trial mark in the panels

- **Exists when done:** `spec/screens-campaign.md`, "The trial mark in the panels".
- **New files:** `src/renderer/screens/campaign/provider-select/`, `src/renderer/screens/campaign/offered-workflow.ts`.
- **May touch:** `screens/campaign/generate-panel/generate-panel.tsx`, `screens/campaign/video-panel/video-panel.tsx` (each draws `ProviderSelect`).
- **Read:** that section; `spec/comfyui-workflows.md` "Which workflow a run gets".
- **Tests:** `tests/unit/renderer/screens/campaign/offered-workflow.test.ts` (`image` with no ticks, `image_refs` with ticks, a video pair, nothing offered), `tests/unit/renderer/screens/campaign/trial-mark.test.tsx` ("ComfyUI (trial)" when the offered workflow is `trial`; ticking a reference picture follows the `image_refs` workflow; a `proven` one has no mark; Gemini never has one; the video card follows the chosen start; the field's label is still "Provider"; axe). Every existing panel test passes unchanged.
- **Class:** D. Not security class.

### S2-8 — Confirmed licences in Settings

- **Exists when done:** `spec/screens-campaign.md`, "Settings: confirmed licences".
- **New files:** `src/renderer/screens/settings/licence-list/`.
- **May touch:** `screens/settings/comfy-section/comfy-section.tsx` (one mount below the check result).
- **Tests:** `tests/unit/renderer/screens/settings/licence-list.test.tsx` (lists saved names as text; "Forget" sends `settings.update` without that name; buttons disabled while it is sent; empty sentence; a refusal line; axe).
- **Class:** D. Not security class.

### S2-9 — The import dialog and the import buttons

- **Exists when done:** `spec/screens-campaign.md`, "The import dialog" and "Import buttons".
- **New files:** `src/renderer/dialogs/import-dialog/`; the body of `screens/project-home/import-files/` (owned from here on).
- **Read:** those sections; `spec/assets.md` "Import", "Folders".
- **Tests:** `tests/unit/renderer/dialogs/import-dialog.test.tsx` (the three defaults; `asset.import` carries each choice; no `subjectId` for "No subject"; result lines for a mix of added, reused and skipped; the all-zero sentence; a refusal shows inside and "Import" works again; Cancel sends nothing; Importing disables both buttons and Escape; the dialog's text holds base names only, never a folder of the path; eleven names show ten and "and 1 more"; axe), `tests/unit/renderer/screens/project-home/import-files.test.tsx` (the files picker input; the folder picker input; a cancelled picker sends nothing).
- **Class:** D. Not security class.

### S2-10 — Importing by dropping files

- **Exists when done:** `spec/screens-campaign.md`, "Importing by dropping files", the drop target.
- **New files:** the body of `screens/project-home/drop-import/` (owned from here on).
- **Tests:** `tests/unit/renderer/screens/project-home/drop-import.test.tsx` (with a stand-in `window.drop`: a drag of files is accepted and any other drag is left alone; the layer shows the project's name; a drop opens the import dialog with the paths and sends nothing before "Import"; a drop whose paths are all empty does nothing; a drop while the dialog is open is ignored; Escape hides the layer; the listeners are gone after unmount), `tests/e2e/drop-import.spec.ts` (a file put on a hidden input with `setInputFiles` and dropped on the window through a `DragEvent` opens the import dialog; "Import" adds the asset).
- **Class:** D + G. Not security class; the review checks that a drop never imports without "Import".

### S2-11 — The relink dialog

- **Exists when done:** `spec/screens-campaign.md`, "Finding missing files: the relink dialog".
- **New files:** `src/renderer/dialogs/relink-dialog/`; the body of `screens/project-home/missing-files/` (owned from here on).
- **Read:** that section; `spec/assets.md` "Relink".
- **Tests:** `tests/unit/renderer/dialogs/relink-dialog.test.tsx` (lists only missing assets, by name; `onlyAssetIds` narrows it; "Find…" sends the relink picker with the asset's kind, then `asset.relink` with `relinkSiblings` from the box; a cancelled picker sends nothing; the found and siblings sentences; a refusal shows; the list is read again; focus moves to the next "Find…"; axe), `tests/unit/renderer/screens/project-home/missing-files.test.tsx` (nothing at 0; the sentence and button otherwise).
- **Class:** D. Not security class.

### S2-12 — The package dialog

- **Exists when done:** `spec/screens-campaign.md`, "Package project".
- **New files:** `src/renderer/dialogs/package-dialog/` (with a private `file-size.ts`); the body of `screens/project-home/package-project/` (owned from here on).
- **Read:** that section; `spec/data-rules.md` "Package project".
- **Tests:** `tests/unit/renderer/dialogs/package-dialog.test.tsx` (a cancelled picker sends nothing; the done line; `MISSING_FILE` lists the names; "Package without them" sends `skipMissing: true` with the same folder; "Find missing files…" opens the relink dialog with only those IDs and packages again when it closes; another refusal offers "Choose another folder…"; no path appears in the dialog; axe), `tests/unit/renderer/dialogs/file-size.test.ts`.
- **Class:** D. Not security class.

### S2-13 — The brief form: fields and subjects

- **Exists when done:** `spec/screens-campaign.md`, "The brief form", the parts marked S2-13: the model in full, "Type a brief", the campaign fields, the subject rows, read-only lines for sizes, languages and rules, problems, create and cancel. `brief-summary/` is removed.
- **New files:** `src/renderer/screens/project-home/brief-form-model.ts`, `screens/project-home/brief-form/`, `screens/project-home/subject-rows/`.
- **May touch:** `screens/project-home/brief-load/brief-load.tsx` ("Type a brief"; the form in place of the summary), `screens/project-home/campaign-input.ts` (`campaignPlan` goes; `briefSubjectIds` stays). Approved test edits: `tests/unit/renderer/screens/project-home/campaign-input.test.ts` keeps its `briefSubjectIds` block, and its `campaignPlan` cases move to `brief-form-model.test.ts` against `planFromForm(formFromDraft(…))`, with the new problem wording; `brief-load.test.tsx` and `brief-subject-ids.test.tsx` keep every case against the form (the region "Brief", the list "Subjects", "Create campaign" and "Cancel" keep their names; the notes "(made from the name)" and "already in this project, used as it is" become the "Subject ID" field's value and the chosen "Use a subject this project has"; the bad-ID problem reads "Subject {i}: the ID …"). The end-to-end helpers in `tests/e2e/screens.ts` must pass unchanged.
- **Read:** that section; `spec/brief-and-templates.md` "The brief's shape", "From a brief to a campaign".
- **Tests:** `tests/unit/renderer/screens/project-home/brief-form-model.test.ts` (filling from a draft, sizes and languages as described; every problem line; the sent `brief`, `subjectMap` and `subject.create` list; an existing subject sends no `subject.create`; a typed new ID taken by the project is a problem), `brief-form.test.tsx` (edit a field and the sent input changes; message word for word; "Add subject" and "Remove" with focus; Enter in a field creates nothing; Creating disables everything; the new campaign opens; axe), `brief-type.test.tsx` ("Type a brief" opens an empty form with problems listed; leaving "Region" fills "Languages"; a filled form sends `subject.create` then `campaign.create`).
- **Class:** D. Not security class.

### S2-14 — The brief form: sizes, languages and rules

- **Exists when done:** the parts of "The brief form" marked S2-14.
- **New files:** `screens/project-home/size-fields/`, `screens/project-home/rule-fields/`.
- **May touch:** `screens/project-home/brief-form/` (owned from S2-13).
- **Tests:** `tests/unit/renderer/screens/project-home/size-fields.test.tsx` (ticks, other sizes, master choice; the master first in the sent sizes; an unreadable size is a problem), `rule-fields.test.tsx` (word lists per language go into `brief`; "Copy the rules from another campaign" sends `copyRuleSetFrom` and no word lists in the rule input; disabled with no other campaign), `brief-form-languages.test.tsx` (typed tags in order; a right-to-left tag is a problem; no tag is a problem), axe for each.
- **Class:** D. Not security class.

### S2-15 — The slot view

- **Exists when done:** `spec/screens-campaign.md`, "The slot view".
- **New files:** the body of `screens/campaign/slot-view/` (owned from here on).
- **Read:** that section; `spec/brief-and-templates.md` "`slotStates` and the template queries".
- **Tests:** `tests/unit/renderer/screens/campaign/slot-view.test.tsx` (rows in template order with names and states; candidates with pictures through `assetUrl` and names as text; a missing candidate says "file not found"; read again on `project.changed` for this project only; loading, refused and empty sentences; axe).
- **Class:** D. Not security class.

### S2-16 — The campaign grid and the variant tile

- **Exists when done:** `spec/screens-campaign.md`, "The campaign grid and the variant tile". `variant-list/` is removed.
- **New files:** `src/renderer/screens/campaign/variant-grid/`, `src/renderer/screens/campaign/variant-tile/` (with `badge-words.ts`).
- **May touch:** `screens/campaign/campaign-view/campaign-view.tsx`. Approved test edits: `tests/unit/renderer/screens/campaign/campaign-view.test.tsx` (radios become tile buttons with `aria-pressed`; the order check reads the tiles), `tests/unit/renderer/screens/campaign/reference-ticks.test.tsx` lines 113 and 127 (`getByRole('button', { name: /German post/ })`), `tests/e2e/screen-tour.ts` line 90 (the list "Variants" and its buttons).
- **Read:** that section; `spec/editor.md` "Navigation", "Thumbnails on the screens" (what Phase 3 adds; do not build it).
- **Tests:** `tests/unit/renderer/screens/campaign/variant-tile.test.tsx` (the text lines; " · master"; the shape box with "Video" for a video variant; each mark only when true; `aria-pressed`; click, Enter and Space call `onChoose`; `preview` replaces the box; `actions` drawn outside the button; a title holding `<b>` shows the characters; axe), `variant-grid.test.tsx` (order; the empty sentence; axe), `badge-words.test.ts`.
- **Class:** D (+ the screen-tour end-to-end run). Not security class.

### S2-17 — The animated-WebP notice

- **Exists when done:** the `asset.import` reply holds `animatedAssetIds: string[]` (the imported or reused WebP files whose `webpInfo(...).animated` is true), and the import dialog's done state shows "{name} holds an animation. Adman uses its first picture." per ID, the name from `asset.list`.
- **May touch:** the file in `src/main/assets/` that builds the import reply, `src/shared/schemas/commands/asset.ts` (the reply type), `dialogs/import-dialog/` (owned from S2-9).
- **Tests:** `tests/integration/assets/import-animated-webp.test.ts` (an animated WebP is listed; a still WebP and a PNG are not; the same inside a folder import), one new case in `tests/unit/renderer/dialogs/import-dialog.test.tsx`.
- **Class:** B + D. Security class, short review (reads file bytes through `webpInfo`). **After:** slice WP.

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
- Stakeholder answers still open, no code until answered: the stricter project names (`LPT0` and similar), Q-032 sub-question 5 (a style note per direction), Q-039, Q-040, OI-64, OI-90, OI-91.

## Not planned for this build

- **Custom workflows added by the user** (OI-57, D-058). Not designed. Known answers: a variable is marked by the step's title set in ComfyUI; an agent may run a listed custom workflow under the ComfyUI tick; pictures and video first, after the stock workflows pass on the test machine. CQ-38 was answered "treat workflows like assets which are external files", which differs from the recommendation and from FR-309 and FR-326. It needs its own ruling on the rule that the shipped workflows are the only ones the app can send, and on FR-278. Waits for the analyst's revision of the ComfyUI requirements.
- **Krea 2** (OI-58). Nothing built until MOSS-Image and MiniMax H3 pass their trials. Which jobs it gets is not decided.
- **An optional enlarging step for video** [REQ: FR-293]. Off unless the user turns it on. Waits for the stakeholder's hand test of `comfy-workflows/h3-video-first-frame-upscaled.json` (OI-59). Known from the draft: core nodes only (SeedVR2 3B); 1.5× gives 1152 × 2016, within `MAX_VIDEO_SIDE`; sound goes round the step. Not designed.

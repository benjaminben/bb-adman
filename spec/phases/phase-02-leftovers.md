# Phase 2 leftovers

Every piece of Phase 2 work that is not on `main`, in a proposed build order. Group 3 (agents generate through the MCP server) is in `spec/phases/phase-02-agent-generation.md`.

`[UI]` work is built now, with its logic (D-084). Every screen follows the renderer layout rule in `spec/structure.md` and takes all styling from the shared tokens.

Work that belongs with a later phase is in that phase's file: Dropbox (slice G) in Phase 9; the fal.ai Seedance adapter (slice J) in Phase 7; extending a background (CU-8 and the extend job) in Phase 5; the remaining MCP tools, bridge mode and the ask flow in Phase 10.

## Group 1 — Renderer layout and design tokens

Run first, because it touches every renderer file and D-084 makes modular components the base for all later screen work. Exception: see the target date in `phase-02-agent-generation.md`.

### LO-1b — One folder per component

- **Class:** D. Not security class.
- **Depends on:** the `@/` alias (built). Its own worktree from `main`, with no other renderer slice open.
- **Done when:**
  - Each component file is moved with `git mv` into its folder per the renderer layout rule (`spec/structure.md`), with an `index.ts` that only re-exports, and imports point at the folder. No component, export or test file is renamed. No test file moves.
  - `screens/screens.module.css`, `app/app-shell.module.css` and `dialogs/key/key-dialog.module.css` are split: each class goes to the module of the one component that uses it, or to `ui/layout.module.css` if two or more use it. Class names and rules do not change. `screens/screens.module.css` and `app/app-shell.module.css` are deleted.
  - No behaviour change: no text, markup, class rule, prop or logic change. Tests are edited for import paths only. Any other test change means stop and report.
- **Target tree** (each name ending in `/` inside a screen, `app/`, `dialogs/` or `dev/` is a component folder):

```
src/renderer/
├── main.tsx
├── app/            app.tsx, app-context.tsx, app-shell/, error-banner/
├── screens/
│   ├── start/          start-screen/, new-project-form/, recent-projects/
│   ├── settings/       settings-screen/, keys-section/, key-row/, location-setting/,
│   │                   provider-defaults/, comfy-section/, comfy-check-result/,
│   │                   mcp-section/, connect-panel/
│   ├── project-home/   project-home/ (with use-project.ts), brief-load/, brief-summary/,
│   │                   campaign-list/, campaign-input.ts
│   └── campaign/       campaign-view/, generate-panel/, paid-confirm/, reference-picker/,
│                       run-list/, run-row/, run-result/, variant-list/,
│                       video-panel/, video-result/, video-picture-choice/,
│                       reference-list.ts, video-length.ts, video-start.ts, video-status.ts
├── dialogs/        key-dialog/
├── dev/            hand-test-screen/, s3-settings-form/, dropbox-sign-in/, storage-actions/,
│                   result-text.ts
├── stores/         unchanged
└── ui/             tokens.css, base.css, layout.module.css, asset-url.ts, secret-labels.ts
```

  - The four campaign helpers are shown as plain files in the screen folder. A helper used by one component only moves inside that component's folder instead. The developer checks each and says where it went.
- **Checks:** class D over all of `tests/unit/renderer/`, plus the built-page test in `tests/build/` (a wrong CSS import shows only in the build).
- **State on `main`:** `src/renderer/` is flat; `screens/screens.module.css` and `dialogs/key/` exist; there is no `ui/layout.module.css`.

### LO-1c — One styling source

D-084: all styling comes from one set of shared tokens that can change every component at once. This slice is a proposal written for this plan; the old spec had only the token file and the `--font-mono` note.

- **Class:** D. Not security class. After LO-1b.
- **What exists on `main`:**
  - `src/renderer/ui/tokens.css`: colour tokens (`--color-bg`, `--color-surface`, `--color-border`, `--color-text`, `--color-text-muted`, `--color-accent`, `--color-accent-text`, `--color-danger-bg`, `--color-danger-text`, `--color-focus`), `--radius`, spaces `--space-1` to `--space-4` and `--space-6` (4, 8, 12, 16, 24 px), `--font-body` and one `--font-size` (14px). Its head comment calls the values placeholders until a design hand-off; under D-084 it is the styling source.
  - `src/renderer/ui/base.css`: element defaults.
  - One-off values outside the tokens: `font-size: 16px`, `max-width: 960px` and `minmax(320px, 1fr)` in `screens/screens.module.css`; `rgb(0 0 0 / 40%)` and `min(440px, 90vw)` in `dialogs/key/key-dialog.module.css`; border and outline widths of `1px` and `2px` in several files.
  - No `--font-mono` token. The Connect line uses the browser's default monospace font.
- **Done when:**
  - `tokens.css` gains a small type scale (at least body and heading sizes), `--font-mono`, an overlay colour, border and focus-ring widths, and the layout widths now written as one-off values. The head comment says this file is the one styling source (D-084).
  - Every one-off value above is replaced by a token. The Connect line uses `--font-mono`.
  - One test reads every `.css` file under `src/renderer/` other than `tokens.css` and fails on a colour literal (hex, `rgb`, `hsl`) or a length in `px` other than `0`. A rule that truly needs a literal names it in an allow-list inside the test, with a reason.
  - No visible change except the Connect line's font.

## Group 2 — Small fixes and helpers

### The `variant.rev` helper (`agent_changed_at`)

- **What:** one helper in `src/main/commands/variant-rev.ts` that bumps `variant.rev` and, when the actor is the agent, also stamps `variant.agent_changed_at`. Every command that bumps `variant.rev` uses it [REQ: FR-239].
- **State on `main`:** the column exists (`src/main/db/schema/variant.ts`, migration `0001_agent_changed_and_job_target.sql`); nothing under `src/main` writes `agentChangedAt`; the helper file does not exist.
- **Tests:** a unit test of the helper here, for both actors. The first command that bumps `variant.rev` (Phase 3's layer commands, or Phase 4's handler that places a chosen option, whichever comes first) adds the test through that command, sent once as the user and once as the agent. Phase 10 adds one test through an MCP tool.
- **Class:** B.

### "After the test" list

One short run in the main folder, class B, unless an item says otherwise. State is as checked on `main`.

- **F-1. Make the runner-close test real.** Not built.
  - In `tests/integration/jobs/runner-close.test.ts`, the test "a close that returned leaves the file free to run jobs when opened again" today closes a project with no running job, so `cancelAll` never runs and it passes with the `finally` removed. It must start with:
    ```ts
        const x = fixture()
        const g = gate()
        x.f.body = async () => g.promise
        await running(x, { provider: 'no-cancel' })
        expect((await close(x)).ok).toBe(true)
        g.open()
        x.f.body = async () => ({ done: true })
    ```
    in place of `const x = fixture()` / `expect((await close(x)).ok).toBe(true)`. Nothing else changes.
  - The developer then removes the `finally` line `state.closing.delete(projectId)` in `close-jobs.ts` by hand, shows the test fails, puts it back, and reports. If the test does not fail without the line, stop and report.
- **F-2. `brief.parse` refuses a relative path.** Not built.
  - `src/main/commands/brief/parse.ts`: a `filePath` for which `path.isAbsolute` is false is refused with `INVALID_INPUT` and the message "The file path must be absolute.", before any read.
  - Test in `tests/integration/campaigns/brief-parse.test.ts`: a relative path to a brief that exists gives `INVALID_INPUT`; an absolute path to the same file is parsed.
- **F-3.** Built (the two-part upload wait, as slice RF-1). Nothing left.
- **F-4. Client test gaps.** Tests only. Not built.
  - The header test (titled "on every call", but running 3 of the 11 client functions) and the redirect test (running only `systemStats`) each run over every function of `tests/helpers/comfy-every-call.ts`, with their assertions unchanged.
  - One new test: `history` answers null on a 404.
- **F-5. `isMaster` from the variant's own direction.** Not built.
  - `src/main/queries/campaign.ts`: `isMaster` is true only when the variant's own direction's `masterVariantId` names it. Today it is true when any direction of the campaign names it. One line, no new test.
- **F-6. Count every table in two tests.** Tests only. Not built.
  - `campaign-delete.test.ts` and `campaign-get.test.ts`: the "every row is still there" and "writes nothing" checks count every table of the project file, through one helper that walks the table list (today they count 2 and 6 tables).
  - In `campaign-get.test.ts` the job-mark test gains a job that carries both the variant's ID and the campaign's ID and sets both marks. Its name says that a job with only `variant_id` does not set the campaign's mark. No other assertion changes.
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
- **F-10. The job store keeps a later row.** Not built.
  - `src/renderer/stores/job-store.ts`, `load`: when a `job.list` reply holds a row whose ID the store already holds with a later `updatedAt`, the store keeps its own row. On equal `updatedAt` the store's row is kept. So a late list reply cannot turn a finished run back to "Working".
  - One test in `tests/unit/renderer/stores/job-store.test.ts`: a `job.updated` that lands while a `job.list` read is open, with a later `updatedAt` than the reply's row, is still shown after the reply.
- **F-11. Settings check sentences from one owner.** Not built. With F-12.
  - `src/renderer/screens/settings/comfy-check-result.tsx` imports the six check sentences from `src/shared/providers/messages.ts` and holds no copy. The existing tests pin the text and do not change. If `messages.ts` lacks one of the six, stop and report.
- **F-12. `redirect_refused` in the Settings check.** Waits for a ruling.
  - The sentence "The server tried to send Adman to another address. Adman did not follow, and the run was stopped." reads oddly in the Settings check, where there is no run. Reword it, or give it a Settings form, together with F-11, so the wording has one owner.
- **F-14. The two refusal sentences into shared messages.** Not built.
  - Move "ComfyUI cannot make this kind of picture yet." and the reference-limit sentence from `src/main/commands/generation/comfy-checks.ts` into `src/shared/providers/messages.ts`. `comfy-checks.ts` imports them.
  - The second gets a real plural: "ComfyUI takes one reference picture for this run." when the most is 1, else "ComfyUI takes at most {max} reference pictures for this run." Tests pin both.
- **F-15. Cancel outcomes for ComfyUI pictures.** Not built.
  - Today a ComfyUI picture cancel always ends `stopped`: `run.ts` throws `ProviderCancelled` right after `cancelOwnRun`.
  - In `src/main/providers/comfyui/run.ts` and `cancel.ts`: on `finished`, fetch and return the picture (a job is never shown as cancelled when its result arrived); on `unknown`, keep polling under the run's own limits, so the runner's wait decides.
  - Tests in `tests/unit/main/providers/comfyui/image-cancel.test.ts` for each.
- **F-16. A 5xx poll answer is a failed poll.** Not built.
  - `src/main/providers/comfyui/poll.ts`: a 5xx answer to a poll is a failed poll, retried until the 5-minute limit, then `lost_contact`. Today only an `offline` failure counts, so one 500 answer ends a run. Applies to video polling too.
  - Tests: three 500 answers then a result succeeds; 500 for over 5 minutes gives `lost_contact`.
- **F-17. Missing tests.** Not built.
  - A picture run whose history holds `execution_interrupted` gives `server_stopped` (in `image-failures.test.ts`; today only the video tests cover it).
  - The test that searches requests for the address marker searches headers too (today paths, queries and bodies).
  - One whole picture run that ends with reason `certificate` (today only `checkFailure` is tested).
- **F-18. Stand-in fixtures from the real server.** Tests only. Partly done.
  - After real ComfyUI runs, correct CU-4's hand-made stand-in fixtures to the shapes the real server showed. The Flux run showed the picture history shape holds. Still to check: the job-state status words and the video history entry, after a real video run.
  - If a real shape breaks a client schema, stop and report: that is a client change, ruled on its own.

### MP4-1 — `checkMp4` must find at least one video sample

- **Security class.** Short review. Not built (no `noFrames` in `src/main/providers/video-check.ts`).
- Today `checkMp4` proves only the box structure, so a header-only clip passes and then shows a dead player.
- A file passes only if its video track lists one or more samples: the `stsz` sample count is above 0, or, for a fragmented file, a `trun` of the video track has a sample count above 0. New refusal reason `noFrames` in `MP4_REFUSED`.
- If `checkMp4` does not read `stsz` or `trun` yet, add that read under the existing box and size limits.
- Fake `mp4File` clips must then carry one sample entry and at least one byte of `mdat` (it need not decode). The made-up H.264 fixture must pass.
- **Tests:** a header-only file is refused with `noFrames`; the H.264 fixture passes. No real run needed.

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
  - Animated WebP: first frame only. The import notice ("this file holds an animation; the app uses its first picture") is group 5 screen work; `webpInfo(...).animated` is its test.
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

### CU-2b — Two proofs on a real process

- **Security class.** One short run. Depends on CU-2 (merged). Not built.
- (a) An HTTPS stand-in with a self-signed certificate, made at test time by `openssl` into a temporary folder. With `NODE_TLS_REJECT_UNAUTHORIZED=0` set, the ComfyUI client still refuses it with reason `certificate`. The test skips itself with one line where `openssl` is not installed, and must run on at least one CI system. No PEM key goes into the repository.
- (b) A child process started with `NODE_USE_ENV_PROXY=1` and `HTTP_PROXY` pointing at a second local stand-in: the request reaches the pinned stand-in, and the second one sees no connection.
- If either cannot be done without a new package, stop and report. If either proof fails, it is a security finding and the architect rules before any release.

### Hand-test file picker (slice I part 2, only if OI-64 keeps it)

- The text field "File to upload (full path)" in `src/renderer/dev/storage-actions.tsx` becomes a "Choose a file" button that calls `dialog.pickFiles` and sends the path it gives to `dev.storage`. `dev.storage` does not change.
- Whether slice I part 2 and CU-8 are still wanted is OI-64. The hand-test screen is removed in Phase 9 anyway.

### TP-2 end-to-end test

- `tests/e2e/test-path.spec.ts`: create a project, load `examples/brief.yaml` through the picker's test hook, create the campaign, run a picture. One short run, touching only `tests/e2e/`.
- First check whether `tests/e2e/comfy-stand-in.spec.ts` and `screen-tour.spec.ts` already cover these steps. If they do, drop this item and say so.

### ComfyUI follow-ups

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

## Group 4 — ComfyUI failures on the campaign page (TP-4a)

No later ruling cut this. It was only on the cut line for the stakeholder's test night. It stays.

- **Class:** D. Not security class. Edits the generate panel and the run row.
- **Calls:** `job.getServerMessage` (built, user only), `comfy.getInfo`, and the reason sentences in `src/shared/providers/messages.ts` (`reasonMessage`, built).
- **Done when:**
  - Refusal `comfy_address_needed`: the message with an "Open Settings" button that shows Settings. Refusal `comfy_job_not_offered`: the message.
  - A failed ComfyUI row shows `reasonMessage(errorReason)` when it has one, with `{address}` filled from `comfy.getInfo`, and the kind's sentence otherwise. `missing_items` lists the items.
  - The first seven reasons also offer "Open Settings": `address_needed`, `no_answer`, `not_comfyui`, `sign_in_needed`, `redirect_refused`, `certificate`, `address_refused`. Each message has Retry.
  - For a provider with `serverText`, "Show the server's message" sends `job.getServerMessage` and draws the reply as text in a plain block under "Message from the ComfyUI server".
  - A provider row whose workflow is `trial` says "trial" beside the provider's name.
  - A ComfyUI run asks for no paid confirm.
- **Tests:** a ComfyUI run asks for no paid confirm; `comfy_address_needed` shows the button and it shows Settings; a `failed` row with reason `out_of_memory` shows that sentence; `missing_items` lists the names; the server's message is drawn as text, and a reply holding `<a href>` shows the characters, not a link.
- **If it must shrink**, cut first: "Show the server's message", then the licence notes and the "left on the server" sentences.
- **Also in this group** (screens, built now under D-084):
  - The address dialog on `comfy_address_needed` (the dialog described for that refusal in `spec/api-commands.md`), in place of sending the user to Settings.
  - A run dialog and Settings screens for ComfyUI that replace what the hand-test screen stands in for: the workflow list with missing items and licence notes per workflow, and the "left on the server" sentences.
  - Whether the run list should say more about a queued agent run that will be cancelled at its turn (after AR-2).

### LD-1 — The commercial-licence dialog [D-088]

- **Class:** D for the dialog and the Settings list, B for the command check. Not security class.
- **Done when:** starting a picture or video run, or a retry, with a workflow whose `licence.commercialNote` is not null shows the dialog described in `spec/comfyui-workflows.md`, "Licence text" ("Commercial-licence dialog"). Cancel starts nothing. Confirm starts the run. The "don't show again for {model}" box saves the model in the settings value `licenceConfirmed`, and Settings lists confirmed models with "Forget". The main process refuses a run of such a workflow that carries no `licenceConfirmed: true` and whose model is not in the saved list, with reason `licence_not_confirmed`, for the user and for an agent.
- **Touches:** the settings schema and its "every key" tests (one new key, an approved edit), `generation.runImages`, `generation.startVideo`, `job.retry` and their input schemas, the reason table in `src/shared/providers/messages.ts`, the generate panel, the video card, the run row's Retry, a new `licence-dialog` component, the ComfyUI section of Settings.
- **Tests:** the dialog shows for H3 and FLUX 3 klein and not for MOSS; Cancel sends no command; Confirm sends the run with `licenceConfirmed: true`; a ticked box saves the model and the next run shows no dialog; "Forget" brings the dialog back; the command refuses without the flag and accepts with it or with the saved model; an agent's run is refused until the model is saved; one offline end-to-end case.
- **Depends on:** group 1. Runs with or after TP-4a (both edit the generate panel and the run row). If the agent-run gate is built first, the gate's tests gain the refusal case.

## Group 5 — Phase 2 screens never built

Each is `[UI]`, built now (D-084), in its own component folder, styled only from tokens.

- **Import by dragging files onto the app window,** with the same choices as any import [REQ: FR-246]. No drop handler exists in `src/renderer`.
- **Blank brief form:** typing a brief from nothing.
- **Editable confirm form.** Only a read-only summary exists (`brief-summary.tsx`). The form lets the user edit the parsed brief before the campaign is made [REQ: FR-023], including a subject ID field (OI-72).
- **Slot view:** filled and empty slots, with candidates from `template.slots`. Today only a slot drop-down in the generate panel.
- **Import, relink and package dialogs.** Today no screen calls `asset.relink` or `project.package`, and `asset.import` is called only from the reference picker. The import dialog shows words for a folder import's `skippedCount`, and the notice for an animated WebP ("this file holds an animation; the app uses its first picture") once slice WP has merged.
- **Project home and campaign view:** today minimal versions exist (`screens/project-home/`, `screens/campaign/`). The campaign view becomes a grid of variants without thumbnails (thumbnails come in Phase 3). Tabs per campaign [REQ: FR-211] and project navigation wait for OI-31.
- **Note only (nuisance, not built unprompted):** the campaign page does not read `campaign.get` again on `project.changed`, and shows no message when `campaign.get` is refused.

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

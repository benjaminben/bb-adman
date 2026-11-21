# ComfyUI: trials, the real-server tests and the hand-test screen

How a shipped workflow becomes `proven`, the real-server test harness `test:comfy`, the hand-test screen's ComfyUI part, what is not built (Krea 2, custom workflows) and what a server needs. The workflows themselves, sizes, video runs and extend are in `spec/comfyui-workflows.md`; the address, the client, the check and failures are in `spec/comfyui.md`.

## Trials and `proven` [REQ: FR-284]

Everything in the adapter is built and tested against the stand-in. A trial on a real server decides: that the graphs run; the real shape of a history entry and of `/api/jobs/{id}` (fixtures are hand-made until then); whether each model fits the server's card and how long a run takes (U-11), and so the time limits; whether references keep a product recognisable (U-17); whether extend works (U-13); the frame rule.

- **Ready for a test:** the check shows nothing missing, and its `test:comfy` and adapter cases passed. It stays `trial`.
- **The owner check, to `proven`** [REQ: 3.3 Maintainability], per workflow: (1) `comfy.check` shows nothing missing; (2) `npm run test:comfy` passes its case; (3) the stakeholder runs it from the test-path screens with dev tools on, at the three default sizes, and accepts what he sees: for a reference workflow with a real product's pictures, and with the smallest and largest reference count; for video with the clip played; and four runs at once. Then a one-line change sets `status: 'proven'` and records `needs.checkedWith`. **No agent sets `proven`.** Not done for any workflow yet.
- **Order of trials.** MiniMax H3 first; MOSS-Image once installed, and nothing waits for it. A failed reference trial sends the choice of model back to the stakeholder [L-2]; a failed extend trial, CQ-27.
- **Not built: time limits after the trial.** See `spec/comfyui.md`, "Limits on every answer".

### Trials on a real server: `test:comfy`

Built, except where marked. Shared harness rules: `spec/testing.md`; variables: `spec/infra-and-settings.md`. The ComfyUI run is separate from the paid one, so it can never spend money or load a paid key.

| | |
|---|---|
| Script | `"test:comfy": "vitest run --config vitest.comfy.config.ts"` |
| Config | `vitest.comfy.config.ts` exports a function and reads `.env.local` only inside it, nothing at the top level, as the live config does |
| Files | `COMFY_INCLUDE = ['tests/comfy/**/*.test.ts']`, in `tests/comfy/env-file.ts` |
| Names taken from the file | One: `COMFY_BASE_URL` (`COMFY_ENV_NAMES`). Not in `LIVE_ENV_NAMES`; the comfy config takes no name from that list. A value set in the terminal wins. |
| No address | Each test skips itself with one line naming the variable |
| Switches, terminal only, never from the file | `ADMAN_COMFY_VIDEO=1` (case 2), `ADMAN_COMFY_MOSS=1` (case 3), `ADMAN_COMFY_FLUX=1` (case 5), `ADMAN_COMFY_FRAME=1` (case 6), `ADMAN_COMFY_REFVIDEO=1` (case 7), `ADMAN_COMFY_PICTURE` (absolute path of a given picture). Each is checked before any call; with a switch unset the stand-in sees nothing for that case. |

- The address goes through `parseComfyAddress`; a refused one is a skip that prints the reason code only. No agent opens `.env.local`.
- **The address is never printed**: not in output, test names, snapshots, errors or reports. Everything printed goes through `hideAddress(text, origin)` (`tests/comfy/print.ts`), which replaces the origin, the host and `host:port` with `[test server]` (one unit test; rare forms, which can only arrive inside the server's own text, are not handled).

**Rules every ComfyUI test follows** [REQ: FR-289]. The test server is someone's working machine and may hold real work.

- A test talks to the server only through `createComfyClient` (and the adapter where a case says so), which has no clearing call. Each test wraps the client in a recorder and ends by asserting the calls made were only the ones it meant.
- A test cancels only an ID it submitted. It never asks for a clean queue. It waits behind other work, with a 30-minute limit per case.
- **Interrupt gate** (security class). On a time-out a case always sends `removeFromQueue` for its own ID. It sends `interrupt` only when all three hold: the run was seen working; `/api/jobs` answered at least once; the version from the case's own check is readable and at least `0.30.0` (a constant in `tests/comfy/`). Otherwise it prints that its own run may still be running, and fails.
- A test removes nothing from the server. Runs are the smallest that prove the point: one option, the smallest size the workflow allows, 56 frames. Each picture run leaves one file in the temporary folder and at most one in `input/adman/`; each video case leaves a file in the output folder that nothing can remove, so one video attempt per graph change. A case runs once per change to its graph, and at most six times in all without asking the stakeholder. A failed run may be re-run once after a fix to its data.
- **What it may print from the server:** a refusal's `type`, `message`, `details`, and per node error the node ID, the app's own `class_type`, `inputName`, `type`, `message`, `details`; a failed run's exception type and message. Control characters removed, cut to 500 characters (`SAFE_LINE_CHARS`), through `hideAddress`. Never the traceback, a received value, or the address.
- **The picture sent.** `ADMAN_COMFY_PICTURE` (rules for pictures given by path: `spec/testing.md`): only its bytes are sent, under `uploadName(bytes)`; its path and file name are never sent or printed. Without it the test makes its own ~768 × 768 PNG of plain shapes with `node:zlib`, never a file from the user's disk, a project or an asset. No JPEG run is made.

**Cases** (`tests/comfy/cases.ts`, `comfy.test.ts`):

1. The check, always. Prints the server version and, per `trial` workflow, "complete" or the missing items by the app's names; if not `ok` although `systemStats` answered, which call failed with its kind, reason and detail; per `draft` workflow, its model files present or missing (GETs only).
2. Video on `h3-text-to-video`, only when nothing is missing: passes when the server accepted the graph, the run ended without error, and the bytes pass `checkMp4` under `MAX_VIDEO_BYTES` (else `checkMp4 refused the clip: <reason>`, a fixed `MP4_REFUSED` name). Prints times, byte size, width, height, duration and sound (a fact, not a pass rule); writes the clip to the system temporary folder and prints the path.
3. Picture on `moss-text-to-image`: passes when `pictureType` says PNG or JPEG; prints time, pixel size, byte size.
4. Field names of the first ended run's history entry and job state: the names the client keeps, no values.
5. Picture from a reference on `flux3-klein-edit-references` through `image.generate`: passes like case 3; writes the result to the temporary folder. Looking at it is a hint, not a pass rule.
6. and 7. H3 from a first frame and from one reference, client level: `uploadImage`, `fillWorkflow`, `submit`, poll, `viewFile` under `MAX_VIDEO_BYTES`, `checkMp4`, a temp file, time and size printed.
8. Not built (P4-9). Cut-out on `birefnet-cutout`, switch `ADMAN_COMFY_CUTOUT=1` (`spec/ai-jobs.md`, "Cut-out").

**Not built: the rest of `test:comfy`.** A cancel case (one cancel of the test's own run, asserting `stopped` or `finished`); a four-at-once case; printing through `cleanServerText` in place of `hideAddress`-only printing. And, after the first real run, a tests-only pass that corrects the stand-in's fixtures to the shapes the real server showed; if a real shape breaks a client schema, stop and report (a client change, ruled on its own).

**Who may run what.** Project agents may run `npm run test:comfy` without asking each time [D-052 answer 22]; that covers this script only. `npm run test:live` runs only when the stakeholder asks [D-049], and no agent makes a paid call. An agent sets a video switch only when its task is the video path. The real-app run `test:e2e:real` is in `spec/testing.md`.

## The hand-test screen's ComfyUI part [REQ: FR-290]

Not built (Phase 2; whether still wanted is OI-64). Dev-only, like `dev.storage`: shown only when `app.getState` says `devTools`, never in a packaged app. Owns the ComfyUI section of `src/renderer/dev/` and `src/main/commands/dev/comfy-extend.ts`. It uses the product commands. The test-path screens with dev tools on stand in for it.

- The address field (`comfy.setAddress`), "Check" (`comfy.check`), the missing items and licence notes per workflow, the "left on the server" sentences.
- A workflow picker that includes `trial` ones: `generation.runImages` and `generation.startVideo` take an optional `workflowId` from `WORKFLOW_IDS`, accepted only when `deps.devTools` is true and the actor is the user; otherwise `INVALID_INPUT`.
- Prompt, size, count, reference pictures from the project's library; for video the start choice and length. Generate. Waiting or working, with the place in the queue. Cancel. The result through `adman-asset://`, a video played muted. "Show the server's message" on a failure.
- Extend: the dev command `dev.comfyExtend { projectId, assetId, width, height, prompt }`, registered only with `devTools`, agent policy deny (the row exists). It enqueues an `image_generation` job whose request has `mode: 'extend'`, with the picture centred on the new canvas. Phase 5's `generation.runFill` replaces it.

## Not built: Krea 2 and custom workflows

- **Krea 2** (OI-58, CQ-27). Nothing is built until MOSS-Image and MiniMax H3 pass their trials. It may provide alternate workflows, including the extend fallback; which jobs it gets is not decided. `job` plus `model` already allow a second model for one job; the run input then gains a model choice. `comfy-workflows/krea2-*.json` are for hand tests only. Its licence limits commercial use.
- **Custom (user-added) workflows** (OI-57, D-058). Not designed. Answered so far: a value the app fills is marked by the step's title set in ComfyUI; an agent may run a listed custom workflow under the ComfyUI tick; pictures and video first, after the stock workflows pass on the test machine; workflows are treated like assets, as external files (CQ-38, differing from FR-309 and FR-326). It needs its own ruling on "the only workflows the app can send" (`spec/comfyui-workflows.md`, "The workflow description") and FR-278, and waits for the analyst's revision 2 of `REQUIREMENTS-ComfyUI-Draft5.md`.

## What a server needs (operator facts)

Update ComfyUI (0.45.0 or later advised); install no add-on. Put the model files of the table in `spec/comfyui-workflows.md`, "Model files", in `ComfyUI/models/{folder}` (from the Hugging Face repos `Comfy-Org/MiniMax-H3`, `Comfy-Org/MOSS-Image`), then restart. Flux reference pictures need only the three Flux files; MOSS-Image is needed only for pictures from a prompt alone. Reference pictures as PNG or JPEG, not WebP.

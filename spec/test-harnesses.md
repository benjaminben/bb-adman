# Test harnesses

The harnesses that run the app or real services: the offline end-to-end harness, the real-service end-to-end harness, the ComfyUI server tests and the live tests, with the rule on paid calls by an agent and the table of what the end-to-end harness reaches. Read with `spec/testing.md` (classes, commands, named tests), `spec/screens.md` (what each screen offers) and `spec/comfyui.md` (the server-test cases).

## Paid calls by an agent [D-085, D-089]

- An agent may make a paid call to prove a new feature works on the real service. One run per feature, at the lowest-cost settings the service offers (smallest size, shortest clip, one picture), with no retries on a paid failure without a changed cause.
- A feature already proven on the real service is not run again. Proven so far: a Gemini picture, a Gemini picture from a reference picture, the S3 upload, list and remove, and one fal.ai Seedance clip from a still (P7-24).
- Everything else uses recorded responses in `tests/fixtures/providers/` or a fake provider row with `local: false`. `npm test`, the offline end-to-end run and CI never make a paid call.
- The keys are in the environment (`.env.local` or the terminal): `GEMINI_API_KEY`, `FAL_KEY`, the AWS names and the Dropbox test token. An agent never opens, prints or copies `.env.local` or a key value. A live test reads the key itself and prints through `tests/live/live-output.ts`, which removes key values.
- The paid Gemini run through the app's screens (`ADMAN_E2E_GEMINI=1`) is still the stakeholder's own, when they choose [D-081].
- Each paid run an agent makes is listed in its report: what was called, the settings, and the result.
- Proof on real services outranks screens: picture and video from realistic product references are proved on real services even before their screens exist (D-075).

## Runs on the real ComfyUI server [D-092]

A real ComfyUI run takes minutes, so it is not routine testing.

- **Routine checks never touch the real server.** A slice's checks are lint, typecheck, `npm test`, the build and the offline end-to-end run. ComfyUI behaviour is tested there against the stand-in (`tests/helpers/comfy-stand-in.ts`).
- **A new ComfyUI feature is proven once** on the real server, with the smallest size and the shortest clip, by the slice that builds it. After that it is not run again by later slices.
- **Before a large chapter is declared complete** (a phase, or the whole first build), one full real run is made: `npm run test:comfy` and `npm run test:e2e:real` with every ComfyUI switch on, once.
- Proven on the real server so far: a FLUX 3 klein picture. Not yet proven: video from a prompt, from a first-frame picture and from a reference picture, extend, cancel, four runs at once, and an agent's run.

## Offline end-to-end harness

Built. `tests/e2e/`, `npm run test:e2e`.

- Specs: `phase1.spec.ts`, `window.spec.ts`, `csp.spec.ts`, `asset-protocol.spec.ts`, `comfy-stand-in.spec.ts` (stand-in ComfyUI on `127.0.0.1`), `screen-tour.spec.ts` (rows that need no stand-in). Helpers: `launch.ts`, `screens.ts`, `screen-tour.ts`, `stand-in-runs.ts`, `stand-in-uploads.ts`, `video-screens.ts`, `gemini-stand-in.ts`; the stand-in server is `tests/helpers/comfy-stand-in.ts`.
- `playwright.config.ts` leaves `tests/e2e-real/` out; a config test pins that.
- `launch.ts` sets `ADMAN_USER_DATA_DIR` to a sandbox folder and `ADMAN_FAKE_PROVIDERS=1`, with a mock keychain.
- **Native file dialogs** are stubbed by replacing `dialog.showOpenDialog` in the main process via `electronApp.evaluate`; no app code change; a stubbed path is never printed. "Add pictures" links originals read only (`copy: false`) in the sandbox project, deleted after the run.
- **Main-process `fetch` stub** (via `electronApp.evaluate`) is allowed offline only, answering only the Gemini request locally; never in `test:e2e:real`. It proves the key dialog and paid Retry screens, not the adapter.
- **Offline video fixture:** a small made-up H.264 clip (`tests/fixtures/video/grey-clip.ts`), made by the test author, no real footage or sound.
- A first-frame start offline: the stand-in sees one upload named `uploadName(...)` of a PNG at the run size, and the result plays (proves `nativeImage` in `fitPicture` is really used). The offline video case ends with the `video` element's `readyState` at 1 or more (proves the CSP and the asset protocol in the built app).
- `tests/e2e/comfy-stand-in.spec.ts` is at 253 lines. The next slice that adds a case splits it (for example `comfy-stand-in-video.spec.ts`).

## Real-service end-to-end harness

Built. `tests/e2e-real/` (`global-setup.ts`, `guard.ts`, `pictures.ts`, `real-env.ts`, `real-server.spec.ts`, `real-steps.ts`, `run-checks.ts`, `switches.ts`), `npm run test:e2e:real`.

- **`playwright.real.config.ts`** exports an object; `globalSetup` (`tests/e2e-real/global-setup.ts`) reads only `COMFY_BASE_URL` (terminal or `.env.local`); `workers: 1`, `retries: 0`; `trace`, `screenshot`, `video` all `'off'`; reporter `list` only. The setup accepts only the npm script's command line (refuses UI mode, test server, editor extension), refuses `PW_TEST_REPORTER`, any non-empty `DEBUG`, another reporter or any recording, and refuses watch mode (any non-empty `PWTEST_WATCH`), which would run a paid case again on each file save. Each test checks again in its worker before the app starts. Config test: `tests/unit/config/e2e-real-config.test.ts`.
- **Launch.** `launchReal(box)` in `launch.ts` leaves out `ADMAN_FAKE_PROVIDERS` and sets `ADMAN_DEV_TOOLS=1`; an unpackaged Playwright launch has `devToolsOn` true, so `trial` workflows are offered. Sandbox folders and mock keychain as offline.
- **The address.** Typed into Settings' "Server address"; never in a test name, locator, `expect` on a value, or printed line. Every step holding it runs in a guard that rethrows one fixed sentence with no cause; a failure prints the step's name only. Reports list cases and times, never the address or a path.
- **Switches** (terminal only; with none, only Settings, Check runs):

| Variable | Case |
|----------|------|
| `ADMAN_E2E_FLUX=1` | Picture from one product reference |
| `ADMAN_E2E_MOSS=1` | Picture from a prompt |
| `ADMAN_E2E_CANCEL=1` | Start MOSS, cancel from its row |
| `ADMAN_E2E_VIDEO=1` | Clip from a prompt |
| `ADMAN_E2E_VIDEO_FRAME=1` | Clip from a first-frame picture |
| `ADMAN_E2E_VIDEO_REF=1` | Clip from a reference picture |
| `ADMAN_E2E_GEMINI=1` | Paid Gemini run. Stakeholder only |
| `ADMAN_E2E_PICTURES` | Up to three absolute picture paths (see "Picture by path") |

- Picture cases use the first path of `ADMAN_E2E_PICTURES` or the test-made picture. Without the Gemini switch the test opens the paid confirm and presses Cancel. The Settings case asserts the version line and a result on each workflow row; each run case first asserts its own workflow shows "Complete" and fails before any run if not.

## ComfyUI server tests

Built. `tests/comfy/`, `vitest.comfy.config.ts`, `npm run test:comfy`. The design of the cases and the interrupt rule are in `spec/comfyui.md` (server tests); this part holds the rules for running them.

- One server address name, `COMFY_BASE_URL`, in `.env.local` (read by `tests/comfy/env-file.ts`) or the terminal. Cases talk to the server only through `createComfyClient` (and the adapter where a case says so). The harness owns nothing under `src/`; its poll interval and waits are constants in `tests/comfy/`. One case at a time (`fileParallelism: false`).
- Project agents may run `npm run test:comfy` without asking each time. They do not open `.env.local` and never print the address. Nothing they run can clear the server's queue or history or remove a file: the client has no such call.
- **Switches,** read from the terminal only, never from the env file, and checked before any call. A plain run runs only case 1, the check.

| Variable | Case |
|----------|------|
| (none) | 1, the check |
| `ADMAN_COMFY_VIDEO=1` | 2, video from a prompt (`h3-text-to-video`) |
| `ADMAN_COMFY_MOSS=1` | 3, MOSS picture from a prompt |
| `ADMAN_COMFY_FLUX=1` | 5, Flux picture from a reference (`flux3-klein-edit-references`) |
| `ADMAN_COMFY_FRAME=1` | 6, H3 video from a first frame |
| `ADMAN_COMFY_REFVIDEO=1` | 7, H3 video from one reference |
| `ADMAN_COMFY_PICTURE` | One absolute picture path for the picture cases |

  Tests: `tests/unit/config/comfy-env-file.test.ts` (no switch name is taken from the file), `tests/integration/comfy-run/cases.test.ts` (with the switch unset, the stand-in sees nothing for that case).
- **What it may print from the server:** for a refused graph, the refusal's `type`, `message`, `details`, and per node error the node ID, the `class_type` from the app's own graph, `inputName`, `type`, `message`, `details`. For a failed run, the exception's type and message. Each text has control characters removed, is cut to 500 characters (`SAFE_LINE_CHARS`), and goes through `hideAddress` (`tests/comfy/print.ts`). Never the traceback, a received value, or the address. Case 4 prints only the field names the client keeps.
- **Time:** a picture case waits up to 30 min, a video case up to 60 min. A case that runs out of time cancels its own run, by its own ID, under the interrupt rule in `spec/comfyui.md`, and fails.
- **Limits on the stakeholder's server** (it is also his working machine): tests clear or delete nothing. Only the test's own run is ever cancelled or interrupted. Each run leaves one file in the server's temporary folder and at most one in `input/adman/`. A case is run once per change to its graph, and at most six times in all without asking the stakeholder. One video attempt per graph change, because each clip leaves a file nothing can remove. A failed run may be re-run once after a fix to its data.
- **The test's own picture** is made by the test in `tests/comfy/`: a ~768 × 768 PNG of plain coloured shapes written with `node:zlib`. Never a file from the user's disk, a project or an asset. `tests/comfy/cases.ts` says, word for word: "No JPEG run is made; the only JPEG in tests/ is a 1×1 picture inside a Gemini fixture."
- Looking at a result picture is a hint for the stakeholder, not a pass rule.

## Live tests

Built. `tests/live/`, `vitest.live.config.ts`, `npm run test:live`. Real paid calls. Never run by `npm test` or CI. An agent runs one live test file only under the rule at the top of this file: once, to prove a new feature.

- The files in `tests/live/`:
  - Gemini, with `GEMINI_API_KEY`: `gemini-image.live.test.ts`, `gemini-reference.live.test.ts`, `gemini-brief.live.test.ts`, `gemini-copy.live.test.ts`, `gemini-layout.live.test.ts`, `gemini-extend.live.test.ts` (picture extend, P5-6), `gemini-translate.live.test.ts`.
  - fal.ai Seedance, with `FAL_KEY`: `seedance.live.test.ts` (P7-24; its one run is done and is never repeated).
  - S3: `s3.live.test.ts`, with `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `ADMAN_LIVE_S3_BUCKET`, `ADMAN_LIVE_S3_REGION`, `ADMAN_LIVE_S3_PREFIX`.
  - Dropbox, with `DROPBOX_ACCESS_TOKEN`: `dropbox.live.test.ts` (P9-15; the stakeholder's, never run by an agent).
  - Values come from the terminal or `.env.local`; the terminal wins.
- `npm test` never reads `.env.local`. `vitest.live.config.ts` exports `defineConfig(() => ({ … }))` and reads the file only inside that function; `include: LIVE_INCLUDE` from `tests/live/env-file.ts` (`['tests/live/**/*.test.ts']`), which also holds the name list and `liveEnvFrom`. The top level of the config reads nothing; a reviewer checks it by reading. `vitest.live.config.ts` imports `./tests/live/env-file.js`.
- Everything printed goes through `tests/live/live-output.ts`, which removes the set values of `LIVE_REDACTED_NAMES` = `GEMINI_API_KEY`, `FAL_KEY`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `DROPBOX_ACCESS_TOKEN`, `DROPBOX_APP_SECRET`. Bucket name, prefix and region are kept. A skip message names only the missing variables. A failed live test throws a short error holding the error kind only ("Gemini error" when it is not a `ProviderFailure`). The S3 test prints a failure only when the case did not expect one.
- `ADMAN_LIVE_KEEP=1` makes the S3 test skip its final remove, leaving `adman-hand-test/hello.txt` in the bucket; the next run without it removes it.
- The Gemini test writes the picture with its real extension and prints the file type and pixel size only.
- `ADMAN_LIVE_REFERENCE_FILES`: up to three absolute picture paths for the reference test (see below).

### Picture by path

`ADMAN_LIVE_REFERENCE_FILES` (`test:live`, up to three paths), `ADMAN_COMFY_PICTURE` (`test:comfy`, one path), `ADMAN_E2E_PICTURES` (`test:e2e:real`, up to three paths):

- Absolute paths, terminal only, never read from `.env.local`. Read once into memory. A blank variable counts as unset (the test-made picture is used).
- Refused with one fixed line each: a path not absolute, a file over `MAX_PICTURE_BYTES`, bytes `pictureType` does not call PNG or JPEG, a picture over 1,600 px on its long side, "could not be read", "pixel size could not be read". A fixed line is constant text per reason, with no path, file name, cause or system error text. The size and long-side lines ask for a smaller copy made outside the repo.
- Only the bytes are sent (to ComfyUI under `uploadName(bytes)`, to Gemini as the reference part). Path, folder and file name are never sent, printed, put in a result file name or a report. Lines say "the given picture" or "the test-made picture". Bytes go as they are, metadata included (F-9: whether the app should strip EXIF is open).

## What the end-to-end harness reaches

Every function the built screens offer, and whether end-to-end tests reach it. "Offline" = `test:e2e` (stand-in or fake providers); "real" = `test:e2e:real`. Screens are described in `spec/screens.md`.

| Screen | Function | Reached | How or why not |
|---|---|---|---|
| Shell | Project tabs, Settings button, Hand test button (dev) | Yes, offline | Clicks |
| Shell | Error banner, Dismiss | Yes, offline | Made by a refused action, for example a bad ComfyUI address |
| Start | New project: name, Change location, Create project | Yes, offline | Dialog stub for the location |
| Start | Open project… | Yes, offline | Dialog stub |
| Start | Recent projects, Open | Yes, offline | Click |
| Settings | Change default location | Yes, offline | Dialog stub |
| Settings | Keys: Add, Replace, Cancel, Save, Delete | Yes, offline | Made-up values, mock keychain |
| Settings | Provider defaults (each job's select) | Yes, offline | Select |
| Settings | ComfyUI address: Save, Remove, refusal shown | Yes, offline and real | Typed inside the guard |
| Settings | ComfyUI Check and its result per workflow | Yes, offline and real | Real check sends GETs only |
| Settings | Agent access (MCP): switch, port, Connect panel, Copy, refusal lines | No | Component tests only: `tests/unit/renderer/screens/settings/mcp-section*.test.tsx` |
| Settings | Agent runs: one tick per provider, the limit | Not built | Planned: offline, by clicks; no agent and no run needed |
| Settings | Cloud storage, S3 part (`s3-section/`) and "Test connection" (`s3-check/`) | No | Component tests (`tests/unit/renderer/screens/settings/s3-section.test.tsx`, `s3-check.test.tsx`); `checkS3Access` against a stand-in request handler. A real bucket by hand only |
| Settings | Approvals service (`approvals-section/`): address, key, Test connection | Yes, offline | `tests/e2e/approvals.spec.ts` offline, plus component tests (`approvals-section.test.tsx`); `npm run test:approvals-local` is the local proof with the real service |
| Key dialog | Save and continue, Cancel | Yes, offline | Opened by Generate with no key |
| Project home | Close project | Yes, offline | Click |
| Project home | Load a brief, brief summary, Create campaign, Cancel | Yes, offline | Dialog stub with a brief from `tests/fixtures/briefs/` |
| Project home | Campaign list, Open | Yes, offline | Click |
| Campaign | Back to project, variant choice | Yes, offline | Clicks |
| Make pictures | Provider, slot, prompt, count, Generate | Yes, offline and real | Real: ComfyUI only by default |
| Make pictures | Reference pictures: tick, Add pictures | Yes, offline and real | Dialog stub with product photos |
| Make a video | Provider, prompt, length, Start, the playing result | Yes, offline and real | Stand-in; real with `ADMAN_E2E_VIDEO=1` |
| Make a video | From a picture: Start from, picture choice, Add pictures, Start | Yes, offline and real | Stand-in; real with `ADMAN_E2E_VIDEO_FRAME=1` and `ADMAN_E2E_VIDEO_REF=1`, one attempt each |
| Paid confirm | Confirm, Cancel | Cancel: yes. Confirm: only with `ADMAN_E2E_GEMINI=1` and the stakeholder's yes | Paid |
| Run list and row | Waiting, working, done, failed states; the result picture | Yes, offline and real | Failure states offline only, through the stand-in |
| Run row | Cancel | Yes, offline; real with `ADMAN_E2E_CANCEL=1` | Own run only |
| Run row | Retry, with the paid confirm for a paid provider | Yes, offline | A failed stand-in run |
| Hand test (dev) | Storage on this computer: Upload, List, Remove all | Yes, offline | Sandbox app data folder only |
| Hand test (dev) | Amazon S3 settings and actions | No | Needs real credentials and a real bucket. "Remove all" on a real bucket is destructive, so it is never automated. By hand only |
| Hand test (dev) | Sign in to Dropbox | No | Hidden on `main` (`HAND_TEST_DROPBOX` is false). Sign-in runs in the web browser. By hand only |

Project files in these runs are made at the newest migration, `0005_video_and_sound` (schema version 6). The approvals service in `approvals-service/` is a separate Next.js app with its own Vitest and Playwright runs (`spec/approvals-service-tests.md`).

**Gaps:** S3 and Dropbox (above). The MCP section (component tests only). The paid Gemini run through the screens (the stakeholder's own, D-081). Real-server failure screens (out of memory, server stopped) are tested offline only, since they cannot be caused on purpose without harm. A packaged app is not tested end to end, because `trial` workflows are never offered there.

**Not verified:** EXIF rotation. A turned clip from a phone photograph is out of scope until one is seen. Whoever runs `ADMAN_E2E_VIDEO_FRAME=1`, and the stakeholder's first app run from a phone photograph, check it. If one comes out turned: a security-class fix in `src/main/picture-fitter.ts` turns it upright from its orientation tag before the crop, with one test.


# Review leftovers

Every finding from the Phase 2 review reports that nothing in the code or the spec has handled yet, checked against the code on `main`.
Each item is removed from this file when it is done. The review reports themselves are gone; this file replaces them.

Source names: "CU4-Fixes OQ 2" means the report `REVIEW-Phase2-CU4-Fixes.md`, its open question 2. "Phase 1 review" means `REVIEW.md`.

## Fix now

Heaviest first.

### FN-4. Retry's confirm line shows the stored count, not what retry asks for

- Source: SliceH Q6.
- Files: `src/renderer/screens/campaign/run-row/run-row.tsx` (the paid confirm line, `count={requestCount(row)}`).
- What is wrong: `job.retry` on a picture job that kept pictures asks only for the rest (`spec/jobs.md`, "Retry"), but the run row's paid confirm line still shows the stored request's `count`.
- Done when: for an `image_generation` row the confirm line shows `picturesLeft(requestCount(row), row.result)` (`src/shared/generation/pictures-left.ts`). Other rows are unchanged. A renderer test: a cancelled row with `count: 4` and two kept asset IDs shows 2.
- Class D. Security class: no.
- Built in slice S2-5 of `spec/phases/phase-02-screens.md`, which owns the run row. Removed from this file when S2-5 merges.

## Fix with a later phase

### Phase 7 (Video and timeline)

#### LP-2. Two owners of the "cancel answered unknown" wait for video

- Source: CU6a D3, and CU6a missing test.
- Files: `src/main/jobs/kinds/video-generation.ts:78-99` (`untilDone`, line 90-91).
- What is wrong: after a cancel, the video kind ends itself with `ProviderCancelled` once `cancelWaitFor(provider)` passes. The runner reads that as `stopped`, so the job ends `cancelled` without `outcomeUnknown`. `spec/cancel.md`, "`job.cancel`", makes the runner's timer the one owner (outcome `unknown`, `outcomeUnknown: true`). Which timer wins depends on timing. The kind also ignores the runner's `cancelWaitMs` test option.
- Done when: the kind does not time the wait itself; the runner's timer ends it. Test: a video job with the fake set to `onCancel: 'no_confirm'` ends `cancelled` with `result.outcomeUnknown === true` and no asset. (Today `no_confirm` is used only with `generative_fill` and fake jobs.)
- Security class: no.

### Phase 8 (Export and reports)

#### LP-3. A language tag from the project file goes into an export file name

- Source: SliceC, unverified.
- Files: `src/shared/schemas/commands/campaign.ts:36` (`languages: z.array(z.string().min(1))`); `src/shared/schemas/rows/campaign.ts:16`; export path pattern `{outputDir}/{campaignId}/{postTitle}/{sizeLabel}/{language}-{variantId}.{ext}`.
- What is wrong: a language is any non-empty text, read from the project file. `postTitle` is cleaned; nothing says `{language}` is. A hostile project file could put `/` or `..` in a language and make export write outside the chosen folder.
- Done when: export checks each part of the path built from project-file values (language, size label, IDs) against a strict pattern (for example BCP 47 letters, digits and `-`), refuses others, and checks the final path is inside the chosen folder. The security table of project-file values gets a row for it. Tests: a project with language `../x` and one with `a/b`; export refuses, nothing is written outside the folder.
- Security class: yes (destructive: write outside the chosen folder).

#### LP-4. A size label is not checked against its pixels

- Source: SliceC, unverified.
- Files: `src/shared/schemas/commands/campaign.ts:12-16` (`CampaignSize`), `src/main/commands/campaign/create.ts:108-130`.
- What is wrong: `campaign.create` accepts `{ label: '1x1', width: 1080, height: 1920 }`. "One pixel size, one label" is checked only in `parseSize`, which the window uses. An agent can send a mismatched size. Export uses the label as a folder name.
- Done when: `campaign.create` and `campaign.update` refuse a size whose label does not match its pixels (same rule as `parseSize`). Test: one mismatched size is refused with `INVALID_INPUT`.
- Security class: no.

#### LP-5. Workflow and model details do not reach the asset row

- Source: CU4-Fixes observation.
- Files: `src/shared/schemas/rows/asset.ts:23-26` (only `genRunId`, `genProvider`, `genModel`, `genPrompt`); `src/main/jobs/kinds/image-generation.ts:78-81` (writes `models` and `workflow` into the PNG only).
- What is wrong: `spec/export-and-checks.md`, "Embedded generation details", says the PNG's details are also stored on the asset row. `models` and `workflow` are in the PNG only. The report (FR-150) may need them.
- Done when: the report phase decides whether the report reads them from the row (add columns) or from the PNG, and the spec says which. A test checks the report shows the workflow ID and version for a ComfyUI picture.
- Security class: no.

### Phase 9 (Cloud publishing)

#### LP-6. S3 socket limits may cut off a large upload

- Source: SliceF observation 9.
- Files: `src/main/providers/s3/client.ts:19` (`connectionTimeout: 10_000, requestTimeout: 60_000`).
- What is wrong: the figures are in no spec line. If `requestTimeout` limits the whole request rather than idle time, a large upload over a slow line fails at 60 s.
- Done when: the publish slice confirms how the handler applies `requestTimeout`, sets figures that fit a large video upload, and records them in the spec. Test: a stand-in server that accepts a body slowly but steadily for longer than the limit does not cause a failure, while one that goes silent does.
- Security class: no.

### Phase 10 (MCP server)

#### LP-7. `get_project`'s description does not name every field it returns

- Source: MCP-B item 6.
- Files: `src/main/mcp/tools/table.ts` (the `get_project` description); `src/main/mcp/tools/project-replies.ts` (`projectFields`).
- What is wrong: the picker names its fields, and they include `meta` (project ID, name, schema version, app version, created time) and `missingAssetCount`. The description says only "its subjects and a summary of each campaign".
- Done when: Phase 10 decides whether `meta` and `missingAssetCount` stay; the description and the tool table in `spec/mcp-and-agents.md` name what the picker gives.
- Security class: no (the allow-list is built).

### Phase 11 (README, example set and release)

#### LP-8. CI has never run

- Source: Phase 1 review, first pass.
- Files: `.github/workflows/ci.yml`; key-shaped test values in `tests/integration/commands/secret.test.ts:10,96,123`, `tests/integration/providers/require-keys.test.ts:48`, `tests/e2e/phase1.spec.ts`.
- What is wrong: the repo has no remote, so gitleaks, the macOS and Windows test matrix, the letter-case test and the Windows `.bak` copy test have never run.
- Done when: before the first push, run gitleaks locally over the history and either allow-list the made-up key values or change them; the first CI run passes on both systems.
- Security class: partly (gitleaks guards against a real key in history).

#### LP-9. Example files under an ignored assets folder may not be committed

- Source: Phase 1 review, unverified observation 6.
- Files: `.gitignore:5-6` (`* Assets/` then `!examples/**`).
- What is wrong: git does not re-include a file whose parent folder is excluded, so `examples/Foo Assets/x.png` may stay ignored.
- Done when: `git check-ignore -v` on an example asset path shows it is not ignored, with the rule fixed if needed.
- Security class: no.

#### LP-10. No app icon

- Source: Phase 1 review, unverified observation 8.
- Files: `electron-builder.json:7` (`buildResources: "resources"`); `resources/` is empty.
- Done when: the release phase adds the icon files and a packaged build shows them.
- Security class: no.

## Test gaps

| Test or file | What is not pinned | Security guard | Source |
|---|---|---|---|
| `tests/unit/main/providers/gemini/image.test.ts` | A key echoed in the claimed type of a "not a PNG or JPEG" answer is redacted from the failure detail | yes | GeminiPictureType F-06 |
| live-config guard (`tests/unit/config/live-config.test.ts`) | No direct read of `.env.local` in `tests/unit`, `tests/integration`, `tests/e2e` | yes | GeminiPictureType F-09 |
| `tests/e2e-real/real-server.spec.ts:36` | `workerRefusal` gets no `trace`, `screenshot`, `video` fixtures, so a file-level `test.use({ trace: 'on' })` is not caught | yes | E2E-R-Fixes-2 S-E |
| `tests/unit/config/e2e-real-config.test.ts` | That `global-setup.ts` calls `commandRefusal` and deletes the marker first, and `beforeEach` calls `workerRefusal` before `makeSandbox` | yes | E2E-R-Fixes-2 S-F |
| `tests/integration/generation/image-kind-errors.test.ts:66-71` | The H4-2 log check reads only lines holding the job ID; a log line with a path and no job ID passes | yes | H4 O-3 |
| `tests/unit/main/mcp/tools/table.test.ts:59-70` | `lostKeys` compares schema objects by identity; two clashing keys sharing one schema object are not caught. Compare key counts | yes | MCP-Followup F-1 |
| `tests/integration/commands/mcp-port-change.test.ts` | The old session ID gets 404 after a port-change restart | yes | MCP-A-Fixes item 6 |
| `tests/unit/renderer/screens/settings/comfy-section.test.tsx:36` | Filters to `comfy.*` commands, so it does not prove the address goes into no other command (`settings.update`) | yes | TP-3 |
| `tests/unit/main/providers/local/local-storage.test.ts:37,40,50` | `/refused/` matches loosely; the one-folder-down test has no `remove` case; a dangling link as the last path part has no case | yes | SliceF-RunBC B-04, B-05 |
| `tests/unit/main/providers/comfyui/workflows.test.ts:9-20` | `pointersOf` skips `alwaysDrop`, so a typo there is a silent no-op and the server is asked to load a picture never uploaded. Also add: a spec with `alwaysDrop` must have `references` (`fill.ts:71` runs it only inside `fillReferences`) | no (guards what the server loads) | CU6r-2 D-3, D-4 |
| `tests/integration/commands/comfy-check.test.ts:111` | `EmptyHunyuanLatentVideo` is named by no workflow, so that line cannot fail | no | CU6r-2 D-1 |
| `check-case-drafts.test.ts` | The draft line for a file no trial needs; add a unit case calling `draftFileLines` with a draft-only spec | no | CU6r-2 D-2 |
| `tests/integration/commands/job-retry-comfy.test.ts:47-54` | The new job's status is `queued` | no | CU4-Fixes OQ 2 |
| ComfyUI video adapter (`video.ts`) | `viewFile` uses `MAX_VIDEO_BYTES`, not the picture limit | no | CU6a test gap |
| picture fitter tests | `crop` or `resize` throwing; an image empty after the crop | no | CU6b-F test gaps |
| `video-picture.test.tsx:74,80,81` | Uses made-up refusal text, not `COMFY_VIDEO_NOT_OFFERED_MESSAGE` and `videoTooLongMessage(15_000)` | no | CU6b-R item 11 |
| `tests/comfy/target.ts:8` | `TEST_OWN_PORTS` lacks the app's MCP port, so `test:comfy` accepts an address on it | no | CU6r-1 unverified |
| `tests/e2e/screen-tour.ts:52-53` | Only the image provider select is used; Layout, Text and Video selects are not | no | E2E-R D-4 / S-4 |
| `tests/unit/renderer/screens/settings/mcp-section.test.tsx:93` | `vi.restoreAllMocks()` is in the test body, not `afterEach`; the token check is not repeated after "Make a new token" | no | MCP-C fix 6 |
| `mcp-section-copy.test.tsx` | Refused-query test checks only the switch, not the port field or "Make a new token"; the clipboard mock (line 15) is never undone | no | MCP-C2 fixes 1, 2 |
| `tests/unit/renderer/fake-api.ts:20` | `baseState` saves `video: 'comfyui'` with no available `comfyui` provider, so an enabled video choice cannot be shown | no | MCP-Followup item 5 |
| `tests/unit/main/providers/comfyui/client-time.test.ts` (RF-1 tests 1, 2) | Depend on a 32 MB body being larger than loopback buffers; may fail on a machine with larger buffers | no | RF0-RF1 N-1 |
| `tests/integration/assets/asset-add-generated.test.ts` | `model` input absent, empty, and over 200 characters (only "given" is covered) | no | RV1 unverified 3 |
| package exit test, e2e protocol test | Opens the moved project with `openProjectFile`, not `project.open`, and compares no bytes; the closed project's picture is not shown loaded first | no | SliceA test limits |
| `src/main/jobs/runner.ts:81-91` | `markSeen` sends no event when the command rolls back after the mark | no | SliceD-Rest R-05 |
| `src/main/jobs/kinds/image-generation.ts:162-163` | A project closed while a picture job runs | no | SliceH untested case 1 |
| `tests/unit/main/providers/s3/environment.test.ts` | Six variables `client.ts` overrides (`AWS_DISABLE_S3_EXPRESS_SESSION_AUTH`, `AWS_REQUEST_CHECKSUM_CALCULATION`, `AWS_RESPONSE_CHECKSUM_VALIDATION`, `AWS_SIGV4A_SIGNING_REGION_SET`, `AWS_AUTH_SCHEME_PREFERENCE`, `AWS_SDK_UA_APP_ID`) are not set in the test | no (none changes the host) | SliceF observation 1 |
| `src/renderer/stores/job-store.ts:62` | Two `job.list` loads answered out of order; removing `read !== reads` fails no test | no | TP-2 |
| `reference-picker.test.tsx:117-136` | A refused import carries no IDs, so code that ticks on a refusal still passes | no | TP-5 test 14 |

## Spec wording

The code is right; the spec rewrite should describe it.

- `WorkflowInfo`, `WorkflowId`, `WorkflowNeeds` live in `src/shared/schemas/queries/comfy.ts`; `WorkflowSpec` is `WorkflowInfo & {...}` in `workflows/types.ts`. (CU3 DV-2)
- `src/shared/schemas/commands/comfy-check.ts` belongs to the ComfyUI check work. (CU3 DV-3)
- `fitSize` throws on a size that is not two whole numbers above zero. (CU3 DV-4)
- "No adapter function takes a workflow from its caller" means production callers; `offeredWorkflow`, `checkServer`, `comfyCheck` take a list with a default for tests. (CU3 architect item 8)
- Reference and first-frame names are checked with `isSubfolder` only and need no `adman/` start; they can point only inside the server's input folder. (CU3 architect item 10)
- `poll.ts`, `cancel.ts`, `own-ids.ts` are part of the ComfyUI adapter. (CU4 cosmetic deviation)
- `framesOf` takes the error itself, not its message and a flag. (ListAA AA1-b)
- The token lives in `McpSection` state, not the Connect panel's. (MCP-C D-1)
- `src/main/queries/campaign-reads.ts` is a campaign query helper. (SliceC C-03)
- Slice C choices built as is: right-to-left refusal is `RULE_VIOLATION`; unknown `templateId` is `NOT_FOUND`; `brief.parse` "no file" is `NOT_FOUND`, "unreadable" is `RULE_VIOLATION` `file_not_readable`; hero image from the first subject in brief order that has one; a `callToAction` of only spaces gives no layer and is stored as given; master variant `format: 'image'` with one `variant_subject` row per subject; `ruleSet.copyFrom` does not re-check required assets; required assets may be any kind and either library; `ruleSet.*` create a missing `rule_set` row; `project.get` summary fields and sort orders; `template.slots` falls back to the starter template; `subject.create` `description` defaults to `''`; `subject.delete` names asset rows the schema clears. (SliceC developer choices, fix 5)
- The security table of project-file values needs rows for `job.request`, `job.provider` (reach a provider request in `image-generation.ts`) and `assets_dir_*` (reaches a read in `add-generated.ts`). (SliceH H-22)
- `createdAt` in PNG details is `toISOString()`, with milliseconds. (SliceH H-21)
- `frameOffset` lives in `src/shared/schemas/queries/comfy.ts:35`. (WorkflowData DV-1)
- `campaign-view.tsx` is a TP-5 file. (TP-5 DV-1)
- The hostile-variable list for network clients could name `NODE_EXTRA_CA_CERTS`; see Accept for why no work follows. (CU2 unverified)

## Accept

- `NODE_EXTRA_CA_CERTS` cannot be switched off: whoever sets the app's environment already controls the account. (CU2 unverified)
- S3 client and `HTTPS_PROXY`, `NODE_TLS_REJECT_UNAUTHORIZED`, `NODE_EXTRA_CA_CERTS`: same reason; also S3 signs requests, so the secret key itself never crosses the wire. (SliceF unverified)
- Version reading ignores a pre-release suffix (`0.43.0-rc1` reads as 0.43.0) and gives one "newer" note per reply: edge case, no harm. (CU3 architect item 9)
- `versionAtLeast` in `tests/comfy/version.ts` treats `0.30.0-rc1` as 0.30.0: test harness only, real server is 0.45.0. (CU5a-Fixes OQ 2)
- `answers.ts:70-76` assigns server-named keys on a plain object, so `__proto__` changes only that object's prototype; it is read by its own keys, no effect found. (CU4 observation)
- `frames` added to fill values without a slot check (`video.ts:121`): `fillWorkflow` refuses before anything is sent, with a plain `Error`. Cosmetic. (CU6a D5)
- `checkMp4` gives a `RangeError` on an empty last `tkhd`/`mvhd` box: nothing outside the buffer is read and callers turn it into `bad_result`. (CU6a D6)
- `pngConverter` has no `try` around decode: `nativeImage` returns an empty image rather than throwing. (CU6b-F note)
- Any `ProviderCancelled` from an adapter ends a picture job `cancelled`, even with every other picture stored (`onePicture` in `image-generation.ts`): every adapter throws it only after the stop signal fires. Revisit if an adapter ever throws it on its own. (SliceH unverified)
- A picture start is offered whatever its workflow's status; refused at Start. Nuisance. (CU6b-R item 10)
- `tests/comfy/video-facts.ts:38` keeps `{ cause: error }`; the cause is a fixed message. Cosmetic. (CU6p item 1)
- `tests/e2e/launch.ts` imports from `tests/e2e-real/`; `tests/e2e-real/pictures.ts` repeats `given-picture.ts`. Cosmetic. (E2E-R S-5)
- `afterEach` throws on `box.root` after a worker refusal (`real-server.spec.ts:50`). Nuisance. (E2E-R-Fixes-2 S-G)
- JPEG reader trusts the first frame header: worst case is a large decode, a nuisance. (Fixes-LM U-1)
- A hard link in the hand-test folder is not seen by `lstat`: dev tools only, needs write access to app data, removed in Phase 9. (Fixes-LM U-2)
- `run-images.ts` imports the request type, not the schema. Cosmetic. (H4 H41-3)
- `ensureAssetsDir` treats any `lstat` error as "nothing found" (`service.ts:71`): the real-path check and `mkdir` that follow still keep it inside the project folder. (H4 O-4)
- A second typed key can stay in the key row's state after the first save (`key-row.tsx:24`). Nuisance. (KeyRowFix item 2)
- The key dialog keeps typed values until `finish()` (`key-dialog.tsx:18-33`): the value stays in the user's own window in a password field; no new reader. R-10 stands as written. (KeyRowFix item 3)
- Brief bad-line cleaning keeps U+061C (`src/shared/brief/bad-line.ts:9-17`): it can only reorder text in the user's own error message. One-line fix if brief code is touched. (ListAA U-1)
- An error with a non-string `message` keeps the whole stack (`job-error-log.ts:22-27`): no real path makes one. (ListAA U-2)
- The old connect line, with the dead token, stays in `ConnectPanel` copy state until the next copy: the token no longer works. (MCP-C2 note 1)
- "Copy did not work..." has no `role="status"`: fold into the UI pass. (MCP-C2 accessibility note)
- `reply-keys.test.ts:27` comment says only object keys are checked; record keys are too. Cosmetic. (MCP-Followup cosmetic)
- `client-time.test.ts` is 207 lines: under the 300 maximum. (RF0-RF1 D-1)
- Chromium may strip a `#fragment` before the `adman-asset://` handler: the same file is served, no new access. (SliceA unverified)
- `repointedAssetIds` can name a row already in the new folder (`assets-dir.ts:40-58`): reply detail only. (SliceA unverified)
- An AWS unhandled rejection in the live test would print raw: no path found. (SliceF-RunBC unverified)
- Paid Retry's confirm line does not say it re-sends the reference pictures: the user still confirms the cost. (TP-5 Q1)
- The Flux spec has no "first-run size" line in `source.changes`. Cosmetic. (WorkflowData DV-2)
- The brief summary shows planned size labels and languages and does not mark defaults: for the UI pass. (TP-1 F7)
- No keyboard-path test for the hand-test screen: dev tool, removed in Phase 9. (SliceI-1 unverified 4)
- Helper still named `removeKeys` (`s3/failure.ts:30`). Cosmetic. (SliceF-RunA A-06)
- Hand-test `details.provider` is `local`. Cosmetic. (SliceI-1 unverified 5)
- `campaign-list.tsx:1-2` comment omits the count. Cosmetic. (TP-2)
- A refused Save shows its sentence twice. Cosmetic. (TP-3 unverified 2)

## No longer applies

- `reply-keys.test.ts` sends `campaign_id` to `get_project` and relies on the SDK dropping unknown keys: the test passes on `main` (2 of 2). (MCP-Followup unverified)

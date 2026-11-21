# SPEC 1.22 M8 (M5 Dropbox hidden, lstat error) plus review F-3, F-6: handoff

Status: in progress. On main, local commits only.

## Done

- M5/M8 HAND_TEST_DROPBOX = false in src/shared/config/dev-tools.ts; the screen hides the
  Dropbox choice and the sign-in button. Approved test edits: hand-test-settings.test.tsx (two
  Dropbox tests render <DropboxSignIn />), hand-test-screen.test.tsx (remove test picks s3).
  New test in hand-test-screen.test.tsx.

## Left

- M8 lstat error -> ProviderFailure other; F-3 local-root unit tests; F-6 comment; git check.

## Verify

    npm run lint && npm run typecheck && npm test

# SPEC 1.21 fix lists: L7 to L10, then M1 to M7 (Section 14): handoff

Status: done except M5 (stopped: the screen tests do not fit the approved edit). On main,
local commits only.

## Done (commit)

- 8329370 L7 move: picture-size.ts and png-size.ts to src/main/providers/ (header comments only);
  tests to tests/unit/main/providers/ (import path; the fixture URL in picture-size.test.ts also
  gained one ../ for the same reason). Live Gemini test imports from the new place (not run).
- 5d40659 L7 step 3 in png-converter.ts (pictureSize in a try; side 0 or over 8,192, pixels over
  24,000,000 refused before decode); header tests; F-08 cases in picture-size.test.ts.
- 453103f L8 WINDOWS_RESERVED gains COM0, LPT0, superscripts, CONIN$, CONOUT$.
- 4380845 L9 json-summary coverage reporter.
- L10 checks pass.
- cdc97e3 M1 HAND_TEST_LOCAL_ROOT; src/main/commands/dev/local-root.ts (lstat check of root and
  folder, folderUnsafe); storage.ts opens localStorageAt({userData}/hand-test-local).
- 153300f M2 storageError: REFUSED_PATH -> RULE_VIOLATION storage_folder_unsafe.
- e412e53 M3 storage_not_set_up for s3 with no settings or an empty bucket, in the default opener.
- a34fc37 M4 file_not_readable (warn log line with the code); HAND_TEST_MAX_UPLOAD_BYTES, checked
  from stat before reading; devStorage takes the limit as a third parameter for tests.
- 5599ef9 M6 storage.ts header comment.
- M7 checks: lint, typecheck, 742 tests, coverage, build, test:build, e2e 3 of 3.

## Edits to existing tests (all approved in SPEC 1.21)

- png-converter.test.ts: three tests used FF D8 FF; now SMALL_JPEG (1 x 1 frame header). The
  first test's `seen` expectation names SMALL_JPEG in place of the literal [FF D8 FF].
- project-name.test.ts: LPT0 out of the accepted list; refused case added.
- dev-fixture.ts: handTestDir under hand-test-local; gains localRoot, and makes that folder.
- dev-storage-confinement.test.ts: the two link tests expect RULE_VIOLATION.
- storage-error.test.ts: refused path expects RULE_VIOLATION storage_folder_unsafe (name too).
- dev-storage-gate.test.ts 55-74: RULE_VIOLATION storage_not_set_up; log line check removed.

## Left

- M5 (HAND_TEST_DROPBOX). Needs a ruling on three screen tests; see Open questions.

## Decisions

- The M1 "whole tree unchanged" check leaves out logs/activity-*.jsonl: the app writes a line
  there for every command, so a literal check cannot hold.
- The fixture makes {userData}/hand-test-local, else the two existing tests that put a link at
  handTestDir fail at set-up (parent missing).
- storage_not_set_up is checked in openHandTestStorage (after the key guard, before the adapter)
  so the existing "sends only hand-test paths" test, which injects its own opener with no S3
  settings, still passes. Effect: for write, file errors come before the not-set-up refusal.
- An lstat error other than ENOENT in the local root check is passed on (INTERNAL).

## Open questions

- M5: the two Dropbox sign-in tests in hand-test-settings.test.tsx test the button's behaviour,
  and "removes everything..." in hand-test-screen.test.tsx picks Dropbox without the key dialog.
- Fixture making hand-test-local, and the activity log left out of the tree check: confirm.

## Verify

    npm run lint && npm run typecheck && npm test
    npm run test:coverage   (coverage/coverage-summary.json)
    npm run build && npm run test:build
    npm run test:e2e
    By hand: ADMAN_DEV_TOOLS=1 npm run dev, "Hand test"; local files land in
    {userData}/hand-test-local/adman-hand-test/

---

# Before slice H, L1 to L5 (SPEC 1.20 Section 14): handoff

Status: done except two parts that wait for the architect (L2 step 3 and the pictureSize move;
L3 reserved names). On main, local commits only.

## Done (commit)

- 2624a3b L1 src/main/providers/picture-limits.ts (four constants); pinnedFetch(inner, limit =
  MAX_PROVIDER_ANSWER_BYTES) reads the body counted, "Answer too large", kind other, not marked.
  Tests tests/unit/main/providers/gemini/pinned-origin-limit.test.ts, picture-limits.test.ts.
- a97ba2e L2 part: png-converter.ts checks 1 (bytes), 2 (type), 5 (zero-byte result); one
  fixed message. Tests appended to tests/unit/main/png-converter.test.ts (plus one import).
- e4ba055 L3 part: storage-paths.ts refuses < > " | ? * and codes 1 to 31. Tests appended to
  storage-paths.test.ts; one conformance case (a?.txt) appended to storage-conformance.ts.
- 600d909 L4 live-output.test.ts: three names corrected, two assertions added (10.1 [1.20]).

## Left (blocked)

- L2: pictureSize move and toPng step 3. Spec says `pictureSize(bytes)` giving nothing, test
  assertions unchanged; the existing one is `pictureSize(bytes, mime)` and throws, and its tests
  assert throws and pass a mime. It also imports tests/live/png-size.ts. Needs a ruling.
- L3: WINDOWS_RESERVED. tests/unit/shared/schemas/project-name.test.ts line 19 asserts LPT0 is
  an allowed project name. Spec L3 says stop and report.

## Decisions

- An answer stand-in with no body stream (the H19 test) is read with arrayBuffer() and its
  size checked after; a real Response always has `body`.
- On content-length over the limit the body is cancelled (nothing read) to free the connection.

## Verify

    npm run lint && npm run typecheck && npm test
    npm run test:coverage
    npm run build && npm run test:build
    npm run test:e2e

---

# Slice I part 1, storage half of the hand-test screen (SPEC 1.19; 1.20 does not touch it): handoff

Status: done. Not tried by hand against real S3 (owner does that).

## Done (commit)

- c38e4f5 src/shared/config/dev-tools.ts HAND_TEST_FOLDER; src/main/commands/dev/hand-test-storage.ts
  (every path inside adman-hand-test/, list answers outside it dropped, remove names only those).
- 48910e2, 36c0ab5 src/main/commands/dev/storage-error.ts: ProviderFailure -> PROVIDER_ERROR with
  the Section 6 plain message, details { provider, kind }; refused path -> INVALID_INPUT.
- b6255d3 src/main/commands/dev/storage.ts dev.storage; dev/index.ts registers it with devTools.
  local root = userDataDir (main process only); s3/dropbox: key guard, then adapterFor.
  Provider detail goes to the log only.
- 1d56c03 IPC path test.
- 0118cb1 src/renderer/dev/ (screen, S3 settings form, Dropbox button, storage actions,
  result text); app-shell "Hand test" button and View kind 'handTest', only with devTools.

## Edits to existing tests

- None.

## Decisions

- No `read` action: the spec's dev.storage has write, list, remove only.
- File to upload is typed as a full path: dialog.pickFiles belongs to slice A, not built.
- Plain messages copied from the Section 6 table into dev/storage-error.ts until slice D's
  messages.ts exists.
- Messages made here: "Choose a file by its full path.", "That file was not found.",
  "Choose a file, not a folder.", "That file name cannot be used in storage.",
  "That path cannot be used in storage.", key guard purpose "use the hand-test tools",
  label "Local storage".

## Open questions

- See the report: read action, picker, plain-message home, messages chosen.

## Verify

    npm run lint && npm run typecheck && npm test
    npm run test:coverage
    npm run build && npm run test:build
    npm run test:e2e
    By hand: ADMAN_DEV_TOOLS=1 npm run dev, then the "Hand test" button.

---

# Gemini picture type K1 to K7 (SPEC 1.18): handoff

Brief: SPEC 1.18 Section 14 "Gemini picture type", Section 6.2 [1.18], 6.5 [1.18], 10.1. On main.

Status: done, K1 to K7 (K5 after the SPEC 1.19 ruling). Checks after K5: lint, typecheck,
npm test 94 files / 604 tests, coverage, build all pass (e2e 3 of 3 before K5; not rerun, as
asked). Live tests edited, not run.

## Done (commit)

- 9990e0c K1 ImageResult is { bytes, mime, model }.
- 8ab424c K2 src/main/providers/picture-type.ts `pictureType(bytes)` (PNG signature, FF D8 FF,
  else undefined), test tests/unit/main/providers/picture-type.test.ts.
- faf229d K2 gemini/failure.ts `pictureFromResponse` returns { bytes, mime } from the bytes;
  else other "Picture is not a PNG or JPEG (type: <claimed>)". Fixture
  image-success-jpeg.json (1x1 JPEG, 159 bytes, written byte by byte; README line added).
- ed4b30b K3 CoreDeps.toPng, createCore option toPng (default throws "toPng is not
  available"); src/main/png-converter.ts `pngConverter(decode)`; index.ts passes
  `pngConverter((buffer) => nativeImage.createFromBuffer(buffer))`.
- 7db0270 K4 tests/live/picture-size.ts `pictureSize(bytes, mime)` (PNG IHDR or JPEG frame
  header), test tests/unit/live/picture-size.test.ts; live Gemini test writes .png or .jpg
  and prints the type.
- 488c13c K6 `safely` throws "<label> error <kind>" (or "<label> error"); test
  tests/unit/live/live-safely.test.ts. vitest.live.config.ts imports './tests/live/env-file.js'.

## Edits to existing tests

- tests/unit/main/providers/gemini/image.test.ts: `.png` -> `.bytes` (K1); the test "refuses
  a non-PNG picture..." replaced by "returns a JPEG picture as it came, with mime image/jpeg"
  (K2); helper `withPicture` and type `PictureBody` added; new tests (mime png, GIF/made-up
  type fails, type read from the bytes).
- tests/unit/main/providers/adapters.test.ts: hand-built extend result `png` -> `bytes`, plus
  `mime: 'image/png'` (K1).
- tests/integration/registration.test.ts: 'toPng' added to the field list (K3).
- tests/unit/main/queries/query-runner.test.ts: `toPng` that throws (K3, make-it-compile).
- tests/integration/core-options.test.ts, tests/unit/config/live-config.test.ts: new describe
  appended, nothing else changed.
- tests/live/gemini-image.live.test.ts (K1, K4): the PNG-signature expect became
  `expect(pictureType(bytes)).toBe(mime)`; name "makes one picture ..."; type line printed.

- 61d0986 K5 LIVE_REDACTED_NAMES is the four keys; LIVE_REDACTED_MIN_LENGTH removed.
  live-output.test.ts: three run A tests expect bucket and prefix kept (keys added to the text
  of the two failure tests); H16 key/bucket test now keeps bucket and prefix; the "prefix of
  four characters or more" test removed. s3.live.test.ts header comment updated.

## Left

- Nothing. The live run is for the coordinator.

## Decisions

- toPng's Electron call sits behind `pngConverter(decode)` so it is tested without Electron
  (as `httpsOnly` is). Message on an empty image: "The picture could not be turned into a PNG".
- K6 import form `.js`: Vite's bundling loader gives no warning and typecheck passes with no
  config change. Checked on scratch copies (not the real config, which reads .env.local):
  no extension warns; `.js` and `.ts` do not. Note: Vite's future `configLoader: 'native'`
  fails on `.js` (ERR_MODULE_NOT_FOUND) and works on `.ts`; `.ts` needs
  `allowImportingTsExtensions: true` in tsconfig.json (not added).
- K6 short error for a non-ProviderFailure: "<label> error" (no kind exists).

## Open questions

- None. K5 and K6 answered by SPEC 1.19 (keep `.js`; "Gemini error" accepted).

## Verify

    npm run lint && npm run typecheck && npm test
    npm run test:coverage
    npm run build && npm run test:build
    npm run test:e2e

---

# Slice F follow-ups, run C (SPEC 1.17): handoff

Status: done. H7, H14, H21, H8. All checks green (90 files, 584 tests). Live tests edited,
not run.

## Done (commit)

- 0849f24 H7 exclusion removed; coverage-config.test.ts assertion and name changed as ruled.
- 1ff6317 H14 WINDOWS_RESERVED and isReserved moved unchanged to
  src/shared/config/reserved-names.ts (new test tests/unit/shared/config/reserved-names.test.ts);
  project.ts imports them.
- ee864e9 H14 storage-paths.ts refuses a part ending in dot or space, holding ':' or '\\', or a
  reserved name. The old drive-letter line is gone (':' covers it).
- 3de232f H21 conformance refusals expect /^Storage path refused$/. `quietly` lets the fixed
  refusal through as a fresh Error with that text, so the live S3 run can match it.

## Coverage (lines)

src/main 893/1008 = 88.59% (providers included), src/main/providers 348/358 = 97.21%,
src/shared 112/112 = 100%.

## Open questions

- None.

## Verify

    npm run lint && npm run typecheck && npm test
    npm run test:coverage
    npm run build && npm run test:build

---

# Slice F follow-ups, run B (SPEC 1.16): handoff

Brief: SPEC 1.16 Section 14 run B (H17, H18, H19, H3, H5, H6, H7, H12, H13, H14, H15,
H16, H20, then H8). On main.

Status: done except H7 and H14 (both done in run C, see above). H8 checks all pass
(89 files, 555 tests). Live tests edited, not run.

## Done (commit)

- H17 local adapter refuses a link that points nowhere on the way down (all five calls).
  Test: tests/integration/providers/local-storage-links.test.ts.
- H18 one new test in adapters.test.ts: real adapterFor with a provider list that names
  local-storage doing storage still throws INVALID_INPUT (so doesJob cannot hide the table).
  Shown failing when 'local-storage' was put in FOLDERS by hand, then reverted.
- H19 Gemini pinnedFetch and S3 pinnedHandler mark only the network call and the body
  read; building the finished answer is outside. New tests appended to
  gemini/errors.test.ts (status 1000 answer) and s3/errors.test.ts (frozen answer).
- H3 path rules now src/main/providers/storage-paths.ts; test moved to
  tests/unit/main/providers/storage-paths.test.ts (import line only). No provider folder
  imports another.
- H5 package.json declares @smithy/node-http-handler 4.14.2; lockfile root entry added with
  `npm install --package-lock-only` (no install-script warning). `npm ls` shows one copy
  (4.14.2, all others deduped). `npm ci` was not run (it would rebuild node_modules).
- H6 one new conformance case (files only, empty prefix, each path read, `a` not `a.txt`/`ab.txt`).
  Passed at once on local (behaviour existed); a mutation that lists folders fails it.
- H7 NOT done, reverted: removing the exclusion fails the existing test
  tests/unit/config/coverage-config.test.ts:27-35 (`expect(coverage?.exclude).toContain(
  'src/main/providers/**')`, name "... 80% src/main outside providers"). Neither H7 nor 10.1
  approves editing it. Measured with providers counted (config test left out, not committed):
  src/main 891/1006 = 88.57% (threshold 80), src/main/providers 346/356 = 97.19%,
  src/shared 112/112 = 100%. Before: src/main 545/650 = 83.85%.
- H12 S3 list leaves out keys ending in '/'. Fixture list-objects-v2-folder-marker.xml,
  test tests/unit/main/providers/s3/list-and-exists.test.ts. (That commit had an unused
  import, lint error; fixed in the H13 commit, which uses it. No history rewrite.)
- H13 local isMissing counts ENOTDIR as not there (exists('a.txt/b') and 'a.txt/b/c' false;
  side effect: list('a.txt') gives [] instead of other/ENOTDIR). Conformance case added.
  S3 test: 404 head with a missing bucket is false, next write other (passed at once).
- H14 NOT done: the reserved-name list is `const WINDOWS_RESERVED` (not exported) at
  src/shared/schemas/commands/project.ts:8, so it cannot be imported as it is. Not copied.
- H15 s3/environment.test.ts uses vi.stubEnv per variable and vi.unstubAllEnvs in afterEach
  (was: process.env replaced by a plain copy). New test checks process.env is the same object
  and each variable is back. No assertion changed.
- H16 tests/live/env-file.ts LIVE_REDACTED_NAMES (two keys of Gemini/fal, both AWS keys,
  bucket, prefix) and LIVE_REDACTED_MIN_LENGTH (prefix 4); liveValues uses them. Run A
  tests in tests/unit/live/live-output.test.ts changed to expect the region kept (two names,
  one list, one added toContain, two detail strings); new H16 describe in that file.
- H20 live-output.ts `quietly`: prints nothing, throws the safe error. s3.live.test.ts uses it
  for every call. Test: tests/unit/live/live-quiet.test.ts. Live tests not run.

## Left

- H7 and H14, after the rulings below. H8 ran at the end: lint, typecheck, test (89 files,
  555 tests), coverage (thresholds met; providers still excluded), build, test:build (1, 2).

## Open questions

- H7: may coverage-config.test.ts drop the `exclude` expect (line 30) and its name lose
  "outside providers"? Then H7 is one config line plus that test edit. Also SPEC 10.1 table
  (line 2158) still says "80% in `src/main/` outside providers", against 6.5 [1.13].
- H14: may `WINDOWS_RESERVED` (or an `isReserved` helper) be exported from
  src/shared/schemas/commands/project.ts, or moved to a shared config file? Should the other
  H14 forms (trailing dot or space, `:`) go in without waiting for the list?

## Verify

    npm run lint && npm run typecheck && npm test
    npm run test:coverage
    npm run build && npm run test:build

---

# Slice F follow-ups, run A (SPEC 1.14): handoff

Brief: SPEC 1.14 Section 14 "Slice F follow-ups" run A (H9, H10, H2, H4, H11, H1, G8, H8),
Section 6.5 [1.13]/[1.14], 6 and 6.2 [1.12]/[1.14], 10.1. On main. Run B is not this run.

Status: run A done. All checks green (86 files, 540 tests). Live tests edited, not run.

## Done (commit)

- 09a556e H9 local write checks the deepest existing folder's real path before any mkdir,
  then checks the file's folder again. The root itself may be made (caller's own folder).
- df51921 H10 refused path is exactly "Storage path refused"; local messages hold no path.
- f4c4992 H2 local disk errors -> ProviderFailure other, detail = code (or error name if no
  code); missing file -> detail ENOENT; refused path stays a plain Error; Azure stub ->
  ProviderFailure other "Azure Blob storage is not available". S3 offline already existed.
- 4492c0f H4 S3 uses redactSecret; a passed-on ProviderFailure (pinned-host "Request
  refused") is redacted too; returned unchanged when nothing was removed.
- 7a77237 H11 tests/live/live-output.ts (liveValues, safeText, missingNames, livePrint,
  safeFailure, safely); S3 and Gemini live tests use it. Not run.
- c45fffe H1 local-storage and UNLISTED out of adapters.ts; adapters.test.ts as ruled.
- f5efc7f G8 Gemini pinnedFetch and S3 pinnedHandler read the body inside the marked step.

## Left

- Run B (H3, H5, H6, H7, H12, H13, H14, H15, then H8).

## Open questions

- H11 redacts the value of every LIVE_ENV_NAMES variable, ADMAN_LIVE_KEEP's "1" included;
  with KEEP=1 every "1" in printed text (pixel size, byte count) becomes "[key removed]".
- H1: the unused `storage` fixture and `StorageProvider` import in adapters.test.ts were
  removed with the test (lint fails otherwise).

## Verify

    npm run lint && npm run typecheck && npm test
    npm run test:coverage
    npm run build && npm run test:build

---

# Slice E follow-ups G1 to G7 (SPEC 1.12): handoff

Brief: SPEC.md 1.12 Section 14 "Slice E follow-ups", Section 6 [1.12], 6.2 [1.12], 10.1. On main.
Do not touch s3/, local-storage/, azure-blob/ or their tests (under review).

Status: G1 to G7 done. All checks green (85 files, 522 tests). Live test written, not run.

## Done (commit)

- 0bebad5 G4 `src/main/providers/redact.ts` + `tests/unit/main/providers/redact.test.ts`;
  `gemini/failure.ts` uses it; new test in `gemini/errors.test.ts` (base64 key removed).
- 0fb4831 G1 + G3 (one commit: the wrapper's mark is what makes the old offline test pass):
  `gemini/pinned-origin.ts` (`GEMINI_ORIGIN`, `pinnedFetch`, `NetworkError`), `image.ts`
  `pinnedClient` (apiKey, vertexai false, apiVersion 'v1', baseUrl, wrapped fetch);
  `failure.ts` offline only for `isNetworkError`. Tests: `gemini/environment.test.ts`,
  `gemini/pinned-origin.test.ts`, one new G3 test in `errors.test.ts`.
- 2106088 G2 secret, model and client inside the `try`; two tests in `errors.test.ts`.
- fedf372 G5 `tests/unit/main/ipc-targets.test.ts` deleted.
- 0538b87 G6 live test prints file, pixel size, bytes, model; on failure kind and detail.
  Helper `tests/live/png-size.ts` with `tests/unit/live/png-size.test.ts`.
- G7 checks run: lint, typecheck, test, coverage, build, test:build all pass.

## Left

- Nothing. Swapping S3's local key stripping for `redactSecret` is a later run.

## Decisions

- `apiVersion: 'v1'` is pinned too (the library's 3.6.1 default; `GOOGLE_GENAI_API_VERSION`
  would change the path). Section 6's general rule asks for it; 6.2's list does not name it.
- G3 test calls `failureFromError` directly with a TypeError (runs; no adapter path needed).
- Library: explicit `vertexai: false` makes it ignore GOOGLE_GENAI_USE_ENTERPRISE and
  GOOGLE_GENAI_USE_VERTEXAI; explicit `baseUrl` beats GOOGLE_GEMINI_BASE_URL and
  GOOGLE_VERTEX_BASE_URL; explicit `apiKey` beats GOOGLE_API_KEY / GEMINI_API_KEY. It still
  reads GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION with no off switch (unused in Gemini mode).

## Open questions

- Should 6.2 name `apiVersion` in the pin list (and is `v1` right for image output)?
- The live test keeps its "skipped: GEMINI_API_KEY is not set" line. Allowed under "nothing else"?

## Verify

    npm run lint && npm run typecheck && npm test
    npm run test:coverage
    npm run build && npm run test:build

---

# Phase 2 slice F (storage: local and S3): handoff

Brief: SPEC.md 1.11 Section 14 slice F, Sections 6, 6.5, 10.1, 13; then the SPEC 1.12 Section 6
adapter rules for S3 (orchestrator message). On main.

Status: slice F done (with the SPEC 1.12 S3 rules). Live test written, not run.

## Done (commit)

- Unit 1: `src/main/providers/local-storage/` (`paths.ts` shared path rules, `local-storage.ts`
  `localStorageAt(root)`), `tests/integration/providers/storage-conformance.ts`,
  `tests/integration/providers/local-storage.test.ts`, `tests/unit/main/providers/local-storage/`.
- Unit 2: `src/main/providers/azure-blob/index.ts`: every call rejects with "Azure Blob storage is
  not available" (a plain Error, not a ProviderFailure: it is not a provider answer).
- Unit 3: `src/main/providers/s3/` (`s3-storage.ts`, `failure.ts`, `index.ts` exports `storage`).
  Fixtures in `tests/fixtures/providers/s3/` (hand-built from the S3 API Reference; no real call).
  Tests in `tests/unit/main/providers/s3/` run the real SDK with a stand-in request handler.
- Unit 4 (SPEC 1.12, points 1 to 4 all done): `client.ts` gives the AWS library every setting
  (keys, region, endpoint, one attempt, retry/defaults mode, no FIPS/dual-stack/ARN region/S3
  Express, checksum modes, auth scheme, app ID); `pinned-host.ts` refuses any origin other than
  `{bucket}.s3.{region}.amazonaws.com` or `s3.{region}.amazonaws.com` over https:443 and marks
  network errors; only marked errors are `offline`; every build error is a ProviderFailure
  `other`; key stripping (as given, URL-encoded, base64) is local in `failure.ts` until the
  shared `redactSecret` exists. Test: `environment.test.ts`.
- Unit 5: `tests/live/s3.live.test.ts` (written, NOT run): conformance cases on the real bucket
  under `{prefix}/adman-hand-test/conformance-<uuid>/` (removed after), then the hand test on
  `{prefix}/adman-hand-test/hello.txt` (kept with `ADMAN_LIVE_KEEP=1`). Conformance helper gained
  a `skip` option for this.

## In progress

- Nothing.

## Left

- Nothing in this slice. The stakeholder's live run is by hand.

## Decisions

- Path rules (`paths.ts`): refused are empty, leading `/`, `..`, `.`, empty parts, backslash,
  NUL, drive letter. One error text: "Storage path refused: ...". S3 imports the same file.
- `list(prefix)` reads the prefix as a folder (`a` and `a/` both mean folder `a`, never `ab.txt`)
  and returns paths relative to the adapter root (not to the prefix), so they can be passed
  straight to `read` and `remove`. See open question 2.
- Local: after the rules, the real folder (links followed) must be inside the real root, and a
  link at the file itself is refused. `remove` of a missing path is not an error.

## Open questions

1. Where does the local adapter get its root folder? `AdapterContext` has `secret`, `settings`,
   `model` only, and `Settings` has no local folder. So `adapters.storage` of `local-storage`
   stays unset (`adapterFor` gives INVALID_INPUT) and the folder exports `localStorageAt(root)`.
   Callers (export, `dev.storage` local) need a ruling: import `localStorageAt`, or a contract
   change.
2. `list(prefix)`: relative to the root (as built) or to the prefix? Folder or string prefix?

## Verify

    npm run lint && npm run typecheck && npm test
    npm run test:coverage
    npm run build && npm run test:build
    # by hand, stakeholder only: npm run test:live -- tests/live/s3.live.test.ts

---

# Phase 2 slice E (Gemini pictures): handoff

Brief: SPEC.md 1.9 Section 14 slice E, then 1.11 step 0 fixes F1 to F11, Sections 6, 6.2, 10.1, 13, OI-10. On main.

Status: slice E done, plus step 0 fixes F1 to F11 (SPEC 1.11). All checks green. Nothing
in progress, nothing blocked.

## Done (commit)

- e103bf8 `src/main/providers/gemini/`: `image.ts` (generate, 120 s timeout, two calls at once,
  extend throws `other`), `failure.ts` (error mapping, PNG check, key removed from detail),
  `aspect-ratio.ts`, `index.ts` exports `image` only. Fixtures in
  `tests/fixtures/providers/gemini/` (built by hand from the public docs and SDK types; no real
  call). Unit tests in `tests/unit/main/providers/gemini/` run the real SDK with a stand-in fetch.
- 455cffd `registry.ts` image model `gemini-2.5-flash-image` -> `gemini-nano-banana-2.1` (OI-10).
- c97a9aa `tests/live/gemini-image.live.test.ts`. Written, NOT run.
- e0600b8 F1: `vitest.live.config.ts` reads `.env.local` only inside `defineConfig(() => ...)`;
  `LIVE_INCLUDE` in `tests/live/env-file.ts`; `live-config.test.ts` changed as approved, plus the
  text-scan test.
- e3f0fb1 F4: `job.updated` (payload `JobRow`) in `events.ts`; new `events.test.ts`.
- ae51a49 F5: `isInternal` required on `IpcTargets`; new `ipc-targets.test.ts`.
- 39e4c02 F7: placeholder test re-pointed to `adapterFor(deps, 'gemini', 'video')`.
- ff61f4b F8, F9: 400 `API_KEY_INVALID` -> bad_key (other 400 stays other); RECITATION -> refused.
- F2, F3: no code. F10: no Gemini model ID under `src/` outside `registry.ts`; nothing removed.

## Edits to existing tests (all approved by SPEC 1.10/1.11 or make-it-compile)

- `tests/unit/config/live-config.test.ts` (F1): import of `vitest.live.config` removed; imports
  `LIVE_INCLUDE`; reads the config as text; the `include` expect became the two named expects;
  new describe with the scan test. Other expects and both test names unchanged.
- `tests/unit/main/ipc.test.ts` (F5, make-it-compile): `isInternal: () => false` on 4 targets
  (the one-line target was reflowed onto several lines by that addition).
- `tests/unit/main/ipc-sender.test.ts` (F5, make-it-compile): `isInternal: () => false` on 1.
- `tests/unit/main/providers/adapters.test.ts` (F7): name, provider job and details as ruled.

## Decisions

- Model: `gemini-2.5-flash-image` shuts down 2027-03-15 and 2.5 access is limited to past users;
  Google's generateContent image guide recommends `gemini-nano-banana-2.1`. The live test is the
  proof (SPEC 6.2 [1.11]).
- Size, non-PNG and count above 1: as built, ruled in SPEC 6.2 [1.11].
- The scan test in F1 passed as soon as the import was removed (that removal is the fix).
- Live test prints with `process.stdout.write` (lint allows only `console.error`).

## Open questions

- None. If the live test shows a non-PNG type, stop before slice H (SPEC 6.2 [1.11]).

## Verify

    npm run lint && npm run typecheck && npm test
    npm run test:coverage
    npm run build && npm run test:build
    # by hand, stakeholder only, one paid call: npm run test:live -- tests/live/gemini-image.live.test.ts

---

# Phase 2 step 0: handoff

Untracked working note. Brief: SPEC.md 1.9 Section 14, "Step 0 remainder", R1 to R6, on main.
Earlier step 0 notes (items 1 to 6, SPEC 1.8) are in git history of this file's commits list below.

Status: step 0 remainder R1 to R6 done and committed. Nothing in progress, nothing blocked.

## Done (commit)

- Step 0 items 1 to 6 (SPEC 1.8): d400dae, efa7480, b919aa5, 404890a, daafdb7, 1177ddd,
  232d85f, 22a547f, a27553a, 082b89b
- R1 `CoreDeps` gains `assets`, `jobs`, `openExternal`, `devTools`; `createCore` options;
  `httpsOnly`, `devToolsEnabled`, `index.ts` passes both; `devCommands` guard;
  `app.getState` `devTools`: 1f8b9f8. Rulings: SPEC 1.9 R1 "Follow-up rulings" (a) to (c).
  Make-it-compile edits (SPEC 10.1):
  - `tests/unit/main/queries/query-runner.test.ts`: `assets` = `createAssetServiceStandIn()`,
    `jobs` = `createJobServiceStandIn()`, `openExternal` = function that throws, `devTools` =
    `false` (plus the two stand-in imports).
  - `tests/unit/renderer/fake-api.ts` `baseState()`: `devTools: false`.
- `vitest.config.ts` node project includes `tests/unit/live/**/*.test.ts`: 17dd18c
- R2 five agent-policy deny rows; table test says "SPEC 1.9": 261692e
- R3 `CampaignRow` in `ROW_SCHEMAS` (all eleven tables checked); `VALID_BRIEF` fixtures;
  new test for `brief = '{}'`. No other fixture column failed `CampaignRow`: 65be6a9
- R4 `JobRow` without `errorDetail`; `MAIN_ONLY_COLUMNS` and `readJobErrorDetail`: 6392cb8.
  `MAX_IMAGES_PER_RUN = 8`: 8951cae. Template types, `adapterFor`, `ProviderError`: no edit.
- R5 `tests/live/env-file.ts`, `vitest.live.config.ts` reads `.env.local`: d8967d9.
  `.env.local` was never opened; `test:live` was not run.
- R6 all checks run after 1f8b9f8 and pass (70 files, 378 tests; e2e 3 of 3; coverage
  thresholds met; drizzle-kit "No schema changes").

## Decisions (this run)

- R1 `openExternal` and `devTools` are optional `createCore` options, so
  `core-fixture.ts` (not on the approved list) needs no change. Defaults: `devTools` false;
  `openExternal` rejects with "openExternal is not available". `index.ts` always passes both.
- R1 `httpsOnly(open)` rejects any non-`https:` address with an error and does not
  call the system. `devToolsEnabled(isPackaged, env)` is the tested rule for `ADMAN_DEV_TOOLS`.
- R1 `devCommands` returns `deps.devTools ? handlers : []`; the list is empty now,
  so its test passes before and after. It pins the guard for slice I.
- R4: `MAIN_ONLY_COLUMNS` uses SQL column names (`job: ['error_detail']`); the wire select
  leaves them out, so the value is never read into a wire row.
- R5: "already set" means `process.env[name] !== undefined`. Empty lines and unlisted names
  in the file are dropped. A read failure other than "no file" throws ".env.local could not
  be read" (cause: the file-system error, which carries the path and code only).

## Open questions

None.

## Verify

    npm run lint && npm run typecheck && npx vitest run
    npm run build && npm run test:build
    npm run test:coverage
    npm run test:e2e
    npx drizzle-kit generate   # expect "No schema changes"

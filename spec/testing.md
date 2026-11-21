# Logging, testing and non-functional targets

The activity log, how changes are verified, the test rules, the named tests, the test commands and the non-functional targets. The harnesses (offline and real end-to-end, ComfyUI server tests, live tests) and the no-paid-call rule are in `spec/test-harnesses.md`. Read with `spec/structure.md` (where tests and code live) and `spec/infra-and-settings.md` (CI, environment variables).

## Logging

Built. `src/main/log/activity-log.ts`, `src/main/log/error-context.ts`, `src/main/jobs/job-error-log.ts`.

One JSON object per line in `{userData}/logs/activity-{YYYY-MM-DD}.jsonl`. A new file each day. The day is the UTC date, the same clock as the `timestamp` field, so a line is always in the file its timestamp names. Files older than 30 days are deleted on start. Nothing is sent anywhere [REQ: FR-153].

**Required log fields:**
```json
{
  "timestamp": "ISO 8601",
  "level": "info|warn|error|debug",
  "event": "command|query|job|provider|mcp|asset|app",
  "name": "layer.update",
  "actor": "user|agent|system",
  "agentClient": "client name or null",
  "projectId": "ULID or null",
  "campaignId": "string or null",
  "variantId": "string or null",
  "jobId": "ULID or null",
  "ok": true,
  "errorKind": "string or null",
  "message": "string",
  "context": {}
}
```

- Every command is logged with its actor, which marks agent-made edits [REQ: FR-200].
- An `INTERNAL` error is logged at level `error` with `errorKind: 'INTERNAL'` and `context.error` holding the thrown error's name, message and stack (`spec/api-principles.md`, errors). This is the only place that text is kept.
- `event: 'query'` is for a query that failed with `INTERNAL`: `name` is the query's name and `context.commandId` is the ULID in the reply. Queries that succeed are not logged. `event: 'app'` is for the app's own life: start, quit, log clean-up.
- A failed `undoPrepare` is logged at level `warn` with `step: 'undoPrepare'` (`spec/data-rules.md`, data flow).
- Every line the job runner writes uses actor `system`. The runner's own lines (a failed `job.projectOpened`, a `rows.read` error) are in `spec/jobs.md`.
- `brief.parse` logs the reason and the line number, never `lineText`.
- `campaign.get`, `campaign.update` and `campaign.delete` log IDs only. Nothing of a brief or a campaign reaches a log line.
- A raw provider detail stays in the job's own column, never in the log. For an `AppError` after a job is queued, no part of it reaches a log line. A test pins this.
- Auto-approved destructive agent actions are logged with `context.autoApproved: true`.
- The fixed field set is what opt-in telemetry would send later [REQ: FR-153].

### A job that stops on an unforeseen error

Built. Security class. An unforeseen error is one that is not a `ProviderFailure`, not a `ProviderCancelled` and not an `AppError`. It can come from inside an adapter or a library, so its message may hold a key, a server's words or the ComfyUI address (no log line holds that address: `spec/comfyui.md`). The job's log line therefore does not copy the error as the bus does. `context.error` holds:

- `name`: the error's name.
- `stack`: only call-frame lines, redacted, chosen in this order:
  1. An error with no stack text gives `stack: null`.
  2. If the message is empty, the first line of the stack is dropped.
  3. Otherwise the message is looked for in the stack. It must begin before the stack's first line break. Everything up to its end is dropped. The error's name is not used for this, because a name is often changed after the error is made.
  4. Of what is left, only the lines that start with `at ` after the spaces are kept, and they are redacted.
  5. If the message is not found there (changed after the error was made, or the stack set by hand): for a job whose message is not logged (`serverText`, or a provider not in the registry) `stack` is null. For any other provider the frame lines of the whole stack are kept, since that provider's message is logged anyway.
  6. One case is accepted: a message shortened after the error was made that still sits on the first line. No code under `src/main/providers/` or `src/main/jobs/` assigns to an error's `message`.
- `message`: the error's message with every secret of the job's provider removed by `redactSecret` (`spec/providers.md`), for each secret name the registry lists for that provider. For a provider whose `serverText` is true (`comfyui`), the message is not logged: the field is null.
- The job row gets `error_detail = 'internal'`. The raw text is kept nowhere else.
- The bus and the query runner log unforeseen errors in full, as above: a command's own code throws them, not a provider's reply.

Test: `tests/integration/jobs/runner-secret-log.test.ts` (a stored key holding `/`, `+`, `=` never reaches a job's log line in plain, URL-encoded or base64 form, in the message or a hand-set stack).

### Metrics, tracing, alerting

- Metrics: none. The stakeholder set no targets [REQ: 8.1]. Job durations are recorded in the log `context`.
- Tracing: none. A command's ULID is carried in `context.commandId` on every log line it causes.
- Alerting: none. There is no operator. The user sees failures in the activity panel and in plain-language dialogs [REQ: FR-152, FR-069].

## Verification classes

Every change has a class. The developer runs the checks for that class. The full gate runs before a release, not for each change.

| Class | Kind of change | Required checks |
|-------|----------------|-----------------|
| A | Pure logic in `src/shared/` (follow rules, checks, presets, paths) | Lint, typecheck, unit tests for the touched module |
| B | Data and commands (`src/main/db`, `src/main/commands`) | Class A + integration tests for the touched commands + migration test if the schema changed |
| C | Drawing and export (`src/shared/scene`, render and export services) | Class A + the reference-picture tests (`npm run test:e2e -- tests/e2e/scene-reference.spec.ts`, on a desktop like class G; "Reference pictures" below) |
| D | UI (`src/renderer`) | Lint, typecheck, component and accessibility tests for the touched component |
| E | Providers and MCP | Class A + adapter or MCP tests for the touched adapter or tool |
| F | Release | Everything in "Coverage and test types" below, on macOS and Windows |
| G | The Electron edge: `src/main/index.ts` and `src/main/windows/` (window creation, window state, pickers, navigation rules) | Lint, typecheck, unit tests for any pure function in the touched file, and the end-to-end test that covers the changed behaviour, run by the developer on their own machine with `npm run test:e2e` |

**Why class G exists.** Integration tests never load Electron (`spec/structure.md`, "Electron stays at the edge"), so a change to how the window is made can only be seen in a running app. A class G change is the one case where the developer runs the end-to-end test for a single change. The run needs a desktop session: a real screen on macOS or Windows. On a machine with no window system the window cannot be maximized, so a class G check is not run there and is not replaced by a skip that always passes. CI runs it again at the release gate on both systems.

**Security class.** A change that touches a security rule (`spec/security.md`) is reviewed as security class. It merges only after its review passes.

**Merge rule.** Each slice is reviewed and merged to `main` one at a time. After each merge the full checks run on `main`: lint, typecheck, all tests with none excluded, build and `test:build`.

## Test commands

Built. `package.json`.

| Command | Runs | Who runs it |
|---------|------|-------------|
| `npm test` | `vitest run` with `vitest.config.ts`: project `node` (`tests/unit/{main,shared,config,preload,live,e2e-real}/**/*.test.ts`, `tests/integration/**/*.test.ts`) and project `renderer` (jsdom, `tests/unit/renderer/**/*.test.{ts,tsx}`, setup `tests/unit/renderer/setup.ts`) | Everyone, CI on every push |
| `npm run test:watch` | Vitest in watch mode | Developers |
| `npm run test:coverage` | `vitest run --coverage` | CI on every push (reports, does not fail) |
| `npm run test:build` | `vitest.build.config.ts`: `tests/build/` against the output of `npm run build` | CI after the build |
| `npm run test:e2e` | `npm run build && playwright test` (`playwright.config.ts`, `tests/e2e/`, one worker). Offline | Developers; class G; release gate |
| `npm run test:e2e:real` | `npm run build && playwright test --config playwright.real.config.ts` (`tests/e2e-real/` only). Uses the real ComfyUI server | By hand, on a desktop. The paid Gemini case is the stakeholder's only |
| `npm run test:comfy` | `vitest.comfy.config.ts`, `tests/comfy/`, one case at a time. Uses the real ComfyUI server | Project agents, within the limits in `spec/test-harnesses.md` |
| `npm run test:live` | `vitest.live.config.ts`, `tests/live/**/*.test.ts`. Real paid calls | The stakeholder only |
| `npm run shots` | `npm run build && playwright test --config playwright.shots.config.ts` (`tests/shots/*.shots.ts`, helper `tests/shots/shot.ts`, one worker). Offline. Writes screenshots of the built app's screens to `shots/` (not in git) for review by eye | By hand, when a screen slice wants pictures. Never part of a routine check or a verification class |
| `npm run lint` | `eslint . && prettier --check .` | Every class |
| `npm run typecheck` | `tsc --noEmit -p tsconfig.json` | Every class |

No CI workflow names `test:e2e:real`, `test:comfy`, `test:live` or `shots`. No agent runs `test:live` or makes any paid call [D-081] (`spec/test-harnesses.md`). What CI runs and when is in `spec/infra-and-settings.md`.

## Coverage and test types

| Test type | Coverage target | Tooling | Runs in |
|-----------|-----------------|---------|---------|
| Unit | 90% of lines in `src/shared/`, 80% in `src/main/`, providers included | Vitest | CI |
| Integration (commands against a temporary project file) | Every command in `spec/api-commands.md` has a success test and its refusal tests (below) | Vitest | CI |
| Provider adapters | Each adapter tested against recorded responses, including one test per error kind | Vitest | CI |
| Scene reference pictures | Each layer type, CJK text, overflow, letter spacing, transparency (Phase 3); each preset at 5 points in time (Phase 7) | Playwright (Electron) + the render window, per-system reference files, the rule in "Reference pictures" | Developer on macOS; CI on both systems at the release gate. Phase 3 cases built (macOS references); Phase 7 cases not built |
| Component and accessibility | Every dialog and panel: keyboard path, labels, axe-core with no violations | Testing Library, axe-core | CI |
| End-to-end | Workflows 5.1 to 5.7 with fake providers | Playwright (Electron) | CI on tags (Phase 11) |
| MCP | Every tool, the ask flow, token and header rejection | MCP SDK client in Vitest | CI |
| Performance / load | None. No targets set. | — | — |
| Security | gitleaks, `npm audit` at high severity, licence check, built-page policy check | — | CI. `spec/infra-and-settings.md` says which phase adds each and which ones fail a push |

**Measuring coverage.** Built. `@vitest/coverage-v8`, run by `npm run test:coverage`. `vitest.config.ts` is the only place the thresholds are set:

```ts
coverage: {
  provider: 'v8',
  include: ['src/shared/**', 'src/main/**'],
  reporter: ['text', 'html', 'clover', 'json', 'json-summary'],
  thresholds: {
    'src/shared/**': { lines: 90 },
    'src/main/**': { lines: 80 },
  },
},
```

A threshold is never lowered and no exclusion is added to pass it. `json-summary` gives per-folder totals from the tool, not by hand. CI runs coverage on every push and prints the figures. Falling below a threshold fails the release gate (class F), not a single change, so a worktree is not blocked by another worktree's gap. In the push workflow the coverage step has `continue-on-error: true`. Two conditions keep that from hiding a real failure: `npm test` is its own step before it and fails the run when a test fails, and the tag pipeline (Phase 11) runs coverage without the mark. `tests/unit/config/coverage-config.test.ts` checks the config.

**No type-only tests.** A test that only uses `expectTypeOf` asserts nothing when `npm test` runs, because Vitest's type checking is off. A rule about a type is proven by `npm run typecheck`, which every class runs. For example, typecheck is the proof that `isInternal` is required on `IpcTargets` (`src/main/ipc.ts`).

### Reference pictures

Built (slice P3-8). `tests/e2e/scene-reference.spec.ts`, cases in `tests/e2e/scene-cases.ts`, comparison in `tests/e2e/reference-compare.ts`, pictures in `tests/reference-pictures/{darwin,win32}/{case}.png`. The 14 `darwin` pictures are made; `win32` has none yet (D-087).

**How a case runs.** One built app (`launch.ts`) serves every case. Each case sets its scene up through `window.api` (a project, imports, `campaign.create` at `400x400`, then layer commands) and draws it with `variant.render` at `maxDimension` 400, so nothing is scaled. Every `full` draw is checked to have no pixel that is not opaque. `variant.render` does not offer `overlay-only`, so that case is drawn by the test helper `drawInRenderWindow` (`tests/e2e/render-helpers.ts`): it builds the same input the render service builds, in `overlay-only` mode, and sends it straight to the render window on the same channel, with the same capture as `draw.ts`. That case also checks alpha 0 at a corner that held only the background, and alpha above 0 inside the text. Test pictures (a solid square, a picture with a transparent hole) are made in the test with Electron's `nativeImage.createFromBitmap(...).toPNG()` from fixed pixel values, so no picture file is committed apart from the references.

**The stability rule.** A reference is stable on one system when all of these hold:

1. **One system per folder.** References are kept per operating system (`process.platform`). A reference is made and checked on that system only. Agents make and check `darwin`; the stakeholder makes and checks `win32` (D-087).
2. **Only fixed fonts.** Every case uses the bundled font or a font file the test imports (a copy of the bundled font imported as an asset), except the one CJK case, which uses the system's fallback font on purpose. When the operating system's major version changes, the CJK reference is made again.
3. **Settled before capture.** The picture is taken only after the Scene's `onSettled` (fonts loaded, pictures decoded, two frames drawn), never after a fixed wait.
4. **Device scale 1, no time.** The render window draws at device scale 1 (`spec/scene.md`, "One draw", checks), `timeMs` 0, no animation.
5. **Tolerance.** Two pictures match when they have the same size and at most 0.5 % of their pixels differ, where a pixel differs when any of its four channels differs by more than 8 (of 255). Decoding uses Electron's `nativeImage` in the main process (`electronApp.evaluate`), so no package is added.

**Making and changing references.** With `ADMAN_UPDATE_REFERENCES=1` the spec writes the picture of each case to the system's folder instead of comparing. A new or changed reference is committed with the slice that changes the drawing; the developer and the reviewer each look at it and say what it shows. Otherwise a reference is never changed. A missing reference fails the case on `darwin`; on `win32` it skips with "No Windows reference yet." until the stakeholder makes them.

**Phase 3 cases** (each a named test, named after its picture: `background-cover`, `background-crop`, `image-contain`, `image-opacity`, `rotated-layer`, `hidden-layer`, `empty-picture-layer`, `text-weights-align`, `letter-spacing`, `imported-font`, `text-overflow`, `cjk-ja`, `transparent-hole`, `overlay-only`; one more test checks the compare rule itself): a background picture with no crop (cover); a background with a crop; an image layer that is not square (contain); an image layer at 50 % opacity; a layer turned 30°; a hidden layer between two visible ones (nothing drawn); an empty picture layer (nothing drawn); a text layer in the default font at weights 400 and 700, aligned left, centre and right; text with letter spacing −0.1, 0 and 0.3 em [REQ: FR-249]; text in an imported font; text that overflows its box (drawn past it); Japanese text with `lang` `ja` (the CJK case); **a picture with a transparent background over a coloured background, whose hole shows the colour** [REQ: FR-245]; `overlay-only` mode (transparent where only the background was).

### Refusal tests

A refusal test is a test of a command saying no. It does not have to end in `RULE_VIOLATION`. A reviewer checks a command against four rules:

1. **Success.** One test where the command succeeds. For a project-scope command it uses the `expect-changes` helper (`tests/integration/expect-changes.ts`, `spec/api-queries-events.md`).
2. **Every named refusal.** One test for each refusal the spec names for the command: each row of the `details.reason` table in `spec/api-principles.md` that names it, each "refused" condition in `spec/api-commands.md`, and each data rule that says the command is refused.
3. **At least one.** If rule 2 gives no test, the command still needs one refusal test. Use the first that applies: `NOT_FOUND` for an ID or name that names nothing (`project.close` with a project that is not open, `secret.delete` with a name that is not saved). Otherwise `INVALID_INPUT` for an input its schema refuses (`settings.update` with an unknown key).
4. **What a refusal test asserts.** The exact `error.code`. The `details.reason`, when one is defined. That nothing was written, no `project.changed` was emitted and no undo entry was added.

- `AGENT_DENIED` and `AGENT_REFUSED` come from the bus and the policy table, not from the command. They are tested once for the bus and by the policy table test (`tests/unit/main/commands/agent-policy-table.test.ts`, which checks the table exactly; a new command adds its row). They do not count as a command's refusal test.
- A command with no rule to break is complete under rule 3. Nobody invents a rule so that it can return `RULE_VIOLATION`.
- Phase 1 refusals: `project.create` (`file_exists`), `project.open` (`newer_version`, `duplicate_project`, `not_a_project`, `PROJECT_LOCKED`, `NOT_FOUND` for a path with no file), `project.close` (`project_not_open`), `settings.update` (`INVALID_INPUT`), `secret.set` (`secure_storage_unavailable`), `secret.delete` (`NOT_FOUND`), `history.undo` (`nothing_to_undo`), `history.redo` (`nothing_to_redo`).

## Named tests that must keep passing

Each test below must exist and keep passing. A test marked "Not built" is written by the phase named.

| Test | File |
|------|------|
| A refused undo leaves the entry in its place on the undo list and the redo list unchanged; the same for a refused redo [REQ: FR-095]. Uses a test-only command whose inverse can be told to refuse | `tests/integration/commands/named-tests.test.ts` |
| A handler that throws an unknown error gives `INTERNAL` with the fixed message, writes the error to the log and changes nothing in the project | `tests/integration/commands/internal.test.ts` |
| With two projects open that hold a variant with the same ID, a command naming one project changes only that project | `tests/integration/commands/named-tests.test.ts` |
| `history.redo` on an empty list returns `RULE_VIOLATION` with `nothing_to_redo` | `tests/integration/commands/reasons.test.ts` |
| Opening a newer-version file asserts `RULE_VIOLATION` and `newer_version` | `tests/integration/commands/project-open.test.ts` |
| The key guard returns `NEEDS_KEY` with `details.provider` when a provider's secrets are not all saved, and passes once they are. `requireProviderKeys(deps, providerId, purpose)` in `src/main/providers/require-keys.ts` is the only `NEEDS_KEY` guard; includes a test-only command sent through the bus | `tests/integration/providers/require-keys.test.ts` |
| A `project.changed` event equals the difference in the project file: a delete with child rows names every removed child; a join-table row is removed by its two-part key | `tests/integration/commands/project-changed.test.ts` |
| The built page carries the strict content security policy, and a packaged app ignores `ELECTRON_RENDERER_URL`. Whole policy texts are compared, never contains-matches | `tests/build/built-page.test.ts`, `tests/e2e/csp.spec.ts`, `tests/unit/main/windows/window-security.test.ts` |
| The app window opens maximized and not full screen [D-031] | `tests/e2e/window.spec.ts` |
| A project name whose part before the first dot is a name Windows reserves is refused; a name that only contains such a word is allowed | `tests/unit/shared/schemas/project-name.test.ts` |
| No error from a Phase 1 command holds a file path in `details`. Runs `file_exists` and the `project.open` `NOT_FOUND` case and compares the whole error | `tests/integration/commands/no-path-in-errors.test.ts` |
| When `run` throws and `undoPrepare` throws too, the command returns the error from `run`, and the log has one `warn` line with `step: 'undoPrepare'` and the same `commandId` | `tests/integration/commands/undo-prepare-log.test.ts` |
| `details.issues` names fields and never holds an input value | `tests/integration/commands/issues-no-value.test.ts` |
| An internal command is refused when sent from a window | `tests/integration/commands/internal-command.test.ts` |
| A generated PNG has a `generation` chunk [REQ: FR-068] | `tests/integration/generation/run-images-core.test.ts` |
| An exported PNG has no `generation` chunk [REQ: FR-068] | Not built (Phase 8) |
| No MCP tool reply, log line or project file contains a secret value. Saves a value for every secret name, `mcp.token` included; calls every listed tool with the ComfyUI address and an asset path planted [REQ: FR-198] | `tests/integration/mcp/secret-leak.test.ts` (grows with each tool) |
| `mcp.getConnectInfo` is refused for the agent actor, and it is the only query whose reply contains a secret value [D-014] | `tests/integration/queries/mcp-connect-info.test.ts` |
| `render_variant` writes no file [REQ: FR-193, D-030]. Lists every file under the project's folder, its assets folder, a temporary app data folder and a temporary folder set as the system's temporary folder; calls the tool; lists again. Equal apart from the activity log. The reply holds one `image/png` item and no path | Not built (Phase 10) |
| The same variant drawn at frame `i` twice gives identical pictures [REQ: FR-131] | Not built (Phase 8) |
| A video export of a fixed variant has exactly `ceil(duration × fps)` frames [REQ: FR-131] | Not built (Phase 8) |
| Publishing campaign A never lists, writes or deletes outside `{campaignIdA}/` [REQ: FR-164] | Not built (Phase 9) |
| An agent `set_translation` never yields `approved` [REQ: FR-200] | Not built (Phase 6 command, Phase 10 tool) |
| Editing a master changes no other variant's layer rows [REQ: FR-081] | Not built (Phase 5) |
| Format round trip keeps every video setting [D-026]. Builds a video variant with a changed duration and `duration_overridden` set, two clips with trims and a placement, and a layer with its own timing, entrance and exit and overrides on them; changes it to image and back. Every value in the table of `spec/data-rules.md`, format change, is equal to before, clip IDs included, and no clip was added. Runs once on a master and once on a linked variant | Not built (Phase 7) |
| `variant.setFormat` is refused in each direction when the target cell already has a variant, and nothing is written [REQ: R-20]. Also covers an undo refused because the cell was taken after the change | Not built (Phase 7) |
| The app starts and completes import, manual layout and image export with no secrets saved and the network disabled [REQ: 8.2] | Not built (Phase 8) |
| A layer command sent as the user leaves `variant.agent_changed_at` null; the same sent as the agent sets it to the command's time [REQ: FR-239] | `tests/integration/commands/layer-update-agent.test.ts`. Built |
| Undo then redo of `layer.delete` brings back the same layer ID, key, counters and order | `tests/integration/commands/layer-delete.test.ts`. Built |
| A `layer.reportOverflow` naming an older `variantRev` writes nothing | `tests/integration/commands/layer-report-overflow.test.ts`. Built |
| A drag sends exactly one `layer.update` on release, and Escape sends none [REQ: 8.2] | `tests/unit/renderer/editor/canvas-overlay.test.tsx`. Not built (Phase 3) |
| A picture with a transparent background keeps it in the drawn variant [REQ: FR-245] | `tests/e2e/scene-reference.spec.ts`, case `transparent-hole`. Built |
| Overflow is set by the render service when text grows past its box by size and by letter spacing, and cleared when it fits [REQ: FR-098, FR-249] | `tests/e2e/scene-overflow.spec.ts`. Built |
| The tab keys step through variant tabs and campaign tabs and wrap round [REQ: FR-242] | `tests/unit/renderer/app/tab-keys.test.tsx`. Not built (Phase 3) |
| Security: `window.drop` has only `pathOf`; a page-made `File` gives no path; `window.api` unchanged | `tests/e2e/drop-bridge.spec.ts` |
| Security: server text holding `<a href>` shows as characters in a run failure | `tests/unit/renderer/screens/campaign/run-failure.test.tsx` |

**Other pinned tests and fixtures:**

- `tests/integration/registration.test.ts` ("hands every domain the CoreDeps fields of Section 12") compares the whole `CoreDeps` field list: `appVersion`, `assets`, `devTools`, `fitPicture`, `jobs`, `log`, `now`, `openExternal`, `projects`, `providers`, `render`, `secrets`, `settings`, `toPng`, `undo`, `userDataDir` (sixteen). A later field extends it.
- `tests/integration/registration-phase2.test.ts`: `Object.keys(campaignQueries(deps))` equals `['campaign.get']`.
- A test checks that every command name in `agent-policy.ts` has at most one handler and that every registered handler has a policy row.
- `tests/integration/core-options.test.ts` ("puts the asset service and the job service on CoreDeps"): `missingAssetIds`, `resolve`, `assetsDir`, `writeManaged` and `read` on `deps.assets` are functions.
- `tests/unit/shared/schemas/events-asset.test.ts`: `EVENT_NAMES` holds `'asset.changedOnDisk'`.
- `tests/unit/shared/schemas/contracts.test.ts` pins `JOBS_AT_ONCE_PER_PROVIDER` at 4.
- `tests/unit/main/providers/adapters.test.ts`: "uses the real provider folders: a job the provider does not do is INVALID_INPUT" (`gemini` + `video`); `local-storage` + `storage` is `INVALID_INPUT` with the real table.
- `tests/integration/db/migration-0001.test.ts` tests `0001` alone with `bundledMigrations.slice(0, 2)`. `migration-0002.test.ts`: three tags in order; `schema_version` 3; an old row gains `started_by: 'user'`, `error_reason: null`; `'robot'` refused, `'agent'` accepted, in old and new files.
- ComfyUI client: `tests/unit/main/providers/comfyui/client-environment.test.ts` (hostile proxy and TLS variables; own `Agent` with no `proxyEnv`; the call list `tests/helpers/comfy-every-call.ts` covers every network function; `rejectUnauthorized: true` on every https call; certificate codes give `certificate`). `client-source.test.ts` (request and lookup imports, `clear`).
- Campaigns: `tests/integration/campaigns/campaign-get.test.ts`, `campaign-delete.test.ts`, `campaign-update.test.ts`, `campaign-damaged-row.test.ts`, `brief-parse.test.ts` (a malformed YAML gives a reply holding the bad line, and a log line with the line number and no word of the file).
- Generation: `tests/integration/generation/image-kind-errors.test.ts` (a reference gone after enqueue ends `failed`, kind `other`, no path in the row or log), `image-kind-race.test.ts`, `tests/integration/assets/assets-dir-race.test.ts`. `tests/integration/generation/comfy-run.test.ts`: `generation.runImages` with `comfyui` against the stand-in gives stored PNGs with the embedded details of `spec/export-and-checks.md`, `paid_calls` 0, and the address appears nowhere in the project file.
- ComfyUI references (`tests/integration/generation/run-images-comfy.test.ts` and adapter tests): one reference sends exactly one upload whose body holds the asset's bytes under `adman-{16 hex}.png`; no request holds the asset's display name or any part of its path; the filled graph names the file the stand-in answered with; two references are refused with `too_many_references`, `details.max` 1, no job row; a reference run against a non-ComfyUI stand-in sends one `GET /system_stats` and no upload.
- `tests/e2e/asset-protocol.spec.ts`: with a project open and one imported picture, an image element pointed at its `adman-asset://` address loads; an unknown asset ID does not; a project not open does not.
- One-run-per-click: `tests/unit/renderer/screens/campaign/generate-panel-click.test.tsx`, `run-row-click.test.tsx`.
- `tests/unit/config/live-config.test.ts`: no `.ts`/`.tsx` file under `tests/unit/`, `tests/integration/`, `tests/e2e/` or `src/` holds the text `vitest.live.config`, and no file under `src/` holds `.env.local`.

**Fixtures and helpers:**

- `tests/integration/row-fixtures.ts` exports `VALID_BRIEF` = `{ campaignName: 'Summer', region: 'US', audience: 'All', message: 'Hello', subjects: [{ name: 'Bottle' }] }`, used by `insertCampaign` and `seedVariant`.
- `tests/integration/jobs/runner-fixture.ts` options: `cancelWaitMs` (default 2_000), `closeWaitMs` (default 50), `jobsAtOnce` (default 3), `secrets` (record handed to the secrets `get`). Returns `project` and `projects`.
- `tests/unit/renderer/screens/project-home/project-fixture.ts`: `campaign()` defaults `variantCount: 0`.
- Renderer tests are component tests with `tests/unit/renderer/fake-api.ts`. The helper may gain query and event answers as a make-it-compile edit.
- Brief timed tests run at a fixed `BRIEF_TEST_BYTES = 16_384` (`tests/unit/shared/brief/test-size.ts`), not an app limit. They gate nothing; a developer may raise a number on a slow machine and report it. One test reads a valid JSON and YAML brief of 100,000 bytes.
- Platform skips: the letter-case test for `project.open` skips on a case-sensitive file system (it runs on both CI systems). Tests that need a symlink, or that remove read permission, skip where the platform cannot. The S3 environment test restores every variable it sets (`stubEnv` / `unstubAllEnvs`).
- The hand-test confinement tests compare the whole app data tree and `secrets.bin`, `settings.json`, `logs/app.log` byte for byte, leaving out `logs/activity-*.jsonl`.

## Rules for changing tests

The base rule: an existing test is not edited without the architect's ruling. These edits are allowed without one.

**Make-it-compile edit.** All must hold:
1. The spec changed a type or schema (a field was added or became required), and a test or helper that builds a whole value of that type by hand no longer compiles or passes the schema.
2. The edit only adds the new field to that hand-built value, with the safest plain value: `false`, `null`, an empty list, the stand-in the spec names, or a function that throws.
3. No assertion is changed, removed, weakened or skipped. No `expect` line, expected value, test name, `it`/`describe` call or snapshot is touched, and no test is deleted or marked `skip`, `todo` or `only`.
4. The report lists each such edit: file, field, value.

**New tests.** Adding a new test, a new helper, or one include line to a Vitest config so that a new test folder the spec names is run. New tests go into an existing test file where one fits. In an existing file:
1. Only whole new `it` or `describe` blocks are added, with the constants and helpers those blocks alone use.
2. No existing line is changed, moved or removed, except that an import line may gain a name or a new import line may be added.
3. An existing `beforeEach`, `afterEach`, fixture or shared constant is not touched. A new `it` inside an existing `describe` may use them as they are.
4. The file stays at 300 lines or fewer. Otherwise the new tests go in a new file beside it.
5. The report names each file and each block added.

**Placeholder tests.** A placeholder test says something the spec plans is not there yet: an adapter not built, a stand-in that throws, an empty handler list.
1. New ones are not written against shared, real tables. A test of "not built" hands in its own table or stand-in (as the `adapterFrom` cases in `adapters.test.ts` do). A test on the real thing asserts something that stays true.
2. When planned work breaks one, the developer whose slice the spec tells to build that thing may replace the "not there yet" assertion with one about the built thing (or a case that stays true), or remove the test of a replaced stand-in's throwing body. The test name is updated. Nothing else in the file changes.
3. The report names the test, the spec line that told the slice to build the thing, and the change. With no such line, it is not a placeholder test: stop and ask.
4. A test that lists a domain's command or query names exactly: the slice that owns the domain adds its own names.

**Tidying after an approved change.** When an approved change removes a test or case, an import, constant or helper in that file that nothing uses any more may be removed so lint passes. The report names it.

**Correcting a test's name.** When an approved ruling made an `it` or `describe` name untrue: only the untrue words change (a version or item tag may be brought up to date); no assertion or other body line changes; the report gives the ruling and each old and new name. In the same edit the developer may add an assertion of something the ruling says is true.

**Flaky tests.** A test whose cause is its own wait or an order assumption may get the smallest edit to its set-up and wait lines, with no `expect` change, and must then pass 20 runs in a row. If the cause is under `src/`, change nothing and report. A wrong `paid_calls` is a cost matter and gets a ruling. The one known flaky case, in `generate-panel.test.tsx` under full-suite load, is re-run once and noted; it is never ignored when the file is run alone.

**Still needs a ruling:** changing or removing an assertion or expected value; changing what a fixture stores when a test reads it back; loosening a type, schema or lint rule so a test passes; any `as any`, `@ts-expect-error` or similar. If a test fails after a make-it-compile edit, stop and report. Markup kept only for a test is not added (for example, the campaign page carries no `data-project-id`; the project-home test proves the IDs by `campaign.get` being sent once with `{ projectId, campaignId }`).

## Test data

- Tests create project files in a temporary folder and set `ADMAN_USER_DATA_DIR` to another temporary folder.
- `ADMAN_FAKE_PROVIDERS=1` registers the `fake` provider for every job (`spec/jobs.md`, the fake provider). It returns fixed pictures, a fixed 2-second video, layout boxes from a fixed rule and "translations" made by adding a language tag to the source text. It can be told to fail with each error kind.
- `examples/` holds `brief.yaml`. Built so far: `brief.yaml` only. Not built (Phase 11): two subjects, four small source images and the six exported PNGs (three sizes, two languages) that the README shows [REQ: FR-180].
- No real provider is called in CI.

## Contract tests

Built for Gemini and S3. Provider adapters are tested against recorded responses in `tests/fixtures/providers/` (`gemini/`, `s3/`, each with a `README.md`). The MCP tool list is snapshot-tested (`tests/integration/mcp/tool-list.test.ts`), so a change to a tool's name or input is a visible diff. The snapshot holds the tools built so far: 11 on `main` (`list_projects`, `get_project`, `list_assets`, `get_campaign`, `create_campaign`, `get_slots`, `get_job`, `list_jobs`, `generate_images`, `generate_video`, `cancel_job`); each slice that adds a tool updates it (all 25 of `spec/mcp-and-agents.md` by Phase 10).

## Non-functional targets

The stakeholder set no numeric targets [REQ: 8.1]. These are the testable targets this design commits to.

| Attribute | Target | Measurement |
|-----------|--------|-------------|
| UI during a background job | The window stays usable. Jobs run in the main process or the hidden window. | End-to-end test edits a layer while a fake video job runs [REQ: FR-124]. Not built (Phase 7) |
| Export determinism | Same frames on any machine | Named tests above [REQ: FR-131] |
| Data loss on crash | At most the edit in progress | Integration test kills the process after a command and reopens [REQ: 8.2] |
| Work with no keys and no network | Import, layout, checks, image and video export | Named test above [REQ: 8.2] |
| Accessibility | WCAG 2.1 AA for controls. Canvas contents are best effort. | axe-core, keyboard tests [REQ: 8.6] |
| Platforms | macOS 12 or later (arm64, x64), Windows 10 or later (x64) | CI runs both [REQ: 8.8] |
| Scale | No hard limit on subjects, campaigns, variants or duration. The campaign grid draws only visible tiles. | Integration test with 500 variants [REQ: 8.3]. Not built (Phase 5) |
| Availability, RTO, RPO, concurrent users, throughput | Not applicable to a single-user desktop app | — |

**Accessibility rules** [REQ: 8.6]: every control is a Radix primitive or a native element with a visible label or `aria-label`; focus rings are never removed; text and controls use design tokens that meet 4.5:1 contrast; every action on the canvas (select, move, resize, reorder) also has a keyboard path through the layer list and the properties panel.

**Keyboard shortcuts** [REQ: FR-097, FR-242]: the table is in `spec/editor.md`, "Keyboard shortcuts"; the code owner is `src/renderer/ui/shortcuts.ts`. Not built (Phase 3). On the timeline, play or pause with `Space` (Phase 7).

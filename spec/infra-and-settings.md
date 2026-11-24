# Infrastructure and settings

Where the app runs, the CI checks, release and packaging, how keys are stored, every environment variable, and `settings.json`. Read with `spec/security.md` (the rules these serve) and `spec/testing.md` (the test runs these variables switch on).

## Environments

| Environment | Purpose | Infrastructure | Access |
|-------------|---------|----------------|--------|
| local | Developer workstation | `npm run dev` (electron-vite). Fake providers when `ADMAN_FAKE_PROVIDERS=1`. | Developer |
| ci | Lint, type check, tests, secret scan, build | GitHub Actions (`.github/workflows/ci.yml`) | Automatic |
| release | Installers for users | GitHub Releases | Public download |

There is no dev, staging or production server. The app owns no cloud hosting: the public GitHub repository holds the code and the release files [REQ: 9.2]. No containers, no orchestration, no infrastructure as code.

## Scripts

Built. Owner: `package.json`. The project needs Node 22.12 or newer (`engines`); CI uses Node 24.

| Script | Command | What it is for |
|--------|---------|----------------|
| `dev` | `electron-vite dev` | Run the app from the development server |
| `build` | `electron-vite build` | Build main, preload and renderer into `out/` |
| `start` | `electron-vite preview` | Run the built app |
| `lint` | `eslint . && prettier --check .` | Lint and format check |
| `format` | `prettier --write .` | Format |
| `typecheck` | `tsc --noEmit -p tsconfig.json` | Type check |
| `test` | `vitest run` | Unit and integration tests |
| `test:watch` | `vitest` | Same, watching |
| `test:coverage` | `vitest run --coverage` | Tests with coverage thresholds |
| `test:build` | `vitest run --config vitest.build.config.ts` | Built-page check (`tests/build/built-page.test.ts`) |
| `test:live` | `vitest run --config vitest.live.config.ts` | Paid calls to real services, `tests/live/`. Run by the project owner only. |
| `test:comfy` | `vitest run --config vitest.comfy.config.ts` | Real ComfyUI server, `tests/comfy/` |
| `test:e2e` | `npm run build && playwright test` | Offline end-to-end, `tests/e2e/` |
| `test:e2e:real` | `npm run build && playwright test --config playwright.real.config.ts` | End-to-end against the real ComfyUI server, `tests/e2e-real/` |
| `shots` | `npm run build && playwright test --config playwright.shots.config.ts` | Screenshots of the built app's screens into `shots/` (not in git), `tests/shots/`. Never a routine check |
| `db:generate` | `drizzle-kit generate` | Make a migration |
| `package` | `npm run build && electron-builder` | Installers |
| `package:dir` | `npm run build && electron-builder --dir` | Unpacked app folder |
| `package:mac` | `npm run build && electron-builder --mac dmg --arm64 --publish never` | The release DMG for Apple silicon, built on a Mac |
| `package:mac:demo` | `npm run build && electron-builder --mac dir --arm64 --publish never && node scripts/demo/zip-mac.mjs` | A hand-out for a demo, built on a Mac: `demo.zip` at the repository root, holding the unpacked app, `.env.local`, and each path listed in `demo-extras.txt` (one per line). Neither file is in git. The zip holds keys, so it is shared only with people who may have them; it is never a release |
| `package:win` | `npm run build && electron-builder --win nsis --x64 --publish never` | The release installer for Windows x64, built on Windows |

`npm test` never includes `tests/live/`, `tests/comfy/` or `tests/e2e-real/`. How each run is used, who may run it and its print rules are in `spec/testing.md`.

## CI pipeline

Push and pull request: Built (`.github/workflows/ci.yml`). There is no tag pipeline: releases are built on a person's own computer (D-102, "Release and packaging" below).

On every push and pull request, with `permissions: contents: read`:

| Job | Runs on | Steps | Fails the run? |
|-----|---------|-------|----------------|
| Lint and type check | `macos-latest` | `npm ci`, `npm run lint` (ESLint and Prettier check), `npm run typecheck` | Yes |
| Secret scan | `ubuntu-latest` | gitleaks (`gitleaks/gitleaks-action@v2`, full history) | Yes |
| Dependency audit | `ubuntu-latest` | `npm audit --audit-level=high` with `continue-on-error: true` | No, it reports only |
| Unit and integration tests | `macos-latest`, `windows-latest` | `npm ci`, `npm test`, then `npm run test:coverage` with `continue-on-error: true` | `npm test` yes; coverage no |
| Build | `macos-latest`, `windows-latest`, after lint and tests | `npm ci`, `npm run build`, `npm run test:build` | Yes |

- **Coverage.** `@vitest/coverage-v8`. Coverage includes `src/shared/**` and `src/main/**` (providers included). Thresholds: `src/shared/**` 90% lines, `src/main/**` 80% lines, set only in `vitest.config.ts`. Reporters include `json-summary`. A threshold is never lowered and no exclusion is added to pass it. The push step has `continue-on-error: true`; this is accepted only because `npm test` fails on its own, and the tag pipeline runs coverage without the mark.
- **Dependency audit.** Reports and does not fail a push: a new advisory in a package nobody touched must not block parallel work. Phase 11 makes it fail the tag pipeline.
- **Lint rules that CI enforces.** No semicolons. `max-lines` 300 per file. No `any`. No `console` except `console.error`. ESLint keeps `electron` out of every file `src/main/core.ts` imports, checked per file. Asset paths are joined only in `src/main/assets/path-resolver.ts` (a `no-restricted-syntax` rule). Code rules in full: `spec/structure.md`.
- **Merge rule.** Each slice is reviewed and merged to `main` one at a time. After each merge the full checks run on `main`: lint, typecheck, all tests with none left out, build and `test:build`. A security-class slice merges only after its review passes.
- No CI workflow names `test:live`, `test:comfy` or `test:e2e:real`. Nothing in CI calls a real provider.

Not built yet:

- **Scene reference-picture tests** on macOS and Windows: a push step that runs them in Playwright (Electron and the render window), not in Vitest (`spec/testing.md`, "Reference pictures"). Not built (Phase 3, with the Scene).
- **Licence check**: Not built (Phase 11). Fails on GPL or AGPL packages, on push and on tags from then on. Comes with `LICENSE` and `THIRD-PARTY-NOTICES.md`.
- **No tag pipeline.** The stakeholder chose local builds (D-102). No workflow builds an installer or makes a release, and `tests/unit/config/installer-config.test.ts` checks that `.github/workflows/release.yml` does not exist.

## Release and packaging

Packaging config: Built (`electron-builder.json`). Release scripts and the README's release and first-launch steps: Built.

- **A release is built locally and uploaded by hand** (D-102). `npm run package:mac` makes the Apple silicon DMG on a Mac; `npm run package:win` makes the NSIS x64 installer on a Windows PC. Each needs `npm run fetch:ffmpeg` run once on that computer first, because the script gets FFmpeg only for the machine it runs on. A person then makes the release on GitHub and attaches the files. `electron-builder.json` has `"publish": null` and both scripts pass `--publish never`, so the builder itself never uploads.
- **No Intel Mac installer.** FFmpeg is built for the machine it runs on, so an Intel DMG needs an Intel Mac. `npm run package` still names both Mac kinds; on an Apple silicon Mac its x64 DMG would have no FFmpeg, so the release scripts are the ones to use. FFmpeg in the package: Built (P8-18, "FFmpeg" below).

- `electron-builder.json`: `appId` `com.adman.app`, `productName` "AdManager", output `dist/`, files `out/**` and `package.json`, native `.node` files unpacked from the archive. macOS: DMG for arm64 and x64, no signing identity, icon `resources/icon.icns`. Windows: NSIS x64, not one-click, per user, icon `resources/icon.png`.
- **The app's name** (R2P-11). People see "AdManager": the window title, the menus ("About AdManager", "Hide AdManager", "Quit AdManager"), the About panel, the quit question "Quit AdManager?", the start screen, the bundle and installer names. One owner: `APP_DISPLAY_NAME` in `src/shared/config/app-name.ts`. On purpose the old name stays where changing it would lose the user's data or keys: `package.json` `name` and `productName` ("Adman", which sets the run-time `app.name`), the `appId`, the data folder (`Application Support/Adman`, `%APPDATA%\Adman`), the Keychain entry "Adman Safe Storage", the `.adman` file type and its words, `adman-asset://`, every `ADMAN_` variable, the MCP server name `adman`, the default projects folder "Adman Projects", and sentences inside messages. `npm run test:package` (after `npm run package:dir`) checks the packaged names on macOS. Whether the Keychain entry keeps working after the rename is the stakeholder's hand check (`spec/phases/round-2-verify.md`).
- **The icon** (R2P-11): three stacked rounded squares in the accent colour on a dark ground, no letters. One source, `src/renderer/ui/app-mark/app-mark.svg`; `resources/icon.png` and `resources/icon.icns` are made from it by `scripts/icon/` and committed. The start screen shows the same mark; under `npm run dev` on macOS the Dock shows it too.
- **One running copy** (R2P-9). The single-instance lock is taken inside `app.whenReady()`, before start-up, so a project file macOS hands over at launch is already held. A second copy quits at once and hands its project paths (at most 20 absolute `.adman` paths) to the running app, which opens each with `project.open`'s own checks and sends `app.showProject`. On Windows the path comes on the command line as before. Code: `src/main/single-instance.ts`, `open-from-system.ts`.
- **File association** [REQ: R-06]: the installer registers the `.adman` extension (`fileAssociations`, MIME `application/x-adman`; on macOS the exported type `com.adman.project`) so a double-click opens the project.
- **Branches.** `main` is always releasable. Work happens on short branches merged by pull request.
- **Rollback.** Users install an earlier release by hand [REQ: 8.7]. A bad release is marked as such and a new one is published.
- **Unsigned installers** [REQ: R-16]. The README explains the first-launch steps: on macOS, right-click and choose Open, or allow it in System Settings; on Windows, choose "More info" then "Run anyway". The stakeholder accepted that a user needs the README for these standard steps, and only these [D-015]. Nothing else in setup may need the README [REQ: 8.7].
- **No automatic updates** [REQ: 1.4].
- **Packaged check, Phase 11 gate.** `better-sqlite3` has no install script and ships ready-made binaries (macOS arm64 and x64, Windows x64 and arm64) on Node's stable native interface, so one file loads in Node (tests) and in Electron (the app). Still needed: one packaged app that opens a project on each system. The first packaged run should check it.

### FFmpeg [REQ: FR-143, 9.3]

Built: the fetch script and the media runner (Phase 7); packaging and the FFmpeg notice (P8-18: `extraResources` carries only `resources/ffmpeg/${platform}-${arch}`; `electronFuses` switch off run-as-node, `NODE_OPTIONS` and the inspect flags and load the app only from the asar). Not built: the release step (Phase 11), which also puts the full LGPL text and `THIRD-PARTY-NOTICES.md` inside the package.

- **Where it comes from, how it is fetched and checked:** `spec/phases/phase-07.md`, "Where FFmpeg comes from", "Pin checks", "Configure flags" and "Licence check"; the fetch script is slice P7-3 (`npm run fetch:ffmpeg`, `scripts/ffmpeg/fetch.mjs`, pins in `scripts/ffmpeg-sources.json`). It is never run by `npm install` or `npm ci`. The binaries are not committed.
- **How it is run:** `spec/phases/phase-07.md`, "How FFmpeg is run" (the one place it is spawned, and the rules for every later FFmpeg slice).
- Placed at `resources/ffmpeg/{platform}-{arch}/ffmpeg[.exe]`, in development and in the packaged app.
- `THIRD-PARTY-NOTICES.md` carries the LGPL text, the exact build flags and a link to the matching source (P8-18).

## Packages: licences and install scripts

Built (`package.json` `allowScripts`; test `tests/unit/config/install-scripts.test.ts`).

- **Licences.** All npm dependencies must be under MIT, ISC, BSD, Apache-2.0 or similar; GPL and AGPL are refused (`spec/security.md`, "Accepted risks and compliance"). Every package named in the technology stack (`spec/overview.md`) is under an allowed licence. A developer who adds a package not named there checks its licence first and reports it.
- **Install scripts.** Some packages ask to run a script when installed.
  - The owner is the `allowScripts` list in `package.json`. No other file or setting decides it.
  - The default is no. A package's install script runs only when its entry is `true`.
  - Every package that asks gets an entry, `true` or `false`, pinned to its version. `npm install` and `npm ci` on a clean checkout then print no install-script warning. A warning means a package asks and nobody has decided.
  - A developer may add a `false` entry without asking. A developer never adds a `true` entry alone: they stop, report what the script does and what breaks without it, and the architect rules. The ruling goes in the table below.
  - A new version of a listed package is a new entry and a new decision.

| Package | Entry | Why |
|---------|-------|-----|
| `esbuild@0.18.20`, `@0.25.12`, `@0.28.2` | `true` | The build tools use it. Its script sets up the binary for this platform. Approved before this rule existed; the script has not been read. Stands until the stakeholder answers OI-27. |
| `electron-winstaller@5.4.0` | `true` | Comes with the installer builder. Same standing as `esbuild` (OI-27). |
| `better-sqlite3@13.2.0` | `false` | It has no install script. The `false` entry stays so a later version that adds one is denied by default. |
| `fsevents@2.3.3` | `false` | A macOS file watcher the development tools use if present. Not part of the shipped app; nothing needs its script. |
| `protobufjs@7.6.6` | `false` | Asks for a script; nothing needs it. |

OI-27 is open: the stakeholder has not answered on the `true` approvals made before the rule.

## Secrets

User secrets: Built (`src/main/secrets/secret-store.ts`, `src/main/secrets/safe-storage.ts`). The security rules for keys are in `spec/security.md`, "Keys and secrets".

**User secrets** [REQ: FR-170 to FR-173, R-10]

- Entered in the app, in Settings or in the key dialog that appears when an action first needs a key [REQ: FR-171].
- A key is not tested when entered [REQ: FR-172].
- Stored in `{userData}/secrets.bin`: a JSON map encrypted as a whole with `safeStorage.encryptString`.
- If `safeStorage.isEncryptionAvailable()` is false, the app refuses to save keys and says "This computer cannot store keys securely."
- `app.getState` lists each secret name with its last four characters (`lastFour`). A value of four characters or fewer shows no characters, because the last four would be the whole value.

| Secret name | Used by | Class | Can the user view it? |
|-------------|---------|-------|-----------------------|
| `gemini.apiKey` | Gemini | Provider key | Never. Last four characters only. |
| `fal.apiKey` | fal.ai | Provider key | Never. Last four characters only. |
| `firefly.clientId`, `firefly.clientSecret` | Firefly (disabled) | Provider key | Never. Last four characters only. |
| `s3.accessKeyId`, `s3.secretAccessKey` | S3 | Storage key | Never. Last four characters only. |
| `dropbox.refreshToken` | Dropbox | Storage key | Never. Last four characters only. |
| `mcp.token` | MCP server | Local access token | Yes, in full, in the Connect panel |

The two classes are [REQ: R-10, D-014].

**Repository secrets** [REQ: FR-181]

- `.gitignore` covers `.env*`, `*.adman`, `*.adman.bak`, `* Assets/`, `resources/ffmpeg/`, `out/`, `dist/`, `test-results/`, and `design/prototype/photos/` (the stakeholder's product photos). `examples/**` is the one exception (`!examples/**`).
- gitleaks runs on every push and pull request.
- CI needs only the built-in `GITHUB_TOKEN`.

## Environment variables

Built. Users never set any of these. They exist for development, tests and CI. User configuration is in `settings.json` (below).

### The app

| Variable | Read by | What it does | Default |
|----------|---------|--------------|---------|
| `ADMAN_FAKE_PROVIDERS` | `src/main/providers/registry.ts` (`listProviders`) | `1` adds the fake provider to the registry. It makes no network call. | Not set. `1` in `test:e2e` and in integration fixtures. |
| `ADMAN_USER_DATA_DIR` | `src/main/index.ts` (`userDataOverride`, `src/main/user-data-override.ts`) | Overrides the app data folder (`app.setPath('userData', …)`). A packaged app ignores it, so nothing in a user's environment can point the installed app at another folder of settings and secrets. | Not set. A temporary folder in end-to-end tests. |
| `ADMAN_LOG_LEVEL` | `src/main/core.ts` (`parseLogLevel`) | Lowest level written to the log. An unknown value reads as `info`. | `info` |
| `ADMAN_DEV_TOOLS` | `src/main/index.ts` (`devToolsEnabled`) | `1` switches on the dev-only switches, such as `trial` ComfyUI workflows offered to the user (the hand-test tools were removed in P9-14). Ignored by a packaged app: `devTools` is true only when `app.isPackaged` is false and the variable is `1`. | Not set |
| `ELECTRON_RENDERER_URL` | `src/main/windows/app-window.ts` (`pageAddress`) | Set by electron-vite in `npm run dev`. The window loads it only when the app is not packaged and it is `http://localhost:{port}` with at most one trailing slash (`spec/security.md`, "Renderer and windows"). | Set by the tool |

### `test:live` (paid calls; project owner only)

| Variable | What it does |
|----------|--------------|
| `GEMINI_API_KEY` | The owner's own Gemini key for the live Gemini cases. Also read by `test:e2e:real` for its paid case (terminal only). |
| `FAL_KEY` | The owner's own fal.ai key |
| `ADMAN_LIVE_S3_BUCKET`, `ADMAN_LIVE_S3_REGION`, `ADMAN_LIVE_S3_PREFIX` | The bucket the live storage test uses. It writes only under `{prefix}/adman-hand-test/`. |
| `ADMAN_LIVE_KEEP` | `1` leaves `adman-hand-test/hello.txt` in the bucket so a person can look at it; the next run without it removes it. |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Keys for that bucket. The test hands them to the adapter through `AdapterContext.secret`; the S3 library is not left to read them itself, so the app can never pick them up by accident. |
| `ADMAN_LIVE_REFERENCE_FILES` | Up to three absolute paths to PNG or JPEG files, used as references by the Gemini live reference case. Terminal only. Picture-by-path rules apply (`spec/security.md`, "Test runs"). |

### `test:comfy` (real ComfyUI server)

| Variable | What it does | Default |
|----------|--------------|---------|
| `COMFY_BASE_URL` | The address of the project's ComfyUI test server. Read from the terminal or `.env.local` by `vitest.comfy.config.ts` and nothing else. The app never reads it; the app's address is the one the user saves in Settings. Never printed, committed or put in a report. | — |
| `ADMAN_COMFY_VIDEO` | `1` lets case 2 (video from a prompt) run. Terminal only. Leaves one file on the server. | Not set |
| `ADMAN_COMFY_MOSS` | `1` lets case 3 (MOSS picture) run. Terminal only. | Not set |
| `ADMAN_COMFY_FLUX` | `1` lets case 5 (Flux picture from a reference) run. Terminal only. | Not set |
| `ADMAN_COMFY_FRAME` | `1` lets case 6 (H3 video from a first frame) run. Terminal only. Leaves one file on the server. | Not set |
| `ADMAN_COMFY_REFVIDEO` | `1` lets case 7 (H3 video from one reference) run. Terminal only. Leaves one file on the server. | Not set |
| `ADMAN_COMFY_CUTOUT` | `1` lets case 8 (cut-out on `birefnet-cutout`) run. Terminal only. | Not set |
| `ADMAN_COMFY_CUSTOM` | `1` lets case 9 (a custom workflow made from the shipped Flux graph) run. Terminal only. | Not set |
| `ADMAN_COMFY_PICTURE` | Absolute path to a PNG or JPEG used in place of the test-made picture by cases 5, 6 and 7. Terminal only. Picture-by-path rules apply. | Not set |

A plain `npm run test:comfy` runs only case 1, the check. Each switch is checked before any call.

### `test:e2e:real` (real ComfyUI server through the screens)

| Variable | What it does | Default |
|----------|--------------|---------|
| `COMFY_BASE_URL` | Same variable. Read by `tests/e2e-real/global-setup.ts` (named by `playwright.real.config.ts`) from the terminal or `.env.local`. Typed into Settings by the test, never printed. | — |
| `ADMAN_E2E_PICTURES` | Up to three absolute paths to product photos for "Add pictures". Terminal only. Picture-by-path rules apply. | Not set |
| `ADMAN_E2E_FLUX` | `1`: picture from one product reference | Not set |
| `ADMAN_E2E_MOSS` | `1`: picture from a prompt | Not set |
| `ADMAN_E2E_CANCEL` | `1`: start MOSS, cancel from its row | Not set |
| `ADMAN_E2E_VIDEO` | `1`: clip from a prompt | Not set |
| `ADMAN_E2E_VIDEO_FRAME` | `1`: clip from a first-frame picture | Not set |
| `ADMAN_E2E_VIDEO_REF` | `1`: clip from a reference picture | Not set |
| `ADMAN_E2E_GEMINI` | `1`: a paid Gemini run through the screens. Needs `GEMINI_API_KEY` in the terminal and the stakeholder's yes; no agent sets it. | Not set |
| `ADMAN_E2E_RUN_CHECKED` | Internal. Set to `1` by the global setup once its checks pass; each worker refuses to run without it. Never set by hand. | Set by the setup |
| `PLAYWRIGHT_NO_COPY_PROMPT` | Set to `1` by the global setup. | Set by the setup |

All switches are terminal only. With none set, only Settings → Check runs. `launchReal` (`tests/e2e-real/real-env.ts`) does not hand the app `ADMAN_FAKE_PROVIDERS`, `COMFY_BASE_URL`, `GEMINI_API_KEY` or any `ADMAN_E2E_*` name; it sets `ADMAN_DEV_TOOLS=1` and `ADMAN_USER_DATA_DIR` to the sandbox folder.

### CI

| Variable | What it does |
|----------|--------------|
| `GITHUB_TOKEN` | Provided by GitHub Actions. Used by the gitleaks action; later creates the draft release (Phase 11). |

### Rules for these variables

- A live test skips itself, with a line naming the missing variable, when its variables are not set. Live tests are never part of `npm test` or CI.
- No key from the environment is ever written to `secrets.bin`, a log or a project file.
- A blank picture-path variable counts as unset.

### `.env.local`

Built (`vitest.live.config.ts`, `tests/live/env-file.ts`, `vitest.comfy.config.ts`, `tests/comfy/env-file.ts`, `tests/e2e-real/global-setup.ts`).

A developer may keep some test variables in `.env.local` in the project root instead of typing them. `.gitignore` covers it (`.env*`). An agent never opens, prints or copies `.env.local`.

- **Who reads it.** `test:live`, `test:comfy` and `test:e2e:real` only, each through its own loader. The app (`src/`), `npm test`, the build, `test:e2e` and CI never read it. `vitest.config.ts` and `vitest.build.config.ts` load no variables and read no `.env` file.
- **Loading a config reads nothing.** `vitest.live.config.ts` and `vitest.comfy.config.ts` each export a function, `defineConfig(() => ({ … }))`. The file is read inside that function and nowhere else. Nothing at the top level touches the disk or `process.env`. Only Vitest, started with `--config`, calls the function. A reviewer checks the top level by reading.
- **Include lists.** One owner each: `LIVE_INCLUDE = ['tests/live/**/*.test.ts']` in `tests/live/env-file.ts`; `COMFY_INCLUDE = ['tests/comfy/**/*.test.ts']` in `tests/comfy/env-file.ts`.
- **No imports of the configs.** No `.ts` or `.tsx` file under `tests/unit/`, `tests/integration/`, `tests/e2e/` or `src/` imports `vitest.live.config` or `vitest.comfy.config`, and no file under `src/` holds the text `.env.local`. Checked by reading file text in `tests/unit/config/live-config.test.ts` and `tests/unit/config/comfy-config.test.ts`.
- **How.** Node's built-in `parseEnv` from `node:util`. No package is added.
- **Which names.**
  - `test:live` takes only `LIVE_ENV_NAMES`: `GEMINI_API_KEY`, `FAL_KEY`, `ADMAN_LIVE_S3_BUCKET`, `ADMAN_LIVE_S3_REGION`, `ADMAN_LIVE_S3_PREFIX`, `ADMAN_LIVE_KEEP`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (pure function `liveEnvFrom(fileText, alreadySet)`).
  - `test:comfy` takes only `COMFY_ENV_NAMES`: `COMFY_BASE_URL` (`comfyEnvFrom`). It is not in the live list and the comfy loader takes nothing from the live list, so the ComfyUI run can never load a paid key.
  - `test:e2e:real` takes only `COMFY_BASE_URL`.
  - Any other line in the file is ignored, so the file cannot switch on `ADMAN_DEV_TOOLS`, `ADMAN_FAKE_PROVIDERS`, a case switch or a picture path.
- **Which value wins.** A variable already set in the terminal wins over the file.
- **No file.** Not an error and no message.
- **Nothing is printed.** No value from the file is printed, logged, put in an error message, a test name, a snapshot or a report. Configs and tests may print variable names only. If the file cannot be parsed, the message names the file and nothing from inside it (".env.local could not be parsed").
- **Prefixes.** Vite and electron-vite read `.env.local` themselves but pass on only names that start with `VITE_`, `MAIN_VITE_`, `PRELOAD_VITE_` or `RENDERER_VITE_`. No variable with one of those prefixes is put in this file, so no key reaches the app that way.
- The stakeholder spoke of "the .env file". The loaders read `.env.local` only; a line kept in another file is moved by the stakeholder (OI-37: whether that move has been made).
- **Tests.** `tests/unit/live/env-file.test.ts` on `liveEnvFrom` with made-up text: a listed name is taken, an unlisted name is dropped, a name already set keeps its value. `tests/unit/config/comfy-env-file.test.ts`: no switch name is taken from the file. Neither reads a real file.

## settings.json

Built (`src/shared/schemas/settings.ts`, `src/main/settings/defaults.ts`, `src/main/settings/settings-store.ts`). The `agentRuns` and `agentRunLimit` keys and their writers `agentRuns.setAllowed` and `agentRuns.setLimit` are built (`spec/agent-runs.md`).

The file is `{userData}/settings.json`, written by the app only [REQ: FR-170].

```ts
type Settings = {
  defaultProjectDir: string            // min length 1; default: {Documents}/Adman Projects  [REQ: FR-004]
  recentProjects: Array<{ path: string; name: string; openedAt: string }>   // max 20  [REQ: FR-002]
  defaultProviders: { image: string; layout: string; text: string; video: string }  // default gemini, gemini, gemini, comfyui  [REQ: FR-067]
  generation: { optionsPerRun: number }          // whole number, at least 1; default 4  [REQ: FR-063]
  export: { imageFormat: 'png' | 'jpg'; jpgQuality: number; fps: 30 | 60 }   // jpgQuality whole 1 to 100; default png, 90, 30
  mcp: { enabled: boolean; port: number; autoApproveDestructive: boolean }   // port whole 1024 to 65535; default false, 47821, false  [REQ: FR-191, FR-197]
  storage: {
    s3: { bucket: string; region: string; prefix: string } | null
    dropbox: { accountName: string; rootPath: string } | null
  }                                              // default { s3: null, dropbox: null }
  comfyui: { baseUrl: string | null }            // default null. Written only by comfy.setAddress. Stored as an origin  [REQ: FR-250, FR-253]
  agentRuns: Record<string, { allowed: boolean }>  // provider ID to its tick; default {}. Written only by agentRuns.setAllowed  [REQ: FR-279]
  agentRunLimit: number                          // Whole number 1 to 16, default 4 (AGENT_MAX_ACTIVE_RUNS). Written only by agentRuns.setLimit
  licenceConfirmed: string[]                     // Model labels the user confirmed a commercial licence for; each 1 to 100 characters, at most 50; default []. Written by settings.update  [D-088]
  comfyWorkflowChoice: Partial<Record<'image' | 'image_refs' | 'video_prompt' | 'video_first_frame' | 'video_references', WorkflowId>>
                                                 // The workflow last picked in the run dialog, per job and start, on this computer; default {}. Written only by settings.update, after the person's run is accepted  [D-104]
  reports: { exporterName: string }              // trimmed, at most 100 characters, no control characters; default { exporterName: '' }. Written only by settings.update
  setup: { done: boolean }                       // default { done: false }; an older file loads with the default. Set true when the first-run setup closes in any way (R2E-10). Written only by settings.update
}
```

- `DEFAULT_PROVIDERS` lives in `src/main/providers/registry.ts`; `DEFAULT_MCP_PORT = 47821` in `defaults.ts`. `defaultProviders.image` and `.video` may be `comfyui` [REQ: FR-254]. A saved file naming `fal-seedance` for video is not rewritten (`fal-seedance` is available since P7-15, `spec/providers.md`).
- **Who writes what.** `settings.update` (schema `settingsPatchSchema`, strict) can change `defaultProjectDir`, `defaultProviders`, `generation`, `export`, `mcp` except `enabled`, `storage`, (from S2-4) `licenceConfirmed`, (D-104) `comfyWorkflowChoice`, `reports` and `setup` (agents are denied `settings.update`). An agent's run never changes `comfyWorkflowChoice`, and no agent reads it. It refuses every other key. The app keeps `recentProjects`. `mcp.enabled` has one writer, `mcp.setEnabled`, which also starts or stops the server. `comfyui` has one writer, `comfy.setAddress`. `agentRuns` has one writer, `agentRuns.setAllowed`. `agentRunLimit` has one writer, `agentRuns.setLimit`. These three keys are security class (`spec/security.md`).
- `settings.update` for `storage.s3` checks the region with `regionRefusal` (`spec/storage-and-publish.md`).

### Loading the file

Built (`settings-store.ts`). Security class.

- A file that fails the schema falls back to the defaults whole. A file whose `comfyui` is not an object is such a file.
- A file without `comfyui` or `agentRuns` gets the defaults for them.
- `reports.exporterName` from the file: a value that is missing, not a string, over 100 characters or holds a control character is read as an empty name. The other keys are kept.
- `merge` skips the key `__proto__` at every level. Reason: assigning that key sets an object's prototype, so a file with `"agentRuns": { "__proto__": { … } }` could put entries where a lookup finds them.
- Loading never writes the file. The store holds one copy of the settings in memory, and every save writes all of it.
- **`comfyui.baseUrl` from the file.**
  1. An address that passes `parseComfyAddress` (`src/shared/comfy/address.ts`) is held in memory as its origin, and a later save writes it in that form.
  2. An address that fails is read as null. The refused text is held nowhere: not in memory, not in a log line, an error or anything sent to the window.
  3. The next save, for any reason (a settings change, opening a project), writes null over it. The store keeps no second copy of the file's text. The user sees that no address is set and types it again. Whether to tell the user an address was refused is OI-50.
- **`agentRunLimit` from the file.** Any value that is not a whole number from 1 to 16 is read as 4.
- **`licenceConfirmed` from the file.** A value that fails its schema is read as `[]`; the other keys load as usual, so a bad list never resets the whole file.
- **`comfyWorkflowChoice` from the file.** A value that fails its schema is read as `{}`; the other keys load as usual. An ID in it that is no longer offered is ignored where it is read.

### Custom ComfyUI workflows folder

`{userData}/comfy-workflows/` holds one file per added workflow, `custom-{12 hex}.json`, written only by the app (a temporary file, then a rename, as `settings.json`). The folder is the list; files with other names are ignored, and a stored file that fails its checks is skipped with one warn line naming its ID only. Per computer, never in a project. Rules: `spec/comfyui-custom.md`, "The stored shape".
- **Tests** (`tests/unit/main/settings/settings-store-comfy.test.ts`): a file with a failing address loads with `baseUrl` null, and after one `touchRecent` the file on disk holds `baseUrl: null` with its other keys kept; a file with `http://127.0.0.1:8188` loads with that origin and still holds it after a save; a file with `"comfyui": { "__proto__": { "baseUrl": "http://169.254.169.254" } }` loads with `baseUrl` null; a file with `"agentRuns": { "__proto__": { "comfyui": { "allowed": true } } }` loads with `agentRuns` having no `comfyui` entry, own or inherited, and `Object.prototype` has no new key after either load.

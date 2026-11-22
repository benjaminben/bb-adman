# Project structure and code rules

Where code and tests live, the module rules, how commands and queries are registered, the code and naming rules, and the layout rule for renderer components. Read with `spec/testing.md` (what each test folder runs) and `spec/overview.md` (the component map).

## Folder tree

Built through Phase 4, with the look pack and the built approvals and subject-photo slices. One repository; the app is one package and `approvals-service/` is its own. The tree shows what is on `main`; a line marked `(Phase N)` names the phase that adds it, and those marked Phase 3 or 4 are built (`firefly/` is the Phase 4 stub).

```
project-root/
├── src/
│   ├── main/                      # Electron main process
│   │   ├── index.ts               # start-up, single-instance lock, joins core to IPC and windows; --mcp-bridge switch (Phase 10)
│   │   ├── core.ts                # builds every service and the handler list with no Electron import; tests use it as the app does
│   │   ├── core-deps.ts           # the CoreDeps type handed to every domain
│   │   ├── ipc.ts                 # joins window.api to the bus and the query runner; sets actor 'user'
│   │   ├── open-file.ts           # finds a project path in the command line (double-click on Windows)
│   │   ├── dev-tools-flag.ts      # devToolsEnabled(isPackaged, env)
│   │   ├── png-converter.ts       # pngConverter(decode): the toPng of CoreDeps
│   │   ├── picture-fitter.ts      # the fitPicture of CoreDeps: crop, then scale, PNG out
│   │   ├── windows/               # app-window.ts, app-window-options.ts, csp.ts, navigation.ts, open-external.ts,
│   │   │                          #   dialogs.ts (native pickers), asset-protocol.ts (registers adman-asset://)
│   │   ├── db/                    # schema/ (index, project, variant, jobs, approvals), migrations/ (drizzle-kit SQL, newest
│   │   │                          #   0005_video_and_sound, schema version 6), bundled-migrations.ts,
│   │   │                          #   project-file.ts (open, create, close, migration runner), meta.ts (project_meta),
│   │   │                          #   project-registry.ts (open projects), rows.ts (stored row to wire row and back)
│   │   ├── commands/              # bus.ts, types.ts, change-recorder.ts, agent-policy.ts, run-in-project.ts,
│   │   │                          #   one folder per domain with an index.ts: approvals, asset, brief, campaign, comfy, dev,
│   │   │                          #   generation, history, job, mcp, project, rule-set, secret, settings, storage, subject;
│   │   │                          #   storage/ holds check-s3.ts and require-s3-settings.ts (AP-10b)
│   │   ├── approvals/             # the approvals client, stores and helpers (spec/approvals-client.md)
│   │   ├── queries/               # queries.ts (runner), types.ts, one file per domain: app, asset, campaign (+ campaign-reads.ts),
│   │   │                          #   comfy, history, job (+ job-server-message.ts), mcp, project, template
│   │   ├── history/               # undo-lists.ts
│   │   ├── assets/                # path-resolver.ts, service.ts, types.ts, import, relink, package, sniff, change check,
│   │   │                          #   assets-dir.ts, read-picture.ts, asset-url.ts (adman-asset:// address to file, no Electron),
│   │   │                          #   brief-pictures.ts (a brief's photo paths, SP-1)
│   │   ├── jobs/                  # runner.ts, run-job.ts, start-up.ts (resume), cancel.ts, job-store.ts, job-error-log.ts,
│   │   │                          #   progress.ts, png-details.ts, types.ts; kinds/ (image-generation, video-generation)
│   │   ├── providers/             # registry.ts, require-keys.ts (the NEEDS_KEY guard), types.ts and adapters.ts (frozen),
│   │   │                          #   messages.ts, redact.ts, picture-type.ts, picture-size.ts, png-size.ts, picture-limits.ts,
│   │   │                          #   storage-paths.ts, video-check.ts;
│   │   │                          #   gemini/, comfyui/ (with workflows/), fal-seedance/, s3/, dropbox/, azure-blob/, fake/,
│   │   │                          #   local-storage/; firefly/ (Phase 4); jev/ (reserve, not planned)
│   │   ├── mcp/                   # server.ts, service.ts, sessions.ts, token.ts, request-guard.ts, agent-caller.ts, serial.ts,
│   │   │                          #   tools/ (index.ts, table.ts); bridge (Phase 10)
│   │   ├── secrets/               # secret-store.ts, safe-storage.ts
│   │   ├── settings/              # settings-store.ts, defaults.ts
│   │   ├── log/                   # activity-log.ts, error-context.ts
│   │   ├── render/                # the render window, draw, render-page, done-message (Electron edge)
│   │   ├── thumbnails/            # render service, queue, scene input, thumbnail paths and cache, eager (no Electron)
│   │   ├── export/                # image, video (FFmpeg filter builder), report, sheet (Phase 8)
│   │   └── publish/               # publish flow (Phase 9)
│   ├── preload/                   # index.ts: the window.api and window.drop bridges; render.ts: the render window's renderApi
│   ├── renderer/                  # app window (React). Files: "Renderer files on main" below
│   │   ├── main.tsx, index.html, env.d.ts; render.html
│   │   ├── render-worker/         # the render window's page: main.tsx, render-root/
│   │   ├── app/                   # app.tsx, app-context.tsx, app-shell/, error-banner/
│   │   ├── stores/                # app-store.ts, project-store.ts (one per open project), job-store.ts (one per campaign page);
│   │   │                          #   nav-store.ts, variant-store.ts (one per open variant tab) (Phase 3)
│   │   ├── dev/                   # the hand-test screen. Not product UI; removed in Phase 9
│   │   ├── screens/               # start, project-home, campaign, settings; editor screens (Phase 3);
│   │   │                          #   settings/ holds s3-section/, s3-check/ (AP-10b), approvals-section/ (AP-10)
│   │   ├── dialogs/               # key-dialog/; brief-confirm, slots, generation, run-confirm, fan-out, sync-review,
│   │   │                          #   export, publish, report, agent-permission, relink (later phases)
│   │   ├── ui/                    # tokens.css, base.css, layout.module.css, asset-url.ts, secret-labels.ts; shared controls;
│   │   │                          #   shortcuts.ts, variant-thumbnail/ (Phase 3); reference-picker/ (with reference-rows.ts, SP-7)
│   │   ├── editor/                # the editor's components and helpers (Phase 3; tree in spec/editor.md); timeline (Phase 7)
│   │   └── panels/                # activity (Phase 4)
│   └── shared/                    # no Electron or Node imports
│       ├── schemas/               # Zod: api.ts (window.api type, IPC channel names), result.ts, events.ts, settings.ts,
│       │                          #   secrets.ts, brief.ts, layer.ts (JSON columns), project.ts, project-name.ts,
│       │                          #   rows/ (wire rows, keys.ts), commands/{domain}.ts (+ project-scoped.ts),
│       │                          #   queries/{domain}.ts, jobs/ (image-generation.ts, video-generation.ts)
│       ├── brief/                 # parse.ts (parseBrief), draft.ts, size.ts, words.ts, languages.ts, bad-line.ts,
│       │                          #   yaml-tokens.ts, yaml-walk.ts: pure functions
│       ├── comfy/                 # address.ts, fit-size.ts, refused-hosts.ts
│       ├── config/                # defaults.ts, file-types.ts, region-languages.ts, job-kinds.ts, dev-tools.ts,
│       │                          #   default-layout.ts, brief-limits.ts, size-limits.ts, reserved-names.ts, agent-runs.ts;
│       │                          #   public-ids.ts, format-changes.ts (later phases)
│       ├── generation/            # prompt.ts: the pre-filled picture prompt and its two endings
│       ├── providers/             # messages.ts: plain error sentences, used by window and main process
│       ├── templates/             # starter.ts, master-layers.ts (buildMasterLayers), new-layer.ts, types.ts
│       ├── scene/                 # Scene component and helpers, fonts/ (bundled Inter) (files in spec/scene.md);
│       │                          #   presets.ts (Phase 7)
│       ├── links/                 # follow-rules.ts, out-of-date, sync preview (Phase 5)
│       ├── checks/                # the six checks (Phase 6)
│       └── paths/                 # output-paths.ts (Phase 8)
├── tests/
│   ├── unit/                      # mirrors src/: main/, preload/, renderer/, shared/; plus config/ (config and lint
│   │                              #   checks), live/ and e2e-real/ (pure parts of those harnesses)
│   ├── integration/               # real bus, handlers and queries on temporary project files; expect-changes.ts,
│   │                              #   core-fixture.ts, row-fixtures.ts; folders assets, campaigns, comfy-run, commands, db,
│   │                              #   generation, jobs, mcp, providers, queries
│   ├── build/                     # checks on the output of electron-vite build (built-page.test.ts)
│   ├── e2e/                       # offline Playwright specs and helpers
│   ├── e2e-real/                  # Playwright against the real ComfyUI server; never run by npm test or CI
│   ├── comfy/                     # hand-run tests against the real ComfyUI server (npm run test:comfy)
│   ├── live/                      # hand-run tests against paid providers (npm run test:live); never run by npm test or CI
│   ├── shots/                     # screenshot files (*.shots.ts, shot.ts) for npm run shots; never a routine check
│   ├── helpers/                   # shared test helpers (ComfyUI stand-in, call list, failure-of)
│   ├── fixtures/                  # briefs/, providers/ (recorded responses), video/, png-chunks.ts
│   └── reference-pictures/{darwin,win32}/   # (Phase 3)
├── examples/                      # brief.yaml; source images and six exported PNGs (Phase 11)
├── resources/                     # app icon; ffmpeg/ is fetched, not committed (Phase 7, Phase 8). The default font is in src/shared/scene/fonts/
├── scripts/                       # fetch-ffmpeg, ffmpeg-sources.json (Phase 7)
├── approvals-service/             # the approvals service, its own Next.js app (app/, src/, test/, e2e/); layout in
│                                  #   spec/approvals-service.md, "Folder and tooling"
├── comfy-workflows/               # the stakeholder's hand-test copies of the ComfyUI graphs; no code reads them; not in git
├── .github/workflows/             # ci.yml
├── LICENSE, THIRD-PARTY-NOTICES.md, README.md   # (Phase 11)
├── REQUIREMENTS.md, DECISIONS.md, SPEC.md, spec/
└── config files                   # package.json, tsconfig.json, eslint.config.js, electron.vite.config.ts,
                                   #   electron-builder.json, drizzle.config.ts, playwright.config.ts,
                                   #   playwright.real.config.ts, playwright.shots.config.ts, vitest.config.ts, vitest.build.config.ts,
                                   #   vitest.comfy.config.ts, vitest.live.config.ts; path-alias.config.ts
```

## Module rules

Built. Enforced by ESLint (`eslint.config.js`) where a rule says so.

- `src/shared/` imports nothing from `main`, `renderer`, `preload` or Electron.
- `src/renderer/` reaches the main process only through `window.api`. A screen imports nothing from `src/main/`.
- Only `src/main/assets/path-resolver.ts` builds asset paths. An ESLint rule bans `path.join` with asset fields elsewhere.
- The Scene is a pure component: props are the variant, its layers (clips from Phase 7), a map of asset IDs to their `adman-asset://` address and facts, the time in milliseconds, a mode (`full` or `overlay-only`) and an `onSettled` callback. It uses inline styles only and no app token. Full props: `spec/scene.md`. Built.
- `src/main/thumbnails/` is not an Electron edge place: it may not import `electron` or anything in `src/main/render/`. The Electron half of a draw is passed into `createCore` as `drawScene`.
- The render window's page (`src/renderer/render.html`, `src/renderer/render-worker/`) imports only `@/shared/` code and `@/renderer/ui/asset-url`. It has no `window.api`.
- A domain folder may hold helper files beside its handlers and its `index.ts`. A helper file exports no handler and is used only inside its own domain folder.
- The layout names folders and the files with a fixed role. A file it does not name is allowed inside a folder it names when the file follows the module rules. A new folder directly under `src/main/`, `src/shared/`, `src/renderer/` or `tests/`, or a new file directly in `src/main/`, needs a line in this file first.

### Electron stays at the edge

Only `src/main/index.ts`, `src/main/windows/`, `src/main/secrets/safe-storage.ts` and `src/main/render/` import `electron`. Nothing that `src/main/core.ts` imports, directly or through another file, may import it. What a service needs from Electron (folders, encryption, sending an event, asking the user, decoding a picture) is passed into `createCore` as an option. This lets integration tests run the real bus, handlers and queries.

ESLint looks at one file at a time and cannot follow a chain of imports, so the rule is stated per file, and this stricter form is the test of it:

- (a) Every file under `src/main/` outside the four edge places may not import `electron`, type-only imports included.
- (b) Those same files may not import anything from `src/main/windows/`, `src/main/render/`, `src/main/secrets/safe-storage.ts` or `src/main/index.ts`.

The list of edge places has one owner, the `electronEdge` list in `eslint.config.js`. Adding a place to it needs a line in this section first. Test: `tests/unit/config/electron-boundary.test.ts`.

Rule (b) is held by the `edgeFiles` import patterns in the same file. For the render folder they ban `@/main/render` and `**/render/**`, the folder and what is in it, not every path ending in `/render`. So `src/main/queries/render.ts`, `src/shared/schemas/queries/render.ts` and `src/shared/config/render.ts` are ordinary files that any file may import.

## Registering commands and queries

Built. Several developers work in parallel worktrees, so the files everyone would otherwise edit are kept out of their way.

| What | Where | Rule |
|------|-------|------|
| A command handler | `src/main/commands/{domain}/{action}.ts` | One handler per file, made with `defineCommand`. `{domain}` is the part of the command name before the dot (`asset`, `subject`, `campaign`, `ruleSet` as `rule-set/`). |
| A domain's handler list | `src/main/commands/{domain}/index.ts` | Exports one function, `{domain}Commands(deps: CoreDeps)`, that returns the domain's handlers as a list. Adding a command to a domain changes this file and no shared file. |
| The full handler list | `src/main/core.ts` | One import and one spread line per domain, in alphabetical order. It names no single command. |
| Shared services | `src/main/core-deps.ts` | The `CoreDeps` type, sixteen fields, all required: `appVersion`, `assets`, `devTools`, `fitPicture`, `jobs`, `log`, `now`, `openExternal`, `projects`, `providers`, `render`, `secrets`, `settings`, `toPng`, `undo`, `userDataDir`. `core.ts` builds it once and hands the same object to every domain. A domain takes what it needs and builds nothing shared. `tests/integration/registration.test.ts` compares the whole list; a new field extends it. |
| A domain's queries | `src/main/queries/{domain}.ts` | Exports `{domain}Queries(deps: CoreDeps)`, which returns a map of query name to function. `src/main/queries/queries.ts` is the runner. It merges the maps, one line per domain. |
| A command's input schema | `src/shared/schemas/commands/{domain}.ts` | One file per domain. Project-scope schemas extend `project-scoped.ts` (`spec/api-principles.md`). |
| A query's input schema and result type | `src/shared/schemas/queries/{domain}.ts` | One file per domain. There is no shared `queries.ts`. |
| The agent policy | `src/main/commands/agent-policy.ts` | Lists every command of `spec/api-commands.md`. A phase changes a row only when the spec changes the policy. A new command adds its row. |
| Events | `src/shared/schemas/events.ts` | A phase adds its own events. |
| The development tools switch | `src/main/dev-tools-flag.ts` | `devToolsEnabled(isPackaged, env)`, pure, no Electron import, unit-tested. `src/main/index.ts` is its only caller. |
| The picture converter | `src/main/png-converter.ts` | `pngConverter(decode)` gives the `toPng` of `CoreDeps`. No Electron import, unit-tested. `src/main/index.ts` is its only caller and passes `nativeImage.createFromBuffer`. It checks the picture limits (`spec/providers.md`) before it decodes. |
| The picture fitter | `src/main/picture-fitter.ts` | Gives the `fitPicture` of `CoreDeps`: crop to the run's shape, centred, then scale, never stretch; PNG out; the same checks and fixed refusal message as `toPng`. `decode` is passed in by `src/main/index.ts`. |
| Picture checks shared by adapters and the converter | `src/main/providers/picture-type.ts`, `picture-size.ts`, `png-size.ts`, `picture-limits.ts` | `pictureType(bytes)`, `pictureSize(bytes, mime)` with `pngPixelSize(bytes)`, and the limit constants. Pure, no Electron. No provider folder holds its own copy. |

- The domain folders, `index.ts` files, query files and schema files for a phase are created empty (returning an empty list or map) and wired into `core.ts` and `queries.ts` **before** the worktrees split. After that, no worktree edits `core.ts`, `core-deps.ts`, `queries.ts`, `bus.ts`, `types.ts` or another slice's folder. A developer who needs a change there stops and reports it.
- A test checks that every command name in `agent-policy.ts` has at most one handler and that every registered handler has a policy row.

## Code rules [D-003]

Built. Stakeholder's standing rules.

- A source file aims for 200 lines at most. 300 is the hard limit, enforced by ESLint `max-lines` (`max: 300`). Generated files and large static data are exempt. The rule applies to every file, CSS modules and test files included.
- No semicolons in TypeScript or JavaScript.
- The window writes nothing to the console. ESLint `no-console` allows only `console.error`.

## Naming

- Files and directories: kebab-case.
- React components: PascalCase named exports in kebab-case files, one folder each: "Renderer component layout" below.
- Environment variables: UPPER_SNAKE_CASE.
- Database tables and columns: snake_case.
- Commands and queries: `domain.action` in camelCase.
- MCP tools: snake_case.

## README contents

Not built (Phase 11). [REQ: FR-180]: what the app is; download and first-launch steps for unsigned installers; how to run from source; the example brief with its six output pictures; key design decisions (a short form of the ADRs in `spec/overview.md`); assumptions and limitations (Section 1.4 of REQUIREMENTS.md, plus R-06 linked files and R-16 unsigned installers).

## Renderer component layout

Built, as decided by the stakeholder [D-069, D-072, D-073, D-084]: the `@/` alias, one folder per component, and one styling source. Every new component follows these rules, Phase 3 and the UI pass included.

### The `@/` alias

Built.

- One alias, `@/`, means `src/`, for all of `src/` (`main`, `preload`, `renderer`, `shared`, `render-worker`). Examples: `import { PaidConfirm } from '@/renderer/screens/campaign/paid-confirm'`, `import { MAX_IMAGES_PER_RUN } from '@/shared/config/defaults'`.
- `./` only for a file in the same folder (an `index.ts` re-export, a component's own CSS module, its private helpers). `../` is not used in `src/`.
- Tests import code under `src/` through `@/`. Helpers inside `tests/` (`render.tsx`, `fake-api.ts`, fixtures) are imported by relative path.
- The area rules hold: the renderer may not import `@/main/**` or `@/preload/**`; `src/shared/` imports nothing from main, renderer or preload; the Electron edge holds.
- **Where the alias is set.** One owner: `path-alias.config.ts` at the repo root, exporting `srcAlias = { '@': resolve(<root>, 'src') }`.
  - `electron.vite.config.ts`: `resolve: { alias: srcAlias }` in each of `main`, `preload`, `renderer`.
  - `vitest.config.ts`: the alias in both projects, `node` and `renderer` (an inline project does not take the root's `resolve`). The same in `vitest.live.config.ts`, `vitest.comfy.config.ts` and `vitest.build.config.ts`. Playwright takes the alias from the `paths` entry in `tsconfig.json`.
  - `tsconfig.json`: `"paths": { "@/*": ["./src/*"] }`. A test in `tests/unit/config/` reads `tsconfig.json` and checks that its `paths` entry and `srcAlias` name the same folder.
  - ESLint needs no resolver: its import rules match the import text.
- **Lint keeps the guards working.** The boundary patterns (`'**/main/**'`, `'**/windows/**'` and the rest) already match `@/` paths. The `src/main/index.ts` entries (`./index`, `../index`) gain `@/main/index`. A `no-restricted-imports` pattern refusing any import starting with `../` (a `regex` pattern; a glob is unreliable with `../`) sits **inside each existing block** under `src/`, plus one block for files no other block covers: `src/preload/**` and the Electron edge files (`src/main/index.ts`, `windows/**`, `secrets/safe-storage.ts`, `render/**`). Not one block over `src/**`: in flat config a later block's `no-restricted-imports` replaces an earlier one for the same file, which would silently switch off the Electron edge and the renderer's main-process ban. `tests/unit/config/import-alias-lint.test.ts` holds this.
- An import into a subfolder of the same folder (`./sub/x`) stays relative. Config files at the repo root import `./path-alias.config.js` with the `.js` ending.

### One folder per component

Built. Every renderer component sits in its own folder.

- Each component has a kebab-case folder named after it, holding the component (`generate-panel.tsx`), its own CSS module (`generate-panel.module.css`), and `index.ts`. A component with no styles of its own leaves out the module.
- **`index.ts` only re-exports:** `export { GeneratePanel } from './generate-panel'`, plus any props type another file imports. No logic. Exports stay named and PascalCase.
- **Import from the folder.** Other files import the folder (`@/renderer/screens/campaign/generate-panel`), never the inner file (`.../generate-panel/generate-panel`). Only files inside the folder import its inner files.
- **Where folders live.** Under their screen's folder: `screens/campaign/generate-panel/`. Names carry no screen prefix.
  - A dialog lives in `dialogs/`, one folder each (`dialogs/key-dialog/`).
  - The app shell and error banner stay in `app/`. Hand-test parts stay in `dev/`. The Phase 3 editor gets `src/renderer/editor/` (its tree is in `spec/editor.md`, "Where the code lives").
  - A component used by two or more screens lives in `src/renderer/ui/{name}/`. A screen's part that a second screen starts to use moves there in the same change.
- **What needs a folder.** Every `.tsx` file that exports a component another file imports. A small helper component used by one component only, and not imported by any other file, is a second `.tsx` inside that folder, not re-exported, using the parent's module; once a second component imports it, it gets its own folder.
- **What does not get a folder.** Hooks, pure helpers, stores, context providers (`app-context.tsx`). The entry files stay: `src/renderer/main.tsx`, `src/renderer/app/app.tsx`. A hook or helper used by one component goes inside that component's folder, not re-exported. One used by several components of one screen stays a plain file in the screen folder. One used by several screens lives in `ui/`.
- **Shared CSS files: three, all in `src/renderer/ui/`.** `tokens.css`: design tokens (custom properties) only. `base.css`: element defaults and resets, no class names. `layout.module.css`: classes two or more components use (screen, card, field, row, label, path, muted, primary, list, key row). A class used by one component lives in that component's module. No other shared CSS file without a line in this file.
- **Where tests go.** A test goes under `tests/unit/renderer/` at the path of the folder holding the component folder, named after the component (`tests/unit/renderer/screens/campaign/generate-panel.test.tsx`). A component may have several test files (`reference-ticks.test.tsx`).

### One styling source

Built [D-084]. `src/renderer/ui/tokens.css` is the one source of every colour, space, radius, line width, type size, opacity and layout width in the renderer, so one edit there restyles every component.

- **Tokens.** Colours `--color-bg`, `--color-surface`, `--color-border`, `--color-text`, `--color-text-muted`, `--color-accent`, `--color-accent-text`, `--color-danger-bg`, `--color-danger-text`, `--color-focus`, `--color-overlay`; `--opacity-disabled`; `--radius`; `--border-width`, `--focus-ring-width`, `--focus-ring-offset`; spaces `--space-1` to `--space-4` and `--space-6`; fonts `--font-body`, `--font-mono`; type sizes `--font-size-small`, `--font-size-body`, `--font-size-heading`; widths `--width-page`, `--width-column-min`, `--width-dialog`; and the Phase 3 tokens listed in `spec/screens.md`. Text colours keep 4.5:1 contrast; a disabled control is exempt.
- `base.css` gives `pre` and `code` the font `var(--font-mono)`, draws every focus ring from the focus tokens, and draws a disabled button, input or select at `var(--opacity-disabled)`, so a disabled control looks disabled.
- **Test:** `tests/unit/renderer/ui/styling-source.test.ts` reads every `.css` file under `src/renderer/` other than `tokens.css`. It fails on a hex, `rgb` or `hsl` colour, on a `px` length other than 0, on a `var(--x)` that `tokens.css` does not define, and when a required token above (the type sizes, mono font, overlay colour, line widths, layout widths) is missing. A rule that truly needs a literal names it in the test's allow-list with a reason. The one entry: `1px` in `screens/settings/key-row/key-row.module.css`, for the visually hidden label.
- The Scene draws the ad, not the app, and takes no token (`spec/scene.md`).

### Renderer files on main

Each name ending in `/` inside a screen, `app/`, `dialogs/`, `ui/` or `dev/` is a component folder: the component, its CSS module when it has styles of its own, and `index.ts`. Files in brackets sit inside that folder, not re-exported.

```
src/renderer/
├── main.tsx, index.html, env.d.ts, render.html
├── render-worker/  main.tsx, render-root/
├── app/            app.tsx, app-context.tsx, nav-context.tsx, app-shell/, error-banner/,
│                   project-switcher/, campaign-tabs/ [use-tab-keys.ts]
├── screens/
│   ├── start/          start-screen/, new-project-form/, recent-projects/
│   ├── settings/       settings-screen/, location-setting/, provider-defaults/, keys-section/, key-row/,
│   │                   comfy-section/, comfy-check-result/, mcp-section/, connect-panel/,
│   │                   agent-runs-section/, licence-list/
│   ├── project-home/   project-home/ [use-project.ts], brief-load/, campaign-list/,
│   │                   brief-form/ [campaign-fields.tsx, language-field.tsx], subject-rows/,
│   │                   size-fields/, rule-fields/ [word-lists.tsx], import-files/, missing-files/,
│   │                   package-project/, drop-import/ [use-file-drop.ts], campaign-input.ts,
│   │                   brief-form-model.ts, brief-form-problems.ts, brief-form-sizes.ts
│   └── campaign/       campaign-view/, variant-tabs/, variant-grid/, variant-tile/ [badge-words.ts],
│                       slot-view/ [use-slots.ts],
│                       generate-panel/, provider-select/, reference-picker/, paid-confirm/,
│                       video-panel/ [video-length.ts], video-picture-choice/, video-result/, run-list/,
│                       run-row/ [video-status.ts], run-result/, reference-list.ts,
│                       video-start.ts, use-comfy-info.ts, offered-workflow.ts
├── dialogs/        key-dialog/, address-dialog/, licence-dialog/ [licence-choices.tsx],
│                   import-dialog/ [import-choices.tsx, import-text.ts], relink-dialog/ [relink-body.tsx,
│                   missing-row.tsx, use-missing-assets.ts], package-dialog/ [package-body.tsx,
│                   use-package.ts, file-size.ts], picture-chooser/ [picture-grid.tsx, use-pictures.ts],
│                   run-dialog/ [provider-choice.tsx, run-summary.ts]
├── editor/         the Phase 3 editor: one folder per component plus shared helpers
│                   (tree in `spec/editor.md`, "Where the code lives")
├── dev/            hand-test-screen/, s3-settings-form/, storage-actions/, dropbox-sign-in/, result-text.ts
├── stores/         app-store.ts, project-store.ts, job-store.ts, run-asks.ts, nav-store.ts, variant-store.ts
└── ui/             tokens.css, base.css, layout.module.css, asset-url.ts, secret-labels.ts, shortcuts.ts,
                    comfy-privacy.ts, missing-item-text.ts, dropped-paths.ts, dialog-frame/, tab-row/,
                    tab-marks/, variant-thumbnail/ [use-thumbnail.ts], run-failure/ [missing-items.ts,
                    server-message.tsx], paid-count/ [use-paid-count.ts], cancel-shown.ts
```

The Phase 2 campaign screens and dialogs are described in `spec/screens-campaign.md`.

Components with their own CSS module (outside `editor/`): `app-shell`, `error-banner`, `key-dialog`, `address-dialog`, `licence-dialog`, `import-dialog`, `relink-dialog`, `package-dialog`, `start-screen`, `recent-projects`, `project-home`, `brief-form`, `subject-rows`, `size-fields`, `rule-fields`, `missing-files`, `drop-import`, `campaign-view`, `variant-grid`, `variant-tile`, `slot-view`, `provider-select`, `run-failure`, `video-result`, `connect-panel`, `key-row`, `licence-list`, `dialog-frame`, `render-root`, `run-dialog`, `paid-count`.

Why each helper sits where it does (who imports it):

| Helper | Imported by | Place |
|--------|-------------|-------|
| `use-project.ts` | `project-home.tsx` | inside `project-home/` |
| `campaign-input.ts` | `brief-form-model.ts`, `brief-form-problems.ts` (`briefSubjectIds`) | plain file in `screens/project-home/` |
| `brief-form-model.ts`, `brief-form-problems.ts`, `brief-form-sizes.ts` | `brief-load/`, `brief-form/`, `subject-rows/`, `size-fields/`, `rule-fields/` | plain files in `screens/project-home/` |
| `offered-workflow.ts` | the two panels' trial mark | plain file in `screens/campaign/` |
| `cancel-shown.ts` | `run-row.tsx`, `activity-row.tsx` | `ui/` |
| `run-asks.ts` | `app-store.ts` | `stores/` |
| `reference-list.ts` | `reference-picker.tsx`, `video-picture-choice.tsx` | plain file in `screens/campaign/` |
| `video-start.ts` | `video-panel.tsx`, `video-picture-choice.tsx` | plain file in `screens/campaign/` |
| `video-length.ts` | `video-panel.tsx` | inside `video-panel/` |
| `video-status.ts` | `run-row.tsx` | inside `run-row/` |
| `result-text.ts` | three `dev/` components | plain file in `dev/` |
| `asset-url.ts` | four campaign components | `ui/` (shared by several components) |
| `secret-labels.ts` | `key-row.tsx` (settings), `key-dialog.tsx` (dialogs) | `ui/` |
| `use-comfy-info.ts` | `video-length.ts`, the panels' trial mark, the run failure | plain file in `screens/campaign/` |
| `comfy-privacy.ts` | `comfy-section.tsx`, the address dialog | `ui/` |
| `missing-item-text.ts` | `comfy-check-result.tsx`, the run failure | `ui/` |
| `dropped-paths.ts` | the drop target | `ui/` (the one reader of `window.drop`) |

`key-row`, `comfy-check-result`, `connect-panel`, `video-picture-choice`, `video-result` and `run-result` are each imported by one other component, but since another file imports them they get their own folders, as the stakeholder's tree does for `key-row` and `comfy-check-result`.

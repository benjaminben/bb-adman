# Project structure and code rules

Where code and tests live, the module rules, how commands and queries are registered, the code and naming rules, and the layout rule for renderer components. Read with `spec/testing.md` (what each test folder runs) and `spec/overview.md` (the component map).

## Folder tree

The tree shows what is on `main`. One repository; the app is one package and `approvals-service/` is its own. Folders are named with the files that have a fixed role; the other files in a folder are not all listed.

```
project-root/
├── src/
│   ├── main/                      # Electron main process
│   │   ├── index.ts               # start-up; joins core to IPC and windows; the --mcp-bridge switch
│   │   ├── core.ts                # builds every service and the handler list with no Electron import; tests use it as the app does
│   │   ├── core-deps.ts           # the CoreDeps type handed to every domain
│   │   ├── ipc.ts                 # joins window.api to the bus and the query runner; sets actor 'user'
│   │   ├── single-instance.ts     # the single-instance lock
│   │   ├── open-file.ts           # finds a project path in the command line (double-click on Windows)
│   │   ├── open-from-system.ts    # opens a project file the system hands the app (double-click, Dock drop, second launch)
│   │   ├── quit-question.ts       # the message box before quitting while runs are out
│   │   ├── user-data-override.ts  # ADMAN_USER_DATA_DIR, for an unpackaged test run only
│   │   ├── dev-tools-flag.ts      # devToolsEnabled(isPackaged, env)
│   │   ├── png-converter.ts       # pngConverter(decode): the toPng of CoreDeps
│   │   ├── picture-fitter.ts      # the fitPicture of CoreDeps: crop, then scale, PNG out
│   │   ├── pixel-reader.ts        # the readPixels of CoreDeps: a PNG the app drew, as raw pixels
│   │   ├── jpeg-orientation.ts, turn-pixels.ts, image-turner.ts   # turn a JPEG upright by its orientation tag
│   │   ├── windows/               # the Electron edge: app window and its options, menu, app identity, reveal, CSP,
│   │   │                          #   navigation and permission guards, open-external, native pickers (dialogs.ts),
│   │   │                          #   asset-protocol.ts (adman-asset://), the hidden WebP decoder window, quiet.ts
│   │   ├── db/                    # schema/ (index, project, variant, jobs, approvals), migrations/ (drizzle-kit SQL,
│   │   │                          #   newest 0006_approval_clips), bundled-migrations.ts, project-file.ts (open, create,
│   │   │                          #   close, migration runner), meta.ts (project_meta), project-registry.ts (open
│   │   │                          #   projects), rows.ts (stored row to wire row and back), layout-check.ts
│   │   ├── commands/              # bus.ts, types.ts, change-recorder.ts, agent-policy.ts, agent-run-gate.ts,
│   │   │                          #   run-in-project.ts, variant-rev.ts; one folder per domain with an index.ts:
│   │   │                          #   agent, agent-runs, approvals, asset, brief, campaign, check, clip, comfy, dev,
│   │   │                          #   direction, export, generation, history, job, language-font, layer, mcp, project,
│   │   │                          #   publish, rule-set, secret, settings, storage, subject, sync, translation, variant
│   │   ├── queries/               # queries.ts (runner), types.ts, one file per domain: activity, app, approvals, asset,
│   │   │                          #   campaign, check, comfy, comfy-workflow, history, job, mcp, project, publish,
│   │   │                          #   render, report, sync, template, translation, variant; helper files beside them
│   │   │                          #   (campaign-reads.ts, variant-reads.ts, job-get.ts, paid-count.ts and the like)
│   │   ├── history/               # undo-lists.ts, agent-undo-guard.ts
│   │   ├── assets/                # path-resolver.ts, service.ts, types.ts; import, relink, package, sniff, change check,
│   │   │                          #   assets-dir.ts, read-picture.ts, asset-url.ts (adman-asset:// address to file),
│   │   │                          #   brief-pictures.ts and brief-brand.ts (the files a brief names)
│   │   ├── jobs/                  # runner.ts, run-job.ts, start-up.ts (resume), cancel.ts, job-store.ts, progress.ts,
│   │   │                          #   store-result.ts, video-store.ts, types.ts; kinds/ (one file per job kind:
│   │   │                          #   image-generation, video-generation, generative-fill, cutout, layout-proposal,
│   │   │                          #   copy-options, brief-extraction, translation, export, publish)
│   │   ├── providers/             # registry.ts, require-keys.ts (the NEEDS_KEY guard), types.ts and adapters.ts,
│   │   │                          #   messages.ts, redact.ts, read-limited.ts, the picture and video checks
│   │   │                          #   (picture-type.ts, picture-size.ts, png-size.ts, webp-size.ts, picture-limits.ts,
│   │   │                          #   video-check.ts, mp4-boxes.ts), storage-paths.ts; one folder per provider:
│   │   │                          #   gemini/, comfyui/ (with workflows/ and custom/), fal-seedance/, s3/, dropbox/,
│   │   │                          #   local-storage/, fake/; firefly/ (stub) and azure-blob/ (disabled)
│   │   ├── links/                 # the writers behind making variants and sync: fan-out-write.ts, copy-clips.ts,
│   │   │                          #   master-of.ts, snapshot.ts
│   │   ├── checks/                # run-checks.ts, read-input.ts, badges.ts
│   │   ├── translation/           # translation runs, the written text, the translation sheet's path
│   │   ├── clips/                 # the background clips of a video variant: write-clip.ts, clip-asset.ts
│   │   ├── media/                 # FFmpeg behind one door: run-ffmpeg.ts, ffmpeg-path.ts, embedded details
│   │   ├── export/                # run-export.ts, plans.ts, image-ad.ts, stitch.ts, picture-encoder.ts, video/, report/
│   │   ├── publish/               # run-publish.ts, publish-plans.ts, upload.ts, manifest.ts, font-consent.ts, readiness.ts
│   │   ├── approvals/             # the approvals client, stores and helpers (spec/approvals-client.md)
│   │   ├── mcp/                   # server.ts, service.ts, sessions.ts, token.ts, request-guard.ts, agent-caller.ts,
│   │   │                          #   serial.ts, permissions.ts, the ask helpers (ask-kinds.ts, ask-target.ts),
│   │   │                          #   tools/ (index.ts, table.ts, one file per group of tools and its replies)
│   │   ├── bridge/                # bridge mode (--mcp-bridge): run-bridge.ts, relay.ts, launch-command.ts
│   │   ├── secrets/               # secret-store.ts, safe-storage.ts
│   │   ├── settings/              # settings-store.ts, defaults.ts
│   │   ├── log/                   # activity-log.ts, error-context.ts
│   │   ├── render/                # the render window, draw, render-page, done-message (Electron edge)
│   │   └── thumbnails/            # render service, queue, scene input, thumbnail paths and cache, eager (no Electron)
│   ├── preload/                   # index.ts: the window.api and window.drop bridges; render.ts: the render window's renderApi
│   ├── renderer/                  # app window (React). Files: "Renderer files on main" below
│   │   ├── main.tsx, index.html, env.d.ts; render.html, webp.html
│   │   ├── render-worker/         # the render window's page: main.tsx, render-root/
│   │   ├── webp-worker/           # the hidden WebP decoder window's page: main.ts
│   │   ├── app/                   # the shell: app-shell/, top bar parts, Activity, result notice, first-run setup
│   │   ├── stores/                # app, project, nav, variant, job, activity, attached, approvals, playback stores
│   │   ├── screens/               # start/, project-home/, assets/, campaign/, settings/
│   │   ├── dialogs/               # one folder per dialog
│   │   ├── ui/                    # tokens.css, base.css, layout.module.css; the shared parts and helpers
│   │   └── editor/                # the editor's components and helpers (tree in spec/editor.md)
│   └── shared/                    # no Electron or Node imports
│       ├── schemas/               # Zod: api.ts (window.api type, IPC channel names), result.ts, events.ts, settings.ts,
│       │                          #   secrets.ts, brief.ts, layer.ts (JSON columns), project.ts, project-name.ts, links.ts,
│       │                          #   checks.ts, report.ts, render.ts, rows/ (wire rows), commands/{domain}.ts
│       │                          #   (+ project-scoped.ts), queries/{domain}.ts, jobs/ (one file per job kind)
│       ├── brief/                 # parse.ts (parseBrief), markdown.ts, draft.ts, brand.ts, brand-rule-set.ts, size.ts,
│       │                          #   words.ts, languages.ts, picture-refs.ts, yaml-tokens.ts, yaml-walk.ts: pure functions
│       ├── campaign/              # create-defaults.ts
│       ├── templates/             # starter.ts, master-layers.ts (buildMasterLayers), new-layer.ts, layout-rules.ts,
│       │                          #   starter-layout-patches.ts, starting-font-size.ts, brand-colours.ts, brand-fonts.ts
│       ├── scene/                 # the Scene component and helpers, presets.ts (animation), fonts/ (bundled Inter)
│       │                          #   (files in spec/scene.md)
│       ├── links/                 # follow-rules.ts, out-of-date.ts, sync-plan.ts, fan-out-plan.ts, new-variant-plan.ts,
│       │                          #   place-box.ts, fit-text.ts, source-layout.ts, override-paths.ts
│       ├── checks/                # the brand, word and readiness checks, their messages, run-all.ts
│       ├── translation/           # initial.ts, script.ts, sheet.ts, translated-layers.ts, brief-copy.ts
│       ├── generation/            # prompt.ts (the pre-filled picture prompt), the layout answer's clean-up
│       │                          #   (layout-clamp.ts, layout-items.ts, layout-patches.ts), contrast.ts
│       ├── clips/                 # track.ts
│       ├── video/                 # messages.ts
│       ├── export/                # output-paths.ts, frames.ts, safe-title.ts, messages.ts
│       ├── publish/               # manifest.ts, paths.ts, content-types.ts, messages.ts
│       ├── approvals/             # contract.ts (shared with the service), address.ts, marks.ts, messages.ts
│       ├── assets/                # file-path-text.ts
│       ├── paths/                 # safe-part.ts
│       ├── comfy/                 # address.ts, fit-size.ts, refused-hosts.ts, custom-workflow.ts, workflow-words.ts
│       ├── providers/             # messages.ts (plain error sentences, used by window and main process), model-words.ts
│       └── config/                # the fixed values with one owner each: defaults.ts, file-types.ts, job-kinds.ts,
│                                  #   size-limits.ts, brief-limits.ts, campaign-limits.ts, default-layout.ts,
│                                  #   starter-layouts.ts, type-styles.ts, look.ts, region-languages.ts, agent-runs.ts,
│                                  #   agent-ask.ts, public-ids.ts, format-changes.ts, app-name.ts and the like
├── tests/
│   ├── unit/                      # mirrors src/: main/, preload/, renderer/, shared/; plus quickstart/, scripts/,
│   │                              #   config/ (config and lint checks), live/ and e2e-real/ (pure parts of those harnesses)
│   ├── integration/               # real bus, handlers and queries on temporary project files; expect-changes.ts,
│   │                              #   core-fixture.ts, row-fixtures.ts, the registration tests; one folder per area
│   ├── build/                     # checks on the output of electron-vite build (npm run test:build)
│   ├── package/                   # checks on a packaged app's names (npm run test:package)
│   ├── e2e/                       # offline Playwright specs and helpers (npm run test:e2e)
│   ├── approvals-local/           # the app against the approvals service run on this machine (npm run test:approvals-local)
│   ├── e2e-real/                  # Playwright against the real ComfyUI server; never run by npm test or CI
│   ├── comfy/                     # hand-run tests against the real ComfyUI server (npm run test:comfy)
│   ├── live/                      # hand-run tests against paid providers (npm run test:live); never run by npm test or CI
│   ├── shots/                     # screenshot files (*.shots.ts, shot.ts) for npm run shots; never a routine check
│   ├── helpers/                   # shared test helpers (the ComfyUI, Dropbox and approvals stand-ins, failure-of)
│   ├── fixtures/                  # briefs/, providers/ (recorded responses), comfy-custom/, video/, webp/
│   └── reference-pictures/darwin/ # the Scene's reference pictures (spec/testing.md)
├── quickstart/                    # the command-line demo (D-106): cli.ts and its parts, page/ (the drawing page),
│                                  #   examples/ (one folder per example: brief.yaml, its photos, brand/);
│                                  #   output/ is not in git; see spec/quickstart.md
├── approvals-service/             # the approvals service, its own Next.js app (app/, src/, test/, e2e/, migrations/);
│                                  #   layout in spec/approvals-service.md, "Folder and tooling"
├── examples/                      # brief.yaml, a sample brief for the app
├── resources/                     # the app icon; ffmpeg/ is fetched, not committed. The default font is in src/shared/scene/fonts/
├── scripts/                       # ffmpeg/ (fetch, build and licence check) with ffmpeg-sources.json; icon/ (makes the
│                                  #   app icon); demo/ (zips a demo build)
├── comfy-workflows/               # hand-test copies of the ComfyUI graphs and their notes; no code reads them
├── .github/workflows/             # ci.yml
├── README.md, THIRD-PARTY-NOTICES.md
├── REQUIREMENTS.md, requirements/, DECISIONS.md, SPEC.md, spec/
└── config files                   # package.json, tsconfig.json, eslint.config.js, electron.vite.config.ts,
                                   #   electron-builder.json, drizzle.config.ts, path-alias.config.ts;
                                   #   playwright.config.ts, playwright.real.config.ts, playwright.shots.config.ts,
                                   #   playwright.approvals.config.ts; vitest.config.ts, vitest.build.config.ts,
                                   #   vitest.package.config.ts, vitest.comfy.config.ts, vitest.live.config.ts
```

## Module rules

Built. Enforced by ESLint (`eslint.config.js`) where a rule says so.

- `src/shared/` imports nothing from `main`, `renderer`, `preload` or Electron.
- `src/renderer/` reaches the main process only through `window.api`. A screen imports nothing from `src/main/`.
- Only `src/main/assets/path-resolver.ts` builds asset paths. An ESLint rule bans `path.join` with asset fields elsewhere.
- The Scene is a pure component: props are the variant, its layers and clips, a map of asset IDs to their `adman-asset://` address and facts, the time in milliseconds, a mode (`full` or `overlay-only`) and an `onSettled` callback. It uses inline styles only and no app token. Full props: `spec/scene.md`. Built.
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
| Shared services | `src/main/core-deps.ts` | The `CoreDeps` type, every field required (the groups are in `spec/overview.md`, "Shared services"). `core.ts` builds it once and hands the same object to every domain. A domain takes what it needs and builds nothing shared. `tests/integration/registration.test.ts` compares the whole list of fields; a new field extends it. |
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

Built in part [REQ: FR-180]. `README.md` has: the command-line quickstart; what the app is; download and first-launch steps for unsigned installers; keys and what leaves the computer; agent access; how to build from source; the tests; making a release; the licence state (none chosen yet).

Not built (Phase 11, held): the example brief with its six output pictures; key design decisions (a short form of the ADRs in `spec/adrs-and-glossary.md`); assumptions and limitations (Section 1.4 of REQUIREMENTS.md, plus R-06 linked files and R-16 unsigned installers).

## Renderer component layout

Built, as decided by the stakeholder [D-069, D-072, D-073, D-084]: the `@/` alias, one folder per component, and one styling source. Every new component follows these rules.

### The `@/` alias

Built.

- One alias, `@/`, means `src/`, for all of `src/` (`main`, `preload`, `renderer`, `shared`, `render-worker`). Examples: `import { PaidConfirm } from '@/renderer/ui/paid-confirm'`, `import { MAX_IMAGES_PER_RUN } from '@/shared/config/defaults'`.
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
- **Import from the folder.** Other files import the folder (`@/renderer/editor/generate-panel`), never the inner file (`.../generate-panel/generate-panel`). Only files inside the folder import its inner files.
- **Where folders live.** Under their screen's folder: `screens/campaign/check-panel/`. Names carry no screen prefix.
  - A dialog lives in `dialogs/`, one folder each (`dialogs/key-dialog/`).
  - The app shell and its parts stay in `app/`. The editor is `src/renderer/editor/` (its tree is in `spec/editor.md`, "Where the code lives").
  - A component used by two or more screens lives in `src/renderer/ui/{name}/`. A screen's part that a second screen starts to use moves there in the same change.
- **What needs a folder.** Every `.tsx` file that exports a component another file imports. A small helper component used by one component only, and not imported by any other file, is a second `.tsx` inside that folder, not re-exported, using the parent's module; once a second component imports it, it gets its own folder.
- **What does not get a folder.** Hooks, pure helpers, stores, context providers (`app-context.tsx`). The entry files stay: `src/renderer/main.tsx`, `src/renderer/app/app.tsx`. A hook or helper used by one component goes inside that component's folder, not re-exported. One used by several components of one screen stays a plain file in the screen folder. One used by several screens lives in `ui/`.
- **Shared CSS files: three, all in `src/renderer/ui/`.** `tokens.css`: design tokens (custom properties) only, with the role tokens, status colours and `[data-density='compact']`. `base.css`: element defaults and resets, no class names. `layout.module.css`: classes two or more components use (screen, card, field, row, label, path, muted, primary, secondary, quiet, `primary.danger`, iconButton, seg, chip, badge, notice, menu, switch, list, `field.inline`, unitBox, unit). A class used by one component lives in that component's module. No other shared CSS file without a line in this file.
- **Where tests go.** A test goes under `tests/unit/renderer/` at the path of the folder holding the component folder, named after the component (`tests/unit/renderer/screens/campaign/check-panel.test.tsx`). A component may have several test files (`reference-ticks.test.tsx`).

### One styling source

Built [D-084]. `src/renderer/ui/tokens.css` is the one source of every colour, space, radius, line width, type size, opacity and layout width in the renderer, so one edit there restyles every component.

- **Tokens.** Colours `--color-bg`, `--color-surface`, `--color-border`, `--color-text`, `--color-text-muted`, `--color-accent`, `--color-accent-text`, `--color-danger-bg`, `--color-danger-text`, `--color-focus`, `--color-overlay`; `--opacity-disabled`; `--radius`; `--border-width`, `--focus-ring-width`, `--focus-ring-offset`; spaces `--space-1` to `--space-4` and `--space-6`; fonts `--font-body`, `--font-mono`; type sizes `--font-size-small`, `--font-size-body`, `--font-size-heading`; widths `--width-page`, `--width-column-min`, `--width-dialog`; and the editor's tokens listed in `spec/screens.md`. `spec/app-style.md` gives each token's role. Text colours keep 4.5:1 contrast; a disabled control is exempt.
- `base.css` gives `pre` and `code` the font `var(--font-mono)`, draws every focus ring from the focus tokens, and draws a disabled button, input or select at `var(--opacity-disabled)`, so a disabled control looks disabled.
- **Test:** `tests/unit/renderer/ui/styling-source.test.ts` reads every `.css` file under `src/renderer/` other than `tokens.css`. It fails on a hex, `rgb` or `hsl` colour, on a `px` length other than 0, on a `var(--x)` that `tokens.css` does not define, and when a required token above (the type sizes, mono font, overlay colour, line widths, layout widths) is missing. A rule that truly needs a literal names it in the test's allow-list with a reason. The one entry: `1px` in `screens/settings/key-row/key-row.module.css`, for the visually hidden label.
- The Scene draws the ad, not the app, and takes no token (`spec/scene.md`).

### Renderer files on main

Each name ending in `/` inside a screen, `app/`, `dialogs/` or `ui/` is a component folder: the component, its CSS module when it has styles of its own, and `index.ts`. Files in brackets sit inside that folder, not re-exported. Folders only, with the plain helper files that sit beside them; the files inside a folder are not all listed.

```
src/renderer/
├── main.tsx, index.html, env.d.ts, render.html, webp.html
├── render-worker/  main.tsx, render-root/
├── webp-worker/    main.ts
├── app/            app.tsx, app-context.tsx, nav-context.tsx, app-shell/, error-banner/,
│                   project-switcher/ [close-project.tsx, project-rows.tsx], campaign-tabs/
│                   [use-tab-keys.ts], activity-button/, activity-panel/ [activity-scope.tsx],
│                   activity-row/ [row-text.ts, row-marks.tsx, row-retry.tsx], result-notice/,
│                   agent-activity/, permission-dialog/ [file-list/], first-run/ [steps.tsx,
│                   step-strip.tsx]
├── screens/
│   ├── start/          start-screen/, start-images/ (the crossfading pictures), new-project-form/,
│   │                   recent-projects/
│   ├── settings/       settings-screen/ [settings-pages.ts], setup-section/, keys-section/, key-row/,
│   │                   comfy-section/ [on-server.tsx], comfy-check-result/, comfy-workflows-section/,
│   │                   comfy-workflow-row/, mark-help/, licence-list/,
│   │                   provider-defaults/, location-setting/, export-section/, s3-section/,
│   │                   s3-check/, dropbox-section/, approvals-section/, mcp-section/
│   │                   [port-field.tsx], connect-panel/, auto-approve-setting/,
│   │                   agent-runs-section/, notice-line/, saved-mark/
│   ├── project-home/   project-home/ [home-sections.tsx, use-project.ts], brief-load/, brief-paste/,
│   │                   brief-form/ [campaign-fields.tsx, language-field.tsx], brand-fields/, subject-rows/
│   │                   [subject-block.tsx], subject-photos/, size-fields/ [size-chip.tsx],
│   │                   rule-fields/ [word-lists.tsx], campaign-list/, import-files/,
│   │                   missing-files/, package-project/, home-assets/, drop-import/ [use-file-drop.ts],
│   │                   campaign-input.ts, brief-form-model.ts, brief-form-problems.ts,
│   │                   brief-form-sizes.ts, brief-form-photos.ts, brief-form-brand.ts, brand-notes.ts
│   ├── assets/         assets-scope/, assets-button/, assets-panel/, assets-list/, asset-row/ [picture-tile.tsx],
│   │                   subject-card/, attach-photos.ts
│   └── campaign/       campaign-view/, campaign-head/, campaign-overview/ [check-count.ts],
│                       variants-tab/, direction-grids/, direction-header/, variant-grid/,
│                       variant-tile/ [badge-words.ts, tile-strip.tsx, tile-targets.ts],
│                       variant-tabs/, campaign-undo/, check-panel/, rule-set-panel/,
│                       translation-panel/, campaign-export/, report-list/, publish-button/,
│                       approval-bar/, approval-mark/, provider-select/, use-comfy-info.ts,
│                       offered-workflow.ts
├── dialogs/        key-dialog/, address-dialog/, licence-dialog/, run-dialog/ [provider-choice.tsx,
│                   cost-lines.tsx, run-summary.ts], reference-dialog/, copy-options-dialog/,
│                   brief-reading-dialog/, layout-dialog/, picture-chooser/, import-dialog/
│                   [file-strip.tsx, import-choices.tsx, import-text.ts], relink-dialog/,
│                   package-dialog/, subject-dialog/, delete-subject/, delete-variant/, change-workflow/, remove-workflow/,
│                   direction-menu/, fan-out/ [fan-out-costs.ts, fan-out-model.ts], sync-review/,
│                   quick-look/, export-dialog/, report-view/, publish-dialog/, approval-dialog/
├── editor/         the editor: one folder per component plus shared helpers
│                   (tree in `spec/editor.md`, "Where the code lives")
├── stores/         app-store.ts, project-store.ts, nav-store.ts, variant-store.ts, job-store.ts,
│                   activity-store.ts, attached-store.ts, approvals-store.ts, playback-store.ts,
│                   gallery-updates.ts, generate-drafts.ts, placed-runs.ts, run-asks.ts
└── ui/             tokens.css, base.css, layout.module.css; helpers asset-url.ts, secret-labels.ts,
                    shortcuts.ts, comfy-privacy.ts, missing-item-text.ts, dropped-paths.ts,
                    cancel-shown.ts, go-there.ts, show-result.ts, language-name.ts, middle-cut.ts,
                    plural.ts; shared parts (spec/app-style-parts.md) icon/, app-mark/,
                    dialog-frame/, dialog-alert/, section/, panel-head/, sub-page/, side-list/,
                    object-row/, status-mark/, info-tip/, more-menu/, menu-place/, empty-state/,
                    money-line/, slider-field/, swatch-field/, photo-strip/, job-progress/,
                    escape-leave/; and tab-row/, tab-marks/, variant-thumbnail/, run-failure/,
                    run-status/, paid-count/, paid-confirm/, close-warning/, reference-picker/,
                    publish-file-list/, font-share-choice/, signoff-list/, provider-name/, run-name/
```

The project and campaign screens and dialogs are described in `spec/screens-campaign.md` and `spec/screens-variants.md`; the AI screens in `spec/screens-ai.md`.

Why some helpers sit where they do (who imports them):

| Helper | Imported by | Place |
|--------|-------------|-------|
| `use-project.ts` | `project-home.tsx` | inside `project-home/` |
| `campaign-input.ts` | `brief-form-model.ts`, `brief-form-problems.ts` (`briefSubjectIds`) | plain file in `screens/project-home/` |
| `brief-form-model.ts`, `brief-form-problems.ts`, `brief-form-sizes.ts`, `brief-form-photos.ts` | `brief-load/`, `brief-form/`, `subject-rows/`, `subject-photos/`, `size-fields/`, `rule-fields/` | plain files in `screens/project-home/` |
| `offered-workflow.ts` | the run dialog's and fan-out's trial mark | plain file in `screens/campaign/` |
| `use-comfy-info.ts` | the run dialog, the Generate panel, fan-out, the run failure | plain file in `screens/campaign/` |
| `cancel-shown.ts` | `activity-row.tsx` and the other places that offer Cancel | `ui/` |
| `run-asks.ts` | `app-store.ts` | `stores/` |
| `asset-url.ts` | every component that draws an asset | `ui/` |
| `secret-labels.ts` | `key-row.tsx` (settings), `key-dialog.tsx` (dialogs) | `ui/` |
| `comfy-privacy.ts` | `comfy-section.tsx`, the address dialog | `ui/` |
| `missing-item-text.ts` | `comfy-check-result.tsx`, the run failure | `ui/` |
| `dropped-paths.ts` | the drop target | `ui/` (the one reader of `window.drop`) |
| `plural.ts` | every component that draws a count in words | `ui/` |
| `middle-cut.ts` | the Settings projects folder row | `ui/` |

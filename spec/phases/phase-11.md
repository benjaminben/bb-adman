# Phase 11 — README, example set and release

Bullets carry `[logic]` or `[UI]` (D-084). This phase has no screen work.

**Goal:** A repository someone can run, ready to publish. **Nothing is pushed, tagged, released or published by any agent** (D-086): the release workflow is written and checked by reading and by a local dry run only.
**Changed by D-102 (2026-11-22):** the stakeholder asked for the repository to be pushed to GitHub and for releases there, with the licence left for later. Built ahead of the slices below: the history check (P11-1, by the orchestrator; findings in `spec/open-items.md`), a first `release.yml` and its test (P11-3, without the coverage, smoke-test and licence steps), `"publish": null`, and a first `README.md` (P11-4). The push itself and each tag are the stakeholder's own commands. Still to do from this file: P11-2 (waits for the licence), P11-5 to P11-8, and the left-out steps of P11-3.
**Class:** F (the full gate, in P11-8). The other slices: A (scripts and their tests) and the config tests.

## Scope

- [logic] A report on the stakeholder's personal information in the repository and its whole history (D-009), for the stakeholder; no rewrite by an agent.
- [logic] `LICENSE`, `THIRD-PARTY-NOTICES.md`, a licence check on push and in the tag pipeline.
- [logic] The release workflow for unsigned macOS and Windows installers; the dependency audit and the coverage thresholds fail it.
- [logic] README with the first-launch steps for unsigned installers [D-015]; the example set: brief, four made-up drawn source pictures, six exported PNGs.
- [logic] npm install warnings cleaned; one packaged run on macOS; the full verification gate on macOS.

## Exit criteria

1. A locally built installer installs on this Mac, opens the example and exports it with no keys saved (P11-7). A fresh machine and Windows are the stakeholder's checks (D-087).
2. The full verification list of `spec/testing.md` passes on macOS (P11-8). Parts that need a pushed tag or a published release are listed as not run (D-086).
3. The history report is with the stakeholder, re-run on the final `main` (P11-1, P11-8). Nothing in history was rewritten by an agent.
4. `npm run licences` passes; `tests/unit/config/release-workflow.test.ts` passes; `npm run release:check` passes on macOS.

## Rules for these slices

- **No push, tag, release, publish or sign-in.** No `git push`, `git tag`, `gh release`, `gh auth`, `npm publish`, `electron-builder --publish` other than `never`. The workflow's release step is written, never run. No `act` (it needs Docker) and no download of a workflow linter.
- **No history rewrite.** No `git filter-repo`, `filter-branch`, `rebase` of merged history, `commit --amend` of merged commits, `reflog expire`, `gc --prune` or deletion of any branch, tag or backup. Any rewrite waits for the stakeholder's own word, given to the orchestrator.
- **No personal information** in anything a slice writes: no names, email addresses, home-folder paths, machine names or other projects' names. Copyright lines say "The Adman authors" (A-252).
- **Made-up pictures only** in `examples/` and the README: drawn by code, no photo, no real brand, product or person.
- Test first where there is code (the scripts). A script stays under 200 lines.
- Budget: one slice per developer run, well under 300k tokens.

## Order and side-by-side work

| Slice | Needs | May run beside | Must not run beside |
|-------|-------|----------------|---------------------|
| P11-1 History check report | Nothing | Everything (it writes no file in the repository) | Any slice rewriting history (none may) |
| P11-2 Licences and notices | Nothing | P11-1, P11-4, P11-5; slices of other phases | Any slice editing `.github/workflows/ci.yml`; P11-3 (`package.json` scripts) at the same time |
| P11-3 Release workflow | Nothing; Phase 8's `scripts/fetch-ffmpeg` for its FFmpeg step | P11-1, P11-4, P11-5 | P11-2 (`package.json`); Phase 8 slices editing `electron-builder.json` |
| P11-4 README skeleton | Nothing | P11-1, P11-2, P11-3, P11-5 | Nothing |
| P11-5 Example pictures and brief | Nothing | P11-1 to P11-4 | Any slice editing `examples/` (none planned elsewhere) |
| P11-6 npm warnings | Phases 5 to 10 merged | P11-1 | Any slice editing `package.json` or `package-lock.json` |
| P11-7 Example export and packaged run | Phase 8 export; Phases 5 to 10; P11-5; P11-3 | P11-1 | P11-8 |
| P11-8 README finish, full gate, exit | Every other P11 slice; Phases 1 to 10 | Nothing | Everything |

## Can start now

- **P11-1** (and again in P11-8 on the final `main`), **P11-2**, **P11-3** (without the FFmpeg step until Phase 8 ships its script), **P11-4**, **P11-5**.
- **Waits for the end:** P11-6 (dependencies still change), P11-7 (needs export, Phase 8), P11-8 (README screenshots and feature list, the example that shows every feature, the full gate).

## Shared files

- `package.json`: P11-2 (`licences`), P11-3 (`release:check`), P11-6 (versions); nearly every phase adds packages.
- `.github/workflows/ci.yml`: P11-2 (licence step); a Phase 3 or later slice adding the scene reference step.
- `electron-builder.json`: P11-3 (`publish: null`); Phase 8 (FFmpeg as `extraResources`).
- `README.md`: P11-4, P11-8. `examples/`: P11-5, P11-7. `THIRD-PARTY-NOTICES.md`: P11-2, re-made in P11-8.

## Slices

### P11-1 — History check report (D-009)

- **Exists when done:** a report for the stakeholder listing every place the stakeholder's personal information appears in the repository, its history, and the folders not yet tracked.
- **Writes:** one report file **outside the repository**, at the path the orchestrator gives (the session scratchpad). Nothing in the repository changes.
- **How:**
  1. Terms: the developer builds the list from `git config user.name` and `user.email`, the home folder path, the macOS account name and any term the orchestrator passes from the stakeholder. The list stays in the scratchpad (A-251).
  2. Every commit of every ref (`git rev-list --all`, stashes and notes included): `git grep -n -I -i -F -e {term} {commit}` per term; commit messages and author and committer fields (`git log --all --format`); file and folder names in every tree (`git ls-tree -r --name-only`); branch and tag names.
  3. Untracked items that could be added before a push: `client/`, `comfy-workflows/`, `design/`, `.claude/`, `AUDIENCE-SYSTEM-PROMPT.md`, `REQUIREMENTS-Diff-1.4.md`, and anything else `git status --porcelain` lists.
  4. Known items to list whatever the search finds (`spec/open-items.md`, "Before the repository is made public"): the two decision records that name other projects; Q-045 (`client/`), Q-047 (the 12 stock photos in `design/prototype/`); `.claude/rules/`; the backup of the old history in a scratchpad; author fields (accepted under D-018, listed so the stakeholder sees it).
  5. Report lines: commit (short hash), path, line number, kind of item (name, email, path, other project, photo), and the line with the found value replaced by `[term {n}]`. A summary at the top: counts per kind, whether any hit is in a commit reachable from `main`, and the choices for the stakeholder (keep, remove in a new commit, rewrite history) with what each means. The report recommends; it does nothing.
- **Exit check:** the report exists, holds no unmasked term, and every term was searched in every commit (the counts per term are in the report).
- **Class:** none (no code). **Security:** none (reads only; nothing leaves). **Size:** small to medium.

### P11-2 — Licences, notices and the licence check

- **Exists when done:** `LICENSE` (A-252); `npm run licences` fails on any package whose licence is not on the allowed list; `THIRD-PARTY-NOTICES.md` made from the packages the app ships; the push workflow runs the check.
- **New files:** `LICENSE`; `scripts/check-licences.mjs` (reads `package-lock.json` `packages` entries, no new package; A-253); `scripts/licence-allow.json` (allowed SPDX names, and per-`name@version` exceptions each with a reason, empty at first); `scripts/third-party-notices.mjs` (production dependencies only, from each package's own licence file in `node_modules`); `THIRD-PARTY-NOTICES.md`; `tests/unit/config/check-licences.test.ts` (with made-up lock data: allowed passes; GPL, AGPL, LGPL, a missing licence and an `OR` with no allowed side fail and name the package; an `OR` with an allowed side passes; an exception passes only at its version).
- **May touch:** `package.json` (`"licences": "node scripts/check-licences.mjs"`); `.github/workflows/ci.yml` (one step in the lint job, failing the run).
- **Needs:** nothing. A package that fails today is reported with its licence text, not added to the exceptions by the developer; the architect rules.
- **Exit check:** class A; `npm run licences`; the YAML of `ci.yml` parses. **Security:** short (a new CI step). **Size:** small.

### P11-3 — The release workflow

- **Exists when done:** `.github/workflows/release.yml` as `spec/infra-and-settings.md` "CI pipeline" draws it; `npm run release:check` runs its checks on this machine; packaging never publishes.
- **New files:** `.github/workflows/release.yml` (on `push: tags: ['v*']`; `permissions: contents: read` at the top; the push jobs; coverage and `npm audit --audit-level=high` with no `continue-on-error`; `npm run licences`; the end-to-end smoke test with fake providers; the FFmpeg fetch with SHA-256 check once Phase 8's script exists; package jobs on `macos-latest` (DMG arm64 and x64) and `windows-latest` (NSIS x64) with `--publish never`; a last job with `permissions: contents: write` that runs `gh release create "$GITHUB_REF_NAME" --draft` with the installers and `GITHUB_TOKEN`; A-255); `tests/unit/config/release-workflow.test.ts` (parses the YAML with the `yaml` package: the trigger; top-level permissions read-only; only the last job may write; no `continue-on-error` on coverage or audit; every `electron-builder` call has `--publish never`; the release is `--draft`; no secret but `GITHUB_TOKEN`; A-254).
- **May touch:** `package.json` (`"release:check"`: lint, typecheck, `npm test`, coverage, `npm audit --audit-level=high`, `npm run licences`, build, `test:build`); `electron-builder.json` (`"publish": null`).
- **Needs:** nothing; Phase 8's `scripts/fetch-ffmpeg` for that one step. Without it, the step is left out and P11-8 adds it.
- **Local dry run:** `npm run release:check`, then `npm run package -- --mac --publish never`; record what passed. A failing audit or threshold is reported, never loosened.
- **Exit check:** class A + the dry run. **Security:** short (a workflow with a write token, never run). **Size:** small to medium.

### P11-4 — README skeleton

- **Exists when done:** `README.md` with the parts true today: what Adman is (one paragraph); install and first launch of an unsigned installer, only the standard steps (macOS: right-click, Open, or allow in System Settings, Privacy & Security; Windows: "More info", then "Run anyway") [D-015]; building from source (`npm ci`, `npm run dev`, `npm run package`); keys are entered in Settings and stored encrypted, never in a file; the ComfyUI server address in Settings and what is sent to it (the privacy paragraph's words); agent access: turning it on, the Claude Code line, the per-provider tick and the limit, what an agent can and cannot do (from `spec/mcp-and-agents.md`, "Permissions"); running the tests (`npm test`, `npm run test:e2e`); licence.
- **Rules:** no section holds a promise of later work or an empty heading. Features, screenshots and the Claude Desktop block come in P11-8. No server address, key, name or personal path.
- **Needs:** nothing. **Exit check:** `npm run lint` (Prettier) passes on it. **Class:** none. **Size:** small.

### P11-5 — Example pictures and brief

- **Exists when done:** `examples/brief.yaml` with two made-up subjects and two languages; four small source pictures drawn by code; a script that makes them again byte for byte.
- **New files:** `scripts/draw-example-pictures.mjs` (Node only: a small PNG writer with `zlib` and CRC-32, flat shapes and colours, 512 × 512 or smaller, a fixed seed; A-256); `examples/pictures/*.png` (four); `tests/unit/config/example-pictures.test.ts` (running the script into a temporary folder gives files equal to the committed ones; each is a PNG under 100 KB).
- **May touch:** `examples/brief.yaml` (two subjects, "Blue can" and "Green bottle"; languages `en` and `de`; three sizes; no real brand).
- **Needs:** nothing. **Exit check:** class A; `brief.parse` reads the brief (an integration test case). **Size:** small.

### P11-6 — npm install warnings

- **Exists when done:** `npm ci` on a clean checkout prints no warning, or each left is listed with why it stays.
- **May touch:** `package.json`, `package-lock.json`. Updates within the same major version, or `allowScripts` `false` entries (A-259). No `--force`, no `--legacy-peer-deps`. A `true` entry or a major update stops for a ruling.
- **Needs:** Phases 5 to 10 merged. **Exit check:** the full checks on `main`. **Size:** small.

### P11-7 — Example export and one packaged run

- **Exists when done:** `examples/` holds the example project made from the brief and pictures, and the six exported PNGs (three sizes, two languages) [REQ: FR-180]; one packaged macOS app opened it and exported it with no keys.
- **New files:** `scripts/make-example-project.mjs` (drives the built app's commands through `tests/e2e` helpers, fake providers off, no key, no network); `examples/exports/*.png` (six); `tests/e2e/example-export.spec.ts` (export again gives the same six files within the reference-picture tolerance of `spec/testing.md`).
- **Hand step by the agent:** `npm run package -- --mac --publish never`; open the DMG's app with a fresh user data folder; open the example; export; note the result. This also proves `better-sqlite3` loads in the packaged app (`spec/infra-and-settings.md`).
- **Needs:** Phase 8 export; P11-5; P11-3. **Exit check:** class C + G. **Size:** medium.

### P11-8 — README finish, full gate, exit

- **Exists when done:** the README has the feature list, the Claude Desktop block and screenshots of the example (`tests/shots/p11.shots.ts`, shots 300 to 309, saved to `docs/readme/`; A-257); `THIRD-PARTY-NOTICES.md` re-made; the release workflow has its FFmpeg step; the full gate passed on macOS; the P11-1 report re-run on the final `main`.
- **Report to the orchestrator:** what of the class F list passed; what was not run (the tag pipeline, the draft release, Windows, a fresh machine); the stakeholder answers still needed: OI-23 (closing the window on macOS), OI-26 (window size at launch), OI-27 (the four install scripts), the release-blocking real-process proofs (`client-certificate.test.ts`, `client-proxy.test.ts`, `spec/comfyui.md`), the history report's choices, and the items of `spec/open-items.md`, "Before the repository is made public".
- **Needs:** every other P11 slice; Phases 1 to 10. **Class:** F on macOS. **Size:** medium.

## Assumptions

| ID | Assumption | Undo |
|----|------------|------|
| A-250 | The history report is written outside the repository, with each found value masked | Easy |
| A-251 | The search terms come from local git settings, the home path, the account name and the stakeholder; kept in the scratchpad only | Easy |
| A-252 | `LICENSE` is MIT, "Copyright (c) 2026 The Adman authors" | Easy |
| A-253 | The licence check is a script over `package-lock.json`, with an allowed list and per-version exceptions; no new package | Easy |
| A-254 | The workflow is checked by a unit test that parses it, and by `release:check` locally; no `act`, no downloaded linter | Easy |
| A-255 | The draft release is made by `gh release create --draft` in a last job that alone may write | Easy |
| A-256 | Example pictures are drawn by a committed Node script with its own PNG writer | Easy |
| A-257 | README screenshots are shots 300 to 309 of the example, committed under `docs/readme/` | Easy |
| A-258 | The agent's "fresh machine" is the packaged app with a fresh user data folder; a real fresh machine is the stakeholder's | Easy |
| A-259 | npm warnings are fixed only within major versions or by `false` script entries | Easy |

## Open questions

1. **Which licence?** The stakeholder chooses. *Recommendation:* MIT (A-252); the plan proceeds on it.
2. **What to do with the history report's findings** is the stakeholder's alone (D-009). *Recommendation:* decide before the first push; an agent rewrites nothing.

## Found in the existing design

- `spec/infra-and-settings.md` says the tag pipeline "creates a draft GitHub Release"; D-086 forbids running it. The workflow is written with the step and never run.
- `package.json` already says `"license": "SEE LICENSE IN LICENSE"`, but there is no `LICENSE` file yet.
- `spec/testing.md` says `examples/` will hold "four small source images"; under this phase's rule they are drawn by code, not photos.

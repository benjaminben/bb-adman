# SPEC.md — Technical Specification (index)

**Project:** Adman, a desktop app (Electron) for making ad campaigns: one brief becomes a grid of image and video ads in many sizes and languages, with AI generation, checks, export and cloud publishing.
**Status:** Phases 1 to 10, the app style pass (ST-1 to ST-14), the look pack, approvals and subject photos are built on `main`, except the leftovers listed in `spec/phases/`. Round 2 (the stakeholder's first hand-testing feedback) is built too; the choices made for him along the way are listed in `spec/phases/round-2-verify.md`. Phase 11 is held. The stakeholder's hand checks are listed in each phase file and in `spec/open-items.md`, section 5; questions for him are in section 6.

The spec is split into small files so that a reader loads only what a task needs. This file is the map.

## How to read

- Start with `spec/overview.md`. Then read the two or three topic files your task touches. `spec/phases/README.md` names them for each phase.
- `[REQ: FR-001]` points at the requirements files (`REQUIREMENTS.md`, `REQUIREMENTS-Client-Input.md`, `REQUIREMENTS-ComfyUI.md`, `REQUIREMENTS-D053.md`, `REQUIREMENTS-D054.md`; `spec/overview.md` says which numbers are where).
- `[D-012]` points at a stakeholder decision in `DECISIONS.md`.
- `OI-18`, `Q-030` and `A-01` point at an open question in `spec/open-items.md` or an assumption in `spec/assumptions.md`.
- Where the spec and the requirements differ, the spec wins. `spec/overview.md` lists every difference.
- Each main part of a topic file is marked `Built` or `Not built (Phase N)`. For built parts the code and its tests are the record of detail; the spec keeps the contracts, limits, codes, messages and security rules.

## How the spec is kept

- A ruling or a change is edited into the topic file it changes. One statement of each rule, the current one. No dated log of rulings, no version marks, no history.
- A stakeholder decision is added to `DECISIONS.md` with the stakeholder's words, then the topic file is edited.
- An assumption made to keep the build moving is added to `spec/assumptions.md`.
- When work in `spec/phases/` is built and merged, it is removed from the phase file and the topic file's `Not built` mark is changed to `Built`.
- Keep each file under about 40 KB. Split a file that grows past it.

## Topic files

| File | Holds |
|------|-------|
| `spec/overview.md` | Where the spec departs from the requirements, architecture, component map, technology stack |
| `spec/adrs-and-glossary.md` | Architecture decision records ADR-001 to ADR-013, glossary |
| `spec/structure.md` | Folder tree, module and code rules, the renderer layout rule (`@/` alias, one folder per component, one styling source) |
| `spec/data-model.md` | Where data lives, ID formats, the project-level tables (project, subject, asset, job, report, checks) |
| `spec/data-model-campaign.md` | Campaign, sizes, rule set, direction, variant, layer and background clip |
| `spec/data-rules.md` | Links, follow rules and sync, fan-out, data flow, caching, migrations, package project, format change |
| `spec/links-and-sync.md` | Phase 5 in full: follow rules and out-of-date in code, overrides and their undo, sync preview and apply, fan-out, generative fill, directions, adding and deleting variants, the campaign undo list |
| `spec/jobs.md` | The job record in use, job kinds, the runner and its limits, left-over runs, the fake provider |
| `spec/assets.md` | Import, linking, the assets folder, file types, relink, change detection, the asset protocol, reference pictures |
| `spec/api-principles.md` | How commands, queries and events work; error codes, reasons and messages; undo |
| `spec/api-commands.md` | Every command, built or not, with its agent policy |
| `spec/api-dev-commands.md` | The `dev` command group (empty since P9-14) and the `devTools` flag |
| `spec/api-queries-events.md` | Every query and event |
| `spec/mcp-and-agents.md` | The MCP server, token, tools, the ask flow, the permissions matrix, the agent policy table |
| `spec/agent-runs.md` | Generation started by an agent: the tick, the gate, limits, unticking |
| `spec/cancel.md` | Cancel for every provider, closing a project with runs out |
| `spec/brief-and-templates.md` | Brief intake, the brief reader's rules, templates, the default layout |
| `spec/starter-layouts.md` | The five starter layouts, applying one to a variant, the starting font size estimate (look pack, D-094) |
| `spec/ai-jobs.md` | Phase 4 jobs: layout, copy options, brief reading, cut-out; their commands and queries; the failure sentences; the fake provider's parts |
| `spec/providers.md` | The provider registry, interfaces, error kinds and messages, the rules every adapter follows, size limits |
| `spec/providers-adapters.md` | The Gemini adapter, the fal.ai Seedance adapter, the Adobe Firefly stub |
| `spec/comfyui.md` | The ComfyUI adapter: address, client, checks, a picture run, failures |
| `spec/comfyui-workflows.md` | The workflows, which one a run gets, filling a run, sizes, video runs, extend, what is left on the server |
| `spec/comfyui-trials.md` | Trials and `proven`, the real-server tests `test:comfy`, the never-built ComfyUI hand-test plan (OI-64), Krea 2 and custom workflows, what a server needs |
| `spec/storage-and-publish.md` | Storage interface, local, S3, Dropbox, the publish flow |
| `spec/export-and-checks.md` | Embedded generation details, export, reports, the six checks |
| `spec/infra-and-settings.md` | Environments, scripts, CI, release, secrets, environment variables, `settings.json` |
| `spec/security.md` | Scope, threat model, standing rules by subject, accepted risks, named security tests |
| `spec/testing.md` | Logging, verification classes, test commands, coverage, named tests, non-functional targets |
| `spec/test-harnesses.md` | The end-to-end harnesses, real-service runs, the rule on paid calls, what the harness reaches |
| `spec/scene.md` | The Scene component, fonts, overflow measurement, font names at import, the render window, the render service, thumbnails |
| `spec/editor.md` | Campaign and variant tabs, the editor (canvas, layer list, properties), keyboard shortcuts, undo per variant, several picture layers |
| `spec/editor-commands.md` | The layer and variant commands, `variant.get`, `thumbnail.get`, `variant.render`, `thumbnail.changed` in full |
| `spec/screens.md` | What each built screen offers, wording rules, choices made without a design sign-off |
| `spec/screens-campaign.md` | The Phase 2 campaign screens and dialogs (built; S2-17 left): ComfyUI failures, the address and licence dialogs, import and drop, relink, package, the brief form, the slot view, the campaign grid and its tile |
| `spec/screens-variants.md` | Phase 5 screens: the campaign's Undo and Redo, one grid per direction, the tile's delete and quick look, the fan-out dialog, the sync review, the direction dialogs |
| `spec/app-style.md` | The app's look from the design prototype: tokens, type and fonts, contrast, shared pieces, per-screen changes, choices taken for now (C-1 to C-14) |
| `spec/screens-ai.md` | Phase 4 screens: the run dialog, the paid count, the picture section (generate, references, earlier options, cut-out), copy options, place text, brief reading, the activity panel, close warnings |
| `spec/approvals.md`, `spec/approvals-service.md`, `spec/approvals-gallery.md` | Approvals by link (D-095, D-097): the desktop overview, Settings, screens, its security rules, open items and assumptions A-82 to A-109; the service (Next.js on Vercel with a Turso database: how it fits, tooling, environment, deploying); the visitor's pages (Next.js settings, page policy, components, words) |
| `spec/approvals-client.md` | Approvals, desktop: the service client, the local tables, kept passwords, the picture store and signed addresses |
| `spec/approvals-commands.md` | Approvals, desktop: the commands and their refusals, half-done states, the queries and the `approvals.changed` event |
| `spec/approvals-service-data.md` | Approvals service: the shared contract, the database and migrate script, random values and passwords, the keyed API |
| `spec/approvals-service-visitor.md` | Approvals service: visitor routes, sessions, the gallery view, the try limit, forms that write, notices, header sets, pictures |
| `spec/approvals-service-tests.md` | Approvals service: the test files, the AP-14 port of the tests, the Playwright set-up |
| `spec/subject-photos.md` | Subject photos (D-098, R-21): the brief's `pictures` field and its path checks, the "Photos" part of the brief form, the Create order, assumptions A-110 to A-126 |
| `spec/open-items.md` | Open questions, the improvised choices listed for review, what waits on the stakeholder |
| `spec/assumptions.md` | The assumptions made meanwhile (OI, Q and A numbers), with how hard each is to undo |
| `spec/assumptions-settled.md` | Assumption groups whose work is built and settled, moved out of `assumptions.md` (A-40 to A-52) |

## Build plan

| File | Holds |
|------|-------|
| `spec/phases/README.md` | The build order, the topic files each phase needs, the rules for every phase |
| `spec/phases/DEV-RULES.md` | What every developer run reads first: where things are, the rules the same for every slice |
| `spec/phases/phase-02-leftovers.md` | Phase 2 work not built: small fixes, slice WP, ComfyUI follow-ups, the exit check, what waits on a ruling |
| `spec/phases/phase-02-screens.md` | The Phase 2 screen slices (groups 4 and 5; S2-4 to S2-16 built, S2-17 left): ComfyUI failure screens, dialogs, import, relink, package, brief form, slot view, campaign grid |
| `spec/phases/phase-02-agent-generation.md` | Agent generation through the MCP server (built, D-080): the one hand run on the real server still owed, and the change if OI-90 is answered "no ticks" |
| `spec/phases/review-leftovers.md` | Review findings not yet handled, sorted: fix now, fix with a later phase, test gaps |
| `spec/phases/phase-05-slices.md`, `phase-05-screens.md` | Phase 5's slices: logic P5-1 to P5-13; screens P5-14 to P5-18 and the exit slice P5-19 |
| `spec/phases/phase-03.md` to `phase-11.md` | One file per phase: goal, scope, exit criteria, work carried in, what is not designed yet |
| `spec/phases/look-pack.md` | The look pack (D-094): background colour, text boxes, shades, starter layouts; slices LK-1 to LK-7 and their order beside Phase 4 |
| `spec/phases/approvals.md` | Approvals by link (D-095): exit criteria, the rules for its slices, and the order of AP-1 to AP-16 beside Phase 4 and the look pack |
| `spec/phases/approvals-service-slices.md` | Approvals by link: the service slices AP-1, AP-2, AP-3, AP-14, AP-15, AP-4, AP-16 |
| `spec/phases/approvals-desktop-slices.md` | Approvals by link: the desktop slices AP-5 to AP-13 and AP-10b, with the follow-ups ruled after AP-8 |
| `spec/phases/subject-photos.md` | Subject photos (D-098): slices SP-1 to SP-5 and their order |
| `spec/phases/round-2-platform.md`, `round-2-campaign.md`, `round-2-editor.md`, `round-2-approvals.md`, `round-2-approvals-video.md` | Round 2, built: the design and slices for agent tools and briefs, several projects and the name; the campaign page and the Assets panel; the editor's Generate panel; the new gallery; video in the gallery |
| `spec/phases/round-2-verify.md` | Round 2: the choices made without the stakeholder, for him to confirm, and the hand checks only he can do |

# SPEC.md — Technical Specification (index)

**Project:** Adman (shown to people as "AdManager"), a desktop app (Electron) for making ad campaigns: one brief becomes a grid of image and video ads in many sizes and languages, with AI generation, checks, export, cloud publishing and sign-off by link.
**Status:** Phases 1 to 10 are built on `main`, with the work that followed them: the look pack, the app style pass and the design wave, approvals by link (with video in the gallery), subject photos, the changes from the stakeholder's three rounds of hand testing, custom ComfyUI workflows, brand in a brief, "Make variants" and the command-line quickstart. Phase 11 (licence, README extras, release workflow) is held. What is not built is marked "Not built" in its topic file; the larger items are listed in `spec/overview.md`, "Component map". The choices made without the stakeholder, to confirm, are in `spec/phases/round-2-verify.md`, `design-wave-verify.md` and `round-3-verify.md`. The stakeholder's hand checks are in each phase file and in `spec/open-items.md`, section 5; open questions are in section 6.

The spec is split into small files so that a reader loads only what a task needs. This file is the map.

## How to read

- Start with `spec/overview.md`. Then read the two or three topic files your task touches. `spec/phases/README.md` names them for each phase.
- `[REQ: FR-001]` points at the requirements: `REQUIREMENTS.md` is the index, the text is in `requirements/` (`spec/overview.md` says which numbers are where).
- `[D-012]` points at a stakeholder decision in `DECISIONS.md`.
- `OI-18`, `Q-030` and `A-01` point at an open question in `spec/open-items.md` or an assumption in `spec/assumptions.md`.
- Where the spec and the requirements differ, the spec wins. `spec/overview.md` lists every difference.
- Each main part of a topic file is marked `Built` or `Not built (Phase N)`. For built parts the code and its tests are the record of detail; the spec keeps the contracts, limits, codes, messages and security rules.
- To review the whole architecture, read in this order: `spec/overview.md` (the parts and how they fit), `spec/structure.md` (where code lives and the rules it follows), `spec/adrs-and-glossary.md` (why it is built this way), `spec/data-model.md` and `spec/data-model-campaign.md` (what is stored), `spec/api-principles.md` (commands, queries, events, undo), `spec/security.md`, then the topic files feature by feature.

## How the spec is kept

- A ruling or a change is edited into the topic file it changes. One statement of each rule, the current one. No dated log of rulings, no version marks, no history.
- A stakeholder decision is added to `DECISIONS.md` with the stakeholder's words, then the topic file is edited.
- An assumption made to keep the build moving is added to `spec/assumptions.md`.
- When work in `spec/phases/` is built and merged, its phase file is marked built and the topic file's `Not built` mark is changed to `Built`, in the same change.
- A folder or a fixed-role file added under `src/main/`, `src/shared/`, `src/renderer/` or `tests/` is added to the tree in `spec/structure.md` in the same change.
- Keep each file under about 40 KB. Split a file that grows past it.

## Topic files

| File | Holds |
|------|-------|
| `spec/overview.md` | Where the spec departs from the requirements, architecture, component map, technology stack |
| `spec/adrs-and-glossary.md` | Architecture decision records ADR-001 to ADR-013, glossary |
| `spec/structure.md` | Folder tree, module and code rules, how commands and queries are registered, the renderer layout rule (`@/` alias, one folder per component, one styling source) |
| `spec/data-model.md` | Where data lives, ID formats, the project-level tables (project, subject, asset, job, report, checks) |
| `spec/data-model-campaign.md` | Campaign, sizes, rule set, direction, variant, layer and background clip |
| `spec/data-rules.md` | Links, follow rules and sync, fan-out ("Make variants"), data flow, caching, migrations, package project, format change |
| `spec/links-and-sync.md` | Phase 5 in full: follow rules and out-of-date in code, overrides and their undo, sync preview and apply, fan-out, generative fill, directions, adding and deleting variants, the campaign undo list |
| `spec/jobs.md` | The job record in use, job kinds, the runner and its limits, left-over runs, the fake provider |
| `spec/assets.md` | Import, linking, the assets folder, file types, relink, change detection, the asset protocol, reference pictures |
| `spec/api-principles.md` | How commands, queries and events work; error codes, reasons and messages; undo |
| `spec/api-commands.md` | Every command, built or not, with its agent policy |
| `spec/api-dev-commands.md` | The hand-test commands (`dev.*`): the group is empty and both commands are dropped; the `devTools` flag |
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
| `spec/comfyui-trials.md` | Trials and `proven`, the real-server tests `test:comfy`, the dropped hand-test screen (OI-64), Krea 2 (not built), what a server needs |
| `spec/comfyui-custom.md` | Custom ComfyUI workflows (D-104): the marks in a graph, where a workflow is kept, adding one by hand or through an agent, running it, its security rules |
| `spec/storage-and-publish.md` | Storage interface, local, S3, Dropbox, the publish flow |
| `spec/export-and-checks.md` | Embedded generation details, export, reports, the six checks |
| `spec/infra-and-settings.md` | Environments, scripts, CI, release, secrets, environment variables, `settings.json` |
| `spec/security.md` | Scope, threat model, standing rules by subject, accepted risks, named security tests |
| `spec/testing.md` | Logging, verification classes, test commands, coverage, named tests, non-functional targets |
| `spec/test-harnesses.md` | The end-to-end harnesses, real-service runs, the rule on paid calls, what the harness reaches |
| `spec/quickstart.md` | The command-line quickstart (D-106): what it reuses from the app, its steps, options, output folder, and its rules |
| `spec/scene.md` | The Scene component, fonts, overflow measurement, font names at import, the render window, the render service, thumbnails |
| `spec/editor.md` | Campaign and variant tabs, the editor (canvas, layer list, properties), keyboard shortcuts, undo per variant, several picture layers |
| `spec/editor-commands.md` | The layer and variant commands, `variant.get`, `thumbnail.get`, `variant.render`, `thumbnail.changed` in full |
| `spec/screens.md` | What each built screen offers, wording rules, choices made without a design sign-off |
| `spec/screens-campaign.md` | The Phase 2 campaign screens and dialogs (built; S2-17 left): ComfyUI failures, the address and licence dialogs, import and drop, relink, package, the brief form, the slot view, the campaign grid and its tile |
| `spec/screens-variants.md` | Phase 5 screens: the campaign's Undo and Redo, one grid per direction, the tile's menu, delete and quick look, the "Make variants" dialog (code name fan-out), the sync review, the direction dialogs |
| `spec/make-variants.md` | Making variants (D-108, built): the "Make variants" name, where each box goes in a new size, text that fits, what a new variant links to, making variants from any variant, agents, the quickstart, assumptions A-407 to A-420 |
| `spec/app-style.md` | The app's look from the design prototype: tokens, type and fonts, contrast, shared pieces, per-screen changes, choices taken for now (C-1 to C-14) |
| `spec/app-style-parts.md` | The rules for each shared part of the screens: Button, Field, Section, Panel, ObjectRow, Tabs, StatusMark, Notice, InfoTip, Menu, Dialog and its kinds, SubPage |
| `spec/screens-ai.md` | Phase 4 screens: the run dialog, the paid count, the picture section (generate, references, earlier options, cut-out), copy options, place text, brief reading, the activity panel, close warnings |
| `spec/approvals.md`, `spec/approvals-service.md`, `spec/approvals-gallery.md` | Approvals by link (D-095, D-097): the desktop overview, Settings, screens, its security rules, open items and assumptions A-82 to A-109; the service (Next.js on Vercel with a Turso database: how it fits, tooling, environment, deploying); the visitor's pages (Next.js settings, page policy, components, words) |
| `spec/approvals-client.md` | Approvals, desktop: the service client, the local tables, kept passwords, the picture store and signed addresses |
| `spec/approvals-commands.md` | Approvals, desktop: the commands and their refusals, half-done states, the queries and the `approvals.changed` event |
| `spec/approvals-service-data.md` | Approvals service: the shared contract, the database and migrate script, random values and passwords, the keyed API |
| `spec/approvals-service-visitor.md` | Approvals service: visitor routes, sessions, the gallery view, the try limit, forms that write, notices, header sets, pictures |
| `spec/approvals-service-tests.md` | Approvals service: the test files, the AP-14 port of the tests, the Playwright set-up |
| `spec/subject-photos.md` | Subject photos (D-098, R-21): the brief's `pictures` field and its path checks, the "Photos" part of the brief form, the Create order, assumptions A-110 to A-126 |
| `spec/brief-brand.md` | Brand, layout, art direction and ad sets in a brief: the file shape, what the stored brief keeps, `brief.parse`'s `brandFiles`, the form's "Brand and layout" section, `campaign.create`, agents, the shared helpers, assumptions A-395 to A-406 |
| `spec/open-items.md` | Open questions, the improvised choices listed for review, what waits on the stakeholder |
| `spec/assumptions.md` | The assumptions made meanwhile (OI, Q and A numbers), with how hard each is to undo |
| `spec/assumptions-settled.md` | Assumption groups whose work is built and settled, moved out of `assumptions.md` (A-40 to A-52) |

## Build plan

The files in `spec/phases/` are the plans the work was built from, kept as the record of each slice, with what is left of each. For how a built part behaves, the topic file wins.

| File | Holds |
|------|-------|
| `spec/phases/README.md` | The build order, the state of each phase, the topic files each phase needs, the rules for every phase |
| `spec/phases/DEV-RULES.md` | What every developer run reads first: where things are, the rules the same for every slice |
| `spec/phases/phase-02-leftovers.md`, `phase-02-screens.md`, `phase-02-agent-generation.md` | Phase 2: the work not built (small fixes, ComfyUI follow-ups, what waits on a ruling), the screen slices, and agent generation through the MCP server with the one hand run still owed |
| `spec/phases/phase-03.md` to `phase-11.md` | One file per phase: goal, scope, exit criteria, work carried in. Phases 3 to 10 are built; Phase 11 is held |
| `spec/phases/phase-05-slices.md`, `phase-05-screens.md`, `phase-06-slices.md`, `phase-07-slices.md`, `phase-07-slices-2.md`, `phase-08-slices.md`, `phase-08-slices-2.md`, `phase-09-slices.md`, `phase-09-slices-2.md`, `phase-10-slices.md` | The developer-size slices of Phases 5 to 10 |
| `spec/phases/review-leftovers.md` | Review findings not yet handled, sorted: fix now, fix with a later phase, test gaps |
| `spec/phases/look-pack.md` | The look pack (D-094), built: background colour, text boxes, shades, starter layouts; slices LK-1 to LK-7 |
| `spec/phases/app-style.md` | The app style pass (D-084), built: slices ST-1 to ST-14 |
| `spec/phases/approvals.md`, `approvals-service-slices.md`, `approvals-desktop-slices.md` | Approvals by link (D-095), built: exit criteria and order; the service slices; the desktop slices |
| `spec/phases/subject-photos.md`, `subject-delete.md` | Subject photos (D-098), built: slices SP-1 to SP-5; deleting a subject (D-101), built: slice SUBJ-1 |
| `spec/phases/round-2-platform.md`, `round-2-campaign.md`, `round-2-editor.md`, `round-2-approvals.md`, `round-2-approvals-video.md` | Round 2, built: the design and slices for agent tools and briefs, several projects and the name; the campaign page and the Assets panel; the editor's Generate panel; the new gallery; video in the gallery |
| `spec/phases/design-wave.md`, `design-wave-screens-a.md`, `design-wave-screens-b.md` | The design wave, built: the choices taken, the rules for every slice, Wave 1 (tokens and shared parts) and the Wave 2 screen slices |
| `spec/phases/custom-workflows-slices.md` | Custom ComfyUI workflows (D-104), built: slices CW-1 to CW-8 |
| `spec/phases/brief-brand.md` | Brand in a brief, built: slices BB-1 to BB-8 |
| `spec/phases/make-variants.md` | Make variants (D-108), built: slices MV-1 to MV-9 |
| `spec/phases/round-2-verify.md`, `design-wave-verify.md`, `round-3-verify.md` | The choices made without the stakeholder in Round 2, the design wave and Round 3 onward, to confirm; the hand checks only the stakeholder can do |

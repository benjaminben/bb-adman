# SPEC.md — Technical Specification (index)

**Project:** Adman, a desktop app (Electron) for making ad campaigns: one brief becomes a grid of image and video ads in many sizes and languages, with AI generation, checks, export and cloud publishing.
**Status:** Phases 1 and 2 are built on `main`, except the leftovers listed in `spec/phases/`. Phases 3 to 11 are ahead.

The spec is split into small files so that a reader loads only what a task needs. This file is the map.

## How to read

- Start with `spec/overview.md`. Then read the two or three topic files your task touches. `spec/phases/README.md` names them for each phase.
- `[REQ: FR-001]` points at the requirements files (`REQUIREMENTS.md`, `REQUIREMENTS-Client-Input.md`, `REQUIREMENTS-ComfyUI.md`, `REQUIREMENTS-D053.md`, `REQUIREMENTS-D054.md`; `spec/overview.md` says which numbers are where).
- `[D-012]` points at a stakeholder decision in `DECISIONS.md`.
- `OI-18`, `Q-030` and `A-01` point at an open question or an assumption in `spec/open-items.md`.
- Where the spec and the requirements differ, the spec wins. `spec/overview.md` lists every difference.
- Each main part of a topic file is marked `Built` or `Not built (Phase N)`. For built parts the code and its tests are the record of detail; the spec keeps the contracts, limits, codes, messages and security rules.

## How the spec is kept

- A ruling or a change is edited into the topic file it changes. One statement of each rule, the current one. No dated log of rulings, no version marks, no history.
- A stakeholder decision is added to `DECISIONS.md` with the stakeholder's words, then the topic file is edited.
- An assumption made to keep the build moving is added to `spec/open-items.md`.
- When work in `spec/phases/` is built and merged, it is removed from the phase file and the topic file's `Not built` mark is changed to `Built`.
- Keep each file under about 40 KB. Split a file that grows past it.

## Topic files

| File | Holds |
|------|-------|
| `spec/overview.md` | Where the spec departs from the requirements, architecture, component map, technology stack |
| `spec/adrs-and-glossary.md` | Architecture decision records ADR-001 to ADR-013, glossary |
| `spec/structure.md` | Folder tree, module and code rules, the renderer layout rule (`@/` alias, one folder per component) |
| `spec/data-model.md` | Where data lives, ID formats, the project-level tables (project, subject, asset, job, report, checks) |
| `spec/data-model-campaign.md` | Campaign, sizes, rule set, direction, variant, layer and background clip |
| `spec/data-rules.md` | Links, follow rules and sync, fan-out, data flow, caching, migrations, package project, format change |
| `spec/jobs.md` | The job record in use, job kinds, the runner and its limits, left-over runs, the fake provider |
| `spec/assets.md` | Import, linking, the assets folder, file types, relink, change detection, the asset protocol, reference pictures |
| `spec/api-principles.md` | How commands, queries and events work; error codes, reasons and messages; undo |
| `spec/api-commands.md` | Every command, built or not, with its agent policy |
| `spec/api-queries-events.md` | Every query and event |
| `spec/mcp-and-agents.md` | The MCP server, token, tools, the ask flow, the permissions matrix, the agent policy table |
| `spec/agent-runs.md` | Generation started by an agent: the tick, the gate, limits, unticking |
| `spec/cancel.md` | Cancel for every provider, closing a project with runs out |
| `spec/brief-and-templates.md` | Brief intake, the brief reader's rules, templates, the default layout |
| `spec/providers.md` | The provider registry, interfaces, error kinds; Gemini; fal.ai Seedance; Firefly stub |
| `spec/comfyui.md` | The ComfyUI adapter: address, client, checks, a picture run, failures |
| `spec/comfyui-workflows.md` | The workflows, sizes, video runs, extend, trials, the server tests |
| `spec/storage-and-publish.md` | Storage interface, local, S3, Dropbox, the publish flow |
| `spec/export-and-checks.md` | Embedded generation details, export, reports, the six checks |
| `spec/infra-and-settings.md` | Environments, scripts, CI, release, secrets, environment variables, `settings.json` |
| `spec/security.md` | Scope, threat model, standing rules by subject, accepted risks, named security tests |
| `spec/testing.md` | Logging, verification classes, test commands, coverage, named tests, non-functional targets |
| `spec/test-harnesses.md` | The end-to-end harnesses, real-service runs, the rule on paid calls, what the harness reaches |
| `spec/screens.md` | What each built screen offers, wording rules, choices made without a design sign-off |
| `spec/open-items.md` | Open questions, the assumptions made meanwhile, what waits on the stakeholder |

## Build plan

| File | Holds |
|------|-------|
| `spec/phases/README.md` | The build order, the topic files each phase needs, the rules for every phase |
| `spec/phases/phase-02-leftovers.md` | Phase 2 work not built: renderer layout and styling source, small fixes, ComfyUI failure screens, Phase 2 screens |
| `spec/phases/phase-02-agent-generation.md` | Agents generate through the MCP server [D-080] |
| `spec/phases/review-leftovers.md` | Review findings not yet handled, sorted: fix now, fix with a later phase, test gaps |
| `spec/phases/phase-03.md` to `phase-11.md` | One file per phase: goal, scope, exit criteria, work carried in, what is not designed yet |

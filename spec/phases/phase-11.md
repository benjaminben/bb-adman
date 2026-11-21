# Phase 11 — README, example set and release

Bullets carry `[logic]` or `[UI]`; both are built in their phase (D-084). This phase has no screen work.

**Goal:** A repository someone can run, ready to publish. Nothing is pushed, tagged or released (D-086): this phase builds the release workflow and the README, and publishes nothing.
**Class:** F

## Scope

- [logic] README, with the first-launch steps for unsigned installers [D-015]; example brief, source images and six exported PNGs.
- [logic] LICENSE, third-party notices, licence check in CI (push and tags). The dependency audit and the coverage thresholds start to fail the tag pipeline (`spec/infra-and-settings.md`).
- [logic] Release workflow, unsigned installers for macOS and Windows. Written and checked locally; not run on a pushed tag (D-086).
- [logic] Full verification gate (`spec/testing.md`). Agents run it on macOS; the stakeholder runs it on Windows himself (D-087).

## Exit criteria

- A fresh machine installs from a locally built installer, opens the example and exports it with no keys. Agents check macOS; Windows is the stakeholder's check (D-087).
- The full verification list (`spec/testing.md`) passes. Parts that need a published release or a pushed tag are listed as not run (D-086).

## Dependencies

- Phases 1 to 10.

## Carried in from earlier work

- **The tag pipeline.** Today `.github/workflows/` holds only `ci.yml`, run on push and pull request, with no licence check step. Add a tag (release) workflow that runs coverage without `continue-on-error`, fails on `npm audit --audit-level=high`, and runs a licence check against the allowed-licence list. Lint the workflow files locally; nothing is pushed (D-086).
- **A packaged run per system.** `better-sqlite3` ships prebuilt binaries meant to load in both Node and Electron. One packaged app that opens a project is needed per system to prove it. Agents do macOS; the stakeholder does Windows (D-087).
- **npm warnings:** clean up the install warnings.
- **Stakeholder answers needed before release:**
  - OI-23: on macOS, closing the window quits the app (as built), or the app stays in the Dock.
  - OI-26: the window opens maximized on every launch (as built, recommended), or reopens at the last size and place.
  - OI-27: the approved install scripts (`esbuild` in three versions, `electron-winstaller`) stay approved, or a run with all four denied is wanted. Approvals stand until told otherwise.
- **Security findings that block a release:** a failed CU-2b proof (Phase 2 leftovers) must be ruled on before any release.

## Not designed yet

- The README's content beyond the first-launch steps: the old spec names no outline. It should cover keys, the ComfyUI server and the MCP server with the agent tick.

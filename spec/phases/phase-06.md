# Phase 6 — Localization and checks

Bullets carry `[logic]` (main process, shared code, commands, queries, data, providers) or `[UI]` (screens, dialogs, panels and controls in `src/renderer/`). Both are built in this phase (D-084): each slice builds its screens with its logic, as modular components styled only from the shared tokens.

**Goal:** Translations with approval, and brand and legal checks.
**Class:** A, B, D, E

## Scope

- [logic] Gemini `translate`, translation at fan-out and in sync preview.
- [logic] Translation status, set, approve (single and all same-language), brief-supplied copy.
- [logic] Translation sheet export.
- [logic] Per-language fonts through the `style.fontAssetId` override.
- [logic] The six checks (four brand and legal, two readiness), on demand and stored per variant.
- [logic] A prohibited-list entry made only of punctuation or symbols (for example `!`) is matched wherever it appears in a text layer [REQ: FR-240, FR-113].
- [UI] Translation status, edit and approve controls; run-checks action and results.

## Exit criteria

- Workflow 5.2 passes end to end.
- Each check has pass, warn and skipped tests, including a CJK case.

## Dependencies

- Phase 5.
- The Gemini model for `translate` checked (`spec/providers-adapters.md`).

## Carried in from earlier work

- No pending entry or review item belongs to this phase.
- Under D-085, one low-cost paid `translate` call may confirm the Gemini route once.

## Not designed yet

- Whether an agent may start `translate` through MCP, and under which tick. D-080 opens generation to agents; the old spec does not say whether translation counts.
- Q-032 sub-question 5, a style note per direction: waits for the stakeholder; if yes, it is a later migration.

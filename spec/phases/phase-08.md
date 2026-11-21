# Phase 8 — Export and reports

Bullets carry `[logic]` (main process, shared code, commands, queries, data, render and export) or `[UI]` (screens, dialogs, panels and controls in `src/renderer/`). Both are built in this phase (D-084): each slice builds its screens with its logic, as modular components styled only from the shared tokens.

**Goal:** Deliverables and a report on disk.
**Class:** C, B

## Scope

- [logic] Packaging and the notices file. (The FFmpeg fetch script is built at the start of Phase 7.)
- [logic] Report content from the accepted client items. Each is one addition to the `Report` (`spec/export-and-checks.md`), specified when this phase is prepared:
  - a summary at the top, and the list of warnings exported past [REQ: FR-231];
  - asked for against delivered, with a reason for each missing size and language [REQ: FR-232];
  - a small picture of each ad inside the one HTML file [REQ: FR-233];
  - a header with market, audience, campaign ID, time, the exporter's name and the export number, and subjects by ID and name per ad [REQ: FR-234];
  - the campaign's paid generation count [REQ: FR-230];
  - who proceeded past each warning, when and why [REQ: FR-236];
  - the source and approval of each translation [REQ: FR-237];
  - changed or not since the previous export, from each variant's `rev` stored in the report [REQ: FR-238];
  - the last agent change per ad, from `variant.agent_changed_at` [REQ: FR-239].
- [logic] Settings value "Name shown in reports", optional, shown as "name not set" when empty [REQ: FR-235]. `export.run` gains an optional reason for proceeding past warnings [REQ: FR-236].
- [logic] An exported ad keeps the transparency of an imported picture [REQ: FR-245], with a reference-picture test for the exported file.
- [logic] Image export (PNG, JPG), video export (frame pipe, filter builder, system encoders).
- [logic] Output path builder, partial-file rename.
- [logic] Checks before export, `proceedDespiteWarnings` handling.
- [logic] Report JSON, HTML file.
- [UI] The reports name field in Settings; the reason field in the proceed-with-warnings dialog [REQ: FR-235, FR-236].
- [UI] Export dialog with the proceed-with-warnings flow, in-app report view.

## Exit criteria

- The named determinism and frame-count tests pass.
- A whole-campaign export of the example produces the documented folder layout and a report. Agents check this on macOS; the stakeholder checks Windows himself (D-087).

## Dependencies

- Phase 7.
- The FFmpeg build source chosen (OI-09; `spec/infra-and-settings.md`).

## Carried in from earlier work

- **Sound in the export** (OI-54) [REQ: FR-301, FR-302]. The variant's one sound source (the clips' own sound, one added audio file, or none) goes into the exported video. An added file starts at the start and is cut at the variant's end. No mixing, no volume. Data and preview are Phase 7's. Waits for CQ-32.
- **Usage figures in the report.** Slice US (Phase 7) gives the app's count of paid calls with an estimated price. The report's paid generation count (FR-230) uses the same count.

## Not designed yet

- The nine report additions above: each is "to be specified when this phase is prepared". The architect writes the `Report` fields, the HTML layout and the tests for each.
- How the exporter's name and export number are stored and counted.

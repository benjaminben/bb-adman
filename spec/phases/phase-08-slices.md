# Phase 8 — slices P8-1 to P8-12

Contracts, still pictures, the report and the screens. Rules, order and the design these slices build: `spec/phases/phase-08.md` ("Rules for these slices", "Design additions"). Slices P8-13 to P8-19: `spec/phases/phase-08-slices-2.md`.

Every slice also reads `spec/phases/DEV-RULES.md` and the "Design additions" section it names.

### P8-1 — Contracts (built)

- **Exists when done:** every Phase 8 command, query, job kind, port, setting and type registered against stubs; the `reports` setting with its load rule; the `Report` schema; the sentences and reasons.
- **New files:** `src/shared/schemas/commands/export.ts` (`exportRunInput`, the `export_has_warnings` details schema, the `report.add` input); `src/shared/schemas/queries/report.ts`; `src/shared/schemas/report.ts` (`Report`, `ReportCheck`); `src/shared/export/messages.ts` (every sentence and reason in "Design additions"); `src/main/export/types.ts` (`ExportPlan`, `VariantOutcome`, `ExportChecks`, `ExportVideo`, `ExportPictures`, `ExportTarget`, `ExportDeps`); `src/main/export/deps.ts` (`createExportDeps`: the plan map and the ports); `src/main/export/plans.ts` (the in-memory plan map: `set`, `take`, `drop`). Stubs, each replaced by its slice: `src/main/export/checks-port.ts` (P8-13: every variant `[]`, `checksRun: false`), `video-port.ts` (P8-16: throws "Video export is not built yet."), `report-port.ts` (P8-9: writes nothing, returns `null`), `picture-encoder.ts` (P8-4: `createExportPictures(decode, fromBitmap)`, each member throws "not built"); `src/main/commands/export/index.ts` with `run.ts` (P8-5: refuses `RULE_VIOLATION`, reason `export_not_built`, "Export is not built yet.") and `report-add.ts` (P8-9; `internal: true`); `src/main/jobs/kinds/export.ts` (P8-6: ends `failed`, kind `other`, "Export is not built yet."); `src/main/queries/report.ts` (P8-9: `report.list` answers `[]`, `report.get` `NOT_FOUND`; both refuse the agent already).
- **May touch:** `src/main/core.ts` (one spread line `...exportCommands(deps)`, the `export` and `exportPictures` deps lines, the `exportPictures` option); `src/main/core-deps.ts` (fields `export: ExportDeps`, `exportPictures: ExportPictures`); `src/main/index.ts` (passes `createExportPictures((b) => nativeImage.createFromBuffer(b), (d, s) => nativeImage.createFromBitmap(d, s))`); `src/main/commands/agent-policy.ts` (row `'report.add': deny('save reports')`); `src/main/queries/queries.ts` (one spread line); `src/main/jobs/kinds/index.ts` (one line); `src/shared/schemas/settings.ts` (`reports`, and `reports` in `settingsPatchSchema`); `src/main/settings/defaults.ts`; `src/main/settings/settings-store.ts` (`readReportsName`: a bad value loads as `''`); `src/main/thumbnails/types.ts` (`DrawScene` gains optional `view?: { x: number; y: number }`; `RenderService` gains `drawFull(input: SceneInput): Promise<Uint8Array>`); `src/main/thumbnails/service.ts` (a stub `drawFull` that rejects, two lines); any file whose exhaustive table over a changed union stops compiling (one line each, named in the report).
- **Needs:** nothing unbuilt.
- **Read:** `spec/phases/phase-08.md` "Design additions" (all); `spec/approvals-desktop-slices.md` AP-5 (the model); `spec/mcp-and-agents.md` "Agent policy table"; `spec/infra-and-settings.md` "settings.json", "Loading the file".
- **Tests first:** `tests/unit/shared/schemas/export-schemas.test.ts` (table: a good `export.run` input; each refused field, including `variantIds` empty or repeated, `reason` of 501 characters or with a control character, `jpgQuality` 0 and 101, `fps` 45); `tests/unit/shared/schemas/report-schema.test.ts` (a full sample report passes; a body with an unknown field fails); `tests/unit/main/settings/settings-store-reports.test.ts` (no `reports` key loads `''`; a 101-character name loads `''` with other keys kept; a good name survives a save); `tests/integration/export/registration.test.ts` (every stub command and query answers as described; `report.add` from a window is refused as internal; both queries refuse the agent; `export.run` as the agent gets `AGENT_DENIED`). Approved edits: `tests/unit/main/commands/agent-policy-table.test.ts` (the `report.add` row); `tests/integration/registration.test.ts` (command, query and `CoreDeps` names); any settings test that compares the whole default settings object.
- **Exit check:** lint, typecheck, `npm test`, build, `test:build`.
- **Class:** B + A. **Security:** short (policy row, settings writer and load rule, an internal command). **Size:** medium.

### P8-2 — Output folder, paths and safe writes (built)

- **Exists when done:** the output folder check; the output path builder; `exportTarget`; every local storage write is a partial write and a rename; the overwrite rule.
- **New files:** `src/shared/export/safe-title.ts` (`postTitle(title)`); `src/shared/export/output-paths.ts` (`adPath`, `reportNames(stamp, n)`, `reportStamp(date)`); `src/main/commands/export/output-dir.ts` (`checkOutputDir(deps, project, typed): Promise<string>`, the real path); `src/main/export/target.ts` (`exportTarget(root)`).
- **May touch:** `src/main/providers/local-storage/local-storage.ts` (the partial write and rename in `write`; `list` skips `.partial`); its existing tests only to add cases.
- **Needs:** P8-1.
- **Read:** `spec/phases/phase-08.md` "The output folder", "Output layout additions"; `spec/export-and-checks.md` "Output layout"; `spec/storage-and-publish.md` "Local storage", "Path rules"; `spec/security.md` (storage rules).
- **Tests first:** `tests/unit/shared/export/safe-title.test.ts` (table: `Summer sale!` → `Summer sale-`; `  a  ` → `a`; `Été` → `-t-`; 120 characters → 80; `` and `...` → `post` and `---`; `CON`, `con`, `LPT1` → `post-CON`, …; the result always passes `storageFilePath`); `tests/unit/shared/export/output-paths.test.ts` (the layout lines; stamp from a fixed date; `-2` to `-99` names); `tests/integration/export/output-dir.test.ts` (table: relative path, file not folder, missing, `{userData}`, a folder inside `{userData}`, the assets folder, a link to `{userData}` → refused with the right reason and no path in the error; a good folder gives its real path); `tests/integration/storage/local-partial-write.test.ts` (a write leaves no `.partial`; a failed stream write removes its `.partial` and leaves an older file of the name whole; a leftover regular `.partial` is replaced; a `.partial` that is a link is refused and its target is untouched; `list` skips `.partial`; an existing regular file is replaced; a link at the name is refused); `tests/integration/export/target-confinement.test.ts` (named: `{root}/{campaignId}` as a link to a folder outside → refused, nothing written outside; a link inside the post folder → refused; after every case the outside folder's listing is unchanged).
- **Exit check:** class B checks; the existing local storage and approvals picture store tests pass unchanged.
- **Class:** B + A. **Security:** full (a file path from outside; writes on the user's disk). **Size:** medium.

### P8-3 — Render window tiles (built)

- **Exists when done:** the render window draws one tile of a big variant at scale 1 when the request has `view`.
- **New files:** none needed; a helper `src/renderer/render-worker/render-root/frame-style.ts` (pure: the transform for a request) if `render-root.tsx` would pass 200 lines.
- **May touch:** `src/shared/schemas/render.ts` (`view` optional; with `view`, `input.variant.width` and `height` at most `MAX_SIZE_SIDE`); `src/renderer/render-worker/render-root/render-root.tsx` (scale 1 and `translate(-x, -y)` with `view`); `src/main/render/draw.ts` (passes `view` into the request); `tests/e2e/render-helpers.ts` (accept `view`).
- **Needs:** P8-1.
- **Read:** `spec/scene.md` "The render window", "One draw"; `spec/security.md` "Rules: the render window"; `spec/phases/phase-08.md` "Drawing at full size".
- **Tests first:** `tests/unit/shared/schemas/render-view.test.ts` (table: no `view` as before; `view` with negative, fractional, or 8,192 `x` refused); `tests/unit/renderer/render-worker/frame-style.test.ts` (scale and shift with and without `view`); `tests/e2e/render-tiles.spec.ts` (a 3,000 × 1,000 variant with a text layer across the 2,048 line, drawn as two tiles and joined in the test, matches the new reference `export-tiles-seam`; the developer and reviewer look at it and say what it shows).
- **Exit check:** class C and G checks: lint, typecheck, unit tests, `npm run test:e2e -- tests/e2e/scene-reference.spec.ts tests/e2e/render-tiles.spec.ts tests/e2e/render-window.spec.ts`.
- **Class:** C + G. **Security:** short (the render window's message schema). **Size:** small.

### P8-4 — Full-size draw and the picture encoder (built)

- **Exists when done:** `deps.render.drawFull(input)` gives a PNG of the exact pixel size up to 8,192 a side; `deps.exportPictures` makes JPG, stitches and shrinks.
- **New files:** `src/main/thumbnails/tiles.ts` (`tilePlan(width, height, max)`, pure); `src/main/thumbnails/full-draw.ts` (`drawFullWith(queue, draw, pictures)`); `src/main/export/stitch.ts` (pure byte copy of BGRA tiles into one bitmap); the body of `src/main/export/picture-encoder.ts`.
- **May touch:** `src/main/thumbnails/service.ts` (replace the stub `drawFull` with the call into `full-draw.ts`; keep the file under 210 lines).
- **Needs:** P8-1. Works with a fake draw without P8-3.
- **End-to-end case moved:** `tests/e2e/export-picture.spec.ts` belongs to P8-19, which reaches `drawFull` through a real export (no test hook into the main process, "Rules for these slices").
- **Read:** `spec/scene.md` "The render service"; `spec/phases/phase-08.md` "Drawing at full size"; `src/main/png-converter.ts` and `src/main/image-turner.ts` (the injected-Electron model).
- **Tests first:** `tests/unit/main/thumbnails/tiles.test.ts` (table: 1080 × 1080 → one; 2048 × 2048 → one; 2049 × 100 → two; 8192 × 8192 → sixteen; the tiles cover every pixel once); `tests/unit/main/export/stitch.test.ts` (2 × 2 tiles of 3 × 2 pixels with known values give the joined bitmap); `tests/unit/main/export/picture-encoder.test.ts` (with fake `decode` and `fromBitmap`: `toJpeg` passes the quality; `shrink` keeps the ratio, longest side 240, at least 1); `tests/integration/render/draw-full.test.ts` (fake `drawScene`: a 4,000 × 1,000 variant asks for two tiles with the right `view` and sizes; one queue item; no `layer.reportOverflow` sent; no thumbnail file written).
- **Exit check:** class C checks.
- **Class:** C. **Security:** none (no new input; pictures only). **Size:** medium.

### P8-5 — The export command

- **Exists when done:** `export.run` checks its input, the folder, the campaign's other export, the warnings, and enqueues the job with its plan; `job.retry` refuses an export row.
- **New files:** the body of `src/main/commands/export/run.ts`; `src/main/commands/export/warnings.ts` (the gate, from `ExportChecks.run`).
- **May touch:** `src/main/commands/job/retry.ts` (refuse kind `export` with `export_not_retried`, about three lines).
- **Needs:** P8-2 (`checkOutputDir`).
- **Read:** `spec/phases/phase-08.md` "The output folder", "Export run"; `spec/api-principles.md` (refusals); `spec/testing.md` "Refusal tests".
- **Tests first:** `tests/integration/export/export-run.test.ts`: success (job row as in A-207, no path anywhere in the project file, plan in `deps.export.plans`, reply `{ jobId }`); each refusal with code, reason and nothing written: `NOT_FOUND` for a variant of another campaign, `export_running`, `output_dir_refused`, `output_dir_missing`, `export_has_warnings` (with a test `ExportChecks` that warns; `details.warnings` holds the IDs and messages); with `proceedDespiteWarnings` true the plan holds `proceeded` with the reason, and the log line holds `proceeded: true` and not the reason text. `tests/integration/commands/job-retry-export.test.ts` (a failed export row: `export_not_retried`, nothing enqueued).
- **Exit check:** class B checks.
- **Class:** B. **Security:** full (takes a path from the window; decides where files go). **Size:** medium.

### P8-6 — The image export job

- **Exists when done:** an export job writes every chosen image ad in the layout, lists failures, reports progress, stops on cancel and hands its outcomes to the report port.
- **New files:** `src/main/export/run-export.ts` (`runExport(jc, plan, target, opts)`: the loop, order, progress, cancel); `src/main/export/image-ad.ts` (draw, encode, write one ad); `src/main/export/failure.ts` (`ExportFailure` with a sentence); the body of `src/main/jobs/kinds/export.ts`.
- **Needs:** P8-2, P8-4.
- **Read:** `spec/phases/phase-08.md` "Export run", "Drawing at full size"; `spec/jobs.md` (handlers, cancel); `spec/scene.md` "The render service" (`sceneInput`).
- **Tests first:** `tests/integration/export/image-export.test.ts` (fake `drawScene`, a temp folder): two sizes and two languages give the four files at the layout's names, in order; JPG uses `toJpeg` with the plan's quality; an ad with a missing file is a failure with its display name and no file; a deleted ad fails; a draw that throws fails that ad only; a video ad fails with "Video export is not built yet."; progress rises to 1; a job with no plan fails with `export_not_retried`; cancel after the first ad leaves one file, no `.partial`, no report call, status `cancelled`; the job result holds counts only; the report port gets one outcome per ad with the drawn `rev` and a shrunk picture.
- **Exit check:** class B and C checks (the end-to-end part is P8-19's).
- **Class:** C + B. **Security:** short (writes through P8-2's target only). **Size:** medium.

### P8-7 — Report facts and the builder (built)

- **Exists when done:** `buildReport(facts, outcomes)` gives the full `Report` of "Design additions", "Report"; `reportFacts(deps, project, campaignId)` reads everything it needs.
- **New files:** `src/main/export/report/facts.ts` (campaign, subjects, variants, text layers, assets used by layers and clips with their generation fields, previous report body, report count, `paidCount`, the exporter's name); `src/main/export/report/build.ts` (pure); `src/main/export/report/delivered.ts` (pure: FR-232 pairs); `src/main/export/report/changed.ts` (pure: FR-238).
- **Needs:** P8-1.
- **Read:** `spec/phases/phase-08.md` "Report"; `spec/export-and-checks.md` "Report"; `spec/data-model-campaign.md` (campaign, variant, layer, clip); `src/main/queries/paid-count.ts`.
- **Tests first:** `tests/unit/main/export/report/build.test.ts` (table per field: counts for pass, warn, failed; warnings exported past only for exported ads, `seenBeforeExport`; exporter `null` when the name is empty; translations `null` in the main language and one entry per text layer otherwise; `lastAgentChangeAt`; output folder name only, never the full path); `tests/unit/main/export/report/delivered.test.ts` (table: `no_variant`, `not_in_export`, `export_failed`, delivered from a second direction or the other format); `tests/unit/main/export/report/changed.test.ts` (first export `null`; changed; unchanged; not in previous); `tests/integration/export/report-facts.test.ts` (a seeded campaign: export number from two earlier rows is 3; the previous export is the newest row; a generated asset carries provider, model and prompt; an imported one carries none; no ComfyUI address, no asset path in the facts as JSON).
- **Exit check:** class A and B checks.
- **Class:** A + B. **Security:** none. **Size:** medium.

### P8-8 — The report as HTML (built)

- **Exists when done:** `reportHtml(report, pictures)` gives the one self-contained HTML file.
- **New files:** `src/main/export/report/html.ts` (the page and its order); `src/main/export/report/html-parts.ts` (header, summary, warnings, delivered, one ad); `src/main/export/report/html-words.ts` (the fixed words); `src/main/export/report/escape.ts`; `src/main/export/report/report.css.ts` (the inline style text, a constant, the one place it lives).
- **Needs:** P8-1.
- **Read:** `spec/phases/phase-08.md` "Report" (HTML, words); `spec/export-and-checks.md` "Report".
- **Tests first:** `tests/unit/main/export/report/escape.test.ts` (each of `& < > " '`); `tests/unit/main/export/report/html.test.ts` (a sample report: the CSP meta is exactly the text given; no `<script`, no `href`, no `src=` but `data:image/jpeg;base64,`; a title of `<img src=x onerror=alert(1)>` and a prompt with `</style>` show as text; the section order; "name not set", "no reason given", "no agent changes"; a 3,000-character prompt cut with "(cut)"; times in `YYYY-MM-DD HH:mm UTC`; one picture per ad that has one); `tests/e2e/report-html.spec.ts` (the sample page opened in a hidden window with JavaScript turned off and a request listener: no request is made).
- **Exit check:** class A checks plus the one e2e file.
- **Class:** A. **Security:** short (text from agents and providers into a file people open). **Size:** medium.

### P8-9 — Report writing and the report queries

- **Exists when done:** an export writes `report-{stamp}.json` and `.html` in `{campaignId}/` and saves the `report` row; `report.list` and `report.get` answer.
- **New files:** the body of `src/main/export/report-port.ts` (facts, build, HTML, the names rule, write through the target, then `report.add`); the bodies of `src/main/commands/export/report-add.ts` and `src/main/queries/report.ts`.
- **Needs:** P8-2, P8-7, P8-8. With P8-6 merged its test runs through a real job; before, through the port alone.
- **Read:** `spec/phases/phase-08.md` "Report" (saved, queries), "The output folder" (report names).
- **Tests first:** `tests/integration/export/report-write.test.ts` (both files written, the JSON equals the row's body, the HTML holds each exported ad's picture; an existing `report-{stamp}.html` gives `-2` and touches the old file; the 100th clash fails; a failed `report.add` fails the job with its sentence); `tests/integration/queries/report.test.ts` (newest first; `get` of an unknown ID `NOT_FOUND`; a damaged body is logged with no values and left out; both refuse the agent).
- **Exit check:** class B checks.
- **Class:** B. **Security:** short (writes in the output folder; a project-file value read back). **Size:** medium.

### P8-10 — Settings: the Export section (built)

- **Exists when done:** Settings has an "Export" section with "Picture format" (PNG, JPG), "JPG quality" (1 to 100, shown for JPG), "Frames per second" (30, 60) and "Name shown in reports" with the hint "Written into each report as the person who exported. It is not checked. Leave it empty to show "name not set"." Each change is saved through `settings.update`.
- **New files:** `src/renderer/screens/settings/export-section/` (`index.ts`, `export-section.tsx`, `export-section.module.css`); `tests/unit/renderer/screens/settings/export-section.test.tsx`; `tests/shots/p8-10.shots.ts` (shot `250-settings-export`).
- **May touch:** `src/renderer/screens/settings/settings-screen/settings-screen.tsx` (import and mount after `ProviderDefaults`, two lines).
- **Needs:** P8-1.
- **Read:** `spec/screens.md` "Rules for every screen", "Settings"; `spec/phases/phase-08.md` "Settings".
- **Tests first:** the component test: each control has a label and sends the right patch; a 101-character name shows the schema's first issue under the field and sends nothing; the name field is a plain text field (no key styling).
- **Exit check:** class D checks and `npm run test:e2e`.
- **Class:** D. **Security:** none. **Size:** small.

### P8-11 — The export dialog

- **Exists when done:** "Export…" on the campaign page opens the export dialog; the user ticks ads, picks a folder and a format, starts; warnings show with a reason field and "Export anyway"; progress and the end counts show.
- **New files:** `src/renderer/screens/campaign/campaign-export/` (the "Export…" button; P8-12 adds "Reports" here); `src/renderer/dialogs/export-dialog/` (`export-dialog.tsx`, `ad-ticks.tsx`, `export-options.tsx`, `export-warnings.tsx`, `use-export-job.ts`, CSS module); tests `tests/unit/renderer/dialogs/export-dialog.test.tsx`, `export-warnings.test.tsx`; `tests/shots/p8-11.shots.ts` (shots `251-export-dialog`, `252-export-warnings`, `253-export-running`, `254-export-done`).
- **May touch:** `src/renderer/screens/campaign/campaign-view/campaign-view.tsx` (mount `<CampaignExport projectId campaignId />` in the header row, two lines).
- **Needs:** P8-1 (schemas). Works against the stub command in its tests.
- **Read:** `spec/screens.md` "Rules for every screen"; `spec/phases/phase-08.md` "The output folder", "Export run"; `src/renderer/dialogs/package-dialog/` (folder picker model).
- **Words:** title "Export campaign"; "Ads to export" with each row "{title} · {size} · {language} · {format}", all ticked at the start, "Tick all", "Untick all"; "Folder", the chosen path as text or "No folder chosen", "Choose folder…" (`dialog.pickFolder { title: 'Export to' }`); "Picture format" PNG / JPG from `settings.export`, "JPG quality" for JPG, "Frames per second" when a ticked ad is a video; the replace sentence of A-193; "Export" (disabled with no folder, no tick, or while sending). Warnings step: "These ads have warnings", one line per warning "{title} · {size} · {language}: {message}", "Reason for exporting anyway (optional)" (at most 500 characters), "Export anyway", "Back". Then "Exporting… {n}%" from `job.updated` for that job, then "Exported {exported} ads. {failed} failed." and "Close". A refusal other than the warnings shows in the error banner.
- **Tests first:** the dialog test (a cancelled picker sends nothing; the reply `export_has_warnings` shows the step and sends nothing more; "Export anyway" sends the same input with `proceedDespiteWarnings: true` and the trimmed reason; "Back" returns with ticks kept; one send per click; a video tick shows the frames control); keyboard and labels.
- **Exit check:** class D checks and `npm run test:e2e`.
- **Class:** D. **Security:** short (the path from the picker to `export.run`; the screen rule list grows). **Size:** medium.

### P8-12 — Reports list and view (built)

- **Exists when done:** "Reports" beside "Export…" opens a list of the campaign's reports and one report's view, drawn from `report.get`.
- **New files:** `src/renderer/dialogs/report-view/` (`report-view.tsx`, `report-summary.tsx`, `report-ad.tsx`, `report-words.ts`, CSS module); `src/renderer/screens/campaign/report-list/` (the list dialog); tests `tests/unit/renderer/dialogs/report-view.test.tsx`, `tests/unit/renderer/screens/campaign/report-list.test.tsx`; `tests/shots/p8-12.shots.ts` (shots `255-report-list`, `256-report-view`).
- **May touch:** `src/renderer/screens/campaign/campaign-export/campaign-export.tsx` (the "Reports" button, two lines).
- **Needs:** P8-1; P8-11 merged for the mount.
- **Read:** `spec/phases/phase-08.md` "Report" (sections, words, queries).
- **Words:** list rows "Export {n} · {time} · {exported} exported, {failed} failed · {folder}", "Open"; empty "No export yet."; the view's sections in the HTML's order, with "Pictures of each ad are in the report file." and the folder path as text. All values drawn as text.
- **Tests first:** list (newest first; re-read on `project.changed` for the project); view (every section and word from a sample report; a report with `checksRun: false` shows "Checks were not run: not built in this version."; a title holding HTML shows as text).
- **Exit check:** class D checks and `npm run test:e2e`.
- **Class:** D. **Security:** none. **Size:** medium.

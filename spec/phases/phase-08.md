# Phase 8 — Export and reports

**Goal:** The finished ads and a report on disk. The user picks ads and a folder; the app runs the checks, shows any warnings, and writes each ad as PNG, JPG or MP4 in the documented layout, then a report as one HTML file and one JSON file.
**Class:** C, B (and A, D, G by slice).

**Where the slices are.** This file: exit criteria, rules, order, the design the topic files do not yet hold, assumptions A-190 to A-209, open questions. Slices P8-1 to P8-12 (contracts, still pictures, the report, the screens): `spec/phases/phase-08-slices.md`. Slices P8-13 to P8-19 (late plug-ins, video, packaging, the end-to-end proof): `spec/phases/phase-08-slices-2.md`.

**Design:** `spec/export-and-checks.md` ("Export", "Report"), `spec/scene.md` ("One draw", "The render service"), `spec/storage-and-publish.md` ("Local storage", "Path rules"), `spec/infra-and-settings.md` ("FFmpeg", "settings.json"), `spec/jobs.md`, `spec/screens.md`, `spec/testing.md`; and "Design additions" below, which wins where the topic files are silent.

## Exit criteria

- The named tests pass: same frame twice gives the same picture; a video export has exactly `ceil(durationMs / 1000 × fps)` frames; an exported PNG has no `generation` chunk; import, manual layout and image export work with no secret saved and the network off [REQ: FR-131, FR-068, 8.2].
- The FR-245 export case passes: the `transparent-hole` scene exported as PNG matches its reference picture.
- A whole-campaign export of `examples/brief.yaml` gives the folder layout of "Output layout", one `report-{stamp}.html` and one `report-{stamp}.json`, and a `report` row; a second export marks each ad changed or not changed. Agents check this on macOS; the stakeholder checks Windows (D-087).
- The app's checks pass: lint, typecheck, `npm test`, build, `test:build`, `npm run test:e2e`.
- Shots 250 to 258 made and named in the slice reports.
- No agent pushed, published, signed in anywhere, or made a paid call (Phase 8 adds no paid feature, so no paid run is planned).

## Dependencies

- **Still-picture export, the folder layout, the report and the screens need only Phases 1 to 4** plus P8-1. The render service, the render window, local storage, the folder picker, `campaign.paidCount`, the `report` and `variant_check` tables are built.
- **Check results in the report** wait for Phase 6's check engine (P8-13). Until then the report says the checks were not run.
- **Video export** is built: the FFmpeg binary and its locator (P8-16), and the Scene's time, presets, clips and sound (P8-17).
- **Packaging** waits for Phase 7's fetch script and OI-09 (P8-18).
- **Phase 9** (publish) runs a fresh export through this phase's writer (`ExportTarget`, below).

## Rules for these slices

- Every slice: failing tests first, then the code; run what its class asks. A slice that touches the renderer or the render window also runs `npm run test:e2e`. Prefer one table test over many near-identical cases.
- **A slice edits only the files it owns and the existing files it may touch.** A change needed elsewhere: stop and report.
- **Shared files.** Only P8-1 edits `core.ts`, `core-deps.ts`, `index.ts`, `agent-policy.ts`, `queries/queries.ts`, `jobs/kinds/index.ts`, `settings.ts`, `defaults.ts`, `settings-store.ts` and `thumbnails/types.ts`. P8-1 registers every Phase 8 command, query, job kind and port against a stub; the slice that owns a stub replaces its body and touches no index. Two named exceptions: P8-4 replaces the `drawFull` stub in `service.ts`, and P8-16 may add one start-up line to `index.ts` for the work-folder clean-up.
- **No migration.** Phase 8 needs no new table or column (`report`, `variant_check`, `variant.agent_changed_at`, `layer.translation_source` are built). Number `0008` stays unused. A slice that finds it needs one stops and reports.
- **The output folder is a security point** (rules in "Design additions", "The output folder"). Every slice that writes there writes only through `exportTarget(root)` (P8-2). No other code in Phase 8 calls `fs` on a path under the output folder.
- **FFmpeg is a security point.** Its arguments are an array (no shell), every input is `file:` plus a checked absolute path with `-protocol_whitelist file,pipe`, and no text from a project goes into a filter graph (P8-15, P8-16).
- **Nothing in a report** holds a secret, the ComfyUI address, a key, a signed address, an asset's path, or the output folder's full path (A-196).
- **Screens** (D-084): one folder per component, CSS from `src/renderer/ui/tokens.css` only, no new token. A mount point in an existing component is a few lines, named in the slice. Each screen slice adds `tests/shots/p8-{n}.shots.ts`; picture names start with the slice's numbers from 250 to 269.
- **No test hook into the main process.** End-to-end tests reach the app only as a user would, through `window.api` and the screens. No slice adds a test hook or a new way into the main process for an end-to-end test. A case that needs `drawFull` or the frame pipe is proven through a real export (P8-19).
- **Security class.** "Full" slices merge after a full security review, "short" after a short one.
- **Paid calls.** None. Every provider in every test is the fake one; no slice needs a key.
- **Nothing leaves this machine** (D-086). No push, tag, release, deploy or sign-in.
- Budget: one slice per developer run, well under 300k tokens; hand off with `HANDOFF.md` if near it.

## Order and side-by-side work

| Wave | Slice | Needs | May run beside | Must not run beside |
|------|-------|-------|----------------|---------------------|
| 1 | P8-1 Contracts (built) | Phases 1 to 4 (built) | Any Phase 8 slice that has not started; Phase 5 to 7 slices that edit none of its files | Any other phase's contracts slice (`core.ts`, `core-deps.ts`, `index.ts`, `agent-policy.ts`, `queries.ts`, `jobs/kinds/index.ts`, `settings.ts`, `settings-store.ts`); Phase 7 slice US if it adds a settings key |
| 2 | P8-2 Output folder, paths, safe writes (built) | P8-1 | Every wave 2 slice | Any Phase 9 slice editing `src/main/providers/local-storage/` (slice G does not) |
| 2 | P8-3 Render window tiles (built) | P8-1 | Every wave 2 slice but none that edits the render window | Phase 7 slices editing `render-root.tsx`, `src/shared/schemas/render.ts` or `draw.ts` |
| 2 | P8-4 Full-size draw, picture encoder (built) | P8-1 | Every wave 2 slice | Any slice editing `src/main/thumbnails/service.ts` (Phase 7 may, for time) |
| 2 | P8-7 Report facts and builder (built) | P8-1 | Every wave 2 slice | Nothing |
| 2 | P8-8 Report HTML (built) | P8-1 | Every wave 2 slice | Nothing |
| 2 | P8-10 Settings: Export section (built) | P8-1 | Every wave 2 slice | Any slice editing `settings-screen.tsx` (Phase 9 storage screen, Phase 7 slice US price list) |
| 2 | P8-11 Export dialog | P8-1 | Every wave 2 slice | Any slice editing `campaign-view.tsx` (AP-11, Phase 5, Phase 7 timeline): the mount line only, so merge order matters, not run order |
| 2 | P8-12 Reports list and view | P8-1; P8-11 merged for its 2-line mount | Every wave 2 slice | P8-11 while it edits `campaign-export/` |
| 2 | P8-14 Video frames (built) | P8-1 | Every wave 2 slice | Nothing |
| 2 | P8-15 FFmpeg arguments (built) | P8-1 | Every wave 2 slice | Nothing |
| 3 | P8-5 Export command | P8-2 | P8-6, P8-9 | Phase 7 slice J (`src/main/commands/job/retry.ts`) |
| 3 | P8-6 Image export job | P8-2, P8-4 | P8-5, P8-9 | Nothing |
| 3 | P8-9 Report writing and queries | P8-2, P8-7, P8-8 | P8-5, P8-6 | Nothing |
| 4 | P8-13 Checks and usage in the report | P8-9; Phase 6 check engine merged (and slice US for its part) | Any | Phase 6 slices editing the check engine |
| 4 | P8-16 Video export in the job | P8-6, P8-14, P8-15; Phase 7 FFmpeg locator and clip commands merged | P8-13 | Nothing |
| 5 | P8-17 Video after Phase 7 | P8-16; Phase 7 Scene time, presets and sound data merged | P8-13, P8-18 | Any slice editing `src/shared/scene/` |
| 5 | P8-18 Packaging FFmpeg, notices | Phase 7 fetch script; OI-09 answered | Any | Any slice editing `electron-builder.json` or `THIRD-PARTY-NOTICES.md` (Phase 11) |
| 6 | P8-19 End-to-end proof, shots, exit check | Every other P8 slice | Nothing | Nothing |

## Can start now

Need only Phases 1 to 4 (and P8-1, which itself needs nothing unbuilt): **P8-1**, then **P8-2, P8-3, P8-4, P8-7, P8-8, P8-10, P8-11, P8-12, P8-14, P8-15**, then **P8-5, P8-6, P8-9**. With those merged, still-picture export with a report works end to end; the report says the checks were not run and a video ad fails as not built.

## Shared files

Existing files that more than one P8 slice, or another phase, is likely to edit:

| File | P8 slices | Other phases |
|------|-----------|--------------|
| `src/main/core.ts`, `src/main/core-deps.ts`, `src/main/index.ts` | P8-1 | Every phase's contracts slice; Phase 7 (FFmpeg locator) |
| `src/main/commands/agent-policy.ts`, `src/main/queries/queries.ts` | P8-1 | Phases 5, 6, 7, 9, 10 contracts |
| `src/main/jobs/kinds/index.ts` | P8-1 | Phase 6 (translation kind), Phase 9 (publish kind) |
| `src/shared/schemas/settings.ts`, `src/main/settings/defaults.ts`, `settings-store.ts` | P8-1 | Phase 7 slice US (price list), Phase 9 |
| `src/main/thumbnails/types.ts`, `service.ts` | P8-1, P8-4 | Phase 7 (time in thumbnails), Phase 10 (`render_variant`) |
| `src/shared/schemas/render.ts`, `src/main/render/draw.ts`, `src/renderer/render-worker/render-root/render-root.tsx` | P8-3 | Phase 7 (time, video in the Scene) |
| `src/main/providers/local-storage/local-storage.ts` | P8-2 | Phase 9 (publish reads through it) |
| `src/main/commands/job/retry.ts` | P8-5 | Phase 7 slice J (`checkVideoRetry`) |
| `src/shared/scene/` | P8-17 | Phase 7 (time, presets, clips) |
| `src/renderer/screens/campaign/campaign-view/campaign-view.tsx` | P8-11 (one mount line) | AP-11, Phase 5, Phase 7 |
| `src/renderer/screens/settings/settings-screen/settings-screen.tsx` | P8-10 (one mount line) | Phase 7 slice US, Phase 9 |
| `electron-builder.json`, `package.json`, `THIRD-PARTY-NOTICES.md` | P8-18 | Phase 7 (fetch script), Phase 11 |
| `tests/integration/registration.test.ts`, `tests/unit/main/commands/agent-policy-table.test.ts` | P8-1 (approved edits) | Every contracts slice |

## Interfaces with other phases

Named so the late slices plug in without reopening the early ones. Types live in `src/main/export/types.ts` (P8-1).

- **`ExportChecks`** (Phase 6 fills it in P8-13): `run(project: ProjectHandle, variantIds: string[]): Promise<Map<string, ReportCheck[]>>` and `store(project, results, ranBy: 'export'): void`. `ReportCheck` is the shape of `CheckResult` in `spec/export-and-checks.md`. The P8-1 stub answers an empty list for every variant and marks the report `checksRun: false`. P8-13 adds a type test that `CheckResult` and `ReportCheck` are assignable both ways.
- **`ExportVideo`** (P8-16 fills it): `exportVariant(jc, scene, plan, target, path): Promise<{ still: Uint8Array | null }>`; throws `ExportFailure` with a sentence. The P8-1 stub throws "Video export is not built yet."
- **`FfmpegLocator`** (from Phase 7): `ffmpegPath(): string | null`. Recommended home `src/main/video/ffmpeg-path.ts`; P8-16 imports whatever Phase 7 names and reports the name.
- **`ExportTarget`** (P8-2, used by Phase 9): `exportTarget(root: string)` gives `{ write(path, data), exists(path) }` over `localStorageAt(root)`. `runExport` (P8-6) takes a target and an `adsPrefix` (`{campaignId}` for export, `{campaignId}/exports` for publish) and a `record` choice; Phase 9 decides whether its fresh export adds a `report` row (open question 4).
- **Usage** (Phase 7 slice US): if US gives a per-campaign estimate function, P8-13 adds one optional `usage` field to `Report`.

## Design additions

The orchestrator folds these into `spec/export-and-checks.md`, `spec/scene.md`, `spec/storage-and-publish.md`, `spec/infra-and-settings.md`, `spec/api-commands.md`, `spec/api-queries-events.md` and `spec/screens.md` later.

### The output folder (security)

- `outputDir` comes only from `dialog.pickFolder` in the export dialog. `export.run` is `deny` for an agent (built row); `screens.md`'s list of commands a path may be sent to gains `export.run`.
- **Checked in `prepare`** (`src/main/commands/export/output-dir.ts`, P8-2): an absolute path, at most 4,096 characters, no NUL; `realpath` must succeed and name a directory; the real path must not be `{userData}` or inside it, nor inside the open project's assets folder. Refused: `RULE_VIOLATION`, reason `output_dir_refused`, "Choose another folder: this one cannot be used for an export." Gone: reason `output_dir_missing`, "The chosen folder is not there any more. Choose it again." No path in any error or log line.
- The **real path** is the root from then on; the typed path is not used again.
- **The path is never stored in the job row** [A-195]. `export.run` puts the plan (root, variant IDs, options) in an in-memory map keyed by job ID (`deps.export.plans`). The handler takes it from there. A job with no plan (a retried row, a row from a crafted file) fails with "Run the export again from the Export dialog.", reason `export_not_retried`. `job.retry` refuses kind `export` with the same reason and sentence before enqueueing. Queued rows left in a file are already cancelled on open (`start-up.ts`).
- **Every write goes under `{root}/{campaignId}/`** through `exportTarget(root)` over `localStorageAt`, which refuses a link at the file, a link whose target is missing, and any folder whose real path is outside the real root.
- **Safe writes** [A-194]. `localStorageAt(root).write` writes to `{name}.partial` (flag `wx`, after removing a leftover `.partial` that is a regular file; a leftover that is a link is refused) and renames it to `{name}`. A failed write removes its `.partial`. `list` skips names ending `.partial`. This is the "partial-file rename" of the outline, and it holds for every local write.
- **Overwrite rule** [A-193]. An ad file is written at exactly the name the layout gives and replaces a regular file of that name. Nothing else under the root is changed or deleted: ads of earlier exports not in this one stay. A report file never replaces one: if `report-{stamp}.html` or `.json` exists, both get `-2`, `-3`, … up to `-99`, then the report fails. The dialog says: "Files from an earlier export of the same ads are replaced. Nothing else in the folder is changed."

### Output layout additions

- `postTitle` [A-192]: as in the topic file (each character outside `A–Z a–z 0–9 + - _ space` becomes `-`), then spaces trimmed at both ends, cut to 80 characters and trimmed again. Empty: `post`. A Windows reserved device name (any case): `post-{name}`.
- Report stamp: the export's local time, `YYYYMMDD-HHmmss`.
- Order: ads are written sorted by `postTitle`, `sizeLabel`, `language`, `variantId`, so two runs write in the same order.

### Drawing at full size [A-190, A-191]

- The render window keeps its 2,048 limit per draw. A variant with a side over 2,048 is drawn in tiles of at most 2,048 × 2,048, left to right, top to bottom, and stitched in the main process.
- `RenderRequest` gains optional `view: { x, y }` (whole numbers, 0 to `MAX_SIZE_SIDE - 1`). With `view`, the page draws the Scene at scale 1 shifted by `(-x, -y)`, and `width`, `height` are the tile's size. Without it, nothing changes.
- `RenderService.drawFull(input: SceneInput): Promise<Uint8Array>` gives a PNG of exactly the variant's pixel size. One queue item for the whole picture, at `render` priority. It sends no `layer.reportOverflow` and keeps no file: an export draw changes nothing in the project.
- `CoreDeps.exportPictures` (filled in `index.ts` from `nativeImage`): `toJpeg(png, quality)`, `stitch(parts, size)` (PNG out), `shrink(png, maxSide)` (JPEG quality 80 out). The byte copy of `stitch` is pure (`src/main/export/stitch.ts`).
- The ad drawn is the variant's `rev` read when its draw starts; the report stores that `rev`.

### Export run

- `export.run` input: `projectId`, `campaignId`, `variantIds` (1 or more, no repeats, each a variant of the campaign, else `NOT_FOUND` "That ad is not in this campaign."), `outputDir`, `imageFormat`, `jpgQuality`, `fps`, `proceedDespiteWarnings`, `reason?` (trimmed, at most 500 characters, no control characters). Reply `{ jobId }`.
- **One export per campaign at a time** [A-197]: a queued or running `export` job for the campaign refuses `RULE_VIOLATION`, reason `export_running`, "This campaign is already being exported. Wait for it to finish."
- **Warnings gate.** `prepare` runs `ExportChecks.run`. If any result is `warn` and `proceedDespiteWarnings` is false: `RULE_VIOLATION`, reason `export_has_warnings`, "Some ads have warnings. Fix them or export anyway.", `details.warnings: Array<{ variantId, checkId, message }>`. With `proceedDespiteWarnings` true the plan holds `proceeded: { at, reason }`; the log line holds `proceeded: true` and never the reason.
- **Job row** [A-207]: kind `export`, `campaignId` set, `variantId` null, provider `adman`, model `''`, request `{ variantIds, imageFormat, jpgQuality, fps, proceedDespiteWarnings }`, no path, no reason text.
- **The job.** Runs `ExportChecks.run` again and `store` with `ranBy: 'export'`; these are the results the report holds. A warning the gate did not see is reported with "This warning appeared after the export was started." [A-204]. Then each ad in order: deleted since → "This ad was deleted before it was exported."; a file missing (`missing` in the scene input) → "A file this ad uses is missing: {display names}." (joined with ", ", cut to 200 characters); image → `drawFull`, then PNG as drawn or `toJpeg`; video → `ExportVideo`. A failed draw → "The ad could not be drawn."; a failed write → "The file could not be written." Progress is done ads over all ads. Then the report.
- **Cancel** [A-200]: checked between ads and between frames. The ad in progress loses its `.partial`; finished files stay; no report is written; the job ends `cancelled`.
- Job result: `{ exported, failed, reportId }`; no path, no names.
- One `info` log line at the end: `name: 'export.done'`, project and campaign IDs, the counts.

### Report

Replaces the `Report` type in `spec/export-and-checks.md`. Schema `src/shared/schemas/report.ts` (P8-1). Every new field is the item named.

```ts
type Report = {
  reportVersion: 1
  campaignId: string; campaignName: string; createdAt: string; appVersion: string
  outputFolderName: string                 // A-196: base name only; the row keeps the full path
  exportNumber: number                     // FR-234: 1 + this campaign's earlier report rows
  exporter: { name: string | null }        // FR-235: null shows "name not set"
  market: string; audience: string; primaryLanguage: string      // FR-234: region, audience
  paidGenerations: { pictures: number; videos: number; text: number }  // FR-230, campaign.paidCount at export time
  checksRun: boolean                       // false only before P8-13
  proceeded: { by: string | null; at: string; reason: string | null } | null   // FR-236
  summary: { exported: number; passedAll: number; withWarnings: number; failed: number }  // FR-231
  warningsExportedPast: Array<{ variantId: string; checkId: string; message: string
                                seenBeforeExport: boolean }>                      // FR-231, FR-236, A-204
  missing: Array<{ sizeLabel: string; language: string
                   reason: 'no_variant' | 'not_in_export' | 'export_failed' }>      // FR-232
  previousExport: { exportNumber: number; createdAt: string } | null               // FR-238
  variants: Array<{
    variantId: string; title: string; sizeLabel: string; language: string; format: 'image' | 'video'
    rev: number                                                   // FR-238
    changedSincePrevious: 'changed' | 'unchanged' | 'not_in_previous' | null   // null on a first export
    subjects: Array<{ subjectId: string; displayName: string }>   // FR-234
    lastAgentChangeAt: string | null                              // FR-239
    translations: Array<{ layerKey: string; source: 'ai' | 'agent' | 'user' | 'brief' | null
                          status: 'missing' | 'proposed' | 'approved' | null }> | null  // FR-237; null in the main language
    file: string | null                                           // relative to the output folder
    assets: Array<{ assetId: string; displayName: string; role: 'background' | 'image' | 'font' | 'clip'
                    origin: 'generated' | 'imported'; provider?: string; model?: string; prompt?: string }>
    checks: ReportCheck[]
    failure: string | null
  }>
}
```

- **Counts** (FR-231): `exported` has a file; `passedAll` has a file and no `warn`; `withWarnings` has a file and a `warn`; `failed` has no file.
- **Asked for against delivered** (FR-232) [A-205]: each pair of `campaign.sizes` label and `campaign.languages` tag. Delivered when any ad of that size and language (any direction, any format) has a file. Else `no_variant` when the campaign has no such variant, `not_in_export` when none was chosen, `export_failed` when every chosen one failed.
- **Changed since** (FR-238) [A-199]: the previous export is the campaign's newest `report` row, whatever folder. Its `variants[].rev` against this one's. From the second export on.
- **Translations** (FR-237): one entry per text layer of an ad whose language is not `primaryLanguage`.
- **HTML** (FR-233) [A-203, A-206]: one file, no script, a `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'">`, every value escaped (`& < > " '`), no link. Order: header (campaign, market, audience, campaign ID, export time, exporter with "Typed by the user in Settings. Not checked.", export number, app version, paid generations), summary, warnings exported past (each with who, when, and the reason or "no reason given"), asked for against delivered, then one section per ad (picture, title, ID, size, language, format, file, subjects, changed, last agent change, translations, checks, assets, failure). Each ad's picture is a `data:image/jpeg;base64` image, longest side 240 pixels; a video ad's is the frame at the middle of its duration, taken from the exported MP4. Times show as `YYYY-MM-DD HH:mm UTC`. A prompt longer than 2,000 characters is cut in the HTML only, with "(cut)".
- Words: "name not set"; "no reason given"; "no agent changes"; "last changed by an agent on {date}"; "Changed since export {n}", "Not changed since export {n}", "Not in export {n}"; "No ad was made for this size and language.", "Not part of this export.", "The export of this ad failed."; sources "AI", "an agent", "typed by the user", "supplied with the brief", "not recorded"; status "approved", "proposed, not approved", "missing"; "Main language"; "Checks were not run: not built in this version."; "Pictures of each ad are in the report file." (the in-app view).
- **Saved** as `report.add` (internal command, `deny` for an agent): one `report` row (`id` ULID, `campaign_id`, `created_at`, `output_dir` the real root, `body` the JSON). Files first, then the row; a row that fails to save fails the job with "The report was written but could not be saved in the project."
- **Queries** (user only; an agent is refused before anything is read): `report.list { projectId, campaignId }` → `Array<{ reportId, createdAt, exportNumber, outputDir, summary }>`, newest first; `report.get { projectId, reportId }` → `{ report: Report, outputDir }`. A body that fails the schema is logged and left out (`list`) or `NOT_FOUND` (`get`).

### Settings [A-201]

- New key `reports: { exporterName: string }`, default `{ exporterName: '' }`. Trimmed, at most 100 characters, no control characters. Written by `settings.update` (the patch schema gains `reports`). A bad value in the file loads as `''`, the other keys as usual. The name is in no log line.
- The Settings screen gains an "Export" section (P8-10): picture format, JPG quality, frames per second (the built `settings.export`), and "Name shown in reports".

### Video [A-202, A-208]

- **Work folder:** `{userData}/export-work/{jobId}/` (ULID checked, made with `lstat` checks as the thumbnail folders are). FFmpeg writes only there; the finished MP4 is streamed into the output folder through `exportTarget`. The folder is removed at the job's end and every leftover is removed at app start. FFmpeg is never given the output folder.
- **FFmpeg inputs:** each clip's source from `AssetService.resolve`, `realpath`, a regular file, passed as `file:{path}` after `-protocol_whitelist file,pipe`. The frame stream is `pipe:0`. The filter graph holds only numbers and fixed names; a test refuses any graph with a character outside `[0-9a-z_=:,;\[\].\-]` or the words `movie` or `amovie`.
- **Encoders:** macOS `h264_videotoolbox`, Windows `h264_mf`, as the topic file says. Any other system: the ad fails with "Video export works on macOS and Windows only."
- **Shade over video:** in `overlay-only`, the Scene draws the background layer's shade (not its colour or picture) so text over a clip keeps it, and only where a clip covers the time (`spec/scene.md`, "Shade over a gap").
- **Sound:** built (P8-17), as `spec/export-and-checks.md`, "Sound in export", says: the one chosen source, encoded with FFmpeg's own `aac` at 192k; `-an` when there is none.
- **Report still:** `-ss {durationMs / 2000} -i file:{out.mp4} -frames:v 1 -f image2pipe -c:v png pipe:1`, then `shrink`.

## Assumptions

| ID | Assumption | Undo |
|----|-----------|------|
| A-190 | Pictures over 2,048 a side are drawn in tiles of at most 2,048 and stitched; a single big draw is not tried | Medium |
| A-191 | Export draws send no `layer.reportOverflow`; the `text-overflow` check reads the stored marks | Easy |
| A-192 | `postTitle`: trimmed, at most 80 characters, `post` when empty, `post-{name}` for a reserved device name | Easy |
| A-193 | An ad file at its exact name is replaced; nothing else is deleted; reports never replace one (`-2` to `-99`) | Easy |
| A-194 | Every local storage write goes through `{name}.partial` and a rename; `list` skips `.partial` names | Easy |
| A-195 | The output path lives only in memory for the job; `job.retry` refuses `export` | Easy |
| A-196 | The report file holds the output folder's base name only; the `report` row keeps the full path; `report.list` and `report.get` refuse agents | Easy |
| A-197 | One export per campaign at a time (`export_running`) | Easy |
| A-198 | The export number counts the campaign's `report` rows; the previous export is the newest row, whatever folder | Easy |
| A-199 | "Changed since" has three values: changed, unchanged, not in the previous export | Easy |
| A-200 | A cancelled export keeps its finished files, removes the one in progress, writes no report | Easy |
| A-201 | The exporter's name is `settings.reports.exporterName`, at most 100 characters | Easy |
| A-202 | In `overlay-only` the Scene draws the background's shade | Medium |
| A-203 | Report pictures: longest side 240, JPEG 80, inside the HTML only; a video's is its middle frame; the in-app view has none | Easy |
| A-204 | A warning that appears after the gate is reported as such; the export goes on | Easy |
| A-205 | A size and language pair counts as delivered when any ad of that pair, any direction or format, was exported | Easy |
| A-206 | The HTML has no links, a strict CSP meta, UTC times, prompts cut at 2,000 characters | Easy |
| A-207 | The export job row: provider `adman`, model empty, no path and no reason in `request` | Easy |
| A-208 | Video work goes in `{userData}/export-work/{jobId}/`; FFmpeg never writes into the output folder | Easy |
| A-209 | Until P8-13 and P8-16 merge, reports say checks were not run and video ads fail as not built; neither state ships | Easy |

## Open questions

1. **OI-09, the FFmpeg build source.** Settled for Phases 7 and 8 (A-189): Windows from a ready-made LGPL build of the public builder repository `FFmpeg-Builds/FFmpeg-Builds`, macOS built on this machine by the fetch script from the FFmpeg release source archive, both pinned in `scripts/ffmpeg-sources.json`. Pins, configure flags and pin checks: `spec/phases/phase-07.md`, "Where FFmpeg comes from". The Windows pin is checked by hand against the release's own checksum file before the first Windows run. P8-18 needs the fetch script's hand run done (P7-3).
2. **Phase 6's check engine name.** Recommendation: Phase 6 exposes `runChecks(project, variantIds)` and `storeChecks(project, results, ranBy)` in `src/main/checks/`; P8-13 adapts to whatever is built.
3. **Phase 7's FFmpeg locator name.** Recommendation: `ffmpegPath()` in `src/main/video/ffmpeg-path.ts`, null when the binary is not there.
4. **Does publish's fresh export add a `report` row and an export number?** Recommendation: no; publish has its own number (FR-241). Phase 9 rules; `runExport` takes `record: boolean`.
5. **A list of the files an export will replace, shown first?** Recommendation: no; the dialog's one sentence is enough (A-193).

## Notes on the design as written

- `spec/infra-and-settings.md` places the FFmpeg source decision in Phase 8; Phase 7 needs it first (outline: "the MP4 embed needs it").
- "Partial-file rename" is in the export flow, but `localStorageAt` writes in place today; A-194 moves it into local storage.
- The `Report` in the topic file has `outputDir` (a full local path); A-196 changes the file to the folder's name, because a published report would carry the user's home folder.
- `checkMp4` limits a clip to 128 MiB; an exported ad can be larger, so it is not run on the app's own output.

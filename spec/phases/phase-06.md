# Phase 6 — Translations with approval, and brand and legal checks

**Goal:** Every language variant gets a translation that the user approves in the app, the user can export a translation sheet, and every variant can be checked against the campaign's brand and legal rules and the two readiness rules.
**Class:** A, B, D, E, G (the save picker).

"Translation approval" here is the user approving a translation in the app (`translation.approve`). It is not approvals by link (`spec/approvals*.md`), which this phase does not touch.

**Where things are.** This file: goal, exit criteria, rules, order, shared files, the design this phase adds, assumptions A-150 to A-169, open questions. The slices P6-1 to P6-17: `spec/phases/phase-06-slices.md`.

## What needs Phase 5 and what does not

Phase 5 (variants, fan-out, sync) is not built. Only three parts of this phase use its code:

| Part | Needs Phase 5? | Why |
|------|----------------|-----|
| The check engine, `check.run`, `check.results`, the check badges | No | Reads one variant's own rows and its campaign's rule set. Masters exist today. |
| The rule set panel | No | `ruleSet.update` is built. |
| The translate call (Gemini, fake) | No | `TextProvider.translate` exists as a stub. |
| `translation.set`, `translation.approve`, `translation.propose`, the translation job, the translation sheet, `layer.setFonts` | No for the code and its tests | Integration tests insert language variants as rows, as `tests/integration/generation/generation-fixture.ts` already inserts variants. |
| The translation panel and editor controls | No for code and component tests | Shots and end-to-end runs need a language variant made through the app, so they wait for Phase 5's `variant.add` or `variant.fanOut`. |
| Translation at fan-out (P6-15) | Yes | Hooks into `variant.fanOut`. |
| Translation in the sync review (P6-16) | Yes | Hooks into `sync.preview`, `sync.apply` and the sync review dialog. |
| Workflow 5.2 end to end (P6-17) | Yes | Starts with fan-out. |

## Exit criteria

- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:build` and `npm run test:e2e` pass.
- `tests/e2e/localize.spec.ts` (P6-17) passes with the fake provider: workflow 5.2 from fan-out of a master to two sizes and two more languages (one of them `ja`) to every translation approved, with one translation edited, the sheet exported, and the checks run with a warning, fixed, and run again with none.
- `tests/unit/shared/checks/` has, for each of the six checks, at least one pass, one warn and one skipped case, and the word checks each have a CJK case (P6-2).
- Named tests pass: "An agent `set_translation` never yields `approved`" (`tests/integration/mcp/translation-check-tools.test.ts`, with `tests/integration/translation/set.test.ts`); "editing an approved translation sets it back to proposed"; "a translation that arrives after the user typed over the layer does not overwrite it"; "the sheet guards cells that start with a formula sign".
- One low-cost live `translate` call has passed once under D-085 (`tests/live/gemini-translate.live.test.ts`), reported with model ID, time and answer size and never the answer text; or the report says why it was not run.
- Shots 200 to 219 made and named in the slice reports.
- This phase adds no migration; `variant_check` and the two `translation_*` columns exist since `0000`.
- Windows is the stakeholder's check (D-087).

## Dependencies

- Phases 1 to 4 (built). P6-15, P6-16 and P6-17 also need the Phase 5 slices named in their "Needs".
- The Gemini text model `gemini-3.5-flash-lite` is proven for JSON text calls; the live run in P6-17 confirms it for `translate`.

## Rules for these slices

- Write the failing tests first, then the code. Prefer one table test over many near-identical cases. A slice that touches the renderer also runs `npm run test:e2e`.
- **Shared files.** Only P6-1 edits `src/main/commands/agent-policy.ts`, `src/main/core.ts`, `src/main/core-deps.ts`, `src/main/queries/queries.ts`, `src/main/jobs/kinds/index.ts`, `src/shared/schemas/rows/index.ts`, `src/main/queries/campaign-reads.ts`, `src/main/commands/layer/write-layer.ts` and `src/renderer/screens/campaign/campaign-view/campaign-view.tsx`. P6-1 registers every command, query and the job kind of the phase against stub files; later slices replace stub bodies and touch no index. A later slice that finds it must edit one of these stops and reports.
- **Phase 5 files.** Only P6-15 and P6-16 edit files Phase 5 creates, each a few lines, named in the slice once Phase 5 has built them.
- **No migration, no setting, no secret, no event.** If a slice finds it needs one, it stops and reports. Migration number `0006` is reserved for this phase and is not expected to be used.
- **Screens** (D-084): one folder per component, CSS from `src/renderer/ui/tokens.css` only, no new token. A mount in an existing component is a few lines, named in the slice. Shots go in `tests/shots/p6-{n}.shots.ts`, picture names from the numbers given in the slice (range 200 to 219). A screen slice whose shots need a language variant takes them only if Phase 5's `variant.add` or `variant.fanOut` is merged; otherwise it hands its shot file to P6-17.
- **Paid calls.** Every automatic test uses the fake provider or a recorded Gemini answer. The one live `translate` call is in P6-17.
- **Secrets.** No key, token or signed address goes into a log line, a job row, an event or a reply. A translate failure detail goes through `redactSecret` as every Gemini detail does.
- **Security class.** Slices marked "full" merge only after a full security review; "short" after a short one.
- Budget: one slice per developer run, well under 300k tokens; hand off with `HANDOFF.md` if near it.

## Order and side-by-side work

| Wave | Slice | Needs | May run beside | Must not run beside |
|------|-------|-------|----------------|---------------------|
| 0 | P6-2 Check engine (built) | Nothing | Everything | Nothing (new files under `src/shared/checks/` only) |
| 0 | P6-5 Translate call (built) | Nothing | Everything except other edits of `src/main/providers/gemini/text.ts`, `prompts.ts`, `fake/text.ts` | Any slice that edits those three files (none planned in Phase 5; Phase 5's `extend` edits `gemini/image.ts`, not these) |
| 0 | P6-8 Save picker (built) | Nothing | Everything | Any slice that edits `src/main/windows/dialogs.ts`, `src/shared/schemas/queries/dialog.ts` or `src/renderer/app/app-context.tsx` (none planned) |
| 1 | P6-1 Contracts (built) | Nothing unbuilt | P6-2, P6-5, P6-8 | Phase 5's contracts slice and any slice that edits a file in "Shared files" below (`agent-policy.ts`, `core.ts`, `queries.ts`, `kinds/index.ts`, `rows/index.ts`, `campaign-reads.ts`, `write-layer.ts`, `campaign-view.tsx`); AP-11, AP-12 (`campaign-view/`) |
| 2 | P6-3 Checks command, results, badges (built) | P6-1, P6-2 | P6-4, P6-7, P6-9, P6-10 | Nothing |
| 2 | P6-4 Set, approve, restore (built) | P6-1 | P6-3, P6-7, P6-9, P6-10 | Nothing |
| 2 | P6-7 Translations query, sheet (built) | P6-1 | P6-3, P6-4, P6-9, P6-10 | Nothing |
| 2 | P6-9 `layer.setFonts` (built) | P6-1 | P6-3, P6-4, P6-7, P6-10 | Nothing |
| 2 | P6-10 Rule set panel | P6-1 | Any logic slice | Nothing |
| 3 | P6-6 Translation job, propose, write (built) | P6-4, P6-5 | P6-11, P6-12, P6-14 | Nothing |
| 3 | P6-11 Check panel (built) | P6-3 | P6-6, P6-12, P6-14 | Nothing |
| 3 | P6-12 Translation panel: rows, edit, approve (built) | P6-4, P6-7 | P6-6, P6-11, P6-14 | P6-13 (`translation-panel/`) |
| 3 | P6-14 Editor controls (built) | P6-4, P6-7, P6-9 | P6-6, P6-11, P6-12 | Any slice editing `src/renderer/editor/text-fields/` (Phase 5 may, for override marks; order them) |
| 4 | P6-13 Translation panel: translate again, sheet, close warning | P6-6, P6-8, P6-12 | P6-11, P6-14 | P6-12; any slice editing `stores/attached-store.ts`, `ui/close-warning/close-words.ts` (Phase 5's fan-out dialog may; order them) |
| 5 | P6-15 Translation at fan-out | P6-6, P6-13; Phase 5's `variant.fanOut` and fan-out dialog merged | P6-16 | Any Phase 5 slice still editing the fan-out handler or dialog |
| 5 | P6-16 Translation in the sync review | P6-6; Phase 5's `sync.preview`, `sync.apply` and sync review dialog merged | P6-15 | Any Phase 5 slice still editing those files; any slice editing `commands/translation/propose.ts` |
| 6 | P6-17 Workflow 5.2, shots, live run, exit check | Every other P6 slice; Phase 5 merged | Later-phase slices that touch no P6 file | Nothing |

## Can start now

Need only what Phases 1 to 4 built:

- **At once:** P6-2, P6-5, P6-8, and P6-1 (P6-1 waits only for the Phase 5 contracts slice to merge or not yet to start, since both edit the same index files).
- **After P6-1, still without Phase 5:** P6-3, P6-4, P6-7, P6-9, P6-10; then P6-6, P6-11, P6-12, P6-14; then P6-13. Their shots that need a language variant move to P6-17 if Phase 5 is not merged.
- **Need Phase 5:** P6-15, P6-16, P6-17.

## Shared files

Existing files that more than one P6 slice, or another phase, is likely to edit:

| File | Edited by (this phase) | Also edited by |
|------|------------------------|----------------|
| `src/main/commands/agent-policy.ts` | P6-1 | Phase 5 contracts (rows exist; it may add none), Phase 10 |
| `src/main/core.ts`, `src/main/core-deps.ts` | P6-1 | Phase 5 contracts, Phase 7, 8 |
| `src/main/queries/queries.ts` | P6-1 | Phase 5 contracts (`sync.preview`) |
| `src/main/jobs/kinds/index.ts` | P6-1 | Phase 5 (extend or fill kind) |
| `src/shared/schemas/rows/index.ts` | P6-1 (`variant_check`) | Phase 7 (`background_clip`), Phase 8 (`report`) |
| `src/main/queries/campaign-reads.ts` (`badgesOf`) | P6-1 (check badges line) | Phase 5 (`outOfDate`) |
| `src/main/commands/layer/write-layer.ts` | P6-1 (copy edit resets an approved translation) | Phase 5 (override recording) |
| `src/renderer/screens/campaign/campaign-view/campaign-view.tsx` | P6-1 (one mount line) | Phase 5 (grids per direction, undo buttons), AP-11 |
| `src/renderer/editor/text-fields/text-fields.tsx` | P6-14 | Phase 5 (override marks, if it shows them per field) |
| `src/renderer/editor/font-field/font-field.tsx` | P6-14 | Phase 5 (override mark) |
| `src/renderer/stores/attached-store.ts`, `src/renderer/ui/close-warning/close-words.ts` | P6-13 | Phase 5 (fan-out dialog's fill jobs) |
| `src/main/windows/dialogs.ts`, `src/shared/schemas/queries/dialog.ts`, `src/renderer/app/app-context.tsx` | P6-8 | Phase 8 (export folder picker, if it adds one) |
| `src/main/providers/gemini/text.ts`, `prompts.ts`; `src/main/providers/fake/text.ts` | P6-5 | None planned |
| Phase 5's fan-out handler and dialog | P6-15 | Phase 5 |
| Phase 5's `sync.preview`, `sync.apply` and sync review dialog | P6-16 | Phase 5 |

# Design additions

Where the topic files are silent or need a rule for this phase. The orchestrator folds these into the topic files named. Judgement calls carry an assumption ID.

## 1. Commands and queries (fold into `spec/api-commands.md`, `spec/api-queries-events.md`)

| Command | Input | Undo | Agent | Reply |
|---------|-------|------|-------|-------|
| `translation.propose` | projectId, provider, and either `variantIds[]` (1 to 500) or `directionId` + `language` | — | deny (A-169) | `{ jobIds: string[] }` |
| `translation.set` | projectId, layerId, text (0 to 5000), applyToSameLanguage | V (the named layer's variant) | allow | `{ layerIds: string[] }` written |
| `translation.approve` | projectId, layers[] of { layerId, copyRev } (1 to 2000; P6-4b, until then layerIds[]) | C | deny | `{ layerIds: string[] }` changed |
| `translation.exportSheet` | projectId, campaignId, filePath | — | deny | `{ fileName, rowCount }` |
| `translation.write` (system) | projectId, jobId, items[] of { key, text } | — | deny (system) | `{ written: number }` |
| `translation.restore` (system) | projectId, items[] of { layerId, copy, translationStatus, translationSource, syncedCopyRev } (1 to 2000) | the caller's list | deny (system) | `{ layerIds }` |
| `check.run` | projectId, and either campaignId or `variantIds[]` (1 to 1000) | — | allow | `{ variants: Array<{ variantId, checkedRev, results: CheckResult[] }> }` |
| `layer.setFonts` | projectId, items[] of { layerId, fontAssetId or null } (1 to 500), all in one campaign | C | allow | `{ layerIds }` changed |

- `translation.propose` gains `provider` beside the inputs the table had, as `generation.copyOptions` has (A-157). Its reply is a list because one call can start one job per direction and language.
- `translation.restore` is the inverse of `translation.set` and `translation.approve`, and its own inverse. It writes exactly the given values and bumps `variant.rev` of each variant touched. `syncedCopyRev` writes `synced_revs.copy`.
- `translation.restore` input (built, P6-4): a required `scope`, `campaign` or `variant`, says which undo list its own inverse goes on. `translation.set` sends `variant`; `translation.approve` sends `campaign`. Each item's `copy` is at most 5000 code points.
- `translation.write` and `translation.restore` are `internal: true`: no window may send them.
- `layer.setFonts` is new (A-166). It is its own inverse (the items with the fonts they had). Undo puts the fonts back, but a font override mark the command added stays (known gap, on the stakeholder's review list).

| Query | Input | Reply | Agent |
|-------|-------|-------|-------|
| `translation.forCampaign` | projectId, campaignId | `{ primaryLanguage, rows: TranslationRow[], jobs: TranslationJobState[] }` | allow |
| `check.results` | projectId, and either campaignId or `variantIds[]` | `{ variants: Array<{ variantId, rev, checkedRev, stale, ranAt, ranBy, results }> }`, only variants with a check row | allow |
| `dialog.pickSaveFile` | purpose `translation-sheet`, defaultPath? | `{ path: string \| null }` | window only (as every picker) |

```ts
type TranslationRow = {
  directionId: string; variantId: string; title: string; sizeLabel: string; language: string
  layerId: string; layerKey: string; layerName: string
  sourceText: string | null      // the direction master's copy for this key; null when the master has no such layer
  text: string                   // the layer's copy ('' when null)
  status: 'missing' | 'proposed' | 'approved' | null
  source: 'ai' | 'agent' | 'user' | 'brief' | null
  fontAssetId: string | null
  copyRev: number                // the layer's revs.copy; sent back by translation.approve (P6-4b)
}
type TranslationJobState = {     // the newest translation job per direction and language
  directionId: string; language: string; jobId: string
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'
  errorKind: string | null       // as job rows give it; the window shows the plain sentence
}
```

- Rows: one per text layer of every variant in the campaign whose language is not the primary language, ordered by direction `sort`, then language, then size label, then layer `z`.
- `check.results` replaces "Phase 6 adds the latest check result" to `variant.get` (A-165), so `variant-reads.ts`, which Phase 5 and 7 also extend, is not touched.

## 2. Translation rules (fold into `spec/data-rules.md` and `spec/api-commands.md`)

**What a translation is.** A text layer of a variant whose language is not the campaign's primary language. Its source text is the copy of the layer with the same `key` in its direction's master. The master is in the primary language.

**Status on new layers.** `initialTranslation(variantLanguage, primaryLanguage, layerType)` (`src/shared/translation/initial.ts`, P6-1) gives `{ translationStatus: 'missing', translationSource: null }` for a text layer in another language and nulls otherwise. Phase 5's fan-out and `variant.add` use it for every copied layer. `layer.create` keeps null (`spec/editor-commands.md`): an added layer is not a translation until text is set with `translation.set`.

**`translation.propose`** (A-154, A-156, A-157):

1. Checks the provider as `generation.copyOptions` does ("That provider cannot translate.", `INVALID_INPUT`), then the targets, then the key (`requireProviderKeys(deps, provider, 'translate')`, `NEEDS_KEY`).
2. Targets: with `variantIds`, every one must be in this project (`NOT_FOUND` "That post was not found.") and not in the primary language (`INVALID_INPUT` "These posts are in the main language."). They are grouped by direction and language. With `directionId` + `language`: every variant of that direction in that language; the primary language is refused the same way.
3. Per group: the items are the master's text layers with non-empty trimmed copy, as `{ key, text }`, each with the master layer's `revs.copy`. A group with no item is skipped. If every group is skipped: `RULE_VIOLATION`, reason `nothing_to_translate`, "There is no text to translate."
4. Per group, the target layers are the text layers of the group's variants whose key is among the items, whose status is `missing` or `proposed`, and whose `overrides` do not hold `copy`. An `approved` translation is never replaced by a proposal (A-156). A group with no target layer is skipped.
5. One `translation` job per group: `campaign_id` set, `variant_id` and `layer_id` null, `slot` null, provider and model from the input and registry, `startedBy` the actor. Request (`src/shared/schemas/jobs/translation.ts`):

```ts
type TranslationJobRequest = {
  mode: 'write' | 'sync'          // 'sync' only from the sync review (P6-16)
  directionId: string; from: string; to: string; region: string; audience: string
  items: Array<{ key: string; text: string; masterCopyRev: number }>
  targets: Array<{ layerId: string; key: string; copyRev: number }>   // empty in 'sync' mode
}
type TranslationJobResult = { items: Array<{ key: string; text: string }>; written: number }
```

**The job** (`src/main/jobs/kinds/translation.ts`). Attached kind. Key guard; one `TextProvider.translate` call through `jc.call` (so `paid_calls` counts it under text); the answer is cleaned (A-168); in `write` mode, then `jc.system('translation.write', { projectId, jobId, items })`. In `sync` mode nothing is written; the result is the record (P6-16).

**`translation.write`** (A-155). For each target of the job's request whose key has a cleaned text:

- Skip the layer if it is gone, its `revs.copy` differs from the target's `copyRev` (the user or an agent changed it since), or its status is now `approved`.
- Otherwise write `copy`, `translation_status = 'proposed'`, `translation_source = 'ai'`, `revs.copy + 1`, and, when the layer is `linked`, `synced_revs.copy` = the item's `masterCopyRev`. Bump `variant.rev` once per variant through `variant-rev.ts`.
- Not undoable, as `asset.addGenerated` is not. `written` is the count of layers written.

**`translation.set`** (A-160, A-162):

- The layer must be a text layer (`INVALID_INPUT` "Translations are for text layers."). Its variant must not be in the primary language (`RULE_VIOLATION`, reason `not_a_translation`, "This text is in the campaign's main language. Change it in the editor.").
- Writes `copy` = the text as given, status `proposed`, source `user` or `agent` by actor, `revs.copy + 1`, and for a linked layer whose master has the key, `synced_revs.copy` = the master's `revs.copy` now. Never `approved`, whoever sends it [REQ: FR-200].
- `applyToSameLanguage`: also every text layer with the same key in every other variant of the same direction and language whose `overrides` do not hold `copy`. Layers whose values would not change are left out.
- Inverse: one `translation.restore` with every written layer's previous `copy`, status, source and `synced_revs.copy`, on the list of the named layer's variant.

**`translation.approve`** (A-159):

- Every layer must be a text layer of a variant not in the primary language, with status `proposed` or `approved`. A `missing` one refuses the whole command: `RULE_VIOLATION`, reason `translation_missing`, "Some of these have no translation yet.", `details.layerIds`. A layer in the primary language: `not_a_translation` as above. Nothing is written on a refusal.
- **The text read** (designed, building in P6-4b). The input is `{ projectId, layers: Array<{ layerId, copyRev }> }`, where `copyRev` is the layer's copy counter (`revs.copy`) the caller read; `translation.forCampaign` gives each row its `copyRev`. If any layer's stored copy counter differs, the whole command is refused before any write: `RULE_VIOLATION`, reason `translation_changed`, "A text changed after you read it. Read it again, then approve.", `details.layerIds` naming them. Reason: an approval is for the text the user read.
- Sets `approved` on each `proposed` one; `approved` ones are left. No layer counter changes; `variant.rev` goes up once per variant changed, so the last check becomes stale.
- Inverse: `translation.restore` on the campaign's list.

**Editing an approved translation by other routes** (A-161). `writeLayer` (`src/main/commands/layer/write-layer.ts`) gains one rule through `translationAfterCopyEdit(row, actor)` (`src/main/translation/copy-edit.ts`, P6-1): when `copy` is among the written keys and the layer's status is not null, the status becomes `proposed` and the source `user` or `agent` by actor. So `layer.update` and `layer.updateMany` can never leave an edited text `approved` [REQ: FR-101].

**Brief-supplied copy** (A-163). `briefCopyFor(brief, language, slot)` (`src/shared/translation/brief-copy.ts`): `brief.copy[language].headline` for slot `headline`, `brief.copy[language].callToAction` for slot `call-to-action`, trimmed; empty or absent gives null. Used at fan-out only (P6-15): a layer with brief copy gets that text, status `proposed`, source `brief`; the rest of the language's text layers go to the job. When every text layer has brief copy, no job runs for that language.

**Chinese script** (A-158). For `to = 'zh'`, the instruction asks for Traditional Chinese when the campaign's region resolves (by the `region-languages.ts` lookup) to `TW`, `HK` or `MO`, and Simplified Chinese otherwise.

## 3. The translate call (fold into `spec/providers-adapters.md`, `spec/ai-jobs.md`)

`TextProvider.translate(input, opts?)` keeps its input `{ items, from, to, region, audience }` and gains `opts?: RunOptions` like the other text calls.

- **Gemini** (`gemini/text.ts`, instruction in `gemini/prompts.ts`). One `jsonCall` with job `text`. `parts` = the instruction, then the items as a JSON array after the fixed line "Texts:". The instruction names both languages by English name and tag (`Intl.DisplayNames('en', { type: 'language' })`), the region and the audience as context [REQ: FR-101], asks for ad copy that keeps the meaning and tone, keeps line breaks, keeps brand names, product names, numbers and prices as written, adds nothing, and returns every key once. For `zh`, the script line (A-158). Answer schema `{ items: [{ key, text }] }`, both required.
- **Cleaning** (A-168), in the job, not the adapter: keep an answer item only if its key was asked and not seen before, its text is a string, trimmed non-empty, and at most 5000 code points. Missing keys leave their layers as they are. No usable item: `ProviderFailure` `other`, "No usable translation in the answer". The answer is untrusted data and leaves only as plain strings.
- **Error mapping and timeout** as the other text calls (`TEXT_TIMEOUT_MS`, the table in `spec/providers-adapters.md`).
- **Fake** (A-167). `translate` returns each item's text with `[{to}] ` in front (for example `[ja] Shop now`), through `fakeRun`, so the fake's failure and wait settings apply.

## 4. The translation sheet (fold into `spec/export-and-checks.md`)

- Built from `translation.forCampaign` rows by `sheetCsv(rows)` (`src/shared/translation/sheet.ts`, pure). Columns as the topic file lists: `variant_id, title, size, language, layer, source_text, text, status`; `layer` is the layer name; `size` the size label; an empty status cell for a null status.
- CSV: UTF-8 with a byte-order mark, CRLF line ends, every cell quoted with `"` and inner quotes doubled (A-164).
- **Formula guard** (A-164). A cell that starts with `=`, `+`, `-`, `@`, a tab or a carriage return gets a `'` in front, so a spreadsheet does not run text from an AI answer or an agent as a formula.
- **The path** (security class): `filePath` must be absolute (`INVALID_INPUT` "The file path must be absolute.") and end in `.csv`, any letter case (`INVALID_INPUT` "The sheet must be a .csv file."). Its folder must exist (`NOT_FOUND` "That folder was not found."). The real path of the folder must not be at or inside the real path of the project's assets folder (`RULE_VIOLATION` "Choose a folder outside the project's assets folder.", `pathAtOrInside` as `project.package` uses it). An existing folder at the path: `RULE_VIOLATION` "Something that is not a file is already there.". An existing file is replaced (the save dialog asked).
- **Only the chosen path** (built, P6-7b). The command writes only to the path the main process's save dialog last returned. The main process remembers that path in memory for one use, and forgets it after 10 minutes or when a newer choice replaces it. Any other path: `RULE_VIOLATION`, reason `path_not_chosen`, "Choose where to save the sheet first." On Windows a path that starts with `\\`, or a file name that holds `:`, is refused: `RULE_VIOLATION`, reason `unsupported_path`, "The sheet cannot be saved in that place." The reply is `{ fileName, rowCount }` and never holds the folder.
- Written in `prepare`: to `{path}.partial` in the same folder, then renamed over the target; the partial file is removed on any failure. Nothing is written to the project. Not undoable.

## 5. Checks (fold into `spec/export-and-checks.md`)

**The engine** (`src/shared/checks/`, pure, class A): `runAllChecks(input): CheckResult[]`, the six results in the topic file's order.

```ts
type CheckInput = {
  variant: { format: 'image' | 'video'; width: number; height: number; durationMs: number; language: string }
  primaryLanguage: string
  layers: LayerRow[]
  ruleSet: { requiredAssetIds: string[]; palette: string[]; requiredWords: Record<string, string[]>; prohibitedWords: Record<string, string[]> }
  assetNames: Record<string, string>    // display names of the required assets
}
```

- **Shown** (A-150, A-151). A layer is shown when `visible` is true, its axis-aligned bounding box after `rotation` overlaps the canvas with an area above 0, and: a picture or background layer has `style.opacity > 0`; a text layer has non-empty trimmed copy; for video, its time `[startMs, endMs ?? durationMs)` overlaps `[0, durationMs)`.
- `required-assets`: each required asset is used by a shown layer, as `source.assetId` or, on a text layer, `style.fontAssetId`. One finding per missing asset: "{name} is not shown on this post." Skipped when the list is empty.
- `text-colours`: every shown text layer's `style.color` is in the palette, ignoring letter case. Finding: "{layer} uses {colour}, which is not in the palette." Skipped when the palette is empty.
- `prohibited-words`: every text layer, hidden ones included (A-150). Finding per layer and entry: "{layer} contains “{entry}”."
- `required-words`: shown text layers only, their copy joined with a line break. Finding per entry: "“{entry}” is not in this post's text."
- `unapproved-translations`: finding per layer: "{layer}: the translation is not approved." or "{layer} has no translation yet." Skipped in the primary language.
- `text-overflow`: shown text layers with `overflow`. Finding: "{layer} does not fit its box."
- A skipped result has one finding with no `layerId`, its reason: "The campaign has no required files.", "The palette is empty.", "There are no prohibited words for {language}.", "There are no required words for {language}.", "This post is in the main language." `text-overflow` is never skipped. Words in `src/shared/checks/messages.ts`.
- **Lists** (A-152). Entries are trimmed; empty entries are ignored. A list that is absent or empty after that counts as no list.

**Word matching** (A-153), `src/shared/checks/match.ts`:

- Both sides: Unicode NFKC, then `toLocaleLowerCase(language)` (so a Turkish dotted capital I matches).
- An entry made only of punctuation, symbols and spaces (`/^[\p{P}\p{S}\s]+$/u`, after trimming) matches anywhere [REQ: FR-240].
- Languages written without spaces between words, `zh`, `ja`, `ko`, `th`, `lo`, `km`, `my`: a plain substring match.
- Others: an occurrence matches only when its start and end both fall on word-segment boundaries of `Intl.Segmenter(language, { granularity: 'word' })` over the normalised text.

**Storing and reading** (`src/main/checks/`):

- `runChecksFor(ctx, variantIds, ranBy)` reads each variant, its layers, its campaign's rule set and the asset names, runs the engine, and upserts `variant_check` with `checked_rev` = `variant.rev`, `ran_at` now, `ran_by`. Phase 8's export calls it with `'export'`.
- `check.run` calls it with the actor. It changes no `rev` and has no undo entry. Emits `project.changed` with the `variant_check` rows.
- Badges: `checkBadges(row, rev)` (`src/main/checks/badges.ts`): `checkWarning` = row exists, `checked_rev = rev`, and a `brand-legal` result is `warn`; `checkStale` = row exists and `checked_rev < rev`.

## 6. Per-language font (fold into `spec/data-rules.md`, `spec/editor-commands.md`)

- A language variant's own font is `style.fontAssetId` on its layer, recorded as an override by Phase 5's rule when the layer is linked, so the rest of the style still follows [REQ: FR-056].
- `layer.setFonts` writes `style.fontAssetId` on each named layer through `writeLayer` (so Phase 5's override rule applies when it lands). Each layer must be a text layer (`INVALID_INPUT` "Fonts are for text layers."); a font ID must name a font asset of this project (the `check-layer-assets.ts` check); every layer must be in one campaign (`INVALID_INPUT` "These layers are in different campaigns."). Bumps `revs.style` and `variant.rev`.
- The editor's "Use this font for every {language} post" finds the matching layers (same direction, language and key) from `translation.forCampaign` and sends one `layer.setFonts`.

## 7. What Phase 5 calls (fold into `spec/data-rules.md`, "Fan-out" and "Sync preview")

- **Fan-out, step 6** (P6-15): new text layers in another language start from `initialTranslation`; then per language, `briefCopyFor` fills what the brief gave; then `startTranslations(deps, ctx, { directionId, language, variantIds, startedBy })` (`src/main/translation/start.ts`, P6-6), the same code `translation.propose` uses, with the provider from `settings` for the `text` job. No key: no job, the layers stay `missing`. The fan-out reply gains `translationJobIds`. The fan-out dialog states the text calls with the provider before confirm.
- **Sync review** (P6-16): when master copy changed, the review dialog sends `translation.propose` with `mode: 'sync'` per language (the command input gains optional `mode`, default `'write'`). `latestSyncTranslation(db, directionId, language)` (`src/main/translation/sync-result.ts`) gives the newest `sync` job's state and texts. `sync.preview` fills `proposedTranslation` from it: the text when that job succeeded with `masterCopyRev` equal to the master's `revs.copy` now, `failed` when it failed or no key. `sync.apply` with `accept` writes that text with status `proposed`, source `ai`.

## 8. Screens (fold into `spec/screens-campaign.md`, `spec/editor.md`)

Built without a design sign-off [D-084]. Words follow `spec/screens.md`.

- **`screens/campaign/campaign-sections/`** (P6-1): under the run list on the overview, three sections in order: rule set, checks, translations. The translations section shows only when the campaign has a language other than the primary one.
- **Rule set panel** (`rule-set-panel/`, P6-10), region "Brand and legal rules". "Palette": one swatch per colour with its hex and "Remove"; a hex field and "Add colour" (refused unless `#RRGGBB`: "Use a colour like #1A2B3C."). "Required files": each asset's name with "Remove"; "Add a required file…" opens a list of the project's pictures and fonts with a tick each and "Add". "Words": per campaign language, the required and prohibited lists, one entry per line, saved on leaving the field. Every change sends `ruleSet.update` with the one list changed; a refusal's own message shows under that list.
- **Check panel** (`check-panel/`, P6-11), region "Checks". "Run checks" sends `check.run { campaignId }`; "Checking…" while it runs. Summary: "{n} posts checked · {w} with brand or legal warnings · {s} not checked since a change". Then one block per variant, "{title} · {size} · {language}", with six rows "{check name}: Passed | Warning | Skipped" and the findings under a warning or skip. "Changed since the last check." on a stale block. Data from `check.results`, read again on `project.changed`. Check names: "Required files", "Text colours", "Prohibited words", "Required words", "Translations approved", "Text fits".
- **Translation panel** (`translation-panel/`, P6-12, P6-13), region "Translations". One group per language: heading "{language name} · {a} of {n} approved"; per row "{title} · {size} · {layer}", the source text (muted, "No source text" when null), the text field, a mark "Missing" / "Proposed" / "Approved" with "from AI" / "from an agent" / "from you" / "from the brief", and "Approve" on a proposed row. Editing the text sends `translation.set`; a tick "Use for every {language} post with this text box" sends `applyToSameLanguage`. Per group: "Approve all {language}" (the proposed rows' layer IDs) and "Translate {language} again…" (the run dialog, job `text`, title "Translate", confirm "Translate"; sends `translation.propose` with the group's variant IDs). A failed newest job shows "The translation did not finish: {sentence}" and "Retry", which opens the run dialog again (a new `translation.propose`, not `job.retry`). "Running…" with "Stop" (`job.cancel`) while a job runs. At the top: "Export translation sheet…" → `dialog.pickSaveFile` → `translation.exportSheet` → "Saved {file name}."
- **Close warning** (P6-13): translation jobs started on the overview are attached to the campaign tab (`attached-store` owner `{ projectId, campaignId }`); closing the campaign tab warns with task "translating".
- **Editor** (`editor/translation-status/`, `editor/language-font/`, P6-14): for a text layer with a non-null status, under Copy: "Translation: {Missing | Proposed | Approved}, {source}" and "Approve"; the Copy field then sends `translation.set` instead of `layer.update`. Under the font field: "Use this font for every {language} post" (A-166).

# Assumptions (A-150 to A-169)

Each to be added to `spec/assumptions.md` under a "Phase 6" heading. All "Change later: easy" unless said.

- **A-150. What the checks read.** Hidden or empty text layers do not count for colours, required words or required files; prohibited words are checked in every text layer, hidden ones included, because a hidden layer can be shown again before export.
- **A-151. "Shown on the canvas".** A rotated layer is judged by its axis-aligned bounding box. A required asset counts when a shown layer uses it as picture or as font.
- **A-152. Empty lists.** An empty list, or one with only blank entries, is "no list", so its check is skipped.
- **A-153. Word matching details.** Lower case by the variant's language; Thai, Lao, Khmer and Burmese join Chinese, Japanese and Korean in plain substring matching.
- **A-154. One translation job per direction and language,** sourced from the direction's master; a layer whose key the master lacks is not sent and not changed.
- **A-155. A late answer never overwrites newer text.** The write skips a layer whose copy changed or which was approved after the job was queued.
- **A-156. "Translate again" leaves approved translations alone.** To change an approved one, the user edits it.
- **A-157. `translation.propose` takes a provider,** chosen in the run dialog; fan-out uses the default text provider from Settings. "Retry" sends a new propose with fresh source text, not `job.retry`.
- **A-158. Chinese script by region:** Traditional for Taiwan, Hong Kong and Macao, Simplified otherwise (answers the open point in `spec/brief-and-templates.md`).
- **A-159. Approving needs text.** A `missing` translation cannot be approved; approving changes no layer counter but makes the last check stale.
- **A-160. Undo of set and approve** goes through one system command, `translation.restore`; AI writes are not undoable.
- **A-161. Any copy edit un-approves.** `layer.update` on an approved translation sets it to `proposed`; undoing that edit restores the text but not the approval.
- **A-162. The editor's Copy field on a translation sends `translation.set`.**
- **A-163. Brief copy maps by slot** (headline, call to action), counts as `proposed`, source `brief`, and a job still runs for the language's other text layers.
- **A-164 (CSV agreed by the stakeholder). The sheet's format and its formula guard,** and that an existing file at the chosen path is replaced.
- **A-165. `check.results` instead of a check field on `variant.get`.**
- **A-166. `layer.setFonts`,** a new command for "this font for every post in this language", on the campaign's undo list, allowed for agents like `layer.update`. *Change later: easy (drop the command and the button).*
- **A-167. The fake translation is `[{to}] {text}`.**
- **A-168. A partial answer writes what came back;** only an answer with nothing usable fails.
- **A-169. Agents may not start AI translation in this phase.** `translation.propose` stays `deny`; agents supply translations with `translation.set`, always unapproved.

# Open questions

- **Q6-1. May an agent start `translate` through MCP, under which tick?** (carried from the outline). **Recommendation:** not in this phase (A-169); in Phase 10, make it `tick` under the text provider's tick, with the gate learning `translation.propose`. Proceeding on that.
- **Q6-2. Q-032 sub-question 5, a style note per direction for translation.** Waits for the stakeholder; if yes, a later migration. The translate instruction has room for one more context line.
- **Q6-3. Should "Translate again" offer to replace approved translations too?** **Recommendation:** no for now (A-156); the sync review is the route when the master changes.
- **Q6-4. Undo scope of `translation.set` with `applyToSameLanguage`.** The table says V, yet it writes several variants. **Recommendation:** keep V on the named layer's variant (the inverse restores every written layer); revisit if the campaign undo buttons of Phase 5 make C the clearer home.

# Where the existing design disagrees or is already built differently

- `spec/api-commands.md` gives `translation.propose` no provider input and implies one job; this phase adds `provider` and replies with a list.
- `spec/data-rules.md`, sync preview: "opening the review starts one translation job per language" cannot be done by a query (queries never write); the review dialog sends `translation.propose` with `mode: 'sync'`.
- `spec/data-rules.md`, fan-out step 6: "if the brief supplied copy... no job runs" is read per layer, not per language (A-163).
- A-44 (`spec/assumptions-settled.md`) promised a rule-set screen in Phase 6; the outline's scope did not list it. P6-10 builds it.
- The policy rows `translation.propose`, `translation.set`, `translation.approve`, `translation.exportSheet` and `check.run` already exist in `agent-policy.ts`; P6-1 adds only `translation.write`, `translation.restore` and `layer.setFonts`.
- The `translation` job kind is in the `kind` check and `JOB_KIND_CLASSES` (attached) already; no migration is needed for it.

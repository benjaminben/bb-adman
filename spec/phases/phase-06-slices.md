# Phase 6 — the slices

The slices of Phase 6, P6-1 to P6-17. Goal, exit criteria, rules, order, shared files, the design this phase adds ("Design additions", sections 1 to 8) and assumptions A-150 to A-169 are in `spec/phases/phase-06.md`. Every slice reads that file's "Rules for these slices" and the design sections it names.

Test classes as in `spec/testing.md`. Security class: none, short or full (`spec/phases/phase-06.md`, rules).

## P6-1 — Contracts

- **Exists when done:** every Phase 6 command, query and the `translation` job kind registered against a stub; the schemas; the `variant_check` wire row; the policy rows; the check-badge and copy-edit hooks in place; the campaign page's mount for the three sections.
- **New files:**
  - Schemas: `src/shared/schemas/commands/translation.ts` (propose with optional `mode`, set, approve, exportSheet, write, restore), `src/shared/schemas/commands/check.ts` (`check.run`), `src/shared/schemas/commands/language-font.ts` (`layer.setFonts`), `src/shared/schemas/checks.ts` (`CheckResult`, `CheckId`, the group and status enums), `src/shared/schemas/rows/variant-check.ts` (`VariantCheckRow`, `results` as `CheckResult[]`), `src/shared/schemas/queries/translation.ts` (`TranslationRow`, `TranslationJobState`, the reply), `src/shared/schemas/queries/check.ts`, `src/shared/schemas/jobs/translation.ts` (request and result).
  - Real bodies, small: `src/shared/translation/initial.ts` (`initialTranslation`); `src/main/translation/copy-edit.ts` (`translationAfterCopyEdit`); `src/main/checks/badges.ts` (`checkBadges`, body returns both false until P6-3).
  - Stubs (each replaced by its slice): `src/main/commands/translation/index.ts` with `propose.ts`, `set.ts`, `approve.ts`, `restore.ts`, `write.ts`, `export-sheet.ts`; `src/main/commands/check/index.ts` with `run.ts`; `src/main/commands/language-font/index.ts` with `set-fonts.ts`; `src/main/queries/translation.ts`, `src/main/queries/check.ts`; `src/main/jobs/kinds/translation.ts`. A stub command refuses in `prepare` with `RULE_VIOLATION`, `details.reason = 'not_built'`, "{command} is not built yet."; a stub query answers the empty shape (`{ primaryLanguage, rows: [], jobs: [] }`, `{ variants: [] }`); the stub kind fails with `ProviderFailure` `other`, "Translate is not built yet".
  - Renderer stubs, each returning null: `src/renderer/screens/campaign/campaign-sections/` (renders the three below, with `projectId`, `campaignId` and the `CampaignGet` data), `rule-set-panel/`, `check-panel/`, `translation-panel/` (each with `index.ts`, the component, an empty CSS module).
- **May touch:** `src/main/commands/agent-policy.ts` (three rows: `translation.write` deny, `translation.restore` deny, `layer.setFonts` allow); `src/main/core.ts` (three spread lines); `src/main/queries/queries.ts` (two lines); `src/main/jobs/kinds/index.ts` (one line); `src/shared/schemas/rows/index.ts` (`variant_check`); `src/main/queries/campaign-reads.ts` (`checkWarning`, `checkStale` from `checkBadges`; the variant's check row read once per variant); `src/main/commands/layer/write-layer.ts` (call `translationAfterCopyEdit` when `copy` is written); `src/renderer/screens/campaign/campaign-view/campaign-view.tsx` (one import, one mount line under `RunList`); any file whose exhaustive table over a changed union stops compiling (one line each, named in the report).
- **Needs:** nothing unbuilt. Not beside Phase 5's contracts slice (same index files).
- **Tests first:** `tests/integration/translation/registration-p6.test.ts`, a table over the eight commands and two queries: each is registered, has a policy row, and (as the user) refuses with `not_built` or answers the empty shape; the two system commands refuse a window caller. `tests/unit/shared/schemas/translation-schemas.test.ts`, a table: each input with a good value and each refused field (text over 5000, empty `layerIds`, both or neither of `variantIds` and `directionId`, `variantIds` over 500, `check.run` with both `campaignId` and `variantIds`). `tests/unit/shared/translation/initial.test.ts`. `tests/integration/translation/copy-edit.test.ts`: `layer.update` of `copy` on an approved layer leaves it `proposed` with source `user`, and as the agent with source `agent`; a null-status layer stays null; a style-only edit leaves `approved`. `tests/integration/db/rows-check.test.ts` gains a `variant_check` case if it lists tables. Approved edits: `tests/unit/main/commands/agent-policy-table.test.ts` (three rows), `tests/integration/registration.test.ts` (the new names), any test listing job kind handlers.
- **Exit check:** class B + A; `npm run test:e2e` (the campaign page still renders).
- **Security:** short (policy rows, two system commands, the `writeLayer` rule). **Size:** medium.

## P6-2 — Check engine

- **Exists when done:** `runAllChecks` gives the six results for any `CheckInput` as `spec/phases/phase-06.md`, section 5, says.
- **New files:** `src/shared/checks/run-all.ts`, `shown.ts` (the shown rule), `match.ts` (normalising and matching), `word-checks.ts`, `brand-checks.ts` (required assets, colours), `readiness-checks.ts`, `messages.ts`, `types.ts` (`CheckInput`; `CheckResult` is imported from `src/shared/schemas/checks.ts` once P6-1 has merged, until then declared here with the same shape and replaced by an import in P6-3).
- **May touch:** nothing.
- **Needs:** nothing.
- **Tests first:** `tests/unit/shared/checks/match.test.ts`, a table: word boundaries (`sale` in `wholesale` no; `sale` in `Sale!` yes), a phrase, `!` anywhere, `%` alone, NFKC (full-width letters), Turkish `İ` with `tr`, Japanese and Chinese substrings, Korean substring, Thai substring. One table per check in `tests/unit/shared/checks/` with pass, warn and skipped rows: required assets (hidden, opacity 0, off canvas, rotated into the canvas, font use, video timing outside the duration), colours (case), prohibited (a hidden layer counts), required (spread over two layers; not across a line break), unapproved (primary language skipped; missing and proposed warn), overflow (hidden overflowing layer passes). A CJK case in each word check.
- **Exit check:** class A.
- **Security:** none. **Size:** medium.

## P6-3 — Checks command, results, badges

- **Exists when done:** `check.run` stores and returns results; `check.results` reads them; the tile marks "Check warning" and "Not checked" are live.
- **New files:** `src/main/checks/run-checks.ts` (`runChecksFor`), `src/main/checks/read-input.ts` (one variant's `CheckInput` from the project file); the bodies of `commands/check/run.ts`, `queries/check.ts`, `checks/badges.ts`.
- **May touch:** `src/shared/checks/types.ts` (the import of `CheckResult`).
- **Needs:** P6-1, P6-2.
- **Tests first:** `tests/integration/checks/check-run.test.ts`: by campaign and by IDs; `checked_rev` equals `variant.rev`; `ran_by` user and agent; an ID from another project is `NOT_FOUND`; the agent may run it; no `rev` changes and no undo entry; `project.changed` carries the `variant_check` row. `tests/integration/checks/check-results.test.ts`: stale after a `layer.update`. `tests/integration/queries/check-badges.test.ts`, a table: no row; a fresh row with a brand-legal warn; a fresh row with only a readiness warn (no `checkWarning`); a stale row.
- **Exit check:** class B.
- **Security:** full (an agent-reachable command that writes). **Size:** small.

## P6-4 — Set, approve, restore

- **Exists when done:** `translation.set`, `translation.approve` and `translation.restore` work as section 2 says, with undo and redo.
- **New files:** `src/main/translation/layers.ts` (find a layer's variant, direction, campaign, primary language, the master's layer by key, same-language matches), `src/main/translation/write-text.ts` (the one function that writes copy, status, source, counters and `synced_revs.copy`, used here and by P6-6); the bodies of `commands/translation/set.ts`, `approve.ts`, `restore.ts`.
- **May touch:** nothing shared.
- **Needs:** P6-1.
- **Tests first:** `tests/integration/translation/set.test.ts`, a table: as the user and as the agent (status `proposed` and the matching source, never `approved`: the named test); primary language refused; picture layer refused; `applyToSameLanguage` writes the same-language, same-key layers and skips one with a `copy` override and one in another language; `synced_revs.copy` set on a linked layer; undo restores every written layer with its status; redo. `tests/integration/translation/approve.test.ts`: approve one, approve many, a `missing` one refuses all with `details.layerIds`, already approved left; `variant.rev` up, layer `revs` unchanged; undo on the campaign list. Named test: "editing an approved translation sets it back to proposed" (through `translation.set`).
- **Exit check:** class B.
- **Security:** full (`translation.set` is agent-reachable). **Size:** medium.

## P6-5 — Translate call: Gemini and fake

- **Exists when done:** `gemini/text.ts` `translate` makes one JSON call as section 3 says; the fake `translate` answers `[{to}] {text}`.
- **New files:** none beyond tests.
- **May touch:** `src/main/providers/gemini/text.ts`, `src/main/providers/gemini/prompts.ts` (`translateInstruction`, `TEXTS_LINE`), `src/main/providers/fake/text.ts`, `src/main/providers/types.ts` (`translate` gains `opts?: RunOptions`, if not already there).
- **Needs:** nothing.
- **Tests first:** `tests/unit/main/providers/gemini/translate.test.ts` with recorded answers: the parts and their order, the JSON config, both language names in the instruction, region and audience, the `zh` script line for `TW` and for `CN`, a good answer, a non-JSON answer, a JSON answer of the wrong shape. `text-errors.test.ts` gains the translate call in its table. `tests/unit/main/providers/fake/text.test.ts`: the prefix, and the fake's failure switch. Approved edits: the cases in `text.test.ts` and `fake/text.test.ts` that state translate refuses.
- **Exit check:** class E.
- **Security:** full (a network call carrying user text). **Size:** small.

## P6-6 — Translation job, propose, write

- **Exists when done:** `translation.propose` starts one job per direction and language; the job calls the provider, cleans the answer and writes through `translation.write`; brief copy is available for fan-out.
- **New files:** `src/main/translation/start.ts` (`startTranslations`, shared by propose and fan-out), `src/main/translation/targets.ts` (items and targets per group), `src/main/translation/clean-answer.ts`, `src/shared/translation/brief-copy.ts`, `src/shared/translation/script.ts` (the `zh` script choice from the region); the bodies of `commands/translation/propose.ts`, `write.ts`, `jobs/kinds/translation.ts`.
- **May touch:** nothing shared.
- **Needs:** P6-4 (`write-text.ts`), P6-5 (the fake answers).
- **Tests first:** `tests/integration/translation/propose.test.ts`: by IDs across two directions gives two jobs; by direction and language; primary language refused; no key gives `NEEDS_KEY` and no job row; nothing to translate; approved and `copy`-overridden layers are not targets; the agent is denied. `tests/integration/translation/translation-job.test.ts` with the fake: layers become `proposed`, source `ai`, text `[de] …`; `paid_calls` is 0 for the fake and counted for a paid stand-in; a partial answer writes only its keys; an empty answer fails with "No usable translation in the answer". Named test "a translation that arrives after the user typed over the layer does not overwrite it": hold the fake, `translation.set`, release, the typed text stays. Cancel through `job.cancel` writes nothing. `tests/unit/shared/translation/brief-copy.test.ts`, `script.test.ts` (tables).
- **Exit check:** class B + E.
- **Security:** full (untrusted answer written into the project). **Size:** medium.

## P6-7 — Translations query and sheet export

- **Exists when done:** `translation.forCampaign` answers as section 1 says; `translation.exportSheet` writes the CSV as section 4 says.
- **New files:** `src/main/translation/rows.ts` (the rows and job states from the project file), `src/shared/translation/sheet.ts` (`sheetCsv`), `src/main/translation/sheet-path.ts` (the path checks); the bodies of `queries/translation.ts`, `commands/translation/export-sheet.ts`.
- **May touch:** nothing shared.
- **Needs:** P6-1.
- **Tests first:** `tests/unit/shared/translation/sheet.test.ts`: the BOM, CRLF, quoting of quotes, commas and line breaks, a null status, a CJK text; the named test "the sheet guards cells that start with a formula sign", a table over `=`, `+`, `-`, `@`, tab, CR and a plain text. `tests/integration/translation/rows.test.ts`: order, the source text, a layer the master lacks (`sourceText` null), the newest job per direction and language. `tests/integration/translation/export-sheet.test.ts`, a table of paths: relative, not `.csv`, missing folder, a folder at the path, inside the assets folder (also through a link), an existing file replaced; nothing left behind on a failure; the agent is denied.
- **Exit check:** class B.
- **Security:** full (a path from outside, a file written). **Size:** medium.

## P6-8 — Save picker

- **Exists when done:** `dialog.pickSaveFile { purpose: 'translation-sheet', defaultPath? }` opens the system save dialog with a `.csv` filter and returns `{ path }` or `{ path: null }`.
- **New files:** none beyond tests.
- **May touch:** `src/main/windows/dialogs.ts` (`DIALOG_QUERIES`, the options, `showSaveDialog`), `src/shared/schemas/queries/dialog.ts` (`pickSaveFileInput`, strict), `src/renderer/app/app-context.tsx` (the query name in its union).
- **Needs:** nothing.
- **Tests first:** `tests/unit/main/windows/save-dialog-options.test.ts` (pure options builder: purpose, filter, default path; an unknown key refused). The e2e case answers the dialog with a stub as other picker tests do.
- **Exit check:** class G.
- **Security:** short (a picker only returns a path; the command checks it). **Size:** small.

## P6-9 — `layer.setFonts`

- **Exists when done:** `layer.setFonts` works as section 6 says, with undo on the campaign list.
- **New files:** the body of `commands/language-font/set-fonts.ts`.
- **May touch:** nothing shared (it calls `writeLayer` and `check-layer-assets.ts` as they are).
- **Needs:** P6-1.
- **Tests first:** `tests/integration/commands/layer-set-fonts.test.ts`, a table: a picture layer refused; a picture asset as font refused; layers in two campaigns refused; null font; `revs.style` and `variant.rev` up; undo and redo; the agent allowed. The override case (a linked language variant keeps `style.fontAssetId` in `overrides`) is written here and marked to run once Phase 5's override rule is merged; until then it is skipped with the reason named.
- **Exit check:** class B.
- **Security:** full (agent-reachable). **Size:** small.

## P6-10 — Rule set panel

- **Exists when done:** the overview shows "Brand and legal rules" as section 8 says, and every change saves.
- **New files:** the body of `screens/campaign/rule-set-panel/`; `palette-list.tsx`, `required-files.tsx`, `word-list-fields.tsx` in that folder (reusing `screens/project-home/rule-fields/word-lists.tsx` if its props fit without change; if it would need a change, the panel has its own).
- **May touch:** nothing.
- **Needs:** P6-1.
- **Tests first:** `tests/unit/renderer/screens/campaign/rule-set-panel.test.tsx`: add a colour (good and bad hex), remove one, add and remove a required file, edit a word list, a refusal shown under its list; each change sends one `ruleSet.update` with one list. Accessibility check as the other panels.
- **Exit check:** class D; `npm run test:e2e`. **Shots:** `tests/shots/p6-10.shots.ts`, 200 (empty), 201 (filled).
- **Security:** none. **Size:** medium.

## P6-11 — Check panel

- **Exists when done:** "Checks" runs and shows results as section 8 says.
- **New files:** the body of `screens/campaign/check-panel/`; `check-block.tsx`, `check-words.ts` (pure: check names, status words, summary) in that folder.
- **May touch:** nothing.
- **Needs:** P6-3.
- **Tests first:** `tests/unit/renderer/screens/campaign/check-words.test.ts` (table); `check-panel.test.tsx`: run, "Checking…", results with findings, a skipped reason, a stale block, re-read on `project.changed`.
- **Exit check:** class D; `npm run test:e2e`. **Shots:** `tests/shots/p6-11.shots.ts`, 202 (all pass or skipped on the master), 203 (a prohibited `!` and a colour warning), 204 (stale after an edit). These need only the master.
- **Security:** none. **Size:** medium.

## P6-12 — Translation panel: rows, edit, approve

- **Exists when done:** "Translations" lists the groups and rows, edits with `translation.set`, approves one and all, as section 8 says.
- **New files:** the body of `screens/campaign/translation-panel/`; `language-group.tsx`, `translation-row.tsx`, `translation-words.ts` (pure), `use-translations.ts` (reads `translation.forCampaign`, again on `project.changed` and `job.updated`) in that folder.
- **May touch:** nothing.
- **Needs:** P6-4, P6-7.
- **Tests first:** `translation-words.test.ts` (marks, sources, heading counts); `translation-panel.test.tsx` with a fake api: groups by language, the primary language absent, edit sends `translation.set` with and without the tick, "Approve" and "Approve all {language}" send the right IDs, a refusal's message shown on its row.
- **Exit check:** class D; `npm run test:e2e`. **Shots:** `tests/shots/p6-12.shots.ts`, 205 (proposed rows), 206 (all approved); need a language variant (rules).
- **Security:** none. **Size:** medium.

## P6-13 — Translation panel: translate again, sheet, close warning

- **Exists when done:** "Translate {language} again…", the failed line with "Try again", "Running…" with "Stop", "Export translation sheet…", and the campaign-tab close warning for translation jobs.
- **New files:** `screens/campaign/translation-panel/translate-again.tsx`, `export-sheet.tsx`, `job-line.tsx`.
- **May touch:** `src/renderer/screens/campaign/translation-panel/translation-panel.tsx`, `language-group.tsx` (mounts); `src/renderer/stores/attached-store.ts` (owner `{ projectId, campaignId }`); `src/renderer/ui/close-warning/close-words.ts` (task "translating"); `src/renderer/app/campaign-tabs/campaign-tabs.tsx` (include the campaign-owned jobs in the close check, a few lines); `src/renderer/dialogs/run-dialog/run-summary.ts` (the translate title and confirm words, if it holds them).
- **Needs:** P6-6, P6-8, P6-12.
- **Tests first:** `translate-again.test.tsx`: the run dialog opens with job `text`; confirm sends `translation.propose` with the group's variant IDs and the chosen provider; `NEEDS_KEY` opens the key dialog; "Try again" sends a new propose. `export-sheet.test.tsx`: cancelled picker sends nothing; saved shows the file name; a refusal's message. `attached-store` test: a campaign-owned job warns on closing its campaign tab, with "translating".
- **Exit check:** class D; `npm run test:e2e`. **Shots:** `tests/shots/p6-13.shots.ts`, 207 (a failed language with "Try again"), 208 (sheet saved); need a language variant.
- **Security:** none. **Size:** medium.

## P6-14 — Editor controls

- **Exists when done:** in the editor, a translated text layer shows its status with "Approve", its Copy field sends `translation.set`, and "Use this font for every {language} post" sends `layer.setFonts`.
- **New files:** `src/renderer/editor/translation-status/` (component, CSS module, `index.ts`), `src/renderer/editor/language-font/` (component, `use-same-language-layers.ts` reading `translation.forCampaign`, CSS module, `index.ts`).
- **May touch:** `src/renderer/editor/text-fields/text-fields.tsx` (mount `TranslationStatus` under Copy; route the Copy commit to `translation.set` when `layer.translationStatus` is not null); `src/renderer/editor/font-field/font-field.tsx` or the properties panel line that passes `font` (mount `LanguageFont`, a few lines).
- **Needs:** P6-4, P6-7, P6-9.
- **Tests first:** `translation-status.test.tsx` (each status and source; "Approve" only on proposed; sends `translation.approve`); `text-fields` test case: a null-status layer still sends `layer.update`, a translated one `translation.set` (approved edit of `tests/unit/renderer/editor/text-fields*.test.tsx` only to add these cases); `language-font.test.tsx` (sends the matching layer IDs; hidden on a primary-language layer).
- **Exit check:** class D; `npm run test:e2e`. **Shots:** `tests/shots/p6-14.shots.ts`, 209 (status and Approve), 210 (the font button); need a language variant.
- **Security:** none. **Size:** medium.

## P6-15 — Translation at fan-out

- **Exists when done:** fan-out step 6 works as section 7 says: new text layers start `missing`, brief copy fills what it gives, one translation job per language runs, the reply names the jobs, the fan-out dialog states the text calls, and the campaign tab owns the jobs for the close warning.
- **New files:** `src/main/translation/fan-out.ts` (the step, called by the fan-out handler with its transaction context).
- **May touch:** Phase 5's `variant.fanOut` handler (call the step; add `translationJobIds` to the reply), its reply schema, and the fan-out dialog (the text-call line; register the jobs with the campaign owner). Each a few lines, named in the report.
- **Needs:** P6-6, P6-13 (campaign owner); Phase 5's `variant.fanOut` and fan-out dialog merged.
- **Tests first:** `tests/integration/translation/fan-out-translation.test.ts`: two languages give two jobs and `proposed` layers with the fake; brief copy for the headline gives source `brief` and the job covers the rest; brief copy for every text layer runs no job; no key gives `missing` and no job; a failed job leaves `missing` with the master's text.
- **Exit check:** class B, D; `npm run test:e2e`. **Shots:** `tests/shots/p6-15.shots.ts`, 211 (the fan-out dialog's text-call line), 212 (the grid with "Translation not approved" marks).
- **Security:** short (reuses P6-6's reviewed path). **Size:** medium.

## P6-16 — Translation in the sync review

- **Exists when done:** opening the sync review after a master copy change starts one `sync` translation per language; the preview shows the proposed text or the failure with retry and type-by-hand; an accepted change writes `proposed`, source `ai`.
- **New files:** `src/main/translation/sync-result.ts` (`latestSyncTranslation`).
- **May touch:** Phase 5's `sync.preview` and `sync.apply` handlers and the sync review dialog, a few lines each, named in the report; `src/main/commands/translation/propose.ts` (the `sync` mode: no targets, no write).
- **Needs:** P6-6; Phase 5's `sync.preview`, `sync.apply` and sync review dialog merged.
- **Tests first:** `tests/integration/translation/sync-translation.test.ts`: the preview shows the fake text when the job matches the master's `revs.copy`; an older job is not used; a failed job gives `failed` and the layer keeps its text; apply writes `proposed`, source `ai`, `synced_revs.copy` set; a rejected change writes nothing.
- **Exit check:** class B, D; `npm run test:e2e`. **Shots:** `tests/shots/p6-16.shots.ts`, 213 (a proposed translation in the review), 214 (a failed one with "Try again").
- **Security:** short. **Size:** medium.

## P6-17 — Workflow 5.2, shots, live run, exit check

- **Exists when done:** the exit criteria of `spec/phases/phase-06.md` are met.
- **New files:** `tests/e2e/localize.spec.ts`; `tests/shots/p6-17.shots.ts`; `tests/live/gemini-translate.live.test.ts` (prints model ID, time and answer size, never the text; skips with one line naming the missing variable).
- **May touch:** the shot files of P6-12, P6-13 and P6-14 if their shots were handed on.
- **Needs:** every other P6 slice; Phase 5 merged.
- **Tests first:** `localize.spec.ts` with the fake provider: fan out a master to two sizes and `de` and `ja`; the grid shows "Translation not approved"; the fake is told to fail `ja` once, "Try again" succeeds; edit one `de` text; "Approve all" per language; export the sheet and read it back (BOM, rows); add `!` to the prohibited list, run checks, see the warning on the right variants, remove the `!` text, run again, all pass; every translation approved at the end.
- **Live run:** one `translate` call with two short items, `en` to `de`, under D-085, by the developer once; report as the exit criteria say.
- **Exit check:** the full list in the exit criteria. **Shots:** 215 (the grid after fan-out), 216 (a `ja` variant in the editor), 217 (checks across the grid with warnings), 218 (the sheet saved), 219 (all translations approved), plus any handed-on shots 205 to 210.
- **Security:** none (no new code beyond tests). **Size:** medium.

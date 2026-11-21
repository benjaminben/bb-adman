# Phase 5 — Variants, fan-out, links and sync

**Goal:** One master drives a grid of variants.
**Class:** A, B, D, E (per slice).

**Design:** `spec/links-and-sync.md` (follow rules, overrides, sync, fan-out, fill, directions, undo; every command and refusal), `spec/screens-variants.md` (the screens), with the base rules in `spec/data-rules.md`, "Links, follow rules and sync" and "Fan-out". Providers: `spec/providers-adapters.md`, "Picture extend"; `spec/comfyui-workflows.md`, "Extend a background".

**Slices:** the logic slices P5-1 to P5-13 are in `spec/phases/phase-05-slices.md`; the screen slices P5-14 to P5-18 and the exit slice P5-19 are in `spec/phases/phase-05-screens.md`.

## Exit criteria

1. Workflow 5.3 passes end to end with the fake provider (`tests/e2e/workflow-5-3.spec.ts`): a master edit marks linked variants "Out of date"; the sync review lists each, flags an overridden layer; "Accept selected" leaves the unticked ones out of date; "Accept all" clears the rest.
2. Workflow 5.4 passes end to end (`tests/e2e/workflow-5-4.spec.ts`): "New direction from this master…" makes a second grid; its background is changed; fan-out with one "Generate fill" size makes the variants and places the fill on that size.
3. The named test "editing a master changes no other variant's layer rows" passes.
4. On the campaign page, a variant deleted with "Delete {title}" comes back with the campaign's "Undo" (component test and in the 5.4 run).
5. Every Phase 5 command has a success test and its refusal tests; `generation.runFill` passes the agent-run gate tests (refused unticked, passes ticked, held at the limit).
6. Cmd-click (Ctrl-click on Windows) on a tile still opens the tab behind (built in P3-10; the 5.4 run clicks it once); quick look moves through the variants with Next and Previous.
7. At most one real Gemini `extend` run and at most one real ComfyUI extend run, both in P5-19, reported. Windows is the stakeholder's check (D-087).

## Dependencies

- Phase 4 merged. Phases 1 to 4 give everything P5-1, P5-2, P5-5, P5-6 and P5-7 need.
- AP-11 and AP-12 merged before P5-14 (they edit `campaign-view/`, `variant-tile/`, `variant-grid/`).
- SP-9 merged before P5-8 (both edit `src/shared/generation/prompt.ts`).
- SP-5 merged before P5-19 (SP-5 edits `tests/e2e/screens.ts` and most e2e and shots files).

## Rules for the slices

- Every rule of `spec/phases/README.md` and `spec/phases/DEV-RULES.md`. Failing tests first; table tests where cases are alike. Run what the slice's class asks (`spec/testing.md`); the full gate runs before release.
- **Contracts first.** P5-1 alone edits the shared files listed below and registers every Phase 5 command, query and the job kind against stubs. A later slice fills a stub it is named for, or adds new files, and touches an existing file only where its "May touch" line says.
- **No migration.** Phase 5 needs no schema change. No slice runs `npm run db:generate`. A developer who finds one is needed stops and reports.
- **No real run as routine.** The fake provider and the ComfyUI stand-in for every test. P5-19 alone makes at most one real Gemini `extend` run (smallest size) and at most one real ComfyUI extend run (lowest settings, only if a non-draft extend workflow exists by then).
- **Screens** (D-084): one folder per component, CSS from the tokens only. Each screen slice adds `tests/shots/p5-{n}.shots.ts` with the pictures it names, from 150 to 179.
- Files under 200 lines where they can be, 300 at most.
- Budget: one slice per developer run, well under 300k tokens; hand off with `HANDOFF.md` if near it. Sizes: small (under about 100k), medium (about 100k to 200k). No slice is planned large.

## Order and side-by-side work

| Wave | Slice | Size | Needs | May run beside | Must not run beside |
|------|-------|------|-------|----------------|---------------------|
| 1 | P5-1 Contracts and stubs | medium | Phase 4 | P5-2, P5-5, P5-6, P5-7; any AP or SP slice | Any slice editing `core.ts`, `agent-policy.ts`, `bus.ts`, `commands/types.ts`, `queries/queries.ts`, `jobs/kinds/index.ts` (none planned) |
| 1 | P5-2 Follow rules, out of date, the badge | medium | Phase 4 | P5-1, P5-5, P5-6, P5-7; AP and SP slices | — |
| 1 | P5-5 The fan-out plan (pure) | small | Phase 4 | P5-1, P5-2, P5-6, P5-7 | — |
| 1 | P5-6 Gemini picture extend | small | Phase 4 | every wave 1 slice | — |
| 1 | P5-7 ComfyUI extend in the adapter | small | Phase 4 | every wave 1 slice | — |
| 2 | P5-3 Overrides on edit, `layer.revert`, `layer.clearOverride` | medium | P5-1, P5-2 | P5-4, P5-8, P5-12 | — |
| 2 | P5-4 Snapshots, `variant.delete`, `remove`, `restore`, `restoreLayers` | medium | P5-1 | P5-3, P5-8, P5-12 | — |
| 2 | P5-8 `generation.runFill`, the fill job, the gate | medium | P5-1; SP-9 merged | P5-3, P5-4, P5-12 | SP-9 (`prompt.ts`) |
| 2 | P5-12 The sync plan and `sync.preview` | medium | P5-1, P5-2 | P5-3, P5-4, P5-8 | — |
| 3 | P5-9 `generation.applyFill` | small | P5-4, P5-8 | P5-10, P5-11, P5-13 | — |
| 3 | P5-10 `variant.fanOut` and `variant.add` | medium | P5-4, P5-5 | P5-9, P5-11, P5-13 | — |
| 3 | P5-11 Directions | small | P5-4 | P5-9, P5-10, P5-13 | — |
| 3 | P5-13 `sync.apply` | medium | P5-3, P5-4, P5-12 | P5-9, P5-10, P5-11 | — |
| 4 | P5-14 Campaign page: Undo, Redo, one grid per direction | medium | P5-1; AP-12 merged | wave 3 slices | AP-11, AP-12 (`campaign-view/`, `variant-grid/`) |
| 5 | P5-15 Tile actions: delete and quick look | medium | P5-4, P5-14 | P5-16, P5-17, P5-18 | — |
| 5 | P5-16 Fan-out dialog | medium | P5-9, P5-10, P5-14 | P5-15, P5-17, P5-18 | — |
| 5 | P5-17 Sync review dialog | medium | P5-13, P5-14 | P5-15, P5-16, P5-18 | — |
| 5 | P5-18 Direction menu and dialogs | small | P5-11, P5-14 | P5-15, P5-16, P5-17 | — |
| 6 | P5-19 Workflows 5.3 and 5.4, real runs, exit check | medium | every other P5 slice; SP-5 merged | — | any slice editing `tests/e2e/` helpers |

No two slices of one wave share a file. Wave 1: P5-1 owns the shared files and the stub files; P5-2 `src/shared/links/follow-rules.ts`, `out-of-date.ts`, `campaign-reads.ts`, `queries/variant.ts`; P5-5 `src/shared/links/fan-out-plan.ts`; P5-6 `src/main/providers/gemini/`; P5-7 `src/main/providers/comfyui/`. Wave 5: P5-15 `variant-grid/`, `direction-grids/`, `dialogs/quick-look/`; P5-16 `dialogs/fan-out/`, `stores/run-asks.ts`; P5-17 `dialogs/sync-review/`; P5-18 `dialogs/direction-menu/`.

## Can start now

Needs only Phases 1 to 4: **P5-1**, **P5-2**, **P5-5**, **P5-6**, **P5-7**. P5-8 also needs only P5-1 and SP-9's merge.

## Shared files

Existing files that more than one slice, or another phase, will edit.

| File | Phase 5 slice that edits it | Also edited by |
|------|-----------------------------|----------------|
| `src/main/core.ts`, `src/main/commands/agent-policy.ts`, `src/main/queries/queries.ts`, `src/main/jobs/kinds/index.ts` | P5-1 only | Phases 6 to 10 (their contracts slices) |
| `src/main/commands/bus.ts`, `src/main/commands/types.ts` (`clearScopes`) | P5-1 only | — |
| `tests/unit/main/commands/agent-policy-table.test.ts`, `tests/integration/registration*.test.ts` | P5-1 only | every contracts slice |
| `src/main/commands/agent-run-gate.ts` | P5-8 | Phase 6 if translation gets a tick; Phase 10 |
| `src/main/queries/campaign-reads.ts` (`badgesOf`) | P5-2 | Phase 6 (`checkWarning`, `checkStale`), Phase 7 (clips in `missingFile`) |
| `src/main/commands/layer/update.ts`, `update-many.ts`, `write-layer.ts` | P5-3 | Phase 6 (`translation.set` beside them) |
| `src/shared/generation/prompt.ts` | P5-8 (`FILL_PROMPT`) | SP-9 |
| `src/main/queries/earlier-options.ts` | P5-8 (one kind) | — |
| `src/main/providers/gemini/image.ts`, `prompts.ts` | P5-6 | Phase 6 uses `text.ts` only |
| `src/main/providers/comfyui/image.ts` | P5-7 | Phase 7 (video) does not |
| `src/renderer/screens/campaign/campaign-view/campaign-view.tsx` | P5-14 | AP-11, AP-12; Phase 6 (check results), Phase 8 (export) |
| `src/renderer/screens/campaign/variant-grid/variant-grid.tsx` | P5-15 | AP-12 |
| `src/renderer/screens/campaign/direction-grids/` (new in P5-14) | P5-14, P5-15 | Phase 6 (direction-level actions), Phase 8 |
| `src/renderer/stores/run-asks.ts` | P5-16 | — |
| `src/shared/schemas/commands/variant.ts` | P5-1 | Phase 7 (`variant.setFormat`, `formats: 'video'`) |

## What later phases need from Phase 5

- **Phase 6** (translations, checks): `followRule` and `variantOutOfDate` (`src/shared/links/`); `sync.preview`'s `proposedTranslation` and the "translated copy" stand-in in `syncWritesOf`, to be replaced by the translation job; fan-out step 6 in `planVariant` (text kept, `translation_status = 'missing'`); `badgesOf` taking the master; `variant.restoreLayers` as an undo inverse for `translation.approve`; `HandlerResult.clearScopes`; the per-direction grid (`direction-grids/`, `direction-header/`) for check actions.
- **Phase 7** (video): `variant.fanOut`'s `formats` schema to widen to `'video'`; `planVariant` gains step 7 (one clip); `VariantSnapshot.clips` already carried by `variant.restore`, `direction.restore`; the quick look dialog to play a video variant.
- **Phase 8** (export): `direction` rows and `direction-order.ts` for the order of deliverables; `generative_fill` job rows (paid count, report).
- **Phase 10** (MCP): tools for `variant.add` (allow), `variant.delete` (ask), `generation.runFill` (tick, gate built), `sync.preview` (read); `direction.*` and `sync.apply` stay denied.

## Left for later

- **CU-8, the ComfyUI part of the hand-test screen.** OI-64 is open with the assumption that it is dropped (`spec/assumptions.md`). Not in the waves. `dev.comfyExtend` is not built: `generation.runFill` replaces it.
- A control in the editor for `layer.clearOverride` ("Use the master's value"); the command is built in P5-3.
- A drawn "after" picture in the sync review (A-138).
- Fan-out to video (Phase 7) and translations (Phase 6).

## Assumptions made for Phase 5

Kept here because `spec/assumptions.md` is near its size limit; it points here. "Change later" as there.

- **A-128. Gemini extend has no canvas.** The picture goes as it is, with the target's nearest aspect ratio and an instruction to extend outward; the app draws no canvas. The result fills the variant. *P5-6. Change later: easy.*
- **A-129. The window starts the fills.** `variant.fanOut` writes data only; the dialog then sends one `generation.runFill` per fill size, so the key, paid-count and agent rules stay on the run command. *P5-10, P5-16. Change later: easy.*
- **A-130. One fill serves one size.** `generation.applyFill` places the picture on every same-size variant of the direction whose background still names the source, so other languages cost no extra call. *P5-9. Change later: easy.*
- **A-131. Fill stays attached** [D-036]. Owner: the fill's variant; the finish sends `generation.applyFill`. An agent's fill is placed by the agent. *P5-8, P5-16. Change later: easy.*
- **A-132. When a fill is refused:** no picture, turned, cropped, or already covering the canvas. *P5-8. Change later: easy.*
- **A-133. Fan-out makes images only in Phase 5.** *P5-10. Change later: easy (Phase 7 widens the schema).*
- **A-134. Languages before Phase 6.** New language variants keep the master's text marked `missing`; a synced copy change keeps the text and marks it `missing`. *P5-5, P5-12, P5-13. Change later: Phase 6 replaces it.*
- **A-135. Which edits make an override:** only paths that follow for that variant; copy in another language and geometry at another size make none. *P5-3. Change later: easy.*
- **A-136. Undo of an override** goes through the system command `layer.revert`, so the list comes back too. *P5-3. Change later: some rework.*
- **A-137. Sync works from the database.** `sync.apply` takes choices only, works out the values itself, and refuses with `master_changed` when the master moved on. *P5-13. Change later: easy.*
- **A-138. The sync review is a list of changes,** with the new text, not a drawn "after" picture. Changes start unticked. *P5-17. Change later: some rework.*
- **A-139. Directions:** names 1 to 100 characters, unique in the campaign ignoring case; the new master keeps the layer keys and is not linked. *P5-11. Change later: easy.*
- **A-140. Deleting** a variant or direction is refused while its work runs; a tile's delete has no confirmation because Undo is beside it; a direction's delete asks. *P5-4, P5-11, P5-15. Change later: easy.*
- **A-141. Campaign entries hold snapshots in memory,** and a campaign command that changes a variant clears that variant's own list (`clearScopes`). *P5-1, P5-4. Change later: some rework.*
- **A-142. Quick look** draws with `variant.render` at 1,024 px and moves through the whole campaign in grid order. *P5-15. Change later: easy.*
- **A-143. `variant.add`** takes `fit` `scale` (default) or `crop`, never fill. *P5-10. Change later: easy.*
- **A-144. Grid order in a direction:** master, then the campaign's size order, language order, image before video, then creation. *P5-14. Change later: easy.*
- **A-145. One fan-out dialog** with one background group per new size, for FR-076's "a dialog for each new ratio". *P5-16. Change later: easy.*
- **A-146. The fill prompt** is one fixed sentence (`FILL_PROMPT`), with the "keep printing" ending. *P5-8. Change later: easy.*
- **A-147. Same pixels, other label.** A campaign size with the master's pixel size but another label follows geometry and gets no fit choice. *P5-5. Change later: easy.*
- **A-148. A layer added by sync** goes on top of the variant's stack. *P5-13. Change later: easy.*
- **A-149. Stub refusal.** Until its slice lands, a stub command refuses with `RULE_VIOLATION`, `not_built`, "This is not built yet."; the reason is removed when the last stub is filled. *P5-1. Change later: easy.*

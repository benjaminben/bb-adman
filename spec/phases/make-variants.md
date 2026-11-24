# Make variants: slices MV-1 to MV-9

The design is `spec/make-variants.md` [D-108]; read the parts each slice names. Every slice writes its tests first, runs the targeted tests and the type check for its own files only (`spec/testing.md`, verification classes), and stays well under 300k tokens. End-to-end tests are run by the orchestrator once per merged wave, not by the builder. No slice adds an entry into the main process for tests. When a slice is merged, its part of `spec/make-variants.md` (and the pointer in the file it names) changes from "Not built" to "Built".

## Order

At most two developers at once. The two slices of a wave share no file, test files included.

| Wave | Slices | Needs merged first |
|------|--------|--------------------|
| 1 | MV-1, MV-2 | nothing |
| 2 | MV-3, MV-6 | MV-2 (MV-3); MV-1 and MV-2 (MV-6) |
| 3 | MV-4, MV-5 | MV-3 (MV-4); MV-2 (MV-5) |
| 4 | MV-7, MV-8 | MV-4 (MV-7); MV-4 and the quickstart's QS-2 (MV-8) |
| 5 | MV-9 | all of the above |

**Known gap until MV-7 merges.** From MV-6 on, the tile's "Make variants from this one…" sends `sourceVariantId`, which the command reads only from MV-7. In between, the new variants start from the master. Nothing is lost or paid twice, but do not release between MV-6 and MV-7.

## MV-1 — The name (classes D and B; E for the refusal words)

- **Files:** `src/renderer/dialogs/fan-out/fan-out-button.tsx` (button words), `src/renderer/dialogs/fan-out/fan-out-dialog.tsx` (the title only), `src/main/commands/variant/fan-out.ts` (the `too_many_variants` message only), `src/main/commands/agent-policy.ts` (the action text of `variant.fanOut` only). First grep `src/renderer`, `src/main`, `src/shared` and `README.md` for "fan out", "Fan out" and "fan-out" in words a person or agent reads; change any new place found the same way and list it in the report. Code names, file names, comments and the command name stay.
- **Read:** `spec/make-variants.md`, "Names"; `spec/screens-variants.md`, "Make variants".
- **Tests first** (update the existing ones that hold the old words):
  - `tests/unit/renderer/dialogs/fan-out-dialog.test.tsx`, `fan-out-paid.test.tsx`, `fan-out-formats.test.tsx`, `fan-out-translation.test.tsx`: the button is named "Make variants…"; the dialog is named "Make variants of {direction}".
  - `tests/unit/renderer/screens/campaign/tile-more.test.tsx`: any old word it holds.
  - `tests/integration/links/fan-out.test.ts`: the 201st variant gives "You can make at most 200 variants at a time." (change only that assertion).
  - `tests/unit/main/commands/agent-policy-table.test.ts`: the row reads "make many variants at once"; a denial test gives "Agents cannot make many variants at once in this version. Ask the user to do it in the app."
  - The end-to-end helpers and shots that find the button or dialog by name: `tests/e2e/variants-steps.ts` (`fanOut`), `tests/e2e/workflow-5-4.spec.ts`, `tests/e2e/localize-steps.ts` (comment), `tests/shots/dw-dlg-4b.shots.ts`. Change the names they look for; the helper keeps its code name `fanOut`.
- **Must not touch:** `src/shared/`, `fan-out-model.ts`, `fan-out-chips.tsx`, any other line of `fan-out.ts`, any other row of the policy table.

## MV-2 — The pure helpers (class A)

New files only, plus one schema field. Nothing calls them yet.

- **Files:** new `src/shared/links/place-box.ts` (`anchoredBox`), new `src/shared/links/source-layout.ts` (`layoutOfLayers`, `sitsAsLaidOut`, `layoutBoxOf`), new `src/shared/links/fit-text.ts` (`scaleTextMeasures`, `fittedFontSize`, `fitTranslatedText`, `measureOverrides`); `src/shared/schemas/commands/variant.ts` (`sourceVariantId: z.string().min(1).optional()` on `variantFanOutInput`).
- **Read:** `spec/make-variants.md`, "Where a box goes in a new size", "Which layout", "Anchoring", "Text that fits", "What a fitted size is to the link"; `spec/starter-layouts.md`, "Rules shared by every layout" and "The starting font size".
- **Tests first:**
  - `tests/unit/shared/links/place-box.test.ts`: the worked values table (three sizes, three boxes); a centred picture stays centred; a picture never stretches; a text box with one gap larger than its length does not stretch; a 1500-wide picture inside a 1920 × 1080 canvas is cut to 1080 and moved inside at 1080 × 1920; a box running past the bottom keeps running past it; rotation and `crop` kept; no length below 1.
  - `tests/unit/shared/links/source-layout.test.ts`: a master built with each of the five layouts (`buildMasterLayers`) at 1080 × 1080 and 1080 × 1920 gives that layout; with the logo moved by 1 pixel it still gives that layout, and `sitsAsLaidOut` is false for the logo only; a rotated box does not count; the background never counts; a text layer on a picture slot does not count; no match gives null; a tie goes to `preferredId`, else to `STARTER_LAYOUTS` order; `layoutBoxOf` equals `geometryOf(slot.box, frameOf(size))` and is null for a key the layout does not name.
  - `tests/unit/shared/links/fit-text.test.ts`: at 1080 × 1080 with the headline style of layout 1 at 81 and its box 950 × 238, words of 60 and 120 letters give 71 and 47 (the worked values of `spec/starter-layouts.md`); the same words in a box not tighter keep the size; never larger than the start; nothing fits gives `max(1, round(0.02 × S))` but never more than the start; `scaleTextMeasures` at `k` = 250/1080 turns 81, 16, 0, 3 into 19, 4, 0, 1 and at `k` = 1 changes nothing; look fields stay inside `LOOK_LIMITS`; `fitTranslatedText` shrinks for longer words, gives null for shorter ones; `measureOverrides` adds a path only for a linked layer whose master value differs, keeps the paths already there first, adds each once.
  - The schema test (`tests/unit/shared/schemas/phase5-schemas.test.ts`): `sourceVariantId` optional; an empty string refused.
- **Must not touch:** `fan-out-plan.ts`, `sync-plan.ts`, `starting-font-size.ts`, `layout-rules.ts`, `starter-layouts.ts`, anything under `src/main/` and `src/renderer/`.

## MV-3 — The placement in `planVariant` (class A, with the integration tests it changes)

- **Files:** `src/shared/links/fan-out-plan.ts` (geometry by "Where a box goes": same size, background, layout box, anchored; the old centre-share `placeBox` removed; `PlanInput` gains `layoutId?: string | null`, default the default layout's ID).
- **Read:** `spec/make-variants.md`, "Where a box goes in a new size"; `spec/links-and-sync.md`, "Fan-out".
- **Tests first:**
  - `tests/unit/shared/links/fan-out-plan.test.ts`: a `photo-bottom-left` master at 1080 × 1080 planned to 1920 × 1080 has logo, headline and button at x = 65, each equal to the layout's box at that size; to 1080 × 1920 likewise; the logo moved to (80, 80) is anchored there while the others follow the layout; a master with no layout box gives the worked values; the same pixel size keeps geometry; the background is as before; a new size in a new language still copies the same-size plan (R-02).
  - `tests/unit/shared/links/sync-plan.test.ts`: an added layer at another size gets the new placement (update the old expectation).
  - Update the geometry expectations that the new rule changes in `tests/integration/links/fan-out.test.ts`, `variant-add.test.ts`, and any other test under `tests/integration/` that fails for that reason only. Change no expectation for any other reason; list each changed file in the report.
- **Must not touch:** anything under `src/main/` and `src/renderer/`; `place-box.ts`, `source-layout.ts`, `fit-text.ts` (use them as MV-2 left them; a bug found there is reported, not fixed here).

## MV-4 — The new variant's values and its text (class A)

- **Files:** `src/shared/links/fan-out-plan.ts` (`PlanInput` gains `source?: { facts, layers }`; values, counters and override paths by the table of "Links after making"; unlinked layers; `name`, `z`, `visible`, `locked` from the source); new `src/shared/links/new-variant-plan.ts` (`planNewVariant`: `planVariant`, then `translatedLayers`, then `scaleTextMeasures`, `fittedFontSize` and `measureOverrides` for each text layer whose pixel size or language differs from the source's).
- **Read:** `spec/make-variants.md`, "Text that fits", "Links after making", "Making variants from a variant" (the R-02 line).
- **Tests first:**
  - `tests/unit/shared/links/new-variant-plan.test.ts`: from the master in its language at 1920 × 1080, no override is added and sizes stay; a `de` variant at 1080 × 1080 with brief words of 120 letters gets 47 and `style.fontSize` in `overrides`; at 300 × 250 the measures are scaled and each one that differs is an override path; the rest of the style equals the master's; a new size and language take the same-size plan's boxes and fit their own words.
  - `tests/unit/shared/links/fan-out-plan-source.test.ts`: one case per row of the "Links after making" table; a source's stale group stays stale and `variantOutOfDate` of the planned layers equals the source's for groups that still follow; a `geometry` path dropped at another size and a `copy` path dropped in another language; an unlinked layer copied with `linked = 0` and, in another language, status `missing` with its words kept; a hidden and a locked layer stay so; a master layer the source lacks is not added; with no `source` the result equals the master-only plan.
- **Must not touch:** `place-box.ts`, `source-layout.ts`, `fit-text.ts`, `translated-layers.ts`, anything under `src/main/` and `src/renderer/`. In `sync-plan.ts`, only `planAdd`'s `layoutLayers` (tested in `sync-plan-layout.test.ts`).
- **As built:** `NewVariantInput = PlanInput & { campaign: Pick<CampaignRow, 'primaryLanguage' | 'brief'> }`. Only a missing `source` means the master: the master's layers are not linked, so a caller must leave `source` out when the source is the master. The brief's copy is applied only when the target's language differs from the source's, and only to linked layers.

## MV-5 — The fit when a translation arrives (class B)

- **Files:** new `src/main/translation/fit-written.ts` (for the layers `translation.write` writes: those whose status was `missing`, not on the master, through `fitTranslatedText`; writes `style`, `revs.style + 1` and the override path in the same transaction); `src/main/commands/translation/write.ts` (calls it).
- **Read:** `spec/make-variants.md`, "When a translation arrives", "What a fitted size is to the link"; `spec/phases/phase-06.md`, "`translation.write`".
- **Tests first:** `tests/integration/translation/translation-write-fit.test.ts`: a `missing` headline filled with long words shrinks to the estimate and gains `style.fontSize`; short words leave style and `revs.style` as they were; a `proposed` layer written again is not fitted; an unlinked layer shrinks with no path added; the reply's `written` count and the one `variant.rev` bump per variant are unchanged; `translation.set` by the user and by an agent fits nothing (existing tests stay green).
- **Must not touch:** `write-text.ts` (it is shared with set, approve and restore), `src/shared/`, `src/renderer/`, the job kind.

## MV-6 — The dialog from a tile, and its words (class D)

- **Files:** `src/renderer/dialogs/fan-out/fan-out-model.ts` (`FanOutBasis` gains `primaryLanguage`; `translationCount` leaves out the main and the source's language; new `existingCount`, the chosen cells that exist, the source's own left out), `fan-out-dialog.tsx` (optional `source` prop: title, first line, `sourceVariantId` in the input, the existing line), `fan-out-chips.tsx` (only if it reads the master directly), `fan-out-button.tsx` (passes `primaryLanguage`), new `make-from-variant.tsx` (builds the basis from one variant and opens the dialog; the master's tile opens the header's dialog), `index.ts`; `src/renderer/screens/campaign/variant-grid/tile-actions.tsx` (the item, before "Delete…"), `variant-grid.tsx` and `src/renderer/screens/campaign/direction-grids/direction-grids.tsx` (pass `onMakeFrom` and hold the open dialog, as they do for delete).
- **Read:** `spec/screens-variants.md`, "The variant tile" and "Make variants"; `spec/make-variants.md`, "Making variants from a variant"; `spec/app-style-parts.md`, "Menu" and "Dialog".
- **Tests first:**
  - `tests/unit/renderer/dialogs/fan-out-model.test.ts`: `translationCount` with a `de` source and `en`, `de`, `ja` ticked is 1; `existingCount` leaves out the source's own cell; fills counted in the source's language.
  - `tests/unit/renderer/screens/campaign/tile-more.test.tsx`: "Make variants from this one…" on every tile, the master's included, before "Delete…"; choosing it calls `onMakeFrom` with the variant ID and sends nothing.
  - New `tests/unit/renderer/dialogs/make-from-variant.test.tsx`: the title "Make variants from {title} · {sizeLabel} · {language}" and the first line; the source's size and language chips pressed and disabled; the source's format on at the start; fit groups for sizes whose pixel size differs from the source's, none when the source has no background picture; nothing sent before the click; the click sends `variant.fanOut` with `sourceVariantId` and fits for exactly those sizes; the master's tile sends no `sourceVariantId`; the existing line in its two forms; the cost lines follow the counts; the dialog passes the accessibility check the other dialogs use.
- **Must not touch:** `fan-out-costs.ts`, `cost-line.tsx`, `use-start-fills.ts`, `src/main/`, `src/shared/`.

## MV-7 — The command (class B; E for the tool description)

- **Files:** `src/main/commands/variant/fan-out.ts` (`sourceVariantId`, the grid from the source's size and language, fits against the source, `planNewVariant`, `layoutId` from `campaign.brief.layout`), `src/main/commands/variant/add.ts` (`planNewVariant`, from the master, with `layoutId`), `src/main/links/fan-out-write.ts` (`readFanOutSource` with the source; `writeVariant` takes title, duration, subjects and sound from it), new `src/main/links/copy-clips.ts`, `src/main/translation/fan-out.ts` (no run for the source's language), `src/main/mcp/tools/variant-edit-tools.ts` (the `add_variant` sentence) and the MCP tool list snapshot.
- **Read:** `spec/make-variants.md`, "Making variants from a variant", "Links after making", "Agents", "Security"; `spec/links-and-sync.md`, "Fan-out".
- **Tests first:**
  - New `tests/integration/links/fan-out-source.test.ts`: a variant of another direction and an ID from another open project are each `NOT_FOUND` with nothing written; the source's size and language always in the grid; `fits` judged against the source; an existing cell skipped and unchanged; the new layers match "Links after making"; title, subjects and duration from the source; the inverse removes them; an agent is denied before any read.
  - `tests/integration/links/fan-out.test.ts` and `variant-add.test.ts`: text fitted and override paths as designed; `layoutId` from the brief breaks a tie.
  - `tests/integration/commands/fan-out-video.test.ts`: a video source's clips and sound copied to a new video variant (the master's too), `placement` kept at the same pixel size and null at another, `first_clip_made` 1; an image source and a video source with no clip get the first clip as before; a new image variant gets no clip; undo and redo bring the clips back.
  - `tests/integration/translation/fan-out-translation.test.ts`: from a `de` source with `de` and `ja` chosen, one run (for `ja`) and the `de` words copied.
  - The tool list snapshot: only `add_variant`'s description changes.
- **Must not touch:** `src/shared/links/`, `src/renderer/`, `agent-policy.ts`, `src/main/commands/translation/`.

## MV-8 — The quickstart uses the app's rule (class A)

Wait for the quickstart's QS-2 work to be merged; it is being edited now.

- **Files:** `quickstart/layers.ts` and the quickstart file that runs step 2.6 (find the `starterLayoutPatches` call under `quickstart/`); `spec/quickstart.md` (steps 2.3, 2.4 and 2.6, "What it reuses").
- **Read:** `spec/make-variants.md`, "Quickstart"; `spec/quickstart.md`, "Steps".
- **Tests first:** `tests/unit/quickstart/layers.test.ts`: the planned layers equal `planNewVariant`'s for the same input; for the `summer-splash` brief at 16:9, logo, headline and button start at the layout's margin; a translated text longer than the brief's is fitted by `fitTranslatedText`; with `--ai_layout` the moved boxes are anchored. Remove the tests of the dropped step.
- **Must not touch:** `src/`.

## MV-9 — End to end and close-out (class D; the orchestrator runs it)

- **Files:** new `tests/e2e/make-variants.spec.ts`; `tests/e2e/variants-steps.ts` (a `makeVariantsFrom(page, tile, ask)` helper); the "Not built" marks in `spec/make-variants.md`, `spec/links-and-sync.md`, `spec/data-rules.md`, `spec/screens-variants.md`, `spec/mcp-and-agents.md`, `spec/api-commands.md`, `spec/starter-layouts.md`.
- **Tests first:** with the fake providers: a campaign from a brief with layout `photo-bottom-left`; "Make variants…" to 16:9 and `de`; the 16:9 variant's logo, headline and button share one left edge (read with `variant.get` through the window's own API, as the shots do); the `de` 1:1 headline is no larger than the master's; "Make variants from this one…" on the `de` 1:1 tile to 9:16 makes a `de` 9:16 with the `de` words and starts no translation run; Undo removes it.
- **Must not touch:** anything under `src/`.

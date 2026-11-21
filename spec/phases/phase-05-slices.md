# Phase 5 — logic slices P5-1 to P5-13

The index, the wave table, the shared files and the assumptions are in `spec/phases/phase-05.md`. Every slice reads `spec/phases/DEV-RULES.md` first, then the sections of `spec/links-and-sync.md` it names. Test paths below are new files unless marked "approved edit".

### P5-1 — Contracts and stubs

- **Size:** medium. **Needs:** Phase 4 merged.
- **Exists when done:** every Phase 5 command, query and the `generative_fill` job kind is registered, with its schema, policy row and stub. A stub command refuses in `run` (or `prepare`, for those that will have one) with `RULE_VIOLATION`, `not_built`, "This is not built yet." (A-149). The stub `sync.preview` refuses the same way. The stub job kind fails its job with `ProviderFailure` `other`, "Generative fill is not built yet". `HandlerResult` has `clearScopes?: UndoScope[]` and the bus clears each named scope after a successful run (and after a successful replay).
- **New files:** `src/shared/schemas/commands/direction.ts`, `src/shared/schemas/commands/sync.ts`, `src/shared/schemas/queries/sync.ts` (`SyncPreviewReply`), `src/shared/schemas/links.ts` (`VariantSnapshot`, `SyncDecision`, `LayerValues`, `FanOutFit`), `src/shared/schemas/jobs/generative-fill.ts`. Stubs, each filled by the slice named: `src/main/commands/direction/` (`index.ts`, `create-from-master.ts`, `rename.ts`, `delete.ts`, `restore.ts`: P5-11); `src/main/commands/variant/` `delete.ts`, `remove.ts`, `restore.ts`, `restore-layers.ts` (P5-4), `fan-out.ts`, `add.ts` (P5-10); `src/main/commands/layer/clear-override.ts`, `revert.ts` (P5-3); `src/main/commands/sync/index.ts`, `apply.ts` (P5-13); `src/main/commands/generation/run-fill.ts` (P5-8), `apply-fill.ts` (P5-9); `src/main/queries/sync.ts` (P5-12); `src/main/jobs/kinds/generative-fill.ts` (P5-8).
- **Schemas** (strict, extending `projectScoped`; inputs exactly as `spec/links-and-sync.md` gives them): `direction.createFromMaster`, `direction.rename`, `direction.delete`, `direction.restore`; `variant.fanOut` (`formats` `z.array(z.literal('image')).min(1)`), `variant.add`, `variant.delete`, `variant.remove`, `variant.restore`, `variant.restoreLayers`; `layer.clearOverride`, `layer.revert`; `sync.apply`; `generation.runFill`, `generation.applyFill`; query `sync.preview`; the fill job's request and result. A name is `z.string().trim().min(1).max(100)`.
- **May touch:** `src/shared/schemas/commands/variant.ts`, `layer.ts`, `generation.ts` (additions only); `src/main/commands/agent-policy.ts` (new rows: `direction.restore`, `variant.remove`, `variant.restore`, `variant.restoreLayers`, `layer.revert` as `deny (system)`; `generation.applyFill` `deny('place fills')`; the existing rows stay); `src/main/commands/bus.ts`, `src/main/commands/types.ts` (`clearScopes`); `src/main/commands/variant/index.ts`, `src/main/commands/layer/index.ts`, `src/main/commands/generation/index.ts` (one line per stub); `src/main/core.ts` (the `direction` and `sync` spread lines); `src/main/queries/queries.ts`; `src/main/jobs/kinds/index.ts`; any file whose exhaustive table over a command or query name union stops compiling (one line each, named in the report).
- **Tests first:**
  - `tests/unit/shared/schemas/phase5-schemas.test.ts`, one table: for each input, one good value, and each of: a missing field, an unknown key, an empty name, a name of 101 characters, `formats: ['video']`, `fits` with a value outside the three, `variants` of 501 entries, `decisions` of 2,001.
  - `tests/integration/commands/phase5-stubs.test.ts`: each stub command as the user gives `not_built` and writes nothing; `sync.preview` the same; as the agent, every `deny` and `system` row gives `AGENT_DENIED`, `variant.add` reaches the stub, `variant.delete` goes to ask, `generation.runFill` is refused by the gate (P5-8 opens it).
  - `tests/integration/commands/clear-scopes.test.ts`: a test-only command that records a variant entry and returns `clearScopes: ['variant:{id}']` leaves that list empty, and a refused command clears nothing.
- **Approved edits to existing tests:** `tests/unit/main/commands/agent-policy-table.test.ts` (the six new rows); `tests/integration/registration*.test.ts` and `tests/integration/assets/core-registration.test.ts` (the new names, and `Object.keys` of the new domains); `tests/integration/commands/bus-fail-closed.test.ts` only if it lists command names.
- **Exit check:** lint, typecheck, the tests above, `tests/integration/commands/history.test.ts`, the registration tests.
- **Class:** B + A. **Security class, short review:** the policy rows (every system command denied and `internal: true`), the bus change clears only scopes in the command's own project.
- **After:** nothing.

### P5-2 — Follow rules, out of date, the badge

- **Size:** medium. **Needs:** Phase 4 merged (no Phase 5 slice).
- **Read:** `spec/links-and-sync.md`, "Follow rules"; `spec/data-rules.md`, "Links, follow rules and sync".
- **Exists when done:** `follow-rules.ts` and `out-of-date.ts` as the design says; `badgesOf` takes the direction's master (row and layers) and sets `outOfDate`; `campaign.get` reads each direction's master once; `variant.get` gives the same badge. The tile mark "Out of date" and the tab's "needs attention" mark show without any screen change.
- **New files:** `src/shared/links/follow-rules.ts`, `src/shared/links/out-of-date.ts`, `src/main/links/master-of.ts`.
- **May touch:** `src/main/queries/campaign-reads.ts`, `src/main/queries/campaign.ts`, `src/main/queries/variant.ts`, `src/main/queries/variant-reads.ts`.
- **Tests first:**
  - `tests/unit/shared/links/follow-rules.test.ts`, one table over group × (same size, same ratio other pixels, other ratio) × (same language, other language): the word for each of the 36 cells. `isInherited` for each path form (`copy`, `geometry`, `style.color`, `animation.exit`).
  - `tests/unit/shared/links/out-of-date.test.ts`, one table: nothing changed; master `style` one ahead (out of date at any size); master `geometry` ahead at the same size (yes) and another size (no); `copy` ahead in another language (yes, translation); an unlinked layer far behind (no); a master key the variant lacks (yes); a linked variant key gone from the master (yes); an unlinked variant key not in the master (no); the master itself (never).
  - `tests/integration/campaigns/campaign-get-out-of-date.test.ts`: rows written by hand (no Phase 5 command needed): a master and two linked variants, one behind on `style`; `campaign.get` marks only that one; `variant.get` agrees; the master reads once per direction (a count of the reads through a spy on `masterOf`).
- **Approved edits to existing tests:** `tests/integration/campaigns/campaign-get.test.ts`, `tests/integration/queries/variant-get.test.ts` only where a call to `badgesOf` in a helper gains the master argument.
- **Exit check:** lint, typecheck, `tests/unit/shared/links/`, the campaign and variant query tests.
- **Class:** A + B. No security review (reads only).
- **After:** nothing.

### P5-3 — Overrides on edit, `layer.revert`, `layer.clearOverride`

- **Size:** medium. **Needs:** P5-1, P5-2.
- **Read:** `spec/links-and-sync.md`, "Overrides"; `spec/editor-commands.md`, the layer counters and inverses.
- **Exists when done:** `layer.update` and `layer.updateMany` add override paths as the design says; their inverse is `layer.revert` when a list changed and as built otherwise; `layer.revert` and `layer.clearOverride` work. The named test passes.
- **New files:** `src/shared/links/override-paths.ts`; `tests/integration/links/master-edit.test.ts` (the named test); a fixture helper `tests/integration/links/linked-fixture.ts` that writes a master and linked variants by hand (used by later slices too).
- **May touch:** `src/main/commands/layer/update.ts`, `update-many.ts`, `write-layer.ts`, `inverse-patch.ts`; the stubs `clear-override.ts`, `revert.ts`.
- **Tests first:**
  - `tests/unit/shared/links/override-paths.test.ts`: `pathsOfPatch` for a copy, a source, a whole geometry, two style fields, one animation block, a name-only patch (none); `inheritedPaths` drops `geometry` at another size and `copy` in another language.
  - `tests/integration/links/overrides.test.ts`, one table of edits on a linked layer: style colour at another size gives `['style.color']`; geometry at another size gives none; geometry at the same size gives `['geometry']`; copy in the same language gives `['copy']`, in another gives none; a second colour edit keeps one path; the same edit on the master, and on an unlinked layer, gives none. Undo of each brings back the value and the list; redo puts them back. `layer.updateMany` over two linked layers: one `layer.revert` entry.
  - `tests/integration/links/clear-override.test.ts`: removes `style.color` and writes the master's colour, the other style fields untouched; a path not held changes nothing and adds no entry; an unlinked layer and a master give `not_linked`; agent `AGENT_DENIED`; undo restores both.
  - The named test as `spec/links-and-sync.md` says.
- **Approved edits to existing tests:** none expected. Existing layer tests run on masters, whose inverses stay `layer.update`.
- **Exit check:** lint, typecheck, `tests/unit/shared/links/`, `tests/integration/links/`, `tests/integration/commands/layer-*.test.ts`.
- **Class:** A + B. No security review (no new path or agent reach; `layer.revert` is internal).
- **After:** P5-1, P5-2.

### P5-4 — Snapshots, `variant.delete`, `variant.remove`, `variant.restore`, `variant.restoreLayers`

- **Size:** medium. **Needs:** P5-1.
- **Read:** `spec/links-and-sync.md`, "Adding back and removing variants", "The campaign undo list".
- **Exists when done:** the four commands work as designed, with their inverses, refusals and `clearScopes`; `snapshot.ts` is the one place that reads or writes a whole variant.
- **New files:** `src/main/links/snapshot.ts`.
- **May touch:** the stubs `variant/delete.ts`, `remove.ts`, `restore.ts`, `restore-layers.ts`.
- **Tests first:**
  - `tests/integration/links/snapshot.test.ts`: read then delete then write gives rows equal column by column (variant, subjects, layers, clips).
  - `tests/integration/links/variant-delete.test.ts`: delete, undo (the variant is back with its layers and `rev`), redo (gone again); the variant's own list is cleared on delete; a master gives `master_variant`; a queued job gives `jobs_running` with nothing written; the agent goes to ask; an unknown ID `NOT_FOUND`; ended job rows stay.
  - `tests/integration/links/variant-restore.test.ts`, refusals table: an ID in use, a layer ID in use, the grid place taken, the direction gone, an asset removed; each writes nothing.
  - `tests/integration/links/restore-layers.test.ts`: deletes an extra layer, inserts a missing one, rewrites a changed one; one `rev` bump per variant; a master is refused; its inverse brings the earlier set back; 501 variants refused by the schema.
- **Approved edits to existing tests:** none.
- **Exit check:** lint, typecheck, `tests/integration/links/`, `tests/integration/commands/history.test.ts`.
- **Class:** B. **Security class, short review:** a destructive command (`variant.delete`) keeps the agent's ask; the system commands are internal; a snapshot is taken from and written to the command's own project only.
- **After:** P5-1.

### P5-5 — The fan-out plan (pure)

- **Size:** small. **Needs:** Phase 4 merged.
- **Read:** `spec/links-and-sync.md`, "Fan-out"; `spec/data-rules.md`, "Fan-out".
- **Exists when done:** `planVariant({ master, masterLayers, target, fit, pictureSize, sameSizePlan })` gives the new variant's layer values: geometry by the rules, the background by `scale` or `crop`, copy and translation fields for a new language, `linked`, `overrides`, `synced_revs`. No IDs are made here; the caller adds them.
- **New files:** `src/shared/links/fan-out-plan.ts`.
- **Tests first:** `tests/unit/shared/links/fan-out-plan.test.ts`, tables: 1080×1080 to 1080×1920 and to 1920×1080 for a centred box and a corner box (centre share kept, scaled by the smaller ratio, whole pixels, at least 1); `scale` and `crop` of a 1600×900 picture on each; a null picture or unknown size gives the whole canvas; rotation kept; same pixels with another label keeps the master's geometry (A-147); another language at the master's size keeps geometry, text kept with `missing`; another size and language takes geometry from `sameSizePlan` (R-02); `synced_revs` equals the master's `revs`; the input is not changed.
- **Approved edits to existing tests:** none.
- **Exit check:** lint, typecheck, `tests/unit/shared/links/fan-out-plan.test.ts`.
- **Class:** A. No security review.
- **After:** nothing.

### P5-6 — Gemini picture extend

- **Size:** small. **Needs:** Phase 4 merged.
- **Read:** `spec/providers-adapters.md`, "Picture extend" and "Picture generation".
- **Exists when done:** `gemini/image.ts` `extend` sends one call as the design says and returns one picture, with the same answer, size and error rules as `generate`.
- **May touch:** `src/main/providers/gemini/image.ts`, `prompts.ts`.
- **Tests first:** `tests/unit/main/providers/gemini/extend.test.ts` with the recorded transport: `parts` is the prompt then one `inlineData` PNG part; `aspectRatio` is the nearest to the target (1080×1920 gives `9:16`); a good answer gives the picture; the signal fires before the call (`ProviderCancelled`); no picture in the answer (`other`); a 429 (`quota`); the timeout (`timeout`). One recorded-answer case per kind where `errors.test.ts` does not already cover the shared path.
- **Live:** `tests/live/gemini-extend.live.test.ts`, written but not run here (P5-19 runs it once).
- **Approved edits to existing tests:** a test that expects `extend` to throw "not built yet", if one exists.
- **Exit check:** lint, typecheck, `tests/unit/main/providers/gemini/`.
- **Class:** E. **Security class, full review:** a new network call (through the pinned client only, key redacted, no redirect).
- **After:** nothing.

### P5-7 — ComfyUI extend in the adapter

- **Size:** small. **Needs:** Phase 4 merged.
- **Read:** `spec/comfyui-workflows.md`, "Extend a background", the slots table; `spec/comfyui.md`, "A picture run".
- **Exists when done:** `comfyui/image.ts` `extend` uploads the picture as the one reference, works out the run size with `fitSize`, scales `placement` by the same factor, fills the four `pad` slots (each a multiple of 8) and the scaled picture size, and runs as a picture run. `offeredWorkflow` gives no `extend` workflow while `moss-extend` is `draft`.
- **May touch:** `src/main/providers/comfyui/image.ts`, `fill.ts` (the slot filler) if `pad` is not filled yet.
- **Tests first:** `tests/unit/main/providers/comfyui/extend.test.ts` against the stand-in, with a test-only `trial` copy of `moss-extend`: the uploaded picture, the four pads for a centred and an off-centre placement, rounding to 8, the scaled size, the result picture; the signal before submit; a server refusal. A case that the real `moss-extend` (draft) is never offered.
- **Approved edits to existing tests:** a test that expects "Extending a picture with ComfyUI is not built yet".
- **Exit check:** lint, typecheck, `tests/unit/main/providers/comfyui/`.
- **Class:** E. **Security class, full review:** a network call to the user's server (the address rules and upload names as built).
- **After:** nothing.

### P5-8 — `generation.runFill`, the fill job, the gate

- **Size:** medium. **Needs:** P5-1; SP-9 merged.
- **Read:** `spec/links-and-sync.md`, "Generative fill"; `spec/agent-runs.md`, "Gate steps for a run"; `generation.runImages` as built (`run-images.ts`) for the order of checks.
- **Exists when done:** `generation.runFill` checks and enqueues as designed; the job kind runs one `extend`, stores the picture and returns `{ assetIds }`; an agent passes the gate's three steps; `job.earlierOptions` lists fills; `job.retry` of a failed fill works; `campaign.paidCount` counts it.
- **New files:** `tests/integration/generation/run-fill.test.ts`, `tests/integration/jobs/generative-fill-kind.test.ts`, `tests/integration/commands/agent-run-gate-fill.test.ts`.
- **May touch:** the stubs `generation/run-fill.ts`, `jobs/kinds/generative-fill.ts`; `src/shared/generation/prompt.ts` (`FILL_PROMPT`); `src/main/commands/agent-run-gate.ts` (one entry in the run commands); `src/main/queries/earlier-options.ts` (`RUN_KINDS`); `src/main/commands/job/retry.ts` only if a fill row needs its own request branch; `src/main/jobs/png-details.ts` only if the embedded `kind` list lacks `generative_fill`.
- **Tests first:**
  - `run-fill.test.ts`, refusals table in order: unknown variant, `no_background_picture`, `background_turned`, `background_cropped`, `background_covers`, a provider without `image`, `NEEDS_KEY`, ComfyUI with no address, ComfyUI `comfy_job_not_offered`, a missing file, a WebP sent as PNG; success stores the request (prompt ends with the "keep printing" ending once, `placement` the background box) and the job row's four target columns.
  - `generative-fill-kind.test.ts` with the fake provider: one `extend` call with the source bytes, placement and size; one asset with `origin = 'generated'`; no layer row changes; cancel before the call adds no asset; a failure keeps no asset.
  - `agent-run-gate-fill.test.ts`: unticked refused with the gate sentence; ticked passes and the job has `started_by = 'agent'`; at the limit refused; a user's runs are not counted.
  - Additions to `tests/integration/queries/earlier-options.test.ts` (approved): a fill on the background layer is listed.
- **Approved edits to existing tests:** `agent-run-gate.test.ts` or `bus-fail-closed.test.ts` where they assert that `generation.runFill` is refused (it now passes the gate); `earlier-options.test.ts` (addition); `prompt.test.ts` (addition for `FILL_PROMPT`).
- **Exit check:** lint, typecheck, the tests above, `tests/integration/commands/agent-run-gate*.test.ts`, `tests/integration/commands/job-retry*.test.ts`.
- **Class:** B + A. **Security class, full review:** an agent-reachable command that sends a picture to a provider (the gate, the picture read through `AssetService.read`, metadata stripped, no path in any reply).
- **After:** P5-1; SP-9 merged.

### P5-9 — `generation.applyFill`

- **Size:** small. **Needs:** P5-4, P5-8.
- **Exists when done:** the command places a finished fill on its targets as designed, as one campaign entry with `variant.restoreLayers` as its inverse and the targets' own lists cleared.
- **May touch:** the stub `generation/apply-fill.ts`.
- **Tests first:** `tests/integration/generation/apply-fill.test.ts`: two languages at one size both get the picture, the whole canvas, `crop` null, `source` in `overrides`; a third variant of another size does not; a variant whose background was changed is left and, with none left, `fill_outdated`; a job that failed, or is not a fill, `job_wrong_state`; undo puts both backgrounds back; agent `AGENT_DENIED`.
- **Approved edits to existing tests:** none.
- **Exit check:** lint, typecheck, the test above.
- **Class:** B. No security review (internal data, a deny command).
- **After:** P5-4, P5-8.

### P5-10 — `variant.fanOut` and `variant.add`

- **Size:** medium. **Needs:** P5-4, P5-5.
- **Read:** `spec/links-and-sync.md`, "Fan-out".
- **Exists when done:** both commands make variants with `planVariant`, skip combinations that exist, reply as designed, and undo with `variant.remove`.
- **May touch:** the stubs `variant/fan-out.ts`, `variant/add.ts`.
- **Tests first:** `tests/integration/links/fan-out.test.ts`: three sizes × two languages from a 1080×1080 master make five variants with the master's title, subjects, keys and `linked = 1`; a second identical call makes none; `fill` makes the scaled background and names the variant in `fill`; the R-02 copy for size and language together; refusals: `not_in_campaign`, a missing and an extra `fits` entry, 201 variants `too_many_variants`; undo removes all five and redo brings them back with their IDs; the agent is denied. `tests/integration/links/variant-add.test.ts`: one variant with `crop`; `variant_exists`; the agent is allowed, with `created_by = 'agent'`.
- **Approved edits to existing tests:** none.
- **Exit check:** lint, typecheck, `tests/integration/links/`.
- **Class:** B. No security review (no path, no provider, agent reach only through `variant.add`, allowed by policy).
- **After:** P5-4, P5-5.

### P5-11 — Directions

- **Size:** small. **Needs:** P5-4.
- **Read:** `spec/links-and-sync.md`, "Directions".
- **Exists when done:** the four direction commands work with their refusals and inverses.
- **May touch:** the stubs in `src/main/commands/direction/`.
- **Tests first:** `tests/integration/links/directions.test.ts`: create from the master copies layers with keys, values and subjects, `linked = 0`, and `sort` one higher; `not_a_master`; `direction_name_taken` ignoring case and outer spaces; rename keeps its own name free; delete removes its variants; `last_direction`; `jobs_running`; undo of delete brings the direction and its variants back; undo of create removes it; each command as the agent is denied.
- **Approved edits to existing tests:** none.
- **Exit check:** lint, typecheck, the test above.
- **Class:** B. No security review (deny for agents; data inside the project).
- **After:** P5-4.

### P5-12 — The sync plan and `sync.preview`

- **Size:** medium. **Needs:** P5-1, P5-2.
- **Read:** `spec/links-and-sync.md`, "Sync".
- **Exists when done:** `syncPreviewOf` and `syncWritesOf` (pure) and the `sync.preview` query, as designed.
- **New files:** `src/shared/links/sync-plan.ts`.
- **May touch:** the stub `src/main/queries/sync.ts`.
- **Tests first:** `tests/unit/shared/links/sync-plan.test.ts`, tables: a style change gives one update with `groups: ['style']`; an overridden `style.color` is in `blockedByOverride` and `proposed` keeps the variant's colour; geometry at another size gives nothing; copy in another language gives the Phase 5 `failed` stand-in with the current text; a new master key gives add-layer with fan-out geometry; a removed key gives remove-layer only for a linked layer. `syncWritesOf` with `keep-mine`, `take-master` and no choice. `tests/integration/links/sync-preview.test.ts` (using `linked-fixture.ts` from P5-3, or its own fixture if P5-3 is not merged): `masterRev` is the master's `rev`; only out-of-date variants, in `campaign.get` order; an unknown direction `NOT_FOUND`; the agent may read it.
- **Approved edits to existing tests:** none.
- **Exit check:** lint, typecheck, `tests/unit/shared/links/`, the test above.
- **Class:** A + B. No security review (a read).
- **After:** P5-1, P5-2.

### P5-13 — `sync.apply`

- **Size:** medium. **Needs:** P5-3, P5-4, P5-12.
- **Exists when done:** `sync.apply` writes the accepted changes as designed, as one campaign entry, with the changed variants' own lists cleared.
- **May touch:** the stubs `src/main/commands/sync/index.ts`, `apply.ts`.
- **Tests first:** `tests/integration/links/sync-apply.test.ts`: accept one of two variants and the other stays out of date; `take-master` writes the colour and removes the path; `keep-mine` keeps both and marks the group synced; add-layer goes on top with `linked = 1`; remove-layer deletes; the Phase 5 translation stand-in keeps the text and sets `missing`; `master_changed` after a master edit writes nothing; a choice for the master, for another direction or for an unchanged key `INVALID_INPUT`; after an accept-all, `campaign.get` shows no `outOfDate`; undo brings every changed layer back and the badges return; the agent is denied.
- **Approved edits to existing tests:** none.
- **Exit check:** lint, typecheck, `tests/integration/links/`.
- **Class:** B. No security review (deny for agents; data inside the project).
- **After:** P5-3, P5-4, P5-12.

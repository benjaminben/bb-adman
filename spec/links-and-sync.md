# Links, overrides, sync, fan-out and directions

Not built (Phase 5; slices in `spec/phases/phase-05.md` and `phase-05-slices.md`). How one master drives the variants of its direction: the follow rules, out-of-date, overrides, sync, fan-out, generative fill, directions, adding and deleting variants, and the campaign undo list. Read with `spec/data-model-campaign.md` (the tables) and `spec/data-rules.md` (data flow). The screens are in `spec/screens-variants.md`. Phase 5's assumptions (A-128 to A-149) are in `spec/phases/phase-05.md`.

No schema change: every column used here exists, and `generative_fill` is already in the `job_kind` check. Phase 5 adds no migration.

## Where the code lives

| File | Holds |
|------|-------|
| `src/shared/links/follow-rules.ts` | `GROUPS`, `followRule(group, master, variant)`, `isInherited(path, master, variant)` (pure) |
| `src/shared/links/out-of-date.ts` | `staleGroups(masterLayer, layer, rule)`, `variantOutOfDate(input)` (pure) |
| `src/shared/links/override-paths.ts` | `pathsOfPatch(patch)`, `inheritedPaths(paths, master, variant)` (pure) |
| `src/shared/links/fan-out-plan.ts` | `planVariant(input)`: the layer values of one new variant (pure) |
| `src/shared/links/sync-plan.ts` | `syncPreviewOf(input)` and `syncWritesOf(input, decisions)` (pure) |
| `src/main/links/snapshot.ts` | `readVariantSnapshot`, `writeVariantSnapshot`, `deleteVariantRows`, `replaceLayers` (inside a command's transaction) |
| `src/main/links/master-of.ts` | `masterOf(db, directionId)`: the master row and its layers |

The pure files take plain rows and sizes, never a database. A size is `{ width, height }`, a variant's facts for a rule are `{ width, height, language }`.

## Follow rules

The groups and the tables are in `spec/data-rules.md`, "Links, follow rules and sync". `followRule(group, master, variant)` gives one of three words:

| Word | When |
|------|------|
| `follows` | style, source, timing, animation always; geometry when `width` and `height` are both equal; copy when the language is equal |
| `translation` | copy when the language differs |
| `none` | geometry when the pixel size differs |

**Out of date** (`variantOutOfDate`). A linked layer (`linked = 1`) is stale for a group when the rule is `follows` or `translation` and `master.revs[group] > layer.syncedRevs[group]`. A variant is out of date when any linked layer is stale for any group, or the master has a layer key the variant lacks, or the variant has a linked layer whose key is gone from the master. A layer with `linked = 0` (made on the variant itself) never counts. A master is never out of date. Computed on read, never stored.

- `badgesOf` in `src/main/queries/campaign-reads.ts` takes the direction's master row and layers and sets `outOfDate` from `variantOutOfDate`. `campaign.get` reads each direction's master once per call. `variant.get` uses the same function.
- `variant.get` gains nothing more in Phase 5: the detail of what is out of date comes from `sync.preview`.

## Overrides

`layer.overrides` holds property paths: `copy`, `source`, `timing`, `geometry` (the whole group), `style.<field>` (each field of `TextStyle` or `ImageStyle`, look fields included), `animation.entrance`, `animation.exit`.

- **When an edit adds one** (A-135). `layer.update` and `layer.updateMany` on a linked layer of a variant that is not its direction's master add every path the patch changes and that is inherited for that variant: its group's rule is `follows`. A copy edit on a layer in another language adds none (copy is a translation there; Phase 6 marks it). A geometry edit on a variant of another pixel size adds none. A patch to `name`, `visible` or `locked` adds none: they are not in any group and never follow.
- A path is added once; the list keeps first-added order.
- An edit on a master, or on a layer with `linked = 0`, never touches `overrides`.
- **Undo of an edit that changed the list** (A-136). When the override list changes, the inverse is the system command `layer.revert` instead of `layer.update` / `layer.updateMany`. Otherwise the inverse stays as built, so the existing tests on masters do not change.
  - `layer.revert { projectId, variantId, layers: Array<{ layerId, patch, overrides }> }` (1 to 100), `internal: true`, policy deny (system), undo scope V. It writes each patch with the same counters as `layer.update` and sets `overrides` to the given list exactly. It bumps `variant.rev` once. Its inverse is `layer.revert` with the values and lists before it ran. A layer not in `variantId` is `NOT_FOUND`.
- **`layer.clearOverride { projectId, layerId, paths[] }`** (V, deny). Removes those paths from the layer's list and writes the master's current value for each removed path (the whole group for `copy`, `source`, `timing`, `geometry`; one field for `style.*`; one block for `animation.*`). A path not in the list is ignored; a call that changes nothing writes nothing and adds no entry. A layer that is not linked, or sits on a master: `RULE_VIOLATION`, `not_linked`, "This layer does not follow the master." Its inverse is `layer.revert`. No screen sends it in Phase 5; the sync review covers "take the master's".

**Named test** (Phase 5 exit): "editing a master changes no other variant's layer rows". In `tests/integration/links/master-edit.test.ts`: a direction with a master and three linked variants; every layer command on the master (`layer.update` of each group, `layer.updateMany`, `layer.create`, `layer.delete`, `layer.reorder`) leaves every other variant's layer rows equal, column by column, to what they were; only `outOfDate` changes.

## Sync

**`sync.preview { projectId, directionId }`** (query, both actors) replies:

```ts
type SyncPreviewReply = {
  directionId: string
  masterVariantId: string
  masterRev: number                 // the master's variant.rev the preview was made from
  variants: SyncPreview[]           // only out-of-date variants, in campaign.get order
}
type LayerValues = Pick<LayerRow, 'copy' | 'style' | 'geometry' | 'source' | 'timing' | 'animation'>
type SyncPreview = {
  variantId: string
  changes: Array<{
    layerKey: string
    layerName: string                // the master's layer name (add-layer, update) or the variant's (remove-layer)
    kind: 'update' | 'add-layer' | 'remove-layer'
    groups: Array<'copy' | 'style' | 'geometry' | 'source' | 'timing' | 'animation'>
    proposed: Partial<LayerValues>   // the values after the sync, override paths left as they are
    proposedTranslation?: { text: string; status: 'proposed' | 'failed' }
    blockedByOverride: string[]      // override paths the change would write
  }>
}
```

- `groups` lists the stale groups of an update; for add-layer, every group; for remove-layer, none.
- **A translated copy change in Phase 5** (A-134). No translation job exists until Phase 6. A stale `translation` copy gives `proposedTranslation = { text: <the layer's current copy>, status: 'failed' }`. Phase 6 replaces this with the translation job of `spec/data-rules.md`.
- An unknown direction: `NOT_FOUND`, "That direction was not found."

**`sync.apply { projectId, directionId, masterRev, decisions[] }`** (C, deny). `SyncDecision` is in `spec/data-rules.md`. At most 2,000 decisions.

1. The master's `variant.rev` must equal `masterRev`, else `RULE_VIOLATION`, `master_changed`, "The master changed after the review opened. Look at the changes again." (A-137). Nothing is written.
2. The values to write are worked out from the database now by `syncWritesOf`, never taken from the window. A decision naming a variant outside the direction, the master, or a layer key with no change: `INVALID_INPUT`, "A sync choice does not match the changes."
3. For each decision with `accept: true`:
   - `update`: write each stale `follows` group with the master's values, except override paths. A blocked path with `take-master` is written and leaves the list; with `keep-mine`, or with no choice given, it stays as it is. Set `synced_revs` to the master layer's `revs`.
   - A stale `translation` copy (Phase 5): the text stays, `translation_status = 'missing'`, `translation_source = null`, and `synced_revs` is set.
   - `add-layer`: insert a copy of the master layer as fan-out makes one (below), with a new ID, `linked = 1`, empty `overrides`, `synced_revs` = the master layer's `revs`, and `z` one above the variant's top layer (A-148).
   - `remove-layer`: delete the layer. Only a layer with `linked = 1` is ever offered.
4. `accept: false`, or a change with no decision, leaves the layer out of date [REQ: FR-082, FR-083].
5. Each changed variant gets one `variant.rev` bump. The whole apply is one command and one campaign entry. Its inverse is `variant.restoreLayers` with each changed variant's layers before the apply. The bus clears the changed variants' own undo lists (below). Reply `{ variantIds }`, the variants written.

## Fan-out

The steps are in `spec/data-rules.md`, "Fan-out". Phase 5 builds them with these rules.

**`variant.fanOut { projectId, directionId, sizes, languages, formats, fits }`** (C, deny).

- `sizes`: size labels from `campaign.sizes`, at least one. `languages`: tags from `campaign.languages`, at least one. A label or tag not in the campaign: `RULE_VIOLATION`, `not_in_campaign`, "Choose sizes and languages from the campaign's lists." The master's size and language are always part of the grid, whether or not they are listed.
- `formats`: `['image']` only in Phase 5 (A-133). Phase 7 widens the schema to `'video'` and builds step 7.
- `fits`: `{ [sizeLabel]: 'scale' | 'crop' | 'fill' }`, one entry for each listed size whose pixel size differs from the master's, and no others. A missing or extra entry: `INVALID_INPUT`, "Choose how the background fits for each new size." A size with the master's pixel size but another label takes geometry as it follows (A-147).
- `fill` makes the variant exactly as `scale` does. The command starts no job (A-129).
- Combinations that already exist in the direction are skipped. Nothing new to make: success with empty lists.
- **The background for a new size.** With the picture's size `pw × ph` (from its asset row; null source or no size known: the whole canvas) and the canvas `W × H`: `scale` uses `s = min(W / pw, H / ph)`, `crop` uses `s = max(W / pw, H / ph)`; the box is `pw·s × ph·s`, centred, rounded to whole pixels, rotation 0, `crop` null.
- **Other layers** keep their centre at the same share of the canvas and scale width and height by `min(W / masterW, H / masterH)`, rounded to whole pixels, at least 1. Rotation is kept.
- **A new size in a new language** copies geometry from the plan of the same size in the master's language, made in the same call (R-02). `planVariant` takes that plan as input.
- **A new language** (Phase 5): text layers keep the master's copy with `translation_status = 'missing'` and `translation_source = null`; no job starts (A-134). Phase 6 adds the translation job and the brief's copy.
- Each new variant: the master's title and subjects, `created_by` the actor, `rev` 0, every layer with the master's `key`, `linked = 1`, empty `overrides`, `synced_revs` = the master's `revs`, `overflow` 0. The render service measures overflow when it draws the new variant's thumbnail (`spec/scene.md`, "Eager thumbnails").
- Reply `{ variantIds, fill: Array<{ sizeLabel, variantId }> }`: the new variants in creation order, and for each size with `fill`, the new variant of that size in the master's language.
- Inverse `variant.remove { variantIds }`. At most 200 new variants per call: `RULE_VIOLATION`, `too_many_variants`, "Fan-out can make at most 200 variants at a time."

**`variant.add { projectId, directionId, sizeLabel, language, format, fit? }`** (C, allow). One variant, made by the same `planVariant`. `fit` is `scale` (default) or `crop`; there is no fill (A-143). A combination that exists: `RULE_VIOLATION`, `variant_exists`, "This direction already has a variant at this size, language and format." Reply `{ variantId }`. Inverse `variant.remove`.

## Generative fill

**`generation.runFill { projectId, variantId, provider, licenceConfirmed? }`** (no undo, tick). Agents may start it: it is one of the gate's run commands, with the gate's three steps (D-080; `spec/agent-runs.md`).

1. The variant and its background layer are found (`NOT_FOUND`). The checks, in order, each `RULE_VIOLATION` (A-132):
   - no picture: `no_background_picture`, "This variant has no background picture to extend."
   - rotation not 0: `background_turned`, "Straighten the background before generating a fill."
   - `crop` set: `background_cropped`, "Reset the background's crop before generating a fill."
   - the box covers the whole canvas: `background_covers`, "The background already covers the whole variant."
2. The provider must be available with the `image` job (`INVALID_INPUT`, "That provider cannot make pictures."). The key guard, purpose "generate a fill". For ComfyUI, the address, the offered `extend` workflow (`comfy_job_not_offered`, "ComfyUI cannot make this kind of picture yet.") and the licence check, as for `generation.runImages`.
3. `prepare` reads the source through `AssetService.read` with the reference-picture rules (`asset_too_large`, `asset_not_a_picture`, `MISSING_FILE`; a WebP goes on as PNG, slice WP).
4. Enqueue a `generative_fill` job with `campaign_id`, `variant_id`, `layer_id` (the background), the provider and `started_by`. Request (`src/shared/schemas/jobs/generative-fill.ts`): `{ prompt, sourceAssetId, placement: { x, y, width, height }, width, height }`. `prompt` is `promptToSend(FILL_PROMPT, { pictures: 1 })`, with `FILL_PROMPT` in `src/shared/generation/prompt.ts` (A-146): "Extend this picture outward so it fills the whole frame. Keep everything already in the picture as it is, and continue the scene naturally at the edges." Reply `{ jobId }`.

**The job kind** (`src/main/jobs/kinds/generative-fill.ts`, attached class [D-036]). The key guard again; the source read again through `readPictures`; one `ImageProvider.extend` call with `{ image, placement, width, height, prompt }`; `toPng`; generation details embedded with kind `generative_fill`; stored through `storeResult`. Result `{ assetIds: [id] }`. One paid call for a paid provider. It writes nothing to any layer. `job.earlierOptions` lists its picture with the background layer's other runs. Cancel and retry as for `image_generation`.

**Placing the result: `generation.applyFill { projectId, jobId }`** (C, deny). The window sends it when the attached job succeeds (A-131).

- The job must be a `generative_fill` that succeeded, else `RULE_VIOLATION`, `job_wrong_state`, "Only a finished fill can be placed."
- **Targets** (A-130): the job's variant and every variant of the same direction with the same width and height whose background is linked, has no `source` override and still names `sourceAssetId`. None left: `RULE_VIOLATION`, `fill_outdated`, "The background changed after the fill started, so the fill was not placed. It is in the asset library."
- Each target's background gets `source = { assetId }`, geometry the whole canvas, rotation 0, `crop` null, and `source` added to `overrides`; counters as `layer.update`; one `variant.rev` bump each. Inverse `variant.restoreLayers`; the targets' own undo lists are cleared. Reply `{ variantIds }`.
- An agent's fill has no window owner. The picture waits in the asset library and the agent places it with `layer.update` (D-059 item 5).

**Providers.** Gemini: `spec/providers-adapters.md`, "Picture extend". ComfyUI: `spec/comfyui-workflows.md`, "Extend a background"; not offered until `moss-extend` leaves `draft`. Fake: its built `extend`.

## Directions

- **`direction.createFromMaster { projectId, masterVariantId, name }`** (C, deny) [REQ: FR-074]. The variant must be its direction's master, else `RULE_VIOLATION`, `not_a_master`, "Only a master can start a new direction." `name` is 1 to 100 characters after trimming and differs, ignoring letter case, from every direction name in the campaign, else `RULE_VIOLATION`, `direction_name_taken`, "This campaign already has a direction with that name." (A-139). It makes a direction with `sort` one above the campaign's highest, and a copy of the master as its master: new variant and layer IDs, the same keys, values, `revs` and `synced_revs`, `linked = 0`, empty `overrides`, the same subjects and clips. Reply `{ directionId, variantId }`. Not undoable, like `campaign.create` [D-099]: a direction that is not wanted is deleted.
- **`direction.rename { projectId, directionId, name }`** (C, deny). The same name rule; the direction's own name counts as free. Inverse `direction.rename`.
- **`direction.delete { projectId, directionId }`** (not undoable, deny) [D-099]. The campaign's last direction: `RULE_VIOLATION`, `last_direction`, "A campaign keeps at least one direction." A job `queued` or `running` for any of its variants: `jobs_running`, "Work is still running for this direction. Stop it, or wait for it to finish." Deletes the direction and its variants. It records no inverse: the screen warns first (`spec/screens-variants.md`). It clears the campaign's own list and each removed variant's own list (`clearScopes`), because an older campaign entry may name a variant that is now gone.

## Adding back and removing variants

```ts
type VariantSnapshot = {
  variant: VariantRow
  subjectIds: string[]
  layers: LayerRow[]
  clips: BackgroundClipRow[]
}
```

- **`variant.delete { projectId, variantId }`** (C, ask) [REQ: FR-073, FR-197, R-17]. A master: `RULE_VIOLATION`, `master_variant`, "A master cannot be deleted while its direction exists." A job `queued` or `running` for the variant: `jobs_running`, "Work is still running for this variant. Stop it, or wait for it to finish." (A-140). Not undoable [D-099]: it records no inverse, and the screen warns first. It clears the campaign's own list and the variant's own list (`clearScopes`). The variant's check row and its approval rows go with it. Reply `{ variantId }`.
- **`variant.remove { projectId, variantIds }`** (system, deny, C; 1 to 500): the inverse of fan-out, `variant.add` and `variant.restore`. Same refusals as `variant.delete`, checked for every ID before any write. Inverse `variant.restore`.
- **`variant.restore { projectId, snapshots }`** (system, deny, C; 1 to 500). Refused, before any write, when a variant or layer ID is in use (`variant_exists`, "That variant is already there."), the direction is gone (`NOT_FOUND`), the grid place is taken (`variant_exists`), or an asset a layer names is no longer in the project (`NOT_FOUND`, "A file this variant used is no longer in the project."). Inverse `variant.remove`.
- **`variant.restoreLayers { projectId, variants: Array<{ variantId, layers: LayerRow[] }> }`** (system, deny, C; 1 to 500 variants). Makes each variant's layer set exactly the given rows: layers not listed are deleted, listed ones are written whole, missing ones inserted. A master is refused (`RULE_VIOLATION`, `master_variant`), so a master's counters only go up. One `variant.rev` bump per variant. Inverse: the same command with the rows before it ran.
- Deleted variants keep their ended job rows (no foreign key).

## The campaign undo list

- Every command marked C above records its inverse on `campaign:{campaignId}`. `variant.delete`, `direction.delete` and `direction.createFromMaster` record none [D-099]. `variant.remove` and `variant.restore` stay as the undo and redo of fan-out and `variant.add`.
- **Clearing a variant's own list** (A-141). `HandlerResult` gains `clearScopes?: UndoScope[]`. After a command succeeds, the bus clears each named scope with `undo.clear`. `sync.apply`, `generation.applyFill`, `variant.restoreLayers`, `variant.delete`, `variant.remove` and `direction.delete` name every variant they change or remove; the two deletes also name the campaign's own list. So a variant's own list never holds an entry that a campaign entry has made wrong. The snapshot in the campaign entry is what brings the variant back.
- Agents are denied `history.undo` and `history.redo`, as before.

## What later phases build on

- Phase 6: the translation job at fan-out step 6 and in `sync.preview` (`proposedTranslation`), replacing the Phase 5 stand-in; `translation.approve` on the campaign list can use `variant.restoreLayers` as its inverse.
- Phase 7: `formats` gains `'video'`; fan-out step 7 (one clip from the background picture); snapshots already carry clips.
- Phase 10: MCP tools for `variant.add` (allow) and `variant.delete` (ask), and for `generation.runFill` (tick); `sync.preview` can be read by an agent.

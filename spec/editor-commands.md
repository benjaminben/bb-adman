# Layer and variant commands, queries and events

The full rules of the commands, queries and events the Scene and the editor need: `layer.create`, `layer.update`, `layer.delete`, `layer.restore`, `layer.reorder`, `layer.reportOverflow`, `variant.update`, the queries `variant.get`, `thumbnail.get` and `variant.render`, and the event `thumbnail.changed`. Each has its row in `spec/api-commands.md` or `spec/api-queries-events.md`; this file holds the detail. Read with `spec/api-principles.md` (bus, errors, undo) and `spec/data-model-campaign.md` (the `layer` and `variant` tables).

Everything here is Built. Schemas: `src/shared/schemas/commands/layer.ts`, `commands/variant.ts`, `queries/variant.ts`, `queries/render.ts`. Handlers: `src/main/commands/layer/`, `src/main/commands/variant/`. Queries: `src/main/queries/variant.ts`, `src/main/queries/render.ts`.

## Rules for every layer and variant command

- **Project scope.** Every input starts with `projectId` and extends `projectScoped`. Every schema is strict: an unknown key is `INVALID_INPUT`.
- **`variant.rev`.** Every command here except `layer.reportOverflow` bumps the variant's `rev` by one through the helper in `src/main/commands/variant-rev.ts`, once per command. With actor `agent` the helper also stamps `variant.agent_changed_at` [REQ: FR-239]. `tests/integration/commands/layer-update-agent.test.ts` sends `layer.update` once as the user and once as the agent and checks that only the agent's call stamps the column.
- **Layer counters.** A command bumps `layer.revs[group]` by one for each group whose value really changed (`spec/data-rules.md`, "Links"): `copy`, `style`, `geometry`, `source`, `timing`, `animation`. `name`, `visible`, `locked` and `z` are in no group and bump no counter (they bump `variant.rev`).
- **Nothing changed, nothing happens.** A command whose result equals what is stored writes nothing, bumps nothing, adds no undo entry, sends no event, and still answers `ok`.
- **Overrides** are not written in Phase 3. No layer is linked before fan-out (Phase 5), and Phase 5 adds the override rule to `layer.update`.
- **Lock is not a rule of the commands.** `locked` is an aid in the editor (`spec/editor.md`). A command, from the user or an agent, may change a locked layer (A-27).
- **Undo.** Each command's inverse goes on the list `variant:{variantId}`. Each inverse is a full command input, `projectId` included.
- **Events.** The handler names every row it wrote with `ctx.changes.touch`: the layer rows and the variant row. The success test of each command uses `expect-changes`.
- **Which asset a layer may name.** The checks run on the values the command was sent, after the type and style checks. A `source.assetId` must name an asset of this project (`NOT_FOUND` "That file is not in this project."), of kind `image` (`INVALID_INPUT` "Choose a picture for a picture layer."), in the `asset` library (`RULE_VIOLATION`, `reference_library`). A `style.fontAssetId` must name an asset of this project, of kind `font` (`INVALID_INPUT` "Choose a font file."), in the `asset` library (`reference_library`). An asset whose file is missing may be named; the badge shows it. One helper, `checkLayerAssets`, in `src/main/commands/layer/` makes these checks for every command that takes values.

### New refusals

Four reasons are new with these commands: `background_layer`, `reference_library`, `layer_exists` and `render_failed`. Their cases, codes and messages are in the reason table of `spec/api-principles.md`.

Fixed messages with no reason: "That layer was not found." (`NOT_FOUND`); "That variant was not found." (`NOT_FOUND`); "Only a text layer has text." (`INVALID_INPUT`, `copy` on another type); "A text layer has no picture." (`INVALID_INPUT`, `source` on a text layer); "Those style values do not fit this layer." (`INVALID_INPUT`); "Only text layers can have an entrance or exit animation." (`INVALID_INPUT`); "List every layer of the variant once, without the background." (`INVALID_INPUT`, `layer.reorder`).

## `layer.update`

[REQ: FR-091 to FR-094, FR-194, FR-249]. Undo V. Agent allow.

```ts
type LayerUpdateInput = {
  projectId: string
  layerId: string
  patch: {                                  // strict, at least one key
    name?: string                           // trimmed, 1 to 100 characters
    visible?: boolean
    locked?: boolean
    copy?: string                           // text layers only; 0 to 5,000 characters
    style?: Partial<TextStyle> | Partial<ImageStyle>   // fields are merged into the stored style
    geometry?: Partial<Geometry>            // fields merged; `crop` is replaced whole (a box or null)
    source?: { assetId: string } | null     // image and background layers only
    timing?: Timing                         // stored now, drawn from Phase 7
    animation?: { entrance?: AnimationBlock; exit?: AnimationBlock }  // each block replaced whole
  }
}
```

Built (`src/main/commands/layer/update.ts`, `merge-patch.ts`, `inverse-patch.ts`, `check-layer-assets.ts`, `write-layer.ts`). `writeLayer` (`write-layer.ts`) writes the changed columns and one counter per changed group; `layer.update` and `layer.updateMany` both use it, so they write the same way.

- After merging, the whole `style`, `geometry`, `timing` and `animation` must pass their schemas in `src/shared/schemas/layer.ts`; a text layer's style must be a `TextStyle`, an image or background layer's an `ImageStyle`. A style field of the other kind is refused with "Those style values do not fit this layer."
- Any `source` key on a text layer is refused, `null` included ("A text layer has no picture.").
- `geometry`: `width` and `height` at least 1; every number finite; `rotation` is stored folded into (−180, 180]. A `crop` with `width` or `height` below 1 is refused. A crop outside the picture is accepted and drawn cut to the picture (`spec/scene.md`).
- `timing.startMs`, `timing.endMs` and each animation block's `startMs` and `durationMs` are from 0 to the longest variant length (`MAX_DURATION_MS`, the bound of `variant.update`'s `durationMs`), checked in the schema. Agents reach them through `update_layer`.
- The asset checks run on the values in the patch, even when they equal what is stored. So re-sending a font that has since moved to the reference library is refused, not a no-op.
- **Refusal order:** unknown layer (`NOT_FOUND`); then the type and style refusals; then the asset refusals (`NOT_FOUND`, then wrong kind `INVALID_INPUT`, then `RULE_VIOLATION` `reference_library`).
- A preset other than `none` on a layer that is not text is refused [REQ: FR-128].
- Picking a generated or imported picture for a layer is this command with `source` (`spec/data-rules.md`, "Generation").
- **Inverse:** `layer.update` with the same `layerId` and a `patch` holding the stored value of every key the patch changed (for `style` and `geometry`, only the changed fields; for `animation`, only the changed blocks).
- **Look fields** (Built, LK-1) [D-094]. The patch shape does not change: `style` is still `Partial<TextStyle> | Partial<ImageStyle>`, and those types gain the optional look fields (`spec/data-model-campaign.md`, "Look fields"). So `layer.update`, `layer.updateMany` (each item) and `layer.create`'s `values.style` take them with no new key. The checks:
  - **By the schema**, before the handler: every colour (`boxColor`, `boxOutlineColor`, `fillColor`, `shade.color`) is `#RRGGBB` by `HEX_COLOUR`, or null where the type allows null; `boxOutlineWidth` 0 to 100, `boxRadius` and `boxPadding` 0 to 2,000, `shade.strength` 0 to 1, `shade.reach` 0.05 to 1, every number finite; `verticalAlign` and `shade.from` from their fixed lists; `allCaps` a boolean; `shade` a strict object or null, replaced whole, never merged field by field. Failures are `INVALID_INPUT` with the bus's usual message.
  - **By `mergeStyle`**: a text field on a picture layer, or a picture field on a text layer, is refused as today with "Those style values do not fit this layer." So is a `fillColor` other than null on an `image` layer (A-73).
  - **Nothing changed.** The merged style is compared with the stored style with its defaults filled (`textLookOf` or `pictureLookOf`). So `{ boxColor: null }` on a layer stored without the field writes nothing and adds no undo entry.
  - **Inverse.** For a look field the stored layer lacks, the inverse holds its default (for example `boxColor: null`, `verticalAlign: 'top'`), never an absent key, so undo puts the look back.
  - The Scene still treats each value as untrusted (`spec/scene.md`, "Text boxes"): an agent can send these through `layer.update`.
- **Reply:** `{ layerId }`.
- **Refusals:** `NOT_FOUND` for the layer; the type and asset refusals above.

## `layer.create`

[REQ: FR-090, FR-194]. Undo V. Agent allow.

```ts
type LayerCreateInput = {
  projectId: string
  variantId: string
  type: 'image' | 'text'
  values?: {                                // strict; each key as in layer.update's patch
    name?: string; copy?: string; style?: Partial<TextStyle> | Partial<ImageStyle>
    geometry?: Partial<Geometry>; source?: { assetId: string } | null
    visible?: boolean; locked?: boolean
  }
}
```

Built (`src/main/commands/layer/create.ts`, `src/shared/templates/new-layer.ts`).

- The starting values come from `newLayerValues(type, size, count)` in `src/shared/templates/new-layer.ts` (pure, holds no number of its own). It builds the layer through `buildMasterLayers` with a slot no layout names, so the default layout's "any other slot" box and style apply. `count` is how many layers of that type the variant has. For `image`: `source` null, name "Picture {count + 1}". For `text`: copy "Your text", name "Text {count + 1}". Then the given `values` are merged over them, as `layer.update` merges a patch.
- The layer's ID and key use the same new ULID: the ID in upper case, the key `layer-` followed by it in lower case. `slot` is null: an added layer fills no template slot. `z` is one above the highest `z` of the variant. `linked` false, `overrides` empty, `revs` and `synced_revs` all 0, `translation_status` and `translation_source` null, `overflow` false, timing and animation from `LAYER_DEFAULTS`.
- **Inverse:** `layer.delete { projectId, layerId }`.
- **Reply:** `{ layerId }`.
- **Refusals:** `NOT_FOUND` for the variant; then the type and style refusals; then the asset refusals, in the order of `layer.update`.

## `layer.delete`

[REQ: FR-092, FR-197]. Undo V. Agent allow (the user can undo it). Built (`delete.ts`).

- Input `{ projectId, layerId }`. Refused for the background layer with `background_layer`.
- Deletes the row, then sets `z` of the remaining non-background layers to 1, 2, 3 … in their old order, so `z` has no gaps. Every layer whose `z` changed is named to the change recorder.
- A job whose `layer_id` names the deleted layer is left as it is.
- **Inverse:** `layer.restore` with the whole row as it was (wire form) and the order of non-background layer IDs as it was before the delete.
- **Reply:** `{ layerId }`.

## `layer.restore`

System command (`internal: true`), agent deny, not on the window's channel. It exists only as the inverse of `layer.delete`; undo replays it through the bus. Built (`restore.ts`).

- Input `{ projectId, layer: LayerRow, order: string[] }`. `order` is every non-background layer ID of the variant after the restore, lowest first, and must hold `layer.id`.
- Inserts the row with its own `id`, `key` and every stored value (`revs`, `synced_revs`, `overflow` included), then sets each `z` from `order`.
- **Refusals, in this order:** `NOT_FOUND` "That variant was not found." when the variant is gone; `layer_exists` when a layer with that `id` is anywhere in the project file, or the variant has a layer with that `key`; `INVALID_INPUT` with the reorder message when `order` is wrong or the layer is a background layer.
- **Inverse:** `layer.delete` of that layer. Bumps `variant.rev` and no layer counter.

## `layer.reorder`

[REQ: FR-092]. Undo V. Agent allow. Built (`reorder.ts`).

- Input `{ projectId, variantId, layerIds }`: every non-background layer ID of the variant, each once, lowest first. A gone variant is `NOT_FOUND`; naming the background is `background_layer`; anything else wrong is `INVALID_INPUT` with the reorder message.
- Sets `z` to 1, 2, 3 … in that order. The background keeps `z = 0`. Sent with the stored order, it writes nothing when `z` is already 1 to n, and closes gaps in `z` otherwise; closing gaps counts as a change.
- **Inverse:** `layer.reorder` with the old order. **Reply:** `{ variantId }`.

## `layer.reportOverflow`

[REQ: FR-098]. Not undoable. Agent deny. Not internal: the editor window sends it. Built (`report-overflow.ts`).

- Input `{ projectId, layerId, overflow: boolean, variantRev: number }` (`variantRev` a whole number, 0 or more).
- Checks in this order: the layer is found (`NOT_FOUND`); it is text (`INVALID_INPUT` "Only a text layer has text."); then `variantRev` and the stored value.
- If the layer's variant has `rev` other than `variantRev`, or the stored `overflow` already equals the input, nothing is written and the reply is `{ applied: false }`. So a measurement of an older drawing never wins.
- Otherwise it writes `overflow` and names the layer row. It bumps no `rev` and no counter, and adds no undo entry. Reply `{ applied: true }`.

## `variant.update`

[REQ: FR-070]. Undo V. Agent allow. Built (`src/main/commands/variant/update.ts`).

- Input `{ projectId, variantId, title?, durationMs? }`, strict, with at least one of the two ("Name a title or a duration."). `title` is trimmed, 1 to 200 characters. `durationMs` is a whole number from 500 to 86,400,000 (`MIN_DURATION_MS`, `MAX_DURATION_MS` in `src/shared/schemas/commands/variant.ts`).
- `durationMs` (P7-10) writes `duration_ms`; on a variant that is not its direction's master it also sets `duration_overridden`. `durationOverridden` in the input is undo-only: accepted only while the bus replays an undo or redo, never from an agent (`spec/data-rules.md`, "Undo-only fields").
- **Inverse:** `variant.update` with the old title, or the old duration and flag. **Reply:** `{ variantId }`.

## Queries

### `variant.get`

Built (`src/main/queries/variant.ts`, `variant-reads.ts`). Input `{ projectId, variantId }`. Unknown variant: `NOT_FOUND` "That variant was not found." Writes nothing. Both actors (the MCP tool `get_variant`, Phase 10, cuts it down). A layer row that fails its schema is logged and left out. An asset ID a layer names that has no asset row is left out of `assets` and does not set `missingFile`.

```ts
type VariantGet = {
  variant: VariantSummary            // as in campaign.get: the row, isMaster, subjectIds, badges
  campaignId: string
  layers: LayerRow[]                 // z ascending, then ID
  assets: Array<AssetRow & { missing: boolean }>   // each asset a layer names as source or font, once, by ID
}
```

Phase 5 adds the out-of-date detail, Phase 6 the latest check result, Phase 7 the clips. A layer row that fails its schema is logged and left out, as in every query.

### `thumbnail.get`

Built (`src/main/queries/render.ts`, `src/main/thumbnails/`). Input `{ projectId, variantId }`. User only in Phase 3 (no MCP tool wraps it): an agent gets `AGENT_DENIED` "Agents cannot read thumbnails in this version. Ask the user to do it in the app." Writes no project data; may start a draw.

```ts
type ThumbnailGet =
  | { state: 'ready'; rev: number; png: Uint8Array }
  | { state: 'pending'; rev: number }
  | { state: 'failed'; rev: number }
```

- `ready` when the file for the variant's current `rev` is there (`spec/scene.md`, "Thumbnails"). `pending` after it asked the render service for one; a `thumbnail.changed` event follows. `failed` when the draw or the save for this `rev` failed, or the file cannot be read.

### `variant.render`

Built (`src/main/queries/render.ts`). Input `{ projectId, variantId, maxDimension? }`: a whole number from 64 to `RENDER_LIMITS.maxDimension` (2048), default 1024. Reply `VariantRender = { png: Uint8Array; width: number; height: number; rev: number }`, the variant drawn now with its longer side `maxDimension` (never larger than the variant itself). Writes no file and no project data (it may report overflow, as every draw does). Refused with `render_failed` when the draw fails; that does not mark the thumbnail failed. User only, until Phase 10 writes a rule for linked private pictures (a project file can link any picture the user can read, and the drawn PNG would carry its pixels): an agent gets `AGENT_DENIED` with the same sentence as `thumbnail.get`. The reference-picture tests call it from the window; Phase 10's `render_variant` tool will call it.

## Event `thumbnail.changed`

Built. `{ projectId, variantId }`. Sent by the render service after a thumbnail write, a delete, a failed draw or a failed save. A window showing that variant's thumbnail sends `thumbnail.get` again. It carries no picture and no path.

// P10-4: the five success cases of the layer tools test, and the helpers that compare an
// agent's edit with the same command sent by the user. Not a test file.
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { layerOf, PICTURE, type LayerSetUp } from './layer-tools-fixture'

// A row without what differs between two equal edits: the ID a create makes, and the counters.
const plain = ({ id, key, revs, syncedRevs, ...rest }: LayerRow) => {
  void [id, key, revs, syncedRevs]
  return rest
}
export const plainAll = (rows: LayerRow[]) => rows.map(plain)

export type Case = {
  tool: string
  command: string
  args: Record<string, unknown>
  variantId: string
}

// Tool arguments in snake_case at the top level; the command gets the same in camelCase.
export function cases(x: LayerSetUp): Case[] {
  const v = x.variantId
  const p = x.projectId
  const text = layerOf(x, v, 'text')
  const picture = layerOf(x, v, 'image')
  const ids = x
    .layers(v)
    .filter((l) => l.type !== 'background')
    .map((l) => l.id)
  return [
    {
      tool: 'create_layer',
      command: 'layer.create',
      args: {
        project_id: p,
        variant_id: v,
        type: 'image',
        values: { source: { assetId: PICTURE } },
      },
      variantId: v,
    },
    {
      tool: 'update_layer',
      command: 'layer.update',
      args: { project_id: p, layer_id: text.id, patch: { copy: 'Cool down now' } },
      variantId: v,
    },
    {
      tool: 'update_layers',
      command: 'layer.updateMany',
      args: {
        project_id: p,
        variant_id: v,
        updates: [
          { layerId: text.id, patch: { copy: 'Stay cool' } },
          { layerId: picture.id, patch: { visible: false, geometry: { x: 40 } } },
        ],
      },
      variantId: v,
    },
    {
      tool: 'delete_layer',
      command: 'layer.delete',
      args: { project_id: p, layer_id: picture.id },
      variantId: v,
    },
    {
      tool: 'reorder_layers',
      command: 'layer.reorder',
      args: { project_id: p, variant_id: v, layer_ids: [...ids].reverse() },
      variantId: v,
    },
  ]
}

export const camel = (args: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(args).map(([k, v]) => [
      k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()),
      v,
    ]),
  )

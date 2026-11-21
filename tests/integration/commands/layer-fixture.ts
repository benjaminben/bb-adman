// Test helper for the layer and variant commands (spec/editor-commands.md): a project with one
// campaign made from the starter template, the layer and variant handlers, and one image
// layer added beside the template's background and headline. Not a test file itself.
import { makeAssetBus } from '../assets/asset-bus'
import { testDeps, TEST_NOW } from '../campaigns/campaign-deps'
import { createInput } from '../campaigns/campaign-fixture'
import { campaignCommands } from '@/main/commands/campaign'
import { subjectCommands } from '@/main/commands/subject'
import { ruleSetCommands } from '@/main/commands/rule-set'
import { layerCommands } from '@/main/commands/layer'
import { variantCommands } from '@/main/commands/variant'
import { readWireRow, readWireRows } from '@/main/db/rows'
import type { Actor } from '@/shared/schemas/events'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { VariantRow } from '@/shared/schemas/rows/variant'

export { TEST_NOW }
export type LayerBus = Awaited<ReturnType<typeof makeLayerBus>>

export async function makeLayerBus() {
  const deps = testDeps()
  const bus = makeAssetBus([
    ...campaignCommands(deps),
    ...subjectCommands(deps),
    ...ruleSetCommands(deps),
    ...layerCommands(deps),
    ...variantCommands(deps),
  ])
  await bus.user('campaign.create', createInput())
  const layers = readWireRows(bus.db, 'layer') as LayerRow[]
  const background = layers.find((l) => l.type === 'background')
  const text = layers.find((l) => l.type === 'text')
  if (!background || !text) throw new Error('The starter template made no background or text.')
  bus.db
    .prepare(
      `INSERT INTO layer (id, variant_id, key, type, slot, name, z, visible, locked, linked,
        overrides, copy, style, geometry, source, timing, animation, revs, synced_revs, overflow)
       SELECT 'image-1', variant_id, 'logo', 'image', 'logo', 'Logo', 5, visible, locked, linked,
        overrides, copy, style, '{"x":10,"y":20,"width":100,"height":50,"rotation":0,"crop":null}',
        source, timing, animation, revs, synced_revs, overflow FROM layer WHERE id = ?`,
    )
    .run(background.id)
  const variantId = background.variantId
  const exec = (actor: Actor) => (name: string, input: Record<string, unknown>) =>
    bus.bus.execute(name, { projectId: bus.projectId, ...input }, { actor })
  return {
    ...bus,
    variantId,
    ids: { background: background.id, text: text.id, image: 'image-1' },
    layer: (id: string) => readWireRow(bus.db, 'layer', { id }) as LayerRow,
    variant: () => readWireRow(bus.db, 'variant', { id: variantId }) as VariantRow,
    agent: exec('agent'),
    update: (layerId: string, patch: Record<string, unknown>, actor: Actor = 'user') =>
      exec(actor)('layer.update', { layerId, patch }),
    history: (direction: 'undo' | 'redo') =>
      exec('user')(`history.${direction}`, { scope: `variant:${variantId}` }),
    undoState: () => bus.undo.state(bus.projectId, `variant:${variantId}`),
  }
}

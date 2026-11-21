// Test helper for P6-7: a project with one campaign (en primary, de; sizes 1x1 and 9x16) and two
// directions. The first has German posts at both sizes and an English one at 9x16; the second
// has one German post at 1x1. Not a test file itself.
import { makeFixture, data, type Fixture } from '../core-fixture'
import { createInput, TALL } from '../campaigns/campaign-fixture'
import { layersOf } from '@/main/queries/variant-reads'
import type { LayerRow } from '@/shared/schemas/rows/layer'

export type RowsSetup = Awaited<ReturnType<typeof makeRowsSetup>>

export async function makeRowsSetup(fx: Fixture = makeFixture()) {
  const { projectId } = data<{ projectId: string }>(
    await fx.user('project.create', { name: 'A', location: fx.projectsDir }),
  )
  const run = async <T>(name: string, input: Record<string, unknown>) =>
    data<T>(await fx.user(name, { projectId, ...input }))
  const { campaignId, variantId: master1 } = await run<{
    campaignId: string
    variantId: string
  }>('campaign.create', createInput())
  const db = fx.core.deps.projects.requireOpen(projectId).db
  const direction1 = (
    db.prepare('SELECT direction_id AS id FROM variant WHERE id = ?').get(master1) as { id: string }
  ).id
  const add = async (directionId: string, sizeLabel: string, language: string) =>
    (
      await run<{ variantId: string }>('variant.add', {
        directionId,
        sizeLabel,
        language,
        format: 'image',
      })
    ).variantId
  // Made out of order, so the reply's order is the query's own.
  const de9 = await add(direction1, TALL.label, 'de')
  const de1 = await add(direction1, '1x1', 'de')
  const en9 = await add(direction1, TALL.label, 'en')
  const second = await run<{ directionId: string; variantId: string }>(
    'direction.createFromMaster',
    { masterVariantId: master1, name: 'Second' },
  )
  const de2 = await add(second.directionId, '1x1', 'de')
  const textLayers = (variantId: string): LayerRow[] =>
    layersOf(db, variantId).filter((l) => l.type === 'text')
  const setCopy = (layerId: string, copy: string | null) =>
    db.prepare('UPDATE layer SET copy = ? WHERE id = ?').run(copy, layerId)
  return {
    fx,
    db,
    projectId,
    campaignId,
    directions: [direction1, second.directionId] as const,
    masters: [master1, second.variantId] as const,
    variants: { de1, de9, en9, de2 },
    textLayers,
    setCopy,
  }
}

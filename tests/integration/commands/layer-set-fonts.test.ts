// P6-9 (spec/phases/phase-06.md, design addition 6; A-166): layer.setFonts writes
// style.fontAssetId on text layers of one campaign through writeLayer, bumps revs.style and
// variant.rev, and is its own inverse on the campaign's undo list. Open to agents.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { expectRefused, makeAssetBus } from '../assets/asset-bus'
import { insertTestAsset } from '../assets/asset-rows'
import { testDeps, TEST_NOW } from '../campaigns/campaign-deps'
import { createInput } from '../campaigns/campaign-fixture'
import { addLinkedVariant, copyRow, linkedLayerId } from '../links/linked-fixture'
import { AGENT_POLICY } from '@/main/commands/agent-policy'
import { campaignCommands } from '@/main/commands/campaign'
import { languageFontCommands } from '@/main/commands/language-font'
import { layerCommands } from '@/main/commands/layer'
import { readWireRow, readWireRows } from '@/main/db/rows'
import type { Actor } from '@/shared/schemas/events'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { VariantRow } from '@/shared/schemas/rows/variant'

type Bus = ReturnType<typeof makeAssetBus>
type Item = { layerId: string; fontAssetId: string | null }

let bus: Bus
let campaignId: string
let master: { variantId: string; text: string; background: string }
const DE = 'de'
const deText = () => linkedLayerId(DE, layer(master.text).key)

const layer = (id: string) => readWireRow(bus.db, 'layer', { id }) as LayerRow
const variant = (id: string) => readWireRow(bus.db, 'variant', { id }) as VariantRow
const fontOf = (id: string) => layer(id).style as { fontAssetId: string | null }
const setFonts = (items: Item[], actor: Actor = 'user') =>
  bus.bus.execute('layer.setFonts', { projectId: bus.projectId, items }, { actor })
const history = (step: 'undo' | 'redo') =>
  bus.user(`history.${step}`, { scope: `campaign:${campaignId}` })
const undoState = () => bus.undo.state(bus.projectId, `campaign:${campaignId}`)

function campaignLayers(id: string): LayerRow[] {
  const variants = (readWireRows(bus.db, 'variant') as VariantRow[]).map((v) => v.id)
  const directions = bus.db
    .prepare('SELECT id FROM direction WHERE campaign_id = ?')
    .all(id) as Array<{ id: string }>
  const inCampaign = new Set(
    variants.filter((v) => directions.some((d) => d.id === variant(v).directionId)),
  )
  return (readWireRows(bus.db, 'layer') as LayerRow[]).filter((l) => inCampaign.has(l.variantId))
}

beforeEach(async () => {
  const deps = testDeps()
  bus = makeAssetBus([
    ...campaignCommands(deps),
    ...layerCommands(deps),
    ...languageFontCommands(deps),
  ])
  await bus.user('campaign.create', createInput())
  campaignId = (bus.db.prepare('SELECT id FROM campaign').get() as { id: string }).id
  const layers = campaignLayers(campaignId)
  const text = layers.find((l) => l.type === 'text')
  const background = layers.find((l) => l.type === 'background')
  if (!text || !background) throw new Error('The starter template made no text or background.')
  master = { variantId: text.variantId, text: text.id, background: background.id }
  addLinkedVariant(bus.db, master.variantId, DE, { language: 'de-DE' })
  insertTestAsset(bus.db, { id: 'font', relPath: 'f.ttf', absPath: '/abs/f.ttf', kind: 'font' })
  insertTestAsset(bus.db, { id: 'font-2', relPath: 'g.ttf', absPath: '/abs/g.ttf', kind: 'font' })
  insertTestAsset(bus.db, { id: 'pic', relPath: 'p.png', absPath: '/abs/p.png' })
  insertTestAsset(bus.db, {
    id: 'ref-font',
    relPath: 'r.ttf',
    absPath: '/abs/r.ttf',
    kind: 'font',
    library: 'reference',
  })
})
afterEach(() => bus.cleanup())

// A second campaign, copied row by row from the first, with one text layer.
function otherCampaignText(): Promise<string> {
  const directionId = variant(master.variantId).directionId
  copyRow(bus.db, 'campaign', campaignId, { id: 'c-2' })
  copyRow(bus.db, 'direction', directionId, { id: 'd-2', campaign_id: 'c-2' })
  copyRow(bus.db, 'variant', master.variantId, { id: 'v-2', direction_id: 'd-2' })
  copyRow(bus.db, 'layer', master.text, { id: 'text-2', variant_id: 'v-2' })
  return Promise.resolve('text-2')
}

describe('layer.setFonts refusals [P6-9, A-166]', () => {
  type Case = [string, () => Promise<Item[]>, string, string, string?]
  it.each<Case>([
    [
      'a picture layer',
      async () => [{ layerId: master.background, fontAssetId: 'font' }],
      'INVALID_INPUT',
      'Fonts are for text layers.',
    ],
    [
      'a picture asset as the font',
      async () => [{ layerId: master.text, fontAssetId: 'pic' }],
      'INVALID_INPUT',
      'Choose a font file.',
    ],
    [
      'a font not in this project',
      async () => [{ layerId: master.text, fontAssetId: 'nowhere' }],
      'NOT_FOUND',
      'That file is not in this project.',
    ],
    [
      'a font in the reference library',
      async () => [{ layerId: master.text, fontAssetId: 'ref-font' }],
      'RULE_VIOLATION',
      'This file is in the reference library. Move it to the asset library to use it on a post.',
      'reference_library',
    ],
    [
      'an unknown layer',
      async () => [
        { layerId: master.text, fontAssetId: 'font' },
        { layerId: 'L-none', fontAssetId: 'font' },
      ],
      'NOT_FOUND',
      'That layer was not found.',
    ],
    [
      'a layer named twice',
      async () => [
        { layerId: master.text, fontAssetId: 'font' },
        { layerId: master.text, fontAssetId: null },
      ],
      'INVALID_INPUT',
      'Name each layer once.',
    ],
    [
      'layers in two campaigns',
      async () => [
        { layerId: master.text, fontAssetId: 'font' },
        { layerId: await otherCampaignText(), fontAssetId: 'font' },
      ],
      'INVALID_INPUT',
      'These layers are in different campaigns.',
    ],
  ])('refuses %s and writes nothing', async (_label, items, code, message, reason) => {
    const list = await items()
    const error = await expectRefused(bus, () => setFonts(list, 'agent'), code, reason)
    expect(error.message).toBe(message)
    expect(JSON.stringify(error)).not.toContain('/abs/')
    expect(undoState().canUndo).toBe(false)
  })
})

describe('layer.setFonts [P6-9, A-166]', () => {
  const both = (fontAssetId: string | null): Item[] => [
    { layerId: master.text, fontAssetId },
    { layerId: deText(), fontAssetId },
  ]

  it('writes the font, bumps revs.style and variant.rev once each', async () => {
    const styleRevs = [layer(master.text).revs.style, layer(deText()).revs.style]
    const revs = [variant(master.variantId).rev, variant(DE).rev]
    const result = await bus.changed(() => setFonts(both('font')))
    expect(result).toEqual({ ok: true, data: { layerIds: [master.text, deText()] } })
    expect([fontOf(master.text).fontAssetId, fontOf(deText()).fontAssetId]).toEqual([
      'font',
      'font',
    ])
    expect([layer(master.text).revs.style, layer(deText()).revs.style]).toEqual(
      styleRevs.map((r) => r + 1),
    )
    expect([variant(master.variantId).rev, variant(DE).rev]).toEqual(revs.map((r) => r + 1))
    expect(JSON.stringify(result)).not.toContain('/abs/')
  })

  it('sets a null font back to the bundled default', async () => {
    await setFonts(both('font'))
    expect(await setFonts(both(null))).toMatchObject({ ok: true })
    expect([fontOf(master.text).fontAssetId, fontOf(deText()).fontAssetId]).toEqual([null, null])
  })

  it('reports only the layers it changed, and an unchanged call adds no undo entry', async () => {
    await setFonts([{ layerId: master.text, fontAssetId: 'font' }])
    expect(await setFonts(both('font'))).toEqual({ ok: true, data: { layerIds: [deText()] } })
    const rev = variant(master.variantId).rev
    const entries = undoState()
    expect(await setFonts(both('font'))).toEqual({ ok: true, data: { layerIds: [] } })
    expect(variant(master.variantId).rev).toBe(rev)
    expect(undoState()).toEqual(entries)
  })

  it('undoes and redoes on the campaign list', async () => {
    expect(await setFonts(both('font'))).toMatchObject({ ok: true })
    expect(undoState()).toEqual({ canUndo: true, canRedo: false })
    expect(await history('undo')).toMatchObject({ ok: true })
    expect([fontOf(master.text).fontAssetId, fontOf(deText()).fontAssetId]).toEqual([null, null])
    expect(await history('redo')).toMatchObject({ ok: true })
    expect([fontOf(master.text).fontAssetId, fontOf(deText()).fontAssetId]).toEqual([
      'font',
      'font',
    ])
  })

  it('undoes to the fonts each layer had before', async () => {
    await setFonts([{ layerId: master.text, fontAssetId: 'font' }])
    await setFonts(both('font-2'))
    expect(await history('undo')).toMatchObject({ ok: true })
    expect([fontOf(master.text).fontAssetId, fontOf(deText()).fontAssetId]).toEqual(['font', null])
  })

  it('keeps style.fontAssetId in the overrides of a linked language variant', async () => {
    expect(await setFonts([{ layerId: deText(), fontAssetId: 'font' }])).toMatchObject({
      ok: true,
    })
    expect(layer(deText()).overrides).toEqual(['style.fontAssetId'])
    expect(layer(master.text).overrides).toEqual([])
  })
})

describe('layer.setFonts for an agent [P6-9, A-166]', () => {
  it('is registered with an allow policy row', () => {
    expect(languageFontCommands(testDeps()).map((h) => h.name)).toEqual(['layer.setFonts'])
    expect(AGENT_POLICY['layer.setFonts']?.policy).toBe('allow')
  })

  it('runs for the agent and stamps the variants it changed', async () => {
    const result = await setFonts([{ layerId: master.text, fontAssetId: 'font' }], 'agent')
    expect(result).toEqual({ ok: true, data: { layerIds: [master.text] } })
    expect(variant(master.variantId).agentChangedAt).toBe(TEST_NOW)
    expect(variant(DE).agentChangedAt).toBeNull()
  })
})

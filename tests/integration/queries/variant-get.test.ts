// P3-3: variant.get, the editor's one read (spec/editor-commands.md, "variant.get").
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { makeCampaignBus, insertImage, type CampaignBus } from '../campaigns/campaign-fixture'
import { testDeps } from '../campaigns/campaign-deps'
import { tableCounts } from '../campaigns/table-counts'
import { variantQueries } from '@/main/queries/variant'
import { createQueryRunner } from '@/main/queries/queries'
import type { CoreDeps } from '@/main/core-deps'
import type { VariantGet } from '@/shared/schemas/queries/variant'
import type { LayerRow } from '@/shared/schemas/rows/layer'

let bus: CampaignBus
let deps: CoreDeps
let campaignId: string
let variantId: string
const opts = { actor: 'user' as const }
const missing: string[] = []
const logLines: unknown[] = []
const cleanups: Array<() => void> = []

function depsFor(projects: CampaignBus['projects']): CoreDeps {
  return testDeps({
    projects,
    assets: { missingAssetIds: async () => [...missing] } as unknown as CoreDeps['assets'],
    log: { write: (line: unknown) => logLines.push(line) } as unknown as CoreDeps['log'],
  })
}

beforeEach(async () => {
  bus = makeCampaignBus()
  cleanups.push(() => bus.cleanup())
  missing.length = 0
  logLines.length = 0
  deps = depsFor(bus.projects)
  const made = (await bus.create()) as { data: { campaignId: string; variantId: string } }
  campaignId = made.data.campaignId
  variantId = made.data.variantId
})
afterEach(() => {
  while (cleanups.length) cleanups.pop()?.()
})

const get = async (input: Record<string, unknown> = {}, projectId = bus.projectId) =>
  (await variantQueries(deps)['variant.get']?.({ projectId, variantId, ...input }, opts)) as
    VariantGet | undefined

const setLayer = (key: string, sql: string, ...values: unknown[]) =>
  bus.db
    .prepare(`UPDATE layer SET ${sql} WHERE variant_id = ? AND key = ?`)
    .run(...values, variantId, key)

const textKey = () =>
  (bus.rows('layer') as LayerRow[]).find((l) => l.variantId === variantId && l.type === 'text')
    ?.key ?? ''

describe('variant.get [spec/editor-commands.md, variant.get]', () => {
  it('gives the variant summary as campaign.get has it, and its campaign', async () => {
    const result = await get()
    expect(result?.variant).toMatchObject({
      ...bus.rows('variant')[0],
      isMaster: true,
      subjectIds: ['bottle', 'can'],
    })
    expect(result?.variant.badges.missingFile).toBe(false)
    expect(result?.campaignId).toBe(campaignId)
  })

  it('gives the layers by z ascending, then ID', async () => {
    const layers = (bus.rows('layer') as LayerRow[]).filter((l) => l.variantId === variantId)
    const [a, b] = layers
    if (!a || !b) throw new Error('the starter template has fewer than two layers')
    bus.db.prepare('UPDATE layer SET z = 7 WHERE id IN (?, ?)').run(a.id, b.id)
    const expected = (bus.rows('layer') as LayerRow[])
      .filter((l) => l.variantId === variantId)
      .sort((x, y) => x.z - y.z || (x.id < y.id ? -1 : 1))
    expect((await get())?.layers).toEqual(expected)
  })

  it('gives each named asset once, by ID, with missing, and none for null source or font', async () => {
    insertImage(bus, { id: 'A2' })
    insertImage(bus, { id: 'A1' })
    insertImage(bus, { id: 'UNUSED' })
    missing.push('A2', 'UNUSED')
    setLayer('background', 'source = ?', JSON.stringify({ assetId: 'A2' }))
    setLayer(textKey(), "style = json_set(style, '$.fontAssetId', ?)", 'A1')
    const others = (bus.rows('layer') as LayerRow[]).filter(
      (l) => l.variantId === variantId && l.type === 'image',
    )
    for (const l of others) {
      bus.db.prepare('UPDATE layer SET source = ? WHERE id = ?').run('{"assetId":"A2"}', l.id)
    }
    const result = await get()
    const rows = bus.rows('asset')
    expect(result?.assets).toEqual([
      { ...rows.find((r) => r.id === 'A1'), missing: false },
      { ...rows.find((r) => r.id === 'A2'), missing: true },
    ])
    expect(result?.variant.badges.missingFile).toBe(true)
  })

  it.each([
    ['an unknown variant', { variantId: 'v-unknown' }, 'NOT_FOUND'],
    ['an input without a variant', { variantId: undefined }, 'INVALID_INPUT'],
    ['a project that is not open', { projectId: 'P-CLOSED' }, 'NOT_FOUND'],
  ])('refuses %s with %s', async (_name, input, code) => {
    await expect(get(input)).rejects.toMatchObject({ code })
  })

  it('says "That variant was not found." for an unknown variant', async () => {
    await expect(get({ variantId: 'v-unknown' })).rejects.toMatchObject({
      message: 'That variant was not found.',
    })
  })

  it('reads only the named project when two open projects hold the same variant ID', async () => {
    const other = makeCampaignBus()
    cleanups.push(() => other.cleanup())
    const made = (await other.create()) as { data: { variantId: string } }
    const from = made.data.variantId
    other.db.pragma('foreign_keys = OFF')
    for (const [table, column] of [
      ['variant', 'id'],
      ['layer', 'variant_id'],
      ['variant_subject', 'variant_id'],
      ['direction', 'master_variant_id'],
    ] as const) {
      other.db.prepare(`UPDATE ${table} SET ${column} = ? WHERE ${column} = ?`).run(variantId, from)
    }
    other.db.pragma('foreign_keys = ON')
    other.db.prepare("UPDATE layer SET name = 'Other' WHERE variant_id = ?").run(variantId)
    bus.projects.add(other.project)
    const mine = await get()
    const theirs = await get({}, other.projectId)
    expect(mine?.layers.every((l) => l.name !== 'Other')).toBe(true)
    expect(theirs?.layers.every((l) => l.name === 'Other')).toBe(true)
    expect(theirs?.campaignId).not.toBe(campaignId)
    bus.projects.remove(other.projectId)
  })

  it('writes nothing to the project file', async () => {
    const before = tableCounts(bus.db)
    const variants = bus.rows('variant')
    await get()
    expect(tableCounts(bus.db)).toEqual(before)
    expect(bus.rows('variant')).toEqual(variants)
  })

  it('leaves out a layer row that cannot be read, and logs its table and key only', async () => {
    setLayer('background', "style = 'not json'")
    const result = await get()
    expect(result?.layers.some((l) => l.key === 'background')).toBe(false)
    expect(logLines).toHaveLength(1)
    expect(logLines[0]).toMatchObject({ context: { table: 'layer' } })
    expect(JSON.stringify(logLines[0])).not.toContain('not json')
  })

  it('answers through the query runner for both actors', async () => {
    const run = createQueryRunner(variantQueries(deps), deps.log)
    for (const actor of ['user', 'agent'] as const) {
      const result = await run('variant.get', { projectId: bus.projectId, variantId }, { actor })
      expect(result).toMatchObject({ ok: true })
    }
  })
})

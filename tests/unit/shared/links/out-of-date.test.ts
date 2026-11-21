import { describe, it, expect } from 'vitest'
import { staleGroups, variantOutOfDate, type LinkLayer } from '@/shared/links/out-of-date'
import { followRule } from '@/shared/links/follow-rules'

const ZERO = { copy: 0, style: 0, geometry: 0, source: 0, timing: 0, animation: 0 }
const MASTER_ROW = { id: 'm', width: 1080, height: 1080, language: 'en' }
const SAME = { id: 'v', width: 1080, height: 1080, language: 'en' }
const OTHER_SIZE = { ...SAME, width: 1080, height: 1920 }
const OTHER_LANGUAGE = { ...SAME, language: 'de' }

const layer = (key: string, over: Partial<LinkLayer> = {}): LinkLayer => ({
  key,
  linked: true,
  revs: ZERO,
  syncedRevs: ZERO,
  ...over,
})
const ahead = (group: keyof typeof ZERO) => ({ ...ZERO, [group]: 1 })
const masterLayers = [layer('headline'), layer('photo')]

const cases = [
  { name: 'nothing changed', row: SAME, master: masterLayers, layers: masterLayers, out: false },
  {
    name: 'master style one ahead, same size',
    row: SAME,
    master: [layer('headline', { revs: ahead('style') }), layer('photo')],
    layers: masterLayers,
    out: true,
  },
  {
    name: 'master style one ahead, another size',
    row: OTHER_SIZE,
    master: [layer('headline', { revs: ahead('style') }), layer('photo')],
    layers: masterLayers,
    out: true,
  },
  {
    name: 'master geometry ahead, same size',
    row: SAME,
    master: [layer('headline', { revs: ahead('geometry') }), layer('photo')],
    layers: masterLayers,
    out: true,
  },
  {
    name: 'master geometry ahead, another size',
    row: OTHER_SIZE,
    master: [layer('headline', { revs: ahead('geometry') }), layer('photo')],
    layers: masterLayers,
    out: false,
  },
  {
    name: 'master copy ahead, another language (translation)',
    row: OTHER_LANGUAGE,
    master: [layer('headline', { revs: ahead('copy') }), layer('photo')],
    layers: masterLayers,
    out: true,
  },
  {
    name: 'an unlinked layer far behind',
    row: SAME,
    master: [layer('headline', { revs: { ...ZERO, style: 9, copy: 9 } }), layer('photo')],
    layers: [layer('headline', { linked: false }), layer('photo')],
    out: false,
  },
  {
    name: 'a master key the variant lacks',
    row: SAME,
    master: masterLayers,
    layers: [layer('headline')],
    out: true,
  },
  {
    name: 'a linked variant key gone from the master',
    row: SAME,
    master: masterLayers,
    layers: [...masterLayers, layer('badge')],
    out: true,
  },
  {
    name: 'an unlinked variant key not in the master',
    row: SAME,
    master: masterLayers,
    layers: [...masterLayers, layer('badge', { linked: false })],
    out: false,
  },
]

describe('variantOutOfDate [spec/links-and-sync.md, "Follow rules"; FR-081]', () => {
  it.each(cases)('$name: $out', ({ row, master, layers, out }) => {
    const input = { master: { row: MASTER_ROW, layers: master }, variant: { row, layers } }
    expect(variantOutOfDate(input)).toBe(out)
  })

  it('never marks the master itself, whatever its counters say', () => {
    const layers = [layer('headline', { revs: ahead('style') })]
    const self = { row: MASTER_ROW, layers }
    expect(variantOutOfDate({ master: self, variant: { row: MASTER_ROW, layers: [] } })).toBe(false)
  })
})

describe('staleGroups', () => {
  const rule = (row: typeof SAME) => (g: keyof typeof ZERO) => followRule(g, MASTER_ROW, row)
  it('lists each followed group the master is ahead on, in group order', () => {
    const m = layer('headline', { revs: { ...ZERO, geometry: 2, copy: 1, timing: 1 } })
    const v = layer('headline', { syncedRevs: { ...ZERO, geometry: 1 } })
    expect(staleGroups(m, v, rule(SAME))).toEqual(['copy', 'geometry', 'timing'])
    expect(staleGroups(m, v, rule(OTHER_SIZE))).toEqual(['copy', 'timing'])
  })

  it('gives nothing for a layer that is not linked', () => {
    const m = layer('headline', { revs: ahead('style') })
    expect(staleGroups(m, layer('headline', { linked: false }), rule(SAME))).toEqual([])
  })
})

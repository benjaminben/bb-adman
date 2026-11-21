import { describe, it, expect } from 'vitest'
import { slotStates, starterTemplate } from '../../../../src/shared/templates/starter'
import { LayerRow } from '../../../../src/shared/schemas/rows/layer'
import type { Template } from '../../../../src/shared/templates/types'

const zeroRevs = { copy: 0, style: 0, geometry: 0, source: 0, timing: 0, animation: 0 }
const still = { preset: 'none' as const, startMs: 0, durationMs: 0 }

// A whole, valid layer row; only the slot and type matter to slotStates.
function layer(slot: string | null, type: LayerRow['type'] = 'image'): LayerRow {
  return LayerRow.parse({
    id: `layer-${slot ?? 'none'}`,
    variantId: 'variant-1',
    key: `key-${slot ?? 'none'}`,
    type,
    slot,
    name: slot ?? 'Loose layer',
    z: 1,
    visible: true,
    locked: false,
    linked: false,
    overrides: [],
    copy: type === 'text' ? 'Hello' : null,
    style: { opacity: 1 },
    geometry: { x: 0, y: 0, width: 10, height: 10, rotation: 0, crop: null },
    source: type === 'text' ? null : { assetId: 'asset-1' },
    timing: { startMs: 0, endMs: null },
    animation: { entrance: still, exit: still },
    revs: zeroRevs,
    syncedRevs: zeroRevs,
    translationStatus: null,
    translationSource: null,
    overflow: false,
  })
}

describe('starterTemplate [SPEC 6.1, FR-040, FR-041]', () => {
  it('is the template with the ID starter', () => {
    expect(starterTemplate.id).toBe('starter')
    expect(starterTemplate.name).toBe('Starter')
  })

  it('has the five slots of Section 6.1, in order, with their types', () => {
    expect(starterTemplate.slots).toEqual([
      { id: 'background', type: 'image' },
      { id: 'subject-image', type: 'image' },
      { id: 'logo', type: 'image' },
      { id: 'headline', type: 'copy' },
      { id: 'call-to-action', type: 'copy' },
    ])
  })
})

describe('slotStates [SPEC 14 1.9 slice B shapes, FR-042]', () => {
  it('gives one entry per template slot, in the template order', () => {
    const states = slotStates(starterTemplate, [], {})
    expect(states.map((s) => s.slot)).toEqual(starterTemplate.slots)
  })

  it('marks a slot filled when a layer fills it, and empty otherwise', () => {
    const layers = [layer('background', 'background'), layer('headline', 'text')]
    const states = slotStates(starterTemplate, layers, {})
    expect(states.map((s) => [s.slot.id, s.state])).toEqual([
      ['background', 'filled'],
      ['subject-image', 'empty'],
      ['logo', 'empty'],
      ['headline', 'filled'],
      ['call-to-action', 'empty'],
    ])
  })

  it('does not count a layer that fills no slot, or a slot the template lacks', () => {
    const layers = [layer(null), layer('sticker')]
    const states = slotStates(starterTemplate, layers, {})
    expect(states.every((s) => s.state === 'empty')).toBe(true)
  })

  it('gives an image slot its candidates as given, and an empty list when it has none', () => {
    const candidates = { 'subject-image': ['asset-b', 'asset-a'], background: [] }
    const states = slotStates(starterTemplate, [], candidates)
    expect(states.map((s) => [s.slot.id, s.candidates])).toEqual([
      ['background', []],
      ['subject-image', ['asset-b', 'asset-a']],
      ['logo', []],
      ['headline', []],
      ['call-to-action', []],
    ])
  })

  it('gives a copy slot an empty list, even when candidates name it', () => {
    const states = slotStates(starterTemplate, [], { headline: ['asset-a'] })
    expect(states.find((s) => s.slot.id === 'headline')?.candidates).toEqual([])
  })

  it('keeps candidates for a filled slot', () => {
    const states = slotStates(starterTemplate, [layer('logo')], { logo: ['asset-a'] })
    expect(states.find((s) => s.slot.id === 'logo')).toEqual({
      slot: { id: 'logo', type: 'image' },
      state: 'filled',
      candidates: ['asset-a'],
    })
  })

  it('shares no list with its input', () => {
    const candidates = { logo: ['asset-a'] }
    const states = slotStates(starterTemplate, [], candidates)
    states.find((s) => s.slot.id === 'logo')?.candidates.push('asset-z')
    expect(candidates.logo).toEqual(['asset-a'])
  })

  it('works on any template, not only the starter', () => {
    const template: Template = { id: 't', name: 'T', slots: [{ id: 'only', type: 'image' }] }
    expect(slotStates(template, [layer('only')], { only: ['asset-a'] })).toEqual([
      { slot: { id: 'only', type: 'image' }, state: 'filled', candidates: ['asset-a'] },
    ])
  })
})

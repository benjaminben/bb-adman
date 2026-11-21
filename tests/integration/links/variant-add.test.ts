// P5-10 (spec/links-and-sync.md, "Fan-out"): variant.add makes one variant from the master with
// planVariant; agents may run it.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { expectRefused } from '../assets/asset-bus'
import { TALL } from '../campaigns/campaign-fixture'
import { makeFanOutBus, type FanOutBus } from './fan-out-fixture'

let bus: FanOutBus
beforeEach(async () => {
  bus = await makeFanOutBus()
})
afterEach(() => bus.cleanup())

const input = (over: Record<string, unknown> = {}) => ({
  directionId: bus.directionId,
  sizeLabel: TALL.label,
  language: 'en',
  format: 'image',
  ...over,
})
const backgroundOf = (id: string) => bus.layers(id).find((l) => l.type === 'background')

describe('variant.add [P5-10]', () => {
  it('makes one linked variant with crop', async () => {
    const result = await bus.changed(() => bus.user('variant.add', input({ fit: 'crop' })))
    const made = bus.at(TALL.label, 'en')
    expect(result).toEqual({ ok: true, data: { variantId: made?.id } })
    expect(bus.variants()).toHaveLength(1)
    expect(made).toMatchObject({ title: bus.master().title, rev: 0, createdBy: 'user' })
    expect(backgroundOf(made?.id ?? '')?.geometry).toEqual({
      x: -420,
      y: 0,
      width: 1920,
      height: 1920,
      rotation: 0,
      crop: null,
    })
    for (const l of bus.layers(made?.id ?? '')) expect(l.linked).toBe(true)
  })

  it('fits by scale when fit is left out', async () => {
    await bus.user('variant.add', input())
    expect(backgroundOf(bus.at(TALL.label, 'en')?.id ?? '')?.geometry).toMatchObject({
      x: 0,
      y: 420,
      width: 1080,
    })
  })

  it('undo removes it', async () => {
    await bus.user('variant.add', input())
    expect(await bus.changed(() => bus.history('undo'))).toMatchObject({ ok: true })
    expect(bus.variants()).toEqual([])
  })

  it('refuses a combination that exists with variant_exists', async () => {
    await bus.user('variant.add', input())
    const error = await expectRefused(
      bus,
      () => bus.user('variant.add', input()),
      'RULE_VIOLATION',
      'variant_exists',
    )
    expect(error.message).toBe(
      'This direction already has a variant at this size, language and format.',
    )
    await expectRefused(
      bus,
      () => bus.user('variant.add', input({ sizeLabel: bus.master().sizeLabel })),
      'RULE_VIOLATION',
      'variant_exists',
    )
  })

  it('refuses a size not in the campaign with not_in_campaign', async () => {
    await expectRefused(
      bus,
      () => bus.user('variant.add', input({ sizeLabel: '4x5' })),
      'RULE_VIOLATION',
      'not_in_campaign',
    )
  })

  it('lets the agent run it, with created_by agent', async () => {
    const result = await bus.agent('variant.add', input())
    expect(result).toMatchObject({ ok: true })
    expect(bus.at(TALL.label, 'en')?.createdBy).toBe('agent')
  })
})

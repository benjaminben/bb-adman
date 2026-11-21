// P5-9 (spec/links-and-sync.md, "Generative fill"; A-130, A-141): generation.applyFill places a
// finished fill on every same-size variant of the direction whose background still names the
// source, as one campaign entry undone by variant.restoreLayers.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { makeFillBus, type FillBus } from './fill-fixture'
import { TALL } from '../campaigns/campaign-fixture'
import { readLayers } from '@/main/links/snapshot'
import { denialMessage } from '@/main/commands/agent-policy'

let bus: FillBus
beforeEach(async () => {
  bus = await makeFillBus()
})
afterEach(() => bus.cleanup())

const apply = (jobId = 'J1') => bus.user('generation.applyFill', { jobId })
const CANVAS = { x: 0, y: 0, width: TALL.width, height: TALL.height, rotation: 0, crop: null }

const dump = () =>
  ['variant', 'layer'].map((t) => bus.db.prepare(`SELECT * FROM ${t} ORDER BY id`).all())

async function expectRefusal(run: () => Promise<unknown>, reason: string, message: string) {
  const before = dump()
  const events = bus.events.length
  expect(await run()).toEqual({
    ok: false,
    error: { code: 'RULE_VIOLATION', message, details: { reason } },
  })
  expect(dump()).toEqual(before)
  expect(bus.events.length).toBe(events)
  expect(bus.undo.state(bus.projectId, bus.campaignScope).canUndo).toBe(false)
}

const WRONG_STATE = 'Only a finished fill can be placed.'
const OUTDATED =
  'The background changed after the fill started, so the fill was not placed. It is in the asset library.'

describe('generation.applyFill [P5-9]', () => {
  it('places the picture on both languages at the size, over the whole canvas [A-130]', async () => {
    const before = [bus.tallEn, bus.tallDe].map((id) => bus.background(id))
    const revs = [bus.tallEn, bus.tallDe, bus.wideEn].map((id) => bus.rev(id))
    const wide = readLayers(bus.db, bus.wideEn)
    const result = await bus.changed(() => apply())
    expect(result).toEqual({ ok: true, data: { variantIds: [bus.tallEn, bus.tallDe] } })
    for (const [i, id] of [bus.tallEn, bus.tallDe].entries()) {
      const was = before[i]
      const now = bus.background(id)
      expect(now.source).toEqual({ assetId: 'F1' })
      expect(now.geometry).toEqual(CANVAS)
      expect(now.overrides).toContain('source')
      expect(now.revs.source).toBe((was?.revs.source ?? 0) + 1)
      expect(now.revs.geometry).toBe((was?.revs.geometry ?? 0) + 1)
      expect(bus.rev(id)).toBe((revs[i] ?? 0) + 1)
    }
    expect(readLayers(bus.db, bus.wideEn)).toEqual(wide)
    expect(bus.rev(bus.wideEn)).toBe(revs[2])
  })

  it("clears the changed variants' own undo lists [A-141]", async () => {
    const layerId = bus.background(bus.tallDe).id
    await bus.user('layer.update', { layerId, patch: { name: 'Own name' } })
    expect(bus.undo.state(bus.projectId, `variant:${bus.tallDe}`).canUndo).toBe(true)
    await apply()
    expect(bus.undo.state(bus.projectId, `variant:${bus.tallDe}`)).toEqual({
      canUndo: false,
      canRedo: false,
    })
  })

  it('leaves a variant whose background changed, and with none left refuses fill_outdated', async () => {
    const other = (id: string) =>
      bus.db
        .prepare(`UPDATE layer SET source = '{"assetId":"F1"}' WHERE id = ?`)
        .run(bus.background(id).id)
    other(bus.tallDe)
    const de = readLayers(bus.db, bus.tallDe)
    expect(await apply()).toEqual({ ok: true, data: { variantIds: [bus.tallEn] } })
    expect(readLayers(bus.db, bus.tallDe)).toEqual(de)
    await bus.user('history.undo', { scope: bus.campaignScope })
    other(bus.tallEn)
    await expectRefusal(() => apply(), 'fill_outdated', OUTDATED)
  })

  it.each([
    ['whose source is an override', `overrides = '["source"]'`],
    ['whose background is not linked', 'linked = 0'],
  ])('leaves another variant %s', async (_name, set) => {
    bus.db.prepare(`UPDATE layer SET ${set} WHERE id = ?`).run(bus.background(bus.tallDe).id)
    expect(await apply()).toEqual({ ok: true, data: { variantIds: [bus.tallEn] } })
  })

  it.each([
    ['a failed fill', 'J2', { status: 'failed', result: null }],
    ['a running fill', 'J2', { status: 'running', result: null }],
    ['a job that is not a fill', 'J2', { kind: 'image_generation' }],
    ['a fill with no picture in its result', 'J2', { result: { assetIds: [] } }],
    ['a fill whose picture is not in the project', 'J2', { result: { assetIds: ['NOPE'] } }],
    ['a job not in this project', 'NOPE', null],
  ])('%s is job_wrong_state', async (_name, jobId, over) => {
    if (over) bus.addJob(jobId, over)
    await expectRefusal(() => apply(jobId), 'job_wrong_state', WRONG_STATE)
  })

  it('one undo puts both backgrounds back', async () => {
    const before = [bus.tallEn, bus.tallDe].map((id) => readLayers(bus.db, id))
    await apply()
    expect(await bus.user('history.undo', { scope: bus.campaignScope })).toMatchObject({
      ok: true,
    })
    expect([bus.tallEn, bus.tallDe].map((id) => readLayers(bus.db, id))).toEqual(before)
  })

  it('is denied to the agent', async () => {
    const before = dump()
    expect(await bus.agent('generation.applyFill', { jobId: 'J1' })).toEqual({
      ok: false,
      error: { code: 'AGENT_DENIED', message: denialMessage('generation.applyFill') },
    })
    expect(dump()).toEqual(before)
  })
})

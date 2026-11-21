// P5-4 (spec/links-and-sync.md, "Adding back and removing variants", A-140, A-141):
// variant.delete and its inverse variant.restore on the campaign list, and variant.remove.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { expectRefused } from '../assets/asset-bus'
import { readSnapshot } from '@/main/links/snapshot'
import { addVariant, makeVariantBus, V2, type VariantBus } from './variant-fixture'

let bus: VariantBus
beforeEach(async () => {
  bus = await makeVariantBus()
})
afterEach(() => bus.cleanup())

const remove = (variantId: string) => bus.user('variant.delete', { variantId })

function insertJob(id: string, status: string, variantId = V2) {
  bus.db
    .prepare(
      `INSERT INTO job (id, kind, status, variant_id, request, created_at, updated_at)
       VALUES (?, 'image_generation', ?, ?, '{}', 'x', 'x')`,
    )
    .run(id, status, variantId)
}

describe('variant.delete [FR-073, FR-197, R-17]', () => {
  it('removes the variant and its rows, names them, and replies with its ID', async () => {
    const result = await bus.changed(() => remove(V2))
    expect(result).toEqual({ ok: true, data: { variantId: V2 } })
    expect(bus.variant(V2)).toBeNull()
    expect(bus.db.prepare('SELECT 1 FROM layer WHERE variant_id = ?').get(V2)).toBeUndefined()
  })

  it('undo brings the variant back with its layers and rev; redo deletes it again', async () => {
    const before = readSnapshot(bus.db, V2)
    expect(await remove(V2)).toMatchObject({ ok: true })
    expect(await bus.changed(() => bus.history('undo'))).toMatchObject({ ok: true })
    expect(readSnapshot(bus.db, V2)).toEqual(before)
    expect(bus.variant(V2)?.rev).toBe(7)
    expect(await bus.changed(() => bus.history('redo'))).toMatchObject({ ok: true })
    expect(bus.variant(V2)).toBeNull()
    expect(bus.undoState()).toEqual({ canUndo: true, canRedo: false })
  })

  it("clears the variant's own list on delete", async () => {
    expect(await bus.user('variant.update', { variantId: V2, title: 'New' })).toMatchObject({
      ok: true,
    })
    expect(bus.undoState(`variant:${V2}`)).toEqual({ canUndo: true, canRedo: false })
    await remove(V2)
    expect(bus.undoState(`variant:${V2}`)).toEqual({ canUndo: false, canRedo: false })
  })

  it('refuses a master with master_variant and writes nothing', async () => {
    const error = await expectRefused(
      bus,
      () => remove(bus.masterId),
      'RULE_VIOLATION',
      'master_variant',
    )
    expect(error.message).toBe('A master cannot be deleted while its direction exists.')
    expect(bus.undoState()).toEqual({ canUndo: false, canRedo: false })
  })

  it.each(['queued', 'running'])('refuses with jobs_running while a job is %s', async (status) => {
    insertJob('J1', status)
    const error = await expectRefused(bus, () => remove(V2), 'RULE_VIOLATION', 'jobs_running')
    expect(error.message).toBe(
      'Work is still running for this variant. Stop it, or wait for it to finish.',
    )
  })

  it('keeps ended job rows after the delete', async () => {
    insertJob('J1', 'succeeded')
    insertJob('J2', 'failed')
    expect(await remove(V2)).toMatchObject({ ok: true })
    const jobs = bus.db.prepare('SELECT id, variant_id FROM job ORDER BY id').all()
    expect(jobs).toEqual([
      { id: 'J1', variant_id: V2 },
      { id: 'J2', variant_id: V2 },
    ])
  })

  it('refuses an unknown ID with NOT_FOUND', async () => {
    const error = await expectRefused(bus, () => remove('no-such'), 'NOT_FOUND')
    expect(error.message).toBe('That variant was not found.')
  })

  it('goes to ask for the agent, and writes nothing when the ask is refused', async () => {
    const result = await bus.agent('variant.delete', { variantId: V2 })
    expect(result).toMatchObject({ ok: false, error: { code: 'AGENT_REFUSED' } })
    expect(bus.asked).toHaveLength(1)
    expect(bus.asked[0]).toMatchObject({ command: 'variant.delete' })
    expect(bus.variant(V2)).not.toBeNull()
  })
})

describe('variant.remove [system]', () => {
  it('removes several variants and its inverse brings them all back', async () => {
    addVariant(bus.db, bus.masterId, 'V3', '16x9')
    const before = [readSnapshot(bus.db, V2), readSnapshot(bus.db, 'V3')]
    const result = await bus.changed(() => bus.user('variant.remove', { variantIds: [V2, 'V3'] }))
    expect(result).toEqual({ ok: true, data: { variantIds: [V2, 'V3'] } })
    expect(bus.variant(V2)).toBeNull()
    expect(await bus.history('undo')).toMatchObject({ ok: true })
    expect([readSnapshot(bus.db, V2), readSnapshot(bus.db, 'V3')]).toEqual(before)
  })

  it('checks every ID before any write', async () => {
    insertJob('J1', 'running', bus.masterId)
    await expectRefused(
      bus,
      () => bus.user('variant.remove', { variantIds: [V2, bus.masterId] }),
      'RULE_VIOLATION',
      'master_variant',
    )
    await expectRefused(
      bus,
      () => bus.user('variant.remove', { variantIds: [V2, 'no-such'] }),
      'NOT_FOUND',
    )
  })

  it('is denied to the agent without an ask', async () => {
    const result = await bus.agent('variant.remove', { variantIds: [V2] })
    expect(result).toMatchObject({ ok: false, error: { code: 'AGENT_DENIED' } })
    expect(bus.asked).toEqual([])
    expect(bus.variant(V2)).not.toBeNull()
  })
})

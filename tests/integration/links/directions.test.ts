// P5-11 (spec/links-and-sync.md, "Directions", A-139, A-140): direction.createFromMaster,
// direction.rename and direction.delete. Stakeholder change: a create and a delete record no
// undo; a delete clears the campaign's list and the removed variants' own lists.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { expectRefused } from '../assets/asset-bus'
import { layersOf } from './linked-fixture'
import { addVariant, V2 } from './variant-fixture'
import { makeDirectionBus, type DirectionBus } from './direction-fixture'
import { denialMessage } from '@/main/commands/agent-policy'
import { readSnapshot } from '@/main/links/snapshot'

type Reply = { ok: boolean; data?: Record<string, string> }

let bus: DirectionBus
beforeEach(async () => {
  bus = await makeDirectionBus()
})
afterEach(() => bus.cleanup())

const create = (name: string, masterVariantId = bus.masterId) =>
  bus.user('direction.createFromMaster', { masterVariantId, name }) as Promise<Reply>

async function second(name = 'Bold'): Promise<{ directionId: string; variantId: string }> {
  const result = await create(name)
  expect(result.ok).toBe(true)
  return result.data as { directionId: string; variantId: string }
}

function insertJob(id: string, status: string, variantId: string) {
  bus.db
    .prepare(
      `INSERT INTO job (id, kind, status, variant_id, request, created_at, updated_at)
       VALUES (?, 'image_generation', ?, ?, '{}', 'x', 'x')`,
    )
    .run(id, status, variantId)
}

describe('direction.createFromMaster [FR-074, A-139]', () => {
  it('copies the master as the new master: keys, values, subjects, clips, unlinked', async () => {
    const result = (await bus.changed(() => create('  Bold  '))) as Reply
    expect(result.ok).toBe(true)
    const { directionId = '', variantId = '' } = result.data ?? {}
    expect(Object.keys(result.data ?? {}).sort()).toEqual(['directionId', 'variantId'])
    expect(bus.direction(directionId)).toEqual({
      id: directionId,
      campaignId: bus.campaignId,
      name: 'Bold',
      masterVariantId: variantId,
      sort: 1,
    })
    const from = readSnapshot(bus.db, bus.masterId)
    const made = readSnapshot(bus.db, variantId)
    expect(made?.variant).toMatchObject({
      directionId,
      sizeLabel: from?.variant.sizeLabel,
      language: from?.variant.language,
    })
    expect(made?.subjectIds).toEqual(from?.subjectIds)
    expect(made?.subjectIds.length).toBeGreaterThan(0)
    const strip = (l: Record<string, unknown>) => {
      const { id: _id, variantId: _v, linked: _l, overrides: _o, ...rest } = l
      return rest
    }
    expect(made?.layers.map(strip)).toEqual(from?.layers.map(strip))
    for (const layer of made?.layers ?? []) {
      expect(layer).toMatchObject({ variantId, linked: false, overrides: [] })
      expect(from?.layers.map((l) => l.id)).not.toContain(layer.id)
    }
    expect(made?.clips.map(({ id: _i, variantId: _v, ...c }) => c)).toEqual(
      from?.clips.map(({ id: _i, variantId: _v, ...c }) => c),
    )
    expect(made?.clips[0]?.id).not.toBe('M-clip')
  })

  it('puts each new direction one above the highest sort', async () => {
    await second('Bold')
    const { directionId } = await second('Calm')
    expect(bus.direction(directionId)?.sort).toBe(2)
  })

  it('records no undo entry', async () => {
    await second()
    expect(bus.undoState()).toEqual({ canUndo: false, canRedo: false })
  })

  it('refuses a variant that is not a master with not_a_master', async () => {
    const error = await expectRefused(
      bus,
      () => create('Bold', V2),
      'RULE_VIOLATION',
      'not_a_master',
    )
    expect(error.message).toBe('Only a master can start a new direction.')
    await expectRefused(bus, () => create('Bold', 'no-such'), 'NOT_FOUND')
  })

  it.each([' direction 1 ', 'DIRECTION 1'])(
    'refuses the taken name %j with direction_name_taken',
    async (name) => {
      const error = await expectRefused(
        bus,
        () => create(name),
        'RULE_VIOLATION',
        'direction_name_taken',
      )
      expect(error.message).toBe('This campaign already has a direction with that name.')
    },
  )
})

describe('direction.rename [A-139]', () => {
  const rename = (directionId: string, name: string) =>
    bus.user('direction.rename', { directionId, name })

  it('renames, keeps its own name free, and undo puts the old name back', async () => {
    expect(await bus.changed(() => rename(bus.directionId, ' DIRECTION 1 '))).toEqual({
      ok: true,
      data: { directionId: bus.directionId },
    })
    expect(bus.direction(bus.directionId)?.name).toBe('DIRECTION 1')
    expect(await bus.history('undo')).toMatchObject({ ok: true })
    expect(bus.direction(bus.directionId)?.name).toBe('Direction 1')
  })

  it("refuses another direction's name and an unknown direction", async () => {
    await second('Bold')
    await expectRefused(
      bus,
      () => rename(bus.directionId, 'bold'),
      'RULE_VIOLATION',
      'direction_name_taken',
    )
    const error = await expectRefused(bus, () => rename('no-such', 'X'), 'NOT_FOUND')
    expect(error.message).toBe('That direction was not found.')
  })
})

describe('direction.delete [A-140]', () => {
  const remove = (directionId: string) => bus.user('direction.delete', { directionId })

  it('removes the direction and its variants, and leaves nothing to undo', async () => {
    const made = await second()
    addVariant(bus.db, made.variantId, 'V9')
    expect(
      await bus.user('direction.rename', { directionId: made.directionId, name: 'B' }),
    ).toMatchObject({ ok: true })
    expect(await bus.user('variant.update', { variantId: 'V9', title: 'T' })).toMatchObject({
      ok: true,
    })
    expect(bus.undoState()).toEqual({ canUndo: true, canRedo: false })
    expect(bus.undoState('variant:V9')).toEqual({ canUndo: true, canRedo: false })
    expect(await bus.changed(() => remove(made.directionId))).toEqual({
      ok: true,
      data: { directionId: made.directionId },
    })
    expect(bus.direction(made.directionId)).toBeNull()
    for (const id of [made.variantId, 'V9']) {
      expect(readSnapshot(bus.db, id)).toBeNull()
      expect(layersOf(bus.db, id)).toEqual([])
    }
    expect(bus.direction(bus.directionId)).not.toBeNull()
    expect(bus.undoState()).toEqual({ canUndo: false, canRedo: false })
    expect(bus.undoState('variant:V9')).toEqual({ canUndo: false, canRedo: false })
  })

  it("refuses the campaign's last direction with last_direction", async () => {
    const error = await expectRefused(
      bus,
      () => remove(bus.directionId),
      'RULE_VIOLATION',
      'last_direction',
    )
    expect(error.message).toBe('A campaign keeps at least one direction.')
  })

  it.each(['queued', 'running'])('refuses with jobs_running while a job is %s', async (status) => {
    await second()
    insertJob('J1', status, V2)
    const error = await expectRefused(
      bus,
      () => remove(bus.directionId),
      'RULE_VIOLATION',
      'jobs_running',
    )
    expect(error.message).toBe(
      'Work is still running for this direction. Stop it, or wait for it to finish.',
    )
  })

  it('refuses an unknown direction with NOT_FOUND', async () => {
    await expectRefused(bus, () => remove('no-such'), 'NOT_FOUND')
  })
})

describe('the direction commands as the agent', () => {
  it.each([
    ['direction.createFromMaster', () => ({ masterVariantId: bus.masterId, name: 'Bold' })],
    ['direction.rename', () => ({ directionId: bus.directionId, name: 'Bold' })],
    ['direction.delete', () => ({ directionId: bus.directionId })],
  ])('%s is AGENT_DENIED and writes nothing', async (name, input) => {
    const before = bus.direction(bus.directionId)
    expect(await bus.agent(name, input())).toEqual({
      ok: false,
      error: { code: 'AGENT_DENIED', message: denialMessage(name) },
    })
    expect(bus.direction(bus.directionId)).toEqual(before)
    expect(bus.db.prepare('SELECT COUNT(*) AS n FROM direction').get()).toEqual({ n: 1 })
  })
})

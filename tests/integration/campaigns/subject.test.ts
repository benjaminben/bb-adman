import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { subjectCommands } from '@/main/commands/subject'
import { makeAssetBus, expectRefused } from '../assets/asset-bus'
import { insertCampaign, insertAsset } from '../row-fixtures'
import { seedVariant } from '../assets/usage-rows'
import { testDeps } from './campaign-deps'

let bus: ReturnType<typeof makeAssetBus>
beforeEach(() => {
  bus = makeAssetBus(subjectCommands(testDeps()))
})
afterEach(() => bus.cleanup())

const subjects = () => bus.db.prepare('SELECT * FROM subject ORDER BY id').all()

describe('subject.create [SPEC 4.2, FR-011]', () => {
  it('stores the subject with its ID, trimmed name, description and time', async () => {
    const result = await bus.changed(() =>
      bus.user('subject.create', { id: 'bottle_1', name: '  Bottle ', description: 'Green' }),
    )
    expect(result).toEqual({ ok: true, data: { subjectId: 'bottle_1' } })
    expect(subjects()).toEqual([
      {
        id: 'bottle_1',
        name: 'Bottle',
        description: 'Green',
        created_at: '2026-11-20T10:00:00.000Z',
      },
    ])
  })

  it('stores an empty description when none is given', async () => {
    await bus.user('subject.create', { id: 'can', name: 'Can' })
    expect(subjects()).toMatchObject([{ id: 'can', description: '' }])
  })

  it('refuses an ID already in the project with RULE_VIOLATION', async () => {
    await bus.user('subject.create', { id: 'can', name: 'Can' })
    await expectRefused(
      bus,
      () => bus.user('subject.create', { id: 'can', name: 'Other' }),
      'RULE_VIOLATION',
    )
  })

  it.each(['', 'has space', 'a'.repeat(65), 'dot.id', 'ü'])(
    'refuses the ID %j with INVALID_INPUT [SPEC 3.2]',
    async (id) => {
      await expectRefused(bus, () => bus.user('subject.create', { id, name: 'X' }), 'INVALID_INPUT')
    },
  )

  it('refuses a name made only of spaces', async () => {
    await expectRefused(
      bus,
      () => bus.user('subject.create', { id: 'x', name: '   ' }),
      'INVALID_INPUT',
    )
  })

  it('accepts an ID of 64 characters', async () => {
    const id = 'A-z_9'.repeat(12) + 'abcd'
    expect(await bus.user('subject.create', { id, name: 'X' })).toMatchObject({ ok: true })
  })
})

describe('subject.update [SPEC 4.2, FR-011]', () => {
  beforeEach(async () => {
    await bus.user('subject.create', { id: 'can', name: 'Can', description: 'Red' })
  })

  it('changes only the fields it is given', async () => {
    const result = await bus.changed(() =>
      bus.user('subject.update', { subjectId: 'can', name: ' Tin ' }),
    )
    expect(result).toEqual({ ok: true, data: { subjectId: 'can' } })
    expect(subjects()).toMatchObject([{ id: 'can', name: 'Tin', description: 'Red' }])
    await bus.user('subject.update', { subjectId: 'can', description: '' })
    expect(subjects()).toMatchObject([{ id: 'can', name: 'Tin', description: '' }])
  })

  it('answers NOT_FOUND for a subject the project does not hold', async () => {
    await expectRefused(
      bus,
      () => bus.user('subject.update', { subjectId: 'nope', name: 'X' }),
      'NOT_FOUND',
    )
  })
})

describe('subject.delete [SPEC 4.2, FR-197]', () => {
  beforeEach(async () => {
    await bus.user('subject.create', { id: 'can', name: 'Can' })
  })

  it('removes the subject and leaves its files with no subject', async () => {
    insertAsset(bus.db, { id: 'A1', subjectId: 'can' })
    const result = await bus.changed(() => bus.user('subject.delete', { subjectId: 'can' }))
    expect(result).toEqual({ ok: true, data: { subjectId: 'can' } })
    expect(subjects()).toEqual([])
    expect(bus.db.prepare('SELECT subject_id FROM asset').get()).toEqual({ subject_id: null })
  })

  it('is refused with RULE_VIOLATION while a campaign uses it', async () => {
    insertCampaign(bus.db, 'c1')
    bus.db.prepare("INSERT INTO campaign_subject VALUES ('c1', 'can')").run()
    await expectRefused(
      bus,
      () => bus.user('subject.delete', { subjectId: 'can' }),
      'RULE_VIOLATION',
    )
  })

  it('is refused with RULE_VIOLATION while a variant uses it', async () => {
    seedVariant(bus.db)
    bus.db.prepare("INSERT INTO variant_subject VALUES ('v23456', 'can')").run()
    await expectRefused(
      bus,
      () => bus.user('subject.delete', { subjectId: 'can' }),
      'RULE_VIOLATION',
    )
  })

  it('answers NOT_FOUND for a subject the project does not hold', async () => {
    await expectRefused(bus, () => bus.user('subject.delete', { subjectId: 'x' }), 'NOT_FOUND')
  })

  it('is not undoable', async () => {
    await bus.user('subject.delete', { subjectId: 'can' })
    expect(bus.undo.state(bus.projectId, 'campaign:c1')).toEqual({
      canUndo: false,
      canRedo: false,
    })
  })
})

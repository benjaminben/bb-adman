import { describe, it, expect, afterEach } from 'vitest'
import { z } from 'zod'
import { defineCommand } from '../../../src/main/commands/types'
import { makeMultiBus } from './multi-bus'
import { expectChanges } from '../expect-changes'
import { insertAsset, insertCampaign } from '../row-fixtures'

let fixture: ReturnType<typeof makeMultiBus> | undefined
afterEach(() => fixture?.cleanup())

const input = z.object({ projectId: z.string(), id: z.string() })

// Test-only commands that write real tables and name the rows they touch.
const handlers = () => [
  defineCommand({
    name: 'subject.create',
    input,
    projectId: (i) => i.projectId,
    run(ctx, i) {
      ctx.project.db
        .prepare("INSERT INTO subject (id, name, created_at) VALUES (?, 'Shoe', 'x')")
        .run(i.id)
      ctx.changes.touch('subject', { id: i.id })
      return { data: null }
    },
  }),
  defineCommand({
    name: 'subject.delete',
    input,
    projectId: (i) => i.projectId,
    run(ctx, i) {
      const db = ctx.project.db
      const assets = db.prepare('SELECT id FROM asset WHERE subject_id = ?').all(i.id) as Array<{
        id: string
      }>
      db.prepare('DELETE FROM subject WHERE id = ?').run(i.id)
      for (const a of assets) ctx.changes.touch('asset', a)
      ctx.changes.touch('subject', { id: i.id })
      return { data: null }
    },
  }),
  defineCommand({
    name: 'campaign.create',
    input,
    projectId: (i) => i.projectId,
    run(ctx, i) {
      insertCampaign(ctx.project.db, i.id, { languages: 'not json' })
      ctx.changes.touch('campaign', { id: i.id })
      return { data: null }
    },
  }),
  defineCommand({
    name: 'campaign.rename',
    input,
    projectId: (i) => i.projectId,
    run() {
      return { data: null }
    },
  }),
]

function setup() {
  fixture = makeMultiBus({ count: 1, handlers })
  const [p] = fixture.projects
  if (!p) throw new Error('project expected')
  return { f: fixture, p, target: { db: p.db, events: fixture.events, projectId: p.projectId } }
}

describe('project.changed rows: touch, then the bus reads them back [SPEC 4.4]', () => {
  it('sends a touched row that is there as the whole stored row in wire form', async () => {
    const { f, p, target } = setup()
    await expectChanges(target, () =>
      f.bus.execute('subject.create', { projectId: p.projectId, id: 's1' }, { actor: 'user' }),
    )
    expect(f.events[0]).toEqual({
      name: 'project.changed',
      payload: {
        projectId: p.projectId,
        changed: { subject: [{ id: 's1', name: 'Shoe', description: '', createdAt: 'x' }] },
        removed: {},
        actor: 'user',
      },
    })
  })

  it('sends a touched row that is gone as a removed key, and rows SQLite changed by itself', async () => {
    const { f, p, target } = setup()
    p.db.prepare("INSERT INTO subject (id, name, created_at) VALUES ('s1', 'Shoe', 'x')").run()
    insertAsset(p.db, { id: 'a1', subjectId: 's1' })
    await expectChanges(target, () =>
      f.bus.execute('subject.delete', { projectId: p.projectId, id: 's1' }, { actor: 'user' }),
    )
    const event = f.events[0]
    expect(event?.name === 'project.changed' && event.payload.removed).toEqual({ subject: ['s1'] })
    expect(event?.name === 'project.changed' && event.payload.changed.asset?.[0]).toMatchObject({
      id: 'a1',
      subjectId: null,
    })
  })

  it('emits no event for a command that changed nothing', async () => {
    const { f, p, target } = setup()
    await expectChanges(target, () =>
      f.bus.execute('campaign.rename', { projectId: p.projectId, id: 'c1' }, { actor: 'user' }),
    )
    expect(f.events).toEqual([])
  })

  it('returns INTERNAL, writes nothing and emits nothing when a touched row cannot be read', async () => {
    const { f, p } = setup()
    const result = await f.bus.execute(
      'campaign.create',
      { projectId: p.projectId, id: 'c1' },
      { actor: 'user' },
    )
    expect(result).toMatchObject({ ok: false, error: { code: 'INTERNAL' } })
    expect(p.db.prepare('SELECT COUNT(*) AS n FROM campaign').get()).toEqual({ n: 0 })
    expect(f.events).toEqual([])
  })
})

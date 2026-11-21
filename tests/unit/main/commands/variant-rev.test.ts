// The variant.rev helper (Phase 2 leftovers, Group 2; FR-239): bumps rev, and stamps
// agent_changed_at only when the agent made the change.
import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { bumpVariantRev } from '@/main/commands/variant-rev'
import type { ProjectContext } from '@/main/commands/types'
import type { Actor } from '@/shared/schemas/events'

const NOW = '2026-11-21T10:00:00.000Z'
let db: Database.Database
afterEach(() => db.close())

function context(actor: Actor) {
  db = new Database(':memory:')
  db.exec(`CREATE TABLE variant (id TEXT PRIMARY KEY, rev INTEGER NOT NULL DEFAULT 0,
    agent_changed_at TEXT)`)
  db.prepare("INSERT INTO variant (id, rev) VALUES ('v1', 3), ('v2', 0)").run()
  const touched: Array<[string, Record<string, unknown>]> = []
  const ctx = {
    actor,
    commandId: 'c1',
    project: { db },
    changes: { touch: (table: string, key: Record<string, unknown>) => touched.push([table, key]) },
  } as unknown as ProjectContext
  return { ctx, touched }
}

const row = (id: string) =>
  db.prepare('SELECT rev, agent_changed_at AS agentChangedAt FROM variant WHERE id = ?').get(id)

describe('bumpVariantRev [FR-239]', () => {
  it('as the user: adds one to rev, leaves agent_changed_at, and names the variant changed', () => {
    const { ctx, touched } = context('user')
    bumpVariantRev(ctx, 'v1', NOW)
    expect(row('v1')).toEqual({ rev: 4, agentChangedAt: null })
    expect(row('v2')).toEqual({ rev: 0, agentChangedAt: null })
    expect(touched).toEqual([['variant', { id: 'v1' }]])
  })

  it('as the agent: adds one to rev and stamps agent_changed_at with the time given', () => {
    const { ctx, touched } = context('agent')
    bumpVariantRev(ctx, 'v1', NOW)
    expect(row('v1')).toEqual({ rev: 4, agentChangedAt: NOW })
    expect(row('v2')).toEqual({ rev: 0, agentChangedAt: null })
    expect(touched).toEqual([['variant', { id: 'v1' }]])
  })

  it('as the user after the agent: keeps the last agent time', () => {
    const { ctx } = context('user')
    db.prepare("UPDATE variant SET agent_changed_at = 'earlier' WHERE id = 'v1'").run()
    bumpVariantRev(ctx, 'v1', NOW)
    expect(row('v1')).toEqual({ rev: 4, agentChangedAt: 'earlier' })
  })
})

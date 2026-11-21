// Test helper for slice A commands: a bus over one project with the given handlers, and the
// SPEC 10.1 refusal checks. Not a test file itself.
import { expect } from 'vitest'
import type Database from 'better-sqlite3'
import { makeBusFixture } from '../commands/test-bus'
import type { CommandHandler } from '../../../src/main/commands/types'
import { expectChanges } from '../expect-changes'

export function makeAssetBus(handlers: CommandHandler[]) {
  const f = makeBusFixture(handlers)
  const project = f.projects.requireOpen(f.projectId)
  const user = (name: string, input: Record<string, unknown>) =>
    f.bus.execute(name, { projectId: f.projectId, ...input }, { actor: 'user' })
  return {
    ...f,
    project,
    db: project.db,
    user,
    // SPEC 10.1 rule 1: the success test uses expect-changes.
    changed: (run: () => Promise<unknown>) =>
      expectChanges({ db: project.db, events: f.events, projectId: f.projectId }, run),
  }
}

function dump(db: Database.Database): string {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all() as Array<{ name: string }>
  return JSON.stringify(tables.map((t) => db.prepare(`SELECT * FROM "${t.name}"`).all()))
}

// SPEC 10.1 rule 4: the exact code, the reason when one is defined, nothing written and no
// project.changed. Asset commands are not undoable (SPEC 4.2), so no undo entry can appear.
export async function expectRefused(
  bus: ReturnType<typeof makeAssetBus>,
  run: () => Promise<unknown>,
  code: string,
  reason?: string,
): Promise<{ code: string; message: string; details?: Record<string, unknown> }> {
  const before = dump(bus.db)
  const events = bus.events.length
  const result = (await run()) as {
    ok: boolean
    error: { code: string; message: string; details?: Record<string, unknown> }
  }
  expect(result.ok).toBe(false)
  expect(result.error.code).toBe(code)
  if (reason) expect(result.error.details?.reason).toBe(reason)
  expect(dump(bus.db)).toBe(before)
  expect(bus.events.slice(events).filter((e) => e.name === 'project.changed')).toEqual([])
  return result.error
}

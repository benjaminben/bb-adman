// The tests SPEC 10.1 names for Phase 1. The INTERNAL test is in internal.test.ts.
import { describe, it, expect, afterEach } from 'vitest'
import { z } from 'zod'
import type Database from 'better-sqlite3'
import { defineCommand } from '../../../src/main/commands/types'
import { AppError } from '../../../src/shared/schemas/result'
import { makeMultiBus, refusableSet, TEST_SCOPE } from './multi-bus'
import { VALID_BRIEF } from '../row-fixtures'

let fixture: ReturnType<typeof makeMultiBus> | undefined
afterEach(() => fixture?.cleanup())

const user = { actor: 'user' as const }

function setupOne() {
  fixture = makeMultiBus({ count: 1, handlers: (ctl) => [refusableSet(ctl)] })
  const [p] = fixture.projects
  if (!p) throw new Error('project expected')
  const f = fixture
  const run = (name: string, input: Record<string, unknown> = {}) =>
    f.bus.execute(name, { projectId: p.projectId, scope: TEST_SCOPE, ...input }, user)
  const set = (value: string) => run('layer.update', { value })
  return { f, p, run, set }
}

describe('a refused undo or redo keeps its entry [SPEC 4.2, 10.1; FR-095]', () => {
  it('a refused undo leaves the entry in its place on the undo list and the redo list unchanged', async () => {
    const { f, p, run, set } = setupOne()
    for (const v of ['a', 'b', 'c']) await set(v)
    await run('history.undo')
    expect(p.value()).toBe('b')

    f.ctl.refuse = true
    expect(await run('history.undo')).toMatchObject({
      ok: false,
      error: { code: 'RULE_VIOLATION', message: 'Refused by the test.' },
    })
    expect(p.value()).toBe('b')
    f.ctl.refuse = false

    // The undo list still has its entry on top, and the redo list still holds "c".
    expect((await run('history.undo')).ok).toBe(true)
    expect(p.value()).toBe('a')
    await run('history.redo')
    expect(p.value()).toBe('b')
    await run('history.redo')
    expect(p.value()).toBe('c')
    expect(f.undo.state(p.projectId, TEST_SCOPE)).toEqual({ canUndo: true, canRedo: false })
  })

  it('a refused redo leaves the entry in its place on the redo list and the undo list unchanged', async () => {
    const { f, p, run, set } = setupOne()
    for (const v of ['a', 'b', 'c']) await set(v)
    await run('history.undo')
    await run('history.undo')
    expect(p.value()).toBe('a')

    f.ctl.refuse = true
    expect(await run('history.redo')).toMatchObject({
      ok: false,
      error: { code: 'RULE_VIOLATION', message: 'Refused by the test.' },
    })
    expect(p.value()).toBe('a')
    f.ctl.refuse = false

    // The undo list still ends with the entry back to "", and the redo list still holds b, c.
    expect((await run('history.undo')).ok).toBe(true)
    expect(p.value()).toBe('')
    expect(f.undo.state(p.projectId, TEST_SCOPE).canUndo).toBe(false)
    for (const v of ['a', 'b', 'c']) {
      await run('history.redo')
      expect(p.value()).toBe(v)
    }
  })
})

const VARIANT_ID = 'v-shared'
const titleInput = z.object({ projectId: z.string(), variantId: z.string(), title: z.string() })

// A test-only stand-in for variant.update: finds the variant inside the named project only.
const setTitle = defineCommand({
  name: 'variant.update',
  input: titleInput,
  projectId: (i) => i.projectId,
  run(ctx, i) {
    const changed = ctx.project.db
      .prepare('UPDATE variant SET title = ? WHERE id = ?')
      .run(i.title, i.variantId)
    if (changed.changes === 0) throw new AppError('NOT_FOUND', 'No variant with that ID.')
    return { data: { title: i.title } }
  },
})

function seedVariant(db: Database.Database): void {
  db.exec(`
    INSERT INTO campaign (id, name, region, audience, message, primary_language, languages, sizes, template_id, brief, created_by, created_at)
      VALUES ('c1', 'C', 'US', 'all', 'Hello', 'en', '["en"]', '[]', 't', '${JSON.stringify(VALID_BRIEF)}', 'user', 'x');
    INSERT INTO direction (id, campaign_id, name, master_variant_id, sort) VALUES ('d1', 'c1', 'D', '${VARIANT_ID}', 0);
    INSERT INTO variant (id, direction_id, title, width, height, size_label, language, format, duration_ms, created_by, created_at)
      VALUES ('${VARIANT_ID}', 'd1', 'Original', 1080, 1080, '1:1', 'en', 'image', 0, 'user', 'x');
  `)
}

const titleOf = (db: Database.Database) =>
  (db.prepare('SELECT title FROM variant WHERE id = ?').get(VARIANT_ID) as { title: string }).title

describe('two open projects with the same variant ID [SPEC 4.1, 10.1]', () => {
  it('a command naming one project changes only that project', async () => {
    fixture = makeMultiBus({ count: 3, handlers: () => [setTitle] })
    const [a, b, c] = fixture.projects
    if (!a || !b || !c) throw new Error('three projects expected')
    seedVariant(a.db)
    seedVariant(b.db)

    const result = await fixture.bus.execute(
      'variant.update',
      { projectId: b.projectId, variantId: VARIANT_ID, title: 'Changed' },
      user,
    )

    expect(result.ok).toBe(true)
    expect(titleOf(b.db)).toBe('Changed')
    expect(titleOf(a.db)).toBe('Original')

    // An ID the named project does not hold is NOT_FOUND, even if another project holds it.
    expect(
      await fixture.bus.execute(
        'variant.update',
        { projectId: c.projectId, variantId: VARIANT_ID, title: 'Changed' },
        user,
      ),
    ).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
    expect(titleOf(a.db)).toBe('Original')
  })
})

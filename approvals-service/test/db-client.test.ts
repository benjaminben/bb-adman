import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { openDb, type Db } from '../src/db/client'

// spec/approvals-service.md "The Db interface": the thin layer over @libsql/client.

let db: Db
const folder = mkdtempSync(join(tmpdir(), 'adman-db-'))
afterAll(() => rmSync(folder, { recursive: true, force: true }))

beforeEach(async () => {
  db = openDb(':memory:')
  await db.prepare('CREATE TABLE item (id TEXT PRIMARY KEY, n INTEGER NOT NULL, note TEXT)').run()
  await db.batch([
    db.prepare('INSERT INTO item (id, n, note) VALUES (?, ?, ?)').bind('a', 1, null),
    db.prepare('INSERT INTO item (id, n, note) VALUES (?, ?, ?)').bind('b', 2, 'two'),
  ])
})

describe('Db over libSQL [AP-14]', () => {
  it('first gives the first row as a plain object, or null when there is none', async () => {
    const row = await db.prepare('SELECT id, n, note FROM item WHERE id = ?').bind('b').first()
    expect(row).toEqual({ id: 'b', n: 2, note: 'two' })
    expect(Object.getPrototypeOf(row)).toBe(Object.prototype)
    expect(Object.keys(row as object)).toEqual(['id', 'n', 'note'])
    expect(await db.prepare('SELECT id FROM item WHERE id = ?').bind('z').first()).toBeNull()
  })

  it('first with a column gives that one value', async () => {
    const sql = 'SELECT id, n FROM item ORDER BY id'
    expect(await db.prepare(sql).first('n')).toBe(1)
    expect(await db.prepare('SELECT n FROM item WHERE id = ?').bind('z').first('n')).toBeNull()
  })

  it('all gives every row as plain objects, whole numbers as numbers', async () => {
    const { results } = await db.prepare('SELECT id, n, note FROM item ORDER BY id').all()
    expect(results).toEqual([
      { id: 'a', n: 1, note: null },
      { id: 'b', n: 2, note: 'two' },
    ])
    expect(typeof (results[0] as { n: unknown }).n).toBe('number')
  })

  it('run counts the changed rows', async () => {
    expect((await db.prepare('UPDATE item SET n = n + 1').run()).meta.changes).toBe(2)
    expect((await db.prepare('DELETE FROM item WHERE id = ?').bind('z').run()).meta.changes).toBe(0)
  })

  it('bind makes a new statement and leaves the old one unchanged', async () => {
    const base = db.prepare('SELECT id FROM item WHERE id = ?')
    const a = base.bind('a')
    const b = base.bind('b')
    expect(await a.first('id')).toBe('a')
    expect(await b.first('id')).toBe('b')
  })

  it('numbered placeholders can repeat a value', async () => {
    const sql = 'SELECT id FROM item WHERE n = ?1 OR n = ?1 + ?2 ORDER BY id'
    const { results } = await db.prepare(sql).bind(1, 1).all()
    expect(results).toEqual([{ id: 'a' }, { id: 'b' }])
  })

  it('UPDATE … RETURNING gives back the changed row', async () => {
    const row = await db
      .prepare('UPDATE item SET n = n + 10 WHERE id = ?1 RETURNING id, n')
      .bind('a')
      .first()
    expect(row).toEqual({ id: 'a', n: 11 })
  })

  it('INSERT … SELECT adds a row only when the SELECT finds one', async () => {
    const copy = 'INSERT INTO item (id, n) SELECT ?1, n FROM item WHERE id = ?2'
    expect((await db.prepare(copy).bind('c', 'a').run()).meta.changes).toBe(1)
    expect((await db.prepare(copy).bind('d', 'z').run()).meta.changes).toBe(0)
  })

  it('batch gives one result per statement', async () => {
    const results = await db.batch([
      db.prepare('UPDATE item SET n = 5 WHERE id = ?').bind('a'),
      db.prepare('UPDATE item SET n = 5 WHERE id = ?').bind('z'),
    ])
    expect(results.map((r) => r.meta.changes)).toEqual([1, 0])
  })

  it('a failing statement rolls the whole batch back', async () => {
    const batch = db.batch([
      db.prepare('UPDATE item SET n = 99 WHERE id = ?').bind('a'),
      db.prepare('INSERT INTO item (id, n) VALUES (?, ?)').bind('b', 3),
    ])
    await expect(batch).rejects.toThrow()
    expect(await db.prepare('SELECT n FROM item WHERE id = ?').bind('a').first('n')).toBe(1)
  })

  it('refuses a statement made by another Db', async () => {
    const other = openDb(':memory:')
    const stranger = other.prepare('SELECT 1')
    await expect(db.batch([stranger])).rejects.toThrow()
  })

  it('runs a file: database with no network, and keeps its rows', async () => {
    const url = `file:${join(folder, 'test.db')}`
    const first = openDb(url)
    await first.prepare('CREATE TABLE t (v TEXT)').run()
    await first.prepare('INSERT INTO t (v) VALUES (?)').bind('kept').run()
    expect(await openDb(url).prepare('SELECT v FROM t').first('v')).toBe('kept')
  })
})

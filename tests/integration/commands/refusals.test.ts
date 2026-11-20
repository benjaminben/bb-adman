// SPEC 10.1 refusal tests, rule 4, for every Phase 1 refusal: the exact code, the reason
// when Section 4.1 defines one, nothing written, no event and no undo entry.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { makeFixture, fakeCrypto, data, type Fixture } from '../core-fixture'

type Opened = { projectId: string; filePath: string }
type Case = {
  title: string
  crypto?: boolean
  arrange: (f: Fixture) => Promise<{ name: string; input: unknown }>
  code: string
  reason?: string
}

const fixtures: Fixture[] = []
afterEach(() => {
  while (fixtures.length) fixtures.pop()?.cleanup()
})

async function create(f: Fixture, name: string): Promise<Opened> {
  return data<Opened>(await f.user('project.create', { name, location: f.projectsDir }))
}

async function createClosed(f: Fixture, name: string): Promise<Opened> {
  const p = await create(f, name)
  data(await f.user('project.close', { projectId: p.projectId }))
  return p
}

// Every file under the fixture's folders except the activity log, with a hash of its bytes.
function files(f: Fixture): Record<string, string> {
  const out: Record<string, string> = {}
  for (const entry of fs.readdirSync(f.root, { recursive: true, withFileTypes: true })) {
    const full = path.join(entry.parentPath, entry.name)
    if (!entry.isFile() || full.includes(`${path.sep}logs${path.sep}`)) continue
    out[path.relative(f.root, full)] = crypto
      .createHash('sha1')
      .update(fs.readFileSync(full))
      .digest('hex')
  }
  return out
}

const cases: Case[] = [
  {
    title: 'project.create file_exists',
    arrange: async (f) => {
      await createClosed(f, 'A')
      return { name: 'project.create', input: { name: 'A', location: f.projectsDir } }
    },
    code: 'RULE_VIOLATION',
    reason: 'file_exists',
  },
  {
    title: 'project.open newer_version',
    arrange: async (f) => {
      const a = await createClosed(f, 'A')
      const raw = new Database(a.filePath)
      raw.prepare("UPDATE project_meta SET value = '999' WHERE key = 'schema_version'").run()
      raw.close()
      return { name: 'project.open', input: { filePath: a.filePath } }
    },
    code: 'RULE_VIOLATION',
    reason: 'newer_version',
  },
  {
    title: 'project.open duplicate_project',
    arrange: async (f) => {
      const a = await createClosed(f, 'A')
      const copy = path.join(f.projectsDir, 'A copy.adman')
      fs.copyFileSync(a.filePath, copy)
      data(await f.user('project.open', { filePath: a.filePath }))
      return { name: 'project.open', input: { filePath: copy } }
    },
    code: 'RULE_VIOLATION',
    reason: 'duplicate_project',
  },
  {
    title: 'project.open not_a_project',
    arrange: async (f) => {
      const file = path.join(f.projectsDir, 'Text.adman')
      fs.writeFileSync(file, 'this is not a database, just some words that are long enough')
      return { name: 'project.open', input: { filePath: file } }
    },
    code: 'INVALID_INPUT',
    reason: 'not_a_project',
  },
  {
    title: 'project.open PROJECT_LOCKED',
    arrange: async () => {
      const other = makeFixture()
      fixtures.push(other)
      const a = await create(other, 'A')
      return { name: 'project.open', input: { filePath: a.filePath } }
    },
    code: 'PROJECT_LOCKED',
  },
  {
    title: 'project.open NOT_FOUND for a path with no file',
    arrange: async (f) => ({
      name: 'project.open',
      input: { filePath: path.join(f.projectsDir, 'gone.adman') },
    }),
    code: 'NOT_FOUND',
  },
  {
    title: 'project.close project_not_open',
    arrange: async (f) => {
      await create(f, 'A')
      return { name: 'project.close', input: { projectId: 'gone' } }
    },
    code: 'NOT_FOUND',
    reason: 'project_not_open',
  },
  {
    title: 'settings.update INVALID_INPUT for an unknown key',
    arrange: async () => ({ name: 'settings.update', input: { nope: 1 } }),
    code: 'INVALID_INPUT',
  },
  {
    title: 'secret.set secure_storage_unavailable',
    crypto: false,
    arrange: async () => ({
      name: 'secret.set',
      input: { name: 'gemini.apiKey', value: 'k-1234' },
    }),
    code: 'RULE_VIOLATION',
    reason: 'secure_storage_unavailable',
  },
  {
    title: 'secret.delete NOT_FOUND for a key that is not saved',
    arrange: async () => ({ name: 'secret.delete', input: { name: 'gemini.apiKey' } }),
    code: 'NOT_FOUND',
  },
  ...(['undo', 'redo'] as const).map((d) => ({
    title: `history.${d} nothing_to_${d}`,
    arrange: async (f: Fixture) => {
      const a = await create(f, 'A')
      return { name: `history.${d}`, input: { projectId: a.projectId, scope: 'variant:v1' } }
    },
    code: 'RULE_VIOLATION',
    reason: `nothing_to_${d}`,
  })),
]

describe('Phase 1 refusals assert code, reason and nothing written [SPEC 10.1 rule 4]', () => {
  it.each(cases)('$title', async (c) => {
    const f = makeFixture({ crypto: fakeCrypto(c.crypto ?? true) })
    fixtures.push(f)
    const { name, input } = await c.arrange(f)
    const before = files(f)
    const state = await f.core.query('app.getState', {}, { actor: 'user' })
    const events = f.events.length
    const record = vi.spyOn(f.core.undo, 'record')
    const recordRedo = vi.spyOn(f.core.undo, 'recordRedo')

    const result = await f.user(name, input)

    expect(result.ok).toBe(false)
    const error = result.ok ? undefined : result.error
    expect(error?.code).toBe(c.code)
    expect(error?.details?.reason).toBe(c.reason)
    expect(files(f)).toEqual(before)
    expect(await f.core.query('app.getState', {}, { actor: 'user' })).toEqual(state)
    expect(f.events.slice(events)).toEqual([])
    expect(record).not.toHaveBeenCalled()
    expect(recordRedo).not.toHaveBeenCalled()
  })
})

import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, fakeCrypto, data, type Fixture } from '../core-fixture'
import { makeMultiBus, refusableSet, TEST_SCOPE } from './multi-bus'

let f: Fixture | undefined
let bus: ReturnType<typeof makeMultiBus> | undefined
afterEach(() => {
  f?.cleanup()
  bus?.cleanup()
  f = bus = undefined
})

const user = { actor: 'user' as const }
const NOT_A_PROJECT = 'This file is not an Adman project, or it is damaged.'

describe('details.reason on Phase 1 errors [SPEC 4.1]', () => {
  it('project_not_open: a project-scope command, history and history.state naming a closed project', async () => {
    bus = makeMultiBus({ count: 1, handlers: (ctl) => [refusableSet(ctl)] })
    const notOpen = {
      ok: false,
      error: { code: 'NOT_FOUND', details: { reason: 'project_not_open' } },
    }
    expect(
      await bus.bus.execute('layer.update', { projectId: 'gone', value: 'a' }, user),
    ).toMatchObject(notOpen)
    for (const name of ['history.undo', 'history.redo']) {
      expect(
        await bus.bus.execute(name, { projectId: 'gone', scope: TEST_SCOPE }, user),
      ).toMatchObject(notOpen)
    }
    f = makeFixture()
    expect(
      await f.core.query('history.state', { projectId: 'gone', scope: TEST_SCOPE }, user),
    ).toMatchObject(notOpen)
  })

  it('project_not_open: project.close of a project that is not open', async () => {
    f = makeFixture()
    expect(await f.user('project.close', { projectId: 'gone' })).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND', details: { reason: 'project_not_open' } },
    })
  })

  it('file_exists: project.create where the file is already in the folder', async () => {
    f = makeFixture()
    data(await f.user('project.create', { name: 'A', location: f.projectsDir }))
    expect(await f.user('project.create', { name: 'A', location: f.projectsDir })).toMatchObject({
      ok: false,
      error: { code: 'RULE_VIOLATION', details: { reason: 'file_exists' } },
    })
  })

  it('not_a_project: a file that is not SQLite, with the Section 4.1 message', async () => {
    f = makeFixture()
    const file = path.join(f.projectsDir, 'Text.adman')
    fs.writeFileSync(file, 'this is not a database, just some words that are long enough')
    expect(await f.user('project.open', { filePath: file })).toEqual({
      ok: false,
      error: {
        code: 'INVALID_INPUT',
        message: NOT_A_PROJECT,
        details: { reason: 'not_a_project' },
      },
    })
  })

  it('not_a_project: a SQLite file without project_meta, and one with a bad schema version', async () => {
    f = makeFixture()
    const empty = path.join(f.projectsDir, 'Empty.adman')
    new Database(empty).exec('CREATE TABLE other (id TEXT)').close()
    const bad = path.join(f.projectsDir, 'Bad.adman')
    new Database(bad)
      .exec(
        "CREATE TABLE project_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL); INSERT INTO project_meta VALUES ('schema_version', 'x')",
      )
      .close()
    for (const filePath of [empty, bad]) {
      expect(await f.user('project.open', { filePath })).toEqual({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: NOT_A_PROJECT,
          details: { reason: 'not_a_project' },
        },
      })
    }
  })

  it('newer_version: project.open of a file made by a newer version of the app [DEV-05]', async () => {
    f = makeFixture()
    const a = data<{ projectId: string; filePath: string }>(
      await f.user('project.create', { name: 'A', location: f.projectsDir }),
    )
    data(await f.user('project.close', { projectId: a.projectId }))
    const raw = new Database(a.filePath)
    raw.prepare("UPDATE project_meta SET value = '999' WHERE key = 'schema_version'").run()
    raw.close()
    expect(await f.user('project.open', { filePath: a.filePath })).toEqual({
      ok: false,
      error: {
        code: 'RULE_VIOLATION',
        message:
          'This project was made with a newer version of the app. Download the latest version to open it.',
        details: { reason: 'newer_version' },
      },
    })
    expect(f.core.projects.all()).toEqual([])
  })

  it('secure_storage_unavailable: secret.set when the computer cannot store keys securely', async () => {
    f = makeFixture({ crypto: fakeCrypto(false) })
    expect(await f.user('secret.set', { name: 'gemini.apiKey', value: 'abcdefgh' })).toMatchObject({
      ok: false,
      error: { code: 'RULE_VIOLATION', details: { reason: 'secure_storage_unavailable' } },
    })
  })

  it('nothing_to_undo and nothing_to_redo: history on an empty list [DEV-05]', async () => {
    bus = makeMultiBus({ count: 1, handlers: (ctl) => [refusableSet(ctl)] })
    const projectId = bus.projects[0]?.projectId
    expect(
      await bus.bus.execute('history.undo', { projectId, scope: TEST_SCOPE }, user),
    ).toMatchObject({
      ok: false,
      error: { code: 'RULE_VIOLATION', details: { reason: 'nothing_to_undo' } },
    })
    expect(
      await bus.bus.execute('history.redo', { projectId, scope: TEST_SCOPE }, user),
    ).toMatchObject({
      ok: false,
      error: { code: 'RULE_VIOLATION', details: { reason: 'nothing_to_redo' } },
    })
  })
})

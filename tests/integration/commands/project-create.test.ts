import { describe, it, expect, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { makeFixture, data, type Fixture } from '../core-fixture'
import type { AppState } from '../../../src/shared/schemas/queries'

type Opened = { projectId: string; name: string; filePath: string }

let f: Fixture
afterEach(() => f.cleanup())

describe('project.create [FR-002, FR-004, R-06]', () => {
  it('creates Name.adman in the chosen folder and opens it', async () => {
    f = makeFixture()
    const result = data<Opened>(
      await f.user('project.create', { name: 'Summer', location: f.projectsDir }),
    )
    expect(result.filePath).toBe(path.join(f.projectsDir, 'Summer.adman'))
    expect(fs.existsSync(result.filePath)).toBe(true)
    const state = data<AppState>(await f.core.query('app.getState', {}, { actor: 'user' }))
    expect(state.openProjects).toEqual([result])
  })

  it('does not create the assets folder until something is saved into it', async () => {
    f = makeFixture()
    await f.user('project.create', { name: 'Summer', location: f.projectsDir })
    expect(fs.existsSync(path.join(f.projectsDir, 'Summer Assets'))).toBe(false)
  })

  it('creates the default project location when it does not exist yet', async () => {
    f = makeFixture()
    const state = data<AppState>(await f.core.query('app.getState', {}, { actor: 'user' }))
    const location = state.settings.defaultProjectDir
    expect(location).toBe(path.join(f.documents, 'Adman Projects'))
    expect(fs.existsSync(location)).toBe(false)
    const result = data<Opened>(await f.user('project.create', { name: 'First', location }))
    expect(fs.existsSync(result.filePath)).toBe(true)
  })

  it('puts the new project at the top of the recent projects list', async () => {
    f = makeFixture()
    await f.user('project.create', { name: 'A', location: f.projectsDir })
    await f.user('project.create', { name: 'B', location: f.projectsDir })
    const state = data<AppState>(await f.core.query('app.getState', {}, { actor: 'user' }))
    expect(state.recentProjects.map((r) => r.name)).toEqual(['B', 'A'])
    expect(state.recentProjects[0]?.path).toBe(path.join(f.projectsDir, 'B.adman'))
  })

  it('emits app.stateChanged so every window refreshes', async () => {
    f = makeFixture()
    await f.user('project.create', { name: 'A', location: f.projectsDir })
    expect(f.events.map((e) => e.name)).toContain('app.stateChanged')
  })

  it('refuses a name that is already used in that folder with RULE_VIOLATION', async () => {
    f = makeFixture()
    await f.user('project.create', { name: 'A', location: f.projectsDir })
    const again = await f.user('project.create', { name: 'A', location: f.projectsDir })
    expect(again).toMatchObject({ ok: false, error: { code: 'RULE_VIOLATION' } })
  })

  it.each(['', '   ', 'a/b', 'a\\b', 'a:b', '.hidden', 'trailing.', 'tab\tname', 'x'.repeat(101)])(
    'rejects the name %j with INVALID_INPUT',
    async (name) => {
      f = makeFixture()
      const result = await f.user('project.create', { name, location: f.projectsDir })
      expect(result).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } })
    },
  )

  it('rejects a relative location with INVALID_INPUT', async () => {
    f = makeFixture()
    const result = await f.user('project.create', { name: 'A', location: 'relative/dir' })
    expect(result).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } })
  })

  it('is denied to agents', async () => {
    f = makeFixture()
    const result = await f.agent('project.create', { name: 'A', location: f.projectsDir })
    expect(result).toMatchObject({ ok: false, error: { code: 'AGENT_DENIED' } })
    expect(fs.readdirSync(f.projectsDir)).toEqual([])
  })
})

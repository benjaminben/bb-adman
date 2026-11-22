import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, type Fixture } from './core-fixture'
import { AGENT_POLICY } from '@/main/commands/agent-policy'
import { projectCommands } from '@/main/commands/project'
import { secretCommands } from '@/main/commands/secret'
import { settingsCommands } from '@/main/commands/settings'
import { appQueries } from '@/main/queries/app'
import { historyQueries } from '@/main/queries/history'

let f: Fixture
afterEach(() => f.cleanup())

describe('registering commands and queries [SPEC 12]', () => {
  it('has at most one handler per command name, and a policy row for every handler', () => {
    f = makeFixture()
    const names = f.core.commandNames
    expect(new Set(names).size).toBe(names.length)
    for (const name of names) expect(AGENT_POLICY[name], name).toBeDefined()
  })

  it('builds each domain list from the one CoreDeps object', () => {
    f = makeFixture()
    const deps = f.core.deps
    expect(projectCommands(deps).map((h) => h.name)).toEqual([
      'project.create',
      'project.open',
      'project.close',
      'project.package',
      'project.setAssetsDir',
      'project.createInDefaultFolder',
    ])
    expect(secretCommands(deps).map((h) => h.name)).toEqual(['secret.set', 'secret.delete'])
    expect(settingsCommands(deps).map((h) => h.name)).toEqual(['settings.update'])
    expect(Object.keys(appQueries(deps))).toEqual(['app.getState'])
    expect(Object.keys(historyQueries(deps))).toEqual(['history.state'])
  })

  it('hands every domain the CoreDeps fields of Section 12', () => {
    f = makeFixture()
    expect(Object.keys(f.core.deps).sort()).toEqual(
      [
        'appVersion',
        'approvals',
        'assets',
        'devTools',
        'dropboxFetch',
        'export',
        'exportPictures',
        'fitPicture',
        'jobs',
        'log',
        'media',
        'now',
        'openExternal',
        'projects',
        'providers',
        'publish',
        'render',
        'secrets',
        'settings',
        'toPng',
        'undo',
        'userDataDir',
        'webpToPng',
      ].sort(),
    )
  })
})

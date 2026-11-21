import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, type Fixture } from './core-fixture'
import { AGENT_POLICY } from '../../src/main/commands/agent-policy'
import { projectCommands } from '../../src/main/commands/project'
import { secretCommands } from '../../src/main/commands/secret'
import { settingsCommands } from '../../src/main/commands/settings'
import { appQueries } from '../../src/main/queries/app'
import { historyQueries } from '../../src/main/queries/history'

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
        'assets',
        'devTools',
        'jobs',
        'log',
        'now',
        'openExternal',
        'projects',
        'providers',
        'secrets',
        'settings',
        'undo',
        'userDataDir',
      ].sort(),
    )
  })
})

import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, data, type Fixture } from '../core-fixture'

let f: Fixture
afterEach(() => f.cleanup())

async function made(name: string): Promise<string> {
  const r = await f.user('project.create', { name, location: f.projectsDir })
  return data<{ projectId: string }>(r).projectId
}

const listOpen = (actor: 'user' | 'agent') =>
  f.core.query('project.listOpen', {}, { actor })

describe('project.listOpen [SPEC api-queries-events; MCP-D; FR-201] (security class)', () => {
  it('gives id and name of each open project and nothing else, to both actors', async () => {
    f = makeFixture()
    const a = await made('First')
    const b = await made('Second')
    for (const actor of ['user', 'agent'] as const) {
      const list = data<Array<Record<string, unknown>>>(await listOpen(actor))
      const sorted = [...list].sort((x, y) => String(x.name).localeCompare(String(y.name)))
      expect(sorted).toEqual([
        { id: a, name: 'First' },
        { id: b, name: 'Second' },
      ])
      expect(JSON.stringify(list)).not.toContain(f.projectsDir)
    }
  })

  it('leaves out a project that was closed', async () => {
    f = makeFixture()
    const a = await made('First')
    const b = await made('Second')
    data(await f.user('project.close', { projectId: a }))
    expect(data(await listOpen('agent'))).toEqual([{ id: b, name: 'Second' }])
  })

  it('gives an empty list when no project is open', async () => {
    f = makeFixture()
    expect(data(await listOpen('agent'))).toEqual([])
  })
})

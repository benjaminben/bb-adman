// P10-1: the Phase 10 query stubs. Each checks its input, then refuses with not_built for both
// actors. P10-2 removes its row when it fills subject.list. Also ConnectInfo.claudeDesktop,
// null until P10-9.
import { afterEach, describe, expect, it } from 'vitest'
import { data, makeFixture, type Fixture } from '../core-fixture'
import type { ConnectInfo } from '@/shared/schemas/queries/mcp'

let f: Fixture | undefined
afterEach(() => {
  f?.cleanup()
  f = undefined
})

const NOT_BUILT = {
  ok: false,
  error: {
    code: 'RULE_VIOLATION',
    message: 'This is not built yet.',
    details: { reason: 'not_built' },
  },
}

const QUERIES: Array<{ name: string; bad: object }> = [{ name: 'subject.list', bad: {} }]

async function open(): Promise<{ fx: Fixture; projectId: string }> {
  const fx = makeFixture()
  f = fx
  const made = await fx.user('project.create', { name: 'A', location: fx.projectsDir })
  return { fx, projectId: data<{ projectId: string }>(made).projectId }
}

describe('the Phase 10 query stubs [P10-1]', () => {
  it.each(QUERIES)('$name is registered on core', async ({ name }) => {
    const { fx } = await open()
    expect(fx.core.queryNames).toContain(name)
  })

  it.each(QUERIES)('$name refuses both actors with not_built', async ({ name }) => {
    const { fx, projectId } = await open()
    for (const actor of ['user', 'agent'] as const) {
      expect(await fx.core.query(name, { projectId }, { actor })).toEqual(NOT_BUILT)
    }
  })

  it.each(QUERIES)('$name checks its input first', async ({ name, bad }) => {
    const { fx } = await open()
    expect(await fx.core.query(name, bad, { actor: 'user' })).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    })
  })
})

describe('ConnectInfo.claudeDesktop [P10-1, A-245]', () => {
  it('is null until the bridge is built', async () => {
    const { fx } = await open()
    const info = data<ConnectInfo>(await fx.core.query('mcp.getConnectInfo', {}, { actor: 'user' }))
    expect(info.claudeDesktop).toBeNull()
  })
})

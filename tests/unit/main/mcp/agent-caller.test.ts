import { describe, it, expect, afterEach } from 'vitest'
import { agentCaller } from '../../../../src/main/mcp/agent-caller'
import { ok } from '../../../../src/shared/schemas/result'
import { makeFixture, type Fixture } from '../../../integration/core-fixture'

let f: Fixture | undefined
afterEach(() => f?.cleanup())

describe('every MCP request runs as actor agent [SPEC 4.1, 1.56 review point 5]', () => {
  it('passes only { actor: "agent" } to the bus and the queries, whatever the input holds', async () => {
    const seen: unknown[] = []
    const caller = agentCaller({
      execute: async (_name, _input, opts) => (seen.push(opts), ok(null)),
      query: async (_name, _input, opts) => (seen.push(opts), ok(null)),
    })
    const sneaky = { actor: 'user', opts: { actor: 'user' }, agentClient: 'user' }
    await caller.execute('settings.update', sneaky)
    await caller.query('app.getState', sneaky)
    expect(seen).toEqual([{ actor: 'agent' }, { actor: 'agent' }])
  })

  it('keeps agent policy in core: a deny command and a user-only query are refused', async () => {
    f = makeFixture()
    const core = f.core
    const caller = agentCaller({ execute: core.bus.execute, query: core.query })
    const asUser = { actor: 'user' }
    expect(await caller.execute('settings.update', { ...asUser })).toMatchObject({
      ok: false,
      error: { code: 'AGENT_DENIED' },
    })
    expect(await caller.query('comfy.getInfo', asUser)).toMatchObject({
      ok: false,
      error: { code: 'AGENT_DENIED' },
    })
  })
})

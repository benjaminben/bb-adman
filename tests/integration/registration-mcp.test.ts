import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, type Fixture } from './core-fixture'
import { AGENT_POLICY } from '../../src/main/commands/agent-policy'

let f: Fixture
afterEach(() => f.cleanup())

describe('the mcp domain is registered [SPEC 4.2, 14 (1.56) MCP-A]', () => {
  it('gives mcp.setEnabled and mcp.regenerateToken, each with agent policy deny', () => {
    f = makeFixture()
    const names = f.core.commandNames.filter((n) => n.startsWith('mcp.'))
    expect(names).toEqual(['mcp.setEnabled', 'mcp.regenerateToken'])
    for (const name of names) expect(AGENT_POLICY[name]?.policy).toBe('deny')
  })
})

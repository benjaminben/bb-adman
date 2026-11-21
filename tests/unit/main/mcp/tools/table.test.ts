import { describe, it, expect, afterEach } from 'vitest'
import { MCP_TOOLS } from '../../../../../src/main/mcp/tools'
import { AGENT_POLICY, agentPolicyFor } from '../../../../../src/main/commands/agent-policy'
import { makeFixture, type Fixture } from '../../../../integration/core-fixture'

let f: Fixture | undefined
afterEach(() => f?.cleanup())

describe('the fixed MCP tool table [SPEC 4.5; 14 1.56 MCP-B]', () => {
  it('maps each tool to one command or query that exists in core', () => {
    f = makeFixture()
    const core = f.core
    for (const t of MCP_TOOLS) {
      const names = t.kind === 'command' ? core.commandNames : core.queryNames
      expect(names, t.name).toContain(t.target)
    }
    expect(new Set(MCP_TOOLS.map((t) => t.name)).size).toBe(MCP_TOOLS.length)
  })

  it('widens nothing: every command a tool runs is allow in the agent policy today', () => {
    for (const t of MCP_TOOLS.filter((x) => x.kind === 'command')) {
      expect(AGENT_POLICY[t.target]?.policy, t.name).toBe('allow')
      expect(agentPolicyFor(t.target), t.name).toBe('allow')
    }
  })

  it('offers no secret, token, settings, file, mcp, dev or generation target [FR-198]', () => {
    const banned = /^(secret|settings|mcp|dev|generation|comfy|storage|app|dialog)\./
    for (const t of MCP_TOOLS) expect(banned.test(t.target), t.target).toBe(false)
  })
})

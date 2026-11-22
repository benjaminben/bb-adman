import { describe, it, expect, afterEach } from 'vitest'
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { MCP_TOOLS, toolSetup, type ToolDef } from '@/main/mcp/tools'
import type { AgentCaller } from '@/main/mcp/agent-caller'
import { AGENT_POLICY, agentPolicyFor } from '@/main/commands/agent-policy'
import { makeFixture, type Fixture } from '../../../../integration/core-fixture'

let f: Fixture | undefined
afterEach(() => f?.cleanup())

// MCP-G: the commands of the start and cancel tools, tick under the agent-run gate.
const TICK_TARGETS = [
  'generation.runImages',
  'generation.startVideo',
  'job.cancel',
  'generation.proposeLayout',
  'generation.copyOptions',
  'generation.cutOut',
]

// P10-6, P10-11: the delete tools, ask under the permission broker (D-023, D-099).
const ASK_TARGETS = ['campaign.delete', 'variant.delete']

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
      const asked = ASK_TARGETS.includes(t.target) ? 'ask' : 'allow'
      const policy = TICK_TARGETS.includes(t.target) ? 'tick' : asked
      expect(AGENT_POLICY[t.target]?.policy, t.name).toBe(policy)
      expect(agentPolicyFor(t.target), t.name).toBe(policy)
    }
  })

  it('offers no secret, token, settings, file, mcp, dev or generation target [FR-198]', () => {
    const banned = /^(secret|settings|mcp|dev|generation|comfy|storage|app|dialog)\./
    for (const t of MCP_TOOLS) {
      const named = TICK_TARGETS.includes(t.target)
      expect(banned.test(t.target) && !named, t.target).toBe(false)
    }
  })

  // B-2: a new query target must be added here on purpose, after a review.
  it('reads only the allowed queries [B-2]', () => {
    const allowed = [
      'project.get',
      'asset.list',
      'campaign.get',
      'project.listOpen',
      'template.slots',
      'job.get',
      'job.list',
      'subject.list',
      'variant.get',
      'variant.render',
      'check.results',
    ]
    for (const t of MCP_TOOLS.filter((x) => x.kind === 'query')) {
      expect(allowed, t.name).toContain(t.target)
    }
  })

  it('the snake_case check finds two input keys that turn into one name [B-2]', () => {
    const clash: ToolDef = {
      name: 'made_up_tool',
      description: 'Made up.',
      kind: 'query',
      target: 'project.get',
      input: z.object({ projectId: z.string(), project_id: z.string() }),
    }
    expect(lostKeys(clash)).toEqual(['projectId'])
  })

  it('no two input keys of one tool turn into the same snake_case name [B-2]', () => {
    for (const t of MCP_TOOLS) expect(lostKeys(t), t.name).toEqual([])
  })
})

// The input keys of one tool that have no snake_case key of their own once registered.
function lostKeys(def: ToolDef): string[] {
  let shape: Record<string, unknown> = {}
  const server = {
    registerTool: (_name: string, cfg: { inputSchema: z.ZodObject }) => {
      shape = cfg.inputSchema.shape
    },
  }
  toolSetup([def])(server as unknown as McpServer, {} as AgentCaller)
  const kept = Object.values(shape)
  return Object.keys(def.input.shape).filter((k) => !kept.includes(def.input.shape[k]))
}

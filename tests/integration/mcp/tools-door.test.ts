import { describe, it, expect, afterEach } from 'vitest'
import { data, makeFixture, type Fixture } from '../core-fixture'
import { createMcpHttp, type McpHttp } from '@/main/mcp/server'
import { agentCaller, type CoreTargets } from '@/main/mcp/agent-caller'
import { toolSetup, type ToolDef } from '@/main/mcp/tools'
import { denialMessage } from '@/main/commands/agent-policy'
import { subjectCreateInput } from '@/shared/schemas/commands/subject'
import type { ProjectGet } from '@/shared/schemas/queries/campaign'
import { freePort } from './http-client'
import { replyJson, toolSession } from './tool-client'

const TOKEN = 'made-up-local-token-for-tests-only'

let server: McpHttp | undefined
let f: Fixture | undefined
afterEach(async () => {
  await server?.stop()
  f?.cleanup()
  server = f = undefined
})

// A door over the real core, with a table the test chooses. Every call is counted.
async function door(table?: readonly ToolDef[]) {
  const fx = makeFixture()
  f = fx
  const calls: string[] = []
  const core: CoreTargets = {
    execute: (name, input, opts) => (calls.push(name), fx.core.bus.execute(name, input, opts)),
    query: (name, input, opts) => (calls.push(name), fx.core.query(name, input, opts)),
  }
  server = createMcpHttp({
    caller: agentCaller(core),
    appVersion: '0.1.0',
    tools: toolSetup(table),
  })
  const port = await freePort()
  await server.start({ port, token: TOKEN })
  const { projectId } = data<{ projectId: string }>(
    await fx.user('project.create', { name: 'Door', location: fx.projectsDir }),
  )
  return { fx, calls, projectId, s: await toolSession(port, TOKEN) }
}

describe('a tool over a command the agent policy denies [SPEC 4.5 Refusals; 1.56 point 5]', () => {
  it('returns AGENT_DENIED with the policy sentence and changes nothing', async () => {
    const denied: ToolDef = {
      name: 'made_up_create_subject',
      description: 'A test tool over subject.create, which the agent policy denies.',
      kind: 'command',
      target: 'subject.create',
      input: subjectCreateInput,
    }
    const { fx, projectId, s } = await door([denied])
    const reply = await s.call('made_up_create_subject', {
      project_id: projectId,
      id: 'can',
      name: 'Can',
    })
    expect(reply.isError).toBe(true)
    expect(replyJson(reply)).toEqual({
      code: 'AGENT_DENIED',
      message: denialMessage('subject.create'),
    })
    const after = data<ProjectGet>(
      await fx.core.query('project.get', { projectId }, { actor: 'user' }),
    )
    expect(after.subjects).toEqual([])
  })
})

describe('tool names are looked up in the fixed table only [REVIEW MCP-A, older code]', () => {
  it('answers constructor, toString, __proto__ and core names with an error and calls nothing', async () => {
    const { calls, s } = await door()
    const names = [
      'constructor',
      'toString',
      '__proto__',
      'hasOwnProperty',
      'project.get',
      'campaign.create',
      'mcp.getConnectInfo',
    ]
    for (const name of names) {
      const reply = await s.call(name, { project_id: 'x' })
      expect(reply.isError, name).toBe(true)
    }
    expect(calls).toEqual([])
  })

  it('maps each tool to its own fixed name, whatever the arguments hold', async () => {
    const { calls, projectId, s } = await door()
    await s.call('get_project', { project_id: projectId, name: 'secret.set', target: 'x' })
    expect(calls).toEqual(['project.get'])
  })
})

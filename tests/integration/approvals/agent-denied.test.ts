// AP-5 (spec/approvals.md "Security", "Named tests"; spec/mcp-and-agents.md "Agent policy
// table"): no approvals command or query is open to an agent, and settings.update cannot write
// the approvals address.
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, data, type Fixture } from '../core-fixture'
import { denialMessage } from '@/main/commands/agent-policy'
import { APPROVALS_QUERY_DENIED } from '@/shared/approvals/messages'

let f: Fixture | undefined
afterEach(() => {
  f?.cleanup()
  f = undefined
})

const asAgent = { actor: 'agent' as const }
const COMMANDS = [
  'approvals.setService',
  'approvals.check',
  'approvals.createLink',
  'approvals.setPassword',
  'approvals.publish',
  'approvals.refresh',
  'approvals.endLink',
  'approvals.cancelUpdate',
]
const QUERIES = ['approvals.forCampaign', 'approvals.getPassword']

async function openProject(fx: Fixture): Promise<string> {
  const made = await fx.user('project.create', { name: 'A', location: fx.projectsDir })
  return data<{ projectId: string }>(made).projectId
}

function inputFor(name: string, projectId: string): unknown {
  if (name === 'approvals.setService') return { address: 'https://approvals.example.com' }
  if (name === 'approvals.check') return {}
  const ids = { projectId, campaignId: 'spring-sale-abc234' }
  return name.endsWith('Link') || name.endsWith('Password')
    ? { ...ids, password: 'correct-horse-12' }
    : ids
}

describe('approvals as the agent [spec/approvals.md "Named tests"]', () => {
  it('registers exactly the eight approvals commands and the two queries', () => {
    f = makeFixture()
    expect(f.core.commandNames.filter((n) => n.startsWith('approvals.')).sort()).toEqual(
      [...COMMANDS].sort(),
    )
    expect(f.core.queryNames.filter((n) => n.startsWith('approvals.')).sort()).toEqual(
      [...QUERIES].sort(),
    )
  })

  it.each(COMMANDS)('refuses %s with AGENT_DENIED, and nothing happens', async (name) => {
    f = makeFixture()
    const projectId = await openProject(f)
    const before = f.events.length
    expect(await f.agent(name, inputFor(name, projectId))).toEqual({
      ok: false,
      error: { code: 'AGENT_DENIED', message: denialMessage(name) },
    })
    expect(f.events.slice(before)).toEqual([])
    expect(f.core.settings.get().approvals).toEqual({ baseUrl: null })
    expect(fs.existsSync(path.join(f.userData, 'approval-passwords.bin'))).toBe(false)
  })

  it.each(QUERIES)('refuses the query %s with AGENT_DENIED', async (name) => {
    f = makeFixture()
    const projectId = await openProject(f)
    expect(await f.core.query(name, inputFor(name, projectId), asAgent)).toEqual({
      ok: false,
      error: { code: 'AGENT_DENIED', message: APPROVALS_QUERY_DENIED },
    })
  })

  it('refuses settings.update with an approvals key, from the agent and from the user', async () => {
    f = makeFixture()
    const patch = { approvals: { baseUrl: 'https://evil.example.com' } }
    expect(await f.agent('settings.update', patch)).toMatchObject({
      ok: false,
      error: { code: 'AGENT_DENIED' },
    })
    expect(await f.user('settings.update', patch)).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    })
    const mixed = { generation: { optionsPerRun: 2 }, ...patch }
    expect(await f.user('settings.update', mixed)).toMatchObject({ ok: false })
    expect(f.core.settings.get().approvals).toEqual({ baseUrl: null })
    expect(f.core.settings.get().generation).toEqual({ optionsPerRun: 4 })
    const file = path.join(f.userData, 'settings.json')
    if (fs.existsSync(file)) expect(fs.readFileSync(file, 'utf8')).not.toContain('evil')
  })
})

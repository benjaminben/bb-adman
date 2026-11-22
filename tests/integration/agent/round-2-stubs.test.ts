// R2P-1 (spec/phases/round-2-platform.md, "R2P-1 — Contracts", D5 to D9): the four Round 2
// commands are registered against stubs that refuse not_built and write nothing; agent.askFiles
// is user only and knows no request yet; every ask row has a kind; the permission event carries
// kind and fileCount; app.showProject is an event name. No agent can do anything new.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { data, fakeCrypto, makeFixture, type Fixture } from '../core-fixture'
import { createInput } from '../campaigns/campaign-fixture'
import { AGENT_POLICY } from '@/main/commands/agent-policy'
import type { BusEvent } from '@/main/commands/bus'
import { createCore } from '@/main/core'
import { ASK_KINDS } from '@/main/mcp/ask-kinds'
import { EVENT_NAMES } from '@/shared/schemas/events'

const cleanups: Array<() => void> = []
afterEach(() => {
  for (const c of cleanups.splice(0)) c()
})

const NOT_BUILT = {
  ok: false,
  error: {
    code: 'RULE_VIOLATION',
    message: 'This is not built yet.',
    details: { reason: 'not_built' },
  },
}

const BRIEF = '# Spring Glow launch'
const PNG_PATH = '/Users/me/Pictures/citrus-glow.png'

// A good input for each new command, given the open project's ID.
const INPUTS: Record<string, (projectId: string) => object> = {
  'asset.importFiles': (projectId) => ({ projectId, paths: [PNG_PATH] }),
  'campaign.createFromBrief': (projectId) => ({ projectId, text: BRIEF }),
  'campaign.createFromBriefWithFiles': (projectId) => ({ projectId, text: BRIEF }),
  'project.createInDefaultFolder': () => ({ name: 'Autumn Work' }),
}
const NAMES = Object.keys(INPUTS)

const POLICY: Record<string, string> = {
  'asset.importFiles': 'ask',
  'campaign.createFromBrief': 'allow',
  'campaign.createFromBriefWithFiles': 'ask',
  'project.createInDefaultFolder': 'allow',
}

async function open(): Promise<{ fx: Fixture; projectId: string }> {
  const fx = makeFixture()
  cleanups.push(fx.cleanup)
  const made = await fx.user('project.create', { name: 'Spring Work', location: fx.projectsDir })
  return { fx, projectId: data<{ projectId: string }>(made).projectId }
}

const projectFiles = (fx: Fixture) => [
  ...fs.readdirSync(fx.projectsDir),
  ...fs.readdirSync(fx.core.settings.get().defaultProjectDir),
]

describe('the Round 2 command stubs [R2P-1]', () => {
  it('registers the four commands, each with its policy row', async () => {
    const { fx } = await open()
    expect(fx.core.commandNames).toEqual(expect.arrayContaining(NAMES))
    for (const name of NAMES) expect(AGENT_POLICY[name]?.policy, name).toBe(POLICY[name])
  })

  it.each(NAMES.filter((n) => n !== 'asset.importFiles' && n !== 'project.createInDefaultFolder'))(
    '%s as the user refuses not_built and writes nothing',
    async (name) => {
      const { fx, projectId } = await open()
      fs.mkdirSync(fx.core.settings.get().defaultProjectDir, { recursive: true })
      const files = projectFiles(fx).length
      const before = fx.events.length
      expect(await fx.user(name, INPUTS[name]?.(projectId))).toEqual(NOT_BUILT)
      expect(fx.events.slice(before)).toEqual([])
      expect(projectFiles(fx)).toHaveLength(files)
    },
  )

  it.each(NAMES.filter((n) => POLICY[n] === 'allow' && n !== 'project.createInDefaultFolder'))(
    '%s as the agent reaches its stub',
    async (name) => {
      const { fx, projectId } = await open()
      expect(await fx.agent(name, INPUTS[name]?.(projectId))).toEqual(NOT_BUILT)
    },
  )
})

describe('agent.askFiles, stub [R2P-1, D7]', () => {
  it('is registered and refuses an agent with AGENT_DENIED', async () => {
    const { fx } = await open()
    expect(fx.core.queryNames).toContain('agent.askFiles')
    const reply = await fx.core.query('agent.askFiles', { requestId: 'R1' }, { actor: 'agent' })
    expect(reply).toMatchObject({ ok: false, error: { code: 'AGENT_DENIED' } })
    expect(JSON.stringify(reply)).not.toContain('R1')
  })

  it('answers the user NOT_FOUND "That request has ended."', async () => {
    const { fx } = await open()
    expect(await fx.core.query('agent.askFiles', { requestId: 'R1' }, { actor: 'user' })).toEqual({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'That request has ended.' },
    })
  })
})

describe('the kinds of an ask [R2P-1, D7]', () => {
  it('lists every ask row with its kind, and nothing else', () => {
    const asks = Object.keys(AGENT_POLICY).filter((n) => AGENT_POLICY[n]?.policy === 'ask')
    expect(Object.keys(ASK_KINDS).sort()).toEqual(asks.sort())
    expect(ASK_KINDS).toEqual({
      'campaign.delete': 'delete',
      'variant.delete': 'delete',
      'asset.importFiles': 'import',
      'campaign.createFromBriefWithFiles': 'import',
    })
  })

  it('sends kind delete and fileCount 0 with a delete ask, and no ID or path', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-r2p1-'))
    fs.mkdirSync(path.join(root, 'Documents'))
    fs.mkdirSync(path.join(root, 'work'))
    const events: BusEvent[] = []
    const core = createCore({
      userDataDir: path.join(root, 'userData'),
      documentsDir: path.join(root, 'Documents'),
      appVersion: '0.1.0',
      crypto: fakeCrypto(),
      env: {},
      emit: (e) => events.push(e),
    })
    cleanups.push(() => {
      core.closeAll()
      fs.rmSync(root, { recursive: true, force: true })
    })
    const user = { actor: 'user' } as const
    const location = path.join(root, 'work')
    const made = await core.bus.execute('project.create', { name: 'Spring Work', location }, user)
    const projectId = data<{ projectId: string }>(made).projectId
    const created = await core.bus.execute('campaign.create', { projectId, ...createInput() }, user)
    const { campaignId } = data<{ campaignId: string }>(created)
    const pending = core.bus.execute(
      'campaign.delete',
      { projectId, campaignId },
      { actor: 'agent' },
    )
    const asked = await vi.waitFor(() => {
      const found = events.find((e) => e.name === 'agent.permissionRequested')
      if (!found) throw new Error('no ask yet')
      return found
    })
    expect(asked?.payload).toMatchObject({ kind: 'delete', fileCount: 0 })
    const requestId = (asked?.payload as { requestId: string }).requestId
    const shown = JSON.stringify({ ...(asked?.payload as object), requestId: '' })
    for (const secret of [projectId, campaignId, root]) expect(shown).not.toContain(secret)
    await core.bus.execute(
      'agent.answerPermission',
      { requestId, allow: false, rememberAuto: false },
      user,
    )
    expect(await pending).toMatchObject({ ok: false, error: { code: 'AGENT_REFUSED' } })
  })
})

describe('app.showProject [R2P-1, D9]', () => {
  it('is an event name', () => {
    expect(EVENT_NAMES).toContain('app.showProject')
  })
})

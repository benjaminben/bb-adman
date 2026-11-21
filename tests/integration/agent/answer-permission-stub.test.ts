// P10-1 (spec/phases/phase-10-slices.md, "P10-1 — Contracts"): agent.answerPermission is user
// only by its deny row; the stub broker knows no request, so the user gets NOT_FOUND. A core
// built with no askPermission uses the stub broker, which refuses every ask as today. The
// activity recorder and the client-name cleaner are stubs that do nothing.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { data, fakeCrypto, makeFixture, type Fixture } from '../core-fixture'
import { createInput } from '../campaigns/campaign-fixture'
import { AGENT_POLICY, denialMessage } from '@/main/commands/agent-policy'
import type { BusEvent } from '@/main/commands/bus'
import { createCore, type Core } from '@/main/core'
import { createAgentActivity } from '@/main/mcp/activity'
import { cleanClientName } from '@/main/mcp/client-name'
import { createPermissionBroker } from '@/main/mcp/permissions'
import { ASK_WAIT_MS } from '@/shared/config/agent-ask'

const cleanups: Array<() => void> = []
afterEach(() => {
  for (const c of cleanups.splice(0)) c()
})

const ANSWER = { requestId: 'R1', allow: true, rememberAuto: true }
const ENDED = { ok: false, error: { code: 'NOT_FOUND', message: 'That request has ended.' } }

function fixture(): Fixture {
  const f = makeFixture()
  cleanups.push(f.cleanup)
  return f
}

// A core as index.ts builds it: no askPermission, so the stub broker answers every ask.
function coreWithBroker(): { core: Core; events: BusEvent[] } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-broker-'))
  fs.mkdirSync(path.join(root, 'Documents'))
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
  return { core, events }
}

describe('agent.answerPermission, stub [P10-1]', () => {
  it('is registered, with a deny row', () => {
    const f = fixture()
    expect(f.core.commandNames).toContain('agent.answerPermission')
    expect(AGENT_POLICY['agent.answerPermission']?.policy).toBe('deny')
  })

  it('refuses the agent with AGENT_DENIED, before it reads the input', async () => {
    const f = fixture()
    const denied = {
      ok: false,
      error: { code: 'AGENT_DENIED', message: denialMessage('agent.answerPermission') },
    }
    expect(await f.agent('agent.answerPermission', ANSWER)).toEqual(denied)
    expect(await f.agent('agent.answerPermission', { made: 'up' })).toEqual(denied)
  })

  it('answers the user NOT_FOUND "That request has ended." and saves no setting', async () => {
    const f = fixture()
    const before = f.events.length
    expect(await f.user('agent.answerPermission', ANSWER)).toEqual(ENDED)
    expect(f.core.settings.get().mcp.autoApproveDestructive).toBe(false)
    expect(f.events.slice(before)).toEqual([])
  })

  it('checks the input of the user', async () => {
    const f = fixture()
    expect(await f.user('agent.answerPermission', { requestId: 'R1' })).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    })
  })
})

describe('the stub broker in core [P10-1]', () => {
  it('refuses an agent campaign.delete, sends no event and deletes nothing', async () => {
    const { core, events } = coreWithBroker()
    const location = path.join(path.dirname(core.deps.userDataDir), 'Documents')
    const made = await core.bus.execute(
      'project.create',
      { name: 'A', location },
      { actor: 'user' },
    )
    const { projectId } = data<{ projectId: string }>(made)
    const camp = await core.bus.execute(
      'campaign.create',
      { projectId, ...createInput() },
      { actor: 'user' },
    )
    const { campaignId } = data<{ campaignId: string }>(camp)
    const before = events.length
    const result = await core.bus.execute(
      'campaign.delete',
      { projectId, campaignId },
      { actor: 'agent' },
    )
    expect(result).toEqual({
      ok: false,
      error: {
        code: 'AGENT_REFUSED',
        message: 'The user did not allow this action.',
        details: { reason: 'refused' },
      },
    })
    expect(events.slice(before)).toEqual([])
    const read = await core.query('campaign.get', { projectId, campaignId }, { actor: 'user' })
    expect(read.ok).toBe(true)
  })

  it('answers ask with refused and answer with NOT_FOUND', async () => {
    const f = fixture()
    const broker = createPermissionBroker({
      emit: () => undefined,
      settings: f.core.settings,
      log: f.core.log,
      now: () => new Date(),
      projects: f.core.projects,
    })
    const request = { command: 'campaign.delete', agentClient: null, projectId: 'P1', input: {} }
    expect(await broker.ask(request)).toBe('refused')
    expect(() => broker.answer(ANSWER)).toThrow('That request has ended.')
  })
})

describe('the other Phase 10 stubs [P10-1]', () => {
  it('records no activity: no event and no log line', () => {
    const emitted: BusEvent[] = []
    const lines: unknown[] = []
    const activity = createAgentActivity({
      emit: (e) => void emitted.push(e),
      log: { write: (l: unknown) => void lines.push(l) } as never,
      now: () => new Date(),
    })
    activity.record({
      tool: 'get_job',
      agentClient: null,
      projectId: 'P1',
      ok: true,
      errorKind: null,
    })
    expect(emitted).toEqual([])
    expect(lines).toEqual([])
  })

  it('cleans every client name to null', () => {
    expect(['Made-up Client', '', undefined, 7].map(cleanClientName)).toEqual([
      null,
      null,
      null,
      null,
    ])
  })

  it('waits 120 seconds for an answer', () => {
    expect(ASK_WAIT_MS).toBe(120_000)
  })
})

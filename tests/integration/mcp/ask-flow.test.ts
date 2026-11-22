// P10-6 (spec/phases/phase-10-slices.md; phase-10.md, ask flow, A-237 to A-240; D-099): an
// agent's delete_campaign asks the user and waits. Allow runs it; refuse, time-out and busy
// refuse it with nothing written; auto-approve skips the ask; an answer after the end changes
// nothing (security class full).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { data } from '../core-fixture'
import { createInput } from '../campaigns/campaign-fixture'
import { replyJson } from './tool-client'
import { askLines, askSetUp, CLOCK, riskyKeys, type AskSetUp } from './ask-fixture'
import { denialMessage } from '@/main/commands/agent-policy'
import { ASK_WAIT_MS } from '@/shared/config/agent-ask'

let x: AskSetUp | undefined
afterEach(async () => {
  vi.useRealTimers()
  await x?.close()
  x = undefined
})

const ENDED = { ok: false, error: { code: 'NOT_FOUND', message: 'That request has ended.' } }

const refusal = (reason: string, message: string) => ({
  ok: false,
  error: { code: 'AGENT_REFUSED', message, details: { reason } },
})
const REFUSED = refusal('refused', 'The user did not allow this action.')
const TIMED_OUT = refusal('timed_out', 'The user did not answer in time.')
const BUSY = refusal(
  'busy',
  "Another request is waiting for the user's answer. Try again after it.",
)

function deleteInput(s: AskSetUp) {
  return { projectId: s.projectId, campaignId: s.campaignId }
}

const answer = (s: AskSetUp, requestId: string, allow: boolean, rememberAuto = false) =>
  s.user('agent.answerPermission', { requestId, allow, rememberAuto })

const changed = (s: AskSetUp, from: number) =>
  s.events.slice(from).filter((e) => e.name === 'project.changed')

describe('delete_campaign over MCP [P10-6; A-237, A-238]', () => {
  it('asks with the five fields and no ID; allow deletes and project.changed follows', async () => {
    x = await askSetUp()
    const s = await x.session()
    const pending = s.call('delete_campaign', {
      project_id: x.projectId,
      campaign_id: x.campaignId,
    })
    const asked = await x.nthAsk()
    expect(Object.keys(asked).sort()).toEqual(
      ['action', 'agentClient', 'expiresAt', 'fileCount', 'kind', 'requestId', 'target'].sort(),
    )
    expect(asked).toMatchObject({
      agentClient: 'adman-test-client',
      action: 'delete campaigns',
      target: expect.stringMatching(
        /^Campaign "Summer Splash!" \(\d+ variants?\) in "Spring Work"$/,
      ),
      expiresAt: new Date(CLOCK.getTime() + ASK_WAIT_MS).toISOString(),
    })
    const shown = JSON.stringify({ ...asked, requestId: '' })
    for (const id of [x.projectId, x.campaignId]) expect(shown).not.toContain(id)
    expect(x.campaignExists()).toBe(true)
    const from = x.events.length
    data(await answer(x, asked.requestId, true))
    const reply = await pending
    expect(reply.isError).toBeFalsy()
    expect(replyJson(reply)).toEqual({ campaignId: x.campaignId })
    expect(x.campaignExists()).toBe(false)
    expect(changed(x, from)).toHaveLength(1)
    expect(changed(x, from)[0]?.payload).toMatchObject({ projectId: x.projectId, actor: 'agent' })
  })

  it('refuses with the refusal sentence only, deletes nothing, and the replies are clean', async () => {
    x = await askSetUp()
    const s = await x.session()
    const from = x.events.length
    const pending = s.call('delete_campaign', {
      project_id: x.projectId,
      campaign_id: x.campaignId,
    })
    const asked = await x.nthAsk()
    data(await answer(x, asked.requestId, false))
    const reply = await pending
    expect(reply.isError).toBe(true)
    expect(replyJson(reply)).toEqual(REFUSED.error)
    expect(x.campaignExists()).toBe(true)
    expect(changed(x, from)).toEqual([])
    const listed = (await s.list()).find((t) => t.name === 'delete_campaign')
    expect(listed?.description).toMatch(/cannot be undone/)
    expect(listed?.description).toMatch(/asked in the app every time/)
    expect(listed?.description).toMatch(/two minutes/)
    expect(listed?.description).toMatch(/refusal is final/)
    // A success after auto-approve, for the reply checks below.
    data(await x.user('settings.update', { mcp: { autoApproveDestructive: true } }))
    const done = await s.call('delete_campaign', {
      project_id: x.projectId,
      campaign_id: x.campaignId,
    })
    const text = JSON.stringify([reply, done])
    expect(riskyKeys([replyJson(reply), replyJson(done)])).toEqual([])
    for (const word of ['autoApprove', 'Summer Splash', 'Spring Work', 'delete campaigns']) {
      expect(text.includes(word), `${word} in a reply`).toBe(false)
    }
    expect(text).not.toContain(asked.requestId)
  })
})

describe('the ask through the bus [P10-6; A-237 to A-240]', () => {
  it('times out at 120 s, deletes nothing, and a late answer changes nothing', async () => {
    x = await askSetUp()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
    const pending = x.agent('campaign.delete', deleteInput(x))
    const asked = await x.nthAsk()
    vi.advanceTimersByTime(ASK_WAIT_MS - 1)
    let settled = false
    void pending.then(() => (settled = true))
    await new Promise<void>((r) => setImmediate(r))
    expect(settled).toBe(false)
    vi.advanceTimersByTime(1)
    expect(await pending).toEqual(TIMED_OUT)
    expect(x.campaignExists()).toBe(true)
    expect(await answer(x, asked.requestId, true, true)).toEqual(ENDED)
    expect(x.core.settings.get().mcp.autoApproveDestructive).toBe(false)
    expect(x.campaignExists()).toBe(true)
  })

  it('refuses a second ask as busy at once, with no event and nothing written', async () => {
    x = await askSetUp()
    const first = x.agent('campaign.delete', deleteInput(x))
    const asked = await x.nthAsk()
    const from = x.events.length
    expect(await x.agent('campaign.delete', deleteInput(x))).toEqual(BUSY)
    expect(x.events.slice(from)).toEqual([])
    data(await answer(x, asked.requestId, false))
    expect(await first).toEqual(REFUSED)
    expect(x.campaignExists()).toBe(true)
    expect(askLines(x.readLogs()).map((l) => l.message)).toEqual(['busy', 'refused'])
  })

  it('ends an answered request: a second answer is NOT_FOUND and saves nothing', async () => {
    x = await askSetUp()
    const pending = x.agent('campaign.delete', deleteInput(x))
    const asked = await x.nthAsk()
    data(await answer(x, asked.requestId, false))
    expect(await pending).toEqual(REFUSED)
    expect(await answer(x, asked.requestId, true, true)).toEqual(ENDED)
    expect(await answer(x, 'made-up-request', true, true)).toEqual(ENDED)
    expect(x.core.settings.get().mcp.autoApproveDestructive).toBe(false)
    expect(x.campaignExists()).toBe(true)
  })

  it('gives the command its own NOT_FOUND when the project closes during the wait', async () => {
    x = await askSetUp()
    const pending = x.agent('campaign.delete', deleteInput(x))
    const asked = await x.nthAsk()
    data(await x.user('project.close', { projectId: x.projectId }))
    expect(await pending).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'That project is not open.' },
    })
    expect(await answer(x, asked.requestId, true, true)).toEqual(ENDED)
    expect(x.core.settings.get().mcp.autoApproveDestructive).toBe(false)
  })

  it('ends the request when its project closes and opens again before the answer', async () => {
    x = await askSetUp()
    const filePath = x.core.projects.requireOpen(x.projectId).filePath
    const pending = x.agent('campaign.delete', deleteInput(x))
    const asked = await x.nthAsk()
    data(await x.user('project.close', { projectId: x.projectId }))
    data(await x.user('project.open', { filePath }))
    expect(await answer(x, asked.requestId, true, true)).toEqual(ENDED)
    // Refused, or the close's NOT_FOUND if the project check ran between close and open.
    expect((await pending).ok).toBe(false)
    expect(x.campaignExists()).toBe(true)
    expect(x.core.settings.get().mcp.autoApproveDestructive).toBe(false)
  })

  it('rememberAuto with allow saves the setting, and the next delete is not asked', async () => {
    x = await askSetUp()
    const pending = x.agent('campaign.delete', deleteInput(x))
    const asked = await x.nthAsk()
    const from = x.events.length
    data(await answer(x, asked.requestId, true, true))
    data(await pending)
    expect(x.core.settings.get().mcp.autoApproveDestructive).toBe(true)
    expect(x.events.slice(from).some((e) => e.name === 'app.stateChanged')).toBe(true)
    const input = createInput()
    const subjectMap = input.subjectMap.map((m) => ({ ...m, create: false }))
    const { campaignId } = data<{ campaignId: string }>(
      await x.user('campaign.create', { projectId: x.projectId, ...input, subjectMap }),
    )
    const before = x.asked().length
    data(await x.agent('campaign.delete', { projectId: x.projectId, campaignId }))
    expect(x.asked()).toHaveLength(before)
  })

  it('rememberAuto with refuse saves nothing', async () => {
    x = await askSetUp()
    const pending = x.agent('campaign.delete', deleteInput(x))
    const asked = await x.nthAsk()
    data(await answer(x, asked.requestId, false, true))
    expect(await pending).toEqual(REFUSED)
    expect(x.core.settings.get().mcp.autoApproveDestructive).toBe(false)
  })

  it('auto-approve sends no event, deletes, and writes the auto_approved line', async () => {
    x = await askSetUp()
    data(await x.user('settings.update', { mcp: { autoApproveDestructive: true } }))
    data(await x.agent('campaign.delete', deleteInput(x)))
    expect(x.asked()).toEqual([])
    expect(x.campaignExists()).toBe(false)
    const [line] = askLines(x.readLogs())
    expect(line).toMatchObject({
      name: 'campaign.delete',
      actor: 'agent',
      agentClient: null,
      projectId: x.projectId,
      message: 'auto_approved',
      context: { outcome: 'auto_approved' },
    })
    expect(JSON.stringify(line)).not.toContain(x.campaignId)
  })

  it('refuses the agent agent.answerPermission and settings.update, and the ask still waits', async () => {
    x = await askSetUp()
    const pending = x.agent('campaign.delete', deleteInput(x))
    const asked = await x.nthAsk()
    const input = { requestId: asked.requestId, allow: true, rememberAuto: true }
    expect(await x.agent('agent.answerPermission', input)).toEqual({
      ok: false,
      error: { code: 'AGENT_DENIED', message: denialMessage('agent.answerPermission') },
    })
    const patch = { mcp: { autoApproveDestructive: true } }
    expect(await x.agent('settings.update', patch)).toMatchObject({
      ok: false,
      error: { code: 'AGENT_DENIED' },
    })
    expect(x.core.settings.get().mcp.autoApproveDestructive).toBe(false)
    expect(x.campaignExists()).toBe(true)
    data(await answer(x, asked.requestId, false))
    expect(await pending).toEqual(REFUSED)
  })

  it('writes one ask line per outcome with no input value', async () => {
    x = await askSetUp()
    const pending = x.agent('campaign.delete', deleteInput(x))
    data(await answer(x, (await x.nthAsk()).requestId, true))
    data(await pending)
    const lines = askLines(x.readLogs())
    expect(lines.map((l) => l.message)).toEqual(['allowed'])
    expect(JSON.stringify(lines)).not.toContain(x.campaignId)
  })
})

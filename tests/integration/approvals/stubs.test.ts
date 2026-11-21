// AP-5 (spec/phases/approvals.md "AP-5"): until its slice replaces it, each approvals command
// refuses as not set up, the two queries give their empty answers, and deps.approvals holds
// stub stores that keep nothing.
import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, data, type Fixture } from '../core-fixture'
import { APPROVALS_REASON_MESSAGES } from '@/shared/approvals/messages'

let f: Fixture | undefined
afterEach(() => {
  f?.cleanup()
  f = undefined
})

const asUser = { actor: 'user' as const }
const campaignId = 'spring-sale-abc234'
const NOT_SET_UP = {
  ok: false,
  error: {
    code: 'RULE_VIOLATION',
    message: APPROVALS_REASON_MESSAGES.approvals_not_set_up,
    details: { reason: 'approvals_not_set_up' },
  },
}

async function openProject(fx: Fixture): Promise<string> {
  const made = await fx.user('project.create', { name: 'A', location: fx.projectsDir })
  return data<{ projectId: string }>(made).projectId
}

describe('the approvals stubs [spec/phases/approvals.md "AP-5"]', () => {
  it.each([
    ['approvals.check', () => ({})],
    ['approvals.publish', (projectId: string) => ({ projectId, campaignId })],
    ['approvals.refresh', (projectId: string) => ({ projectId, campaignId })],
  ])('%s refuses as not set up, and sends no event', async (name, input) => {
    f = makeFixture()
    const projectId = await openProject(f)
    const before = f.events.length
    expect(await f.user(name, input(projectId))).toEqual(NOT_SET_UP)
    expect(f.events.slice(before)).toEqual([])
    expect(f.core.settings.get().approvals).toEqual({ baseUrl: null })
  })

  it('checks the input before the stub answers', async () => {
    f = makeFixture()
    const projectId = await openProject(f)
    const bad = { projectId, campaignId: '../other' }
    expect(await f.user('approvals.publish', bad)).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    })
    expect(await f.core.query('approvals.forCampaign', bad, asUser)).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    })
  })

  it('answers approvals.forCampaign with no service, no link and no variants', async () => {
    f = makeFixture()
    const projectId = await openProject(f)
    expect(await f.core.query('approvals.forCampaign', { projectId, campaignId }, asUser)).toEqual({
      ok: true,
      data: { ready: 'no_service', link: null, variants: [] },
    })
  })

  it('answers approvals.getPassword with no password', async () => {
    f = makeFixture()
    const projectId = await openProject(f)
    expect(await f.core.query('approvals.getPassword', { projectId, campaignId }, asUser)).toEqual({
      ok: true,
      data: { password: null },
    })
  })

  it('wires deps.approvals with no password kept and a picture store that keeps nothing', async () => {
    f = makeFixture()
    const { passwords, pictures } = f.core.deps.approvals
    const projectId = '01JD5Z8Q4N3V6W7X8Y9Z0ABCDE'
    expect(passwords.read(projectId, campaignId)).toBeNull()
    const store = pictures()
    await expect(store.put('a.png', new Uint8Array([1]))).rejects.toThrow()
    await expect(store.signedUrl('a.png', 60)).rejects.toThrow()
    await expect(store.list('adman-approvals/')).rejects.toThrow()
    await expect(store.remove(['a.png'])).rejects.toThrow()
  })
})

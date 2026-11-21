// spec/approvals.md "The campaign page", the store: holds approvals.forCampaign, reads it again
// on approvals.changed and project.changed, and refreshes a live, ready link on open, every
// 60 s while the window has focus, on focus, and on Refresh; one at a time (A-92).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApprovalsStore } from '@/renderer/stores/approvals-store'
import { createAppStore } from '@/renderer/stores/app-store'
import { APPROVALS_REASON_MESSAGES } from '@/shared/approvals/messages'
import type { ApprovalsForCampaign } from '@/shared/schemas/queries/approvals'
import type { Result } from '@/shared/schemas/result'
import { makeFakeApi } from '../fake-api'
import { C, P, endedLink, forCampaign } from './approvals-fixture'

const OFFLINE = 'The approvals service could not be reached. Check the address and your connection.'
let focused = true

function setUp(reply: ApprovalsForCampaign = forCampaign()) {
  const fake = makeFakeApi()
  let current = reply
  fake.onQuery('approvals.forCampaign', () => ({ ok: true, data: current }))
  const store = createApprovalsStore(fake.api, P, C)
  return {
    fake,
    store,
    answer: (next: ApprovalsForCampaign) => {
      current = next
    },
  }
}

const refreshes = (fake: ReturnType<typeof makeFakeApi>) =>
  fake.commands.filter((c) => c.name === 'approvals.refresh')
const reads = (fake: ReturnType<typeof makeFakeApi>) =>
  fake.queries.filter((q) => q.name === 'approvals.forCampaign')
const settle = () => vi.advanceTimersByTimeAsync(0)

beforeEach(() => {
  vi.useFakeTimers()
  focused = true
  vi.spyOn(document, 'hasFocus').mockImplementation(() => focused)
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('approvals store [spec/approvals.md "The campaign page"; A-92]', () => {
  it('reads approvals.forCampaign and refreshes once when the page opens', async () => {
    const { fake, store } = setUp()
    store.getState().start()
    await settle()
    expect(reads(fake)[0]?.input).toEqual({ projectId: P, campaignId: C })
    expect(store.getState().data).toEqual(forCampaign())
    expect(refreshes(fake).map((c) => c.input)).toEqual([{ projectId: P, campaignId: C }])
  })

  it('refreshes every 60 s while the window has focus, and not without it', async () => {
    const { fake, store } = setUp()
    store.getState().start()
    await settle()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(refreshes(fake)).toHaveLength(2)
    focused = false
    await vi.advanceTimersByTimeAsync(180_000)
    expect(refreshes(fake)).toHaveLength(2)
  })

  it('refreshes when the window gains focus', async () => {
    const { fake, store } = setUp()
    store.getState().start()
    await settle()
    window.dispatchEvent(new Event('focus'))
    await settle()
    expect(refreshes(fake)).toHaveLength(2)
  })

  it('drops a refresh asked for while one runs', async () => {
    const { fake, store } = setUp()
    let finish: (r: Result<unknown>) => void = () => undefined
    fake.onCommand('approvals.refresh', () => new Promise((resolve) => (finish = resolve)))
    store.getState().start()
    await settle()
    expect(store.getState().refreshing).toBe(true)
    void store.getState().refresh()
    window.dispatchEvent(new Event('focus'))
    await vi.advanceTimersByTimeAsync(60_000)
    expect(refreshes(fake)).toHaveLength(1)
    finish({ ok: true, data: { changed: false, gone: false } })
    await settle()
    expect(store.getState().refreshing).toBe(false)
    fake.onCommand('approvals.refresh', () => ({ ok: true, data: { changed: false, gone: false } }))
    await store.getState().refresh()
    expect(refreshes(fake)).toHaveLength(2)
  })

  it('stops its timer, focus and events when the page closes', async () => {
    const { fake, store } = setUp()
    const stop = store.getState().start()
    await settle()
    stop()
    await vi.advanceTimersByTimeAsync(180_000)
    window.dispatchEvent(new Event('focus'))
    fake.emit('approvals.changed', { projectId: P, campaignId: C })
    await settle()
    expect(refreshes(fake)).toHaveLength(1)
    expect(reads(fake)).toHaveLength(1)
  })

  it('keeps a failure for the bar and never sends it to the error banner', async () => {
    const { fake, store } = setUp()
    const app = createAppStore(fake.api)
    fake.onCommand('approvals.refresh', () => ({
      ok: false,
      error: { code: 'PROVIDER_ERROR', message: OFFLINE },
    }))
    store.getState().start()
    await settle()
    expect(store.getState().failure).toBe(OFFLINE)
    expect(app.getState().error).toBeNull()
    fake.onCommand('approvals.refresh', () => ({ ok: true, data: { changed: false, gone: false } }))
    await store.getState().refresh()
    expect(store.getState().failure).toBeNull()
  })

  it('shows the gone sentence after a gone: true reply', async () => {
    const { fake, store } = setUp()
    fake.onCommand('approvals.refresh', () => ({ ok: true, data: { changed: true, gone: true } }))
    store.getState().start()
    await settle()
    expect(store.getState().notice).toBe(APPROVALS_REASON_MESSAGES.approval_link_gone)
  })

  it('reads again on approvals.changed for its campaign and project.changed for its project', async () => {
    const { fake, store, answer } = setUp()
    store.getState().start()
    await settle()
    answer(forCampaign({ link: endedLink() }))
    fake.emit('approvals.changed', { projectId: P, campaignId: 'other' })
    fake.emit('project.changed', { projectId: 'other', changed: {}, removed: {}, actor: 'user' })
    await settle()
    expect(reads(fake)).toHaveLength(1)
    fake.emit('approvals.changed', { projectId: P, campaignId: C })
    await settle()
    expect(reads(fake)).toHaveLength(2)
    expect(store.getState().data?.link?.state).toBe('ended')
    fake.emit('project.changed', { projectId: P, changed: {}, removed: {}, actor: 'user' })
    await settle()
    expect(reads(fake)).toHaveLength(3)
  })

  it.each([
    ['no service', forCampaign({ ready: 'no_service' })],
    ['no bucket', forCampaign({ ready: 'no_bucket' })],
    ['no link', forCampaign({ link: null })],
    ['an ended link', forCampaign({ link: endedLink() })],
  ])('sends no refresh with %s', async (_name, reply) => {
    const { fake, store } = setUp(reply)
    store.getState().start()
    await settle()
    window.dispatchEvent(new Event('focus'))
    await vi.advanceTimersByTimeAsync(120_000)
    await store.getState().refresh()
    expect(refreshes(fake)).toEqual([])
  })
})

// spec/approvals.md "An update in the background" (D-110): the app store owns each campaign's
// "Update gallery": whether it runs, its latest approvals.progress and "Stop", per project and
// campaign. It is sent through the store's command and cleared when that command settles.
import { describe, expect, it } from 'vitest'
import { createAppStore } from '@/renderer/stores/app-store'
import { updateKey } from '@/renderer/stores/gallery-updates'
import type { EventMap } from '@/shared/schemas/events'
import type { Result } from '@/shared/schemas/result'
import { makeFakeApi } from '../fake-api'

const P = 'P1'
const C = 'C1'
const KEY = updateKey(P, C)
const counts = { step: 'drawing', done: 0, total: 2, unitsDone: 0, unitsTotal: 4 } as const

async function running() {
  const fake = makeFakeApi()
  let finish: (r: Result<unknown>) => void = () => undefined
  fake.onCommand('approvals.publish', () => new Promise((resolve) => (finish = resolve)))
  fake.onCommand('approvals.cancelUpdate', () => ({ ok: true, data: { stopped: true } }))
  const store = createAppStore(fake.api)
  await store.getState().refresh()
  const sent = store.getState().updateGallery(P, C)
  const emit = (payload: Partial<EventMap['approvals.progress']> = {}) =>
    fake.emit('approvals.progress', { projectId: P, campaignId: C, ...counts, ...payload })
  const update = () => store.getState().updates[KEY]
  return { fake, store, sent, emit, update, finish: (r: Result<unknown>) => finish(r) }
}

describe('the app store owns "Update gallery" [D-110]', () => {
  it('sends approvals.publish and is running, with no progress before the first event', async () => {
    const { fake, update } = await running()
    expect(fake.commands.map((c) => [c.name, c.input])).toEqual([
      ['approvals.publish', { projectId: P, campaignId: C }],
    ])
    expect(update()).toEqual({ running: true, progress: null, stopping: false, refusal: null })
  })

  it('keeps the latest progress of its campaign and ignores another campaign or project', async () => {
    const { emit, update } = await running()
    emit()
    emit({ step: 'making', done: 0, total: 1, unitsDone: 2 })
    emit({ campaignId: 'C2', step: 'finishing' })
    emit({ projectId: 'P2', step: 'finishing' })
    expect(update()?.progress).toEqual({ ...counts, step: 'making', total: 1, unitsDone: 2 })
  })

  it('is cleared when the command succeeds and hears no event after', async () => {
    const { sent, emit, update, finish } = await running()
    finish({ ok: true, data: { variants: 2, drawn: 2, clips: 0 } })
    expect(await sent).toMatchObject({ ok: true })
    emit()
    expect(update()).toBeUndefined()
  })

  it('keeps a refusal for the dialog and puts it in the banner', async () => {
    const { store, sent, update, finish } = await running()
    const message = 'The update was stopped.'
    finish({ ok: false, error: { code: 'RULE_VIOLATION', message } })
    await sent
    expect(update()).toEqual({ running: false, progress: null, stopping: false, refusal: message })
    expect(store.getState().error).toBe(message)
    store.getState().clearRefusal(P, C)
    expect(update()).toBeUndefined()
  })

  it('sends approvals.cancelUpdate once on stop and marks it stopping', async () => {
    const { fake, store, update } = await running()
    store.getState().stopUpdate(P, C)
    store.getState().stopUpdate(P, C)
    expect(update()?.stopping).toBe(true)
    expect(fake.commands.map((c) => c.name)).toEqual([
      'approvals.publish',
      'approvals.cancelUpdate',
    ])
  })
})

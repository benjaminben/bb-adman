import { describe, it, expect } from 'vitest'
import { createAppStore, type AppStore, type AppStoreState } from '@/renderer/stores/app-store'
import { runAsk, addModel } from '@/renderer/stores/run-asks'
import type { ErrorBody, Result } from '@/shared/schemas/result'
import { makeFakeApi, baseState } from '../fake-api'

const flush = () => new Promise((r) => setTimeout(r, 0))

const ADDRESS: ErrorBody = {
  code: 'RULE_VIOLATION',
  message: "Enter your ComfyUI server's address to use it.",
  details: { reason: 'comfy_address_needed' },
}
const LICENCE: ErrorBody = {
  code: 'INVALID_INPUT',
  message: 'MiniMax H3 requires a commercial license. Confirm that you have one first.',
  details: { reason: 'licence_not_confirmed', workflow: 'h3-text-to-video' },
}
const VIDEO = { projectId: 'P1', campaignId: 'C1', prompt: 'A can turning', durationMs: 2000 }

describe('runAsk: which refusal of which command opens which dialog [S2-6]', () => {
  it.each([
    ['generation.runImages', ADDRESS, { kind: 'address' }],
    ['generation.startVideo', ADDRESS, { kind: 'address' }],
    ['job.retry', ADDRESS, { kind: 'address' }],
    ['generation.runImages', LICENCE, { kind: 'licence', workflow: 'h3-text-to-video' }],
    ['generation.startVideo', LICENCE, { kind: 'licence', workflow: 'h3-text-to-video' }],
    ['job.retry', LICENCE, { kind: 'licence', workflow: 'h3-text-to-video' }],
    ['generation.cutOut', ADDRESS, { kind: 'address' }],
    ['generation.cutOut', LICENCE, { kind: 'licence', workflow: 'h3-text-to-video' }],
    ['comfy.check', ADDRESS, null],
    ['asset.import', LICENCE, null],
    ['generation.runImages', { ...ADDRESS, code: 'INVALID_INPUT' }, null],
    ['generation.runImages', { ...LICENCE, details: { reason: 'licence_not_confirmed' } }, null],
    ['generation.runImages', { code: 'NOT_FOUND', message: 'No such campaign.' }, null],
  ])('%s refused with %j asks %j', (name, error, ask) => {
    expect(runAsk(name, error as ErrorBody)).toEqual(ask)
  })

  it('adds a model to the saved list once', () => {
    expect(addModel(['FLUX 3 klein'], 'MiniMax H3')).toEqual(['FLUX 3 klein', 'MiniMax H3'])
    expect(addModel(['MiniMax H3'], 'MiniMax H3')).toEqual(['MiniMax H3'])
  })
})

async function storeWith(answers: Array<Result<unknown>>, name = 'generation.startVideo') {
  const fake = makeFakeApi(
    baseState({ settings: { ...baseState().settings, licenceConfirmed: ['FLUX 3 klein'] } }),
  )
  fake.onCommand(name, () => answers.shift() ?? { ok: true, data: { jobId: 'J1' } })
  const store = createAppStore(fake.api)
  await store.getState().refresh()
  return { fake, store, sent: () => fake.commands.map((c) => c.name) }
}

async function whenAsked<K extends 'addressRequest' | 'licenceRequest'>(
  store: AppStore,
  key: K,
): Promise<NonNullable<AppStoreState[K]>> {
  for (let i = 0; i < 20 && store.getState()[key] === null; i++) await flush()
  const request = store.getState()[key]
  if (!request) throw new Error(`${key} never opened`)
  return request
}

describe('the app store asks and sends again [S2-6, FR-255, D-088]', () => {
  it('opens the address request and sends the same input once more after a save', async () => {
    const { fake, store } = await storeWith([{ ok: false, error: ADDRESS }], 'generation.runImages')
    const done = store.getState().command('generation.runImages', VIDEO)
    const request = await whenAsked(store, 'addressRequest')
    request.resolve(true)
    const result = await done
    expect(result.ok).toBe(true)
    expect(fake.commands).toEqual([
      { name: 'generation.runImages', input: VIDEO },
      { name: 'generation.runImages', input: VIDEO },
    ])
    expect(store.getState().addressRequest).toBeNull()
  })

  it('returns the refusal on Cancel, sends nothing more and leaves the banner empty', async () => {
    const { store, sent } = await storeWith([{ ok: false, error: ADDRESS }], 'job.retry')
    const done = store.getState().command('job.retry', { projectId: 'P1', jobId: 'J0' })
    ;(await whenAsked(store, 'addressRequest')).resolve(false)
    expect(await done).toEqual({ ok: false, error: ADDRESS })
    expect(sent()).toEqual(['job.retry'])
    expect(store.getState().error).toBeNull()
  })

  it('opens the licence request with the workflow; Confirm sends the input with the flag', async () => {
    const { fake, store } = await storeWith([{ ok: false, error: LICENCE }])
    const done = store.getState().command('generation.startVideo', VIDEO)
    const request = await whenAsked(store, 'licenceRequest')
    expect(request.workflow).toBe('h3-text-to-video')
    request.resolve({ confirmed: true, remember: null })
    expect((await done).ok).toBe(true)
    expect(fake.commands).toEqual([
      { name: 'generation.startVideo', input: VIDEO },
      { name: 'generation.startVideo', input: { ...VIDEO, licenceConfirmed: true } },
    ])
  })

  it('sends the cut-out again with the flag after the licence is confirmed', async () => {
    const CUT = { projectId: 'P1', variantId: 'V1', layerId: 'L1', provider: 'comfyui' }
    const { fake, store } = await storeWith([{ ok: false, error: LICENCE }], 'generation.cutOut')
    const done = store.getState().command('generation.cutOut', CUT)
    ;(await whenAsked(store, 'licenceRequest')).resolve({ confirmed: true, remember: null })
    expect((await done).ok).toBe(true)
    expect(fake.commands).toEqual([
      { name: 'generation.cutOut', input: CUT },
      { name: 'generation.cutOut', input: { ...CUT, licenceConfirmed: true } },
    ])
  })

  it('saves a ticked model with settings.update before the run is sent again', async () => {
    const { fake, store, sent } = await storeWith([{ ok: false, error: LICENCE }])
    const done = store.getState().command('generation.startVideo', VIDEO)
    ;(await whenAsked(store, 'licenceRequest')).resolve({ confirmed: true, remember: 'MiniMax H3' })
    await done
    expect(sent()).toEqual(['generation.startVideo', 'settings.update', 'generation.startVideo'])
    expect(fake.commands[1]?.input).toEqual({ licenceConfirmed: ['FLUX 3 klein', 'MiniMax H3'] })
  })

  it('keeps a refused settings.update in the banner and still sends the run', async () => {
    const { fake, store, sent } = await storeWith([{ ok: false, error: LICENCE }])
    fake.onCommand('settings.update', () => ({
      ok: false,
      error: { code: 'INTERNAL', message: 'The settings could not be saved.' },
    }))
    const done = store.getState().command('generation.startVideo', VIDEO)
    ;(await whenAsked(store, 'licenceRequest')).resolve({ confirmed: true, remember: 'MiniMax H3' })
    expect((await done).ok).toBe(true)
    expect(sent()).toEqual(['generation.startVideo', 'settings.update', 'generation.startVideo'])
    expect(store.getState().error).toBe('The settings could not be saved.')
  })

  it('sends nothing on Cancel of the licence request and leaves the banner empty', async () => {
    const { store, sent } = await storeWith([{ ok: false, error: LICENCE }])
    const done = store.getState().command('generation.startVideo', VIDEO)
    ;(await whenAsked(store, 'licenceRequest')).resolve({ confirmed: false, remember: null })
    expect(await done).toEqual({ ok: false, error: LICENCE })
    expect(sent()).toEqual(['generation.startVideo'])
    expect(store.getState().error).toBeNull()
  })

  it('does not ask a second time: the second refusal goes to the banner', async () => {
    const twice = { ok: false as const, error: LICENCE }
    const { store, sent } = await storeWith([twice, twice])
    const done = store.getState().command('generation.startVideo', VIDEO)
    ;(await whenAsked(store, 'licenceRequest')).resolve({ confirmed: true, remember: null })
    expect((await done).ok).toBe(false)
    expect(sent()).toEqual(['generation.startVideo', 'generation.startVideo'])
    expect(store.getState().licenceRequest).toBeNull()
    expect(store.getState().error).toBe(LICENCE.message)
  })

  it('asks for the address and then the licence in one call', async () => {
    const { store, sent } = await storeWith([
      { ok: false, error: ADDRESS },
      { ok: false, error: LICENCE },
    ])
    const done = store.getState().command('generation.startVideo', VIDEO)
    ;(await whenAsked(store, 'addressRequest')).resolve(true)
    ;(await whenAsked(store, 'licenceRequest')).resolve({ confirmed: true, remember: null })
    expect((await done).ok).toBe(true)
    expect(sent()).toEqual(Array(3).fill('generation.startVideo'))
  })

  it.each([
    ['comfy.check', ADDRESS],
    ['asset.import', LICENCE],
  ])('opens nothing for a %s refusal', async (name, error) => {
    const { store } = await storeWith([{ ok: false, error }], name)
    expect((await store.getState().command(name, {})).ok).toBe(false)
    expect(store.getState().addressRequest).toBeNull()
    expect(store.getState().licenceRequest).toBeNull()
    expect(store.getState().error).toBe(error.message)
  })
})

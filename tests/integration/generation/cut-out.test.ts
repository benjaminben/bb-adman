// P4-11: generation.cutOut through the real core (spec/ai-jobs.md "Cut-out", "Security
// notes"; FR-307). Each refusal in its order, before any job row; the ComfyUI checks against
// the stand-in's address only (nothing is sent in prepare); the agent never confirms a licence.
import fs from 'node:fs'
import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  makeGenerationFixture,
  BACKGROUND_LAYER,
  OTHER_LAYER,
  TEXT_LAYER,
  VARIANT,
} from './generation-fixture'
import { makeComfyFixture } from './comfy-fixture'
import { cutOutInput, givePicture } from './cutout-fixture'
import { startComfyStandIn, type StandIn } from '../../helpers/comfy-stand-in'
import { data } from '../core-fixture'
import { licenceNotConfirmedMessage } from '@/shared/providers/messages'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import type { JobRow } from '@/shared/schemas/rows/job'

// [D-103] The shipped workflows are proven. This file proves the trial rule, so it runs on
// a copy of the list where each of them is a trial (tests/helpers/trial-workflows.ts).
vi.mock('@/main/providers/comfyui/workflows', async (load) =>
  (await import('../../helpers/trial-workflows')).asTrial(await load()),
)

// S2-4 [D-088]: BiRefNet ships with no licence note. This file can give it one, so the agent
// rule can be seen on the cut-out workflow itself.
const licence = vi.hoisted(() => ({ note: null as string | null }))
vi.mock('@/main/providers/comfyui/workflows/birefnet', async (original) => {
  const real = await original<typeof import('@/main/providers/comfyui/workflows/birefnet')>()
  const spec = { ...real.birefnetCutout }
  Object.defineProperty(spec, 'licence', {
    get: () => ({ ...real.birefnetCutout.licence, commercialNote: licence.note }),
  })
  return { birefnetCutout: spec }
})

type Fixture = { cleanup(): void; jobs(): JobRow[] }
let f: Fixture
let stand: StandIn | null = null
afterEach(async () => {
  f.cleanup()
  await stand?.close()
  stand = null
  licence.note = null
})

const KEYED: ProviderInfo = {
  id: 'keyed-cutout',
  label: 'Keyed',
  jobs: ['cutout'],
  available: true,
  secrets: ['gemini.apiKey'],
  defaultModels: {},
  local: false,
  cancel: 'none',
  serverText: false,
}
const PICTURES_ONLY: ProviderInfo = { ...KEYED, id: 'pictures-only', secrets: [], jobs: ['image'] }
const NOT_AVAILABLE: ProviderInfo = { ...KEYED, id: 'not-available', secrets: [], available: false }

const NO_CUTOUT = { code: 'INVALID_INPUT', message: 'That provider cannot cut out pictures.' }
const NO_LAYER = { code: 'NOT_FOUND' }
const NOT_PICTURE = { code: 'INVALID_INPUT', message: 'Cut-outs are made from a picture layer.' }
const NO_PICTURE = { code: 'INVALID_INPUT', message: 'Choose a picture for this layer first.' }
const NEEDS_KEY = { code: 'NEEDS_KEY', message: 'Add your Keyed key to cut out a picture.' }

async function fakeFixture(picture = true) {
  const g = await makeGenerationFixture()
  g.core.deps.providers.push(KEYED, PICTURES_ONLY, NOT_AVAILABLE)
  const sourceId = await g.importPicture('source.png')
  if (picture) givePicture(g.db, BACKGROUND_LAYER, sourceId)
  f = g
  return { g, sourceId }
}

describe('generation.cutOut refusals, in order [spec/ai-jobs.md "Cut-out"]', () => {
  it.each([
    ['an unknown provider', { provider: 'nope' }, NO_CUTOUT],
    ['a provider without cut-outs', { provider: PICTURES_ONLY.id }, NO_CUTOUT],
    ['a provider not available', { provider: NOT_AVAILABLE.id }, NO_CUTOUT],
    ['the provider before the layer', { provider: 'nope', layerId: 'gone' }, NO_CUTOUT],
    ['a missing layer', { layerId: 'gone' }, NO_LAYER],
    ['a layer of another variant', { layerId: OTHER_LAYER }, NO_LAYER],
    ['a text layer', { layerId: TEXT_LAYER }, NOT_PICTURE],
    ['the layer before the key', { layerId: TEXT_LAYER, provider: KEYED.id }, NOT_PICTURE],
    ['a missing key', { provider: KEYED.id }, NEEDS_KEY],
  ])('refuses %s, with no job row', async (_case, extra, error) => {
    const { g } = await fakeFixture()
    const r = await g.user('generation.cutOut', cutOutInput(extra))
    expect(r).toEqual({ ok: false, error: expect.objectContaining(error) })
    expect(g.jobs()).toEqual([])
  })

  it('refuses a picture layer with no picture, before the key', async () => {
    const { g } = await fakeFixture(false)
    const r = await g.user('generation.cutOut', cutOutInput({ provider: KEYED.id }))
    expect(r).toEqual({ ok: false, error: expect.objectContaining(NO_PICTURE) })
    expect(g.jobs()).toEqual([])
  })

  it('reads the source in prepare: a picture whose file is gone is refused, no job row', async () => {
    const { g, sourceId } = await fakeFixture()
    fs.rmSync(g.asset(sourceId)?.absPath ?? '')
    const r = await g.user('generation.cutOut', cutOutInput())
    expect(r).toEqual({ ok: false, error: expect.objectContaining({ code: 'MISSING_FILE' }) })
    expect(g.jobs()).toEqual([])
  })
})

describe('generation.cutOut enqueues [FR-307]', () => {
  it('one cutout job with the layer, its campaign and variant, and the source in the request', async () => {
    const { g, sourceId } = await fakeFixture()
    const r = await g.user('generation.cutOut', cutOutInput())
    const { jobId } = data<{ jobId: string }>(r)
    expect(r).toEqual({ ok: true, data: { jobId } })
    expect(g.job(jobId)).toMatchObject({
      kind: 'cutout',
      campaignId: 'c1',
      variantId: VARIANT,
      layerId: BACKGROUND_LAYER,
      slot: null,
      provider: 'fake',
      startedBy: 'user',
      request: { sourceAssetId: sourceId },
    })
  })

  it('accepts the agent when the provider is ticked, as startedBy agent', async () => {
    const { g } = await fakeFixture()
    data(await g.user('agentRuns.setAllowed', { provider: 'fake', allowed: true }))
    const r = await g.core.bus.execute(
      'generation.cutOut',
      { projectId: g.projectId, ...cutOutInput() },
      { actor: 'agent' },
    )
    const { jobId } = data<{ jobId: string }>(r)
    expect(g.job(jobId)).toMatchObject({ kind: 'cutout', startedBy: 'agent' })
  })
})

async function comfyFixture(devTools: boolean, address = true) {
  stand = await startComfyStandIn()
  const c = await makeComfyFixture({
    devTools,
    licenceConfirmed: [],
    ...(address && { origin: stand.origin }),
  })
  givePicture(c.db, BACKGROUND_LAYER, await c.importPicture('pics', 'source.png'))
  f = c
  return c
}

const comfyInput = (extra: Record<string, unknown> = {}) =>
  cutOutInput({ provider: 'comfyui', ...extra })

describe('generation.cutOut on ComfyUI [spec/ai-jobs.md "Cut-out" step 4]', () => {
  it.each([
    ['no address', 'user', true, false, 'comfy_address_needed'],
    ['no offered workflow (dev tools off)', 'user', false, true, 'comfy_job_not_offered'],
    ['no offered workflow (dev tools off)', 'agent', false, true, 'comfy_job_not_offered'],
  ] as const)('refuses with %s for the %s, no job row, nothing sent', async (...args) => {
    const [, actor, devTools, address, reason] = args
    const c = await comfyFixture(devTools, address)
    data(await c.user('agentRuns.setAllowed', { provider: 'comfyui', allowed: true }))
    const r = await c[actor]('generation.cutOut', comfyInput({ licenceConfirmed: true }))
    expect(r).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'RULE_VIOLATION', details: { reason } }),
    })
    expect(c.jobs()).toEqual([])
    expect(stand?.seen).toEqual([])
  })

  it('enqueues with the trial workflow offered (dev tools on), nothing sent in prepare', async () => {
    const c = await comfyFixture(true)
    const before = stand?.seen.length
    const { jobId } = data<{ jobId: string }>(await c.user('generation.cutOut', comfyInput()))
    expect(c.job(jobId)).toMatchObject({ kind: 'cutout', provider: 'comfyui' })
    expect(before).toBe(0)
  })
})

describe('generation.cutOut and the licence [S2-4, D-088; spec/ai-jobs.md "Security notes"]', () => {
  const refused = {
    ok: false,
    error: {
      code: 'INVALID_INPUT',
      message: licenceNotConfirmedMessage('BiRefNet'),
      details: { reason: 'licence_not_confirmed', workflow: 'birefnet-cutout' },
    },
  }

  it('ignores licenceConfirmed: true from a ticked agent, so an unconfirmed licence refuses', async () => {
    licence.note = 'Needs a commercial licence'
    const c = await comfyFixture(true)
    data(await c.user('agentRuns.setAllowed', { provider: 'comfyui', allowed: true }))
    const r = await c.agent('generation.cutOut', comfyInput({ licenceConfirmed: true }))
    expect(r).toEqual(refused)
    expect(c.jobs()).toEqual([])
    expect(stand?.seen).toEqual([])
  })

  it('accepts the flag from the user', async () => {
    licence.note = 'Needs a commercial licence'
    const c = await comfyFixture(true)
    expect(await c.user('generation.cutOut', comfyInput())).toEqual(refused)
    const r = await c.user('generation.cutOut', comfyInput({ licenceConfirmed: true }))
    expect(r).toMatchObject({ ok: true })
    expect(c.jobs()).toHaveLength(1)
  })

  it('accepts the agent once the user saved the model in Settings', async () => {
    licence.note = 'Needs a commercial licence'
    const c = await comfyFixture(true)
    data(await c.user('agentRuns.setAllowed', { provider: 'comfyui', allowed: true }))
    data(
      await c.core.bus.execute(
        'settings.update',
        { licenceConfirmed: ['BiRefNet'] },
        { actor: 'user' },
      ),
    )
    expect(await c.agent('generation.cutOut', comfyInput())).toMatchObject({ ok: true })
  })
})

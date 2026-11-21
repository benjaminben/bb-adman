// job.retry of a ComfyUI generative fill runs the fill's ComfyUI checks again, as
// generation.runFill does (spec/links-and-sync.md "Generative fill" step 2): no address, no
// offered extend workflow (a draft for no one, a trial one only with the dev tools), and the
// licence, before any new row. No extend workflow is offered today, so the failed row is
// inserted directly; a mock turns moss-extend into a trial workflow for the passing cases.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { makeComfyFixture, type ComfyFixture } from '../generation/comfy-fixture'
import { startComfyStandIn, type StandIn } from '../../helpers/comfy-stand-in'
import { data } from '../core-fixture'

const extend = vi.hoisted(() => ({ trial: false, note: null as string | null }))
vi.mock('@/main/providers/comfyui/workflows/moss', async (original) => {
  const real = await original<typeof import('@/main/providers/comfyui/workflows/moss')>()
  const spec = { ...real.mossExtend }
  Object.defineProperty(spec, 'status', {
    get: () => (extend.trial ? 'trial' : real.mossExtend.status),
  })
  Object.defineProperty(spec, 'licence', {
    get: () => ({ ...real.mossExtend.licence, commercialNote: extend.note }),
  })
  return { ...real, mossExtend: spec }
})

let f: ComfyFixture
let stand: StandIn
afterEach(async () => {
  f.cleanup()
  await stand.close()
  extend.trial = false
  extend.note = null
})

const REQUEST = {
  prompt: 'Extend the picture',
  sourceAssetId: 'src',
  placement: { x: 40, y: 50, width: 600, height: 700 },
  width: 1080,
  height: 1350,
}

// A failed ComfyUI fill row, as a run that ended would leave it.
async function failedRow(devTools: boolean, address = true): Promise<void> {
  stand = await startComfyStandIn()
  f = await makeComfyFixture({
    devTools,
    licenceConfirmed: [],
    ...(address && { origin: stand.origin }),
  })
  f.db
    .prepare(
      `INSERT INTO job (id, kind, status, campaign_id, variant_id, layer_id, provider, model,
        request, paid_calls, started_by, error_kind, error_reason, error_detail, created_at,
        updated_at)
       VALUES ('old', 'generative_fill', 'failed', 'c1', 'v2', 'l-bg', 'comfyui', '', ?, 0,
        'user', 'offline', 'no_answer', 'x', 'x', 'x')`,
    )
    .run(JSON.stringify(REQUEST))
}

const retry = (extra: Record<string, unknown> = {}) =>
  f.user('job.retry', { jobId: 'old', ...extra })

const reasonOf = (r: unknown) =>
  (r as { error?: { details?: { reason?: string } } }).error?.details?.reason

describe('job.retry of a ComfyUI fill [spec/links-and-sync.md "Generative fill" step 2]', () => {
  it.each([
    ['no address', true, false, false, 'comfy_address_needed'],
    ['moss-extend a draft, dev tools on', true, true, false, 'comfy_job_not_offered'],
    ['moss-extend a trial, dev tools off', false, true, true, 'comfy_job_not_offered'],
  ])(
    'refuses with %s, no new row, nothing sent',
    async (_case, devTools, address, trial, reason) => {
      extend.trial = trial
      await failedRow(devTools, address)
      expect(reasonOf(await retry())).toBe(reason)
      expect(f.jobs()).toHaveLength(1)
      expect(stand.seen).toEqual([])
    },
  )

  it('with a trial extend workflow and dev tools on, makes a new fill row', async () => {
    extend.trial = true
    await failedRow(true)
    const { jobId } = data<{ jobId: string }>(await retry())
    expect(f.job(jobId)).toMatchObject({
      kind: 'generative_fill',
      provider: 'comfyui',
      layerId: 'l-bg',
      request: REQUEST,
    })
  })

  it('refuses a workflow whose licence is not confirmed, accepts the user flag', async () => {
    extend.trial = true
    extend.note = 'Needs a commercial licence'
    await failedRow(true)
    expect(reasonOf(await retry())).toBe('licence_not_confirmed')
    expect(f.jobs()).toHaveLength(1)
    expect(await retry({ licenceConfirmed: true })).toMatchObject({ ok: true })
  })
})

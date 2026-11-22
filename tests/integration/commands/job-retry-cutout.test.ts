// P4-11: job.retry of a ComfyUI cut-out runs the cut-out's ComfyUI checks again (spec/ai-jobs.md
// "Cut-out" step 4): no address, no offered workflow (a trial one needs the dev tools), and the
// licence, before any new row. Agents are denied job.retry by the policy.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { makeComfyFixture, type ComfyFixture } from '../generation/comfy-fixture'
import { startComfyStandIn, type StandIn } from '../../helpers/comfy-stand-in'
import { data } from '../core-fixture'

// [D-103] The shipped workflows are proven. This file proves the trial rule, so it runs on
// a copy of the list where each of them is a trial (tests/helpers/trial-workflows.ts).
vi.mock('@/main/providers/comfyui/workflows', async (load) =>
  (await import('../../helpers/trial-workflows')).asTrial(await load()),
)

const licence = vi.hoisted(() => ({ note: null as string | null }))
vi.mock('@/main/providers/comfyui/workflows/birefnet', async (original) => {
  const real = await original<typeof import('@/main/providers/comfyui/workflows/birefnet')>()
  const spec = { ...real.birefnetCutout }
  Object.defineProperty(spec, 'licence', {
    get: () => ({ ...real.birefnetCutout.licence, commercialNote: licence.note }),
  })
  return { birefnetCutout: spec }
})

let f: ComfyFixture
let stand: StandIn
afterEach(async () => {
  f.cleanup()
  await stand.close()
  licence.note = null
})

// A failed ComfyUI cut-out row, as a run that ended would leave it.
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
       VALUES ('old', 'cutout', 'failed', 'c1', 'v1', 'l-bg', 'comfyui', '', ?, 0, 'user',
        'offline', 'no_answer', 'x', 'x', 'x')`,
    )
    .run(JSON.stringify({ sourceAssetId: 'src' }))
}

const retry = (extra: Record<string, unknown> = {}) =>
  f.user('job.retry', { jobId: 'old', ...extra })

const reasonOf = (r: unknown) =>
  (r as { error?: { details?: { reason?: string } } }).error?.details?.reason

describe('job.retry of a ComfyUI cut-out [P4-11; spec/ai-jobs.md "Cut-out"]', () => {
  it.each([
    ['no address', true, false, 'comfy_address_needed'],
    ['dev tools off, so the trial workflow is not offered', false, true, 'comfy_job_not_offered'],
  ])('refuses with %s, no new row, nothing sent', async (_case, devTools, address, reason) => {
    await failedRow(devTools, address)
    expect(reasonOf(await retry())).toBe(reason)
    expect(f.jobs()).toHaveLength(1)
    expect(stand.seen).toEqual([])
  })

  it('with dev tools on, makes a new cutout row with the same layer and request', async () => {
    await failedRow(true)
    const { jobId } = data<{ jobId: string }>(await retry())
    expect(f.job(jobId)).toMatchObject({
      kind: 'cutout',
      provider: 'comfyui',
      layerId: 'l-bg',
      request: { sourceAssetId: 'src' },
    })
  })

  it('refuses a workflow whose licence is not confirmed, accepts the user flag', async () => {
    licence.note = 'Needs a commercial licence'
    await failedRow(true)
    expect(reasonOf(await retry())).toBe('licence_not_confirmed')
    expect(f.jobs()).toHaveLength(1)
    expect(await retry({ licenceConfirmed: true })).toMatchObject({ ok: true })
  })

  it('is denied to an agent, dev tools off or on, with no new row', async () => {
    for (const devTools of [false, true]) {
      if (stand) await stand.close()
      if (f) f.cleanup()
      await failedRow(devTools)
      data(await f.user('agentRuns.setAllowed', { provider: 'comfyui', allowed: true }))
      const r = await f.agent('job.retry', { jobId: 'old', licenceConfirmed: true })
      expect(r).toMatchObject({ ok: false, error: { code: 'AGENT_DENIED' } })
      expect(f.jobs()).toHaveLength(1)
    }
  })
})

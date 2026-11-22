// P7-13 (spec/cancel.md "fal.ai Seedance", A-174): a video run that a paid provider whose
// cancel is may_finish has started (stage working) is not asked to stop: job.cancel refuses it
// with cancel_would_still_charge. A run still waiting is cancelled as before. Local providers,
// providers that stop, and every other kind are unchanged. Stand-in provider rows only.
import { describe, it, expect, afterEach } from 'vitest'
import { PAID, makeRunnerFixture, waitFor, type RunnerFixture } from './runner-fixture'
import { ProviderCancelled } from '@/main/providers/types'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import { AppError } from '@/shared/schemas/result'

const CHARGES: ProviderInfo = {
  ...PAID,
  id: 'charge-test',
  label: 'Charge Test',
  jobs: ['video'],
  cancel: 'may_finish',
}
const LOCAL_MAY_FINISH: ProviderInfo = { ...CHARGES, id: 'local-may-finish', local: true }

const fixtures: RunnerFixture[] = []
function fixture(): RunnerFixture {
  const f = makeRunnerFixture({ cancelWaitMs: 60 })
  f.providers.push(CHARGES, LOCAL_MAY_FINISH)
  fixtures.push(f)
  return f
}
afterEach(() => {
  while (fixtures.length) fixtures.pop()?.cleanup()
})

type Stage = 'waiting' | 'working'

// A run that has a remote ID and reports the stage, then waits for its signal.
async function running(
  x: RunnerFixture,
  stage: Stage,
  provider = CHARGES.id,
  kind: 'video_generation' | 'image_generation' = 'video_generation',
) {
  const fired = { signal: false }
  x.f.body = (jc) =>
    new Promise((_done, fail) => {
      if (kind === 'video_generation') jc.setRemoteJobId('r-1')
      jc.onProgress({ stage })
      jc.signal.addEventListener('abort', () => {
        fired.signal = true
        fail(new ProviderCancelled())
      })
    })
  const id = await x.start({ provider, kind })
  await waitFor(() => (x.row(id)?.result as { stage?: string } | null)?.stage === stage)
  return { id, fired }
}

describe('cancel_would_still_charge [P7-13, spec/cancel.md fal.ai Seedance]', () => {
  it('refuses to cancel a started paid video run; the run goes on and its signal is not fired', async () => {
    const x = fixture()
    const { id, fired } = await running(x, 'working')
    const error = await x.jobs.cancel(x.projectId, id).then(
      () => null,
      (e: unknown) => e,
    )
    expect(error).toBeInstanceOf(AppError)
    expect(error).toMatchObject({
      code: 'RULE_VIOLATION',
      message:
        'Charge Test has started this and will charge for it. The app lets it finish and keeps the result.',
      details: { reason: 'cancel_would_still_charge' },
    })
    expect(JSON.stringify(error)).not.toContain('r-1')
    await new Promise((r) => setTimeout(r, 80))
    expect(fired.signal).toBe(false)
    expect(x.row(id)).toMatchObject({ status: 'running' })
    expect(x.row(id)?.result).not.toMatchObject({ cancelAsked: true })
  })

  it('job.cancel through the bus gives the same refusal', async () => {
    const x = fixture()
    const { id } = await running(x, 'working')
    const r = await x.user('job.cancel', { projectId: x.projectId, jobId: id })
    expect(r).toMatchObject({
      ok: false,
      error: { details: { reason: 'cancel_would_still_charge' } },
    })
  })

  const ACCEPTED: [string, Stage, string, 'video_generation' | 'image_generation'][] = [
    ['a paid run still waiting in the queue', 'waiting', CHARGES.id, 'video_generation'],
    [
      'a started run of a local may_finish provider',
      'working',
      LOCAL_MAY_FINISH.id,
      'video_generation',
    ],
    ['a started run of a paid provider that stops', 'working', PAID.id, 'video_generation'],
    ['a started picture run of a may_finish provider', 'working', CHARGES.id, 'image_generation'],
  ]

  it.each(ACCEPTED)('cancels %s as before', async (_name, stage, provider, kind) => {
    const x = fixture()
    const { id, fired } = await running(x, stage, provider, kind)
    await x.jobs.cancel(x.projectId, id)
    await waitFor(() => x.row(id)?.status === 'cancelled')
    expect(fired.signal).toBe(true)
  })

  it('a queued run of a may_finish provider is cancelled at once', async () => {
    const x = fixture()
    x.f.body = () => new Promise(() => undefined)
    for (let i = 0; i < 3; i++) await x.start({ provider: CHARGES.id, kind: 'video_generation' })
    const queued = await x.start({ provider: CHARGES.id, kind: 'video_generation' })
    await x.jobs.cancel(x.projectId, queued)
    expect(x.row(queued)?.status).toBe('cancelled')
  })
})

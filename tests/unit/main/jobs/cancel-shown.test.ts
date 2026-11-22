// The run row shows Cancel exactly when job.cancel would accept it (spec/cancel.md "job.cancel"):
// cancelShown and cancelRefusal agree for every kind, status and provider cancel kind.
import { describe, expect, it } from 'vitest'
import { cancelRefusal } from '@/main/jobs/cancel'
import { cancelShown } from '@/renderer/ui/cancel-shown'
import { JOB_KINDS, JOB_STATUSES } from '@/shared/config/job-kinds'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import type { JobRow } from '@/shared/schemas/rows/job'

function provider(cancel: ProviderInfo['cancel']): ProviderInfo {
  return {
    id: 'p',
    label: 'Provider',
    jobs: ['image'],
    available: true,
    secrets: [],
    defaultModels: {},
    local: false,
    cancel,
    serverText: false,
  }
}

const PROVIDERS = [undefined, provider('none'), provider('stops'), provider('may_finish')]

const cases = JOB_KINDS.flatMap((kind) =>
  JOB_STATUSES.flatMap((status) => PROVIDERS.map((p) => [kind, status, p] as const)),
)

describe('cancelShown agrees with cancelRefusal [spec/cancel.md job.cancel]', () => {
  it.each(cases)('%s %s, provider cancel %o', (kind, status, p) => {
    const row = { kind, status, provider: 'p' } as JobRow
    expect(cancelShown(row, p)).toBe(cancelRefusal(row, p) === null)
  })
})

// P7-13: a run with a remote ID and a stage, on paid and local providers of every cancel kind.
const local = (cancel: ProviderInfo['cancel']): ProviderInfo => ({
  ...provider(cancel),
  local: true,
})
const STARTED_PROVIDERS = [...PROVIDERS, local('none'), local('stops'), local('may_finish')]
const STAGES = [null, { stage: 'waiting' }, { stage: 'working' }, ['working']]

const startedCases = JOB_KINDS.flatMap((kind) =>
  JOB_STATUSES.flatMap((status) =>
    STARTED_PROVIDERS.flatMap((p) => STAGES.map((result) => [kind, status, p, result] as const)),
  ),
)

describe('cancelShown agrees with cancelRefusal for started runs [P7-13 cancel_would_still_charge]', () => {
  it.each(startedCases)('%s %s, provider %o, result %o', (kind, status, p, result) => {
    const row = { kind, status, provider: 'p', remoteJobId: 'r-1', result } as JobRow
    expect(cancelShown(row, p)).toBe(cancelRefusal(row, p) === null)
  })

  it('hides Cancel for a started paid may_finish video run only', () => {
    const row = {
      kind: 'video_generation',
      status: 'running',
      provider: 'p',
      remoteJobId: 'r-1',
      result: { stage: 'working' },
    } as JobRow
    expect(cancelShown(row, provider('may_finish'))).toBe(false)
    expect(cancelShown(row, local('may_finish'))).toBe(true)
    expect(cancelShown({ ...row, result: { stage: 'waiting' } }, provider('may_finish'))).toBe(true)
    expect(cancelShown({ ...row, remoteJobId: null }, provider('may_finish'))).toBe(true)
  })
})

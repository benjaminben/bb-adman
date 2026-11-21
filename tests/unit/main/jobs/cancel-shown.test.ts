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

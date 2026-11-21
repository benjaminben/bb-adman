import { describe, it, expectTypeOf } from 'vitest'
import type { JobRunContext } from '../../../../src/main/jobs/types'
import type { RunProgress } from '../../../../src/main/providers/types'

// A type-only contract: the check is `npm run typecheck`.
describe('JobRunContext [SPEC 6.11.1, 14 CU-0]', () => {
  it('carries the job signal that cancel fires', () => {
    expectTypeOf<JobRunContext['signal']>().toEqualTypeOf<AbortSignal>()
  })
})

describe('JobRunContext, the 1.38 fields [SPEC 6.11.1 1.38, 14 1.38 Y2]', () => {
  it('takes what a provider reports through onProgress', () => {
    expectTypeOf<JobRunContext['onProgress']>().toEqualTypeOf<(p: RunProgress) => void>()
  })

  it('stores the provider own run ID through setRemoteJobId', () => {
    expectTypeOf<JobRunContext['setRemoteJobId']>().toEqualTypeOf<(id: string) => void>()
  })
})

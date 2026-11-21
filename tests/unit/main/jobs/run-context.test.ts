import { describe, it, expectTypeOf } from 'vitest'
import type { JobRunContext } from '../../../../src/main/jobs/types'

// A type-only contract: the check is `npm run typecheck`.
describe('JobRunContext [SPEC 6.11.1, 14 CU-0]', () => {
  it('carries the job signal that cancel fires', () => {
    expectTypeOf<JobRunContext['signal']>().toEqualTypeOf<AbortSignal>()
  })
})

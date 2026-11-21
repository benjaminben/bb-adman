import { describe, it, expectTypeOf } from 'vitest'
import type { EnqueueRequest } from '../../../../src/main/jobs/types'

// A type-only contract: the check is `npm run typecheck`.
describe('EnqueueRequest [SPEC 6.11.1, 14 CU-0 W3]', () => {
  it('says who started the run, user or agent, with no default', () => {
    expectTypeOf<EnqueueRequest['startedBy']>().toEqualTypeOf<'user' | 'agent'>()
    expectTypeOf<undefined>().not.toMatchTypeOf<EnqueueRequest['startedBy']>()
  })
})

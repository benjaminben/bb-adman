// P8-13 (spec/phases/phase-08.md "Interfaces with other phases", ExportChecks): ReportCheck is the
// shape of Phase 6's CheckResult. Checked at compile time, both ways.
import { describe, it, expectTypeOf } from 'vitest'
import type { CheckResult } from '@/shared/schemas/checks'
import type { ReportCheck } from '@/shared/schemas/report'

describe('ReportCheck and CheckResult [P8-13]', () => {
  it('are assignable both ways', () => {
    expectTypeOf<CheckResult>().toMatchTypeOf<ReportCheck>()
    expectTypeOf<ReportCheck>().toMatchTypeOf<CheckResult>()
  })
})

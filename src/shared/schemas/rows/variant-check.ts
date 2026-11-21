import { z } from 'zod'
import { CheckResult } from '@/shared/schemas/checks'

// SPEC 3.3 variant_check, in wire form (SPEC 4.4): the last check run of one variant.
export const VariantCheckRow = z.object({
  variantId: z.string(),
  checkedRev: z.number().int(),
  ranAt: z.string(),
  ranBy: z.enum(['user', 'agent', 'export']),
  results: z.array(CheckResult),
})
export type VariantCheckRow = z.infer<typeof VariantCheckRow>

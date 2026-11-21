// spec/export-and-checks.md "Checks", spec/phases/phase-06.md design addition 5: one check's
// result, as the engine gives it, variant_check stores it and check.run and check.results
// answer it. Shared, so the window can read it.
import { z } from 'zod'

// The six checks, in the topic file's order.
export const CHECK_IDS = [
  'required-assets',
  'text-colours',
  'prohibited-words',
  'required-words',
  'unapproved-translations',
  'text-overflow',
] as const
export const CheckId = z.enum(CHECK_IDS)
export type CheckId = z.infer<typeof CheckId>

export const CheckGroup = z.enum(['brand-legal', 'readiness'])
export type CheckGroup = z.infer<typeof CheckGroup>

export const CheckStatus = z.enum(['pass', 'warn', 'skipped'])
export type CheckStatus = z.infer<typeof CheckStatus>

// A skipped result's one finding has no layerId: it holds the reason.
export const CheckFinding = z.object({ layerId: z.string().optional(), message: z.string() })
export type CheckFinding = z.infer<typeof CheckFinding>

export const CheckResult = z.object({
  checkId: CheckId,
  group: CheckGroup,
  status: CheckStatus,
  findings: z.array(CheckFinding),
})
export type CheckResult = z.infer<typeof CheckResult>

import type { CheckFinding, CheckGroup, CheckId, CheckResult } from '@/shared/schemas/checks'
import type { LayerRow } from '@/shared/schemas/rows/layer'

// spec/export-and-checks.md "Checks": the result types come from the shared schema, so the
// engine, the stored row and the replies hold one shape.

export type { CheckFinding, CheckGroup, CheckId, CheckResult }

// spec/phases/phase-06.md, design addition 5.
export type CheckVariant = {
  format: 'image' | 'video'
  width: number
  height: number
  durationMs: number
  language: string
}

export type CheckInput = {
  variant: CheckVariant
  primaryLanguage: string
  layers: LayerRow[]
  ruleSet: {
    requiredAssetIds: string[]
    palette: string[]
    requiredWords: Record<string, string[]>
    prohibitedWords: Record<string, string[]>
  }
  assetNames: Record<string, string> // display names of the required assets
}

export function checked(
  checkId: CheckId,
  group: CheckGroup,
  findings: CheckFinding[],
): CheckResult {
  return { checkId, group, status: findings.length > 0 ? 'warn' : 'pass', findings }
}

export function skipped(checkId: CheckId, group: CheckGroup, reason: string): CheckResult {
  return { checkId, group, status: 'skipped', findings: [{ message: reason }] }
}

import type { LayerRow } from '@/shared/schemas/rows/layer'

// spec/export-and-checks.md "Checks". Declared here until P6-1's src/shared/schemas/checks.ts
// is merged; P6-3 replaces it with an import of the same shape.
export type CheckId =
  | 'required-assets'
  | 'text-colours'
  | 'prohibited-words'
  | 'required-words'
  | 'unapproved-translations'
  | 'text-overflow'
export type CheckGroup = 'brand-legal' | 'readiness'
export type CheckFinding = { layerId?: string; message: string }
export type CheckResult = {
  checkId: CheckId
  group: CheckGroup
  status: 'pass' | 'warn' | 'skipped'
  findings: CheckFinding[]
}

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

import { requiredAssetsCheck, textColoursCheck } from './brand-checks'
import { textOverflowCheck, unapprovedTranslationsCheck } from './readiness-checks'
import type { CheckInput, CheckResult } from './types'
import { prohibitedWordsCheck, requiredWordsCheck } from './word-checks'

// The six checks in the order of spec/export-and-checks.md "Checks".
const CHECKS = [
  requiredAssetsCheck,
  textColoursCheck,
  prohibitedWordsCheck,
  requiredWordsCheck,
  unapprovedTranslationsCheck,
  textOverflowCheck,
] as const

export function runAllChecks(input: CheckInput): CheckResult[] {
  return CHECKS.map((check) => check(input))
}

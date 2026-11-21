// A-158 (spec/phases/phase-06.md, design addition 2, "Chinese script"): Traditional Chinese for
// Taiwan, Hong Kong and Macao, Simplified otherwise. The region is found by code or English
// name in the region table; a bare code outside it counts too. The one copy of this rule.
import { REGION_LANGUAGES } from '@/shared/config/region-languages'

export type ChineseScript = 'traditional' | 'simplified'

const TRADITIONAL = new Set(['TW', 'HK', 'MO'])
const REGION_CODES = new Map(
  REGION_LANGUAGES.flatMap((row) =>
    [row.code, ...row.names].map((key) => [key.toLowerCase(), row.code] as const),
  ),
)

export function chineseScript(region: string): ChineseScript {
  const key = region.trim().toLowerCase()
  const code = REGION_CODES.get(key) ?? key.toUpperCase()
  return TRADITIONAL.has(code) ? 'traditional' : 'simplified'
}

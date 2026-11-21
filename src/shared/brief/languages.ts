// SPEC 6.1 language rules. Pure.
import type { IsRightToLeft, PrimaryLanguageFor } from '../templates/types'
import { REGION_LANGUAGES } from '../config/region-languages'

// SPEC 6.1 [FR-104]: the right-to-left languages this build refuses.
const RIGHT_TO_LEFT = new Set(['ar', 'he', 'fa', 'ur', 'yi', 'ps', 'sd', 'dv'])

// Reads the language part of a BCP-47 tag (before the first "-"), in any letter case.
// [1.26] An "_" also ends it, as in "ar_SA", which hand-written briefs use.
export const isRightToLeft: IsRightToLeft = (tag) => {
  const language = tag.trim().split(/[-_]/)[0] ?? ''
  return RIGHT_TO_LEFT.has(language.toLowerCase())
}

// SPEC 6.1: a region found by ISO code or country name, in any letter case. Null when the
// region is not in the table; the language field is then empty and required.
const BY_REGION = new Map(
  REGION_LANGUAGES.flatMap((row) =>
    [row.code, ...row.names].map((key) => [key.toLowerCase(), row.language] as const),
  ),
)

export const primaryLanguageFor: PrimaryLanguageFor = (region) =>
  BY_REGION.get(region.trim().toLowerCase()) ?? null

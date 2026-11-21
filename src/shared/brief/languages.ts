// SPEC 6.1 language rules. Pure.
import type { IsRightToLeft } from '../templates/types'

// SPEC 6.1 [FR-104]: the right-to-left languages this build refuses.
const RIGHT_TO_LEFT = new Set(['ar', 'he', 'fa', 'ur', 'yi', 'ps', 'sd', 'dv'])

// Reads the language part of a BCP-47 tag (before the first "-"), in any letter case.
export const isRightToLeft: IsRightToLeft = (tag) => {
  const language = tag.trim().split('-')[0] ?? ''
  return RIGHT_TO_LEFT.has(language.toLowerCase())
}

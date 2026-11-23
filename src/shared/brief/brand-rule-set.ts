// spec/brief-brand.md "The rules" [A-397]: what a brief's brand does to the rule set a new
// campaign starts with. Pure; the input is not changed and the result shares nothing with it.
import type { RuleSetValues } from '@/shared/schemas/commands/campaign'

const copyWords = (words: Record<string, string[]>): Record<string, string[]> =>
  Object.fromEntries(Object.entries(words).map(([language, list]) => [language, [...list]]))

// The palette becomes the brand colours when there are any. The logo goes to the front of
// the required files, moved there when it is already listed, so it fills the logo slot.
export function brandRuleSet(
  values: RuleSetValues,
  colours: string[] | undefined,
  logoAssetId: string | undefined,
): RuleSetValues {
  const others = values.requiredAssetIds.filter((id) => id !== logoAssetId)
  return {
    requiredAssetIds: logoAssetId === undefined ? others : [logoAssetId, ...others],
    palette: colours !== undefined && colours.length > 0 ? [...colours] : [...values.palette],
    requiredWords: copyWords(values.requiredWords),
    prohibitedWords: copyWords(values.prohibitedWords),
  }
}

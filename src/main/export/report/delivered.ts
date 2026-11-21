// Asked for against delivered (spec/phases/phase-08.md "Report", FR-232, A-205): each pair of
// the campaign's size labels and languages that no exported ad delivers, and why. Pure.
import type { Report } from '@/shared/schemas/report'

export type DeliveredInput = {
  sizeLabels: string[]
  languages: string[]
  // Every ad of the campaign, any direction, any format.
  variants: Array<{ variantId: string; sizeLabel: string; language: string }>
  // The ads chosen for this export, and those of them that have a file.
  chosen: string[]
  withFile: string[]
}

export function missingPairs(input: DeliveredInput): Report['missing'] {
  const chosen = new Set(input.chosen)
  const withFile = new Set(input.withFile)
  const missing: Report['missing'] = []
  for (const sizeLabel of input.sizeLabels) {
    for (const language of input.languages) {
      const ids = input.variants
        .filter((v) => v.sizeLabel === sizeLabel && v.language === language)
        .map((v) => v.variantId)
      if (ids.some((id) => withFile.has(id))) continue
      const reason =
        ids.length === 0
          ? 'no_variant'
          : ids.some((id) => chosen.has(id))
            ? 'export_failed'
            : 'not_in_export'
      missing.push({ sizeLabel, language, reason })
    }
  }
  return missing
}

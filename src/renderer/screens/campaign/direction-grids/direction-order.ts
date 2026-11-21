// spec/screens-variants.md, "The overview" (A-144): the grid order inside one direction. The
// master first, then the campaign's sizes order, then its languages order, then image before
// video, then createdAt. A size or language the campaign does not list goes after the listed ones.
import type { CampaignRow } from '@/shared/schemas/rows/campaign'
import type { VariantSummary } from '@/shared/schemas/queries/campaign'

type Lists = Pick<CampaignRow, 'sizes' | 'languages'>

function place(list: string[], value: string): number {
  const i = list.indexOf(value)
  return i === -1 ? list.length : i
}

export function directionOrder(
  variants: VariantSummary[],
  campaign: Lists,
  masterVariantId: string,
): VariantSummary[] {
  const sizes = campaign.sizes.map((s) => s.label)
  const rules: ((v: VariantSummary) => number)[] = [
    (v) => (v.id === masterVariantId ? 0 : 1),
    (v) => place(sizes, v.sizeLabel),
    (v) => place(campaign.languages, v.language),
    (v) => (v.format === 'image' ? 0 : 1),
  ]
  return [...variants].sort((a, b) => {
    for (const rule of rules) {
      const step = rule(a) - rule(b)
      if (step !== 0) return step
    }
    return a.createdAt.localeCompare(b.createdAt)
  })
}

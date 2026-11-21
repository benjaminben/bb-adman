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
  const key = (v: VariantSummary) => [
    v.id === masterVariantId ? 0 : 1,
    place(sizes, v.sizeLabel),
    place(campaign.languages, v.language),
    v.format === 'image' ? 0 : 1,
  ]
  return [...variants].sort((a, b) => {
    const ka = key(a)
    const kb = key(b)
    const differs = ka.findIndex((n, i) => n !== kb[i])
    if (differs !== -1) return ka[differs] - kb[differs]
    return a.createdAt.localeCompare(b.createdAt)
  })
}

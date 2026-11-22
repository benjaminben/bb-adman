// spec/screens-variants.md, "Fan-out"; spec/links-and-sync.md, "Fan-out": what the dialog
// sends and counts. The master's size and language are always in. A pair the direction already
// has as an image is not made again (Phase 5 sends images only, A-133). A fit is sent for each
// listed size whose pixel size differs from the master's, and for no other; with no background
// picture on the master each is `scale`. Pure.
import type { CampaignSize } from '@/shared/schemas/commands/campaign'
import type { FanOutFit } from '@/shared/schemas/links'
import type { VariantRow } from '@/shared/schemas/rows/variant'

export type FanOutBasis = {
  sizes: CampaignSize[]
  languages: string[]
  master: Pick<VariantRow, 'sizeLabel' | 'language' | 'width' | 'height'>
  existing: Array<Pick<VariantRow, 'sizeLabel' | 'language' | 'format'>>
}

export type FanOutTicks = { sizes: string[]; languages: string[] }

export type FanOutPair = { sizeLabel: string; language: string }

export function startTicks(basis: FanOutBasis): FanOutTicks {
  return { sizes: [basis.master.sizeLabel], languages: [basis.master.language] }
}

// The lists to send, in the campaign's order: the ticked labels and tags plus the master's,
// each only when the campaign lists it.
export function fanOutLists(basis: FanOutBasis, ticks: FanOutTicks): FanOutTicks {
  const sizes = new Set([basis.master.sizeLabel, ...ticks.sizes])
  const languages = new Set([basis.master.language, ...ticks.languages])
  return {
    sizes: basis.sizes.filter((s) => sizes.has(s.label)).map((s) => s.label),
    languages: basis.languages.filter((l) => languages.has(l)),
  }
}

// The pairs the call would make: an empty list when there is no size or no language to send.
export function newPairs(basis: FanOutBasis, ticks: FanOutTicks): FanOutPair[] {
  const lists = fanOutLists(basis, ticks)
  if (lists.sizes.length === 0 || lists.languages.length === 0) return []
  const sizes = [...new Set([basis.master.sizeLabel, ...lists.sizes])]
  const languages = [...new Set([basis.master.language, ...lists.languages])]
  const has = (p: FanOutPair) =>
    basis.existing.some(
      (v) => v.format === 'image' && v.sizeLabel === p.sizeLabel && v.language === p.language,
    )
  const pairs = sizes.flatMap((sizeLabel) => languages.map((language) => ({ sizeLabel, language })))
  return pairs.filter((p) => !has(p))
}

export function fitSizes(basis: FanOutBasis, ticks: FanOutTicks): CampaignSize[] {
  const listed = new Set(fanOutLists(basis, ticks).sizes)
  const { width, height } = basis.master
  return basis.sizes.filter(
    (s) => listed.has(s.label) && (s.width !== width || s.height !== height),
  )
}

export function fitsToSend(
  basis: FanOutBasis,
  ticks: FanOutTicks,
  chosen: Readonly<Record<string, FanOutFit>>,
  hasPicture: boolean,
): Record<string, FanOutFit> {
  const fits: Record<string, FanOutFit> = {}
  for (const size of fitSizes(basis, ticks)) {
    fits[size.label] = hasPicture ? (chosen[size.label] ?? 'scale') : 'scale'
  }
  return fits
}

export function fillCount(fits: Readonly<Record<string, FanOutFit>>): number {
  return Object.values(fits).filter((f) => f === 'fill').length
}

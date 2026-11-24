// spec/screens-variants.md, "Make variants"; spec/links-and-sync.md, "Fan-out": what the dialog
// sends and counts. `master` holds the source's facts: the master, or in the source mode (MV-6)
// the tile's variant; below, "the master" means that source. Its size and language are always in. A size, language and format
// the direction already has is not made again (step 7: image and video). A fit is sent for each
// listed size whose pixel size differs from the master's, and for no other; with no background
// picture on the master each is `scale`. The count of text calls (P6-15). Pure.
import type { CampaignSize } from '@/shared/schemas/commands/campaign'
import type { FanOutFit } from '@/shared/schemas/links'
import type { VariantRow } from '@/shared/schemas/rows/variant'

export type FanOutBasis = {
  sizes: CampaignSize[]
  languages: string[]
  // The campaign's main language: no translation is counted for it (MV-6).
  primaryLanguage: string
  master: Pick<VariantRow, 'sizeLabel' | 'language' | 'width' | 'height'> &
    Partial<Pick<VariantRow, 'format'>>
  existing: Array<Pick<VariantRow, 'sizeLabel' | 'language' | 'format'>>
}

export type FanOutTicks = { sizes: string[]; languages: string[] }

export type FanOutPair = { sizeLabel: string; language: string }

export type FanOutFormat = 'image' | 'video'

export type FanOutCell = FanOutPair & { format: FanOutFormat }

const FORMATS: FanOutFormat[] = ['image', 'video']

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

export function formatsToSend(ticked: readonly string[]): FanOutFormat[] {
  return FORMATS.filter((f) => ticked.includes(f))
}

// Every size, language and ticked format the call covers, as variant.fanOut builds its grid.
// Empty with no size, language or format.
function gridCells(
  basis: FanOutBasis,
  ticks: FanOutTicks,
  formats: readonly FanOutFormat[],
): FanOutCell[] {
  const lists = fanOutLists(basis, ticks)
  if (lists.sizes.length === 0 || lists.languages.length === 0) return []
  const sizes = [...new Set([basis.master.sizeLabel, ...lists.sizes])]
  const languages = [...new Set([basis.master.language, ...lists.languages])]
  return sizes.flatMap((sizeLabel) =>
    languages.flatMap((language) =>
      formatsToSend(formats).map((format) => ({ sizeLabel, language, format })),
    ),
  )
}

// The variants the call would make, as variant.fanOut counts them: each cell of the grid the
// direction does not have yet.
export function newCells(
  basis: FanOutBasis,
  ticks: FanOutTicks,
  formats: readonly FanOutFormat[],
): FanOutCell[] {
  return gridCells(basis, ticks, formats).filter((c) => !exists(basis, c))
}

const exists = (basis: FanOutBasis, c: FanOutCell) =>
  basis.existing.some(
    (v) => v.format === c.format && v.sizeLabel === c.sizeLabel && v.language === c.language,
  )

// MV-6: the chosen cells the direction already has, which are not made again; the source's own
// cell (its size, language and format, image when not given) is left out.
export function existingCount(
  basis: FanOutBasis,
  ticks: FanOutTicks,
  formats: readonly FanOutFormat[],
): number {
  const { sizeLabel, language, format = 'image' } = basis.master
  const own = (c: FanOutCell) =>
    c.sizeLabel === sizeLabel && c.language === language && c.format === format
  return gridCells(basis, ticks, formats).filter((c) => !own(c) && exists(basis, c)).length
}

// The image pairs the call would make.
export function newPairs(basis: FanOutBasis, ticks: FanOutTicks): FanOutPair[] {
  return newCells(basis, ticks, ['image']).map(({ sizeLabel, language }) => ({
    sizeLabel,
    language,
  }))
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

// DLG-4b: the fills variant.fanOut asks for, exactly: a size on fill whose first new variant in
// the master's language is made by this call (one fill per size, never for another language).
export function fillsSent(
  basis: FanOutBasis,
  ticks: FanOutTicks,
  fits: Readonly<Record<string, FanOutFit>>,
  formats: readonly FanOutFormat[],
): number {
  const cells = newCells(basis, ticks, formats).filter((c) => c.language === basis.master.language)
  const sizes = new Set(cells.map((c) => c.sizeLabel))
  return Object.entries(fits).filter(([label, fit]) => fit === 'fill' && sizes.has(label)).length
}

// P6-15, MV-6: the fan-out starts at most one translation job per new language other than the
// campaign's main language and the source's language, whatever the formats. So the count may
// overstate the paid requests (brief copy or no key starts none) but never understates them.
export function translationCount(
  basis: FanOutBasis,
  ticks: FanOutTicks,
  formats: readonly FanOutFormat[] = ['image'],
): number {
  const languages = newCells(basis, ticks, formats).map((c) => c.language)
  const skip = [basis.primaryLanguage, basis.master.language]
  return new Set(languages.filter((l) => !skip.includes(l))).size
}

// The fills to start after the reply: never more than the cost line showed at the click, so a
// direction that changed in between cannot start a paid fill the user did not see.
export function fillsToStart<T>(fill: readonly T[], shown: number): T[] {
  return fill.slice(0, Math.max(0, shown))
}

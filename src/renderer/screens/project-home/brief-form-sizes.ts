// The brief form's sizes (spec/screens-campaign.md, "The brief form"): ready-made labels
// ticked, other sizes typed, and the master's label. Pure.
import type { CampaignSize } from '@/shared/schemas/commands/campaign'
import { parseSize } from '@/shared/brief/size'
import { READY_MADE_SIZES } from '@/shared/config/defaults'

export type SizeChoice = { readyMade: string[]; other: string; master: string | null }

const isReadyMade = (label: string) => READY_MADE_SIZES.some((s) => s.label === label)

// Each brief size read with parseSize: a ready-made one is ticked, any other goes into
// "other" as {width}x{height}, and text that cannot be read goes there as typed. No size:
// the ready-made sizes picked by default. The master is the first size.
export function sizesFromDraft(texts: string[]): SizeChoice {
  if (texts.length === 0) {
    const readyMade = READY_MADE_SIZES.filter((s) => s.selectedByDefault).map((s) => s.label)
    return { readyMade, other: '', master: readyMade[0] ?? null }
  }
  const readyMade: string[] = []
  const other: string[] = []
  let master: string | null = null
  for (const text of texts) {
    const size = parseSize(text)
    if (size && isReadyMade(size.label)) readyMade.push(size.label)
    else other.push(size ? `${size.width}x${size.height}` : text)
    if (size && master === null) master = size.label
  }
  return { readyMade, other: other.join(', '), master }
}

function readSizes(sizes: SizeChoice) {
  const typed = sizes.other
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t !== '')
  const found = [...sizes.readyMade, ...typed].map((text) => ({ text, size: parseSize(text) }))
  return {
    read: found.flatMap((f) => (f.size ? [f.size] : [])),
    unread: found.filter((f) => f.size === null).map((f) => f.text),
  }
}

// The chosen sizes that can be read, in the order chosen: the "Master size" choices.
export const sizesInOrder = (sizes: SizeChoice): CampaignSize[] => readSizes(sizes).read

// The master's label: the one chosen while it is still a chosen size, else the first size.
export function masterOf(sizes: SizeChoice): string | null {
  const read = sizesInOrder(sizes)
  return (read.find((s) => s.label === sizes.master) ?? read[0])?.label ?? null
}

// The chosen sizes in order, the master first, and the typed texts that cannot be read.
export function chosenSizes(sizes: SizeChoice): { sizes: CampaignSize[]; unread: string[] } {
  const { read, unread } = readSizes(sizes)
  const master = read.findIndex((s) => s.label === sizes.master)
  if (master > 0) read.unshift(...read.splice(master, 1))
  return { sizes: read, unread }
}

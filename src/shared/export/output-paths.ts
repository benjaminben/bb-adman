// The export's file names (spec/export-and-checks.md "Output layout", spec/phases/phase-08.md
// "Output layout additions"), relative to the output folder:
//   {campaignId}/{postTitle}/{sizeLabel}/{language}-{variantId}.{ext}
//   {campaignId}/report-{YYYYMMDD-HHmmss}.html and .json (reportNames gives the file names)
// Every part comes from the project file, which may come from anyone (review-leftovers LP-3), so
// each is checked against a strict pattern; a bad one throws "Storage path refused", no path.
import { CampaignId, VariantKey } from '@/shared/approvals/contract'
import { postTitle } from './safe-title'

// The same words as REFUSED_PATH in src/main/providers/storage-paths.ts, which src/shared may
// not import; output-paths.test.ts keeps the two equal.
const REFUSED_PATH = 'Storage path refused'

function refuse(): never {
  throw new Error(REFUSED_PATH)
}

// The campaign size rule (src/shared/schemas/commands/campaign.ts) and a BCP-47 tag of
// letters, digits and '-': nothing that could name a folder or leave one.
const SIZE_LABEL = /^[1-9][0-9]*x[1-9][0-9]*$/
const LANGUAGE = /^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$/
const EXTENSIONS = new Set(['png', 'jpg', 'mp4'])
const STAMP = /^[0-9]{8}-[0-9]{6}$/
const MAX_REPORT_TRY = 99

export type AdFile = {
  campaignId: string
  title: string
  sizeLabel: string
  language: string
  variantId: string
  ext: 'png' | 'jpg' | 'mp4'
}

export function adPath(ad: AdFile): string {
  if (!CampaignId.safeParse(ad.campaignId).success) refuse()
  if (!VariantKey.safeParse(ad.variantId).success) refuse()
  if (!SIZE_LABEL.test(ad.sizeLabel) || !LANGUAGE.test(ad.language)) refuse()
  if (!EXTENSIONS.has(ad.ext)) refuse()
  const file = `${ad.language}-${ad.variantId}.${ad.ext}`
  return `${ad.campaignId}/${postTitle(ad.title)}/${ad.sizeLabel}/${file}`
}

const two = (n: number) => String(n).padStart(2, '0')

// The export's local time.
export function reportStamp(date: Date): string {
  const day = `${date.getFullYear()}${two(date.getMonth() + 1)}${two(date.getDate())}`
  return `${day}-${two(date.getHours())}${two(date.getMinutes())}${two(date.getSeconds())}`
}

// A-193: a report never replaces a file. Try n = 1 first, then 2 to 99 (`-2` ... `-99`) while
// either name is taken; null past 99, and the report fails.
export function reportNames(stamp: string, n: number): { html: string; json: string } | null {
  if (!STAMP.test(stamp)) refuse()
  if (!Number.isInteger(n) || n < 1 || n > MAX_REPORT_TRY) return null
  const base = n === 1 ? `report-${stamp}` : `report-${stamp}-${n}`
  return { html: `${base}.html`, json: `${base}.json` }
}

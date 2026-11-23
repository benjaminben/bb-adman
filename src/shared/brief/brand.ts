// spec/brief-brand.md "The rules" and "Shared helpers" [A-400]: the brand values of a brief
// draft, cleaned. Pure; never throws; reads no file. The app's form, campaign.create's agent
// path and the command-line quickstart all clean a brief here, so they agree.
import { starterLayoutOf } from '@/shared/config/starter-layouts'
import { ADS_PER, type BriefDraft } from '@/shared/schemas/brief'
import type { BrandRole } from '@/shared/schemas/commands/brief'

export type AdsPer = (typeof ADS_PER)[number]

// text: the raw value. A caller that shows it cleans it first (cleanLineText).
export type BrandValueNote = {
  field: 'colours' | 'layout' | 'adsPer'
  text: string
  reason: 'not_a_colour' | 'unknown_layout' | 'unknown_ads_per'
}

export type BriefLook = {
  colours: string[]
  layoutId: string | null
  artDirection: string | null
  adsPer: AdsPer
  notes: BrandValueNote[]
}

const SIX = /^#[0-9A-Fa-f]{6}$/
const THREE = /^#[0-9A-Fa-f]{3}$/

// "#RRGGBB" in upper case, a "#RGB" widened; null for any other text.
function hexOf(text: string): string | null {
  if (SIX.test(text)) return text.toUpperCase()
  if (!THREE.test(text)) return null
  const [r, g, b] = text.slice(1).toUpperCase()
  return `#${r}${r}${g}${g}${b}${b}`
}

// Each text trimmed; kept in upper case, each once, in brief order. A blank text is skipped
// with no note; any other bad text gets one. One text is read as a list of one.
export function brandColours(raw: string | string[] | undefined): {
  colours: string[]
  notes: BrandValueNote[]
} {
  const texts = raw === undefined ? [] : typeof raw === 'string' ? [raw] : raw
  const colours: string[] = []
  const notes: BrandValueNote[] = []
  for (const text of texts) {
    const trimmed = text.trim()
    if (trimmed === '') continue
    const hex = hexOf(trimmed)
    if (hex === null) notes.push({ field: 'colours', text, reason: 'not_a_colour' })
    else if (!colours.includes(hex)) colours.push(hex)
  }
  return { colours, notes }
}

// Trimmed and lower-cased, a starter layout ID. A blank or missing value is none with no
// note; any other text is none with a note, and the default layout is used.
export function briefLayoutId(raw: string | undefined): {
  layoutId: string | null
  notes: BrandValueNote[]
} {
  const id = (raw ?? '').trim().toLowerCase()
  if (id === '') return { layoutId: null, notes: [] }
  const layout = starterLayoutOf(id)
  if (layout !== null) return { layoutId: layout.id, notes: [] }
  return { layoutId: null, notes: [{ field: 'layout', text: raw ?? '', reason: 'unknown_layout' }] }
}

// Trimmed and lower-cased: campaign or subject. A blank or missing value is campaign with no
// note; any other text is campaign with a note.
export function adsPerOf(raw: string | undefined): { adsPer: AdsPer; notes: BrandValueNote[] } {
  const value = (raw ?? '').trim().toLowerCase()
  if (value === '') return { adsPer: 'campaign', notes: [] }
  const known = ADS_PER.find((a) => a === value)
  if (known !== undefined) return { adsPer: known, notes: [] }
  return {
    adsPer: 'campaign',
    notes: [{ field: 'adsPer', text: raw ?? '', reason: 'unknown_ads_per' }],
  }
}

// Trimmed; blank counts as none. No length limit.
export function artDirectionOf(raw: string | undefined): string | null {
  const text = (raw ?? '').trim()
  return text === '' ? null : text
}

// The four cleaned values; notes in the order colours, layout, adsPer.
export function briefLook(draft: BriefDraft): BriefLook {
  const colours = brandColours(draft.brand?.colours)
  const layout = briefLayoutId(draft.layout)
  const adsPer = adsPerOf(draft.adsPer)
  return {
    colours: colours.colours,
    layoutId: layout.layoutId,
    artDirection: artDirectionOf(draft.artDirection),
    adsPer: adsPer.adsPer,
    notes: [...colours.notes, ...layout.notes, ...adsPer.notes],
  }
}

// The logo and font texts as given, in role order; an absent one is left out. brief.parse
// checks each one (src/main/assets/brief-brand.ts).
export function brandFileTexts(draft: BriefDraft): Array<{ role: BrandRole; text: string }> {
  const brand = draft.brand
  const texts: Array<{ role: BrandRole; text: string | undefined }> = [
    { role: 'logo', text: brand?.logo },
    { role: 'headingFont', text: brand?.fonts?.heading },
    { role: 'bodyFont', text: brand?.fonts?.body },
  ]
  return texts.flatMap(({ role, text }) => (text === undefined ? [] : [{ role, text }]))
}

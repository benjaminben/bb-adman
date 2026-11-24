// From a brief's text to the quickstart's plan: the confirmed brief, the languages and sizes,
// each subject's photo names, the brand and layout, and which AI calls the run will make.
// Pure: reads no file.
import { brandFileTexts, briefLook, type BriefLook } from '@/shared/brief/brand'
import { parseBrief } from '@/shared/brief/parse'
import { primaryLanguageOf } from '@/shared/brief/primary-language'
import { parseSize } from '@/shared/brief/size'
import { DEFAULT_STARTER_LAYOUT, type StarterLayout } from '@/shared/config/default-layout'
import { starterLayoutOf } from '@/shared/config/starter-layouts'
import { Brief, type BriefDraft } from '@/shared/schemas/brief'
import type { BrandRole } from '@/shared/schemas/commands/brief'
import type { CampaignSize } from '@/shared/schemas/commands/campaign'
import { briefCopyFor } from '@/shared/translation/brief-copy'

export type PlanSubject = { name: string; description: string | null; pictures: string[] }

export type Plan = {
  brief: Brief
  // The first language is the main one; the first size is the one the picture is made at.
  languages: string[]
  sizes: CampaignSize[]
  subjects: PlanSubject[]
  // The brief's colours, layout ID, art direction and ad sets, cleaned, with a note for each
  // value that cannot be used.
  look: BriefLook
  // The layout the master is built from: the brief's, or the default.
  layout: StarterLayout
  // The logo and font texts as the brief gives them, in role order.
  brandFiles: Array<{ role: BrandRole; text: string }>
  // The languages the brief gives no full copy for: one translate call each.
  translate: string[]
  // The sizes whose pixels differ from the first size: one extend call each. None for a
  // flat-colour layout, whose picture sits in the subject spot.
  fills: CampaignSize[]
}

export type PlanResult = { ok: true; plan: Plan } | { ok: false; message: string }

const DEFAULT_SIZE = '1x1'
const FALLBACK_LANGUAGE = 'en'

const fail = (message: string): PlanResult => ({ ok: false, message })

function unique<T>(items: T[], keyOf: (item: T) => string): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = keyOf(item)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function languagesOf(draft: BriefDraft): string[] {
  const primary = primaryLanguageOf(draft) ?? FALLBACK_LANGUAGE
  const listed = (draft.languages ?? []).map((tag) => tag.trim()).filter((tag) => tag !== '')
  return unique([primary, ...listed], (tag) => tag)
}

function sizesOf(draft: BriefDraft): CampaignSize[] | string {
  const texts = draft.sizes && draft.sizes.length > 0 ? draft.sizes : [DEFAULT_SIZE]
  const sizes: CampaignSize[] = []
  for (const text of texts) {
    const size = parseSize(text)
    if (!size) return `The size "${text}" was not understood. Write it like 1:1 or 1080x1350.`
    sizes.push(size)
  }
  return unique(sizes, (size) => size.label)
}

function subjectsOf(draft: BriefDraft): PlanSubject[] {
  return (draft.subjects ?? [])
    .filter((subject) => (subject.name ?? '').trim() !== '')
    .map((subject) => {
      const pictures = subject.pictures ?? []
      return {
        name: (subject.name ?? '').trim(),
        description: subject.description?.trim() || null,
        pictures: (typeof pictures === 'string' ? [pictures] : pictures).filter((p) => p !== ''),
      }
    })
}

// The copy slots the ads hold: the headline always, the call to action when the brief has one.
export function copySlots(brief: Brief): string[] {
  const hasAction = (brief.callToAction ?? '').trim() !== ''
  return hasAction ? ['headline', 'call-to-action'] : ['headline']
}

function needsTranslation(brief: Brief, language: string): boolean {
  return copySlots(brief).some((slot) => briefCopyFor(brief, language, slot) === null)
}

// A layout with a fill colour has a flat background; the others take the picture there.
export const isFlatLayout = (layout: StarterLayout) => layout.background.fillColor !== null

const samePixels = (a: CampaignSize, b: CampaignSize) =>
  a.width === b.width && a.height === b.height

export function readPlan(text: string, syntax: 'yaml' | 'json'): PlanResult {
  const parsed = parseBrief(text, syntax)
  if (!parsed.ok) return fail(parsed.error.message)
  const draft = parsed.data
  // The confirmed brief keeps the brand values cleaned, as the app stores them; a value that
  // cannot be used is left out with a note and never refuses the brief.
  const look = briefLook(draft)
  const brief = Brief.safeParse({
    ...draft,
    brand: look.colours.length > 0 ? { colours: look.colours } : undefined,
    layout: look.layoutId ?? undefined,
    artDirection: look.artDirection ?? undefined,
    adsPer: look.adsPer,
  })
  if (!brief.success) {
    return fail(
      'The brief needs campaignName, region, audience, message and at least one subject with a name.',
    )
  }
  const sizes = sizesOf(draft)
  if (typeof sizes === 'string') return fail(sizes)
  const languages = languagesOf(draft)
  const [first] = sizes
  const [primary] = languages
  if (!first || !primary) return fail('The brief needs at least one size and one language.')
  const layout = (look.layoutId && starterLayoutOf(look.layoutId)) || DEFAULT_STARTER_LAYOUT
  const flat = isFlatLayout(layout)
  return {
    ok: true,
    plan: {
      brief: brief.data,
      languages,
      sizes,
      subjects: subjectsOf(draft),
      look,
      layout,
      brandFiles: brandFileTexts(draft),
      translate: languages.filter((l) => l !== primary && needsTranslation(brief.data, l)),
      fills: flat ? [] : sizes.filter((size) => !samePixels(size, first)),
    },
  }
}

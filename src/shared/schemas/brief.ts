import { z } from 'zod'
import { HEX_COLOUR } from '@/shared/schemas/layer'

// SPEC 6.1 brief schema, the single owner. Frozen contract (SPEC 14, Phase 2 step 0).
// BriefDraft: what a file gives; every field optional, a field of the wrong type dropped.
// Brief: a confirmed brief; four required texts and at least one subject.
// spec/brief-brand.md: brand, layout, artDirection and adsPer.

const words = z.union([z.array(z.string()), z.record(z.string(), z.array(z.string()))])
const copyEntry = z.object({
  headline: z.string().optional(),
  callToAction: z.string().optional(),
})
const copy = z.record(z.string(), copyEntry)

// Drops a value of the wrong type instead of refusing the whole draft.
const loose = <T extends z.ZodType>(schema: T) => schema.optional().catch(undefined)

const draftSubject = z.object({
  id: loose(z.string()),
  name: loose(z.string()),
  description: loose(z.string()),
  // spec/subject-photos.md [D-098]: raw paths from the file, checked by brief.parse only.
  pictures: loose(z.union([z.string(), z.array(z.string())])),
})

// spec/brief-brand.md: raw texts from the file. logo and the two fonts are each an asset ID, an
// absolute path or a path relative to the brief, checked by brief.parse only, as pictures are.
const draftBrand = z.object({
  logo: loose(z.string()),
  colours: loose(z.union([z.string(), z.array(z.string())])),
  fonts: loose(z.object({ heading: loose(z.string()), body: loose(z.string()) })),
})

export const BriefDraft = z.object({
  campaignName: loose(z.string()),
  region: loose(z.string()),
  audience: loose(z.string()),
  message: loose(z.string()),
  subjects: loose(z.array(draftSubject)),
  offer: loose(z.string()),
  callToAction: loose(z.string()),
  tone: loose(z.string()),
  requiredWords: loose(words),
  prohibitedWords: loose(words),
  languages: loose(z.array(z.string())),
  sizes: loose(z.array(z.string())),
  copy: loose(copy),
  brand: loose(draftBrand),
  layout: loose(z.string()),
  artDirection: loose(z.string()),
  adsPer: loose(z.string()),
})
export type BriefDraft = z.infer<typeof BriefDraft>

const filled = z.string().trim().min(1)

// No pictures: Zod drops the key, so no photo path reaches a stored brief [D-098].
export const BriefSubject = z.object({
  id: z.string().optional(),
  name: filled,
  description: z.string().optional(),
})

// spec/brief-brand.md: "campaign" (the default) makes one set of ads for all subjects together;
// "subject" makes one direction per subject.
export const ADS_PER = ['campaign', 'subject'] as const

// Only the colours are kept. The logo and the fonts become assets of the project, so no path
// reaches a stored brief.
const BriefBrand = z.object({ colours: z.array(z.string().regex(HEX_COLOUR)).optional() })

export const Brief = z.object({
  campaignName: filled,
  region: filled,
  audience: filled,
  message: filled,
  subjects: z.array(BriefSubject).min(1),
  offer: z.string().optional(),
  callToAction: z.string().optional(),
  tone: z.string().optional(),
  requiredWords: words.optional(),
  prohibitedWords: words.optional(),
  languages: z.array(z.string()).optional(),
  sizes: z.array(z.string()).optional(),
  copy: copy.optional(),
  // A starter layout ID. Any text is read back, so a stored brief stays readable if a layout
  // leaves the build; campaign.create refuses an ID the build does not have.
  layout: z.string().optional(),
  artDirection: z.string().optional(),
  adsPer: z.enum(ADS_PER).optional(),
  brand: BriefBrand.optional(),
})
export type Brief = z.infer<typeof Brief>

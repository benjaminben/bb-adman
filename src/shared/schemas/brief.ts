import { z } from 'zod'

// SPEC 6.1 brief schema, the single owner. Frozen contract (SPEC 14, Phase 2 step 0).
// BriefDraft: what a file gives; every field optional, a field of the wrong type dropped.
// Brief: a confirmed brief; four required texts and at least one subject.

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
})
export type BriefDraft = z.infer<typeof BriefDraft>

const filled = z.string().trim().min(1)

export const BriefSubject = z.object({
  id: z.string().optional(),
  name: filled,
  description: z.string().optional(),
})

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
})
export type Brief = z.infer<typeof Brief>

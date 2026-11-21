import { z } from 'zod'
import { Brief } from '@/shared/schemas/brief'
import { HEX_COLOUR } from '@/shared/schemas/layer'
import { projectScoped } from './project-scoped'
import { MAX_SIZE_SIDE, MIN_SIZE_SIDE } from '@/shared/config/size-limits'

// SPEC 3.3 CampaignSize and SPEC 6.1 campaign.create inputs. Frozen contract
// (SPEC 14, Phase 2 step 0). Slice C adds its other campaign schemas beside this file.

// A file-safe label: "1x1", "9x16", "16x9", "4x5" or "{width}x{height}". [1.26] Each side is
// from MIN_SIZE_SIDE (50) to MAX_SIZE_SIDE (8,192) pixels, both included.
export const CampaignSize = z.object({
  label: z.string().regex(/^[1-9]\d*x[1-9]\d*$/),
  width: z.number().int().min(MIN_SIZE_SIDE).max(MAX_SIZE_SIDE),
  height: z.number().int().min(MIN_SIZE_SIDE).max(MAX_SIZE_SIDE),
})
export type CampaignSize = z.infer<typeof CampaignSize>

export const WordsByLanguage = z.record(z.string(), z.array(z.string()))

// The four lists of the rule_set table (SPEC 3.3).
export const RuleSetValues = z.object({
  requiredAssetIds: z.array(z.string()),
  palette: z.array(z.string().regex(HEX_COLOUR)),
  requiredWords: WordsByLanguage,
  prohibitedWords: WordsByLanguage,
})
export type RuleSetValues = z.infer<typeof RuleSetValues>

export const SubjectMapEntry = z.object({ subjectId: z.string().min(1), create: z.boolean() })

export const campaignCreateInput = projectScoped
  .extend({
    brief: Brief,
    subjectMap: z.array(SubjectMapEntry),
    languages: z.array(z.string().min(1)).min(1),
    sizes: z
      .array(CampaignSize)
      .min(1)
      .refine((s) => new Set(s.map((x) => x.label)).size === s.length, 'Size labels must differ.'),
    ruleSet: RuleSetValues.optional(),
    copyRuleSetFrom: z.string().min(1).optional(),
    templateId: z.string().min(1),
  })
  .refine((i) => i.subjectMap.length === i.brief.subjects.length, {
    message: 'Give one subject entry for each subject in the brief.',
    path: ['subjectMap'],
  })
  .refine((i) => !(i.ruleSet && i.copyRuleSetFrom), {
    message: 'Give a rule set or a campaign to copy it from, not both.',
    path: ['copyRuleSetFrom'],
  })
export type CampaignCreateInput = z.infer<typeof campaignCreateInput>

import { z } from 'zod'
import { projectScoped } from '@/shared/schemas/commands/project-scoped'
import type { ProjectMeta } from '@/shared/schemas/project'
import type { SubjectRow } from '@/shared/schemas/rows/subject'
import type { CampaignRow } from '@/shared/schemas/rows/campaign'
import type { DirectionRow } from '@/shared/schemas/rows/direction'
import type { RuleSetRow } from '@/shared/schemas/rows/rule-set'
import type { VariantRow } from '@/shared/schemas/rows/variant'
import type { SlotState, Template } from '@/shared/templates/types'

// SPEC 4.3 query inputs for project.get, template.list, template.slots and campaign.get.
export const projectGetInput = projectScoped
export const templateListInput = projectScoped
export const campaignScopedInput = projectScoped.extend({ campaignId: z.string().min(1) })

// SPEC 4.3 job marks [1.8]: counted over every job with the campaign's ID.
export type JobMarks = { jobRunning: boolean; resultUnseen: boolean }

export type CampaignSummary = Pick<
  CampaignRow,
  'id' | 'name' | 'region' | 'primaryLanguage' | 'createdBy' | 'createdAt'
> &
  JobMarks & { variantCount: number }

// SPEC 4.3 [1.42] the campaign.get reply. Phase 2 builds overflow, translationUnapproved and
// missingFile; the other three are false until their phases.
export type VariantBadges = JobMarks & {
  outOfDate: boolean
  overflow: boolean
  translationUnapproved: boolean
  checkWarning: boolean
  checkStale: boolean
  missingFile: boolean
}

export type VariantSummary = VariantRow & {
  isMaster: boolean
  subjectIds: string[]
  badges: VariantBadges
}

export type CampaignGet = {
  campaign: CampaignRow
  subjects: SubjectRow[]
  ruleSet: RuleSetRow
  directions: DirectionRow[]
  variants: VariantSummary[]
  marks: JobMarks
}

// The assets folder is slice A's alone, so its two keys stay out of this reply (SPEC 3.3).
export type ProjectGet = {
  meta: Omit<ProjectMeta, 'assetsDirRel' | 'assetsDirAbs'>
  subjects: SubjectRow[]
  campaigns: CampaignSummary[]
  missingAssetCount: number
}

export type TemplateList = Template[]
export type TemplateSlots = SlotState[]

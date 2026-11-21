import { z } from 'zod'
import { projectScoped } from '../commands/project-scoped'
import type { ProjectMeta } from '../project'
import type { SubjectRow } from '../rows/subject'
import type { CampaignRow } from '../rows/campaign'
import type { SlotState, Template } from '../../templates/types'

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
  JobMarks

// The assets folder is slice A's alone, so its two keys stay out of this reply (SPEC 3.3).
export type ProjectGet = {
  meta: Omit<ProjectMeta, 'assetsDirRel' | 'assetsDirAbs'>
  subjects: SubjectRow[]
  campaigns: CampaignSummary[]
  missingAssetCount: number
}

export type TemplateList = Template[]
export type TemplateSlots = SlotState[]

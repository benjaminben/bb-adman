import { z } from 'zod'
import { Brief } from '../brief'
import { CampaignSize } from '../commands/campaign'

// SPEC 3.3 campaign and campaign_subject, in wire form (SPEC 4.4).
export const CampaignRow = z.object({
  id: z.string(),
  name: z.string(),
  region: z.string(),
  audience: z.string(),
  message: z.string(),
  offer: z.string().nullable(),
  callToAction: z.string().nullable(),
  tone: z.string().nullable(),
  primaryLanguage: z.string(),
  languages: z.array(z.string()),
  sizes: z.array(CampaignSize),
  templateId: z.string(),
  brief: Brief,
  createdBy: z.enum(['user', 'agent']),
  createdAt: z.string(),
})
export type CampaignRow = z.infer<typeof CampaignRow>

export const CampaignSubjectRow = z.object({ campaignId: z.string(), subjectId: z.string() })
export type CampaignSubjectRow = z.infer<typeof CampaignSubjectRow>

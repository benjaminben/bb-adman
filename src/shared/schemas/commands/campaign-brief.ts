import { z } from 'zod'
import { projectScoped } from './project-scoped'

// campaign.createFromBrief and campaign.createFromBriefWithFiles (spec/phases/round-2-platform.md,
// D6): one input for both. The text is a brief in JSON, YAML or Markdown; it is never stored.
export const campaignFromBriefInput = projectScoped.extend({ text: z.string().min(1) }).strict()
export type CampaignFromBriefInput = z.infer<typeof campaignFromBriefInput>

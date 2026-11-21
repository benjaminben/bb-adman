// campaign.paidCount (spec/ai-jobs.md "The three queries"): the calls sent to paid providers
// for one campaign's jobs, by what they made. A count of calls, not money. Open to both actors.
import { z } from 'zod'
import { projectScoped } from '@/shared/schemas/commands/project-scoped'

export const campaignPaidCountInput = projectScoped.extend({ campaignId: z.string().min(1) })
export type CampaignPaidCountInput = z.infer<typeof campaignPaidCountInput>

export type PaidCount = { pictures: number; videos: number; text: number }

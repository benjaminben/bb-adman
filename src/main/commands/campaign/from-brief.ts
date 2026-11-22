// campaign.createFromBrief and campaign.createFromBriefWithFiles (spec/phases/round-2-platform.md,
// D6): two command names, one handler, so the agent policy table stays static. R2P-1 registers
// both against this stub, which refuses before it reads the brief; R2P-7 builds them.
import { defineCommand } from '@/main/commands/types'
import { campaignFromBriefInput } from '@/shared/schemas/commands/campaign-brief'
import { AppError } from '@/shared/schemas/result'

export type FromBriefName = 'campaign.createFromBrief' | 'campaign.createFromBriefWithFiles'

export function campaignFromBrief(name: FromBriefName) {
  return defineCommand({
    name,
    input: campaignFromBriefInput,
    projectId: (input) => input.projectId,
    run(): never {
      throw new AppError('RULE_VIOLATION', 'This is not built yet.', { reason: 'not_built' })
    },
  })
}

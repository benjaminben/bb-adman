import { z } from 'zod'
import { agentRunLimit } from '@/shared/schemas/settings'

// agentRuns.setAllowed and agentRuns.setLimit (spec/api-commands.md). App scope, user only.
export const agentRunsSetAllowedInput = z.object({
  provider: z.string().min(1),
  allowed: z.boolean(),
})

export const agentRunsSetLimitInput = z.object({ limit: agentRunLimit })

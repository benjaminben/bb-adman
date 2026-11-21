// agent.answerPermission (spec/phases/phase-10.md, "Design additions", ask flow). User only: its
// agent policy row is deny. rememberAuto with allow also turns on deletes without asking.
import { z } from 'zod'

export const agentAnswerPermissionInput = z
  .object({ requestId: z.string().min(1), allow: z.boolean(), rememberAuto: z.boolean() })
  .strict()
export type AgentAnswerPermissionInput = z.infer<typeof agentAnswerPermissionInput>

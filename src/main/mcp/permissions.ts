// The permission broker (spec/phases/phase-10.md, ask flow, A-237 to A-240): the bus's ask for
// an agent command whose policy is ask, and the user's answer through agent.answerPermission.
// Stub (P10-1): every ask is refused, as before Phase 10, and no request exists to answer.
// P10-6 fills it.
import type { AskAnswer, BusEvent, PermissionRequest } from '@/main/commands/bus'
import type { ProjectRegistry } from '@/main/db/project-registry'
import type { ActivityLog } from '@/main/log/activity-log'
import type { SettingsStore } from '@/main/settings/settings-store'
import type { AgentAnswerPermissionInput } from '@/shared/schemas/commands/agent'
import { AppError } from '@/shared/schemas/result'

export type PermissionBrokerDeps = {
  emit: (event: BusEvent) => void
  settings: SettingsStore
  log: ActivityLog
  now: () => Date
  projects: ProjectRegistry
}

export type PermissionBroker = {
  ask(request: PermissionRequest): Promise<AskAnswer>
  answer(input: AgentAnswerPermissionInput): void
}

export const REQUEST_ENDED = 'That request has ended.'

export function createPermissionBroker(_deps: PermissionBrokerDeps): PermissionBroker {
  return {
    ask: async () => 'refused',
    answer: () => {
      throw new AppError('NOT_FOUND', REQUEST_ENDED)
    },
  }
}

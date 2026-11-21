// Agent activity (spec/phases/phase-10.md, A-241): after each tool call, one log line
// event 'tool' and one agent.activity event, with no input and no reply. Stub (P10-1): record
// does nothing until P10-8 fills it.
import type { BusEvent } from '@/main/commands/bus'
import type { ActivityLog } from '@/main/log/activity-log'
import type { ToolCall } from './tools'

export type AgentActivityDeps = {
  emit: (event: BusEvent) => void
  log: ActivityLog
  now: () => Date
}

export type AgentActivity = { record(call: ToolCall): void }

export function createAgentActivity(_deps: AgentActivityDeps): AgentActivity {
  return { record: () => undefined }
}

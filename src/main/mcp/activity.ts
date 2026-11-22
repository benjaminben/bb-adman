// Agent activity (spec/phases/phase-10.md, A-241): after each tool call, one log line
// event 'tool' and one agent.activity event, with no input and no reply. The window gets the
// tool name, the project ID, ok and the time only. The tool name must be one of the fixed
// table's and the project ID must have the shape of one; anything else an agent sent is
// replaced, so its text never reaches the window or the log.
import type { BusEvent } from '@/main/commands/bus'
import type { ActivityLog } from '@/main/log/activity-log'
import { cleanClientName } from './client-name'
import { ALL_TOOLS } from './tools/table'
import type { ToolCall } from './tools'

export type AgentActivityDeps = {
  emit: (event: BusEvent) => void
  log: ActivityLog
  now: () => Date
}

export type AgentActivity = { record(call: ToolCall): void }

const UNKNOWN_TOOL = 'unknown'
const TOOL_NAMES = new Set(ALL_TOOLS.map((t) => t.name))

// A project ID is a ULID (src/main/db/project-file.ts): 26 Crockford base-32 characters.
const PROJECT_ID = /^[0-9A-HJKMNP-TV-Z]{26}$/

export function createAgentActivity(deps: AgentActivityDeps): AgentActivity {
  return {
    record(call) {
      const tool = TOOL_NAMES.has(call.tool) ? call.tool : UNKNOWN_TOOL
      const projectId =
        call.projectId !== null && PROJECT_ID.test(call.projectId) ? call.projectId : null
      const at = deps.now().toISOString()
      deps.log.write({
        level: 'info',
        event: 'tool',
        name: tool,
        actor: 'agent',
        agentClient: cleanClientName(call.agentClient),
        projectId,
        ok: call.ok,
        errorKind: call.ok ? null : call.errorKind,
        message: 'tool call',
      })
      deps.emit({ name: 'agent.activity', payload: { tool, projectId, ok: call.ok, at } })
    },
  }
}

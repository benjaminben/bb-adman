// The permission broker (spec/phases/phase-10.md, ask flow, A-237 to A-240): the bus's ask for
// an agent command whose policy is ask, and the user's answer through agent.answerPermission.
// One request waits at a time. It ends once: on the user's answer, at ASK_WAIT_MS, or when its
// project closes. An answer that comes after the end changes nothing.
import { randomUUID } from 'node:crypto'
import { AGENT_POLICY } from '@/main/commands/agent-policy'
import type { AskAnswer, BusEvent, PermissionRequest } from '@/main/commands/bus'
import type { ProjectRegistry } from '@/main/db/project-registry'
import type { ActivityLog } from '@/main/log/activity-log'
import type { SettingsStore } from '@/main/settings/settings-store'
import { ASK_WAIT_MS } from '@/shared/config/agent-ask'
import type { AgentAnswerPermissionInput } from '@/shared/schemas/commands/agent'
import { AppError } from '@/shared/schemas/result'
import { askTarget } from './ask-target'
import { ASK_KINDS } from './ask-kinds'

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

// How often a waiting request checks that its project is still the one that was open.
const PROJECT_CHECK_MS = 250

type Outcome = AskAnswer | 'auto_approved' | 'project_closed'

type Waiting = {
  requestId: string
  projectId: string | null
  stillOpen: () => boolean
  end: (answer: AskAnswer | AppError) => void
}

export function createPermissionBroker(deps: PermissionBrokerDeps): PermissionBroker {
  let waiting: Waiting | null = null

  // A-240: one line per outcome, with no input value.
  function logOutcome(request: PermissionRequest, outcome: Outcome) {
    const ok = outcome === 'allowed' || outcome === 'auto_approved'
    deps.log.write({
      level: ok ? 'info' : 'warn',
      event: 'ask',
      name: request.command,
      actor: 'agent',
      agentClient: request.agentClient,
      projectId: request.projectId,
      ok,
      message: outcome,
      context: { outcome },
    })
  }

  // The project the request was made in, held so a close (or a close and reopen) ends it.
  function projectWatch(projectId: string | null): () => boolean {
    if (!projectId) return () => true
    const handle = deps.projects.get(projectId)
    return () => handle !== undefined && deps.projects.get(projectId) === handle
  }

  // The project closed: the command's own NOT_FOUND. Closed and opened again: refused.
  function projectGone(projectId: string | null): AppError | 'refused' {
    try {
      deps.projects.requireOpen(projectId ?? '')
      return 'refused'
    } catch (e) {
      if (e instanceof AppError) return e
      throw e
    }
  }

  function wait(request: PermissionRequest): Promise<AskAnswer> {
    const requestId = randomUUID()
    const stillOpen = projectWatch(request.projectId)
    return new Promise<AskAnswer>((resolve, reject) => {
      const end = (answer: AskAnswer | AppError) => {
        if (waiting?.requestId !== requestId) return
        waiting = null
        clearTimeout(timer)
        clearInterval(watch)
        logOutcome(request, answer instanceof AppError ? 'project_closed' : answer)
        if (answer instanceof AppError) reject(answer)
        else resolve(answer)
      }
      const timer = setTimeout(() => end('timed_out'), ASK_WAIT_MS)
      const watch = setInterval(() => {
        if (!stillOpen()) end(projectGone(request.projectId))
      }, PROJECT_CHECK_MS)
      waiting = { requestId, projectId: request.projectId, stillOpen, end }
      const expiresAt = new Date(deps.now().getTime() + ASK_WAIT_MS).toISOString()
      deps.emit({
        name: 'agent.permissionRequested',
        payload: {
          requestId,
          agentClient: request.agentClient,
          action: AGENT_POLICY[request.command]?.action ?? request.command,
          target: askTarget(deps.projects, request),
          expiresAt,
          kind: ASK_KINDS[request.command] ?? 'delete',
          fileCount: 0,
        },
      })
    })
  }

  return {
    async ask(request) {
      if (deps.settings.get().mcp.autoApproveDestructive) {
        logOutcome(request, 'auto_approved')
        return 'allowed'
      }
      if (waiting) {
        logOutcome(request, 'busy')
        return 'busy'
      }
      return wait(request)
    },
    answer(input) {
      const current = waiting
      if (!current || current.requestId !== input.requestId) {
        throw new AppError('NOT_FOUND', REQUEST_ENDED)
      }
      if (!current.stillOpen()) {
        current.end(projectGone(current.projectId))
        throw new AppError('NOT_FOUND', REQUEST_ENDED)
      }
      if (input.allow && input.rememberAuto) {
        deps.settings.update({ mcp: { autoApproveDestructive: true } })
      }
      current.end(input.allow ? 'allowed' : 'refused')
    },
  }
}

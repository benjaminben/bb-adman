// The permission broker (spec/phases/phase-10.md, ask flow, A-237 to A-240): the bus's ask for
// an agent command whose policy is ask, and the user's answer through agent.answerPermission.
// One request waits at a time. It ends once: on the user's answer, at ASK_WAIT_MS, or when its
// project closes. An answer that comes after the end changes nothing. Round 2 (D7, R2P-5): each
// ask has a kind; mcp.autoApproveDestructive answers deletes only; an import ask holds its list
// of normalised paths for agent.askFiles while it waits, and never sends one in an event.
// CW-6a (D-104): a workflow ask's text is checked before it is sent; it holds the name, job,
// start and node types for agent.askWorkflow; nothing but the person's "Add" answers it.
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { importPathTexts } from '@/main/assets/import-files'
import { AGENT_POLICY } from '@/main/commands/agent-policy'
import type { AskAnswer, BusEvent, PermissionRequest } from '@/main/commands/bus'
import { briefPlan } from '@/main/commands/campaign/from-brief-plan'
import type { ProjectHandle } from '@/main/db/project-file'
import type { ProjectRegistry } from '@/main/db/project-registry'
import { campaignFromBriefInput } from '@/shared/schemas/commands/campaign-brief'
import type { ActivityLog } from '@/main/log/activity-log'
import type { SettingsStore } from '@/main/settings/settings-store'
import { ASK_WAIT_MS } from '@/shared/config/agent-ask'
import type { AgentAnswerPermissionInput } from '@/shared/schemas/commands/agent'
import { AppError } from '@/shared/schemas/result'
import { askTarget, type WorkflowNames } from './ask-target'
import {
  readAskedWorkflow,
  workflowAddLine,
  type AskWorkflow,
  type HeldWorkflow,
} from './ask-workflow-reader'
import { ASK_KINDS, type AskKind } from './ask-kinds'

export type PermissionBrokerDeps = {
  emit: (event: BusEvent) => void
  settings: SettingsStore
  log: ActivityLog
  now: () => Date
  projects: ProjectRegistry
  // CW-6a: the names of the custom workflows, for the remove ask's target line.
  workflows?: WorkflowNames
}

export type PermissionBroker = {
  ask(request: PermissionRequest): Promise<AskAnswer>
  answer(input: AgentAnswerPermissionInput): void
  // The paths of the open request with this ID, for agent.askFiles; NOT_FOUND once it ended.
  files(requestId: string): string[]
  // The open workflow ask with this ID, for agent.askWorkflow; NOT_FOUND for any other.
  workflow(requestId: string): AskWorkflow
}

export const REQUEST_ENDED = 'That request has ended.'

// How often a waiting request checks that its project is still the one that was open.
const PROJECT_CHECK_MS = 250

type Outcome = AskAnswer | 'auto_approved' | 'project_closed'

const importInput = z.object({ paths: z.array(z.string()) })

type FileReader = (input: unknown, project: ProjectHandle | undefined) => string[] | null

// The paths each import command asks about, checked by the text rules before anything is sent
// (a refusal here is the command's own). An import ask with no reader is refused. R2P-7: a
// brief is checked whole against its project (from-brief-plan.ts), so a brief the command would
// refuse never reaches the screen; nothing on disk is read before the answer.
const FILE_READERS: Readonly<Record<string, FileReader>> = {
  'asset.importFiles': (input) => {
    const parsed = importInput.safeParse(input)
    return parsed.success ? importPathTexts(parsed.data.paths) : null
  },
  'campaign.createFromBriefWithFiles': (input, project) => {
    const parsed = campaignFromBriefInput.safeParse(input)
    if (!parsed.success || !project) return null
    return briefPlan(project.db, parsed.data, true).paths
  },
}

type Waiting = {
  requestId: string
  kind: AskKind
  files: string[]
  held: HeldWorkflow | null
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

  function targetOf(request: PermissionRequest, held: HeldWorkflow | null): string {
    return held ? workflowAddLine(held) : askTarget(deps.projects, request, deps.workflows)
  }

  // The open request with this ID, still in its project; else NOT_FOUND.
  function openRequest(requestId: string): Waiting {
    const current = waiting
    if (!current || current.requestId !== requestId || !current.stillOpen()) {
      throw new AppError('NOT_FOUND', REQUEST_ENDED)
    }
    return current
  }

  function wait(
    request: PermissionRequest,
    kind: AskKind,
    files: string[],
    held: HeldWorkflow | null,
  ): Promise<AskAnswer> {
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
      waiting = { requestId, kind, files, held, projectId: request.projectId, stillOpen, end }
      const expiresAt = new Date(deps.now().getTime() + ASK_WAIT_MS).toISOString()
      deps.emit({
        name: 'agent.permissionRequested',
        payload: {
          requestId,
          agentClient: request.agentClient,
          action: AGENT_POLICY[request.command]?.action ?? request.command,
          target: targetOf(request, held),
          expiresAt,
          kind,
          fileCount: files.length,
        },
      })
    })
  }

  return {
    async ask(request) {
      const kind = ASK_KINDS[request.command]
      const reader = FILE_READERS[request.command]
      const project = request.projectId ? deps.projects.get(request.projectId) : undefined
      const files = kind === 'import' ? (reader?.(request.input, project) ?? null) : []
      // Throws the command's own refusal, so a refused text never reaches the screen.
      const held = kind === 'workflow' ? readAskedWorkflow(request.input) : null
      if (!kind || !files) {
        logOutcome(request, 'refused')
        return 'refused'
      }
      if (kind === 'delete' && deps.settings.get().mcp.autoApproveDestructive) {
        logOutcome(request, 'auto_approved')
        return 'allowed'
      }
      if (waiting) {
        logOutcome(request, 'busy')
        return 'busy'
      }
      return wait(request, kind, files, held)
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
      if (input.allow && input.rememberAuto && current.kind === 'delete') {
        deps.settings.update({ mcp: { autoApproveDestructive: true } })
      }
      current.end(input.allow ? 'allowed' : 'refused')
    },
    files(requestId) {
      return [...openRequest(requestId).files]
    },
    workflow(requestId) {
      const view = openRequest(requestId).held?.view
      if (!view) throw new AppError('NOT_FOUND', REQUEST_ENDED)
      return { ...view, nodeTypes: [...view.nodeTypes] }
    },
  }
}

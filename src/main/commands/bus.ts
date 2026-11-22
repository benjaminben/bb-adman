// The command bus (SPEC 3.6, 4.1, 5.2). Fixed order: deny check, find the handler and
// validate, find the project, agent run gate, ask, run. Records undo, emits events, writes the
// log and never throws.
import { ulid } from 'ulid'
import { agentPolicyFor, denialMessage } from './agent-policy'
import { agentRunGate, type AgentRunGateDeps } from './agent-run-gate'
import { runHistory } from './history/run-history'
import { runInProject, type ProjectRun } from './run-in-project'
import type { CommandHandler, HandlerResult } from './types'
import type { ProjectRegistry } from '@/main/db/project-registry'
import { guardAgentUndo } from '@/main/history/agent-undo-guard'
import type { UndoLists, UndoScope } from '@/main/history/undo-lists'
import type { ActivityLog } from '@/main/log/activity-log'
import { errorContext } from '@/main/log/error-context'
import { historyInput } from '@/shared/schemas/commands/history'
import { AppError, fail, internalError, ok, type Result } from '@/shared/schemas/result'
import type { Actor, EventMap, EventName } from '@/shared/schemas/events'

export type BusEvent = { [K in EventName]: { name: K; payload: EventMap[K] } }[EventName]

// spec/phases/phase-10.md, ask flow: what the ask is given, the input as the handler parsed it.
export type PermissionRequest = {
  command: string
  agentClient: string | null
  projectId: string | null
  input: unknown
}

// true is 'allowed' and false is 'refused'. Anything else the bus refuses too (fail closed).
export type AskAnswer = 'allowed' | 'refused' | 'timed_out' | 'busy'

export type ExecuteOptions = {
  actor: Actor
  agentClient?: string
  // Set by history.undo / history.redo when replaying an inverse.
  replay?: { direction: 'undo' | 'redo'; projectId: string; scope: UndoScope }
}

export type CommandBus = {
  execute(name: string, input: unknown, opts: ExecuteOptions): Promise<Result<unknown>>
}

export type BusDeps = {
  handlers: CommandHandler[]
  projects: ProjectRegistry
  undo: UndoLists
  log: ActivityLog
  emit: (event: BusEvent) => void
  askPermission: (request: PermissionRequest) => Promise<boolean | AskAnswer>
  // What the agent run gate reads. A bus built without it refuses every agent run at gate
  // step 1, since it knows no provider.
  agentRuns?: Pick<AgentRunGateDeps, 'providers' | 'settings'>
}

const NO_AGENT_RUNS: Pick<AgentRunGateDeps, 'providers' | 'settings'> = {
  providers: [],
  settings: { get: () => ({ agentRuns: {}, agentRunLimit: 0 }) },
}

type LogIds = HandlerResult<unknown>['log']
type Line = { projectId: string | null; ids: LogIds }

const INVALID = 'Some values are not valid.'

// The refusals of an ask that did not allow (A-237), all AGENT_REFUSED, each with its reason.
const ASK_REFUSALS = {
  refused: 'The user did not allow this action.',
  timed_out: 'The user did not answer in time.',
  busy: "Another request is waiting for the user's answer. Try again after it.",
} as const

function askRefusal(answer: unknown): AppError | null {
  if (answer === true || answer === 'allowed') return null
  const reason = answer === 'timed_out' || answer === 'busy' ? answer : 'refused'
  return new AppError('AGENT_REFUSED', ASK_REFUSALS[reason], { reason })
}
const UNDO_PREPARE_FAILED = 'Clean-up after a failed command did not finish.'

// The one answer to a command name that does not exist, or that no window may send.
export const unknownCommandMessage = (name: string) => `Unknown command: ${name}`

export function createCommandBus(deps: BusDeps): CommandBus {
  const handlers = new Map(deps.handlers.map((h) => [h.name, h]))
  const gateDeps: AgentRunGateDeps = {
    projects: deps.projects,
    ...(deps.agentRuns ?? NO_AGENT_RUNS),
    passed: new Map(),
  }

  // SPEC 14 [1.37] X2: fail closed; an agent runs only on allow, on ask once allowed, or on
  // tick once the agent run gate passes it.
  function denyCheck(name: string, opts: ExecuteOptions): void {
    const policy = agentPolicyFor(name)
    if (opts.actor === 'agent' && policy !== 'allow' && policy !== 'ask' && policy !== 'tick') {
      throw new AppError('AGENT_DENIED', denialMessage(name))
    }
  }

  async function askCheck(
    name: string,
    opts: ExecuteOptions,
    projectId: string | null,
    input: unknown,
  ): Promise<void> {
    if (opts.actor !== 'agent' || agentPolicyFor(name) !== 'ask') return
    const answer = await deps.askPermission({
      command: name,
      agentClient: opts.agentClient ?? null,
      projectId,
      input,
    })
    const refusal = askRefusal(answer)
    if (refusal) throw refusal
  }

  async function runHandler(
    handler: CommandHandler,
    input: unknown,
    opts: ExecuteOptions,
    commandId: string,
    projectId: string | null,
  ): Promise<ProjectRun> {
    const base = { actor: opts.actor, commandId, replay: opts.replay?.direction }
    if (projectId) {
      const logCleanup = (e: unknown) => {
        deps.log.write({
          level: 'warn',
          event: 'command',
          name: handler.name,
          actor: opts.actor,
          agentClient: opts.agentClient ?? null,
          projectId,
          ok: false,
          errorKind: null,
          message: UNDO_PREPARE_FAILED,
          context: { commandId, step: 'undoPrepare', error: errorContext(e) },
        })
      }
      return runInProject(deps.projects, handler, input, base, projectId, logCleanup)
    }
    return { result: await handler.run(base, input), changes: null }
  }

  function recordUndo(
    projectId: string | null,
    result: HandlerResult<unknown>,
    opts: ExecuteOptions,
  ) {
    if (!projectId || !result.inverse) return
    const { scope, call } = result.inverse
    const { actor, replay } = opts
    if (replay?.direction === 'undo') deps.undo.recordRedo(projectId, scope, call, actor)
    else deps.undo.record(projectId, scope, call, { fromRedo: replay?.direction === 'redo', actor })
  }

  async function dispatch(
    name: string,
    raw: unknown,
    opts: ExecuteOptions,
    commandId: string,
    line: Line,
  ) {
    denyCheck(name, opts)
    if (name === 'history.undo' || name === 'history.redo') {
      const parsed = historyInput.safeParse(raw)
      if (!parsed.success) throw new AppError('INVALID_INPUT', INVALID)
      deps.projects.requireOpen(parsed.data.projectId)
      line.projectId = parsed.data.projectId
      await askCheck(name, opts, parsed.data.projectId, parsed.data)
      return runHistory(name, parsed.data, opts, { undo: deps.undo, execute })
    }
    const handler = handlers.get(name)
    if (!handler) throw new AppError('INVALID_INPUT', unknownCommandMessage(name))
    const parsed = handler.parse(raw)
    if (!parsed.ok) throw new AppError('INVALID_INPUT', INVALID, { issues: parsed.issues })
    const projectId = handler.projectIdOf?.(parsed.input) ?? null
    if (projectId) {
      deps.projects.requireOpen(projectId)
      line.projectId = projectId
    }
    const gated = opts.actor === 'agent' && agentPolicyFor(name) === 'tick'
    const release = gated ? agentRunGate(gateDeps, name, parsed.input) : undefined
    let run: ProjectRun
    try {
      await askCheck(name, opts, projectId, parsed.input)
      // A-261: the agent undo guard checks the list inside the handler's transaction.
      const guarded = guardAgentUndo(handler, deps.undo, projectId, opts)
      run = await runHandler(guarded, parsed.input, opts, commandId, projectId)
    } finally {
      release?.()
    }
    line.projectId = projectId ?? run.result.log?.projectId ?? null
    line.ids = run.result.log
    // A-141: only the project the handler ran in, never one a log line names; before the
    // inverse is recorded, so the command's own entry stays.
    if (projectId) for (const s of run.result.clearScopes ?? []) deps.undo.clear(projectId, s)
    recordUndo(line.projectId, run.result, opts)
    if (projectId && run.changes) {
      deps.emit({
        name: 'project.changed',
        payload: { projectId, ...run.changes, actor: opts.actor },
      })
    }
    if (handler.changesAppState) deps.emit({ name: 'app.stateChanged', payload: {} })
    return run.result.data
  }

  async function execute(
    name: string,
    raw: unknown,
    opts: ExecuteOptions,
  ): Promise<Result<unknown>> {
    const commandId = ulid()
    const line: Line = { projectId: null, ids: undefined }
    try {
      const data = await dispatch(name, raw, opts, commandId, line)
      writeLog('info', 'ok', null)
      return ok(data)
    } catch (e) {
      if (e instanceof AppError) {
        writeLog('warn', e.message, e.code)
        return fail(e.toBody())
      }
      // The bus never throws: anything unforeseen is logged in full and returned as INTERNAL.
      const body = internalError(commandId)
      writeLog('error', body.message, 'INTERNAL', { error: errorContext(e) })
      return fail(body)
    }

    function writeLog(
      level: 'info' | 'warn' | 'error',
      message: string,
      errorKind: string | null,
      extra: Record<string, unknown> = {},
    ) {
      deps.log.write({
        level,
        event: 'command',
        name,
        actor: opts.actor,
        agentClient: opts.agentClient ?? null,
        projectId: line.projectId,
        campaignId: line.ids?.campaignId ?? null,
        variantId: line.ids?.variantId ?? null,
        ok: errorKind === null,
        errorKind,
        message,
        context: {
          commandId,
          ...(opts.replay ? { replay: opts.replay.direction } : {}),
          ...extra,
        },
      })
    }
  }

  return { execute }
}

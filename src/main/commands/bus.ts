// The command bus (SPEC 3.6, 4.1, 5.2). Fixed order: deny check, find the handler and
// validate, find the project, ask, run. Records undo, emits events, writes the log and
// never throws.
import { ulid } from 'ulid'
import { agentPolicyFor, denialMessage } from './agent-policy'
import { runHistory } from './history/run-history'
import { runInProject, type ProjectRun } from './run-in-project'
import type { CommandHandler, HandlerResult } from './types'
import type { ProjectRegistry } from '../db/project-registry'
import type { UndoLists, UndoScope } from '../history/undo-lists'
import type { ActivityLog } from '../log/activity-log'
import { errorContext } from '../log/error-context'
import { historyInput } from '../../shared/schemas/commands/history'
import { AppError, fail, internalError, ok, type Result } from '../../shared/schemas/result'
import type { Actor, EventMap, EventName } from '../../shared/schemas/events'

export type BusEvent = { [K in EventName]: { name: K; payload: EventMap[K] } }[EventName]

export type PermissionRequest = { command: string; agentClient: string | null }

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
  askPermission: (request: PermissionRequest) => Promise<boolean>
}

type LogIds = HandlerResult<unknown>['log']
type Line = { projectId: string | null; ids: LogIds }

const INVALID = 'Some values are not valid.'

export function createCommandBus(deps: BusDeps): CommandBus {
  const handlers = new Map(deps.handlers.map((h) => [h.name, h]))

  function denyCheck(name: string, opts: ExecuteOptions): void {
    if (opts.actor === 'agent' && agentPolicyFor(name) === 'deny') {
      throw new AppError('AGENT_DENIED', denialMessage(name))
    }
  }

  async function askCheck(name: string, opts: ExecuteOptions): Promise<void> {
    if (opts.actor !== 'agent' || agentPolicyFor(name) !== 'ask') return
    const allowed = await deps.askPermission({
      command: name,
      agentClient: opts.agentClient ?? null,
    })
    if (!allowed) throw new AppError('AGENT_REFUSED', 'The user did not allow this action.')
  }

  async function runHandler(
    handler: CommandHandler,
    input: unknown,
    opts: ExecuteOptions,
    commandId: string,
    projectId: string | null,
  ): Promise<ProjectRun> {
    const base = { actor: opts.actor, commandId }
    if (projectId) return runInProject(deps.projects, handler, input, base, projectId)
    return { result: await handler.run(base, input), changes: null }
  }

  function recordUndo(
    projectId: string | null,
    result: HandlerResult<unknown>,
    opts: ExecuteOptions,
  ) {
    if (!projectId || !result.inverse) return
    const { scope, call } = result.inverse
    if (opts.replay?.direction === 'undo') deps.undo.recordRedo(projectId, scope, call)
    else deps.undo.record(projectId, scope, call, { fromRedo: opts.replay?.direction === 'redo' })
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
      await askCheck(name, opts)
      return runHistory(name, parsed.data, opts, { undo: deps.undo, execute })
    }
    const handler = handlers.get(name)
    if (!handler) throw new AppError('INVALID_INPUT', `Unknown command: ${name}`)
    const parsed = handler.parse(raw)
    if (!parsed.ok) throw new AppError('INVALID_INPUT', INVALID, { issues: parsed.issues })
    const projectId = handler.projectIdOf?.(parsed.input) ?? null
    if (projectId) {
      deps.projects.requireOpen(projectId)
      line.projectId = projectId
    }
    await askCheck(name, opts)
    const run = await runHandler(handler, parsed.input, opts, commandId, projectId)
    line.projectId = projectId ?? run.result.log?.projectId ?? null
    line.ids = run.result.log
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

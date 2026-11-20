// The command bus (SPEC 1.3, 3.6, 5.2): validates, applies the agent policy, runs one
// transaction, records undo, emits events and writes the log.
import { ulid } from 'ulid'
import { agentPolicyFor, denialMessage } from './agent-policy'
import { createChangeRecorder } from './change-recorder'
import { runHistory } from './history/run-history'
import type { CommandHandler, HandlerResult } from './types'
import type { ProjectRegistry } from '../db/project-registry'
import type { UndoLists, UndoScope } from '../history/undo-lists'
import type { ActivityLog } from '../log/activity-log'
import { AppError, fail, ok, type Result } from '../../shared/schemas/result'
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

export function createCommandBus(deps: BusDeps): CommandBus {
  const handlers = new Map(deps.handlers.map((h) => [h.name, h]))

  async function guardAgent(name: string, opts: ExecuteOptions): Promise<void> {
    if (opts.actor !== 'agent') return
    const policy = agentPolicyFor(name)
    if (policy === 'deny') throw new AppError('AGENT_DENIED', denialMessage(name))
    if (policy === 'ask') {
      const allowed = await deps.askPermission({
        command: name,
        agentClient: opts.agentClient ?? null,
      })
      if (!allowed) throw new AppError('AGENT_REFUSED', 'The user did not allow this action.')
    }
  }

  async function runHandler(
    handler: CommandHandler,
    input: unknown,
    opts: ExecuteOptions,
    commandId: string,
  ) {
    const recorder = createChangeRecorder()
    const base = { actor: opts.actor, commandId, changes: recorder }
    let projectId: string | null = null
    let result: HandlerResult<unknown>
    if (handler.projectIdOf) {
      projectId = handler.projectIdOf(input)
      const project = deps.projects.get(projectId)
      if (!project) throw new AppError('NOT_FOUND', 'That project is not open.', { projectId })
      result = project.db.transaction(() => {
        const out = handler.run({ ...base, project }, input)
        if (out instanceof Promise) throw new Error(`${handler.name} must run synchronously`)
        return out
      })()
    } else {
      result = await handler.run(base, input)
    }
    return { result, projectId, changes: recorder.collect() }
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

  async function execute(
    name: string,
    raw: unknown,
    opts: ExecuteOptions,
  ): Promise<Result<unknown>> {
    const commandId = ulid()
    let projectId: string | null = null
    let logIds: HandlerResult<unknown>['log'] = undefined
    try {
      await guardAgent(name, opts)
      if (name === 'history.undo' || name === 'history.redo') {
        const out = await runHistory(name, raw, opts, {
          undo: deps.undo,
          projects: deps.projects,
          execute,
        })
        projectId = out.projectId
        return finish(ok(out.data))
      }
      const handler = handlers.get(name)
      if (!handler) throw new AppError('INVALID_INPUT', `Unknown command: ${name}`)
      const parsed = handler.parse(raw)
      if (!parsed.ok)
        throw new AppError('INVALID_INPUT', 'Some values are not valid.', { issues: parsed.issues })
      const run = await runHandler(handler, parsed.input, opts, commandId)
      projectId = run.projectId ?? run.result.log?.projectId ?? null
      logIds = run.result.log
      recordUndo(projectId, run.result, opts)
      if (projectId && !run.changes.empty) {
        deps.emit({
          name: 'project.changed',
          payload: { projectId, ...run.changes.rows, actor: opts.actor },
        })
      }
      if (handler.changesAppState) deps.emit({ name: 'app.stateChanged', payload: {} })
      return finish(ok(run.result.data))
    } catch (e) {
      if (!(e instanceof AppError)) {
        writeLog(false, 'error', String(e instanceof Error ? e.message : e), null)
        throw e
      }
      return finish(fail(e.toBody()))
    }

    function finish(result: Result<unknown>): Result<unknown> {
      if (result.ok) writeLog(true, 'info', 'ok', null)
      else writeLog(false, 'warn', result.error.message, result.error.code)
      return result
    }

    function writeLog(
      okay: boolean,
      level: 'info' | 'warn' | 'error',
      message: string,
      errorKind: string | null,
    ) {
      deps.log.write({
        level,
        event: 'command',
        name,
        actor: opts.actor,
        agentClient: opts.agentClient ?? null,
        projectId,
        campaignId: logIds?.campaignId ?? null,
        variantId: logIds?.variantId ?? null,
        ok: okay,
        errorKind,
        message,
        context: { commandId, ...(opts.replay ? { replay: opts.replay.direction } : {}) },
      })
    }
  }

  return { execute }
}

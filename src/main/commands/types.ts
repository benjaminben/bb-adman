// Command handler definitions (SPEC 3.6, 4.2). A handler that names a project runs
// synchronously inside one SQLite transaction on that project's file. It may first run an
// asynchronous prepare step outside the transaction, which may not write to the project.
import type { z } from 'zod'
import type { ProjectHandle } from '../db/project-file'
import type { CommandCall, UndoScope } from '../history/undo-lists'
import type { Actor } from '../../shared/schemas/events'

export type ChangeRecorder = {
  changed(table: string, row: unknown): void
  removed(table: string, id: string): void
}

export type BaseContext = {
  actor: Actor
  commandId: string
  changes: ChangeRecorder
}

export type ProjectContext = BaseContext & { project: ProjectHandle }

export type PrepareContext = { actor: Actor; commandId: string; project: ProjectHandle }

export type HandlerResult<O> = {
  data: O
  inverse?: { scope: UndoScope; call: CommandCall }
  // IDs for the log line when the bus cannot know them from the input (SPEC 9.1).
  log?: { projectId?: string; campaignId?: string; variantId?: string }
}

type Parsed = { ok: true; input: unknown } | { ok: false; issues: string[] }

// The bus sees handlers with their types erased; defineCommand keeps them typed.
export type CommandHandler = {
  name: string
  changesAppState: boolean
  parse(raw: unknown): Parsed
  projectIdOf?: (input: unknown) => string
  prepare?: (ctx: PrepareContext, input: unknown) => Promise<unknown>
  undoPrepare?: (prepared: unknown) => void | Promise<void>
  run(
    ctx: ProjectContext | BaseContext,
    input: unknown,
    prepared?: unknown,
  ): HandlerResult<unknown> | Promise<HandlerResult<unknown>>
}

type Common<I> = { name: string; input: z.ZodType<I>; changesAppState?: boolean }

type ProjectDef<I, O, P> = Common<I> & {
  projectId: (input: I) => string
  prepare?: (ctx: PrepareContext, input: I) => Promise<P>
  run(ctx: ProjectContext, input: I, prepared: P): HandlerResult<O>
  undoPrepare?: (prepared: P) => void | Promise<void>
}

type AppDef<I, O> = Common<I> & {
  projectId?: undefined
  run(ctx: BaseContext, input: I): HandlerResult<O> | Promise<HandlerResult<O>>
}

export function defineCommand<I, O, P = undefined>(def: ProjectDef<I, O, P>): CommandHandler
export function defineCommand<I, O>(def: AppDef<I, O>): CommandHandler
export function defineCommand<I, O, P>(def: ProjectDef<I, O, P> | AppDef<I, O>): CommandHandler {
  const parse = (raw: unknown): Parsed => {
    const result = def.input.safeParse(raw)
    if (result.success) return { ok: true, input: result.data }
    return {
      ok: false,
      issues: result.error.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`),
    }
  }
  const projectId = def.projectId
  if (projectId) {
    const { run, prepare, undoPrepare } = def as ProjectDef<I, O, P>
    return {
      name: def.name,
      changesAppState: def.changesAppState ?? false,
      parse,
      projectIdOf: (input) => projectId(input as I),
      ...(prepare ? { prepare: (ctx, input) => prepare(ctx, input as I) } : {}),
      ...(undoPrepare ? { undoPrepare: (prepared) => undoPrepare(prepared as P) } : {}),
      run: (ctx, input, prepared) => run(ctx as ProjectContext, input as I, prepared as P),
    }
  }
  const run = def.run as AppDef<I, O>['run']
  return {
    name: def.name,
    changesAppState: def.changesAppState ?? false,
    parse,
    run: (ctx, input) => run(ctx, input as I),
  }
}

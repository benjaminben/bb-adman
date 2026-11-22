// Undo and redo lists, one per variant and one per campaign (SPEC 4.2, R-17).
// An entry is the command that reverses an edit. Lists live in memory only and
// are dropped when the project closes (FR-006).
import type { Actor } from '@/shared/schemas/events'

export const UNDO_LIMIT = 200
// A-261: agent entries in a row a list takes before the next agent command is refused, half
// of UNDO_LIMIT, so all an agent did since the user last acted there stays undoable.
export const AGENT_RUN_LIMIT = 100

export type CommandCall = { name: string; input: unknown }
export type UndoScope = string // `variant:{id}` or `campaign:{id}`
export type UndoState = { canUndo: boolean; canRedo: boolean }

// agentRun: agent entries recorded in a row since the user last acted on this list.
type Lists = { undo: CommandCall[]; redo: CommandCall[]; agentRun: number }

export type UndoLists = ReturnType<typeof createUndoLists>

export function createUndoLists() {
  const projects = new Map<string, Map<UndoScope, Lists>>()

  function lists(projectId: string, scope: UndoScope): Lists {
    let byScope = projects.get(projectId)
    if (!byScope) projects.set(projectId, (byScope = new Map()))
    let entry = byScope.get(scope)
    if (!entry) byScope.set(scope, (entry = { undo: [], redo: [], agentRun: 0 }))
    return entry
  }

  function peek(projectId: string, scope: UndoScope): Lists | undefined {
    return projects.get(projectId)?.get(scope)
  }

  // A user edit, undo or redo sets the count to 0; an agent's undo never does. An entry put
  // back after a failed replay names no actor and changes nothing.
  function count(l: Lists, actor: Actor | undefined, entry: 'undo' | 'redo') {
    if (actor === 'user') l.agentRun = 0
    else if (actor === 'agent' && entry === 'undo') l.agentRun++
  }

  return {
    record(
      projectId: string,
      scope: UndoScope,
      inverse: CommandCall,
      opts?: { fromRedo?: boolean; actor?: Actor },
    ) {
      const l = lists(projectId, scope)
      count(l, opts?.actor, 'undo')
      l.undo.push(inverse)
      if (l.undo.length > UNDO_LIMIT) l.undo.shift()
      if (!opts?.fromRedo) l.redo = []
    },
    recordRedo(projectId: string, scope: UndoScope, inverse: CommandCall, actor?: Actor) {
      const l = lists(projectId, scope)
      count(l, actor, 'redo')
      l.redo.push(inverse)
      if (l.redo.length > UNDO_LIMIT) l.redo.shift()
    },
    takeUndo(projectId: string, scope: UndoScope): CommandCall | undefined {
      return peek(projectId, scope)?.undo.pop()
    },
    takeRedo(projectId: string, scope: UndoScope): CommandCall | undefined {
      return peek(projectId, scope)?.redo.pop()
    },
    state(projectId: string, scope: UndoScope): UndoState {
      const l = peek(projectId, scope)
      return { canUndo: (l?.undo.length ?? 0) > 0, canRedo: (l?.redo.length ?? 0) > 0 }
    },
    agentRun(projectId: string, scope: UndoScope): number {
      return peek(projectId, scope)?.agentRun ?? 0
    },
    clear(projectId: string, scope: UndoScope) {
      projects.get(projectId)?.delete(scope)
    },
    dropProject(projectId: string) {
      projects.delete(projectId)
    },
  }
}

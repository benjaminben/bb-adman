// Undo and redo lists, one per variant and one per campaign (SPEC 4.2, R-17).
// An entry is the command that reverses an edit. Lists live in memory only and
// are dropped when the project closes (FR-006).
export const UNDO_LIMIT = 200

export type CommandCall = { name: string; input: unknown }
export type UndoScope = string // `variant:{id}` or `campaign:{id}`
export type UndoState = { canUndo: boolean; canRedo: boolean }

type Lists = { undo: CommandCall[]; redo: CommandCall[] }

export type UndoLists = ReturnType<typeof createUndoLists>

export function createUndoLists() {
  const projects = new Map<string, Map<UndoScope, Lists>>()

  function lists(projectId: string, scope: UndoScope): Lists {
    let byScope = projects.get(projectId)
    if (!byScope) projects.set(projectId, (byScope = new Map()))
    let entry = byScope.get(scope)
    if (!entry) byScope.set(scope, (entry = { undo: [], redo: [] }))
    return entry
  }

  function peek(projectId: string, scope: UndoScope): Lists | undefined {
    return projects.get(projectId)?.get(scope)
  }

  return {
    record(
      projectId: string,
      scope: UndoScope,
      inverse: CommandCall,
      opts?: { fromRedo: boolean },
    ) {
      const l = lists(projectId, scope)
      l.undo.push(inverse)
      if (l.undo.length > UNDO_LIMIT) l.undo.shift()
      if (!opts?.fromRedo) l.redo = []
    },
    recordRedo(projectId: string, scope: UndoScope, inverse: CommandCall) {
      const l = lists(projectId, scope)
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
    clear(projectId: string, scope: UndoScope) {
      projects.get(projectId)?.delete(scope)
    },
    dropProject(projectId: string) {
      projects.delete(projectId)
    },
    projectsWithScope(scope: UndoScope): string[] {
      return [...projects.entries()]
        .filter(([, byScope]) => {
          const l = byScope.get(scope)
          return l !== undefined && (l.undo.length > 0 || l.redo.length > 0)
        })
        .map(([projectId]) => projectId)
    },
  }
}

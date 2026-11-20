import { z } from 'zod'

// SPEC 4.2 history.undo / history.redo: scope is `variant:{id}` or `campaign:{id}`.
export const undoScopeSchema = z
  .string()
  .regex(/^(variant|campaign):.+$/, 'Scope must be variant:{id} or campaign:{id}')

export const historyInput = z.object({ scope: undoScopeSchema })
export type HistoryInput = z.infer<typeof historyInput>

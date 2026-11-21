import type { z } from 'zod'
import { historyInput, type UndoStateResult } from '@/shared/schemas/commands/history'

// SPEC 4.3 history.state: projectId and scope, the same input as history.undo.
export const historyStateInput = historyInput
export type HistoryStateInput = z.infer<typeof historyStateInput>

export type HistoryState = UndoStateResult

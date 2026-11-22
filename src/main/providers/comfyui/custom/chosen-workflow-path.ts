// The workflow file the system picker last gave (D-104, security rule 9), built like
// chosen-sheet-path.ts. comfyWorkflow.addFromFile reads only this path, so a window cannot
// name any other file. In memory only: one path, one use, forgotten after
// CHOSEN_WORKFLOW_TTL_MS or when a newer choice replaces it. The dialog (windows/dialogs.ts)
// sets it; this file holds no Electron code, so the core may read it.
import path from 'node:path'

export const CHOSEN_WORKFLOW_TTL_MS = 10 * 60 * 1000

let chosen: { path: string; at: number } | null = null

export function rememberWorkflowPath(filePath: string, now = Date.now()): void {
  chosen = { path: path.resolve(filePath), at: now }
}

// True, and forgotten, when filePath is the chosen path and still fresh. Another path leaves
// the choice as it is.
export function takeWorkflowPath(filePath: string, now = Date.now()): boolean {
  if (!chosen) return false
  if (now - chosen.at > CHOSEN_WORKFLOW_TTL_MS) {
    chosen = null
    return false
  }
  if (chosen.path !== path.resolve(filePath)) return false
  chosen = null
  return true
}

export function forgetWorkflowPath(): void {
  chosen = null
}

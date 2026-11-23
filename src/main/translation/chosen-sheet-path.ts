// The sheet path the save dialog last gave (P6-7b). translation.exportSheet writes only to it,
// so a window cannot name any other file. In memory only: one path, one use, forgotten after
// CHOSEN_PATH_TTL_MS or when a newer choice replaces it. The dialog (windows/dialogs.ts) sets
// it; this file holds no Electron code, so the core may read it.
import path from 'node:path'

export const CHOSEN_PATH_TTL_MS = 10 * 60 * 1000

let chosen: { path: string; at: number } | null = null

export function rememberSheetPath(filePath: string, now = Date.now()): void {
  chosen = { path: path.resolve(filePath), at: now }
}

// The chosen path, and forgotten, when filePath names it and it is still fresh; else null, and
// another path leaves the choice as it is. The caller writes only the path given back: the
// system follows a link before it applies "..", so the text it was sent may lead elsewhere.
export function takeSheetPath(filePath: string, now = Date.now()): string | null {
  if (!chosen) return null
  if (now - chosen.at > CHOSEN_PATH_TTL_MS) {
    chosen = null
    return null
  }
  if (chosen.path !== path.resolve(filePath)) return null
  const picked = chosen.path
  chosen = null
  return picked
}

export function forgetSheetPath(): void {
  chosen = null
}

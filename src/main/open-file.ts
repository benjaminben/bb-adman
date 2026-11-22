import path from 'node:path'
import { PROJECT_EXTENSION } from '@/shared/schemas/project'

// On Windows a double-clicked file arrives as a command-line argument (SPEC 7.5, R-06).
export function projectPathFromArgv(argv: string[]): string | null {
  const found = argv
    .slice(1)
    .find((a) => !a.startsWith('-') && a.toLowerCase().endsWith(PROJECT_EXTENSION))
  return found ?? null
}

// spec/phases/round-2-platform.md D9: the most a second launch may hand over at once.
export const MAX_HANDOFF_PATHS = 20

// A second launch's text is untrusted. A project path is absolute and ends in .adman. On
// Windows, two separators at the start name a network share or a device: opening one would
// send the user's sign-in to that server, so it is refused.
export function isHandoffPath(text: unknown, platform: NodeJS.Platform): text is string {
  if (typeof text !== 'string' || text.startsWith('-')) return false
  if (!text.toLowerCase().endsWith(PROJECT_EXTENSION)) return false
  if (platform !== 'win32') return path.posix.isAbsolute(text)
  return !/^[\\/]{2}/.test(text) && /^[A-Za-z]:[\\/]/.test(text)
}

// The paths in a second launch's additionalData: an object whose own `paths` is a list of at
// most 20 texts. Anything else gives []; an item that is not a project path is dropped.
export function handoffPaths(data: unknown, platform = process.platform): string[] {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return []
  if (!Object.hasOwn(data, 'paths')) return []
  const paths: unknown = (data as { paths: unknown }).paths
  if (!Array.isArray(paths) || paths.length > MAX_HANDOFF_PATHS) return []
  return paths.filter((p): p is string => isHandoffPath(p, platform))
}

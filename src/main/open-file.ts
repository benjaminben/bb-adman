import { PROJECT_EXTENSION } from '../shared/schemas/project'

// On Windows a double-clicked file arrives as a command-line argument (SPEC 7.5, R-06).
export function projectPathFromArgv(argv: string[]): string | null {
  const found = argv
    .slice(1)
    .find((a) => !a.startsWith('-') && a.toLowerCase().endsWith(PROJECT_EXTENSION))
  return found ?? null
}

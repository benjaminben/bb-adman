// spec/ai-jobs.md "Brief reading": which command reads a brief file, by its ending in any letter
// case. The window sends `structured` files to brief.parse and `text` files to brief.extract.
// Shared, so it reads the path as text: the file's name is what follows the last `/` or `\`,
// and a name that starts with its only dot (`.md`) has no ending, as node's extname reads it.
export type BriefFileKind = 'structured' | 'text'

const KINDS: Record<string, BriefFileKind> = {
  '.json': 'structured',
  '.yaml': 'structured',
  '.yml': 'structured',
  '.md': 'text',
  '.markdown': 'text',
  '.txt': 'text',
}

function endingOf(path: string): string {
  const name = path.slice(Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1)
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot).toLowerCase() : ''
}

export function briefFileKind(path: string): BriefFileKind | null {
  return KINDS[endingOf(path)] ?? null
}

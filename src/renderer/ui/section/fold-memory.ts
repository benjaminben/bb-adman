// Whether each Section is open, for the window's life only (choice C-8). Keyed by the Section's
// id ('{screen}.{section}'). Nothing is saved to disk or to the project.
const folds = new Map<string, boolean>()

export function readFold(id: string, fallback: boolean): boolean {
  return folds.get(id) ?? fallback
}

export function writeFold(id: string, open: boolean): void {
  folds.set(id, open)
}

// Override paths (spec/links-and-sync.md, "Overrides"; A-135). Pure: a patch, sizes and
// languages, never a database. A path is `copy`, `source`, `timing`, `geometry` (the whole
// group), `style.<field>` or `animation.<block>`.
import { isInherited, type RuleFacts } from './follow-rules'

const WHOLE = ['copy', 'source', 'timing', 'geometry'] as const
const BY_FIELD = ['style', 'animation'] as const

// The paths a patch names, in a fixed order. name, visible and locked are in no group and
// give none.
export function pathsOfPatch(patch: Readonly<Record<string, unknown>>): string[] {
  const paths: string[] = []
  for (const key of WHOLE) if (key in patch) paths.push(key)
  for (const key of BY_FIELD) {
    const value = patch[key]
    if (value && typeof value === 'object') {
      for (const field of Object.keys(value)) paths.push(`${key}.${field}`)
    }
  }
  return paths
}

// The paths whose group follows the master for this variant.
export function inheritedPaths(paths: string[], master: RuleFacts, variant: RuleFacts): string[] {
  return paths.filter((path) => isInherited(path, master, variant))
}

// The list with each new path added once, at the end, in first-added order.
export function addPaths(list: readonly string[], paths: readonly string[]): string[] {
  const next = [...list]
  for (const path of paths) if (!next.includes(path)) next.push(path)
  return next
}

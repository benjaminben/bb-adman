// Override paths (spec/links-and-sync.md, "Overrides"; A-135). Pure: a patch, sizes and
// languages, never a database. A path is `copy`, `source`, `timing`, `geometry` (the whole
// group), `style.<field>` or `animation.<block>`.
import { pictureLookOf, textLookOf } from '@/shared/config/look'
import type { ImageStyle, TextStyle } from '@/shared/schemas/layer'
import type { LayerRow } from '@/shared/schemas/rows/layer'
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

export type MasterLayer = Pick<
  LayerRow,
  'type' | 'copy' | 'source' | 'timing' | 'geometry' | 'style' | 'animation'
>

// The master's current value for each path, as a layer patch: the whole group for copy,
// source, timing and geometry, one field for style.* (its look default when the master lacks
// the field), one block for animation.*.
export function masterPatchOf(master: MasterLayer, paths: readonly string[]) {
  const patch: Record<string, unknown> = {}
  const style: Record<string, unknown> = {}
  const animation: Record<string, unknown> = {}
  const look: Record<string, unknown> =
    master.type === 'text'
      ? textLookOf(master.style as TextStyle)
      : pictureLookOf(master.style as ImageStyle)
  const blocks: Record<string, unknown> = master.animation
  for (const path of paths) {
    const [head, field = ''] = path.split('.')
    if (head === 'style') style[field] = look[field]
    else if (head === 'animation') animation[field] = blocks[field]
    else if (head === 'copy' || head === 'source' || head === 'timing' || head === 'geometry') {
      patch[head] = master[head]
    }
  }
  if (Object.keys(style).length > 0) patch.style = style
  if (Object.keys(animation).length > 0) patch.animation = animation
  return patch
}

// The list with each new path added once, at the end, in first-added order.
export function addPaths(list: readonly string[], paths: readonly string[]): string[] {
  const next = [...list]
  for (const path of paths) if (!next.includes(path)) next.push(path)
  return next
}

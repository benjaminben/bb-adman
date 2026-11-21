// The follow rules (spec/links-and-sync.md, "Follow rules"; spec/data-rules.md, "Links, follow
// rules and sync" [FR-079, D-013]). Pure: plain sizes and languages, never a database.
import type { Revs } from '@/shared/schemas/layer'

export type Group = keyof Revs
export const GROUPS: readonly Group[] = [
  'copy',
  'style',
  'geometry',
  'source',
  'timing',
  'animation',
]

export type FollowWord = 'follows' | 'translation' | 'none'

// A variant's facts for a rule.
export type RuleFacts = { width: number; height: number; language: string }

// Geometry follows only at the same pixel size; there is no ratio rule. Copy in another
// language is a translation. Format never changes a rule.
export function followRule(group: Group, master: RuleFacts, variant: RuleFacts): FollowWord {
  if (group === 'geometry') {
    return master.width === variant.width && master.height === variant.height ? 'follows' : 'none'
  }
  if (group === 'copy') return master.language === variant.language ? 'follows' : 'translation'
  return 'follows'
}

// The group a property path belongs to (`copy`, `geometry`, `style.color`, `animation.exit`),
// or null for a path in no group (`name`, `visible`, `locked`).
export function groupOfPath(path: string): Group | null {
  const head = path.split('.')[0]
  return GROUPS.find((g) => g === head) ?? null
}

// A path is inherited when its group's rule is `follows` for this variant.
export function isInherited(path: string, master: RuleFacts, variant: RuleFacts): boolean {
  const group = groupOfPath(path)
  return group !== null && followRule(group, master, variant) === 'follows'
}

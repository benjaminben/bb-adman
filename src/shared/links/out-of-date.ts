// Out of date (spec/links-and-sync.md, "Follow rules"; spec/data-rules.md [FR-081]). Computed
// on read, never stored. Pure: plain rows, never a database.
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { GROUPS, followRule, type FollowWord, type Group, type RuleFacts } from './follow-rules'

export type LinkLayer = Pick<LayerRow, 'key' | 'linked' | 'revs' | 'syncedRevs'>
export type LinkVariant = { row: RuleFacts & { id: string }; layers: LinkLayer[] }

// The groups a linked layer is stale on: the rule follows (or is a translation) and the
// master's counter is ahead of what the layer last synced. A layer made on the variant itself
// (`linked` false) is never stale.
export function staleGroups(
  masterLayer: Pick<LinkLayer, 'revs'>,
  layer: LinkLayer,
  rule: (group: Group) => FollowWord,
): Group[] {
  if (!layer.linked) return []
  return GROUPS.filter((g) => rule(g) !== 'none' && masterLayer.revs[g] > layer.syncedRevs[g])
}

// A variant is out of date when a linked layer is stale on any group, the master has a layer
// key the variant lacks, or a linked layer's key is gone from the master. A master never is.
export function variantOutOfDate(input: { master: LinkVariant; variant: LinkVariant }): boolean {
  const { master, variant } = input
  if (master.row.id === variant.row.id) return false
  const byKey = new Map(master.layers.map((l) => [l.key, l]))
  const keys = new Set(variant.layers.map((l) => l.key))
  if (master.layers.some((l) => !keys.has(l.key))) return true
  const rule = (g: Group) => followRule(g, master.row, variant.row)
  return variant.layers.some((l) => {
    if (!l.linked) return false
    const from = byKey.get(l.key)
    return !from || staleGroups(from, l, rule).length > 0
  })
}

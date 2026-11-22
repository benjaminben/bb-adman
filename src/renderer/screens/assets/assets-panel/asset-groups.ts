// R2C-5 (spec/phases/round-2-campaign.md, design addition 5): the panel's groups. Pictures,
// Clips and Fonts are always drawn, with their empty line; "Other files" (sound and text) only
// when it holds something. Inside a group: display name (case and accents ignored), then ID.
import type { AssetView } from './asset-view'

export type AssetGroup = {
  key: string
  title: string
  items: AssetView[]
  empty: string | null
}

const GROUPS: Array<{ key: string; title: string; kinds: AssetView['kind'][]; empty: string | null }> =
  [
    { key: 'pictures', title: 'Pictures', kinds: ['image'], empty: 'No pictures yet.' },
    { key: 'clips', title: 'Clips', kinds: ['video'], empty: 'No clips yet.' },
    { key: 'fonts', title: 'Fonts', kinds: ['font'], empty: 'No fonts yet.' },
    { key: 'other', title: 'Other files', kinds: ['audio', 'text'], empty: null },
  ]

function byName(a: AssetView, b: AssetView): number {
  const named = a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' })
  if (named !== 0) return named
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

export function assetGroups(assets: AssetView[]): AssetGroup[] {
  return GROUPS.map((group) => ({
    key: group.key,
    title: group.title,
    items: assets.filter((a) => group.kinds.includes(a.kind)).sort(byName),
    empty: group.empty,
  })).filter((group) => group.empty !== null || group.items.length > 0)
}

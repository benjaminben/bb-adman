// R2C-5 (spec/phases/round-2-campaign.md, design addition 5): the panel's groups. Pictures,
// Clips and Fonts are always drawn, with their empty line; "Other files" (sound and text) only
// when it holds something. Inside a group: display name (case and accents ignored), then ID.
// R2C-6: the subjects by name, and each subject's photos (its pictures, in the same order).
import type { SubjectRow } from '@/shared/schemas/rows/subject'
import type { AssetView } from './asset-view'

export type AssetGroup = {
  key: string
  title: string
  items: AssetView[]
  empty: string | null
}

const GROUPS: Array<{
  key: string
  title: string
  kinds: AssetView['kind'][]
  empty: string | null
}> = [
  { key: 'pictures', title: 'Pictures', kinds: ['image'], empty: 'No pictures yet.' },
  { key: 'clips', title: 'Clips', kinds: ['video'], empty: 'No clips yet.' },
  { key: 'fonts', title: 'Fonts', kinds: ['font'], empty: 'No fonts yet.' },
  { key: 'other', title: 'Other files', kinds: ['audio', 'text'], empty: null },
]

function byName(a: AssetView, b: AssetView): number {
  return byText(a.displayName, b.displayName, a.id, b.id)
}

function byText(a: string, b: string, aId: string, bId: string): number {
  const named = a.localeCompare(b, undefined, { sensitivity: 'base' })
  if (named !== 0) return named
  return aId < bId ? -1 : aId > bId ? 1 : 0
}

export function assetGroups(assets: AssetView[]): AssetGroup[] {
  return GROUPS.map((group) => ({
    key: group.key,
    title: group.title,
    items: assets.filter((a) => group.kinds.includes(a.kind)).sort(byName),
    empty: group.empty,
  })).filter((group) => group.empty !== null || group.items.length > 0)
}

export function subjectsByName(subjects: SubjectRow[]): SubjectRow[] {
  return [...subjects].sort((a, b) => byText(a.name, b.name, a.id, b.id))
}

export function subjectPhotos(assets: AssetView[], subjectId: string): AssetView[] {
  return assets.filter((a) => a.kind === 'image' && a.subjectId === subjectId).sort(byName)
}

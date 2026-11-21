// spec/screens-variants.md, "Sync review": the words for a change's groups and for a blocked
// override path. Pure.
import type { SyncGroup } from '@/shared/schemas/queries/sync'

const GROUP_WORDS: Record<SyncGroup, string> = {
  copy: 'text',
  style: 'style',
  geometry: 'position and size',
  source: 'picture',
  timing: 'timing',
  animation: 'animation',
}

// The fields of TextStyle, ImageStyle and Animation that an override path can name.
const FIELD_WORDS: Record<string, string> = {
  fontAssetId: 'font',
  fontSize: 'font size',
  fontWeight: 'weight',
  color: 'colour',
  align: 'alignment',
  lineHeight: 'line height',
  letterSpacing: 'letter spacing',
  verticalAlign: 'vertical alignment',
  allCaps: 'all caps',
  boxColor: 'box colour',
  boxOutlineColor: 'outline colour',
  boxOutlineWidth: 'outline width',
  boxRadius: 'corner radius',
  boxPadding: 'box padding',
  opacity: 'opacity',
  fillColor: 'fill colour',
  shade: 'shade',
  entrance: 'entrance',
  exit: 'exit',
}

const isGroup = (word: string): word is SyncGroup => word in GROUP_WORDS

// A field this table does not know yet reads as its name split into lower-case words.
const fieldWords = (field: string) =>
  FIELD_WORDS[field] ?? field.replace(/([A-Z])/g, ' $1').toLowerCase()

export function groupWords(groups: readonly SyncGroup[]): string {
  return groups.map((g) => GROUP_WORDS[g]).join(', ')
}

export function pathWords(path: string): string {
  const dot = path.indexOf('.')
  const group = dot === -1 ? path : path.slice(0, dot)
  const head = isGroup(group) ? GROUP_WORDS[group] : group
  return dot === -1 ? head : `${head}: ${fieldWords(path.slice(dot + 1))}`
}

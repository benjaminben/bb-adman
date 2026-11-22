// spec/editor.md, "Layer list": a row's marks, "Empty", "Does not fit", "File not found", and
// "Stays at the bottom" for the background. ED-1a: each is an icon StatusMark with no label; the
// words are its tip (and its visually hidden copy), and they end the row's accessible name.
import type { LayerRow as Layer } from '@/shared/schemas/rows/layer'
import type { IconName } from '@/renderer/ui/icon'
import { StatusMark, type StatusTone } from '@/renderer/ui/status-mark'
import type { RowAsset } from './layer-row'

export type RowMark = 'Empty' | 'Does not fit' | 'File not found' | 'Stays at the bottom'

const LOOK: Record<RowMark, { tone: StatusTone; icon: IconName }> = {
  Empty: { tone: 'none', icon: 'image' },
  'Does not fit': { tone: 'warn', icon: 'alert' },
  'File not found': { tone: 'danger', icon: 'xCircle' },
  'Stays at the bottom': { tone: 'none', icon: 'pin' },
}

function named(layer: Layer): string[] {
  const font = 'fontAssetId' in layer.style ? layer.style.fontAssetId : null
  return [layer.source?.assetId, font].filter((id): id is string => typeof id === 'string')
}

export function rowMarks(layer: Layer, assets: Readonly<Record<string, RowAsset>>): RowMark[] {
  const marks: RowMark[] = []
  if (layer.type === 'image' && layer.source === null) marks.push('Empty')
  if (layer.type === 'text' && layer.overflow) marks.push('Does not fit')
  if (named(layer).some((id) => assets[id]?.missing)) marks.push('File not found')
  if (layer.type === 'background') marks.push('Stays at the bottom')
  return marks
}

export function RowMarks(props: { marks: RowMark[] }) {
  return props.marks.map((mark) => <StatusMark key={mark} tip={mark} {...LOOK[mark]} />)
}

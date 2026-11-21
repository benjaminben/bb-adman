// spec/editor.md, "Layer list": one row. A small whole picture of an image or background layer
// (or a text mark), the name, and the marks: "Empty", "Does not fit", "File not found", and
// "Stays at the bottom" for the background. Clicking the row selects its layer. The hide and
// lock buttons, rename and drag come with P3-12.
import type { LayerRow as Layer } from '@/shared/schemas/rows/layer'
import { assetUrl } from '@/renderer/ui/asset-url'
import styles from './layer-row.module.css'

export type RowAsset = { missing: boolean; kind: string; version: number }

export type LayerRowProps = {
  projectId: string
  layer: Layer
  assets: Readonly<Record<string, RowAsset>>
  selected: boolean
  onSelect: (layerId: string) => void
}

function named(layer: Layer): string[] {
  const font = 'fontAssetId' in layer.style ? layer.style.fontAssetId : null
  return [layer.source?.assetId, font].filter((id): id is string => typeof id === 'string')
}

export function rowMarks(layer: Layer, assets: LayerRowProps['assets']): string[] {
  const marks: string[] = []
  if (layer.type === 'image' && layer.source === null) marks.push('Empty')
  if (layer.type === 'text' && layer.overflow) marks.push('Does not fit')
  if (named(layer).some((id) => assets[id]?.missing)) marks.push('File not found')
  if (layer.type === 'background') marks.push('Stays at the bottom')
  return marks
}

function Thumb(props: Pick<LayerRowProps, 'projectId' | 'layer' | 'assets'>) {
  const { layer } = props
  if (layer.type === 'text') {
    return (
      <span className={`${styles.thumb} ${styles.textMark}`} aria-hidden="true">
        T
      </span>
    )
  }
  const id = layer.source?.assetId
  const asset = id ? props.assets[id] : undefined
  if (!id || !asset || asset.missing || asset.kind !== 'image') {
    return <span className={styles.thumb} aria-hidden="true" />
  }
  return (
    <img
      key={asset.version}
      className={styles.thumb}
      src={assetUrl(props.projectId, id)}
      alt=""
      draggable={false}
    />
  )
}

export function LayerRow(props: LayerRowProps) {
  const { layer } = props
  return (
    <button
      type="button"
      data-layer-row={layer.id}
      className={props.selected ? `${styles.row} ${styles.selected}` : styles.row}
      aria-pressed={props.selected}
      onClick={() => props.onSelect(layer.id)}
    >
      <Thumb projectId={props.projectId} layer={layer} assets={props.assets} />
      <span className={styles.name}>{layer.name}</span>
      {rowMarks(layer, props.assets).map((mark) => (
        <span key={mark} className={styles.mark}>
          {' '}
          {mark}
        </span>
      ))}
    </button>
  )
}

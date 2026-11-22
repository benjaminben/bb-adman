// spec/editor.md, "Layer list": the row's small picture. An image or background layer shows its
// whole picture (from assetUrl, 32 px); a text layer shows a "T" mark; no picture, an empty box.
import type { LayerRow as Layer } from '@/shared/schemas/rows/layer'
import { assetUrl } from '@/renderer/ui/asset-url'
import type { RowAsset } from './layer-row'
import styles from './layer-row.module.css'

type ThumbProps = {
  projectId: string
  layer: Layer
  assets: Readonly<Record<string, RowAsset>>
}

export function Thumb(props: ThumbProps) {
  const { layer } = props
  if (layer.type === 'text') {
    return (
      <span className={`${styles.picture} ${styles.textMark}`} aria-hidden="true">
        T
      </span>
    )
  }
  const id = layer.source?.assetId
  const asset = id ? props.assets[id] : undefined
  if (!id || !asset || asset.missing || asset.kind !== 'image') {
    return <span className={styles.picture} aria-hidden="true" />
  }
  return (
    <img
      key={asset.version}
      className={styles.picture}
      src={assetUrl(props.projectId, id)}
      alt=""
      draggable={false}
    />
  )
}

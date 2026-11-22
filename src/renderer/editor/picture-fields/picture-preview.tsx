// ED-3: the layer's picture at the panel's full width, kept whole, with its display name in the
// title (never a path). A missing file draws no picture and keeps "file not found" on the page;
// a picture the project does not list says so. While a cut-out runs, a turning ring sits over
// it. The loaded picture's own size is handed up: a WebP row has no width or height.
import type { ReactNode } from 'react'
import { assetUrl } from '@/renderer/ui/asset-url'
import { Icon } from '@/renderer/ui/icon'
import type { Size } from './background-fit'
import styles from './picture-fields.module.css'

export type PictureAsset = {
  displayName: string
  kind: string
  missing: boolean
  width: number | null
  height: number | null
  version: number // goes up when the file changed on disk, so the picture is loaded again
}

export type PicturePreviewProps = {
  projectId: string
  assetId: string
  asset: PictureAsset | null
  running: boolean
  onSize: (size: Size) => void
  // The icon bar, drawn on the picture's lower edge.
  children: ReactNode
}

export function PicturePreview(props: PicturePreviewProps) {
  const { asset, assetId } = props
  const drawn = asset !== null && !asset.missing && asset.kind === 'image'
  return (
    <div className={styles.preview}>
      <div className={styles.frame} title={asset?.displayName}>
        {drawn ? (
          <img
            key={asset.version}
            className={styles.picture}
            src={assetUrl(props.projectId, assetId)}
            alt=""
            draggable={false}
            onLoad={(event) => {
              const { naturalWidth: width, naturalHeight: height } = event.currentTarget
              if (width > 0 && height > 0) props.onSize({ width, height })
            }}
          />
        ) : (
          <span className={styles.muted}>
            {asset ? (asset.missing ? 'file not found' : '') : 'Picture not in the project'}
          </span>
        )}
        {props.running && (
          <span className={styles.ring} data-cut-out-ring="">
            <Icon name="spinner" />
          </span>
        )}
      </div>
      {props.children}
    </div>
  )
}

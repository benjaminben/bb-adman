// spec/editor.md, "Properties panel", Picture: the picture small and whole, with its display
// name as text, or "Empty picture". A missing file draws no picture and says "file not found".
// The loaded picture's own size is handed up: a WebP row has no width or height.
import { assetUrl } from '@/renderer/ui/asset-url'
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
  assetId: string | null
  asset: PictureAsset | null
  onSize: (size: Size) => void
}

export function PicturePreview(props: PicturePreviewProps) {
  const { asset, assetId } = props
  if (assetId === null) {
    return (
      <div className={styles.preview}>
        <span className={styles.picture} aria-hidden="true" />
        <span className={styles.muted}>Empty picture</span>
      </div>
    )
  }
  const drawn = asset !== null && !asset.missing && asset.kind === 'image'
  return (
    <div className={styles.preview}>
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
        <span className={styles.picture} aria-hidden="true" />
      )}
      <span className={styles.name}>
        {asset ? asset.displayName : 'Picture not in the project'}
        {asset?.missing && (
          <>
            {' '}
            <span className={styles.muted}>file not found</span>
          </>
        )}
      </span>
    </div>
  )
}

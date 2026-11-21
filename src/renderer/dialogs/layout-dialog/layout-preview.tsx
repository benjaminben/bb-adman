// spec/editor.md "Layout…" (LK-6): a small preview of the open variant with one layout's
// updates merged in. The Scene in full mode at variant pixels, scaled from its top-left corner
// to fit the --thumbnail-tile square, as the canvas mounts it. Decorative: the choice's name
// and description say what it is.
import type { SceneAsset, SceneVariant } from '@/shared/scene/types'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { Scene } from '@/shared/scene/scene'
import styles from './layout-dialog.module.css'

// The --thumbnail-tile token, in pixels: the Scene's scale is worked out here.
const PREVIEW_SIDE = 160

export type LayoutPreviewProps = {
  variant: SceneVariant
  layers: LayerRow[]
  assets: Readonly<Record<string, SceneAsset>>
}

export function LayoutPreview({ variant, layers, assets }: LayoutPreviewProps) {
  const scale = PREVIEW_SIDE / Math.max(variant.width, variant.height, 1)
  return (
    <div className={styles.preview} aria-hidden="true" data-layout-preview>
      <div
        className={styles.frame}
        style={{ width: variant.width * scale, height: variant.height * scale }}
      >
        <div className={styles.stage} style={{ transform: `scale(${scale})` }}>
          <Scene variant={variant} layers={layers} assets={assets} timeMs={0} mode="full" />
        </div>
      </div>
    </div>
  )
}

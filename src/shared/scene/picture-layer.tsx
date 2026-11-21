import { useState, type CSSProperties } from 'react'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { SceneAsset } from '@/shared/scene/types'
import { placePicture, type Size } from '@/shared/scene/background-placement'

// spec/scene.md "Pictures": a background or image layer. The box and the <img> have no
// background colour, so a transparent picture shows the layers beneath it [FR-245].
type Props = { layer: LayerRow; box: CSSProperties; asset: SceneAsset | null }

export function PictureLayer({ layer, box, asset }: Props) {
  const opacity = 'opacity' in layer.style ? layer.style.opacity : 1
  const { width, height, crop } = layer.geometry
  return (
    <div data-layer-id={layer.id} style={{ ...box, overflow: 'hidden', opacity }}>
      {asset && (
        <Picture
          key={`${asset.url}#${asset.version}`}
          url={asset.url}
          crop={crop}
          box={{ width, height }}
          fit={layer.type === 'background' ? 'cover' : 'contain'}
        />
      )}
    </div>
  )
}

type PictureProps = {
  url: string
  crop: LayerRow['geometry']['crop']
  box: Size
  fit: 'cover' | 'contain'
}

// Hidden until the loaded picture's own size is known; nothing at all if it fails to load.
function Picture({ url, crop, box, fit }: PictureProps) {
  const [natural, setNatural] = useState<Size | null>(null)
  const [failed, setFailed] = useState(false)
  if (failed) return null
  const place = natural && placePicture(natural, crop, box, fit)
  const style: CSSProperties = place
    ? {
        position: 'absolute',
        left: place.x,
        top: place.y,
        width: place.width,
        height: place.height,
      }
    : { position: 'absolute', visibility: 'hidden' }
  return (
    <img
      alt=""
      src={url}
      draggable={false}
      style={style}
      onLoad={(event) => {
        const img = event.currentTarget
        setNatural({ width: img.naturalWidth, height: img.naturalHeight })
      }}
      onError={() => setFailed(true)}
    />
  )
}

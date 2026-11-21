// spec/editor.md, "Crop mode" [FR-077, FR-094]: the whole picture at its current place, dimmed
// outside the crop, and the crop as a rectangle with eight handles, all in the layer's own
// turned frame. Dragging inside moves the crop; handles resize it. The crop keeps the box's
// shape and stays inside the picture. The picture's own size is the loaded picture's natural
// size. Enter hands the crop in source pixels to onDone; "Done" and "Cancel" are in CropBar.
// The keyboard path, while the crop has focus: the arrows move it by one box pixel; Shift with
// Right or Up makes it larger and Shift with Left or Down smaller, by ten box pixels of width.
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { placePicture, type Placement, type Size } from '@/shared/scene/background-placement'
import { HANDLES } from '@/renderer/editor/geometry-math'
import { platform } from '@/renderer/editor/use-editor-key'
import { matchShortcut, type ShortcutName } from '@/renderer/ui/shortcuts'
import { growCrop, moveCrop, startCrop, toBoxPixels, type Rect } from './crop-math'
import { useCropDrag } from './use-crop-drag'
import styles from './crop-overlay.module.css'

export type CropOverlayProps = {
  layer: LayerRow
  // The picture's address on the asset scheme.
  url: string
  scale: number
  // The crop being made, in source pixels; null until the picture has loaded.
  crop: Rect | null
  // The ID of the hint that says how to use the keys.
  hintId: string
  onChange: (crop: Rect) => void
  onDone: () => void
}

const STEP_PX = 1
const GROW_PX = 10

// Arrow presses on the crop, in box pixels: a move, or a change of width.
const MOVES: [ShortcutName, number, number][] = [
  ['nudgeLeft', -STEP_PX, 0],
  ['nudgeRight', STEP_PX, 0],
  ['nudgeUp', 0, -STEP_PX],
  ['nudgeDown', 0, STEP_PX],
]
const GROWS: [ShortcutName, number][] = [
  ['nudgeRightFar', GROW_PX],
  ['nudgeUpFar', GROW_PX],
  ['nudgeLeftFar', -GROW_PX],
  ['nudgeDownFar', -GROW_PX],
]
// Layer shortcuts that must not act on the layer while it is cropped.
const BLOCKED: ShortcutName[] = ['deleteLayer', 'duplicate', 'bringForward', 'sendBackward']

const scaled = (r: Rect, s: number): CSSProperties => ({
  left: r.x * s,
  top: r.y * s,
  width: r.width * s,
  height: r.height * s,
})

export function CropOverlay(props: CropOverlayProps) {
  const { layer, scale, crop, onChange: setCrop, onDone } = props
  const { width, height, rotation } = layer.geometry
  const box = { width, height }
  const aspect = width / height
  const [source, setSource] = useState<Size | null>(null)
  const cropRef = useRef<HTMLDivElement>(null)
  const fit = layer.type === 'background' ? 'cover' : 'contain'
  // Where the picture sits now; it stays there while the crop moves over it.
  const place: Placement | null = source && placePicture(source, layer.geometry.crop, box, fit)
  const unit = place && source ? (place.width / source.width) * scale : 1
  const press = useCropDrag({ crop, source, aspect, rotation, unit, onChange: setCrop })
  const ready = crop !== null

  useEffect(() => {
    if (ready) cropRef.current?.focus()
  }, [ready])

  function loaded(natural: Size) {
    setSource(natural)
    setCrop(startCrop(natural, layer.geometry.crop, box))
  }

  function onKeyDown(event: KeyboardEvent) {
    if (!crop || !source || !place) return
    const k = place.width / source.width
    const is = (name: ShortcutName) => matchShortcut(event, name, platform)
    const move = MOVES.find(([name]) => is(name))
    const grow = GROWS.find(([name]) => is(name))
    if (move) setCrop(moveCrop(crop, { x: move[1] / k, y: move[2] / k }, source))
    else if (grow) setCrop(growCrop(crop, grow[1] / k, source, aspect))
    else if (is('applyCrop')) onDone()
    else if (!BLOCKED.some(is)) return
    event.preventDefault()
  }

  const shown = crop && place && source ? toBoxPixels(crop, place, source) : null
  const frame: CSSProperties = {
    ...scaled({ x: layer.geometry.x, y: layer.geometry.y, width, height }, scale),
    transform: `rotate(${rotation}deg)`,
  }
  return (
    <div className={styles.overlay} data-crop-mode={layer.id}>
      <div className={styles.frame} style={frame} data-crop-frame>
        <img
          alt=""
          src={props.url}
          draggable={false}
          data-crop-picture
          className={styles.picture}
          style={place ? scaled(place, scale) : { visibility: 'hidden' }}
          onLoad={({ currentTarget: img }) =>
            loaded({ width: img.naturalWidth, height: img.naturalHeight })
          }
        />
        {place && shown && crop && (
          <>
            <div className={styles.dim} style={scaled(place, scale)}>
              <div
                className={styles.hole}
                style={scaled({ ...shown, x: shown.x - place.x, y: shown.y - place.y }, scale)}
              />
            </div>
            <div
              ref={cropRef}
              role="group"
              aria-label={`Crop, ${layer.name}`}
              aria-describedby={props.hintId}
              tabIndex={0}
              className={styles.crop}
              style={scaled(shown, scale)}
              onPointerDown={(event) => press('move', event)}
              onKeyDown={onKeyDown}
            >
              {HANDLES.map((handle) => (
                <span
                  key={handle}
                  aria-hidden="true"
                  className={styles.handle}
                  data-crop-handle={handle}
                  onPointerDown={(event) => press(handle, event)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

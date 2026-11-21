// spec/editor.md, "Canvas", the overlay: over the Scene at the same scale, drawn in screen
// pixels whatever the zoom. The selected layer's box turned with it, with eight resize handles
// and a rotation handle (none for a locked layer, and a dotted box with none for a hidden one);
// a dashed "Empty picture" box for each picture layer with no picture; a dashed danger box for
// each overflowing text layer; the snapping guides during a drag.
import type { CSSProperties, PointerEvent } from 'react'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { HANDLES } from '@/renderer/editor/geometry-math'
import type { Guides } from '@/renderer/editor/snap'
import type { Grip } from './use-canvas-drag'
import styles from './canvas-overlay.module.css'

export type CanvasOverlayProps = {
  layers: LayerRow[]
  selected: LayerRow | null
  scale: number
  guides: Guides
  onGrip: (layer: LayerRow, grip: Grip, event: PointerEvent) => void
}

function placed(layer: LayerRow, scale: number): CSSProperties {
  const { x, y, width, height, rotation } = layer.geometry
  return {
    left: x * scale,
    top: y * scale,
    width: width * scale,
    height: height * scale,
    transform: `rotate(${rotation}deg)`,
  }
}

function Selection({
  layer,
  scale,
  onGrip,
}: Omit<CanvasOverlayProps, 'layers' | 'selected' | 'guides'> & { layer: LayerRow }) {
  const grips = layer.visible && !layer.locked
  const className = layer.visible ? styles.selection : `${styles.selection} ${styles.hidden}`
  return (
    <div
      className={className}
      style={placed(layer, scale)}
      data-selection={layer.id}
      onClick={(event) => event.stopPropagation()}
    >
      {grips && (
        <>
          {HANDLES.map((handle) => (
            <span
              key={handle}
              className={styles.handle}
              data-handle={handle}
              onPointerDown={(event) => onGrip(layer, handle, event)}
            />
          ))}
          <span
            className={styles.rotate}
            data-handle="rotate"
            onPointerDown={(event) => onGrip(layer, 'rotate', event)}
          />
        </>
      )}
    </div>
  )
}

export function CanvasOverlay({ layers, selected, scale, guides, onGrip }: CanvasOverlayProps) {
  const shown = layers.filter((l) => l.visible)
  const empty = shown.filter((l) => l.type === 'image' && l.source === null)
  const overflowing = shown.filter((l) => l.type === 'text' && l.overflow)
  return (
    // Pointer only, and only on the handles: every canvas action has a keyboard path.
    <div className={styles.overlay} aria-hidden="true">
      {empty.map((l) => (
        <div key={l.id} className={styles.empty} style={placed(l, scale)} data-empty={l.id}>
          <span>Empty picture</span>
        </div>
      ))}
      {overflowing.map((l) => (
        <div key={l.id} className={styles.overflow} style={placed(l, scale)} data-overflow={l.id} />
      ))}
      {selected && <Selection layer={selected} scale={scale} onGrip={onGrip} />}
      {guides.x !== null && (
        <div className={styles.guideX} style={{ left: guides.x * scale }} data-guide="x" />
      )}
      {guides.y !== null && (
        <div className={styles.guideY} style={{ top: guides.y * scale }} data-guide="y" />
      )}
    </div>
  )
}

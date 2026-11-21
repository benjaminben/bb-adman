// spec/editor.md, "Canvas": the Scene in full mode at variant pixels, scaled by the zoom from
// its top-left corner inside a box of the scaled size, centred in the backdrop when smaller and
// scrolled when larger. The bar at the foot shows the size and the zoom. A click picks a layer;
// a click on the backdrop, or Escape, clears the selection. Until P3-11's overlay, the selected
// layer is outlined here (no handles), in screen pixels whatever the zoom.
import { useRef, type CSSProperties, type MouseEvent } from 'react'
import type { VariantSummary } from '@/shared/schemas/queries/campaign'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { SceneAsset, SceneSettled } from '@/shared/scene/types'
import { Scene } from '@/shared/scene/scene'
import { useEditorKey } from '@/renderer/editor/use-editor-key'
import { fitScale, scaleOf, zoomIn, zoomLabel, zoomOut, type Zoom } from '@/renderer/editor/zoom'
import { pickLayer } from '@/renderer/editor/geometry-math'
import { useAreaSize } from './use-area-size'
import styles from './canvas-view.module.css'

export type CanvasViewProps = {
  variant: VariantSummary
  layers: LayerRow[]
  assets: Readonly<Record<string, SceneAsset>>
  zoom: Zoom
  onZoom: (zoom: Zoom) => void
  selectedId: string | null
  onSelect: (layerId: string | null) => void
  onSettled: (result: SceneSettled) => void
}

function outline(layer: LayerRow, scale: number): CSSProperties {
  const { x, y, width, height, rotation } = layer.geometry
  return {
    left: x * scale,
    top: y * scale,
    width: width * scale,
    height: height * scale,
    transform: `rotate(${rotation}deg)`,
  }
}

export function CanvasView(props: CanvasViewProps) {
  const { variant, layers, zoom, onZoom, onSelect } = props
  const area = useRef<HTMLDivElement>(null)
  const fit = fitScale(variant, useAreaSize(area))
  const scale = scaleOf(zoom, fit)
  const selected = layers.find((l) => l.id === props.selectedId)

  useEditorKey('zoomIn', () => onZoom(zoomIn(zoom, fit)))
  useEditorKey('zoomOut', () => onZoom(zoomOut(zoom, fit)))
  useEditorKey('zoomToFit', () => onZoom('fit'))
  useEditorKey('escape', () => onSelect(null))

  function pick(event: MouseEvent<HTMLDivElement>) {
    event.stopPropagation()
    const rect = event.currentTarget.getBoundingClientRect()
    const point = { x: (event.clientX - rect.left) / scale, y: (event.clientY - rect.top) / scale }
    onSelect(pickLayer(layers, point))
  }

  return (
    <section className={styles.canvas} aria-label={`Canvas, ${variant.title}`} tabIndex={0}>
      {/* Pointer only: every canvas action has a keyboard path in the list and the panel. */}
      <div ref={area} className={styles.area} data-backdrop onClick={() => onSelect(null)}>
        <div
          className={styles.box}
          style={{ width: variant.width * scale, height: variant.height * scale }}
        >
          <div
            data-stage
            className={styles.stage}
            style={{ transform: `scale(${scale})` }}
            onClick={pick}
          >
            <Scene
              variant={variant}
              layers={layers}
              assets={props.assets}
              timeMs={0}
              mode="full"
              onSettled={props.onSettled}
            />
          </div>
          {selected && (
            <div
              className={
                selected.visible ? styles.selection : `${styles.selection} ${styles.hidden}`
              }
              style={outline(selected, scale)}
            />
          )}
        </div>
      </div>
      <div className={styles.bar}>
        <span>
          {variant.width} × {variant.height} px
        </span>
        <div className={styles.zoom}>
          <button type="button" onClick={() => onZoom(zoomOut(zoom, fit))}>
            Zoom out
          </button>
          <button type="button" title="Zoom to fit" onClick={() => onZoom('fit')}>
            {zoomLabel(zoom)}
          </button>
          <button type="button" onClick={() => onZoom(zoomIn(zoom, fit))}>
            Zoom in
          </button>
        </div>
      </div>
    </section>
  )
}

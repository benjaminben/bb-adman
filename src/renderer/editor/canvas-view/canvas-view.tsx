// spec/editor.md, "Canvas": the Scene in full mode at variant pixels, scaled by the zoom from
// its top-left corner inside a box of the scaled size, centred in the backdrop when smaller and
// scrolled when larger. The bar at the foot shows the size and the zoom. A click picks a layer;
// a click on the backdrop, or Escape, clears the selection. The overlay over the Scene draws the
// selection and handles the drags; Escape during a drag cancels it instead. In crop mode the
// crop overlay takes the layer's place, the normal overlay leaves it alone, and Escape leaves
// crop mode.
import { useRef, type MouseEvent } from 'react'
import type { VariantSummary } from '@/shared/schemas/queries/campaign'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { SceneAsset, SceneSettled } from '@/shared/scene/types'
import { Scene } from '@/shared/scene/scene'
import { useApp } from '@/renderer/app/app-context'
import { CanvasOverlay, useCanvasDrag, useLayerKeys } from '@/renderer/editor/canvas-overlay'
import { CropOverlay, useCropMode } from '@/renderer/editor/crop-overlay'
import { useEditorKey } from '@/renderer/editor/use-editor-key'
import { fitScale, scaleOf, zoomIn, zoomLabel, zoomOut, type Zoom } from '@/renderer/editor/zoom'
import { pickLayer } from '@/renderer/editor/geometry-math'
import type { VariantStore } from '@/renderer/stores/variant-store'
import { useAreaSize } from './use-area-size'
import styles from './canvas-view.module.css'

export type CanvasViewProps = {
  projectId: string
  store: VariantStore
  variant: VariantSummary
  layers: LayerRow[]
  assets: Readonly<Record<string, SceneAsset>>
  zoom: Zoom
  onZoom: (zoom: Zoom) => void
  selectedId: string | null
  onSelect: (layerId: string | null) => void
  onSettled: (result: SceneSettled) => void
  // The layer in crop mode, or null; the editor keeps it, so the properties panel can start it.
  cropId: string | null
  onCrop: (layerId: string | null) => void
}

export function CanvasView(props: CanvasViewProps) {
  const { variant, layers, zoom, onZoom, onSelect } = props
  const command = useApp((s) => s.command)
  const area = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const fit = fitScale(variant, useAreaSize(area))
  const scale = scaleOf(zoom, fit)
  const found = layers.find((l) => l.id === props.selectedId) ?? null
  const edits = { projectId: props.projectId, store: props.store, command, onSelect }
  const crop = useCropMode({ ...edits, ...props, selected: found, scale })
  // While cropping, the normal overlay, drags and keys do not act on any layer.
  const selected = crop.layer ? null : found
  const keys = useLayerKeys({ ...edits, variantId: variant.id, selected })
  const drag = useCanvasDrag({
    ...edits,
    layers: crop.layer ? [] : layers,
    size: variant,
    scale,
    stage,
    beforeDrag: keys.flush,
  })

  useEditorKey('zoomIn', () => onZoom(zoomIn(zoom, fit)))
  useEditorKey('zoomOut', () => onZoom(zoomOut(zoom, fit)))
  useEditorKey('zoomToFit', () => onZoom('fit'))
  useEditorKey('escape', () => {
    if (crop.layer) crop.cancel()
    else if (drag.active()) drag.cancel()
    else onSelect(null)
  })

  function pick(event: MouseEvent<HTMLDivElement>) {
    event.stopPropagation()
    if (drag.takeClick()) return
    const rect = event.currentTarget.getBoundingClientRect()
    const point = { x: (event.clientX - rect.left) / scale, y: (event.clientY - rect.top) / scale }
    onSelect(pickLayer(layers, point))
  }

  return (
    <section className={styles.canvas} aria-label={`Canvas, ${variant.title}`} tabIndex={0}>
      {/* Pointer only: every canvas action has a keyboard path in the list and the panel. */}
      <div
        ref={area}
        className={styles.area}
        data-backdrop
        onClick={() => crop.layer || drag.takeClick() || onSelect(null)}
      >
        <div
          className={crop.layer ? `${styles.box} ${styles.cropping}` : styles.box}
          style={{ width: variant.width * scale, height: variant.height * scale }}
        >
          <div
            ref={stage}
            data-stage
            className={styles.stage}
            style={{ transform: `scale(${scale})` }}
            onPointerDown={drag.pressLayer}
            onClick={pick}
            onDoubleClick={crop.enter}
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
          <CanvasOverlay
            layers={layers}
            selected={selected}
            scale={scale}
            guides={drag.guides}
            onGrip={drag.pressGrip}
          />
          {crop.layer && crop.url && (
            <CropOverlay
              layer={crop.layer}
              url={crop.url}
              scale={scale}
              onDone={crop.done}
              onCancel={crop.cancel}
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

// spec/editor.md, "Properties panel", Picture [REQ: FR-094], for image and background layers:
// the picture, "Choose picture…" (the picture chooser), "Remove picture" (source null),
// "Crop…" (crop mode on the canvas), "Reset crop" (crop null, shown when a crop is set),
// "Opacity", and for the background only "Fill the canvas" and "Fit inside". Each change is one
// layer.update, so one undo step. A locked layer's fields are shown but disabled.
import { useState } from 'react'
import { PictureChooser } from '@/renderer/dialogs/picture-chooser'
import type { LayerPatch } from '@/shared/schemas/commands/layer'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { fillCanvas, fitInside, type Size } from './background-fit'
import { OpacityField } from './opacity-field'
import { PicturePreview, type PictureAsset } from './picture-preview'
import styles from './picture-fields.module.css'

export type PictureFieldsProps = {
  projectId: string
  layer: LayerRow
  // The layer's picture, or null when it has none or the editor does not hold it.
  asset: PictureAsset | null
  // The variant's size, or null when the panel is shown without its variant.
  canvas: Size | null
  // Resolves to the refusal message, or null when the change was saved.
  onUpdate: (patch: LayerPatch) => Promise<string | null>
  // Starts crop mode; without it "Crop…" is disabled.
  onCrop?: () => void
}

const known = (w: number | null | undefined, h: number | null | undefined): Size | null =>
  w && h ? { width: w, height: h } : null

export function PictureFields(props: PictureFieldsProps) {
  const { layer, asset } = props
  const disabled = layer.locked
  const assetId = layer.source?.assetId ?? null
  const [loaded, setLoaded] = useState<{ assetId: string; size: Size } | null>(null)
  const [choosing, setChoosing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const opacity = 'opacity' in layer.style ? layer.style.opacity : 1
  const shape =
    assetId === null
      ? null
      : (known(asset?.width, asset?.height) ?? (loaded?.assetId === assetId ? loaded.size : null))
  const { canvas } = props

  const send = async (patch: LayerPatch) => setError(await props.onUpdate(patch))

  return (
    <fieldset className={styles.section}>
      <legend className={styles.legend}>Picture</legend>
      <PicturePreview
        projectId={props.projectId}
        assetId={assetId}
        asset={asset}
        onSize={(size) => assetId && setLoaded({ assetId, size })}
      />
      <div className={styles.buttons}>
        <button type="button" disabled={disabled} onClick={() => setChoosing(true)}>
          Choose picture…
        </button>
        <button
          type="button"
          disabled={disabled || assetId === null}
          onClick={() => void send({ source: null })}
        >
          Remove picture
        </button>
        <button
          type="button"
          disabled={disabled || assetId === null || !props.onCrop || asset?.missing === true}
          onClick={props.onCrop}
        >
          Crop…
        </button>
        {layer.geometry.crop && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => void send({ geometry: { crop: null } })}
          >
            Reset crop
          </button>
        )}
      </div>
      <OpacityField
        opacity={opacity}
        disabled={disabled}
        onCommit={(value) => props.onUpdate({ style: { opacity: value } })}
      />
      {layer.type === 'background' && (
        <div className={styles.buttons}>
          <button
            type="button"
            disabled={disabled || canvas === null}
            onClick={() => canvas && void send({ geometry: fillCanvas(canvas) })}
          >
            Fill the canvas
          </button>
          <button
            type="button"
            disabled={disabled || canvas === null || shape === null}
            onClick={() => canvas && shape && void send({ geometry: fitInside(canvas, shape) })}
          >
            Fit inside
          </button>
        </div>
      )}
      {error && <p className={styles.error}>{error}</p>}
      <PictureChooser
        projectId={props.projectId}
        layerName={layer.name}
        open={choosing}
        onChoose={(id) => props.onUpdate({ source: { assetId: id } })}
        onClose={() => setChoosing(false)}
      />
    </fieldset>
  )
}

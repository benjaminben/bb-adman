// spec/editor.md, "Properties panel", Picture [REQ: FR-094], for image and background layers, as
// ED-3 draws it: the picture first with no title, its icon bar on the lower edge (./picture-bar),
// or "Empty picture" with "Choose picture…"; then "Opacity" (a SliderField, 0 to 100 %, stored
// 0 to 1) and, for the background, "Background colour". Each change is one layer.update, so one
// undo step, the same patches as before. A locked layer's controls are shown but disabled.
// P4-19: "Cut out the subject…" opens the run dialog (./cut-out); its words follow the job.
import { useState } from 'react'
import { BackgroundColourField } from '@/renderer/editor/background-colour-field'
import { PictureChooser } from '@/renderer/dialogs/picture-chooser'
import { EmptyState } from '@/renderer/ui/empty-state'
import { SliderField } from '@/renderer/ui/slider-field'
import type { LayerPatch } from '@/shared/schemas/commands/layer'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { Size } from './background-fit'
import { barButtons } from './bar-buttons'
import { useCutOut } from './cut-out'
import { CutOutLines, cutOutRunning, useJobRow } from './cut-out-status'
import { PictureBar } from './picture-bar'
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
  // The campaign's palette, for the background's "Background colour" (LK-5).
  palette?: string[]
}

const known = (w: number | null | undefined, h: number | null | undefined): Size | null =>
  w && h ? { width: w, height: h } : null

export function PictureFields(props: PictureFieldsProps) {
  const { layer, asset, canvas } = props
  const locked = layer.locked
  const assetId = layer.source?.assetId ?? null
  const [loaded, setLoaded] = useState<{ assetId: string; size: Size } | null>(null)
  const [choosing, setChoosing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cutOut = useCutOut(props.projectId, layer)
  const row = useJobRow(props.projectId, layer.id, cutOut.jobId)
  const opacity = 'opacity' in layer.style ? layer.style.opacity : 1
  const shape =
    assetId === null
      ? null
      : (known(asset?.width, asset?.height) ?? (loaded?.assetId === assetId ? loaded.size : null))

  const send = async (patch: LayerPatch) => setError(await props.onUpdate(patch))
  const { main, fit } = barButtons({
    layer,
    missing: asset?.missing === true,
    canvas,
    shape,
    canCutOut: cutOut.canRun,
    onChoose: () => setChoosing(true),
    onCrop: props.onCrop,
    onCutOut: cutOut.start,
    send: (patch) => void send(patch),
  })

  return (
    <div className={styles.section}>
      <fieldset className={styles.block}>
        <legend className={styles.hidden}>Picture</legend>
        {assetId === null ? (
          <EmptyState
            icon="image"
            words="Empty picture"
            action={{ label: 'Choose picture…', onClick: () => setChoosing(true) }}
          />
        ) : (
          <PicturePreview
            projectId={props.projectId}
            assetId={assetId}
            asset={asset}
            running={cutOutRunning(cutOut.jobId, row)}
            onSize={(size) => setLoaded({ assetId, size })}
          >
            <PictureBar main={main} fit={fit} />
          </PicturePreview>
        )}
        {assetId === null && fit.length > 0 && <PictureBar main={[]} fit={fit} />}
        <CutOutLines projectId={props.projectId} jobId={cutOut.jobId} row={row} />
        {error && <p className={styles.error}>{error}</p>}
      </fieldset>
      <SliderField
        label="Opacity"
        unit="%"
        min={0}
        max={100}
        step={1}
        value={Math.round(opacity * 100)}
        disabled={locked}
        onCommit={(value) => void send({ style: { opacity: value / 100 } })}
      />
      <BackgroundColourField
        layer={layer}
        palette={props.palette ?? []}
        onUpdate={props.onUpdate}
      />
      <PictureChooser
        projectId={props.projectId}
        layerName={layer.name}
        open={choosing}
        onChoose={(id) => props.onUpdate({ source: { assetId: id } })}
        onClose={() => setChoosing(false)}
      />
      {cutOut.dialog}
    </div>
  )
}

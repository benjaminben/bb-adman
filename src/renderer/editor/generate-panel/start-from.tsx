// "Start from" for a picture run (spec/phases/round-2-editor.md D4): a prompt only, this
// layer's picture (disabled with a reason while the layer has no picture that can be sent),
// or another picture of the same shape, which shows the same-shape list. The choice is the
// layer's draft.
import { useId } from 'react'
import type { FullDraft, GenerateDraft, GenerateStart } from '@/renderer/stores/generate-drafts'
import type { AssetList } from '@/shared/schemas/queries/asset'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import layout from '@/renderer/ui/layout.module.css'
import { SameShapeList } from './same-shape-list'
import styles from './generate-panel.module.css'

const CHOICES: { start: GenerateStart; label: string }[] = [
  { start: 'prompt', label: 'A prompt only' },
  { start: 'layer', label: "This layer's picture" },
  { start: 'shape', label: 'Another picture of the same shape…' },
]

export type StartFromProps = {
  projectId: string
  layer: LayerRow
  draft: FullDraft | undefined
  // The layer's own picture when it can be sent, else null.
  layerPicture: string | null
  images: AssetList | null
  read: () => Promise<AssetList>
  onChange: (patch: Partial<GenerateDraft>) => void
}

export function StartFrom(props: StartFromProps) {
  const { layer, draft } = props
  const baseId = useId()
  const disabled = layer.locked || draft === undefined
  const noPictureId = `${baseId}-no-picture`
  const start = draft?.start ?? 'prompt'

  return (
    <>
      <div role="radiogroup" aria-labelledby={`${baseId}-label`} className={styles.starts}>
        <p id={`${baseId}-label`} className={layout.label}>
          Start from
        </p>
        {CHOICES.map((c) => {
          const none = c.start === 'layer' && props.layerPicture === null
          return (
            <label key={c.start} className={layout.row}>
              <input
                type="radio"
                name={`${baseId}-start`}
                checked={start === c.start}
                disabled={disabled || none}
                aria-describedby={none ? noPictureId : undefined}
                onChange={() => props.onChange({ start: c.start })}
              />
              {c.label}
            </label>
          )
        })}
        {props.layerPicture === null && (
          <p id={noPictureId} className={layout.muted}>
            This layer has no picture yet.
          </p>
        )}
      </div>
      {start === 'shape' && (
        <SameShapeList
          projectId={props.projectId}
          box={layer.geometry}
          ownId={layer.source?.assetId ?? null}
          images={props.images}
          read={props.read}
          chosen={draft?.startAssetId ?? null}
          disabled={disabled}
          name={`${baseId}-shape`}
          onChoose={(startAssetId) => props.onChange({ startAssetId })}
        />
      )}
    </>
  )
}

// "Start from" for a picture run (spec/phases/round-2-editor.md D4): a prompt only, this
// layer's picture (disabled with a reason while the layer has no picture that can be sent),
// or another picture of the same shape, which shows the same-shape list. The choice is the
// layer's draft. R2E-8: a video offers the starts some available provider offers, and
// "Reference pictures" too.
import { useId } from 'react'
import type {
  FullDraft,
  GenerateDraft,
  GenerateKind,
  GenerateStart,
} from '@/renderer/stores/generate-drafts'
import type { VideoStartKind } from '@/shared/config/video-offers'
import type { AssetList } from '@/shared/schemas/queries/asset'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import layout from '@/renderer/ui/layout.module.css'
import { SameShapeList } from './same-shape-list'
import styles from './generate-panel.module.css'

type Choice = { start: GenerateStart; label: string }

const CHOICES: Choice[] = [
  { start: 'prompt', label: 'A prompt only' },
  { start: 'layer', label: "This layer's picture" },
  { start: 'shape', label: 'Another picture of the same shape…' },
  { start: 'references', label: 'Reference pictures' },
]

// The video start each choice sends (D4's table).
export const VIDEO_START: Record<GenerateStart, VideoStartKind> = {
  prompt: 'prompt',
  layer: 'background',
  shape: 'first_frame',
  references: 'reference',
}

// The choices for a kind: a picture has the first three; a video those whose start is offered.
export function startChoices(kind: GenerateKind, offered: readonly VideoStartKind[]): Choice[] {
  if (kind === 'image') return CHOICES.filter((c) => c.start !== 'references')
  return CHOICES.filter((c) => c.start === 'prompt' || offered.includes(VIDEO_START[c.start]))
}

// The start shown: the draft's while it is among the choices, else a prompt only.
export const shownStart = (choices: Choice[], wanted: GenerateStart | undefined): GenerateStart =>
  wanted !== undefined && choices.some((c) => c.start === wanted) ? wanted : 'prompt'

export type StartFromProps = {
  projectId: string
  layer: LayerRow
  draft: FullDraft | undefined
  choices: Choice[]
  start: GenerateStart
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
  const { start } = props

  return (
    <>
      <div role="radiogroup" aria-labelledby={`${baseId}-label`} className={styles.starts}>
        <p id={`${baseId}-label`} className={layout.label}>
          Start from
        </p>
        {props.choices.map((c) => {
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

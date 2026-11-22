// "Start from" (spec/phases/round-2-editor.md D4; design wave ED-4a): a row of tiles in one
// group, each a button with aria-pressed: a prompt only (a pencil), this layer's picture (its
// thumbnail; disabled with its reason while the layer has no picture that can be sent), another
// picture of the same shape (a grid; it shows the same-shape list under the tiles), and for a
// video "Reference pictures". The choice is the layer's draft; choosing sends nothing.
import { useId, type ReactNode } from 'react'
import type {
  FullDraft,
  GenerateDraft,
  GenerateKind,
  GenerateStart,
} from '@/renderer/stores/generate-drafts'
import type { VideoStartKind } from '@/shared/config/video-offers'
import type { AssetList } from '@/shared/schemas/queries/asset'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { assetUrl } from '@/renderer/ui/asset-url'
import { Icon } from '@/renderer/ui/icon'
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

const NO_PICTURE = 'This layer has no picture yet.'

function tileLook(start: GenerateStart, projectId: string, picture: string | null): ReactNode {
  if (start === 'layer' && picture !== null) {
    return <img className={styles.tileThumb} src={assetUrl(projectId, picture)} alt="" />
  }
  const icon = start === 'prompt' ? 'pencil' : start === 'shape' ? 'grid' : 'image'
  return (
    <span className={styles.tileThumb}>
      <Icon name={icon} />
    </span>
  )
}

export function StartFrom(props: StartFromProps) {
  const { layer, draft, start } = props
  const baseId = useId()
  const disabled = layer.locked || draft === undefined
  const noPictureId = `${baseId}-no-picture`

  return (
    <>
      <div className={styles.startFrom}>
        <span id={`${baseId}-label`} className={layout.label}>
          Start from
        </span>
        <div role="group" aria-labelledby={`${baseId}-label`} className={styles.starts}>
          {props.choices.map((c) => {
            const none = c.start === 'layer' && props.layerPicture === null
            return (
              <button
                key={c.start}
                type="button"
                className={styles.startTile}
                aria-pressed={start === c.start}
                disabled={disabled || none}
                title={none ? NO_PICTURE : c.label}
                aria-describedby={none ? noPictureId : undefined}
                onClick={() => props.onChange({ start: c.start })}
              >
                {tileLook(c.start, props.projectId, props.layerPicture)}
                <span className={styles.tileName}>{c.label}</span>
              </button>
            )
          })}
        </div>
        {props.layerPicture === null && (
          <span id={noPictureId} className={styles.hidden}>
            {NO_PICTURE}
          </span>
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

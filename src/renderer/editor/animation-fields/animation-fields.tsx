// P7-19 (spec/phases/phase-07-slices-2.md): in the properties panel of a text layer on a video
// ad, "Entrance" and "Exit", each a preset select ("None", "Fade", "Fade up", "Slide", "Words
// one by one") and a length in seconds. Each change sends one layer.update with that block
// only, in whole milliseconds. The length is off while the block has no preset.
import { useId, useState } from 'react'
import { PRESET_NAMES } from '@/renderer/editor/animation-block'
import { NumberField } from '@/renderer/editor/number-field'
import { MIN_SPAN_MS } from '@/renderer/editor/timeline-math/timeline-math'
import { timingSpan, type BlockKind } from '@/renderer/editor/timing-bar'
import type { LayerPatch } from '@/shared/schemas/commands/layer'
import { ANIMATION_PRESETS, type AnimationBlock } from '@/shared/schemas/layer'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { withLength, withPreset } from './animation-change'
import styles from './animation-fields.module.css'

export type AnimationFieldsProps = {
  layer: LayerRow
  durationMs: number // the variant's length
  // Resolves to the refusal message, or null when the change was saved.
  onUpdate: (patch: LayerPatch) => Promise<string | null>
}

const KINDS: Array<[BlockKind, string]> = [
  ['entrance', 'Entrance'],
  ['exit', 'Exit'],
]

const seconds = (ms: number) => ms / 1000

export function AnimationFields({ layer, durationMs, onUpdate }: AnimationFieldsProps) {
  const id = useId()
  const [error, setError] = useState<string | null>(null)
  const span = timingSpan(layer.timing, durationMs)
  const disabled = layer.locked
  const save = (kind: BlockKind, block: AnimationBlock) =>
    onUpdate({ animation: { [kind]: block } })

  return (
    <fieldset className={styles.section}>
      <legend className={styles.legend}>Animation</legend>
      {KINDS.map(([kind, name]) => {
        const block = layer.animation[kind]
        return (
          <div key={kind} className={styles.pair}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor={`${id}-${kind}`}>
                {name}
              </label>
              <select
                id={`${id}-${kind}`}
                value={block.preset}
                disabled={disabled}
                onChange={async (event) => {
                  const preset = event.target.value as AnimationBlock['preset']
                  setError(await save(kind, withPreset(kind, block, preset, span)))
                }}
              >
                {ANIMATION_PRESETS.map((preset) => (
                  <option key={preset} value={preset}>
                    {PRESET_NAMES[preset]}
                  </option>
                ))}
              </select>
            </div>
            <NumberField
              label="Length"
              name={`${name} length`}
              unit="s"
              step={0.1}
              min={seconds(MIN_SPAN_MS)}
              max={seconds(span.endMs - span.startMs)}
              value={seconds(block.durationMs)}
              disabled={disabled || block.preset === 'none'}
              onCommit={(value) =>
                save(kind, withLength(kind, block, Math.round(value * 1000), span))
              }
            />
          </div>
        )
      })}
      {error && <p className={styles.error}>{error}</p>}
    </fieldset>
  )
}

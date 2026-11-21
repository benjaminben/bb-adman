// spec/editor.md, "Properties panel", "Shade" (LK-5) [D-094], for image and background layers
// after "Picture": the "Shade" select (None or a side), then "Colour" (palette, no "None"),
// "Strength" (0 to 100 %) and "Reach" (5 to 100 %, disabled for Whole picture). Choosing a side
// when there is none sends NEW_SHADE with that side; None sends shade null. Every change sends
// the whole shade, which a patch replaces whole (A-75).
import { useId, useState } from 'react'
import { ColourChoice } from '@/renderer/editor/colour-choice'
import { NEW_SHADE, pictureLookOf } from '@/shared/config/look'
import type { LayerPatch } from '@/shared/schemas/commands/layer'
import { LOOK_LIMITS, SHADE_SIDES, type ImageStyle, type Shade } from '@/shared/schemas/layer'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { PercentSlider } from './percent-slider'
import styles from './shade-fields.module.css'

export type ShadeFieldsProps = {
  layer: LayerRow
  palette: string[]
  // Resolves to the refusal message, or null when the change was saved.
  onUpdate: (patch: LayerPatch) => Promise<string | null>
}

const SIDES: Array<[Shade['from'] | 'none', string]> = [
  ['none', 'None'],
  ['bottom', 'From the bottom'],
  ['top', 'From the top'],
  ['left', 'From the left'],
  ['right', 'From the right'],
  ['all', 'Whole picture'],
]

export function ShadeFields(props: ShadeFieldsProps) {
  const id = useId()
  const { shade } = pictureLookOf(props.layer.style as ImageStyle)
  const disabled = props.layer.locked
  const [error, setError] = useState<string | null>(null)
  const save = (next: Shade | null) => props.onUpdate({ style: { shade: next } })
  const change = (values: Partial<Shade>) => save({ ...(shade ?? NEW_SHADE), ...values })

  const choose = async (value: string) => {
    const from = SHADE_SIDES.find((side) => side === value) ?? null
    setError(await (from === null ? save(null) : change({ from })))
  }

  return (
    <fieldset className={styles.section}>
      <legend className={styles.legend}>Shade</legend>
      <div className={styles.field}>
        <label className={styles.label} htmlFor={id}>
          Shade
        </label>
        <select
          id={id}
          disabled={disabled}
          value={shade?.from ?? 'none'}
          onChange={(event) => void choose(event.target.value)}
        >
          {SIDES.map(([side, name]) => (
            <option key={side} value={side}>
              {name}
            </option>
          ))}
        </select>
        {error && <p className={styles.error}>{error}</p>}
      </div>
      {shade && (
        <>
          <ColourChoice
            label="Colour"
            value={shade.color}
            palette={props.palette}
            disabled={disabled}
            onCommit={(color) => change({ color: color ?? shade.color })}
          />
          <PercentSlider
            label="Strength"
            value={shade.strength}
            {...LOOK_LIMITS.shadeStrength}
            disabled={disabled}
            onCommit={(strength) => change({ strength })}
          />
          <PercentSlider
            label="Reach"
            value={shade.reach}
            {...LOOK_LIMITS.shadeReach}
            disabled={disabled || shade.from === 'all'}
            onCommit={(reach) => change({ reach })}
          />
        </>
      )}
    </fieldset>
  )
}

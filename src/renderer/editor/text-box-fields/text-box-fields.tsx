// spec/editor.md, "Properties panel", "Box" (LK-5) [D-094], for text layers after "Text
// settings": "Vertical align" (Top, Middle, Bottom), "All capitals", "Box colour" and "Outline
// colour" (each with the palette and "None", which sends null), "Outline width" (px, 0 to 100),
// "Corner radius" and "Padding" (px, 0 to 2,000). Each field sends one layer.update with that
// field only. A layer stored without these fields shows the defaults (textLookOf).
import { useState } from 'react'
import { ColourChoice } from '@/renderer/editor/colour-choice'
import { NumberField } from '@/renderer/editor/number-field'
import layout from '@/renderer/ui/layout.module.css'
import { textLookOf } from '@/shared/config/look'
import type { LayerPatch } from '@/shared/schemas/commands/layer'
import { LOOK_LIMITS, type TextStyle } from '@/shared/schemas/layer'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import styles from './text-box-fields.module.css'

export type TextBoxFieldsProps = {
  layer: LayerRow
  palette: string[]
  // Resolves to the refusal message, or null when the change was saved.
  onUpdate: (patch: LayerPatch) => Promise<string | null>
}

const ALIGN: Array<[NonNullable<TextStyle['verticalAlign']>, string]> = [
  ['top', 'Top'],
  ['middle', 'Middle'],
  ['bottom', 'Bottom'],
]

export function TextBoxFields(props: TextBoxFieldsProps) {
  const look = textLookOf(props.layer.style as TextStyle)
  const disabled = props.layer.locked
  const [error, setError] = useState<string | null>(null)
  const set = (values: Partial<TextStyle>) => props.onUpdate({ style: values })
  const send = async (values: Partial<TextStyle>) => setError(await set(values))
  const { boxOutlineWidth, boxRadius, boxPadding } = LOOK_LIMITS

  return (
    <fieldset className={styles.section}>
      <legend className={styles.legend}>Box</legend>
      <div role="group" aria-label="Vertical align" className={styles.field}>
        <span className={styles.label} aria-hidden="true">
          Vertical align
        </span>
        <div className={`${layout.seg} ${styles.align}`}>
          {ALIGN.map(([verticalAlign, name]) => (
            <button
              key={verticalAlign}
              type="button"
              aria-pressed={look.verticalAlign === verticalAlign}
              disabled={disabled}
              onClick={() => void send({ verticalAlign })}
            >
              {name}
            </button>
          ))}
        </div>
      </div>
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={look.allCaps}
          disabled={disabled}
          onChange={(event) => void send({ allCaps: event.target.checked })}
        />
        All capitals
      </label>
      {error && <p className={styles.error}>{error}</p>}
      <ColourChoice
        label="Box colour"
        value={look.boxColor}
        palette={props.palette}
        disabled={disabled}
        allowNone
        onCommit={(boxColor) => set({ boxColor })}
      />
      <ColourChoice
        label="Outline colour"
        value={look.boxOutlineColor}
        palette={props.palette}
        disabled={disabled}
        allowNone
        onCommit={(boxOutlineColor) => set({ boxOutlineColor })}
      />
      <NumberField
        label="Outline width"
        unit="px"
        min={boxOutlineWidth.min}
        max={boxOutlineWidth.max}
        value={look.boxOutlineWidth}
        disabled={disabled}
        onCommit={(value) => set({ boxOutlineWidth: value })}
      />
      <div className={styles.pair}>
        <NumberField
          label="Corner radius"
          unit="px"
          min={boxRadius.min}
          max={boxRadius.max}
          value={look.boxRadius}
          disabled={disabled}
          onCommit={(value) => set({ boxRadius: value })}
        />
        <NumberField
          label="Padding"
          unit="px"
          min={boxPadding.min}
          max={boxPadding.max}
          value={look.boxPadding}
          disabled={disabled}
          onCommit={(value) => set({ boxPadding: value })}
        />
      </div>
    </fieldset>
  )
}

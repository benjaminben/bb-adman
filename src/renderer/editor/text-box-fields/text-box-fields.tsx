// spec/editor.md, "Properties panel", "Box" (LK-5) [D-094]. ED-2
// (spec/phases/design-wave-screens-a.md, "Text layer"): a folded "Box" Section whose summary
// reads "None", "Fill", "Outline" or "Fill · Outline". Inside: "Box colour" and "Outline colour"
// swatches (each with "No colour", which sends null), the outline "Width" (px, 0 to 100) on the
// outline's row, then "Corner radius" and "Padding" (px, 0 to 2,000). Vertical align and All
// capitals moved to Type. Each field sends one layer.update with that field only. A layer stored
// without these fields shows the defaults (textLookOf). A locked layer disables the group.
import { useState } from 'react'
import { NumberField } from '@/renderer/editor/number-field'
import { Section } from '@/renderer/ui/section'
import { SwatchField } from '@/renderer/ui/swatch-field'
import { textLookOf, type TextLook } from '@/shared/config/look'
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

// The words on the folded header (architect's wording).
function summaryOf(look: TextLook): string {
  const fill = look.boxColor !== null
  const outline = look.boxOutlineColor !== null && look.boxOutlineWidth > 0
  const words = [fill && 'Fill', outline && 'Outline'].filter(Boolean)
  return words.length > 0 ? words.join(' · ') : 'None'
}

export function TextBoxFields(props: TextBoxFieldsProps) {
  const look = textLookOf(props.layer.style as TextStyle)
  const [error, setError] = useState<string | null>(null)
  const set = (values: Partial<TextStyle>) => props.onUpdate({ style: values })
  const send = (values: Partial<TextStyle>) => void set(values).then(setError)
  const { boxOutlineWidth, boxRadius, boxPadding } = LOOK_LIMITS

  return (
    <Section id="props.box" title="Box" level={4} fold="closed" summary={summaryOf(look)}>
      <fieldset aria-label="Box" className={styles.group} disabled={props.layer.locked}>
        <SwatchField
          label="Box colour"
          value={look.boxColor}
          palette={props.palette}
          allowNone
          onCommit={(boxColor) => send({ boxColor })}
        />
        <div className={styles.outline}>
          <SwatchField
            label="Outline colour"
            value={look.boxOutlineColor}
            palette={props.palette}
            allowNone
            onCommit={(boxOutlineColor) => send({ boxOutlineColor })}
          />
          <NumberField
            label="Width"
            name="Outline width"
            unit="px"
            inline
            min={boxOutlineWidth.min}
            max={boxOutlineWidth.max}
            value={look.boxOutlineWidth}
            onCommit={(value) => set({ boxOutlineWidth: value })}
          />
        </div>
        <div className={styles.pair}>
          <NumberField
            label="Corner radius"
            unit="px"
            inline
            min={boxRadius.min}
            max={boxRadius.max}
            value={look.boxRadius}
            onCommit={(value) => set({ boxRadius: value })}
          />
          <NumberField
            label="Padding"
            unit="px"
            inline
            min={boxPadding.min}
            max={boxPadding.max}
            value={look.boxPadding}
            onCommit={(value) => set({ boxPadding: value })}
          />
        </div>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
      </fieldset>
    </Section>
  )
}

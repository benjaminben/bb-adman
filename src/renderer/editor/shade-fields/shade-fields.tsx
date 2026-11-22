// spec/editor.md, "Properties panel", "Shade" (LK-5) [D-094], for image and background layers
// after the picture; as ED-3 draws it, a folded Section summed up as "None" or "{side} ·
// {strength} %". Inside: the side as six icon segments in the group "Shade" (None or a side),
// then "Colour" (palette, no "No colour"), "Strength" (0 to 100 %) and "Reach" (5 to 100 %, off
// for the whole picture). Choosing a side when there is none sends NEW_SHADE with that side;
// None sends shade null. Every change sends the whole shade, which a patch replaces whole (A-75).
import { useState } from 'react'
import { Icon, type IconName } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import { Section } from '@/renderer/ui/section'
import { SliderField } from '@/renderer/ui/slider-field'
import { SwatchField } from '@/renderer/ui/swatch-field'
import { NEW_SHADE, pictureLookOf } from '@/shared/config/look'
import type { LayerPatch } from '@/shared/schemas/commands/layer'
import { LOOK_LIMITS, type ImageStyle, type Shade } from '@/shared/schemas/layer'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import styles from './shade-fields.module.css'

export type ShadeFieldsProps = {
  layer: LayerRow
  palette: string[]
  // Resolves to the refusal message, or null when the change was saved.
  onUpdate: (patch: LayerPatch) => Promise<string | null>
}

type Side = Shade['from'] | 'none'

const SIDES: Array<[Side, IconName, string]> = [
  ['none', 'shadeNone', 'None'],
  ['bottom', 'shadeBottom', 'From the bottom'],
  ['top', 'shadeTop', 'From the top'],
  ['left', 'shadeLeft', 'From the left'],
  ['right', 'shadeRight', 'From the right'],
  ['all', 'shadeAll', 'Whole picture'],
]

// The summary's side words (architect's wording).
const SIDE_WORD: Record<Shade['from'], string> = {
  bottom: 'Bottom',
  top: 'Top',
  left: 'Left',
  right: 'Right',
  all: 'Whole',
}

const percent = (n: number) => Math.round(n * 100)

export function ShadeFields(props: ShadeFieldsProps) {
  const { shade } = pictureLookOf(props.layer.style as ImageStyle)
  const disabled = props.layer.locked
  const [error, setError] = useState<string | null>(null)
  const save = async (next: Shade | null) =>
    setError(await props.onUpdate({ style: { shade: next } }))
  const change = (values: Partial<Shade>) => void save({ ...(shade ?? NEW_SHADE), ...values })
  const choose = (side: Side) => (side === 'none' ? void save(null) : change({ from: side }))
  const summary = shade ? `${SIDE_WORD[shade.from]} · ${percent(shade.strength)} %` : 'None'
  const { shadeStrength: strength, shadeReach: reach } = LOOK_LIMITS
  const whole = shade?.from === 'all'

  return (
    <Section id="props.shade" title="Shade" level={4} fold="closed" summary={summary}>
      <div role="group" aria-label="Shade" className={layout.seg}>
        {SIDES.map(([side, icon, name]) => (
          <button
            key={side}
            type="button"
            className={layout.iconButton}
            aria-label={name}
            title={name}
            aria-pressed={(shade?.from ?? 'none') === side}
            disabled={disabled}
            onClick={() => (shade?.from ?? 'none') !== side && choose(side)}
          >
            <Icon name={icon} />
          </button>
        ))}
      </div>
      {error && <p className={styles.error}>{error}</p>}
      {shade && (
        <>
          <SwatchField
            label="Colour"
            value={shade.color}
            palette={props.palette}
            disabled={disabled}
            onCommit={(color) => change({ color: color ?? shade.color })}
          />
          <SliderField
            label="Strength"
            unit="%"
            min={percent(strength.min)}
            max={percent(strength.max)}
            step={1}
            value={percent(shade.strength)}
            disabled={disabled}
            onCommit={(value) => change({ strength: value / 100 })}
          />
          <div title={whole ? 'Not used for the whole picture' : undefined}>
            <SliderField
              label="Reach"
              unit="%"
              min={percent(reach.min)}
              max={percent(reach.max)}
              step={1}
              value={percent(shade.reach)}
              disabled={disabled || whole}
              onCommit={(value) => change({ reach: value / 100 })}
            />
          </div>
        </>
      )}
    </Section>
  )
}

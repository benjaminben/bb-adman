// ED-2: the rows of the Type Section. Size and Weight; Align and Vertical align as icon
// segments; Colour as swatches; Line height, Letter spacing and All capitals. Each change sends
// one layer.update with that field only; `send` reports a refusal to the Section.
import { useId } from 'react'
import { NumberField } from '@/renderer/editor/number-field'
import { Icon } from '@/renderer/ui/icon'
import { InfoTip } from '@/renderer/ui/info-tip'
import layout from '@/renderer/ui/layout.module.css'
import { SwatchField } from '@/renderer/ui/swatch-field'
import type { TextLook } from '@/shared/config/look'
import type { TextStyle } from '@/shared/schemas/layer'
import { IconSegments, type Segment } from './icon-segments'
import { WEIGHTS } from './weights'
import { withCurrent } from './with-current'
import styles from './text-fields.module.css'

type Patch = Partial<TextStyle>

export type RowProps = {
  look: TextLook
  // Saves and resolves to the refusal message, or null (number fields show their own).
  set: (values: Patch) => Promise<string | null>
  // Saves and shows a refusal under the Section.
  send: (values: Patch) => void
}

const ALIGN: Array<Segment<TextStyle['align']>> = [
  { value: 'left', name: 'Left', icon: 'alignLeft' },
  { value: 'center', name: 'Centre', icon: 'alignCentre' },
  { value: 'right', name: 'Right', icon: 'alignRight' },
]

const VERTICAL: Array<Segment<NonNullable<TextStyle['verticalAlign']>>> = [
  { value: 'top', name: 'Top', icon: 'alignTop' },
  { value: 'middle', name: 'Middle', icon: 'alignMiddle' },
  { value: 'bottom', name: 'Bottom', icon: 'alignBottom' },
]

export function SizeWeightRow(props: RowProps) {
  const id = useId()
  return (
    <div className={styles.pair}>
      <NumberField
        label="Size"
        unit="px"
        inline
        min={1}
        value={props.look.fontSize}
        onCommit={(fontSize) => props.set({ fontSize })}
      />
      <div className={`${layout.field} ${layout.inline}`}>
        <span className={styles.labelTip}>
          <label className={layout.label} htmlFor={id}>
            Weight
          </label>
          <InfoTip about="weight">
            Weight changes only fonts that have more than one weight.
          </InfoTip>
        </span>
        <select
          id={id}
          value={props.look.fontWeight}
          onChange={(event) => props.send({ fontWeight: Number(event.target.value) })}
        >
          {WEIGHTS.map(([weight, name]) => (
            <option key={weight} value={weight}>
              {name}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

export function AlignRow(props: RowProps) {
  return (
    <div className={styles.alignRow}>
      <span className={layout.label}>Align</span>
      <IconSegments
        label="Align"
        segments={ALIGN}
        value={props.look.align}
        onChoose={(align) => props.send({ align })}
      />
      <IconSegments
        label="Vertical align"
        segments={VERTICAL}
        value={props.look.verticalAlign}
        onChoose={(verticalAlign) => props.send({ verticalAlign })}
      />
    </div>
  )
}

export function ColourRow(props: RowProps & { palette: string[] }) {
  return (
    <SwatchField
      label="Colour"
      value={props.look.color}
      palette={withCurrent(props.palette, props.look.color)}
      onCommit={(color) => color !== null && props.send({ color })}
    />
  )
}

export function SpacingRow(props: RowProps) {
  return (
    <div className={styles.spacing}>
      <NumberField
        label="Line height"
        inline
        step={0.05}
        min={0.5}
        max={4}
        value={props.look.lineHeight}
        onCommit={(lineHeight) => props.set({ lineHeight })}
      />
      <NumberField
        label="Letter spacing"
        unit="em"
        inline
        step={0.01}
        min={-0.2}
        max={1}
        value={props.look.letterSpacing}
        onCommit={(letterSpacing) => props.set({ letterSpacing })}
      />
      <button
        type="button"
        className={layout.iconButton}
        aria-label="All capitals"
        title="All capitals"
        aria-pressed={props.look.allCaps}
        onClick={() => props.send({ allCaps: !props.look.allCaps })}
      >
        <Icon name="allCaps" />
      </button>
    </div>
  )
}

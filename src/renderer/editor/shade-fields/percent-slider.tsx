// spec/editor.md, "Properties panel", "Shade": "Strength" and "Reach", each a slider and a number
// field in percent, stored 0 to 1, saving as "Opacity" does: the number on Enter or on leaving
// it, the slider once when it is let go (pointer up, key up or leaving it), never while it moves.
import { NumberField, useDraft } from '@/renderer/editor/number-field'
import styles from './shade-fields.module.css'

export type PercentSliderProps = {
  label: string
  // Stored 0 to 1; shown and bounded in whole percent.
  value: number
  min: number
  max: number
  disabled: boolean
  // Resolves to the refusal message, or null when the value was saved.
  onCommit: (value: number) => Promise<string | null>
}

export function PercentSlider(props: PercentSliderProps) {
  const percent = Math.round(props.value * 100)
  const min = Math.round(props.min * 100)
  const max = Math.round(props.max * 100)
  const commit = (value: number) => props.onCommit(value / 100)
  const slider = useDraft(String(percent), (text) => commit(Number(text)))
  const release = () => void slider.save()

  return (
    <div className={styles.percent}>
      <div className={styles.amount}>
        <NumberField
          label={props.label}
          unit="%"
          min={min}
          max={max}
          value={percent}
          disabled={props.disabled}
          onCommit={commit}
        />
      </div>
      <input
        type="range"
        className={styles.slider}
        aria-label={props.label}
        min={min}
        max={max}
        step={1}
        disabled={props.disabled}
        value={slider.text}
        onChange={(event) => slider.setText(event.target.value)}
        onPointerUp={release}
        onKeyUp={release}
        onBlur={release}
      />
      {slider.error && <p className={styles.error}>{slider.error}</p>}
    </div>
  )
}

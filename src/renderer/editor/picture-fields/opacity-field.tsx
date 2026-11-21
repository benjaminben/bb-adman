// spec/editor.md, "Properties panel", Picture: "Opacity" as a slider and a number, 0 to 100 %,
// stored 0 to 1. The slider saves once when it is let go (pointer up, key up or leaving it),
// never while it moves, so a drag is one undo step.
import { NumberField, useDraft } from '@/renderer/editor/number-field'
import styles from './picture-fields.module.css'

export type OpacityFieldProps = {
  opacity: number
  disabled: boolean
  // Resolves to the refusal message, or null when the value was saved.
  onCommit: (opacity: number) => Promise<string | null>
}

export function OpacityField(props: OpacityFieldProps) {
  const percent = Math.round(props.opacity * 100)
  const commit = (value: number) => props.onCommit(value / 100)
  const slider = useDraft(String(percent), (text) => commit(Number(text)))
  const release = () => void slider.save()

  return (
    <div className={styles.opacity}>
      <div className={styles.amount}>
        <NumberField
          label="Opacity"
          unit="%"
          min={0}
          max={100}
          value={percent}
          disabled={props.disabled}
          onCommit={commit}
        />
      </div>
      <input
        type="range"
        className={styles.slider}
        aria-label="Opacity"
        min={0}
        max={100}
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

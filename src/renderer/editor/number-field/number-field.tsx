// spec/editor.md, "Properties panel": a number field. Whole numbers unless a step says
// otherwise; the arrow keys step within the bounds; Enter or leaving the field saves once.
// Text that is not a number goes back to the stored value and sends nothing.
import { useId, type KeyboardEvent } from 'react'
import { useDraft } from './use-draft'
import styles from './number-field.module.css'

export type NumberFieldProps = {
  label: string
  // The accessible name when the visible label is short ("W" for "Width").
  name?: string
  unit?: string
  value: number
  step?: number
  min?: number
  max?: number
  disabled?: boolean
  // Resolves to the refusal message, or null when the value was saved.
  onCommit: (value: number) => Promise<string | null>
}

const decimalsOf = (step: number) => (String(step).split('.')[1] ?? '').length

export function NumberField(props: NumberFieldProps) {
  const { step = 1, min = -Infinity, max = Infinity } = props
  const decimals = decimalsOf(step)
  const id = useId()
  const fit = (n: number) =>
    Math.min(max, Math.max(min, Number((Math.round(n / step) * step).toFixed(decimals))))
  const format = (n: number) => String(fit(n))
  const parse = (text: string): number | null => {
    const n = Number(text.trim())
    return text.trim() === '' || !Number.isFinite(n) ? null : fit(n)
  }
  const draft = useDraft(String(props.value), (text) => props.onCommit(Number(text)))

  function save() {
    const n = parse(draft.text)
    if (n === null) draft.reset()
    else void draft.save(String(n))
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      save()
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      const from = parse(draft.text) ?? props.value
      draft.setText(format(from + (event.key === 'ArrowUp' ? step : -step)))
    }
  }

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {props.label}
      </label>
      <div className={styles.row}>
        <input
          id={id}
          className={styles.input}
          type="text"
          inputMode="decimal"
          role="spinbutton"
          aria-label={props.name}
          aria-valuenow={props.value}
          aria-valuemin={Number.isFinite(min) ? min : undefined}
          aria-valuemax={Number.isFinite(max) ? max : undefined}
          aria-describedby={draft.error ? `${id}-error` : undefined}
          disabled={props.disabled}
          value={draft.text}
          onChange={(event) => draft.setText(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={save}
        />
        {props.unit && <span className={styles.unit}>{props.unit}</span>}
      </div>
      {draft.error && (
        <p id={`${id}-error`} className={styles.error}>
          {draft.error}
        </p>
      )}
    </div>
  )
}

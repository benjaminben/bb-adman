// spec/app-style-parts.md, "Field", "Slider field" (design wave T3d): a range and a small number
// at its end, on one row, named by one label ("{label}" and "{label} value"). Moving the range
// updates the number and saves nothing; the range's change (the pointer let go, or a key
// step), Enter in the number or leaving it saves once. Values are held to min and max.
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import layout from '@/renderer/ui/layout.module.css'
import styles from './slider-field.module.css'

export type SliderFieldProps = {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit?: string
  disabled?: boolean
  onCommit: (value: number) => void
}

const decimalsOf = (step: number) => (String(step).split('.')[1] ?? '').length

export function SliderField(props: SliderFieldProps) {
  const { min, max, step } = props
  const id = useId()
  const range = useRef<HTMLInputElement>(null)
  const [stored, setStored] = useState(props.value)
  const [shown, setShown] = useState(props.value)
  const [text, setText] = useState(String(props.value))
  const [sent, setSent] = useState(props.value)
  if (stored !== props.value) {
    setStored(props.value)
    setShown(props.value)
    setText(String(props.value))
    setSent(props.value)
  }

  const fit = (n: number) =>
    Math.min(max, Math.max(min, Number((Math.round(n / step) * step).toFixed(decimalsOf(step)))))

  function show(n: number) {
    setShown(n)
    setText(String(n))
  }

  function commit(n: number) {
    const value = fit(n)
    show(value)
    if (value === sent) return
    setSent(value)
    props.onCommit(value)
  }

  // React's onChange follows every move; the native change event is the end of one.
  const latest = useRef(commit)
  useEffect(() => {
    latest.current = commit
  })
  useEffect(() => {
    const input = range.current
    if (!input) return
    const onChange = () => latest.current(Number(input.value))
    input.addEventListener('change', onChange)
    return () => input.removeEventListener('change', onChange)
  }, [])

  const typed = (): number | null => {
    const n = Number(text.trim())
    return text.trim() === '' || !Number.isFinite(n) ? null : n
  }

  function saveText() {
    const n = typed()
    if (n === null) show(shown)
    else commit(n)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      saveText()
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      const from = typed() ?? shown
      show(fit(from + (event.key === 'ArrowUp' ? step : -step)))
    }
  }

  return (
    <div className={`${layout.field} ${layout.inline}`}>
      <label className={layout.label} htmlFor={id}>
        {props.label}
      </label>
      <div className={styles.controls}>
        <input
          ref={range}
          id={id}
          className={styles.range}
          type="range"
          min={min}
          max={max}
          step={step}
          disabled={props.disabled}
          value={shown}
          onChange={(event) => show(fit(Number(event.target.value)))}
          onPointerUp={() => commit(shown)}
        />
        <div className={`${layout.unitBox} ${styles.number}`}>
          <input
            type="text"
            inputMode="decimal"
            role="spinbutton"
            aria-label={`${props.label} value`}
            aria-valuenow={shown}
            aria-valuemin={min}
            aria-valuemax={max}
            disabled={props.disabled}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={onKeyDown}
            onBlur={saveText}
          />
          {props.unit && <span className={layout.unit}>{props.unit}</span>}
        </div>
      </div>
    </div>
  )
}

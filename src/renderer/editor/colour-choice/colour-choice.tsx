// spec/editor.md, "Properties panel": colour-choice (LK-5), the labelled colour field of the Box,
// Shade and Background colour sections. A #RRGGBB field, a colour picker, one button per palette
// colour and an optional "None" that sends null. The hex field saves on Enter or on leaving it; a
// value that is not #RRGGBB sends nothing and goes back. The picker saves once, on its change
// event (the choice made), not on each move. The swatches are named "Palette {hex} for {label}"
// so several of these fields on one panel do not share a name with the text "Colour" swatches.
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { useDraft } from '@/renderer/editor/number-field'
import { HEX_COLOUR } from '@/shared/schemas/layer'
import styles from './colour-choice.module.css'

export type ColourChoiceProps = {
  label: string
  // "#RRGGBB", or null for no colour (shown as an empty field).
  value: string | null
  palette: string[]
  disabled: boolean
  // Shows a "None" button that sends null.
  allowNone?: boolean
  hint?: string
  // Resolves to the refusal message, or null when the value was saved.
  onCommit: (value: string | null) => Promise<string | null>
}

const same = (a: string | null, b: string) => a !== null && a.toLowerCase() === b.toLowerCase()

export function ColourChoice(props: ColourChoiceProps) {
  const id = useId()
  const picker = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const draft = useDraft(props.value ?? '', props.onCommit)
  const latest = useRef(draft.save)
  useEffect(() => {
    latest.current = draft.save
  })
  useEffect(() => {
    const input = picker.current
    if (!input) return
    const onChange = () => void latest.current(input.value.toUpperCase())
    input.addEventListener('change', onChange)
    return () => input.removeEventListener('change', onChange)
  }, [])

  const save = () => {
    const hex = draft.text.trim()
    if (HEX_COLOUR.test(hex)) void draft.save(hex)
    else draft.reset()
  }
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    save()
  }
  const pick = async (value: string | null) => setError(await props.onCommit(value))
  const message = draft.error ?? error
  const shown = HEX_COLOUR.test(draft.text) ? draft.text : (props.value ?? '#000000')
  const described = [props.hint && `${id}-hint`, message && `${id}-error`].filter(Boolean)

  return (
    <div role="group" aria-labelledby={`${id}-label`} className={styles.field}>
      <label id={`${id}-label`} className={styles.label} htmlFor={id}>
        {props.label}
      </label>
      <div className={styles.row}>
        <input
          id={id}
          className={styles.hex}
          aria-describedby={described.length > 0 ? described.join(' ') : undefined}
          disabled={props.disabled}
          value={draft.text}
          onChange={(event) => draft.setText(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={save}
        />
        <input
          ref={picker}
          type="color"
          className={styles.picker}
          aria-label={`${props.label} picker`}
          disabled={props.disabled}
          value={shown.toLowerCase()}
          onChange={(event) => draft.setText(event.target.value.toUpperCase())}
        />
      </div>
      {(props.palette.length > 0 || props.allowNone) && (
        <div className={styles.swatches}>
          {props.allowNone && (
            <button
              type="button"
              className={styles.none}
              aria-pressed={props.value === null}
              disabled={props.disabled}
              onClick={() => void pick(null)}
            >
              None
            </button>
          )}
          {props.palette.map((hex) => (
            <button
              key={hex}
              type="button"
              className={styles.swatch}
              style={{ background: hex }}
              aria-label={`Palette ${hex} for ${props.label.toLowerCase()}`}
              aria-pressed={same(props.value, hex)}
              disabled={props.disabled}
              onClick={() => void pick(hex)}
            />
          ))}
        </div>
      )}
      {props.hint && (
        <p id={`${id}-hint`} className={styles.hint}>
          {props.hint}
        </p>
      )}
      {message && (
        <p id={`${id}-error`} className={styles.error}>
          {message}
        </p>
      )}
    </div>
  )
}

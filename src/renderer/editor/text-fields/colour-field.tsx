// spec/editor.md, "Properties panel", "Text": "Colour", a #RRGGBB field, a colour picker and one
// button per colour of the campaign's palette, each labelled "Palette colour {hex}". The picker
// saves once, on its change event (the choice made), not on each move of its input event.
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { useDraft } from '@/renderer/editor/number-field'
import { HEX_COLOUR } from '@/shared/schemas/layer'
import styles from './text-fields.module.css'

type Props = {
  color: string
  palette: string[]
  disabled: boolean
  onCommit: (color: string) => Promise<string | null>
}

export function ColourField(props: Props) {
  const id = useId()
  const picker = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const draft = useDraft(props.color, props.onCommit)
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
  const pick = async (hex: string) => setError(await props.onCommit(hex))
  const message = draft.error ?? error

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        Colour
      </label>
      <div className={styles.row}>
        <input
          id={id}
          className={styles.hex}
          aria-describedby={message ? `${id}-error` : undefined}
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
          aria-label="Colour picker"
          disabled={props.disabled}
          value={HEX_COLOUR.test(draft.text) ? draft.text.toLowerCase() : props.color.toLowerCase()}
          onChange={(event) => draft.setText(event.target.value.toUpperCase())}
        />
      </div>
      {props.palette.length > 0 && (
        <div className={styles.swatches}>
          {props.palette.map((hex) => (
            <button
              key={hex}
              type="button"
              className={styles.swatch}
              style={{ background: hex }}
              aria-label={`Palette colour ${hex}`}
              aria-pressed={hex.toLowerCase() === props.color.toLowerCase()}
              disabled={props.disabled}
              onClick={() => void pick(hex)}
            />
          ))}
        </div>
      )}
      {message && (
        <p id={`${id}-error`} className={styles.error}>
          {message}
        </p>
      )}
    </div>
  )
}

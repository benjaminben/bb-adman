// spec/editor.md, "Layer list", Rename: the inline field. Enter saves, Escape cancels; leaving
// the field saves too. An empty or unchanged name saves nothing. Both keys are preventDefault-ed,
// so the editor's Escape does not also clear the selection.
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import styles from './layer-row.module.css'

export function NameField(props: { name: string; onDone: (name: string | null) => void }) {
  const field = useRef<HTMLInputElement>(null)
  const finished = useRef(false)
  const [value, setValue] = useState(props.name)
  useEffect(() => {
    field.current?.focus()
    field.current?.select()
  }, [])

  function finish(name: string | null) {
    if (finished.current) return
    finished.current = true
    const kept = name?.trim() ?? ''
    props.onDone(kept && kept !== props.name ? kept : null)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Escape' && event.key !== 'Enter') return
    event.preventDefault()
    event.stopPropagation()
    finish(event.key === 'Enter' ? value : null)
  }

  return (
    <input
      ref={field}
      className={styles.field}
      aria-label="Layer name"
      value={value}
      maxLength={100}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={onKeyDown}
      onBlur={() => finish(value)}
    />
  )
}

// The variant's title field in the top bar: Enter gives the trimmed title, Escape gives null.
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import styles from './top-bar.module.css'

export type TitleFieldProps = { title: string; onDone: (title: string | null) => void }

export function TitleField(props: TitleFieldProps) {
  const field = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState(props.title)
  useEffect(() => field.current?.focus(), [])
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      props.onDone(null)
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      props.onDone(value.trim())
    }
  }
  return (
    <input
      ref={field}
      className={styles.field}
      aria-label="Variant title"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={onKeyDown}
    />
  )
}

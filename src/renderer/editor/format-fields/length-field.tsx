// P7-17: "Length (seconds)", a number with one decimal from 0.5 to 86,400. Enter or leaving the
// field sends it once; Escape puts the stored value back. Text that is not a number goes back
// to the stored value and sends nothing; a number out of range is brought inside it.
import { useId, useState, type KeyboardEvent } from 'react'
import { MAX_DURATION_MS, MIN_DURATION_MS } from '@/shared/schemas/commands/variant'
import styles from './format-fields.module.css'

export type LengthFieldProps = {
  durationMs: number
  // Resolves true when the length was saved.
  onCommit: (durationMs: number) => Promise<boolean>
}

const TENTH_MS = 100

export const secondsText = (ms: number): string => (ms / 1000).toFixed(1)

// The typed seconds as whole tenths in milliseconds, inside the range; null when not a number.
export function lengthMs(text: string): number | null {
  const trimmed = text.trim()
  const seconds = Number(trimmed)
  if (trimmed === '' || !Number.isFinite(seconds)) return null
  const ms = Math.round(seconds * 10) * TENTH_MS
  return Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, ms))
}

export function LengthField(props: LengthFieldProps) {
  const id = useId()
  const stored = secondsText(props.durationMs)
  const [base, setBase] = useState(stored)
  const [text, setText] = useState(stored)
  const [sent, setSent] = useState(stored)
  if (base !== stored) {
    setBase(stored)
    setText(stored)
    setSent(stored)
  }

  function reset() {
    setText(stored)
    setSent(stored)
  }

  async function save() {
    const ms = lengthMs(text)
    if (ms === null) return reset()
    const shown = secondsText(ms)
    setText(shown)
    if (text.trim() === sent || shown === sent) return
    setSent(shown)
    if (!(await props.onCommit(ms))) reset()
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      void save()
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      reset()
    }
  }

  return (
    <div className={styles.length}>
      <label className={styles.label} htmlFor={id}>
        Length (seconds)
      </label>
      <input
        id={id}
        className={styles.input}
        type="text"
        inputMode="decimal"
        size={7}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => void save()}
      />
    </div>
  )
}

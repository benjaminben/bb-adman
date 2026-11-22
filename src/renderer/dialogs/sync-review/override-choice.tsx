// spec/screens-variants.md, "Sync review": a path the change would write that was changed on
// this variant. DLG-7: the path's words, then a Segmented "Mine" | "Master" drawn from radios
// that keep the names "Keep mine" (the default) and "Take the master's".
import { useId } from 'react'
import type { Choice } from './decisions'
import { pathWords } from './sync-words'
import styles from './sync-review.module.css'

export type OverrideChoiceProps = {
  path: string
  choice: Choice
  disabled: boolean
  onChoose: (choice: Choice) => void
}

const OPTIONS: Array<[Choice, string, string]> = [
  ['keep-mine', 'Mine', 'Keep mine'],
  ['take-master', 'Master', "Take the master's"],
]

export function OverrideChoice(props: OverrideChoiceProps) {
  const name = useId()
  const words = pathWords(props.path)
  return (
    <div className={styles.choice}>
      <span className={styles.words}>{words}</span>
      <div
        role="radiogroup"
        aria-label={`Changed on this variant: ${words}`}
        className={styles.seg}
      >
        {OPTIONS.map(([value, label, spoken]) => (
          <label key={value} className={styles.segment}>
            <input
              type="radio"
              name={name}
              value={value}
              aria-label={spoken}
              checked={props.choice === value}
              disabled={props.disabled}
              onChange={() => props.onChoose(value)}
            />
            {label}
          </label>
        ))}
      </div>
    </div>
  )
}

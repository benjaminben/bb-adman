// spec/screens-variants.md, "Sync review": a path the change would write that was changed on
// this variant, with "Keep mine" (the default) and "Take the master's".
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

const OPTIONS: Array<[Choice, string]> = [
  ['keep-mine', 'Keep mine'],
  ['take-master', "Take the master's"],
]

export function OverrideChoice(props: OverrideChoiceProps) {
  const name = useId()
  return (
    <fieldset role="radiogroup" className={styles.choice}>
      <legend>Changed on this variant: {pathWords(props.path)}</legend>
      {OPTIONS.map(([value, label]) => (
        <label key={value} className={styles.option}>
          <input
            type="radio"
            name={name}
            value={value}
            checked={props.choice === value}
            disabled={props.disabled}
            onChange={() => props.onChoose(value)}
          />
          {label}
        </label>
      ))}
    </fieldset>
  )
}

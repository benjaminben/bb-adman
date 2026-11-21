// The brief form's "Languages" field (spec/screens-campaign.md, "The brief form", Languages;
// FR-026): tags typed as text, split on commas and spaces by the model, with the hint.
import { useId } from 'react'
import styles from './brief-form.module.css'

export function LanguageField(props: { value: string; onChange: (text: string) => void }) {
  const hint = useId()
  return (
    <div className={styles.block}>
      <label className={styles.field}>
        Languages
        <input
          value={props.value}
          aria-describedby={hint}
          onChange={(e) => props.onChange(e.target.value)}
        />
      </label>
      <p id={hint} className={styles.hint}>
        Language tags such as en or fr-CA, separated by commas. The first is the campaign&apos;s
        main language.
      </p>
    </div>
  )
}

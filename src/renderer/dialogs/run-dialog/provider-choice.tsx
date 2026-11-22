// The run dialog's "Provider" (DLG-4a; spec/app-style-parts.md "Field", Segmented): two to four
// choices are one row of segments, each a radio named by the provider; five or more are a
// select. A disabled choice shows only its name and gives its reason in `title`. An offered
// trial workflow shows a small "Trial" mark; R3-2: the model is a second, muted line under the
// provider (an option of the select names both on one line); the radio is described by it, read "(trial)" as
// before. The choices themselves come from run-choices.ts.
import { useId } from 'react'
import layout from '@/renderer/ui/layout.module.css'
import { ProviderName } from '@/renderer/ui/provider-name'
import { providerModelWords } from '@/shared/providers/model-words'
import type { Choice } from './run-choices'
import styles from './run-dialog.module.css'

export { runChoices, startChoice, type Choice } from './run-choices'

type Props = {
  choices: Choice[]
  value: string | null
  onChange: (id: string) => void
  disabled: boolean
}

// The most choices drawn as segments; more become a select.
const SEGMENTS = 4

function TrialMark(props: { id?: string }) {
  return (
    <span id={props.id} className={styles.trial}>
      <span aria-hidden="true">Trial</span>
      <span className={styles.hidden}>(trial)</span>
    </span>
  )
}

function Segments(props: Props) {
  const name = useId()
  return (
    <fieldset className={styles.choices} disabled={props.disabled}>
      <legend>Provider</legend>
      <div className={styles.seg}>
        {props.choices.map((c) => {
          const id = `${name}-${c.provider.id}`
          return (
            <div key={c.provider.id} className={styles.choice} title={c.reason}>
              <input
                type="radio"
                id={id}
                name={name}
                value={c.provider.id}
                checked={props.value === c.provider.id}
                disabled={!c.enabled}
                title={c.reason}
                aria-label={providerModelWords(c.provider.label, c.model)}
                aria-describedby={c.trial ? `${id}-trial` : undefined}
                onChange={() => props.onChange(c.provider.id)}
              />
              <label htmlFor={id}>
                <ProviderName label={c.provider.label} model={c.model} />
              </label>
              {c.trial && <TrialMark id={`${id}-trial`} />}
            </div>
          )
        })}
      </div>
    </fieldset>
  )
}

function ProviderSelect(props: Props) {
  const id = useId()
  const chosen = props.choices.find((c) => c.provider.id === props.value)
  return (
    <div className={`${layout.field} ${layout.inline}`}>
      <label htmlFor={id}>Provider</label>
      <div className={styles.selectRow}>
        <select
          id={id}
          value={props.value ?? ''}
          disabled={props.disabled}
          onChange={(e) => props.onChange(e.target.value)}
        >
          {props.value === null && <option value="" />}
          {props.choices.map((c) => (
            <option
              key={c.provider.id}
              value={c.provider.id}
              disabled={!c.enabled}
              title={c.reason}
            >
              {providerModelWords(c.provider.label, c.model)}
            </option>
          ))}
        </select>
        {chosen?.trial && <TrialMark />}
      </div>
    </div>
  )
}

export function ProviderChoice(props: Props) {
  return props.choices.length > SEGMENTS ? <ProviderSelect {...props} /> : <Segments {...props} />
}

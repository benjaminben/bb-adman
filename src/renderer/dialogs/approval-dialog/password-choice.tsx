// The two password choices (spec/approvals.md "The approval link dialog"): "Make a password for
// me" (the default) and "Choose a password" with its field. Used to make a link and to set a
// new password. The typed password is the user's own; it is sent once and never shown.
import { useId } from 'react'
import layout from '@/renderer/ui/layout.module.css'
import styles from './approval-dialog.module.css'

export type PasswordChoiceValue = { kind: 'make' } | { kind: 'choose'; password: string }

export const MAKE_PASSWORD: PasswordChoiceValue = { kind: 'make' }
const MIN_LENGTH = 12

// Whether the choice can be sent: a chosen password needs 12 characters or more.
export function choiceReady(choice: PasswordChoiceValue): boolean {
  return choice.kind === 'make' || choice.password.length >= MIN_LENGTH
}

// The command's extra input: no password means the main process makes one.
export function choiceInput(choice: PasswordChoiceValue): { password?: string } {
  return choice.kind === 'choose' ? { password: choice.password } : {}
}

type Props = {
  legend: string
  value: PasswordChoiceValue
  onChange: (value: PasswordChoiceValue) => void
  disabled: boolean
}

export function PasswordChoice(props: Props) {
  const id = useId()
  const choose = props.value.kind === 'choose'
  return (
    <fieldset className={styles.choices} disabled={props.disabled}>
      <legend className={layout.label}>{props.legend}</legend>
      <label className={layout.row}>
        <input
          type="radio"
          name={`${id}-choice`}
          checked={!choose}
          onChange={() => props.onChange(MAKE_PASSWORD)}
        />
        Make a password for me
      </label>
      <label className={layout.row}>
        <input
          type="radio"
          name={`${id}-choice`}
          checked={choose}
          onChange={() => props.onChange({ kind: 'choose', password: '' })}
        />
        Choose a password
      </label>
      {props.value.kind === 'choose' && (
        <div className={layout.field}>
          <label htmlFor={`${id}-password`}>Password</label>
          <input
            id={`${id}-password`}
            type="password"
            autoComplete="new-password"
            aria-describedby={`${id}-hint`}
            value={props.value.password}
            onChange={(event) => props.onChange({ kind: 'choose', password: event.target.value })}
          />
          <span id={`${id}-hint`} className={layout.muted}>
            At least 12 characters.
          </span>
        </div>
      )}
    </fieldset>
  )
}

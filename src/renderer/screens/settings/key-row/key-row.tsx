// One key as an ObjectRow (SET-2): shown by its last four characters only, replaced or deleted
// (R-10). The group keeps the old name "{provider} {secret label}". The typed value is cleared
// before secret.set is sent, so it never stays in the page.
import { useState, type FormEvent } from 'react'
import { useApp } from '@/renderer/app/app-context'
import { secretLabel } from '@/renderer/ui/secret-labels'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import type { SecretName } from '@/shared/schemas/secrets'
import { Icon } from '@/renderer/ui/icon'
import { ObjectRow } from '@/renderer/ui/object-row'
import { StatusMark } from '@/renderer/ui/status-mark'
import layout from '@/renderer/ui/layout.module.css'
import styles from './key-row.module.css'

// The provider's label, or the secret's own label where the provider has several or the
// secret is not an API key ("Access key ID").
function rowName(provider: ProviderInfo, name: SecretName): string {
  const plain = provider.secrets.length === 1 && name.endsWith('.apiKey')
  return plain ? provider.label : secretLabel(name)
}

// The whole row is a pointer target for the row's own action; keyboard and screen reader users
// reach the same action through the named mark or button, so the cover is hidden from them.
const COVER = { tabIndex: -1, 'aria-hidden': true } as const

export function KeyRow(props: { provider: ProviderInfo; name: SecretName }) {
  const { provider, name } = props
  const saved = useApp((s) => s.app?.secrets.find((x) => x.name === name))
  const command = useApp((s) => s.command)
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const label = `${provider.label} ${secretLabel(name)}`
  const fieldId = `key-${name}`
  const lastFour = saved ? saved.lastFour || '…' : ''

  async function save(event: FormEvent) {
    event.preventDefault()
    // Clear the field before the call: the row may say "Saved" before the reply arrives.
    const typed = value
    setValue('')
    const result = await command('secret.set', { name, value: typed })
    if (result.ok) setEditing(false)
  }

  const form = (
    <form className={styles.form} onSubmit={(e) => void save(e)}>
      <label htmlFor={fieldId} className={styles.visuallyHidden}>
        New {label}
      </label>
      <input
        id={fieldId}
        type="password"
        autoComplete="off"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        required
      />
      <button type="submit" className={`${layout.primary} ${layout.small}`}>
        Save
      </button>
      <button
        type="button"
        className={`${layout.quiet} ${layout.small}`}
        onClick={() => setEditing(false)}
      >
        Cancel
      </button>
    </form>
  )

  const actions = saved ? (
    <button
      type="button"
      className={layout.iconButton}
      aria-label="Delete key"
      title="Delete key"
      onClick={() => void command('secret.delete', { name })}
    >
      <Icon name="trash" />
    </button>
  ) : (
    <span className={styles.add}>
      <button
        type="button"
        className={`${layout.secondary} ${layout.small}`}
        onClick={() => setEditing(true)}
      >
        Add key
      </button>
    </span>
  )

  return (
    <div role="group" aria-label={label} className={styles.row}>
      <ObjectRow
        label={label}
        name={rowName(provider, name)}
        thumb={<Icon name="key" />}
        marks={
          saved ? (
            <StatusMark
              tone="ok"
              label={`•••${lastFour}`}
              tip={`Key saved, ends in ${lastFour}. Replace`}
              onClick={() => setEditing(true)}
            />
          ) : (
            <StatusMark tone="none" label="Not set" tip="Not set" />
          )
        }
        stateActions={editing ? form : actions}
        onSelect={() => setEditing(true)}
        mainProps={COVER}
      />
    </div>
  )
}

// A provider not yet available: a faded row with its label and "Soon", no buttons.
export function SoonRow(props: { provider: ProviderInfo }) {
  return (
    <div role="group" aria-label={props.provider.label} className={`${styles.row} ${styles.soon}`}>
      <ObjectRow
        label={props.provider.label}
        name={props.provider.label}
        thumb={<Icon name="key" />}
        marks={<StatusMark tone="none" label="Soon" tip="Not yet available" />}
        mainProps={COVER}
      />
    </div>
  )
}

// One saved key: shown by its last four characters only, replaced or deleted (R-10).
import { useState, type FormEvent } from 'react'
import { useApp } from '../../app/app-context'
import { secretLabel } from '../../ui/secret-labels'
import type { ProviderInfo } from '../../../shared/schemas/queries/app'
import type { SecretName } from '../../../shared/schemas/secrets'
import styles from '../screens.module.css'

export function KeyRow(props: { provider: ProviderInfo; name: SecretName }) {
  const { provider, name } = props
  const saved = useApp((s) => s.app?.secrets.find((x) => x.name === name))
  const command = useApp((s) => s.command)
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const label = `${provider.label} ${secretLabel(name)}`
  const fieldId = `key-${name}`

  async function save(event: FormEvent) {
    event.preventDefault()
    // Clear the field before the call: the row may say "Saved" before the reply arrives.
    const typed = value
    setValue('')
    const result = await command('secret.set', { name, value: typed })
    if (result.ok) setEditing(false)
  }

  return (
    <fieldset className={styles.keyRow}>
      <legend>{label}</legend>
      <span>{saved ? `Saved, ends in ${saved.lastFour || '…'}` : 'Not set'}</span>
      {editing ? (
        <form className={styles.row} onSubmit={(e) => void save(e)}>
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
          <button type="submit" className={styles.primary}>
            Save
          </button>
          <button type="button" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </form>
      ) : (
        <div className={styles.row}>
          <button type="button" onClick={() => setEditing(true)}>
            {saved ? 'Replace' : 'Add'}
          </button>
          {saved && (
            <button type="button" onClick={() => void command('secret.delete', { name })}>
              Delete
            </button>
          )}
        </div>
      )}
    </fieldset>
  )
}

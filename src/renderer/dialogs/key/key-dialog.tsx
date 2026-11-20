// The key dialog of the NEEDS_KEY flow (FR-171): it opens when an action needs a key,
// saves it with secret.set, and reports back so the action can retry. Keys are not
// tested when entered (FR-172).
import { useState, type FormEvent } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useApi, useApp } from '../../app/app-context'
import { secretLabel } from '../../ui/secret-labels'
import type { SecretName } from '../../../shared/schemas/secrets'
import styles from './key-dialog.module.css'

export function KeyDialog() {
  const api = useApi()
  const request = useApp((s) => s.keyRequest)
  const refresh = useApp((s) => s.refresh)
  const [values, setValues] = useState<Partial<Record<SecretName, string>>>({})
  const [error, setError] = useState<string | null>(null)

  function finish(saved: boolean) {
    setValues({})
    setError(null)
    request?.resolve(saved)
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!request) return
    for (const name of request.provider.secrets) {
      const result = await api.command('secret.set', { name, value: values[name] ?? '' })
      if (!result.ok) return setError(result.error.message)
    }
    await refresh()
    finish(true)
  }

  return (
    <Dialog.Root open={request !== null} onOpenChange={(open) => !open && finish(false)}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content}>
          <Dialog.Title>Add your {request?.provider.label} key</Dialog.Title>
          <Dialog.Description>
            The key is stored encrypted on this computer and is used only for actions you start.
          </Dialog.Description>
          <form onSubmit={(e) => void save(e)}>
            {request?.provider.secrets.map((name) => (
              <div key={name} className={styles.field}>
                <label htmlFor={`dialog-${name}`}>{secretLabel(name)}</label>
                <input
                  id={`dialog-${name}`}
                  type="password"
                  autoComplete="off"
                  required
                  value={values[name] ?? ''}
                  onChange={(e) => setValues({ ...values, [name]: e.target.value })}
                />
              </div>
            ))}
            {error && <p role="alert">{error}</p>}
            <div className={styles.actions}>
              <Dialog.Close asChild>
                <button type="button">Cancel</button>
              </Dialog.Close>
              <button type="submit" className={styles.primary}>
                Save and continue
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

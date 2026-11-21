// The key dialog of the NEEDS_KEY flow (FR-171): it opens when an action needs a key,
// saves it with secret.set, and reports back so the action can retry. Keys are not
// tested when entered (FR-172).
import { useState, type FormEvent } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useApi, useApp } from '@/renderer/app/app-context'
import { secretLabel } from '@/renderer/ui/secret-labels'
import type { SecretName } from '@/shared/schemas/secrets'
import layout from '@/renderer/ui/layout.module.css'
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
          <div className={styles.head}>
            <Dialog.Title className={styles.title}>
              Add your {request?.provider.label} key
            </Dialog.Title>
            <Dialog.Description className={styles.description}>
              The key is stored encrypted on this computer and is used only for actions you start.
            </Dialog.Description>
          </div>
          <form className={styles.form} onSubmit={(e) => void save(e)}>
            <div className={styles.body}>
              {request?.provider.secrets.map((name) => (
                <div key={name} className={layout.field}>
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
              {error && (
                <p role="alert" className={`${layout.notice} ${layout.danger}`}>
                  {error}
                </p>
              )}
            </div>
            <div className={styles.foot}>
              <Dialog.Close asChild>
                <button type="button">Cancel</button>
              </Dialog.Close>
              <button type="submit" className={layout.primary}>
                Save and continue
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// Settings: the models whose commercial licence the user confirmed (spec/screens-campaign.md,
// "Settings: confirmed licences"; D-088). The names come from the settings file and are drawn
// as text only. "Forget" saves the list without that name, so the next run of that model asks
// again. While one is sent, every Forget waits.
import { useState } from 'react'
import { EMPTY, useApp } from '@/renderer/app/app-context'
import { NoticeLine } from '@/renderer/screens/settings/notice-line'
import layout from '@/renderer/ui/layout.module.css'
import styles from './licence-list.module.css'

export function LicenceList() {
  const command = useApp((s) => s.command)
  const saved = useApp((s) => s.app?.settings.licenceConfirmed ?? EMPTY)
  const [sending, setSending] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)

  async function forget(model: string) {
    setSending(true)
    try {
      const result = await command('settings.update', {
        licenceConfirmed: saved.filter((name) => name !== model),
      })
      setRefusal(result.ok ? null : result.error.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      <h3>Licences you confirmed</h3>
      {saved.length === 0 ? (
        <p className={layout.muted}>You have not confirmed a commercial license for any model.</p>
      ) : (
        <ul className={styles.list}>
          {saved.map((model) => (
            <li key={model} className={layout.row}>
              <span className={styles.name}>{model}</span>
              <button
                type="button"
                aria-label={`Forget ${model}`}
                disabled={sending}
                onClick={() => void forget(model)}
              >
                Forget
              </button>
            </li>
          ))}
        </ul>
      )}
      {refusal !== null && <NoticeLine kind="danger">{refusal}</NoticeLine>}
    </div>
  )
}

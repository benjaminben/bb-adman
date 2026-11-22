// Settings: the models whose commercial licence the user confirmed, a folded Section with the
// count on its header (SET-2) (spec/screens-campaign.md,
// "Settings: confirmed licences"; D-088). The names come from the settings file and are drawn
// as text only. "Forget" saves the list without that name, so the next run of that model asks
// again. While one is sent, every Forget waits.
import { useState } from 'react'
import { EMPTY, useApp } from '@/renderer/app/app-context'
import { NoticeLine } from '@/renderer/screens/settings/notice-line'
import { Section } from '@/renderer/ui/section'
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
    <Section
      id="settings.licences"
      title="Licences"
      level={4}
      fold="closed"
      summary={String(saved.length)}
    >
      {saved.length === 0 ? (
        <p className={layout.muted}>None confirmed</p>
      ) : (
        <ul className={styles.list}>
          {saved.map((model) => (
            <li key={model} className={layout.row}>
              <span className={styles.name}>{model}</span>
              <button
                type="button"
                className={layout.quiet}
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
    </Section>
  )
}

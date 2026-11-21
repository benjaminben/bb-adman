// Settings: the approvals service (spec/approvals.md "Settings", "Screens"). The address is
// saved with approvals.setService; the key uses the Settings key row, so a saved key is shown
// by its last four only and the typed one is cleared before secret.set is sent. "Test
// connection" sends approvals.check and shows "Connected." or the refusal's own sentence.
import { useState } from 'react'
import { useApp } from '@/renderer/app/app-context'
import { KeyRow } from '@/renderer/screens/settings/key-row'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import { NoticeIcon, noticeClass, type NoticeKind } from '@/renderer/screens/settings/notice-line'
import layout from '@/renderer/ui/layout.module.css'
import { AddressForm } from './address-form'
import styles from './approvals-section.module.css'

// The approvals service is not a provider; the key row needs only a label and the secret.
const SERVICE: ProviderInfo = {
  id: 'approvals',
  label: 'Service',
  jobs: [],
  available: true,
  secrets: ['approvals.apiKey'],
  defaultModels: {},
  local: false,
  cancel: 'none',
  serverText: false,
}

const CONNECTED = 'Connected.'

type Check = { state: 'testing' } | { state: 'done'; line: string } | null

export function ApprovalsSection() {
  const saved = useApp((s) => s.app?.settings.approvals.baseUrl ?? null)
  const command = useApp((s) => s.command)
  const [check, setCheck] = useState<Check>(null)

  async function testConnection() {
    setCheck({ state: 'testing' })
    const reply = await command('approvals.check', {})
    setCheck({ state: 'done', line: reply.ok ? CONNECTED : reply.error.message })
  }

  const kind: NoticeKind | null =
    check?.state === 'done' ? (check.line === CONNECTED ? 'ok' : 'danger') : null

  return (
    <section className={layout.card} aria-labelledby="approvals-title">
      <h2 id="approvals-title">Approvals service</h2>
      <p className={layout.muted}>
        Share a campaign&apos;s variants with a password-protected link and see who signed off. The
        service runs on your own Vercel account.
      </p>
      {/* A new save remounts the form with the stored origin; a refused one changes nothing. */}
      <AddressForm key={saved ?? 'none'} saved={saved} onSaved={() => setCheck(null)} />
      <KeyRow provider={SERVICE} name="approvals.apiKey" />
      <div className={styles.check}>
        <div className={layout.row}>
          <button
            type="button"
            disabled={check?.state === 'testing'}
            onClick={() => void testConnection()}
          >
            Test connection
          </button>
        </div>
        {check !== null && (
          // One status line for both states, so the reader hears the change in place.
          <p role="status" className={kind === null ? undefined : noticeClass(kind)}>
            {kind !== null && <NoticeIcon kind={kind} />}
            {check.state === 'testing' ? 'Testing…' : check.line}
          </p>
        )}
      </div>
      <p className={layout.muted}>
        Pictures for the gallery are kept in your Amazon S3 bucket (Cloud storage, above).
      </p>
    </section>
  )
}

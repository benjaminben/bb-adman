// Settings: the approvals service (SET-4; spec/approvals.md "Settings", "Screens"), one row. The
// address is saved with approvals.setService by its own Save; the key uses the Settings key row,
// so a saved key is shown by its last four only and the typed one is cleared before secret.set
// is sent. "Test" sends approvals.check only on the user's click; its result is not stored and
// clears when a new address is saved. The line that says where gallery pictures go stays under
// the row; its "Amazon S3" opens the S3 row on the same page.
import { useState } from 'react'
import { useApp } from '@/renderer/app/app-context'
import { KeyRow } from '@/renderer/screens/settings/key-row'
import { revealS3Row } from '@/renderer/screens/settings/s3-section'
import {
  CheckMark,
  CheckNotice,
  ServiceRow,
  TestButton,
  type CheckResult,
} from '@/renderer/screens/settings/s3-check'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import { InfoTip } from '@/renderer/ui/info-tip'
import { Section } from '@/renderer/ui/section'
import layout from '@/renderer/ui/layout.module.css'
import { AddressForm } from './address-form'

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

type Check = { testing: boolean; result: CheckResult | null }

function hostOf(address: string): string {
  try {
    return new URL(address).host
  } catch {
    return address
  }
}

export function ApprovalsSection() {
  const saved = useApp((s) => s.app?.settings.approvals.baseUrl ?? null)
  const command = useApp((s) => s.command)
  const [check, setCheck] = useState<Check>({ testing: false, result: null })
  const [open, setOpen] = useState(saved === null)

  async function test() {
    setCheck({ testing: true, result: null })
    const reply = await command('approvals.check', {})
    const sentence = reply.ok ? CONNECTED : reply.error.message
    setCheck({ testing: false, result: { ok: reply.ok, sentence } })
  }

  const setUp = saved === null ? null : { label: hostOf(saved), tip: `Set up: ${saved}` }
  const clear = () => setCheck({ testing: false, result: null })

  return (
    <Section id="settings.approvals" title="Approvals service" level={3}>
      <ServiceRow
        id="approvals"
        name="Approvals"
        info={
          <InfoTip about="approvals service">
            Share a campaign&apos;s variants with a password-protected link and see who signed off.
            The service runs on your own Vercel account.
          </InfoTip>
        }
        mark={<CheckMark result={check.result} setUp={setUp} />}
        action={
          <TestButton
            missing={saved === null ? 'Save an address first' : null}
            testing={check.testing}
            onTest={() => void test()}
          />
        }
        notices={<CheckNotice result={check.result} />}
        line={
          <>
            Gallery pictures are kept in your{' '}
            <button type="button" className={layout.link} onClick={revealS3Row}>
              Amazon S3
            </button>{' '}
            bucket.
          </>
        }
        open={open}
        onToggle={() => setOpen(!open)}
        form={
          <>
            {/* A new save remounts the form with the stored origin; a refused one changes nothing. */}
            <AddressForm key={saved ?? 'none'} saved={saved} onSaved={clear} />
            <KeyRow provider={SERVICE} name="approvals.apiKey" />
          </>
        }
      />
    </Section>
  )
}

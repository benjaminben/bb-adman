// Settings: Cloud storage, the Dropbox row (SET-4; spec/phases/phase-09.md "Screens"; P9-6).
// Signed in means a saved refresh token and a saved account name. The account name comes from
// Dropbox and is drawn as text. The screen has no token field: it never sees a token, a code or
// the sign-in address, only { accountName } and each refusal's sentence. Sign in and Sign out
// are sent only on the user's click. The line that says where files go stays under the row.
import { useState } from 'react'
import { useApp, EMPTY } from '@/renderer/app/app-context'
import { ServiceRow } from '@/renderer/screens/settings/s3-check'
import { StatusMark } from '@/renderer/ui/status-mark'
import layout from '@/renderer/ui/layout.module.css'
import { DropboxFolder } from './dropbox-folder'
import { Refusal } from './refusal'
import styles from './dropbox-section.module.css'

const ABOUT = 'Adman keeps published files in its own folder in your Dropbox, under Apps.'
const WAITING = 'Waiting for you to finish in the browser…'

type Busy = 'signIn' | 'signOut' | null

export function DropboxSection() {
  const command = useApp((s) => s.command)
  const saved = useApp((s) => s.app?.settings.storage.dropbox ?? null)
  const hasToken = useApp((s) => s.app?.secrets ?? EMPTY).some(
    (secret) => secret.name === 'dropbox.refreshToken',
  )
  const signedIn = saved !== null && hasToken
  const [busy, setBusy] = useState<Busy>(null)
  const [refusal, setRefusal] = useState<string | null>(null)
  const [open, setOpen] = useState(!signedIn)

  async function send(kind: 'signIn' | 'signOut') {
    setBusy(kind)
    setRefusal(null)
    const name = kind === 'signIn' ? 'storage.dropboxSignIn' : 'storage.dropboxSignOut'
    const result = await command(name, {})
    setRefusal(result.ok ? null : result.error.message)
    setBusy(null)
  }

  const action = signedIn ? (
    <button
      type="button"
      className={`${layout.secondary} ${layout.small}`}
      disabled={busy !== null}
      onClick={() => void send('signOut')}
    >
      Sign out
    </button>
  ) : (
    <button
      type="button"
      className={`${layout.secondary} ${layout.small}`}
      aria-label="Sign in to Dropbox"
      disabled={busy !== null}
      onClick={() => void send('signIn')}
    >
      Sign in
    </button>
  )

  return (
    <ServiceRow
      id="dropbox"
      name="Dropbox"
      mark={<DropboxMark busy={busy} accountName={signedIn ? saved.accountName : null} />}
      action={action}
      notices={
        <>
          {busy === 'signIn' && (
            <p role="status" className={styles.hidden}>
              {WAITING}
            </p>
          )}
          {refusal !== null && <Refusal id="dropbox-refusal">{refusal}</Refusal>}
        </>
      }
      line={ABOUT}
      open={open}
      onToggle={signedIn ? () => setOpen(!open) : undefined}
      form={signedIn && <DropboxFolder key={saved.rootPath} saved={saved.rootPath} />}
    />
  )
}

function DropboxMark(props: { busy: Busy; accountName: string | null }) {
  if (props.busy === 'signIn') return <StatusMark tone="running" label="Waiting" tip={WAITING} />
  if (props.accountName !== null) {
    const tip = `Signed in as ${props.accountName}`
    return <StatusMark tone="ok" label={props.accountName} tip={tip} />
  }
  return <StatusMark tone="none" label="Not signed in" tip="Not signed in" />
}

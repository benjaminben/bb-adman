// Settings: Cloud storage, the Dropbox part (spec/phases/phase-09.md "Screens"; P9-6). Signed
// in means a saved refresh token and a saved account name. The account name comes from Dropbox
// and is drawn as text. The screen has no token field: it never sees a token, a code or the
// sign-in address, only { accountName } and each refusal's sentence.
import { useState } from 'react'
import { useApp, EMPTY } from '@/renderer/app/app-context'
import layout from '@/renderer/ui/layout.module.css'
import { DropboxFolder } from './dropbox-folder'
import { Refusal } from './refusal'
import styles from './dropbox-section.module.css'

const ABOUT = 'Adman keeps published files in its own folder in your Dropbox, under Apps.'
const WAITING = 'Waiting for you to finish in the browser…'

export function DropboxSection() {
  const command = useApp((s) => s.command)
  const saved = useApp((s) => s.app?.settings.storage.dropbox ?? null)
  const hasToken = useApp((s) => s.app?.secrets ?? EMPTY).some(
    (secret) => secret.name === 'dropbox.refreshToken',
  )
  const [busy, setBusy] = useState<'signIn' | 'signOut' | null>(null)
  const [refusal, setRefusal] = useState<string | null>(null)

  async function send(kind: 'signIn' | 'signOut') {
    setBusy(kind)
    setRefusal(null)
    const name = kind === 'signIn' ? 'storage.dropboxSignIn' : 'storage.dropboxSignOut'
    const result = await command(name, {})
    setRefusal(result.ok ? null : result.error.message)
    setBusy(null)
  }

  const signedIn = saved !== null && hasToken

  return (
    <div role="group" aria-labelledby="dropbox-title" className={styles.part}>
      <h3 id="dropbox-title" className={styles.subheading}>
        Dropbox
      </h3>
      <p className={layout.muted}>{ABOUT}</p>
      {signedIn ? (
        <>
          <p className={styles.line}>Signed in as {saved.accountName}.</p>
          <div className={layout.row}>
            <button type="button" disabled={busy !== null} onClick={() => void send('signOut')}>
              Sign out
            </button>
          </div>
        </>
      ) : (
        <>
          <p className={styles.line}>Not signed in.</p>
          <div className={layout.row}>
            <button
              type="button"
              className={layout.primary}
              disabled={busy !== null}
              onClick={() => void send('signIn')}
            >
              Sign in to Dropbox
            </button>
          </div>
          {busy === 'signIn' && (
            <p role="status" className={styles.line}>
              {WAITING}
            </p>
          )}
        </>
      )}
      {refusal !== null && <Refusal id="dropbox-refusal">{refusal}</Refusal>}
      {signedIn && <DropboxFolder key={saved.rootPath} saved={saved.rootPath} />}
    </div>
  )
}

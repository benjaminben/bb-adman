// The Dropbox sign-in button (SPEC 14 slice I). It works once slice G adds the command.
import { useState } from 'react'
import { useApp } from '../app/app-context'
import { failedText } from './result-text'
import styles from '../screens/screens.module.css'

export function DropboxSignIn() {
  const command = useApp((s) => s.command)
  const [status, setStatus] = useState('')

  async function signIn() {
    const result = await command('storage.dropboxSignIn', {})
    const name = result.ok ? (result.data as { accountName?: string } | null)?.accountName : ''
    setStatus(failedText(result) ?? `Signed in to Dropbox as ${name ?? ''}.`)
  }

  return (
    <div className={styles.card}>
      <h2>Dropbox</h2>
      <button type="button" onClick={() => void signIn()}>
        Sign in to Dropbox
      </button>
      <p role="status">{status}</p>
    </div>
  )
}

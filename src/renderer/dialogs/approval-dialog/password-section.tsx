// The live link's password (spec/approvals.md "The approval link dialog"; DLG-6b). "Copy
// password" (an icon button on the link row) reads approvals.getPassword on the click and writes
// it to the clipboard; the password is never put in state, drawn or logged. When this computer
// does not keep it, the line saying where it is. "New password…" (in the link row's menu) opens
// the two choices and "Set password".
import { useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import type { ApprovalsPassword } from '@/shared/schemas/queries/approvals'
import { MAKE_PASSWORD, PasswordChoice, choiceInput, choiceReady } from './password-choice'
import type { Sender } from './use-send'
import styles from './approval-dialog.module.css'

export const NOT_KEPT = 'The password is kept on the computer that made the link.'

type CopyInput = {
  projectId: string
  campaignId: string
  copy: (text: string) => Promise<void>
  onStatus: (line: string | null) => void
}

// `notKept` turns true when the service says this computer holds no password after all.
export function useCopyPassword(props: CopyInput) {
  const api = useApi()
  const [notKept, setNotKept] = useState(false)

  async function copyPassword() {
    props.onStatus(null)
    const input = { projectId: props.projectId, campaignId: props.campaignId }
    const result = await api.query('approvals.getPassword', input)
    if (!result.ok) return props.onStatus(result.error.message)
    const password = (result.data as ApprovalsPassword | null)?.password ?? null
    if (password === null) return setNotKept(true)
    await props.copy(password)
  }

  return { notKept, copyPassword }
}

// Shown only while open; closing it, by Cancel or after a sent password, forgets the choice and
// the typed value, since the part unmounts.
export function NewPassword(props: { sender: Sender; onClose: () => void }) {
  const { sender } = props
  const busy = sender.running !== null
  const [choice, setChoice] = useState(MAKE_PASSWORD)

  async function setPassword() {
    if (await sender.send('approvals.setPassword', choiceInput(choice))) props.onClose()
  }

  return (
    <div className={styles.section}>
      <PasswordChoice legend="New password" value={choice} onChange={setChoice} disabled={busy} />
      <p className={styles.line}>People who already opened the link must enter the new password.</p>
      <div className={styles.actions}>
        <button type="button" disabled={busy} onClick={props.onClose}>
          Cancel
        </button>
        <button
          type="button"
          disabled={busy || !choiceReady(choice)}
          onClick={() => void setPassword()}
        >
          Set password
        </button>
      </div>
    </div>
  )
}

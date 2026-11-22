// The live link's "Password" part (spec/approvals.md "The approval link dialog"): "Copy
// password" reads approvals.getPassword on the click and writes it to the clipboard; the
// password is never put in state, drawn or logged. When this computer does not keep it, the
// line saying where it is. Then "Set a new password…" with the two choices and "Set password".
import { useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import type { ApprovalsPassword } from '@/shared/schemas/queries/approvals'
import layout from '@/renderer/ui/layout.module.css'
import { MAKE_PASSWORD, PasswordChoice, choiceInput, choiceReady } from './password-choice'
import type { Sender } from './use-send'
import styles from './approval-dialog.module.css'

type Props = {
  projectId: string
  campaignId: string
  kept: boolean
  sender: Sender
  headingId: string
  copy: (text: string) => Promise<void>
  onStatus: (line: string | null) => void
}

const NOT_KEPT = 'The password is kept on the computer that made the link.'

export function PasswordSection(props: Props) {
  const api = useApi()
  const { sender } = props
  const busy = sender.running !== null
  const [notKept, setNotKept] = useState(false)
  const [open, setOpen] = useState(false)
  const [choice, setChoice] = useState(MAKE_PASSWORD)

  async function copyPassword() {
    props.onStatus(null)
    const input = { projectId: props.projectId, campaignId: props.campaignId }
    const result = await api.query('approvals.getPassword', input)
    if (!result.ok) return props.onStatus(result.error.message)
    const password = (result.data as ApprovalsPassword | null)?.password ?? null
    if (password === null) return setNotKept(true)
    await props.copy(password)
  }

  // Closing the part, by Cancel or after a sent password, forgets the choice and the typed value.
  function close() {
    setOpen(false)
    setChoice(MAKE_PASSWORD)
  }

  async function setPassword() {
    if (await sender.send('approvals.setPassword', choiceInput(choice))) close()
  }

  return (
    <section className={styles.section} aria-labelledby={props.headingId}>
      <h3 id={props.headingId} className={styles.heading}>
        Password
      </h3>
      {props.kept && !notKept ? (
        <div className={layout.row}>
          <button type="button" onClick={() => void copyPassword()}>
            Copy password
          </button>
        </div>
      ) : (
        <p className={styles.line}>{NOT_KEPT}</p>
      )}
      {open ? (
        <>
          <PasswordChoice
            legend="New password"
            value={choice}
            onChange={setChoice}
            disabled={busy}
          />
          <p className={styles.line}>
            People who already opened the link must enter the new password.
          </p>
          <div className={styles.actions}>
            <button type="button" disabled={busy} onClick={close}>
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
        </>
      ) : (
        <div className={layout.row}>
          <button type="button" disabled={busy} onClick={() => setOpen(true)}>
            Set a new password…
          </button>
        </div>
      )}
    </section>
  )
}

// No link yet (spec/approvals.md "The approval link dialog"): the line, the two password
// choices, and "Make link", which sends approvals.createLink and then approvals.publish.
import { useState } from 'react'
import { MAKE_PASSWORD, PasswordChoice, choiceInput, choiceReady } from './password-choice'
import type { Sender } from './use-send'
import styles from './approval-dialog.module.css'

type Props = { sender: Sender; onCancel: () => void }

const LINE =
  "Make a link that shows this campaign's variants to reviewers. They need the link and the " +
  'password. Anyone who has both can sign off on a variant with their email address, or ' +
  'remove a sign-off.'

export function NewLink(props: Props) {
  const { sender } = props
  const busy = sender.running !== null
  const [choice, setChoice] = useState(MAKE_PASSWORD)

  async function make() {
    if (!(await sender.send('approvals.createLink', choiceInput(choice)))) return
    setChoice(MAKE_PASSWORD)
    await sender.send('approvals.publish')
  }

  return (
    <div className={styles.section}>
      <p className={styles.line}>{LINE}</p>
      <PasswordChoice legend="Password" value={choice} onChange={setChoice} disabled={busy} />
      <div className={styles.actions}>
        <button type="button" disabled={busy} onClick={props.onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className={styles.primary}
          disabled={busy || !choiceReady(choice)}
          onClick={() => void make()}
        >
          Make link
        </button>
      </div>
    </div>
  )
}

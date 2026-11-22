// "Turn off link…" (spec/approvals.md "The approval link dialog"; DLG-6b): a confirm dialog over
// the approval dialog, "Turn off link?", described by "Reviewers lose access. The gallery is
// deleted." with the full paragraph of what is deleted on the page under it. "Keep link" is
// focused first and sends nothing, as do Escape and a click outside; "Turn off link" sends
// approvals.endLink once (a second click while it waits sends nothing).
import { useId, useRef } from 'react'
import { BusySpinner, DialogFrame } from '@/renderer/ui/dialog-frame'
import layout from '@/renderer/ui/layout.module.css'
import styles from './approval-dialog.module.css'

type Props = {
  open: boolean
  busy: boolean
  onClose: () => void
  onTurnOff: () => Promise<unknown>
}

const SHORT = 'Reviewers lose access. The gallery is deleted.'
const LINE =
  'Turn off this link? Reviewers can no longer open it. The gallery and its pictures are ' +
  'deleted from the service and your bucket. Sign-offs so far stay in this project.'

export function EndLinkConfirm(props: Props) {
  const shortId = useId()
  const sending = useRef(false)

  async function turnOff() {
    if (sending.current) return
    sending.current = true
    await props.onTurnOff()
    sending.current = false
    props.onClose()
  }

  return (
    <DialogFrame
      open={props.open}
      onClose={props.onClose}
      title="Turn off link?"
      kind="confirm"
      describedBy={shortId}
      closable={!props.busy}
      footer={
        <>
          <button
            type="button"
            className={layout.quiet}
            autoFocus
            disabled={props.busy}
            onClick={props.onClose}
          >
            Keep link
          </button>
          <button
            type="button"
            className={`${layout.primary} ${layout.danger}`}
            disabled={props.busy}
            onClick={() => void turnOff()}
          >
            {props.busy && <BusySpinner />}
            Turn off link
          </button>
        </>
      }
    >
      <p id={shortId} className={styles.strong}>
        {SHORT}
      </p>
      <p className={styles.line}>{LINE}</p>
    </DialogFrame>
  )
}

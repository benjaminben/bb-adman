// "Turn off link…" (spec/approvals.md "The approval link dialog"): the confirmation, drawn in
// place of the live link. "Keep link" is focused and sends nothing; "Turn off link" sends
// approvals.endLink.
import styles from './approval-dialog.module.css'

type Props = {
  busy: boolean
  onKeep: () => void
  onTurnOff: () => void
}

const LINE =
  'Turn off this link? Reviewers can no longer open it. The gallery and its pictures are ' +
  'deleted from the service and your bucket. Sign-offs so far stay in this project.'

export function EndLinkConfirm(props: Props) {
  return (
    <div className={styles.section}>
      <p className={styles.line}>{LINE}</p>
      <div className={styles.actions}>
        <button type="button" autoFocus disabled={props.busy} onClick={props.onKeep}>
          Keep link
        </button>
        <button type="button" disabled={props.busy} onClick={props.onTurnOff}>
          Turn off link
        </button>
      </div>
    </div>
  )
}

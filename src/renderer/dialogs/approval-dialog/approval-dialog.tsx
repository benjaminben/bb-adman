// "Approval link" (spec/approvals.md "The approval link dialog"), on the dialog frame. Its
// state comes from the campaign's approvals store: not ready, no link, a live link, or an
// ended link. Every button that sends is disabled while a command runs, with "Working…" (or the
// update's progress line and "Stop") beside them, and the frame cannot be closed meanwhile.
import { useState } from 'react'
import { useApp } from '@/renderer/app/app-context'
import { APPROVALS_REASON_MESSAGES } from '@/shared/approvals/messages'
import type { ApprovalsForCampaign } from '@/shared/schemas/queries/approvals'
import { DialogFrame } from '@/renderer/ui/dialog-frame'
import { SignoffsByVariant } from './signoffs-by-variant'
import { dateText } from '@/renderer/ui/signoff-list'
import { LiveLink } from './live-link'
import { NewLink } from './new-link'
import { UpdateProgress } from './update-progress'
import { useSend, type Sender } from './use-send'
import styles from './approval-dialog.module.css'

export type ApprovalDialogProps = {
  projectId: string
  campaignId: string
  open: boolean
  onClose: () => void
  data: ApprovalsForCampaign
  // Variant titles by ID, for the sign-off lists.
  titles: Record<string, string>
}

const NOT_READY = {
  no_service: 'Set up the approvals service in Settings to make links.',
  no_bucket: APPROVALS_REASON_MESSAGES.approvals_needs_bucket,
}

function NotReady(props: { line: string; onClose: () => void }) {
  const show = useApp((s) => s.show)
  return (
    <div className={styles.section}>
      <p className={styles.line}>{props.line}</p>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primary}
          onClick={() => {
            props.onClose()
            show({ kind: 'settings' })
          }}
        >
          Open Settings
        </button>
      </div>
    </div>
  )
}

function Ended(props: ApprovalDialogProps & { sender: Sender }) {
  const [making, setMaking] = useState(false)
  const endedAt = props.data.link?.endedAt ?? null
  if (making) return <NewLink sender={props.sender} onCancel={() => setMaking(false)} />
  return (
    <>
      <p className={styles.line}>
        {endedAt === null
          ? 'This link was turned off.'
          : `This link was turned off on ${dateText(endedAt)}.`}{' '}
        Its sign-offs are kept below.
      </p>
      <SignoffsByVariant variants={props.data.variants} titles={props.titles} />
      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={() => setMaking(true)}>
          Make a new link
        </button>
      </div>
      <p className={styles.line}>Sign-offs from the old link will be removed from this project.</p>
    </>
  )
}

function Body(props: ApprovalDialogProps & { sender: Sender }) {
  const { data } = props
  if (data.ready !== 'ready')
    return <NotReady line={NOT_READY[data.ready]} onClose={props.onClose} />
  if (data.link === null) return <NewLink sender={props.sender} onCancel={props.onClose} />
  if (data.link.state === 'ended') return <Ended {...props} />
  return <LiveLink {...props} />
}

export function ApprovalDialog(props: ApprovalDialogProps) {
  const sender = useSend(props.projectId, props.campaignId)
  return (
    <DialogFrame
      open={props.open}
      onClose={props.onClose}
      title="Approval link"
      closable={sender.running === null}
    >
      <div className={styles.body}>
        <Body {...props} sender={sender} />
      </div>
      {sender.running === 'approvals.publish' ? (
        <UpdateProgress projectId={props.projectId} campaignId={props.campaignId} />
      ) : (
        sender.running !== null && <p className={styles.waiting}>Working…</p>
      )}
      {sender.refusal !== null && (
        <p role="alert" className={styles.alert}>
          {sender.refusal}
        </p>
      )}
      {!(props.data.ready === 'ready' && props.data.link === null) && (
        <div className={styles.footer}>
          <button type="button" disabled={sender.running !== null} onClick={props.onClose}>
            Close
          </button>
        </div>
      )}
    </DialogFrame>
  )
}

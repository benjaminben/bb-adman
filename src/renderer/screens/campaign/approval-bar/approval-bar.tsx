// The approval bar (spec/approvals.md "The campaign page"), in the page's head row. CAMP-3: one
// button with the `link` icon and "Approvals", which opens the dialog; with a live link a mark
// "{a}/{b}" inside it, the sentences "Signed off: …" and "Checked {time}" in its tip, and a
// `sync` icon button "Refresh" (a spinner while refreshing). A refresh failure stays words on
// the page, right of Refresh. An ended link shows the mark "Off" and keeps "Link turned off" (or
// the gone sentence) as words beside the button.
import { useState } from 'react'
import { useStore } from 'zustand'
import { ApprovalDialog } from '@/renderer/dialogs/approval-dialog'
import type { ApprovalsStore } from '@/renderer/stores/approvals-store'
import { Icon } from '@/renderer/ui/icon'
import { StatusMark } from '@/renderer/ui/status-mark'
import layout from '@/renderer/ui/layout.module.css'
import { approvalLook } from './approval-words'
import styles from './approval-bar.module.css'

type Props = {
  projectId: string
  campaignId: string
  store: ApprovalsStore
  titles: Record<string, string>
}

export function ApprovalBar(props: Props) {
  const data = useStore(props.store, (s) => s.data)
  const refreshing = useStore(props.store, (s) => s.refreshing)
  const failure = useStore(props.store, (s) => s.failure)
  const notice = useStore(props.store, (s) => s.notice)
  const [open, setOpen] = useState(false)
  const state = data?.link?.state
  const look = approvalLook({ data, failure, notice })

  return (
    <div role="group" aria-label="Approval link" className={styles.bar}>
      <button
        type="button"
        className={styles.open}
        aria-label={look.name}
        title={look.title}
        disabled={data === null}
        onClick={() => setOpen(true)}
      >
        <Icon name="link" />
        Approvals
        {look.mark && <StatusMark {...look.mark} />}
      </button>
      {state === 'live' && (
        <button
          type="button"
          className={layout.iconButton}
          aria-label="Refresh"
          title="Refresh"
          disabled={refreshing}
          onClick={() => void props.store.getState().refresh()}
        >
          <Icon name={refreshing ? 'spinner' : 'sync'} />
        </button>
      )}
      {state === 'live' && failure !== null && <span className={styles.failure}>{failure}</span>}
      {state === 'ended' && <span className={styles.muted}>{look.title}</span>}
      {data && (
        <ApprovalDialog
          projectId={props.projectId}
          campaignId={props.campaignId}
          open={open}
          onClose={() => setOpen(false)}
          data={data}
          titles={props.titles}
        />
      )}
    </div>
  )
}

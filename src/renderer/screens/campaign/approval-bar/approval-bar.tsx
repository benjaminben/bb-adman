// The approval bar (spec/approvals.md "The campaign page"), in the page's header row: the
// button "Approval link…", which opens the dialog. With a live link: "Signed off: {a} of {b}
// variants", "Checked {time}" (or the last refresh's failure in its place) and "Refresh". With
// an ended link: "Link turned off", or the gone sentence after a refresh found it gone.
import { useState } from 'react'
import { useStore } from 'zustand'
import { ApprovalDialog } from '@/renderer/dialogs/approval-dialog'
import type { ApprovalsStore } from '@/renderer/stores/approvals-store'
import type { ApprovalsVariant } from '@/shared/schemas/queries/approvals'
import { timeText } from '@/renderer/ui/signoff-list'
import styles from './approval-bar.module.css'

type Props = {
  projectId: string
  campaignId: string
  store: ApprovalsStore
  titles: Record<string, string>
}

// {a}: variants in the gallery with at least one current sign-off; {b}: those in the gallery.
function signedLine(variants: ApprovalsVariant[]): string {
  const shown = variants.filter((v) => v.publishedRev !== null)
  const signed = shown.filter((v) => v.signoffs.some((s) => s.current))
  return `Signed off: ${signed.length} of ${shown.length} variants`
}

export function ApprovalBar(props: Props) {
  const data = useStore(props.store, (s) => s.data)
  const refreshing = useStore(props.store, (s) => s.refreshing)
  const failure = useStore(props.store, (s) => s.failure)
  const notice = useStore(props.store, (s) => s.notice)
  const [open, setOpen] = useState(false)
  const link = data?.link ?? null
  const live = link?.state === 'live'
  const checked = link?.checkedAt ? `Checked ${timeText(link.checkedAt)}` : null

  return (
    <div role="group" aria-label="Approval link" className={styles.bar}>
      <button type="button" disabled={data === null} onClick={() => setOpen(true)}>
        Approval link…
      </button>
      {live && data && (
        <>
          <span>{signedLine(data.variants)}</span>
          {(failure ?? checked) !== null && (
            <span className={failure === null ? styles.muted : styles.failure}>
              {failure ?? checked}
            </span>
          )}
          <button
            type="button"
            disabled={refreshing}
            onClick={() => void props.store.getState().refresh()}
          >
            Refresh
          </button>
        </>
      )}
      {link?.state === 'ended' && (
        <span className={styles.muted}>{notice ?? 'Link turned off'}</span>
      )}
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

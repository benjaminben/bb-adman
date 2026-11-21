// Tile marks (spec/approvals.md "The campaign page"): under a tile, outside its button, the
// marks of approvalMarks and, when the variant has sign-offs, a "Sign-offs ({n})" toggle
// (aria-expanded) that shows the sign-off list. Emails and times are drawn as text only.
import { useState } from 'react'
import { approvalMarks, type ApprovalLinkState } from '@/shared/approvals/marks'
import type { ApprovalsVariant } from '@/shared/schemas/queries/approvals'
import { SignoffList } from '@/renderer/ui/signoff-list'
import styles from './approval-mark.module.css'

export type ApprovalMarkProps = {
  title: string
  entry: ApprovalsVariant | undefined
  linkState: ApprovalLinkState
}

export function ApprovalMark(props: ApprovalMarkProps) {
  const [open, setOpen] = useState(false)
  const marks = approvalMarks(props.entry, props.linkState)
  const signoffs = props.linkState === null ? [] : (props.entry?.signoffs ?? [])
  if (marks.length === 0 && signoffs.length === 0) return null
  return (
    <div className={styles.footer}>
      {marks.length > 0 && (
        <div role="group" aria-label={`Approval marks for ${props.title}`} className={styles.marks}>
          {marks.map((mark) => (
            <span key={mark} className={styles.mark}>
              {mark}
            </span>
          ))}
        </div>
      )}
      {signoffs.length > 0 && (
        <>
          <button
            type="button"
            className={styles.toggle}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            Sign-offs ({signoffs.length})
          </button>
          {open && <SignoffList label={`Sign-offs for ${props.title}`} signoffs={signoffs} />}
        </>
      )}
    </div>
  )
}

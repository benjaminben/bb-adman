// Tile marks (spec/approvals.md "The campaign page"): under a tile, outside its button, the
// marks of approvalMarks and, when the variant has sign-offs, a "Sign-offs ({n})" toggle
// (aria-expanded) that shows the sign-off list. Emails and times are drawn as text only.
import { useState } from 'react'
import { approvalMarks, type ApprovalLinkState } from '@/shared/approvals/marks'
import type { ApprovalsVariant } from '@/shared/schemas/queries/approvals'
import { Icon } from '@/renderer/ui/icon'
import { SignoffList } from '@/renderer/ui/signoff-list'
import layout from '@/renderer/ui/layout.module.css'
import styles from './approval-mark.module.css'
import { markLook } from './mark-look'

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
          {marks.map((mark) => {
            const look = markLook(mark)
            return (
              <span key={mark} className={`${layout.badge} ${layout[look.kind]}`}>
                <Icon name={look.icon} size="small" />
                {mark}
              </span>
            )
          })}
        </div>
      )}
      {signoffs.length > 0 && (
        <>
          <button
            type="button"
            className={`${layout.small} ${layout.quiet}`}
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

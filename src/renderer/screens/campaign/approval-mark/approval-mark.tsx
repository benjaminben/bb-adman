// Tile marks (spec/approvals.md "The campaign page"): outside the tile's button, the marks of
// approvalMarks. Design wave CAMP-1 (C-11): they join the tile's one strip as StatusMarks whose
// tips are the words; "Signed off by {n}" is a button that opens the sign-off list in a
// popover. Reviewer emails show only inside that popover, never in a tip or a name.
import { useCallback, useEffect, useRef, useState } from 'react'
import { approvalMarks, type ApprovalLinkState } from '@/shared/approvals/marks'
import type { ApprovalsVariant } from '@/shared/schemas/queries/approvals'
import { SignoffPopover } from '@/renderer/ui/signoff-list'
import { StatusMark } from '@/renderer/ui/status-mark'
import styles from './approval-mark.module.css'
import { markLook } from './mark-look'

export type ApprovalMarkProps = {
  title: string
  entry: ApprovalsVariant | undefined
  linkState: ApprovalLinkState
}

export function ApprovalMark(props: ApprovalMarkProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const holder = useRef<HTMLSpanElement>(null)
  const close = useCallback(() => setAnchor(null), [])
  const open = anchor !== null
  const marks = approvalMarks(props.entry, props.linkState)
  const signoffs = props.linkState === null ? [] : (props.entry?.signoffs ?? [])
  const button = () => holder.current?.querySelector('button') ?? null
  const toggle = signoffs.length > 0 ? () => setAnchor(open ? null : button()) : undefined

  // StatusMark draws the button; this says whether its popover is open.
  useEffect(() => {
    button()?.setAttribute('aria-expanded', String(open))
  })

  if (marks.length === 0) return null
  return (
    <span
      ref={holder}
      role="group"
      aria-label={`Approval marks for ${props.title}`}
      className={styles.marks}
    >
      {marks.map((mark) => {
        const look = markLook(mark)
        return (
          <StatusMark
            key={mark}
            tone={look.tone}
            icon={look.icon}
            label={look.label}
            tip={mark}
            onClick={look.tone === 'ok' ? toggle : undefined}
          />
        )
      })}
      {open && (
        <SignoffPopover
          anchor={anchor}
          label={`Sign-offs for ${props.title}`}
          signoffs={signoffs}
          onClose={close}
        />
      )}
    </span>
  )
}

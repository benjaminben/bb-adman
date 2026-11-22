// HOME-2 (orchestrator's ruling, spec/phases/design-wave-screens-b.md): Back and Escape on the
// New campaign page leave as Cancel does. When the form holds typed work they ask first, a
// confirm "Leave this brief?" whose warning is "What you typed will be lost."; "Keep editing"
// has the focus, and Escape or a click outside keeps the brief. Only "Leave" leaves. Escape
// that a dialog, a menu or a popover takes first does not leave (ui/escape-leave). Nothing
// leaves while the campaign is being made.
import { useCallback, useEffect, useRef, useState } from 'react'
import { DialogFoot, DialogFrame } from '@/renderer/ui/dialog-frame'
import { useEscapeLeave } from '@/renderer/ui/escape-leave'
import layout from '@/renderer/ui/layout.module.css'

export type LeaveBrief = {
  // The form is open.
  open: boolean
  // A campaign is being made.
  busy: boolean
  // The form holds typed work.
  typed: () => boolean
  onLeave: () => void
}

export function useLeaveBrief(props: LeaveBrief) {
  const [asking, setAsking] = useState(false)
  const latest = useRef(props)
  useEffect(() => {
    latest.current = props
  })

  const leave = useCallback(() => {
    const { busy, typed, onLeave } = latest.current
    if (busy) return
    if (typed()) setAsking(true)
    else onLeave()
  }, [])
  useEscapeLeave(props.open ? leave : undefined, { blur: false })

  const dialog = (
    <DialogFrame
      open={asking}
      onClose={() => setAsking(false)}
      kind="confirm"
      title="Leave this brief?"
      warning="What you typed will be lost."
    >
      <DialogFoot>
        <button type="button" className={layout.quiet} onClick={() => setAsking(false)}>
          Keep editing
        </button>
        <button
          type="button"
          className={`${layout.primary} ${layout.danger}`}
          onClick={() => {
            setAsking(false)
            latest.current.onLeave()
          }}
        >
          Leave
        </button>
      </DialogFoot>
    </DialogFrame>
  )
  return { leave, dialog }
}

// The paste dialog's state for the brief loader (D4). The dialog frame hands the focus back a
// moment after it closes, which would take it from a form that opened in its place; `keepFocus`
// marks that a form is about to open, and once it has, its first field takes the focus again.
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { BriefParsed } from '@/shared/schemas/commands/brief'
import { BriefPaste } from './brief-paste'

export type PasteHandlers = {
  onEmpty: () => void
  onRead: (parsed: BriefParsed) => void
}

export function focusFirstField(box: HTMLElement | null) {
  box?.querySelector<HTMLElement>('input, select, textarea')?.focus()
}

// `formOpen` is true while the brief form shows; `formBox` holds it.
export function usePasteBrief(
  projectId: string,
  formOpen: boolean,
  formBox: RefObject<HTMLElement | null>,
  handlers: PasteHandlers,
) {
  const [pasting, setPasting] = useState(false)
  const refocus = useRef(false)

  useEffect(() => {
    if (!formOpen || !refocus.current) return
    refocus.current = false
    const timer = setTimeout(() => focusFirstField(formBox.current), 0)
    return () => clearTimeout(timer)
  }, [formOpen, formBox])

  const keepFocus = useCallback(() => {
    refocus.current = true
  }, [])

  function closeInto(next: () => void) {
    keepFocus()
    setPasting(false)
    next()
  }

  const dialog = (
    <BriefPaste
      open={pasting}
      projectId={projectId}
      onClose={() => setPasting(false)}
      onEmpty={() => closeInto(handlers.onEmpty)}
      onRead={(parsed) => closeInto(() => handlers.onRead(parsed))}
    />
  )

  return {
    start: () => setPasting(true),
    // The form closed: the dialog stays shut, also when "+" opened the form over it.
    shut: () => setPasting(false),
    keepFocus,
    dialog,
  }
}

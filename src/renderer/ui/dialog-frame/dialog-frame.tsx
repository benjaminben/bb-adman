// The one dialog frame (spec/screens-campaign.md, "Rules for these screens"): a Radix dialog
// with an overlay, a title, an optional description and the content. Escape and a click
// outside close it unless `closable` is false (a command it sent is waiting). On close, focus
// goes back to the control that opened it, or to the page's heading when that control is gone.
import { useRef, type ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import styles from './dialog-frame.module.css'

export type DialogFrameProps = {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  closable?: boolean
  children: ReactNode
}

function focusHeading() {
  const heading = document.querySelector<HTMLElement>('h1')
  if (!heading) return
  if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1')
  heading.focus()
}

export function DialogFrame(props: DialogFrameProps) {
  const closable = props.closable ?? true
  const opener = useRef<HTMLElement | null>(null)

  function onOpenAutoFocus() {
    const active = document.activeElement
    opener.current = active instanceof HTMLElement && active !== document.body ? active : null
  }

  function onCloseAutoFocus(event: Event) {
    event.preventDefault()
    const target = opener.current
    if (target?.isConnected) target.focus()
    else focusHeading()
  }

  function stay(event: Event) {
    if (!closable) event.preventDefault()
  }

  return (
    <Dialog.Root open={props.open} onOpenChange={(open) => !open && closable && props.onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content
          className={styles.content}
          {...(props.description === undefined && { 'aria-describedby': undefined })}
          onOpenAutoFocus={onOpenAutoFocus}
          onCloseAutoFocus={onCloseAutoFocus}
          onEscapeKeyDown={stay}
          onInteractOutside={stay}
        >
          <Dialog.Title className={styles.title}>{props.title}</Dialog.Title>
          {props.description !== undefined && (
            <Dialog.Description>{props.description}</Dialog.Description>
          )}
          {props.children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

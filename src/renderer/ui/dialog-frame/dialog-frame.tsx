// The one dialog frame (spec/screens-campaign.md, "Rules for these screens"): a Radix dialog
// with an overlay, a title, an optional description and the content. Escape and a click
// outside close it unless `closable` is false (a command it sent is waiting). On close, focus
// goes back to the control that opened it, or to the page's heading when that control is gone.
// ST-4 (spec/app-style.md, "Dialogs"): three bands, head (title, description), body (the
// content, which scrolls) and foot (`footer`, drawn after the body); `size` picks the width.
import { useRef, type ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import styles from './dialog-frame.module.css'

export type DialogSize = 'normal' | 'wide' | 'large'

export type DialogFrameProps = {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  closable?: boolean
  footer?: ReactNode
  size?: DialogSize
  children: ReactNode
}

function focusHeading() {
  const heading = document.querySelector<HTMLElement>('h1')
  if (!heading) return
  if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1')
  heading.focus()
}

// A button row that must stay inside the body (in a form, or in a part that holds its own
// state), drawn as the foot band at the bottom of the body.
export function DialogFoot(props: { className?: string; children: ReactNode }) {
  const extra = props.className === undefined ? '' : ` ${props.className}`
  return <div className={`${styles.foot} ${styles.inBody}${extra}`}>{props.children}</div>
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
          className={`${styles.content} ${styles[props.size ?? 'normal']}`}
          {...(props.description === undefined && { 'aria-describedby': undefined })}
          onOpenAutoFocus={onOpenAutoFocus}
          onCloseAutoFocus={onCloseAutoFocus}
          onEscapeKeyDown={stay}
          onInteractOutside={stay}
        >
          <div className={styles.head}>
            <Dialog.Title className={styles.title}>{props.title}</Dialog.Title>
            {props.description !== undefined && (
              <Dialog.Description className={styles.description}>
                {props.description}
              </Dialog.Description>
            )}
          </div>
          <div className={styles.body}>{props.children}</div>
          {props.footer !== undefined && <div className={styles.foot}>{props.footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

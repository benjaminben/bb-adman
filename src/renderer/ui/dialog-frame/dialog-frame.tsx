// The one dialog frame (spec/screens-campaign.md, "Rules for these screens"): a Radix dialog
// with an overlay, a title, an optional description and the content. Escape and a click
// outside close it unless `closable` is false (a command it sent is waiting). On close, focus
// goes back to the control that opened it, or to the page's heading when that control is gone.
// ST-4 (spec/app-style.md, "Dialogs"): three bands, head (title, description), body (the
// content, which scrolls) and foot (`footer`, drawn after the body); `size` picks the width.
// `describedBy`, used when there is no `description`, names an element in the body that the
// dialog is described by instead; it may hold several ids separated by spaces.
// T4 (spec/app-style-parts.md, "Dialog"): `kind` sets the width (`size` wins when both are
// given), and `warning` is a plain-text line in the head, read first as the description.
// Without them the frame draws exactly as before. Z-1b: `icon` draws an icon before the title
// words, hidden from screen readers, so the dialog's name stays the title.
import { useId, useRef, type ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Icon, type IconName } from '@/renderer/ui/icon'
import styles from './dialog-frame.module.css'

export type DialogSize = 'normal' | 'wide' | 'large'

export type DialogKind = 'confirm' | 'form' | 'run' | 'publish' | 'review' | 'pick'

const KIND_SIZE: Record<DialogKind, DialogSize> = {
  confirm: 'normal',
  form: 'normal',
  run: 'normal',
  publish: 'wide',
  review: 'large',
  pick: 'wide',
}

export type DialogFrameProps = {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  describedBy?: string
  closable?: boolean
  footer?: ReactNode
  size?: DialogSize
  kind?: DialogKind
  warning?: string
  icon?: IconName
  children: ReactNode
}

// The description ids, the warning's first. With no warning, as built: Radix names its own
// description, and `describedBy` is used only when there is none.
function describedIds(props: DialogFrameProps, warningId: string, descriptionId: string) {
  if (props.warning === undefined) {
    return props.description === undefined ? { 'aria-describedby': props.describedBy } : {}
  }
  const ids = [warningId, props.description !== undefined && descriptionId, props.describedBy]
  return { 'aria-describedby': ids.filter(Boolean).join(' ') }
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
  const warningId = useId()
  const descriptionId = useId()
  const size = props.size ?? (props.kind === undefined ? 'normal' : KIND_SIZE[props.kind])

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
          className={`${styles.content} ${styles[size]}`}
          {...describedIds(props, warningId, descriptionId)}
          onOpenAutoFocus={onOpenAutoFocus}
          onCloseAutoFocus={onCloseAutoFocus}
          onEscapeKeyDown={stay}
          onInteractOutside={stay}
        >
          <div className={styles.head}>
            <Dialog.Title
              className={
                props.icon === undefined ? styles.title : `${styles.title} ${styles.withIcon}`
              }
            >
              {props.icon !== undefined && <Icon name={props.icon} />}
              {props.title}
            </Dialog.Title>
            {props.warning !== undefined && (
              <p id={warningId} className={styles.warning}>
                <Icon name="alert" size="small" />
                <span>{props.warning}</span>
              </p>
            )}
            {props.description !== undefined && (
              <Dialog.Description
                className={styles.description}
                {...(props.warning !== undefined && { id: descriptionId })}
              >
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

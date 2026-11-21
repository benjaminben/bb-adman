// A Settings problem or result line drawn as a notice of its kind (spec/app-style.md
// "Settings"). The words are the caller's; the icon is decorative.
import type { ReactNode } from 'react'
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import styles from './notice-line.module.css'

export type NoticeKind = 'ok' | 'warn' | 'danger'

export function noticeClass(kind: NoticeKind): string {
  return `${styles.line} ${layout.notice} ${layout[kind]}`
}

export function NoticeIcon(props: { kind: NoticeKind }) {
  return <Icon name={props.kind === 'ok' ? 'check' : 'alert'} size="small" />
}

export function NoticeLine(props: {
  kind: NoticeKind
  id?: string
  role?: 'status'
  children: ReactNode
}) {
  return (
    <p id={props.id} role={props.role} className={noticeClass(props.kind)}>
      <NoticeIcon kind={props.kind} />
      {props.children}
    </p>
  )
}

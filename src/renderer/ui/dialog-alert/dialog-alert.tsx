// DialogAlert (spec/app-style-parts.md, "Dialog", T4): the one way to draw a refusal, a
// failure or a busy state inside a dialog, at the top of the body: an icon, one line and at
// most one action. `danger` and `warn` are alerts (read at once) and are never folded or
// hidden by the part; `busy` is a status with the turning spinner. The words are the caller's.
import type { ReactNode } from 'react'
import { Icon } from '@/renderer/ui/icon'
import styles from './dialog-alert.module.css'

export type DialogAlertTone = 'danger' | 'warn' | 'busy'

export type DialogAlertAction = { label: string; onClick: () => void }

export type DialogAlertProps = {
  tone: DialogAlertTone
  children: ReactNode
  action?: DialogAlertAction
}

const ICON = { danger: 'xCircle', warn: 'alert', busy: 'spinner' } as const

export function DialogAlert(props: DialogAlertProps) {
  const { tone, action } = props
  return (
    <div role={tone === 'busy' ? 'status' : 'alert'} className={`${styles.alert} ${styles[tone]}`}>
      <span className={styles.icon}>
        <Icon name={ICON[tone]} size="small" />
      </span>
      <span className={styles.words}>{props.children}</span>
      {action !== undefined && (
        <button type="button" className={styles.action} onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  )
}

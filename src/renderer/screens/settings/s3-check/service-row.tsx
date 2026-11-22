// One service on the Publish page (SET-4): an ObjectRow whose main button opens and closes the
// service's form below it, the one always-shown action, then the failures under the row and the
// one line that says where the data goes. That line is never folded away (design wave, "Security
// text stays on the page"). The form is drawn only while open, so its fields need the row open.
import type { ReactNode } from 'react'
import { ObjectRow } from '@/renderer/ui/object-row'
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import styles from './service-row.module.css'

export type ServiceRowProps = {
  id: string
  name: string
  info?: ReactNode
  mark: ReactNode
  action: ReactNode
  line: ReactNode
  notices?: ReactNode
  open?: boolean
  // With no onToggle the service has no form (Dropbox while signed out).
  onToggle?: () => void
  form?: ReactNode
}

export const rowButtonId = (id: string) => `${id}-row`

export function ServiceRow(props: ServiceRowProps) {
  const nameId = `${props.id}-name`
  const formId = `${props.id}-form`
  const folds = props.onToggle !== undefined
  const open = folds && props.open === true
  const mainProps = folds
    ? { id: rowButtonId(props.id), 'aria-expanded': open, 'aria-controls': formId }
    : { id: rowButtonId(props.id) }
  return (
    <div role="group" aria-labelledby={nameId} className={styles.service}>
      <ObjectRow
        name={
          <span className={styles.name}>
            <span id={nameId}>{props.name}</span>
            {props.info}
          </span>
        }
        label={props.name}
        thumb={<Icon name="cloud" />}
        marks={props.mark}
        stateActions={props.action}
        onSelect={props.onToggle}
        mainProps={mainProps}
      />
      {props.notices}
      <p className={`${layout.muted} ${styles.line}`}>{props.line}</p>
      {folds && (
        <div id={formId} className={styles.form} hidden={!open}>
          {open && props.form}
        </div>
      )}
    </div>
  )
}

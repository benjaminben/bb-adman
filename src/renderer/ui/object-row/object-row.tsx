// ObjectRow (spec/app-style-parts.md, "ObjectRow", T3c): the layer-row pattern made shared for
// every list item. One line at --row-height (two with `meta`). The main button covers the whole
// row and is named by `label`; the thumb, name, meta and marks are drawn over it and let clicks
// through, so `name` may also be a rename field. State actions and the More menu always show;
// the other actions lie over the right end and show on hover, focus inside the row and while
// selected (CSS), so showing them never changes the row's size.
import type { ButtonHTMLAttributes, KeyboardEvent, ReactNode } from 'react'
import styles from './object-row.module.css'

export type ObjectRowProps = {
  name: ReactNode
  label: string
  thumb?: ReactNode
  meta?: ReactNode
  marks?: ReactNode
  stateActions?: ReactNode
  actions?: ReactNode
  more?: ReactNode
  selected?: boolean
  muted?: boolean
  title?: string
  onSelect?: () => void
  onOpen?: () => void
  mainProps?: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'onClick' | 'className'>
}

function boxClass(props: ObjectRowProps): string {
  return [
    styles.box,
    props.meta !== undefined && styles.withMeta,
    props.selected && styles.selected,
    props.muted && styles.muted,
  ]
    .filter(Boolean)
    .join(' ')
}

export function ObjectRow(props: ObjectRowProps) {
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== 'Enter' || props.onOpen === undefined) return
    event.preventDefault()
    props.onOpen()
  }

  return (
    <div className={boxClass(props)} title={props.title}>
      <button
        type="button"
        className={styles.main}
        aria-label={props.label}
        {...props.mainProps}
        onClick={props.onSelect}
        onDoubleClick={props.onOpen}
        onKeyDown={onKeyDown}
      />
      <span className={styles.content}>
        {props.thumb !== undefined && <span className={styles.thumb}>{props.thumb}</span>}
        <span className={styles.text}>
          <span className={styles.name}>{props.name}</span>
          {props.meta !== undefined && <span className={styles.meta}>{props.meta}</span>}
        </span>
        {props.marks !== undefined && <span className={styles.marks}>{props.marks}</span>}
      </span>
      <span className={styles.tail}>
        {props.actions !== undefined && (
          <span className={styles.slot}>
            <span className={styles.actions}>{props.actions}</span>
          </span>
        )}
        {props.stateActions !== undefined && (
          <span className={styles.state}>{props.stateActions}</span>
        )}
        {props.more}
      </span>
    </div>
  )
}

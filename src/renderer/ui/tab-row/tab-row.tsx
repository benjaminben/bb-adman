// A row of tabs where a tab may have a close button beside it (spec/editor.md, "The shell" and
// "Variant tabs"). A tab list may hold only tabs, so the close buttons sit in their own strip
// laid over the same grid columns: tab, its close button, next tab. Each close button is
// described by its tab's label. The caller gives the Tabs.Content panels as children.
import * as Tabs from '@radix-ui/react-tabs'
import { useId, type CSSProperties, type ReactNode } from 'react'
import styles from './tab-row.module.css'

export type TabItem = {
  value: string
  label: ReactNode
  marks?: ReactNode
  close?: { label: string; onClose: () => void }
}

export type TabRowProps = {
  label: string
  items: TabItem[]
  value: string
  onValueChange: (value: string) => void
  after?: ReactNode
  className?: string
  children: ReactNode
}

const column = (index: number, close = false): CSSProperties => ({
  gridColumn: index * 2 + (close ? 2 : 1),
})

export function TabRow(props: TabRowProps) {
  const id = useId()
  const nameId = (index: number) => `${id}-tab-${index}`
  const columns = { gridTemplateColumns: `repeat(${props.items.length * 2}, max-content)` }
  return (
    <Tabs.Root value={props.value} onValueChange={props.onValueChange} className={props.className}>
      <div className={styles.bar}>
        <div className={styles.tabs} style={columns}>
          <Tabs.List aria-label={props.label} className={styles.list}>
            {props.items.map((item, index) => (
              <Tabs.Trigger
                key={item.value}
                value={item.value}
                className={item.close ? `${styles.tab} ${styles.closable}` : styles.tab}
                style={column(index)}
              >
                <span id={nameId(index)}>{item.label}</span>
                {item.marks && <> {item.marks}</>}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
          <div className={styles.closers}>
            {props.items.map(
              (item, index) =>
                item.close && (
                  <button
                    key={item.value}
                    type="button"
                    className={styles.close}
                    style={column(index, true)}
                    data-active={item.value === props.value}
                    aria-label={item.close.label}
                    aria-describedby={nameId(index)}
                    onClick={item.close.onClose}
                  >
                    ×
                  </button>
                ),
            )}
          </div>
        </div>
        {props.after}
      </div>
      {props.children}
    </Tabs.Root>
  )
}

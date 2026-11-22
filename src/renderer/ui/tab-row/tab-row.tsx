// A row of tabs where a tab may have a close button beside it (spec/editor.md, "The shell" and
// "Variant tabs"). A tab list may hold only tabs, so the close buttons sit in their own strip
// laid over the same grid columns: tab, its close button, next tab. Each close button is
// described by its tab's label. It goes inside the caller's Tabs.Root; value is that root's.
// Two looks (spec/app-style.md, "App shell and tabs"): "row", the variant tab row with an
// underline, and "bar", the campaign tabs in the top bar with a bar on top. CAMP-3: an item
// with `divider` draws a thin line before its tab (data-divider), so one strip can hold groups.
import * as Tabs from '@radix-ui/react-tabs'
import { useId, type CSSProperties, type ReactNode } from 'react'
import { Icon } from '@/renderer/ui/icon'
import styles from './tab-row.module.css'

export type TabItem = {
  value: string
  label: ReactNode
  marks?: ReactNode
  close?: { label: string; onClose: () => void }
  divider?: boolean
}

export type TabRowProps = {
  label: string
  items: TabItem[]
  value: string
  look?: 'row' | 'bar'
}

const column = (index: number, close = false): CSSProperties => ({
  gridColumn: index * 2 + (close ? 2 : 1),
})

export function TabRow(props: TabRowProps) {
  const id = useId()
  const nameId = (index: number) => `${id}-tab-${index}`
  const columns = { gridTemplateColumns: `repeat(${props.items.length * 2}, max-content)` }
  const look = props.look === 'bar' ? styles.bar : styles.row
  return (
    <div className={`${styles.tabs} ${look}`} style={columns}>
      <Tabs.List aria-label={props.label} className={styles.list}>
        {props.items.map((item, index) => (
          <Tabs.Trigger
            key={item.value}
            value={item.value}
            className={item.close ? `${styles.tab} ${styles.closable}` : styles.tab}
            style={column(index)}
            data-divider={item.divider || undefined}
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
              <span
                key={item.value}
                className={styles.closeCell}
                style={column(index, true)}
                data-active={item.value === props.value}
              >
                <button
                  type="button"
                  className={styles.close}
                  aria-label={item.close.label}
                  aria-describedby={nameId(index)}
                  onClick={item.close.onClose}
                >
                  <Icon name="x" size="small" />
                </button>
              </span>
            ),
        )}
      </div>
    </div>
  )
}

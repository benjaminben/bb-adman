// A short list of pages (T3e, spec/app-style-parts.md "SideList"; the Settings list, choice
// C-1): a nav of buttons, each an icon and one word. The current one has aria-current="page" and
// the selected row look. A mark adds a status dot and the hidden words "needs a look". The foot
// (the Settings "Setup" button) sits at the bottom, after the list.
import type { ReactNode } from 'react'
import { Icon, type IconName } from '@/renderer/ui/icon'
import styles from './side-list.module.css'

export type SideListItem = { id: string; label: string; icon: IconName; mark?: 'warn' | 'danger' }

export type SideListProps = {
  label: string
  items: SideListItem[]
  current: string
  onChoose: (id: string) => void
  foot?: ReactNode
}

export function SideList(props: SideListProps) {
  return (
    <nav className={styles.nav} aria-label={props.label}>
      <ul className={styles.list}>
        {props.items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={styles.item}
              aria-current={item.id === props.current ? 'page' : undefined}
              onClick={() => props.onChoose(item.id)}
            >
              <Icon name={item.icon} />
              <span className={styles.label}>{item.label}</span>
              {item.mark !== undefined && (
                <span className={`${styles.dot} ${styles[item.mark]}`}>
                  <span className={styles.hidden}>, needs a look</span>
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
      {props.foot !== undefined && <div className={styles.foot}>{props.foot}</div>}
    </nav>
  )
}

// EmptyState (spec/app-style-parts.md, "ObjectRow", T3c): the `.empty` look with an icon, at
// most five words and one button, the action that fills the empty place (no dead ends).
import { Icon, type IconName } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import styles from './empty-state.module.css'

export type EmptyAction = { label: string; onClick: () => void; primary?: boolean }

export type EmptyStateProps = { icon: IconName; words: string; action?: EmptyAction }

export function EmptyState(props: EmptyStateProps) {
  const { action } = props
  return (
    <div className={`${layout.empty} ${styles.box}`}>
      <span className={styles.icon}>
        <Icon name={props.icon} />
      </span>
      <p className={styles.words}>{props.words}</p>
      {action !== undefined && (
        <button
          type="button"
          className={action.primary ? layout.primary : undefined}
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

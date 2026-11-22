// A side panel's header row (T3e, spec/app-style-parts.md "Panel and PanelHead"): the object's
// kind icon, the title as an operating label, and a close button when the panel can close. The
// caller names the close button with the words the screen already uses ("Close activity").
import { Icon, type IconName } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import styles from './panel-head.module.css'

// A close button always has a name, so `closeLabel` comes with `onClose`.
type Close =
  { onClose?: undefined; closeLabel?: undefined } | { onClose: () => void; closeLabel: string }

export type PanelHeadProps = { title: string; icon?: IconName; level?: 2 | 3 } & Close

export function PanelHead(props: PanelHeadProps) {
  const Heading = `h${props.level ?? 2}` as const
  return (
    <div className={styles.head}>
      {props.icon !== undefined && (
        <span className={styles.icon}>
          <Icon name={props.icon} />
        </span>
      )}
      <Heading className={styles.title}>{props.title}</Heading>
      {props.onClose !== undefined && (
        <button
          type="button"
          className={`${layout.quiet} ${layout.small} ${layout.iconOnly}`}
          aria-label={props.closeLabel}
          title={props.closeLabel}
          onClick={props.onClose}
        >
          <Icon name="x" />
        </button>
      )}
    </div>
  )
}

// ED-2: a segmented group of icon buttons (Align, Vertical align). Each segment is named by its
// old word in `aria-label` and `title`; the word is also kept as hidden text in the button.
import { Icon, type IconName } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import styles from './text-fields.module.css'

export type Segment<T> = { value: T; name: string; icon: IconName }

type Props<T> = {
  label: string
  segments: Array<Segment<T>>
  value: T
  onChoose: (value: T) => void
}

export function IconSegments<T extends string>(props: Props<T>) {
  return (
    <div role="group" aria-label={props.label} className={`${layout.seg} ${styles.seg}`}>
      {props.segments.map((s) => (
        <button
          key={s.value}
          type="button"
          className={layout.iconButton}
          aria-label={s.name}
          title={s.name}
          aria-pressed={props.value === s.value}
          onClick={() => props.onChoose(s.value)}
        >
          <Icon name={s.icon} />
          <span className={styles.hidden}>{s.name}</span>
        </button>
      ))}
    </div>
  )
}

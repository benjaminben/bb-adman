// The one way to title and group things in a panel, a settings page or a dialog (T3a,
// spec/app-style-parts.md "Section"). The heading holds a fold button, a button that opens a
// SubPage ("›"), or the bare title. The InfoTip and the summary sit over the header row after
// the button and are their own tab stops. A Section carries no words of its own.
import { useId, useState, type ReactNode } from 'react'
import { Icon } from '@/renderer/ui/icon'
import { readFold, writeFold } from './fold-memory'
import styles from './section.module.css'

export type SectionFold = 'open' | 'closed' | 'none'

export type SectionProps = {
  id: string
  title: string
  level?: 2 | 3 | 4
  // R3-3: 'title' sets the heading in the title type role, for a Section that starts a new
  // part of a page (a language of the Translations tab).
  size?: 'section' | 'title'
  summary?: ReactNode
  info?: ReactNode
  fold?: SectionFold
  onOpenPage?: () => void
  children?: ReactNode
}

export function Section(props: SectionProps) {
  const fold = props.fold ?? 'open'
  const folds = fold !== 'none' && props.onOpenPage === undefined
  const [open, setOpen] = useState(() => !folds || readFold(props.id, fold === 'open'))
  const headingId = useId()
  const bodyId = useId()
  const Heading = `h${props.level ?? 3}` as const
  const headingClass = props.size === 'title' ? `${styles.heading} ${styles.title}` : styles.heading

  function toggle() {
    writeFold(props.id, !open)
    setOpen(!open)
  }

  function head(): ReactNode {
    if (props.onOpenPage !== undefined) {
      return (
        <button type="button" className={styles.toggle} onClick={props.onOpenPage}>
          {props.title}
          <span className={styles.chevron}>
            <Icon name="right" />
          </span>
        </button>
      )
    }
    if (!folds) return props.title
    return (
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={toggle}
      >
        {props.title}
        <span className={`${styles.chevron} ${open ? '' : styles.closed}`}>
          <Icon name="down" />
        </span>
      </button>
    )
  }

  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <div className={styles.header}>
        <Heading id={headingId} className={headingClass}>
          {head()}
        </Heading>
        {props.info !== undefined && <span className={styles.over}>{props.info}</span>}
        {props.summary !== undefined && (
          <span className={`${styles.over} ${styles.summary}`}>{props.summary}</span>
        )}
      </div>
      {(folds || props.children !== undefined) && (
        <div id={bodyId} className={styles.body} hidden={!open}>
          {props.children}
        </div>
      )}
    </section>
  )
}

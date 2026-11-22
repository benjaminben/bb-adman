// Long or rare content opened from a Section (T3e, spec/app-style-parts.md "SubPage"): a back
// button and the title, then the content. Focus goes to the title on open; Back and Escape call
// onBack. The caller returns focus to the Section header that opened it.
import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import styles from './sub-page.module.css'

export type SubPageProps = {
  title: string
  onBack: () => void
  backLabel?: string
  children?: ReactNode
}

export function SubPage(props: SubPageProps) {
  const backLabel = props.backLabel ?? 'Back'
  const root = useRef<HTMLElement>(null)
  const title = useRef<HTMLHeadingElement>(null)
  const titleId = useId()

  useEffect(() => {
    title.current?.focus()
  }, [])

  // Only keys pressed inside the page itself, not in a dialog drawn from it into a portal.
  function onKeyDown(event: KeyboardEvent) {
    if (event.key !== 'Escape' || !root.current?.contains(event.target as Node)) return
    event.stopPropagation()
    props.onBack()
  }

  return (
    <section ref={root} className={styles.page} aria-labelledby={titleId} onKeyDown={onKeyDown}>
      <div className={styles.head}>
        <button
          type="button"
          className={`${layout.quiet} ${layout.small} ${layout.iconOnly}`}
          aria-label={backLabel}
          title={backLabel}
          onClick={props.onBack}
        >
          <Icon name="left" />
        </button>
        <h2 ref={title} id={titleId} className={styles.title} tabIndex={-1}>
          {props.title}
        </h2>
      </div>
      <div className={styles.body}>{props.children}</div>
    </section>
  )
}

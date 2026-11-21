// The "Activity" button (spec/screens-ai.md, "The activity panel", Button) [REQ: FR-218]: at
// the right of the top row before "Settings". "{n} running" when jobs are queued or running,
// and a dot "New results" when a succeeded job is not yet looked at. It opens and closes the
// panel, and takes the focus back when the panel closes.
import { useEffect, useRef } from 'react'
import { ACTIVITY_PANEL_ID, useActivity } from '@/renderer/app/activity-panel'
import { Icon } from '@/renderer/ui/icon'
import styles from './activity-button.module.css'

export function ActivityButton() {
  const open = useActivity((s) => s.open)
  const setOpen = useActivity((s) => s.setOpen)
  const running = useActivity(
    (s) => s.rows.filter((e) => e.job.status === 'queued' || e.job.status === 'running').length,
  )
  const unseen = useActivity((s) =>
    s.rows.some((e) => e.job.status === 'succeeded' && e.job.seenAt === null),
  )
  const ref = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(open)

  useEffect(() => {
    if (wasOpen.current && !open) ref.current?.focus()
    wasOpen.current = open
  }, [open])

  return (
    <button
      ref={ref}
      type="button"
      className={styles.button}
      aria-expanded={open}
      aria-controls={open ? ACTIVITY_PANEL_ID : undefined}
      onClick={() => setOpen(!open)}
    >
      <Icon name="pulse" />
      Activity
      {running > 0 && <span className={styles.running}>{running} running</span>}
      {unseen && <span role="img" aria-label="New results" className={styles.dot} />}
    </button>
  )
}

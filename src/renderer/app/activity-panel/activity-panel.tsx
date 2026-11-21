// The activity panel (spec/screens-ai.md, "The activity panel") [REQ: FR-152, FR-217; D-036]:
// a region along the right edge under the top row, over the content, for the shown project's
// jobs in two lists: "Running" (queued and running, oldest first) and "Finished" (newest
// first). "Close activity" and Escape close it; Go there acts, then closes it.
import { useEffect, useId, useRef, type KeyboardEvent } from 'react'
import { useNavStore } from '@/renderer/app/nav-context'
import { ActivityRow } from '@/renderer/app/activity-row'
import type { ActivityEntry } from '@/renderer/stores/activity-store'
import { goThere, type GoTarget } from '@/renderer/ui/go-there'
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import { useActivity } from './activity-scope'
import styles from './activity-panel.module.css'

export const ACTIVITY_PANEL_ID = 'activity-panel'

const active = (e: ActivityEntry) => e.job.status === 'queued' || e.job.status === 'running'

function JobList(props: {
  title: string
  rows: ActivityEntry[]
  projectId: string
  onGo: (target: GoTarget) => void
}) {
  const headingId = useId()
  if (props.rows.length === 0) return null
  return (
    <section>
      <h3 id={headingId} className={styles.heading}>
        {props.title}
      </h3>
      <ul aria-labelledby={headingId} className={styles.list}>
        {props.rows.map((entry) => (
          <ActivityRow
            key={entry.job.id}
            entry={entry}
            projectId={props.projectId}
            onGo={props.onGo}
          />
        ))}
      </ul>
    </section>
  )
}

function PanelBody(props: { onClose: () => void }) {
  const projectId = useActivity((s) => s.projectId)
  const rows = useActivity((s) => s.rows)
  const nav = useNavStore()
  if (projectId === null) return <p>Open a project to see its activity.</p>
  if (rows.length === 0) return <p>Nothing has run in this project yet.</p>
  // The query answers newest first.
  const running = rows.filter(active).reverse()
  const finished = rows.filter((e) => !active(e))
  const onGo = (target: GoTarget) => {
    goThere(nav.getState(), projectId, target)
    props.onClose()
  }
  return (
    <>
      <JobList title="Running" rows={running} projectId={projectId} onGo={onGo} />
      <JobList title="Finished" rows={finished} projectId={projectId} onGo={onGo} />
    </>
  )
}

export function ActivityPanel() {
  const open = useActivity((s) => s.open)
  const setOpen = useActivity((s) => s.setOpen)
  const ref = useRef<HTMLElement>(null)
  const close = () => setOpen(false)

  useEffect(() => {
    if (open) ref.current?.focus()
  }, [open])

  // Escape from a dialog the panel opened (drawn elsewhere in the page) is that dialog's own.
  function onKeyDown(e: KeyboardEvent) {
    if (e.key !== 'Escape' || !ref.current?.contains(e.target as Node)) return
    e.stopPropagation()
    close()
  }

  if (!open) return null
  return (
    <section
      ref={ref}
      id={ACTIVITY_PANEL_ID}
      aria-label="Activity"
      tabIndex={-1}
      className={styles.panel}
      onKeyDown={onKeyDown}
    >
      <div className={styles.top}>
        <h2 className={styles.title}>Activity</h2>
        <button
          type="button"
          className={`${layout.quiet} ${layout.small} ${styles.close}`}
          onClick={close}
        >
          <Icon name="x" size="small" />
          Close activity
        </button>
      </div>
      <PanelBody onClose={close} />
    </section>
  )
}

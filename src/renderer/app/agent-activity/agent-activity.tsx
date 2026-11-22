// The line that says what an agent just did (spec/phases/phase-10.md, A-241): "Agent working:
// {tool}", and the project's name when the app store has that project open. It is display only:
// a role="status" region with no control, drawn as text, hidden 10 seconds after the last
// agent.activity event. It sits in the corner away from the activity panel and under dialogs,
// and takes no clicks, so it never covers a dialog's buttons.
import { useEffect, useState } from 'react'
import { EMPTY, useApi, useApp } from '@/renderer/app/app-context'
import type { EventMap } from '@/shared/schemas/events'
import styles from './agent-activity.module.css'

type Activity = EventMap['agent.activity']

const SHOWN_MS = 10_000

export function AgentActivity() {
  const api = useApi()
  const projects = useApp((s) => s.app?.openProjects ?? EMPTY)
  const [last, setLast] = useState<Activity | null>(null)

  useEffect(() => api.on('agent.activity', (next) => setLast(next)), [api])

  useEffect(() => {
    if (last === null) return
    const timer = setTimeout(() => setLast(null), SHOWN_MS)
    return () => clearTimeout(timer)
  }, [last])

  const project = last?.projectId ? projects.find((p) => p.projectId === last.projectId) : null

  return (
    <div role="status" className={last ? styles.line : styles.empty}>
      {last && (
        <>
          <span className={styles.dot} aria-hidden="true" />
          <span className={styles.words}>
            Agent working: {last.tool}
            {project && <span className={styles.project}>{` · ${project.name}`}</span>}
          </span>
        </>
      )}
    </div>
  )
}

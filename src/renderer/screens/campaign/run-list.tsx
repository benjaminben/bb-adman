// The chosen variant's runs, newest first (SPEC 14 1.41 TP-2, the plain "Activity panel").
import { useStore } from 'zustand'
import type { JobStore } from '@/renderer/stores/job-store'
import { RunRow } from './run-row'
import styles from '@/renderer/screens/screens.module.css'

export function RunList(props: { projectId: string; store: JobStore }) {
  const rows = useStore(props.store, (s) => s.rows)
  return (
    <section className={styles.card} aria-labelledby="runs-heading">
      <h2 id="runs-heading">Runs</h2>
      {rows.length === 0 ? (
        <p className={styles.muted}>No runs yet.</p>
      ) : (
        <ul className={styles.list} aria-label="Runs">
          {rows.map((row) => (
            <RunRow key={row.id} row={row} projectId={props.projectId} store={props.store} />
          ))}
        </ul>
      )}
    </section>
  )
}

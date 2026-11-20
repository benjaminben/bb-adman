import { useApp, EMPTY } from '../../app/app-context'
import styles from '../screens.module.css'

export function RecentProjects() {
  const recent = useApp((s) => s.app?.recentProjects ?? EMPTY)
  const command = useApp((s) => s.command)

  return (
    <>
      <h3 id="recent-title">Recent projects</h3>
      {recent.length === 0 ? (
        <p className={styles.muted}>No recent projects yet.</p>
      ) : (
        <ul className={styles.list} aria-labelledby="recent-title">
          {recent.map((r) => (
            <li key={r.path}>
              <button
                type="button"
                className={styles.listButton}
                aria-label={`Open ${r.name}, ${r.path}`}
                onClick={() => void command('project.open', { filePath: r.path })}
              >
                <span>{r.name}</span>
                <span className={styles.muted}>{r.path}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

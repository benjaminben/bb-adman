import { useApp, EMPTY } from '@/renderer/app/app-context'
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import styles from './recent-projects.module.css'

export function RecentProjects() {
  const recent = useApp((s) => s.app?.recentProjects ?? EMPTY)
  const command = useApp((s) => s.command)

  return (
    <>
      <h3 id="recent-title">Recent projects</h3>
      {recent.length === 0 ? (
        <p className={layout.muted}>No recent projects yet.</p>
      ) : (
        <ul className={layout.list} aria-labelledby="recent-title">
          {recent.map((r) => (
            <li key={r.path}>
              <button
                type="button"
                className={styles.listButton}
                aria-label={`Open ${r.name}, ${r.path}`}
                onClick={() => void command('project.open', { filePath: r.path })}
              >
                <span className={styles.fileIcon}>
                  <Icon name="file" />
                </span>
                <span className={styles.text}>
                  <span className={styles.name}>{r.name}</span>
                  <span className={`${layout.muted} ${styles.path}`}>{r.path}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

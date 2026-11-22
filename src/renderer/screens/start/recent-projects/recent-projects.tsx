// Recent projects (design/audit/spec-start.md "Right half"): a plain list of names. The path
// is in the tooltip and the accessible name, never printed. With none, nothing shows.
import { useApp, EMPTY } from '@/renderer/app/app-context'
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import styles from './recent-projects.module.css'

export function RecentProjects() {
  const recent = useApp((s) => s.app?.recentProjects ?? EMPTY)
  const command = useApp((s) => s.command)
  if (recent.length === 0) return null

  return (
    <section className={styles.recent} aria-labelledby="recent-title">
      <h2 id="recent-title" className={styles.title}>
        Recent
      </h2>
      <ul className={`${layout.list} ${styles.rows}`} aria-labelledby="recent-title">
        {recent.map((r) => (
          <li key={r.path}>
            <button
              type="button"
              className={styles.row}
              title={r.path}
              aria-label={`Open ${r.name}, ${r.path}`}
              onClick={() => void command('project.open', { filePath: r.path })}
            >
              <Icon name="file" />
              <span className={styles.name}>{r.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

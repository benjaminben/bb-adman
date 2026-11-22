// Recent projects (design/audit/spec-start.md "Right half"): a plain list of names. The path
// is in the tooltip and the accessible name, never printed. The projects open now come first
// (round-2-platform.md D9, R2P-10), each with an accent dot and "Open now" as its tooltip;
// choosing one shows it. A recent file that is open is listed once. With none, nothing shows.
import { useApp, EMPTY } from '@/renderer/app/app-context'
import type { OpenProjectSummary } from '@/shared/schemas/project'
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import styles from './recent-projects.module.css'

export function RecentProjects({ open }: { open: readonly OpenProjectSummary[] }) {
  const recent = useApp((s) => s.app?.recentProjects ?? EMPTY)
  const command = useApp((s) => s.command)
  const show = useApp((s) => s.show)
  const openPaths = new Set(open.map((p) => p.filePath))
  const closed = recent.filter((r) => !openPaths.has(r.path))
  if (open.length === 0 && closed.length === 0) return null

  return (
    <section className={styles.recent} aria-labelledby="recent-title">
      <h2 id="recent-title" className={styles.title}>
        Recent
      </h2>
      <ul className={`${layout.list} ${styles.rows}`} aria-labelledby="recent-title">
        {open.map((p) => (
          <li key={p.projectId}>
            <button
              type="button"
              className={styles.row}
              title="Open now"
              aria-label={`Show ${p.name}, open now`}
              onClick={() => show({ kind: 'project', projectId: p.projectId })}
            >
              <Icon name="file" />
              <span className={styles.name}>{p.name}</span>
              <span className={styles.dot} data-open-now aria-hidden="true" />
            </button>
          </li>
        ))}
        {closed.map((r) => (
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

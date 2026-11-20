// Placeholder project view for Phase 1. Phase 2 builds the project home (subjects,
// campaigns, missing files) in this folder.
import { useApp } from '../../app/app-context'
import type { OpenProjectSummary } from '../../../shared/schemas/project'
import styles from '../screens.module.css'

export function ProjectHome(props: { project: OpenProjectSummary }) {
  const command = useApp((s) => s.command)
  const { project } = props
  return (
    <section className={styles.screen} aria-labelledby={`project-${project.projectId}`}>
      <header className={styles.header}>
        <h1 id={`project-${project.projectId}`}>{project.name}</h1>
        <button
          type="button"
          aria-label={`Close ${project.name}`}
          onClick={() => void command('project.close', { projectId: project.projectId })}
        >
          Close project
        </button>
      </header>
      <p className={styles.muted}>{project.filePath}</p>
    </section>
  )
}

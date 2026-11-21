// Start screen (FR-002, FR-004): new project, open a project file, recent projects. Two
// columns (spec/app-style.md "Start screen"): the wordmark and the drawings on the left, the
// cards on the right.
import { useApi, useApp, pickPath } from '@/renderer/app/app-context'
import { NewProjectForm } from '@/renderer/screens/start/new-project-form'
import { RecentProjects } from '@/renderer/screens/start/recent-projects'
import { StartDrawings } from '@/renderer/screens/start/start-drawings'
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import styles from './start-screen.module.css'

export function StartScreen() {
  const api = useApi()
  const command = useApp((s) => s.command)

  async function openProject() {
    const filePath = await pickPath(api, 'dialog.pickProjectFile')
    if (filePath) await command('project.open', { filePath })
  }

  return (
    <section className={styles.start} aria-labelledby="start-title">
      <div className={styles.hero}>
        <h1 id="start-title" className={styles.wordmark}>
          Adman
        </h1>
        <StartDrawings />
      </div>
      <div className={styles.cards}>
        <NewProjectForm />
        <div className={layout.card}>
          <h2>Open</h2>
          <button type="button" className={styles.open} onClick={() => void openProject()}>
            <Icon name="folder" />
            Open project…
          </button>
          <RecentProjects />
        </div>
      </div>
    </section>
  )
}

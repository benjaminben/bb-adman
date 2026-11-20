// Start screen (FR-002, FR-004): new project, open a project file, recent projects.
import { useApi, useApp, pickPath } from '../../app/app-context'
import { NewProjectForm } from './new-project-form'
import { RecentProjects } from './recent-projects'
import styles from '../screens.module.css'

export function StartScreen() {
  const api = useApi()
  const command = useApp((s) => s.command)

  async function openProject() {
    const filePath = await pickPath(api, 'dialog.pickProjectFile')
    if (filePath) await command('project.open', { filePath })
  }

  return (
    <section className={styles.screen} aria-labelledby="start-title">
      <h1 id="start-title">Adman</h1>
      <div className={styles.columns}>
        <NewProjectForm />
        <div className={styles.card}>
          <h2>Open</h2>
          <button type="button" onClick={() => void openProject()}>
            Open project…
          </button>
          <RecentProjects />
        </div>
      </div>
    </section>
  )
}

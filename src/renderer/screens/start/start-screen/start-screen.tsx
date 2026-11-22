// Start screen (FR-002, FR-004): new project, open a project file, recent projects. Two halves
// (design/audit/spec-start.md): a changing picture on the left; the name, the new project form
// with Open project… beside its button, and the recent projects on the right.
import { EMPTY, useApi, useApp, pickPath } from '@/renderer/app/app-context'
import { NewProjectForm } from '@/renderer/screens/start/new-project-form'
import { RecentProjects } from '@/renderer/screens/start/recent-projects'
import { StartImages } from '@/renderer/screens/start/start-images'
import { AppMark } from '@/renderer/ui/app-mark'
import { Icon } from '@/renderer/ui/icon'
import { APP_DISPLAY_NAME } from '@/shared/config/app-name'
import layout from '@/renderer/ui/layout.module.css'
import styles from './start-screen.module.css'

export function StartScreen() {
  const api = useApi()
  const command = useApp((s) => s.command)
  const open = useApp((s) => s.app?.openProjects ?? EMPTY)

  async function openProject() {
    const filePath = await pickPath(api, 'dialog.pickProjectFile')
    if (filePath) await command('project.open', { filePath })
  }

  return (
    <section className={styles.start} aria-labelledby="start-title">
      <StartImages />
      <div className={styles.side}>
        <div className={styles.column}>
          <h1 id="start-title" className={styles.wordmark}>
            <AppMark />
            {APP_DISPLAY_NAME}
          </h1>
          <NewProjectForm>
            <button type="button" className={layout.large} onClick={() => void openProject()}>
              <Icon name="folder" />
              Open project…
            </button>
          </NewProjectForm>
          <RecentProjects open={open} />
        </div>
      </div>
    </section>
  )
}

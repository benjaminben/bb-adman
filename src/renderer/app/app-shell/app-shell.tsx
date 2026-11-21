// The window frame: a tab per open project beside the start tab (FR-003), a settings
// button, the hand-test button when devTools is on (SPEC 14 slice I), the error alert, and
// the dialogs the app store opens: the key dialog, the address dialog and the licence dialog.
import * as Tabs from '@radix-ui/react-tabs'
import { useApp, EMPTY } from '@/renderer/app/app-context'
import { ErrorBanner } from '@/renderer/app/error-banner'
import { StartScreen } from '@/renderer/screens/start/start-screen'
import { SettingsScreen } from '@/renderer/screens/settings/settings-screen'
import { ProjectHome } from '@/renderer/screens/project-home/project-home'
import { KeyDialog } from '@/renderer/dialogs/key-dialog'
import { AddressDialog } from '@/renderer/dialogs/address-dialog'
import { LicenceDialog } from '@/renderer/dialogs/licence-dialog'
import { HandTestScreen } from '@/renderer/dev/hand-test-screen'
import styles from './app-shell.module.css'

export function AppShell() {
  const projects = useApp((s) => s.app?.openProjects ?? EMPTY)
  const view = useApp((s) => s.view)
  const devTools = useApp((s) => s.app?.devTools ?? false)
  const show = useApp((s) => s.show)
  const tab = view.kind === 'project' ? view.projectId : view.kind

  function onTabChange(value: string) {
    show(value === 'start' ? { kind: 'start' } : { kind: 'project', projectId: value })
  }

  return (
    <div className={styles.shell}>
      <Tabs.Root value={tab} onValueChange={onTabChange} className={styles.tabs}>
        <header className={styles.bar}>
          <Tabs.List aria-label="Open projects" className={styles.list}>
            <Tabs.Trigger value="start" className={styles.tab}>
              Start
            </Tabs.Trigger>
            {projects.map((p) => (
              <Tabs.Trigger key={p.projectId} value={p.projectId} className={styles.tab}>
                {p.name}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
          <button
            type="button"
            className={styles.settings}
            aria-pressed={view.kind === 'settings'}
            onClick={() => show({ kind: 'settings' })}
          >
            Settings
          </button>
          {devTools && (
            <button
              type="button"
              className={styles.settings}
              aria-pressed={view.kind === 'handTest'}
              onClick={() => show({ kind: 'handTest' })}
            >
              Hand test
            </button>
          )}
        </header>
        <main className={styles.main}>
          <ErrorBanner />
          <Tabs.Content value="start" className={styles.panel}>
            <StartScreen />
          </Tabs.Content>
          {projects.map((p) => (
            <Tabs.Content key={p.projectId} value={p.projectId} className={styles.panel}>
              <ProjectHome project={p} />
            </Tabs.Content>
          ))}
          {view.kind === 'settings' && (
            <div className={styles.panel}>
              <SettingsScreen />
            </div>
          )}
          {devTools && view.kind === 'handTest' && (
            <div className={styles.panel}>
              <HandTestScreen />
            </div>
          )}
        </main>
      </Tabs.Root>
      <KeyDialog />
      <AddressDialog />
      <LicenceDialog />
    </div>
  )
}

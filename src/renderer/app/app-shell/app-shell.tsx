// The window frame (spec/editor.md, "The shell"): the top row holds the project switcher, the
// campaign tabs of the shown project, then the Activity and Settings icon buttons (SH-1). Below: the error alert and the shown
// screen. One nav store for the window; a
// project that closes loses its tabs. The tab keys act on the shown project. Also the dialogs
// the app store opens: the key dialog, the address dialog and the licence dialog.
import * as Tabs from '@radix-ui/react-tabs'
import { useEffect, type ReactNode } from 'react'
import { useApp, EMPTY } from '@/renderer/app/app-context'
import { ActivityButton } from '@/renderer/app/activity-button'
import { AgentActivity } from '@/renderer/app/agent-activity'
import { ActivityPanel, ShownActivityScope } from '@/renderer/app/activity-panel'
import { CampaignTabs, useCampaignTab, useTabKeys } from '@/renderer/app/campaign-tabs'
import { ErrorBanner } from '@/renderer/app/error-banner'
import { NavScope, useNav } from '@/renderer/app/nav-context'
import { PermissionDialog } from '@/renderer/app/permission-dialog'
import { ResultNotice } from '@/renderer/app/result-notice'
import { FirstRun } from '@/renderer/app/first-run'
import { ProjectSwitcher } from '@/renderer/app/project-switcher'
import { StartScreen } from '@/renderer/screens/start/start-screen'
import { SettingsScreen } from '@/renderer/screens/settings/settings-screen'
import { ProjectHome } from '@/renderer/screens/project-home/project-home'
import { KeyDialog } from '@/renderer/dialogs/key-dialog'
import { AddressDialog } from '@/renderer/dialogs/address-dialog'
import { LicenceDialog } from '@/renderer/dialogs/licence-dialog'
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import { PROJECT_TAB } from '@/renderer/stores/nav-store'
import { generateDrafts } from '@/renderer/stores/generate-drafts'
import type { OpenProjectSummary } from '@/shared/schemas/project'
import styles from './app-shell.module.css'

function TopRow(props: { tabs?: ReactNode }) {
  const view = useApp((s) => s.view)
  const show = useApp((s) => s.show)
  return (
    <header className={styles.bar}>
      <ProjectSwitcher />
      <div className={styles.tabs}>{props.tabs}</div>
      <ActivityButton />
      <button
        type="button"
        className={`${layout.iconButton} ${styles.settings}`}
        aria-label="Settings"
        title="Settings"
        aria-pressed={view.kind === 'settings'}
        onClick={() => show({ kind: 'settings' })}
      >
        <Icon name="gear" />
      </button>
    </header>
  )
}

function ProjectFrame(props: { project: OpenProjectSummary }) {
  const { projectId } = props.project
  const tab = useCampaignTab(projectId)
  return (
    <Tabs.Root value={tab.value} onValueChange={tab.onValueChange} className={styles.frame}>
      <TopRow tabs={<CampaignTabs projectId={projectId} />} />
      <main className={styles.main}>
        <ErrorBanner />
        <ResultNotice projectId={projectId} />
        <Tabs.Content
          value={tab.value}
          className={tab.value === PROJECT_TAB ? styles.panel : styles.fullPanel}
        >
          <ProjectHome project={props.project} />
        </Tabs.Content>
      </main>
      <ActivityPanel />
    </Tabs.Root>
  )
}

function Shell() {
  const projects = useApp((s) => s.app?.openProjects ?? EMPTY)
  const view = useApp((s) => s.view)
  const keepProjects = useNav((s) => s.keepProjects)
  const shownId = view.kind === 'project' ? view.projectId : null
  const project = projects.find((p) => p.projectId === shownId)
  const openId = project ? project.projectId : null
  useTabKeys(openId)
  useEffect(() => generateDrafts.getState().follow(openId), [openId])
  useEffect(() => keepProjects(projects.map((p) => p.projectId)), [keepProjects, projects])

  if (project) return <ProjectFrame key={project.projectId} project={project} />
  return (
    <div className={styles.frame}>
      <TopRow />
      <main className={styles.main}>
        <ErrorBanner />
        <div className={styles.panel}>
          {view.kind === 'settings' && <SettingsScreen />}
          {view.kind !== 'settings' && <StartScreen />}
        </div>
      </main>
      <ActivityPanel />
    </div>
  )
}

export function AppShell() {
  return (
    <div className={styles.shell}>
      <NavScope>
        <ShownActivityScope>
          <Shell />
        </ShownActivityScope>
      </NavScope>
      <KeyDialog />
      <AddressDialog />
      <LicenceDialog />
      <PermissionDialog />
      <FirstRun />
      <AgentActivity />
    </div>
  )
}

// The window frame (spec/editor.md, "The shell"): the top row holds the project switcher, the
// campaign tabs of the shown project, then the Activity and Settings icon buttons (SH-1); the
// start screen has no top row and takes those two buttons in its corner (START-2). Below:
// the error alert and the shown screen. One nav store for the window; a project that closes
// loses its tabs. The tab keys act on the shown project. Also the dialogs the app store opens:
// the key dialog, the address dialog and the licence dialog.
// Settings has a way out (SH-2, choice C-14): the Settings button toggles; Settings opened over
// a project keeps that project's frame, its tabs drawn and Settings in place of the tab content;
// a click on a campaign tab or on "+" leaves Settings for that tab.
import * as Tabs from '@radix-ui/react-tabs'
import { useEffect, type MouseEvent, type ReactNode } from 'react'
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

// The Settings icon button (SH-1). It toggles (SH-2): pressed while Settings shows.
function SettingsButton() {
  const view = useApp((s) => s.view)
  const show = useApp((s) => s.show)
  const leaveSettings = useApp((s) => s.leaveSettings)
  const inSettings = view.kind === 'settings'
  return (
    <button
      type="button"
      className={`${layout.iconButton} ${styles.settings}`}
      aria-label="Settings"
      title="Settings"
      aria-pressed={inSettings}
      onClick={() => (inSettings ? leaveSettings() : show({ kind: 'settings' }))}
    >
      <Icon name="gear" />
    </button>
  )
}

function TopRow(props: { tabs?: ReactNode }) {
  return (
    <header className={styles.bar}>
      <ProjectSwitcher />
      <div className={styles.tabs}>{props.tabs}</div>
      <ActivityButton />
      <SettingsButton />
    </header>
  )
}

// A click on a tab (the shown one too, which changes no value) or on "+" leaves Settings.
const LEAVES = '[role="tab"], [aria-label="New campaign"]'

function ProjectFrame(props: { project: OpenProjectSummary; settings: boolean }) {
  const { projectId } = props.project
  const tab = useCampaignTab(projectId)
  const leaveSettings = useApp((s) => s.leaveSettings)
  const onValueChange = (value: string) => {
    tab.onValueChange(value)
    leaveSettings()
  }
  const onTabsClick = (event: MouseEvent) => {
    if (event.target instanceof Element && event.target.closest(LEAVES)) leaveSettings()
  }
  const tabs = (
    <div className={styles.tabsHold} onClick={onTabsClick}>
      <CampaignTabs projectId={projectId} />
    </div>
  )
  return (
    <Tabs.Root value={tab.value} onValueChange={onValueChange} className={styles.frame}>
      <TopRow tabs={tabs} />
      <main className={styles.main}>
        <ErrorBanner />
        <ResultNotice projectId={projectId} />
        {props.settings ? (
          <>
            {/* The shown tab's panel stays, empty and hidden, so the tab still names its panel. */}
            <Tabs.Content value={tab.value} hidden />
            <div className={styles.panel}>
              <SettingsScreen onClose={leaveSettings} />
            </div>
          </>
        ) : (
          <Tabs.Content
            value={tab.value}
            className={tab.value === PROJECT_TAB ? styles.panel : styles.fullPanel}
          >
            <ProjectHome project={props.project} />
          </Tabs.Content>
        )}
      </main>
      <ActivityPanel />
    </Tabs.Root>
  )
}

// The start screen has no top bar (START-2, C-6): Activity and Settings sit in its corner.
function StartCorner() {
  return (
    <>
      <ActivityButton />
      <SettingsButton />
    </>
  )
}

function Shell() {
  const projects = useApp((s) => s.app?.openProjects ?? EMPTY)
  const view = useApp((s) => s.view)
  const from = useApp((s) => s.settingsFrom)
  const leaveSettings = useApp((s) => s.leaveSettings)
  const keepProjects = useNav((s) => s.keepProjects)
  const settings = view.kind === 'settings'
  const framed = settings ? from : view
  const frameId = framed.kind === 'project' ? framed.projectId : null
  const project = projects.find((p) => p.projectId === frameId)
  const openId = project ? project.projectId : null
  // The tab keys rest while Settings shows, as before; the project's drafts are kept.
  useTabKeys(settings ? null : openId)
  useEffect(() => generateDrafts.getState().follow(openId), [openId])
  useEffect(() => keepProjects(projects.map((p) => p.projectId)), [keepProjects, projects])

  if (project) return <ProjectFrame key={project.projectId} project={project} settings={settings} />
  return (
    <div className={styles.frame}>
      {settings && <TopRow />}
      <main className={styles.main}>
        <ErrorBanner />
        <div className={styles.panel}>
          {settings && <SettingsScreen onClose={leaveSettings} />}
          {!settings && <StartScreen corner={<StartCorner />} />}
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

// The project page (SPEC 14 1.41 TP-1; spec/screens-campaign.md, "Project home"; HOME-1): the
// title, then the Campaigns Section and the Assets block, and the drop target. The
// project's file path is the title's tooltip and accessible description only, never printed
// (spec/security.md, "Paths in the renderer"). Close and Package are in the project menu (SH-3).
// P3-10 (spec/editor.md, "The shell"): the page is what the project's shown tab holds. On the
// Project tab it shows the sections; on a campaign tab, the campaign page in their place,
// full width. Opening a campaign opens its tab in the nav store. The drop target stays
// mounted while a campaign is shown. The Assets panel (R2C-5) is drawn only with a campaign
// shown: the home draws the library in its own Assets block (D-109). Its open state lives in
// the one AssetsScope, so it shows again in the next campaign.
// BriefLoad draws the Sections around its buttons, or its form in their place.
import { NavScope, useNav } from '@/renderer/app/nav-context'
import { PROJECT_TAB, projectNav } from '@/renderer/stores/nav-store'
import type { OpenProjectSummary } from '@/shared/schemas/project'
import { CampaignView } from '@/renderer/screens/campaign/campaign-view'
import { BriefLoad } from '@/renderer/screens/project-home/brief-load'
import { DropImport } from '@/renderer/screens/project-home/drop-import'
import { AssetsPanel } from '@/renderer/screens/assets/assets-panel'
import { AssetsScope } from '@/renderer/screens/assets/assets-scope'
import { HomeSections } from './home-sections'
import { useProject } from './use-project'
import layout from '@/renderer/ui/layout.module.css'
import styles from './project-home.module.css'

type Props = { project: OpenProjectSummary }

function ProjectPage(props: Props) {
  const { project } = props
  const { projectId } = project
  const data = useProject(projectId)
  const shown = useNav((s) => projectNav(s, projectId).shown)
  const openCampaign = useNav((s) => s.openCampaign)
  const showCampaign = useNav((s) => s.showCampaign)
  const open = (campaignId: string) => openCampaign(projectId, campaignId)
  const subjects = data?.subjects ?? []
  const titleId = `project-${projectId}`
  const drop = <DropImport projectId={projectId} projectName={project.name} subjects={subjects} />
  if (shown !== PROJECT_TAB) {
    return (
      <>
        <div className={styles.campaign}>
          <CampaignView
            key={shown}
            projectId={projectId}
            campaignId={shown}
            onBack={() => showCampaign(projectId, PROJECT_TAB)}
          />
        </div>
        {drop}
        <AssetsPanel projectId={projectId} subjects={subjects} />
      </>
    )
  }
  return (
    <section className={styles.page} aria-labelledby={titleId}>
      <h1
        id={titleId}
        className={styles.title}
        title={project.filePath}
        aria-describedby={`${titleId}-path`}
      >
        {project.name}
      </h1>
      <span id={`${titleId}-path`} className={styles.hidden}>
        {project.filePath}
      </span>
      {data === null ? (
        <p className={layout.muted}>Loading the project…</p>
      ) : (
        <BriefLoad
          projectId={projectId}
          subjects={data.subjects}
          campaigns={data.campaigns}
          onCreated={open}
          home={(actions) => (
            <HomeSections projectId={projectId} data={data} actions={actions} onOpen={open} />
          )}
        />
      )}
      {drop}
    </section>
  )
}

// The panel can be drawn, and so offered, only while a campaign is shown.
function ScopedPage(props: Props) {
  const { projectId } = props.project
  const shown = useNav((s) => projectNav(s, projectId).shown)
  return (
    <AssetsScope projectId={projectId} available={shown !== PROJECT_TAB}>
      <ProjectPage {...props} />
    </AssetsScope>
  )
}

export function ProjectHome(props: Props) {
  return (
    <NavScope>
      <ScopedPage {...props} />
    </NavScope>
  )
}

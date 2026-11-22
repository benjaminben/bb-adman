// The project page (SPEC 14 1.41 TP-1; spec/screens-campaign.md, "Project home"): the sections
// "Campaigns", "Start a campaign", "Assets" and "Package", and the drop target. P3-10
// (spec/editor.md, "The shell"): the page is what the project's shown tab holds. On the
// Project tab it shows the sections; on a campaign tab, the campaign page in their place,
// full width. Opening a campaign opens its tab in the nav store. The drop target stays
// mounted while a campaign is shown, and so does the Assets panel (R2C-5), in one AssetsScope.
import type { ReactNode } from 'react'
import { useCloseProject } from '@/renderer/app/project-switcher'
import { NavScope, useNav } from '@/renderer/app/nav-context'
import { PROJECT_TAB, projectNav } from '@/renderer/stores/nav-store'
import type { OpenProjectSummary } from '@/shared/schemas/project'
import { CampaignView } from '@/renderer/screens/campaign/campaign-view'
import { BriefLoad } from '@/renderer/screens/project-home/brief-load'
import { CampaignList } from '@/renderer/screens/project-home/campaign-list'
import { DropImport } from '@/renderer/screens/project-home/drop-import'
import { ImportFiles } from '@/renderer/screens/project-home/import-files'
import { MissingFiles } from '@/renderer/screens/project-home/missing-files'
import { PackageProject } from '@/renderer/screens/project-home/package-project'
import { AssetsButton } from '@/renderer/screens/assets/assets-button'
import { AssetsPanel } from '@/renderer/screens/assets/assets-panel'
import { AssetsScope } from '@/renderer/screens/assets/assets-scope'
import { useProject } from './use-project'
import layout from '@/renderer/ui/layout.module.css'
import styles from './project-home.module.css'

type Props = { project: OpenProjectSummary }

// A section is a region named by its heading. "Assets" is not (landmark: false): the Assets
// panel is the region of that name, and two regions may not share one (R2C-5).
function Section(props: { id: string; title: string; landmark?: boolean; children: ReactNode }) {
  const named = props.landmark === false ? undefined : props.id
  return (
    <section className={`${layout.card} ${styles.section}`} aria-labelledby={named}>
      <h2 id={props.id}>{props.title}</h2>
      {props.children}
    </section>
  )
}

function ProjectPage(props: Props) {
  const { closeProject, dialog } = useCloseProject()
  const { project } = props
  const { projectId } = project
  const data = useProject(projectId)
  const shown = useNav((s) => projectNav(s, projectId).shown)
  const openCampaign = useNav((s) => s.openCampaign)
  const showCampaign = useNav((s) => s.showCampaign)
  const open = (campaignId: string) => openCampaign(projectId, campaignId)
  const subjects = data?.subjects ?? []
  const kept = (
    <>
      <DropImport projectId={projectId} projectName={project.name} subjects={subjects} />
      <AssetsPanel projectId={projectId} subjects={subjects} />
    </>
  )
  if (shown !== PROJECT_TAB) {
    return (
      <>
        <CampaignView
          key={shown}
          projectId={projectId}
          campaignId={shown}
          onBack={() => showCampaign(projectId, PROJECT_TAB)}
        />
        {kept}
      </>
    )
  }
  return (
    <section className={styles.page} aria-labelledby={`project-${projectId}`}>
      <header className={styles.header}>
        <h1 id={`project-${projectId}`}>{project.name}</h1>
        <button
          type="button"
          aria-label={`Close ${project.name}`}
          onClick={() => void closeProject(projectId, project.name)}
        >
          Close project
        </button>
      </header>
      <p className={styles.path}>{project.filePath}</p>
      {data === null ? (
        <p className={layout.muted}>Loading the project…</p>
      ) : (
        <>
          <Section id={`campaigns-${projectId}`} title="Campaigns">
            <CampaignList projectId={projectId} campaigns={data.campaigns} onOpen={open} />
          </Section>
          <Section id={`start-${projectId}`} title="Start a campaign">
            <BriefLoad
              projectId={projectId}
              subjects={data.subjects}
              campaigns={data.campaigns}
              onCreated={open}
            />
          </Section>
          <Section id={`files-${projectId}`} title="Assets" landmark={false}>
            <p className={layout.muted}>The pictures, clips, fonts and subjects of this project.</p>
            <AssetsButton projectId={projectId} label="Open assets" />
            <ImportFiles projectId={projectId} subjects={data.subjects} />
            <MissingFiles projectId={projectId} missingCount={data.missingAssetCount} />
          </Section>
          <Section id={`package-${projectId}`} title="Package">
            <PackageProject projectId={projectId} />
          </Section>
        </>
      )}
      {kept}
      {dialog}
    </section>
  )
}

export function ProjectHome(props: Props) {
  return (
    <NavScope>
      <AssetsScope projectId={props.project.projectId}>
        <ProjectPage {...props} />
      </AssetsScope>
    </NavScope>
  )
}

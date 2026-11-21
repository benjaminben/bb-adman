// The project page (SPEC 14 1.41 TP-1; spec/screens-campaign.md, "Project home"): the sections
// "Campaigns", "Start a campaign", "Files" and "Package", and the drop target. P3-10
// (spec/editor.md, "The shell"): the page is what the project's shown tab holds. On the
// Project tab it shows the sections; on a campaign tab, the campaign page in their place,
// full width. Opening a campaign opens its tab in the nav store. The drop target stays
// mounted while a campaign is shown.
import type { ReactNode } from 'react'
import { useApp } from '@/renderer/app/app-context'
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
import { useProject } from './use-project'
import layout from '@/renderer/ui/layout.module.css'
import styles from './project-home.module.css'

type Props = { project: OpenProjectSummary }

function Section(props: { id: string; title: string; children: ReactNode }) {
  return (
    <section className={styles.section} aria-labelledby={props.id}>
      <h2 id={props.id}>{props.title}</h2>
      {props.children}
    </section>
  )
}

function ProjectPage(props: Props) {
  const command = useApp((s) => s.command)
  const { project } = props
  const { projectId } = project
  const data = useProject(projectId)
  const shown = useNav((s) => projectNav(s, projectId).shown)
  const openCampaign = useNav((s) => s.openCampaign)
  const showCampaign = useNav((s) => s.showCampaign)
  const open = (campaignId: string) => openCampaign(projectId, campaignId)
  const subjects = data?.subjects ?? []
  const drop = <DropImport projectId={projectId} projectName={project.name} subjects={subjects} />
  if (shown !== PROJECT_TAB) {
    return (
      <>
        <CampaignView
          key={shown}
          projectId={projectId}
          campaignId={shown}
          onBack={() => showCampaign(projectId, PROJECT_TAB)}
        />
        {drop}
      </>
    )
  }
  return (
    <section className={layout.screen} aria-labelledby={`project-${projectId}`}>
      <header className={styles.header}>
        <h1 id={`project-${projectId}`}>{project.name}</h1>
        <button
          type="button"
          aria-label={`Close ${project.name}`}
          onClick={() => void command('project.close', { projectId })}
        >
          Close project
        </button>
      </header>
      <p className={layout.muted}>{project.filePath}</p>
      {data === null ? (
        <p className={layout.muted}>Loading the project…</p>
      ) : (
        <>
          <Section id={`campaigns-${projectId}`} title="Campaigns">
            <CampaignList campaigns={data.campaigns} onOpen={open} />
          </Section>
          <Section id={`start-${projectId}`} title="Start a campaign">
            <BriefLoad
              projectId={projectId}
              subjects={data.subjects}
              campaigns={data.campaigns}
              onCreated={open}
            />
          </Section>
          <Section id={`files-${projectId}`} title="Files">
            <ImportFiles projectId={projectId} subjects={data.subjects} />
            <MissingFiles projectId={projectId} missingCount={data.missingAssetCount} />
          </Section>
          <Section id={`package-${projectId}`} title="Package">
            <PackageProject projectId={projectId} />
          </Section>
        </>
      )}
      {drop}
    </section>
  )
}

export function ProjectHome(props: Props) {
  return (
    <NavScope>
      <ProjectPage {...props} />
    </NavScope>
  )
}

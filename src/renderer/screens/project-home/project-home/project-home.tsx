// The project page (SPEC 14 1.41 TP-1; spec/screens-campaign.md, "Project home"): the sections
// "Campaigns", "Start a campaign", "Files" and "Package", and the drop target. The open
// campaign is this page's own state, not the app store's; its place shows the campaign page,
// in place of the sections. The drop target stays mounted while a campaign is open.
import { useState, type ReactNode } from 'react'
import { useApp } from '@/renderer/app/app-context'
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

function Section(props: { id: string; title: string; children: ReactNode }) {
  return (
    <section className={styles.section} aria-labelledby={props.id}>
      <h2 id={props.id}>{props.title}</h2>
      {props.children}
    </section>
  )
}

export function ProjectHome(props: { project: OpenProjectSummary }) {
  const command = useApp((s) => s.command)
  const { project } = props
  const { projectId } = project
  const data = useProject(projectId)
  const [openCampaignId, setOpenCampaignId] = useState<string | null>(null)
  const subjects = data?.subjects ?? []
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
      {openCampaignId !== null ? (
        <CampaignView
          projectId={projectId}
          campaignId={openCampaignId}
          onBack={() => setOpenCampaignId(null)}
        />
      ) : data === null ? (
        <p className={layout.muted}>Loading the project…</p>
      ) : (
        <>
          <Section id={`campaigns-${projectId}`} title="Campaigns">
            <CampaignList campaigns={data.campaigns} onOpen={setOpenCampaignId} />
          </Section>
          <Section id={`start-${projectId}`} title="Start a campaign">
            <BriefLoad
              projectId={projectId}
              subjects={data.subjects}
              campaigns={data.campaigns}
              onCreated={setOpenCampaignId}
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
      <DropImport projectId={projectId} projectName={project.name} subjects={subjects} />
    </section>
  )
}

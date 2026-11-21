// The project page (SPEC 14 1.41 TP-1): the campaign list and "Load a brief". The open
// campaign is this page's own state, not the app store's; its place shows the campaign page.
import { useState } from 'react'
import { useApp } from '../../app/app-context'
import type { OpenProjectSummary } from '../../../shared/schemas/project'
import { BriefLoad } from './brief-load'
import { CampaignList } from './campaign-list'
import { useProject } from './use-project'
import styles from '../screens.module.css'

// The campaign page mounts here with these props (SPEC 14 1.41 TP-2).
function CampaignPlace(props: { projectId: string; campaignId: string; onBack: () => void }) {
  return (
    <section
      className={styles.card}
      aria-label="Campaign"
      data-project-id={props.projectId}
      data-campaign-id={props.campaignId}
    >
      <div className={styles.row}>
        <button type="button" onClick={props.onBack}>
          Back to project
        </button>
      </div>
      <p className={styles.muted}>Campaign page: not built yet</p>
    </section>
  )
}

export function ProjectHome(props: { project: OpenProjectSummary }) {
  const command = useApp((s) => s.command)
  const { project } = props
  const data = useProject(project.projectId)
  const [openCampaignId, setOpenCampaignId] = useState<string | null>(null)
  return (
    <section className={styles.screen} aria-labelledby={`project-${project.projectId}`}>
      <header className={styles.header}>
        <h1 id={`project-${project.projectId}`}>{project.name}</h1>
        <button
          type="button"
          aria-label={`Close ${project.name}`}
          onClick={() => void command('project.close', { projectId: project.projectId })}
        >
          Close project
        </button>
      </header>
      <p className={styles.muted}>{project.filePath}</p>
      {openCampaignId !== null ? (
        <CampaignPlace
          projectId={project.projectId}
          campaignId={openCampaignId}
          onBack={() => setOpenCampaignId(null)}
        />
      ) : data === null ? (
        <p className={styles.muted}>Loading the project…</p>
      ) : (
        <>
          <CampaignList campaigns={data.campaigns} onOpen={setOpenCampaignId} />
          <BriefLoad projectId={project.projectId} subjects={data.subjects} />
        </>
      )}
    </section>
  )
}

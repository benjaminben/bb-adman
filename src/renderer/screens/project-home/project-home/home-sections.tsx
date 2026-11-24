// The project home's two blocks (HOME-1, spec/phases/design-wave-screens-b.md). Campaigns:
// a Section whose header holds the brief buttons and whose body is the tiles. Assets: the
// project's library drawn in the page, as the last block (D-109, home-assets/).
import type { ReactNode } from 'react'
import { useNewCampaignAsk } from '@/renderer/app/nav-context'
import type { ProjectGet } from '@/shared/schemas/queries/campaign'
import { CampaignList } from '@/renderer/screens/project-home/campaign-list'
import { HomeAssets } from '@/renderer/screens/project-home/home-assets'
import { Section } from '@/renderer/ui/section'
import styles from './project-home.module.css'

export type HomeSectionsProps = {
  projectId: string
  data: ProjectGet
  actions: ReactNode
  onOpen: (campaignId: string) => void
}

export function HomeSections(props: HomeSectionsProps) {
  const { projectId, data } = props
  const { ask } = useNewCampaignAsk()
  return (
    <>
      <Section
        id="home.campaigns"
        title="Campaigns"
        level={2}
        fold="none"
        summary={
          <span className={styles.head}>
            {data.campaigns.length > 0 && data.campaigns.length}
            <span className={styles.actions}>{props.actions}</span>
          </span>
        }
      >
        <CampaignList
          projectId={projectId}
          campaigns={data.campaigns}
          onOpen={props.onOpen}
          onNew={() => ask(projectId)}
        />
      </Section>
      <HomeAssets
        projectId={projectId}
        subjects={data.subjects}
        missingCount={data.missingAssetCount}
      />
    </>
  )
}

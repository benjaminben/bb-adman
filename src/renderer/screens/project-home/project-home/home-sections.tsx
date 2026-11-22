// The project home's two Sections (HOME-1, spec/phases/design-wave-screens-b.md). Campaigns:
// a Section whose header holds the brief buttons and whose body is the tiles. Assets: a header
// row only, not a Section, since the Assets panel is already the region "Assets" (R2C-5).
import type { ReactNode } from 'react'
import { useNewCampaignAsk } from '@/renderer/app/nav-context'
import type { ProjectGet } from '@/shared/schemas/queries/campaign'
import { CampaignList } from '@/renderer/screens/project-home/campaign-list'
import { ImportFiles } from '@/renderer/screens/project-home/import-files'
import { MissingFiles } from '@/renderer/screens/project-home/missing-files'
import { AssetsButton } from '@/renderer/screens/assets/assets-button'
import { InfoTip } from '@/renderer/ui/info-tip'
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
      <div className={styles.assets}>
        <h2 className={styles.assetsTitle}>Assets</h2>
        <InfoTip about="Assets">The pictures, clips, fonts and subjects of this project.</InfoTip>
        <span className={styles.assetsEnd}>
          <MissingFiles projectId={projectId} missingCount={data.missingAssetCount} />
          <ImportFiles projectId={projectId} subjects={data.subjects} />
          <AssetsButton projectId={projectId} label="Open assets" icon />
        </span>
      </div>
    </>
  )
}

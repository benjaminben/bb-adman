// D-109 (spec/screens-campaign.md, "Project home", item 2): the project's library, drawn in the
// page as its last block. A `section` named by its h2 "Assets"; a header row with the InfoTip,
// then at the right end the missing mark, the import buttons and "New subject…"; then the same
// groups as the Assets panel (assets-list/) at the page's normal density. No path is drawn.
import { useId } from 'react'
import { AssetsList, NewSubject } from '@/renderer/screens/assets/assets-list'
import { ImportFiles } from '@/renderer/screens/project-home/import-files'
import { MissingFiles } from '@/renderer/screens/project-home/missing-files'
import { InfoTip } from '@/renderer/ui/info-tip'
import type { SubjectRow } from '@/shared/schemas/rows/subject'
import styles from './home-assets.module.css'

export type HomeAssetsProps = { projectId: string; subjects: SubjectRow[]; missingCount: number }

export function HomeAssets(props: HomeAssetsProps) {
  const { projectId, subjects } = props
  const headingId = useId()
  return (
    <section aria-labelledby={headingId}>
      <div className={styles.head}>
        <h2 id={headingId} className={styles.title}>
          Assets
        </h2>
        <InfoTip about="Assets">The pictures, clips, fonts and subjects of this project.</InfoTip>
        <span className={styles.end}>
          <MissingFiles projectId={projectId} missingCount={props.missingCount} />
          <ImportFiles projectId={projectId} subjects={subjects} />
          <NewSubject projectId={projectId} subjects={subjects} />
        </span>
      </div>
      <div className={styles.groups}>
        <AssetsList projectId={projectId} subjects={subjects} place="page" />
      </div>
    </section>
  )
}

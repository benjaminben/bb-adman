// R2C-5 (spec/phases/round-2-campaign.md, design addition 5): the project's library, read with
// asset.list while it is drawn. A loading line, a refused read with "Retry", then the Subjects
// group and the file groups (asset-sections.tsx).
// D-109 (spec/screens-campaign.md, "Project home" and "The Assets panel"): one list for the
// Assets panel and for the home page's Assets block; `place` says which.
import { useApp } from '@/renderer/app/app-context'
import { assetGroups } from '@/renderer/screens/assets/assets-panel/asset-groups'
import { useAssets } from '@/renderer/screens/assets/assets-panel/use-assets'
import layout from '@/renderer/ui/layout.module.css'
import type { SubjectRow } from '@/shared/schemas/rows/subject'
import { GroupSection, SubjectsSection, type ListPlace } from './asset-sections'
import styles from './assets-list.module.css'

export type AssetsListProps = { projectId: string; subjects: SubjectRow[]; place: ListPlace }

export function AssetsList(props: AssetsListProps) {
  const { projectId } = props
  const command = useApp((s) => s.command)
  const { read, retry } = useAssets(projectId)
  const onSubject = (assetId: string, subjectId: string | null) =>
    void command('asset.update', { projectId, assetId, subjectId })
  if (read.kind === 'loading') return <p className={styles.empty}>Loading the assets…</p>
  if (read.kind === 'refused')
    return (
      <div role="alert" className={`${layout.notice} ${layout.warn} ${styles.refused}`}>
        {read.message}
        <button type="button" onClick={retry}>
          Retry
        </button>
      </div>
    )
  return (
    <>
      <SubjectsSection {...props} assets={read.assets} />
      {assetGroups(read.assets).map((group) => (
        <GroupSection key={group.key} {...props} group={group} onSubject={onSubject} />
      ))}
    </>
  )
}

// AST-1 (spec/phases/design-wave-screens-b.md, "AST-1"): the Assets panel's groups as folding
// Sections ('assets.{key}', level 3, open the first time this session) with the count as the
// summary. Subjects first (R2C-6), with its explanation in an InfoTip; pictures as a grid of
// tiles; clips, fonts and other files as rows. An empty group keeps its one muted line.
import { AssetRow, PictureTile } from '@/renderer/screens/assets/asset-row'
import { SubjectCard } from '@/renderer/screens/assets/subject-card'
import { InfoTip } from '@/renderer/ui/info-tip'
import { Section } from '@/renderer/ui/section'
import type { SubjectRow } from '@/shared/schemas/rows/subject'
import { subjectPhotos, subjectsByName, type AssetGroup } from './asset-groups'
import type { AssetView } from './asset-view'
import styles from './assets-panel.module.css'

type Common = { projectId: string; subjects: SubjectRow[] }

export type GroupSectionProps = Common & {
  group: AssetGroup
  onSubject: (assetId: string, subjectId: string | null) => void
}

export function GroupSection({ group, projectId, subjects, onSubject }: GroupSectionProps) {
  const pictures = group.key === 'pictures'
  return (
    <Section id={`assets.${group.key}`} title={group.title} summary={String(group.items.length)}>
      {group.items.length === 0 ? (
        <p className={styles.empty}>{group.empty}</p>
      ) : (
        <ul className={pictures ? styles.grid : styles.list}>
          {group.items.map((asset) =>
            pictures ? (
              <PictureTile
                key={asset.id}
                projectId={projectId}
                asset={asset}
                subjects={subjects}
                onSubject={onSubject}
              />
            ) : (
              <AssetRow key={asset.id} asset={asset} />
            ),
          )}
        </ul>
      )}
    </Section>
  )
}

export function SubjectsSection({ projectId, subjects, assets }: Common & { assets: AssetView[] }) {
  const info = (
    <InfoTip about="Subjects">
      A subject is the product, service or person an ad is about. Its photos guide AI pictures and
      can be placed in ads.
    </InfoTip>
  )
  return (
    <Section id="assets.subjects" title="Subjects" summary={String(subjects.length)} info={info}>
      {subjects.length === 0 ? (
        <p className={styles.empty}>No subjects yet.</p>
      ) : (
        <div className={styles.list}>
          {subjectsByName(subjects).map((subject) => (
            <SubjectCard
              key={subject.id}
              projectId={projectId}
              subject={subject}
              photos={subjectPhotos(assets, subject.id)}
              subjects={subjects}
            />
          ))}
        </div>
      )}
    </Section>
  )
}

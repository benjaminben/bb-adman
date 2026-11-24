// AST-1 (spec/phases/design-wave-screens-b.md, "AST-1"): the library's groups as folding
// Sections (level 3, open the first time this session) with the count as the summary. Subjects
// first (R2C-6), with its explanation in an InfoTip; pictures as a grid of tiles; clips, fonts
// and other files as rows. An empty group keeps its one muted line.
// D-109 (spec/screens-campaign.md, "Project home"): where the list is drawn sets the fold IDs
// ('assets.{key}' in the panel, 'home.assets.{key}' on the page) and the grids: on the page,
// pictures and subject cards fill the width with as many columns as fit.
import { AssetRow, PictureTile } from '@/renderer/screens/assets/asset-row'
import {
  subjectPhotos,
  subjectsByName,
  type AssetGroup,
} from '@/renderer/screens/assets/assets-panel/asset-groups'
import type { AssetView } from '@/renderer/screens/assets/assets-panel/asset-view'
import { SubjectCard } from '@/renderer/screens/assets/subject-card'
import { InfoTip } from '@/renderer/ui/info-tip'
import { Section } from '@/renderer/ui/section'
import type { SubjectRow } from '@/shared/schemas/rows/subject'
import styles from './assets-list.module.css'

export type ListPlace = 'panel' | 'page'

type Common = { projectId: string; subjects: SubjectRow[]; place: ListPlace }

const foldId = (place: ListPlace, key: string) =>
  place === 'panel' ? `assets.${key}` : `home.assets.${key}`

export type GroupSectionProps = Common & {
  group: AssetGroup
  onSubject: (assetId: string, subjectId: string | null) => void
}

export function GroupSection({ group, projectId, subjects, place, onSubject }: GroupSectionProps) {
  const pictures = group.key === 'pictures'
  const grid = place === 'panel' ? styles.grid : styles.pageGrid
  return (
    <Section id={foldId(place, group.key)} title={group.title} summary={String(group.items.length)}>
      {group.items.length === 0 ? (
        <p className={styles.empty}>{group.empty}</p>
      ) : (
        <ul className={pictures ? grid : styles.list}>
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

export function SubjectsSection(props: Common & { assets: AssetView[] }) {
  const { projectId, subjects, assets, place } = props
  const info = (
    <InfoTip about="Subjects">
      A subject is the product, service or person an ad is about. Its photos guide AI pictures and
      can be placed in ads.
    </InfoTip>
  )
  return (
    <Section
      id={foldId(place, 'subjects')}
      title="Subjects"
      summary={String(subjects.length)}
      info={info}
    >
      {subjects.length === 0 ? (
        <p className={styles.empty}>No subjects yet.</p>
      ) : (
        <div className={place === 'panel' ? styles.list : styles.cards}>
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

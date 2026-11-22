// spec/subject-photos.md, "Placing a subject photo later" (SP-8): under the asset library's
// pictures, the reference library's subject photos, each with "Photo of {subject id}", and the
// hint that choosing one moves it to the asset library. Not drawn when there are none.
// DLG-5 (C-16): a pickGrid with no captions (name and "Photo of" are hidden words and the
// `title`; "file not found" stays visible); the hint is in an InfoTip by the heading.
import { dialogStyles } from '@/renderer/ui/dialog-frame'
import { InfoTip } from '@/renderer/ui/info-tip'
import type { AssetList } from '@/shared/schemas/queries/asset'
import { TileImage } from './picture-grid'
import styles from './picture-chooser.module.css'
import own from './subject-reference-list.module.css'

const TITLE = 'Subject photos in the reference library'
const HINT =
  'Choosing one moves it to the asset library, so it can go on a post. It still guides AI pictures.'

export type SubjectReferenceListProps = {
  projectId: string
  photos: AssetList
  disabled: boolean
  onChoose: (assetId: string) => void
}

export function SubjectReferenceList(props: SubjectReferenceListProps) {
  if (props.photos.length === 0) return null
  return (
    <section aria-labelledby="subject-reference-title">
      <div className={own.head}>
        <h3 id="subject-reference-title" className={own.heading}>
          {TITLE}
        </h3>
        <InfoTip about="subject photos">{HINT}</InfoTip>
      </div>
      <ul aria-label={TITLE} className={`${dialogStyles.pickGrid} ${styles.grid}`}>
        {props.photos.map((p) => {
          const note = p.missing ? 'file not found' : `Photo of ${p.subjectId}`
          return (
            <li key={p.id} className={styles.cell}>
              <button
                type="button"
                className={styles.tile}
                title={`${p.displayName} · ${note}`}
                disabled={props.disabled || p.missing}
                onClick={() => props.onChoose(p.id)}
              >
                <TileImage projectId={props.projectId} picture={p} />
                <span className={styles.hidden}>{p.displayName}</span>{' '}
                <span className={p.missing ? styles.missing : styles.hidden}>{note}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// spec/subject-photos.md, "Placing a subject photo later" (SP-8): under the asset library's
// pictures, the reference library's subject photos, each with "Photo of {subject id}", and the
// hint that choosing one moves it to the asset library. Not drawn when there are none.
import { assetUrl } from '@/renderer/ui/asset-url'
import type { AssetList } from '@/shared/schemas/queries/asset'
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
      <h3 id="subject-reference-title" className={own.heading}>
        {TITLE}
      </h3>
      <p className={own.hint}>{HINT}</p>
      <ul aria-label={TITLE} className={styles.grid}>
        {props.photos.map((p) => (
          <li key={p.id} className={styles.cell}>
            <button
              type="button"
              className={styles.tile}
              disabled={props.disabled || p.missing}
              onClick={() => props.onChoose(p.id)}
            >
              {p.missing ? (
                <span className={styles.picture} aria-hidden="true" />
              ) : (
                <img
                  className={styles.picture}
                  src={assetUrl(props.projectId, p.id)}
                  alt=""
                  draggable={false}
                />
              )}
              <span className={styles.name}>{p.displayName}</span>{' '}
              <span className={styles.missing}>
                {p.missing ? 'file not found' : `Photo of ${p.subjectId}`}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

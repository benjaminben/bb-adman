// R2C-6 (spec/phases/round-2-campaign.md, design addition 5, "The subject card"): one subject
// in the Assets panel, in the look of the layer rows: its name, its photos and small buttons.
// Removing a photo only detaches it (asset.update with subjectId null); the file stays.
import { useId, useState } from 'react'
import { useApp } from '@/renderer/app/app-context'
import { SubjectDialog } from '@/renderer/dialogs/subject-dialog'
import type { AssetView } from '@/renderer/screens/assets/assets-panel/asset-view'
import { assetUrl } from '@/renderer/ui/asset-url'
import { BusySpinner } from '@/renderer/ui/dialog-frame'
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import type { SubjectRow } from '@/shared/schemas/rows/subject'
import { useAddPhotos, type AddPhotos } from './use-add-photos'
import styles from './subject-card.module.css'

export type SubjectCardProps = {
  projectId: string
  subject: SubjectRow
  photos: AssetView[]
  subjects: SubjectRow[]
}

function Outcome({ state }: { state: AddPhotos }) {
  if (state.kind === 'busy')
    return (
      <p role="status" className={styles.status}>
        <BusySpinner />
        Adding photos…
      </p>
    )
  if (state.kind === 'refused')
    return (
      <p role="alert" className={`${layout.notice} ${layout.warn} ${styles.status}`}>
        {state.message}
      </p>
    )
  if (state.kind === 'done')
    return (
      <div role="status" className={styles.status}>
        {state.lines.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>
    )
  return null
}

export function SubjectCard({ projectId, subject, photos, subjects }: SubjectCardProps) {
  const command = useApp((s) => s.command)
  const headingId = useId()
  const [editing, setEditing] = useState(false)
  const { state, add } = useAddPhotos(projectId, subject.id, subjects)
  const detach = (assetId: string) =>
    void command('asset.update', { projectId, assetId, subjectId: null })

  return (
    <article aria-labelledby={headingId} className={styles.card}>
      <h4 id={headingId} className={styles.name}>
        {subject.name}
      </h4>
      {subject.description !== '' && <p className={styles.description}>{subject.description}</p>}
      {photos.length === 0 ? (
        <p className={styles.description}>No photos yet. Add at least one.</p>
      ) : (
        <ul className={styles.photos}>
          {photos.map((photo) => (
            <li key={photo.id} className={styles.photo}>
              {photo.missing ? (
                <span className={`${styles.thumb} ${styles.missing}`}>File not found</span>
              ) : (
                <img
                  className={styles.thumb}
                  src={assetUrl(projectId, photo.id)}
                  alt={photo.displayName}
                />
              )}
              <button
                type="button"
                className={`${layout.iconOnly} ${layout.small} ${styles.remove}`}
                aria-label={`Remove ${photo.displayName} from ${subject.name}`}
                onClick={() => detach(photo.id)}
              >
                <Icon name="x" size="small" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className={styles.actions}>
        <button
          type="button"
          className={layout.small}
          aria-label={`Add photos to ${subject.name}`}
          disabled={state.kind === 'busy'}
          onClick={add}
        >
          Add photos…
        </button>
        <button
          type="button"
          className={`${layout.quiet} ${layout.small}`}
          aria-label={`Edit ${subject.name}`}
          onClick={() => setEditing(true)}
        >
          Edit…
        </button>
      </div>
      <Outcome state={state} />
      <SubjectDialog
        projectId={projectId}
        open={editing}
        subjects={subjects}
        subject={subject}
        onClose={() => setEditing(false)}
      />
    </article>
  )
}

// R2C-6 (spec/phases/round-2-campaign.md, design addition 5, "The subject card") and AST-2
// (spec/phases/design-wave-screens-b.md): one subject in the Assets panel: its name with a pencil
// to edit, the description, then its photos as a PhotoStrip. Removing a photo only detaches it
// (asset.update with subjectId null); no asset is deleted here. SUBJ-1 (D-101): the trash
// button opens the delete dialog, which alone sends subject.delete. Refusals and notes stay on
// the page as words.
import { useId, useState } from 'react'
import { useApp } from '@/renderer/app/app-context'
import { DeleteSubject } from '@/renderer/dialogs/delete-subject'
import { SubjectDialog } from '@/renderer/dialogs/subject-dialog'
import type { AssetView } from '@/renderer/screens/assets/assets-panel/asset-view'
import { assetUrl } from '@/renderer/ui/asset-url'
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import { PhotoStrip, type StripPhoto } from '@/renderer/ui/photo-strip'
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
  const [deleting, setDeleting] = useState(false)
  const { state, add } = useAddPhotos(projectId, subject.id, subjects)
  const detach = (assetId: string) =>
    void command('asset.update', { projectId, assetId, subjectId: null })
  const tiles: StripPhoto[] = photos.map((photo) => ({
    id: photo.id,
    name: photo.displayName,
    src: photo.missing ? null : assetUrl(projectId, photo.id),
    removable: true,
    removeLabel: `Remove ${photo.displayName} from ${subject.name}`,
  }))
  const editLabel = `Edit ${subject.name}`
  const deleteLabel = `Delete ${subject.name}`

  return (
    <article aria-labelledby={headingId} className={styles.card}>
      <div className={styles.head}>
        <h4 id={headingId} className={styles.name}>
          {subject.name}
        </h4>
        <button
          type="button"
          className={layout.iconButton}
          aria-label={editLabel}
          title={editLabel}
          onClick={() => setEditing(true)}
        >
          <Icon name="pencil" size="small" />
        </button>
        <button
          type="button"
          className={layout.iconButton}
          aria-label={deleteLabel}
          title={deleteLabel}
          onClick={() => setDeleting(true)}
        >
          <Icon name="trash" size="small" />
        </button>
      </div>
      {subject.description !== '' && <p className={styles.description}>{subject.description}</p>}
      {photos.length === 0 && <p className={styles.hidden}>No photos yet</p>}
      <PhotoStrip
        label={`Photos of ${subject.name}`}
        photos={tiles}
        onRemove={detach}
        onAdd={add}
        addLabel={`Add photos to ${subject.name}`}
        adding={state.kind === 'busy'}
        addingLabel="Adding photos…"
        needsOne
        size="small"
      />
      <Outcome state={state} />
      <SubjectDialog
        projectId={projectId}
        open={editing}
        subjects={subjects}
        subject={subject}
        onClose={() => setEditing(false)}
      />
      <DeleteSubject
        projectId={projectId}
        subject={deleting ? subject : null}
        photoCount={photos.length}
        onClose={() => setDeleting(false)}
      />
    </article>
  )
}

// The "Photos" part of a subject row (spec/subject-photos.md, "What a row shows", "Add photos",
// "Removing a form photo"; D-098): the hint, the photo list, "Add photos", "Adding photos…"
// and the notes. All text is drawn as text. Focus after "Remove" goes to the next photo's
// "Remove", else the previous one's, else "Add photos"; after "Add photos" it stays there.
import { useEffect, useId, useRef } from 'react'
import { useApi } from '@/renderer/app/app-context'
import type { SubjectChoice } from '@/renderer/screens/project-home/brief-form-model'
import { rowPhotos, type ProjectImages } from '@/renderer/screens/project-home/brief-form-photos'
import { PhotoTile } from './photo-tile'
import { useAddPhotos, type RowUpdate } from './use-add-photos'
import styles from './subject-photos.module.css'

type Props = {
  projectId: string
  n: number
  row: SubjectChoice
  // null while the project's pictures are not read: no photo can be shown yet.
  images: ProjectImages
  update: RowUpdate
}

export function SubjectPhotos({ projectId, n, row, images, update }: Props) {
  const api = useApi()
  const ids = useId()
  const addPhotos = useAddPhotos(projectId, update)
  const add = useRef<HTMLButtonElement>(null)
  const removes = useRef(new Map<string, HTMLButtonElement>())
  const focusNext = useRef<string | 'add' | null>(null)
  const photos = rowPhotos(row, images ?? [])

  useEffect(() => {
    const target = focusNext.current
    if (target === null || (target === 'add' && row.adding)) return
    focusNext.current = null
    if (target === 'add') {
      const away = document.activeElement !== null && document.activeElement !== document.body
      if (!away || document.activeElement === add.current) add.current?.focus()
    } else removes.current.get(target)?.focus()
  })

  function remove(assetId: string) {
    const removable = photos.filter((p) => !p.attached).map((p) => p.asset.id)
    const at = removable.indexOf(assetId)
    focusNext.current = removable[at + 1] ?? removable[at - 1] ?? 'add'
    update((r) => ({ ...r, photos: r.photos.filter((p) => p.assetId !== assetId) }))
    const photo = row.photos.find((p) => p.assetId === assetId)
    if (photo?.added) void api.command('asset.remove', { projectId, assetId })
  }

  function startAdd() {
    focusNext.current = 'add'
    void addPhotos().then((sent) => {
      if (!sent) focusNext.current = null
    })
  }

  return (
    <fieldset className={styles.photos} aria-describedby={`${ids}-hint`}>
      <legend>Photos</legend>
      <p id={`${ids}-hint`} className={styles.muted}>
        Photos of the product, service or person. PNG, JPEG or WebP. At least one is needed. AI
        pictures are drawn from them.
      </p>
      {photos.length === 0 ? (
        <p className={styles.line}>No photos yet.</p>
      ) : (
        <ul className={styles.list} aria-label={`Photos of subject ${n}`}>
          {photos.map((photo) => (
            <PhotoTile
              key={photo.asset.id}
              projectId={projectId}
              n={n}
              photo={photo}
              removeRef={(el) => {
                if (el) removes.current.set(photo.asset.id, el)
                else removes.current.delete(photo.asset.id)
              }}
              onRemove={() => remove(photo.asset.id)}
            />
          ))}
        </ul>
      )}
      <div className={styles.actions}>
        <button
          ref={add}
          type="button"
          aria-label={`Add photos to subject ${n}`}
          disabled={row.adding}
          onClick={startAdd}
        >
          Add photos
        </button>
        {row.adding && (
          <p role="status" className={styles.line}>
            Adding photos…
          </p>
        )}
      </div>
      {row.notes.length > 0 && (
        <ul className={styles.notes} aria-label={`Notes on the photos of subject ${n}`}>
          {row.notes.map((note, k) => (
            <li key={k}>{note}</li>
          ))}
        </ul>
      )}
    </fieldset>
  )
}

// The photos of a subject row (spec/subject-photos.md, "What a row shows", "Add photos",
// "Removing a form photo"; D-098; HOME-3b): the shared PhotoStrip, then the notes. The strip's
// "+" tile adds photos, with a spinner and the hidden status "Adding photos…" while it runs;
// with no photo it alone shows, with the warn edge (the problems list says why in words). The
// notes are failures and stay on the page as words. Focus after a ✕ goes to the next photo's ✕,
// else the previous one's, else the "+" tile; after adding it returns to the "+" tile.
import { useEffect, useRef } from 'react'
import { useApi } from '@/renderer/app/app-context'
import type { SubjectChoice } from '@/renderer/screens/project-home/brief-form-model'
import { rowPhotos, type ProjectImages } from '@/renderer/screens/project-home/brief-form-photos'
import { Icon } from '@/renderer/ui/icon'
import { PhotoStrip } from '@/renderer/ui/photo-strip'
import layout from '@/renderer/ui/layout.module.css'
import { stripPhoto } from './photo-tile'
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
  const addPhotos = useAddPhotos(projectId, update)
  const box = useRef<HTMLDivElement>(null)
  const removes = useRef(new Map<string, HTMLButtonElement>())
  const focusNext = useRef<string | 'add' | null>(null)
  const photos = rowPhotos(row, images ?? [])
  const addLabel = `Add photos to subject ${n}`

  useEffect(() => {
    const target = focusNext.current
    if (target === null || (target === 'add' && row.adding)) return
    focusNext.current = null
    if (target !== 'add') return removes.current.get(target)?.focus()
    const add = box.current?.querySelector<HTMLButtonElement>(`[aria-label="${addLabel}"]`)
    const away = document.activeElement !== null && document.activeElement !== document.body
    if (!away || document.activeElement === add) add?.focus()
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
    <div ref={box} role="group" aria-label="Photos" className={styles.photos}>
      <PhotoStrip
        label={`Photos of subject ${n}`}
        photos={photos.map((photo) => stripPhoto(projectId, n, photo))}
        onRemove={remove}
        onAdd={startAdd}
        addLabel={addLabel}
        adding={row.adding}
        addingLabel="Adding photos…"
        needsOne
        removeRef={(id, el) => {
          if (el) removes.current.set(id, el)
          else removes.current.delete(id)
        }}
      />
      {photos.length === 0 && <span className={styles.hidden}>No photos yet.</span>}
      {row.notes.length > 0 && (
        <div className={`${layout.notice} ${layout.warn} ${styles.notes}`}>
          <Icon name="alert" />
          <ul aria-label={`Notes on the photos of subject ${n}`}>
            {row.notes.map((note, k) => (
              <li key={k}>{note}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// One item of a subject row's photo list (spec/subject-photos.md, "What a row shows"): the
// picture (or "file not found"), the name for sighted readers only (the alt says it), what the
// photo is, and "Remove" for a form photo. No path is drawn. With the file missing there is
// no alt, so the name is read out.
import type { Ref } from 'react'
import type { RowPhoto } from '@/renderer/screens/project-home/brief-form-photos'
import { assetUrl } from '@/renderer/ui/asset-url'
import styles from './subject-photos.module.css'

type Props = {
  projectId: string
  n: number
  photo: RowPhoto
  removeRef: Ref<HTMLButtonElement>
  onRemove: () => void
}

export function PhotoTile({ projectId, n, photo, removeRef, onRemove }: Props) {
  const { asset } = photo
  return (
    <li className={styles.tile}>
      {asset.missing ? (
        <span className={styles.missing}>file not found</span>
      ) : (
        <img className={styles.thumb} src={assetUrl(projectId, asset.id)} alt={asset.displayName} />
      )}
      <span className={styles.name} aria-hidden={asset.missing ? undefined : true}>
        {asset.displayName}
      </span>
      {photo.attached && <span className={styles.muted}>Already attached</span>}
      {!photo.attached && !photo.added && (
        <span className={styles.muted}>Already in this project</span>
      )}
      {!photo.attached && (
        <button
          ref={removeRef}
          type="button"
          aria-label={`Remove photo ${asset.displayName} from subject ${n}`}
          onClick={onRemove}
        >
          Remove
        </button>
      )}
    </li>
  )
}

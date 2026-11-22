// One photo of a subject row as a PhotoStrip tile (spec/subject-photos.md, "What a row shows";
// HOME-3b): named by its display name and drawn through assetUrl, never by its path. What the
// photo is shows as an icon mark whose words are its tooltip and hidden text; a missing file's
// name is hidden text, as its tile has no picture to carry it. A photo already attached to the
// row's subject has no ✕; the ✕ keeps the name "Remove photo {name} from subject {n}".
import type { RowPhoto } from '@/renderer/screens/project-home/brief-form-photos'
import { assetUrl } from '@/renderer/ui/asset-url'
import type { StripPhoto } from '@/renderer/ui/photo-strip'
import { StatusMark } from '@/renderer/ui/status-mark'
import styles from './subject-photos.module.css'

function Marks({ photo }: { photo: RowPhoto }) {
  return (
    <>
      {photo.asset.missing && <span className={styles.hidden}>{photo.asset.displayName}</span>}
      {photo.attached && <StatusMark tone="none" icon="pin" tip="Already attached" />}
      {!photo.attached && !photo.added && (
        <StatusMark tone="none" icon="box" tip="Already in this project" />
      )}
    </>
  )
}

export function stripPhoto(projectId: string, n: number, photo: RowPhoto): StripPhoto {
  const { asset } = photo
  const marked = asset.missing || photo.attached || !photo.added
  return {
    id: asset.id,
    name: asset.displayName,
    src: asset.missing ? null : assetUrl(projectId, asset.id),
    removable: !photo.attached,
    removeLabel: `Remove photo ${asset.displayName} from subject ${n}`,
    marks: marked ? <Marks photo={photo} /> : undefined,
  }
}

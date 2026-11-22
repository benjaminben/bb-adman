// PhotoStrip (spec/phases/design-wave-screens-b.md, "AST-2"): a subject's photos as a row of
// tiles, a ✕ on each removable one, and a dashed "+" tile last. It holds no product words beyond
// "File not found" and sends nothing itself: it calls onAdd and onRemove. A missing file keeps
// its words on the tile, not only in a tooltip (a failure stays on the page).
import type { ReactNode } from 'react'
import { BusySpinner } from '@/renderer/ui/dialog-frame'
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import styles from './photo-strip.module.css'

export type StripPhoto = {
  id: string
  name: string
  src: string | null
  removable: boolean
  removeLabel: string
  marks?: ReactNode
}

export type PhotoStripProps = {
  label: string
  photos: StripPhoto[]
  onRemove(id: string): void
  onAdd(): void
  addLabel: string
  adding: boolean
  addingLabel?: string
  needsOne?: boolean
  removeRef?(id: string, el: HTMLButtonElement | null): void
}

const NOT_FOUND = 'File not found'

function Tile({ photo, props }: { photo: StripPhoto; props: PhotoStripProps }) {
  return (
    <li className={styles.tile}>
      {photo.src === null ? (
        <span className={`${styles.picture} ${styles.missing}`} title={NOT_FOUND}>
          <span className={styles.faded}>
            <Icon name="image" />
          </span>
          {NOT_FOUND}
        </span>
      ) : (
        <img className={styles.picture} src={photo.src} alt={photo.name} title={photo.name} />
      )}
      {photo.marks !== undefined && <span className={styles.marks}>{photo.marks}</span>}
      {photo.removable && (
        <button
          type="button"
          ref={(el) => props.removeRef?.(photo.id, el)}
          className={`${layout.iconButton} ${styles.remove}`}
          aria-label={photo.removeLabel}
          title={photo.removeLabel}
          onClick={() => props.onRemove(photo.id)}
        >
          <Icon name="x" size="small" />
        </button>
      )}
    </li>
  )
}

export function PhotoStrip(props: PhotoStripProps) {
  const { photos, adding } = props
  const warn = props.needsOne === true && photos.length === 0
  return (
    <ul className={styles.strip} aria-label={props.label}>
      {photos.map((photo) => (
        <Tile key={photo.id} photo={photo} props={props} />
      ))}
      <li className={styles.tile}>
        <button
          type="button"
          className={`${styles.picture} ${styles.add}${warn ? ` ${styles.warn}` : ''}`}
          aria-label={props.addLabel}
          title={props.addLabel}
          disabled={adding}
          onClick={props.onAdd}
        >
          {adding ? <BusySpinner /> : <Icon name="plus" />}
        </button>
        {adding && props.addingLabel !== undefined && (
          <span role="status" className={styles.hidden}>
            {props.addingLabel}
          </span>
        )}
      </li>
    </ul>
  )
}

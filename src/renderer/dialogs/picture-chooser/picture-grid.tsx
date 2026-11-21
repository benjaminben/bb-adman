// spec/editor.md, "Picture chooser": one button per picture, with the picture whole and its
// display name as text. A missing one is disabled, draws no picture and says "file not found".
import { assetUrl } from '@/renderer/ui/asset-url'
import type { AssetList } from '@/shared/schemas/queries/asset'
import styles from './picture-chooser.module.css'

export type PictureGridProps = {
  projectId: string
  pictures: AssetList
  disabled: boolean
  onChoose: (assetId: string) => void
}

export function PictureGrid(props: PictureGridProps) {
  return (
    <ul aria-label="Pictures" className={styles.grid}>
      {props.pictures.map((p) => (
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
            <span className={styles.name}>{p.displayName}</span>
            {p.missing && (
              <>
                {' '}
                <span className={styles.missing}>file not found</span>
              </>
            )}
          </button>
        </li>
      ))}
    </ul>
  )
}

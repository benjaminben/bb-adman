// spec/editor.md, "Picture chooser": one button per picture, with the picture whole. A missing
// one is disabled, draws no picture and says "file not found" in visible words.
// DLG-5 (C-16): a pickGrid with no captions; the display name is the button's hidden words and
// its `title`.
import { assetUrl } from '@/renderer/ui/asset-url'
import { dialogStyles } from '@/renderer/ui/dialog-frame'
import type { AssetList } from '@/shared/schemas/queries/asset'
import styles from './picture-chooser.module.css'

export type PictureGridProps = {
  projectId: string
  pictures: AssetList
  disabled: boolean
  onChoose: (assetId: string) => void
}

type Picture = AssetList[number]

// The picture, or an empty square for a missing file.
export function TileImage(props: { projectId: string; picture: Picture }) {
  if (props.picture.missing) return <span className={styles.picture} aria-hidden="true" />
  return (
    <img
      className={styles.picture}
      src={assetUrl(props.projectId, props.picture.id)}
      alt=""
      draggable={false}
    />
  )
}

export function PictureGrid(props: PictureGridProps) {
  return (
    <ul aria-label="Pictures" className={`${dialogStyles.pickGrid} ${styles.grid}`}>
      {props.pictures.map((p) => (
        <li key={p.id} className={styles.cell}>
          <button
            type="button"
            className={styles.tile}
            title={p.missing ? `${p.displayName} · file not found` : p.displayName}
            disabled={props.disabled || p.missing}
            onClick={() => props.onChoose(p.id)}
          >
            <TileImage projectId={props.projectId} picture={p} />
            <span className={styles.hidden}>{p.displayName}</span>
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

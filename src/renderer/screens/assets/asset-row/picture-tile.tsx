// AST-1 (spec/phases/design-wave-screens-b.md, "AST-1"): one picture of the Assets panel as a
// tile in a grid. The thumbnail (drawn through assetUrl), the display name under it, the marks
// on its corner, and the subject choice. Its size is in the tooltip and in hidden text. A
// missing file draws the image icon faded with "File not found" as words. Only the picked view
// reaches this tile, so no path, hash or type can be drawn.
import type { AssetView } from '@/renderer/screens/assets/assets-panel/asset-view'
import { assetUrl } from '@/renderer/ui/asset-url'
import { Icon } from '@/renderer/ui/icon'
import type { SubjectRow } from '@/shared/schemas/rows/subject'
import { AssetMarks, NOT_FOUND, assetSize, hasMarks } from './asset-marks'
import styles from './picture-tile.module.css'

export type PictureTileProps = {
  projectId: string
  asset: AssetView
  subjects: SubjectRow[]
  onSubject: (assetId: string, subjectId: string | null) => void
}

export function PictureTile({ projectId, asset, subjects, onSubject }: PictureTileProps) {
  const name = asset.displayName
  const size = assetSize(asset)
  return (
    <li className={styles.tile} title={size === null ? name : `${name} · ${size}`}>
      <span className={styles.frame}>
        {asset.missing ? (
          <span className={`${styles.picture} ${styles.missing}`} title={NOT_FOUND}>
            <span className={styles.faded}>
              <Icon name="image" />
            </span>
            {NOT_FOUND}
          </span>
        ) : (
          <img className={styles.picture} src={assetUrl(projectId, asset.id)} alt={name} />
        )}
        {hasMarks(asset) && (
          <span className={styles.marks}>
            <AssetMarks asset={asset} />
          </span>
        )}
      </span>
      <span className={styles.name}>{name}</span>
      {size !== null && <span className={styles.hidden}>{size}</span>}
      <select
        className={styles.subject}
        aria-label={`Subject of ${name}`}
        value={asset.subjectId ?? ''}
        onChange={(e) => onSubject(asset.id, e.target.value === '' ? null : e.target.value)}
      >
        <option value="">No subject</option>
        {subjects.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </li>
  )
}

// R2C-2 (spec/phases/round-2-campaign.md, design addition 2): the grid's empty corner, a head
// per language column ("German", then "de" muted) and a head per size row ("Story", then
// "1080×1920" muted). Each is placed in the table's own grid by inline row and column.
// R2C-3 (orchestrator ruling): a row name that is only its size written another way
// ("1080x1080", "1080 × 1080") shows the size once, as "1080×1080".
import type { GridRow } from './grid-axes'
import { languageName } from '@/renderer/ui/language-name'
import styles from './variant-grid.module.css'

type Props = { rows: GridRow[]; columns: string[] }

const sizeOf = (row: GridRow) => `${row.width}×${row.height}`
const onlySize = (row: GridRow) =>
  row.sizeLabel.replace(/x/gi, '×').replace(/\s/g, '') === sizeOf(row)

export function GridHeads(props: Props) {
  return (
    <>
      <div className={styles.corner} style={{ gridRow: 1, gridColumn: 1 }} />
      {props.columns.map((code, i) => (
        <div key={code} className={styles.head} style={{ gridRow: 1, gridColumn: i + 2 }}>
          <span className={styles.name}>{languageName(code)}</span>
          <span className={styles.detail}>{code}</span>
        </div>
      ))}
      {props.rows.map((row, i) => (
        <div
          key={row.sizeLabel}
          className={`${styles.head} ${styles.rowHead}`}
          style={{ gridRow: i + 2, gridColumn: 1 }}
        >
          {onlySize(row) ? (
            <span className={styles.name}>{sizeOf(row)}</span>
          ) : (
            <>
              <span className={styles.name}>{row.sizeLabel}</span>
              <span className={styles.detail}>{sizeOf(row)}</span>
            </>
          )}
        </div>
      ))}
    </>
  )
}

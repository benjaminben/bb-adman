// One variant in the campaign grid (spec/screens-campaign.md, "The campaign grid and the
// variant tile"): a pressed-or-not button holding the picture area, the title, the size line
// and the marks. `preview` replaces the shape box (P3-16); `actions` sit beside the button,
// never inside it (P3-10). Text is drawn as text.
import type { ReactNode } from 'react'
import type { VariantSummary } from '@/shared/schemas/queries/campaign'
import { badgeWords } from './badge-words'
import styles from './variant-tile.module.css'

export type VariantTileProps = {
  variant: VariantSummary
  chosen: boolean
  onChoose: (variantId: string) => void
  preview?: ReactNode
  actions?: ReactNode
}

export function sizeLine(v: VariantSummary): string {
  const line = `${v.width}×${v.height} · ${v.language} · ${v.format}`
  return v.isMaster ? `${line} · master` : line
}

function ShapeBox(props: { variant: VariantSummary }) {
  const v = props.variant
  return (
    <span className={styles.shape} style={{ aspectRatio: `${v.width} / ${v.height}` }}>
      <span>{v.sizeLabel}</span>
      {v.format === 'video' && <span>Video</span>}
    </span>
  )
}

export function VariantTile(props: VariantTileProps) {
  const v = props.variant
  const marks = badgeWords(v.badges)
  return (
    <div className={styles.tile}>
      <button
        type="button"
        className={props.chosen ? `${styles.main} ${styles.chosen}` : styles.main}
        aria-pressed={props.chosen}
        onClick={() => props.onChoose(v.id)}
      >
        <span className={styles.picture}>{props.preview ?? <ShapeBox variant={v} />}</span>
        <span className={styles.title}>{v.title}</span>
        <span className={styles.line}>{sizeLine(v)}</span>
        {marks.length > 0 && (
          <span className={styles.marks}>
            {marks.map((word) => (
              <span key={word} className={styles.mark}>
                {word}
              </span>
            ))}
          </span>
        )}
      </button>
      {props.actions}
    </div>
  )
}

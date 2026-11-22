// One variant in the campaign grid (spec/screens-campaign.md, "The campaign grid and the
// variant tile"): a pressed-or-not button holding the picture area, the title, the size line
// and the marks. A plain click opens the variant in the editor; pressed marks the variant the
// overview's panels work on, the one opened last (P3-9, A-47). `preview` replaces the shape box
// (P3-16); `actions` sit beside the button, never inside it (P3-10). Text is drawn as text.
// R2C-2 (A-311): the master has a "Master" badge before its title and a tinted ground. The
// badge is hidden from the button's name, which keeps starting with the title; the size
// line's " · master" already says it.
import type { ReactNode } from 'react'
import type { VariantSummary } from '@/shared/schemas/queries/campaign'
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import { badgeMarks } from './badge-words'
import styles from './variant-tile.module.css'

export type VariantTileProps = {
  variant: VariantSummary
  chosen: boolean
  onChoose: (variantId: string) => void
  preview?: ReactNode
  actions?: ReactNode
  // AP-12: drawn after the main button, never inside it (the approval marks).
  footer?: ReactNode
}

export function sizeLine(v: VariantSummary): string {
  const line = `${v.width}×${v.height} · ${v.language} · ${v.format}`
  return v.isMaster ? `${line} · master` : line
}

function ShapeBox(props: { variant: VariantSummary }) {
  const v = props.variant
  return (
    <span
      className={`${styles.shape} ${v.width > v.height ? styles.wide : styles.tall}`}
      style={{ aspectRatio: `${v.width} / ${v.height}` }}
    >
      <span>{v.sizeLabel}</span>
      {v.format === 'video' && <span>Video</span>}
    </span>
  )
}

export function VariantTile(props: VariantTileProps) {
  const v = props.variant
  const marks = badgeMarks(v.badges)
  return (
    <div className={v.isMaster ? `${styles.tile} ${styles.master}` : styles.tile}>
      <button
        type="button"
        className={props.chosen ? `${styles.main} ${styles.chosen}` : styles.main}
        aria-pressed={props.chosen}
        onClick={() => props.onChoose(v.id)}
      >
        <span className={styles.picture}>{props.preview ?? <ShapeBox variant={v} />}</span>
        <span className={styles.titleLine}>
          {v.isMaster && (
            <span className={`${layout.badge} ${layout.accent}`} aria-hidden="true">
              <Icon name="star" size="small" />
              Master
            </span>
          )}
          <span className={styles.title}>{v.title}</span>
        </span>
        <span className={styles.line}>{sizeLine(v)}</span>
        {marks.length > 0 && (
          <span className={styles.marks}>
            {marks.map((mark) => (
              <span key={mark.word} className={`${layout.badge} ${layout[mark.kind]}`}>
                <Icon name={mark.icon} size="small" />
                {mark.word}
              </span>
            ))}
          </span>
        )}
      </button>
      {props.actions}
      {props.footer}
    </div>
  )
}

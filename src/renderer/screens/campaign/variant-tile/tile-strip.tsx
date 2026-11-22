// Design wave CAMP-1 (C-11, AP-2, AP-14): the one strip under a tile's picture. On the left the
// marks in badge-words.ts order, each a StatusMark with no label whose tip is its word, a button
// where its fix exists (tile-targets.ts), then the approval marks (`footer`); the actions sit
// at the right end. Outside the tile's main button, so a mark is its own control.
import type { ReactNode } from 'react'
import type { VariantSummary } from '@/shared/schemas/queries/campaign'
import { StatusMark } from '@/renderer/ui/status-mark'
import { badgeMarks } from './badge-words'
import { markTarget, type TileTargets } from './tile-targets'
import styles from './variant-tile.module.css'

export type TileStripProps = {
  variant: VariantSummary
  targets: TileTargets
  open: (() => void) | undefined
  footer?: ReactNode
  actions?: ReactNode
}

export function TileStrip(props: TileStripProps) {
  const v = props.variant
  return (
    <div className={styles.strip}>
      <div role="group" aria-label={`Marks for ${v.title}`} className={styles.marks}>
        {badgeMarks(v.badges).map((mark) => (
          <StatusMark
            key={mark.key}
            tone={mark.kind}
            icon={mark.icon}
            tip={mark.word}
            onClick={markTarget(mark.key, props.targets, props.open)}
          />
        ))}
        {props.footer}
      </div>
      {props.actions}
    </div>
  )
}

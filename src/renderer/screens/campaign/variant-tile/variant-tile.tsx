// One variant in the campaign grid (spec/screens-campaign.md, "The campaign grid and the
// variant tile"). Pressed marks the selected variant, the one the overview's panels work on
// (P3-9, A-47). `preview` replaces the shape box (P3-16); `actions` and `footer` sit outside the
// button, never inside it (P3-10, AP-12). Text is drawn as text.
// Design wave CAMP-1 (C-11): the tile is its picture. The button is named and titled
// "{title} · {sizeLine}"; the title shows under the picture only when the direction says so
// (OI-DW-3). The master has a ★ corner and a video a film corner, both hidden from the name,
// which already says "master" and "video". Under the picture, one strip: the marks
// (tile-strip.tsx), the approval marks (footer), then the actions at its right end.
// R2C-3 (design addition 3): a click selects; a double-click or Enter opens (onOpen), Mod+Enter
// opens behind. Enter's own click is stopped, so Enter does not also select. A tile given no
// open action keeps the button's own Enter, a click.
import type { KeyboardEvent, ReactNode } from 'react'
import { platform } from '@/renderer/editor/use-editor-key'
import type { VariantSummary } from '@/shared/schemas/queries/campaign'
import { Icon } from '@/renderer/ui/icon'
import { TileStrip } from './tile-strip'
import { useTileTargets } from './tile-targets'
import styles from './variant-tile.module.css'

export type VariantTileProps = {
  variant: VariantSummary
  chosen: boolean
  onChoose: (variantId: string) => void
  onOpen?: (variantId: string) => void
  onOpenBehind?: (variantId: string) => void
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
      {v.sizeLabel}
    </span>
  )
}

function onEnter(event: KeyboardEvent, props: VariantTileProps) {
  if (event.key !== 'Enter') return
  const behind = platform === 'mac' ? event.metaKey : event.ctrlKey
  const open = behind ? props.onOpenBehind : props.onOpen
  if (!open) return
  event.preventDefault()
  open(props.variant.id)
}

export function VariantTile(props: VariantTileProps) {
  const v = props.variant
  const targets = useTileTargets()
  const name = `${v.title} · ${sizeLine(v)}`
  const open = props.onOpen && (() => props.onOpen?.(v.id))
  return (
    <div className={styles.tile}>
      <button
        type="button"
        className={props.chosen ? `${styles.main} ${styles.chosen}` : styles.main}
        aria-pressed={props.chosen}
        aria-label={name}
        title={name}
        onClick={() => props.onChoose(v.id)}
        onDoubleClick={() => props.onOpen?.(v.id)}
        onKeyDown={(event) => onEnter(event, props)}
      >
        <span className={styles.picture}>
          {props.preview ?? <ShapeBox variant={v} />}
          {v.isMaster && (
            <span className={`${styles.corner} ${styles.star}`} title="Master" aria-hidden="true">
              <Icon name="star" size="small" />
            </span>
          )}
          {v.format === 'video' && (
            <span className={`${styles.corner} ${styles.film}`} title="Video" aria-hidden="true">
              <Icon name="film" size="small" />
            </span>
          )}
        </span>
        {targets.showTitle && <span className={styles.title}>{v.title}</span>}
      </button>
      <TileStrip
        variant={v}
        targets={targets}
        open={open}
        footer={props.footer}
        actions={props.actions}
      />
    </div>
  )
}

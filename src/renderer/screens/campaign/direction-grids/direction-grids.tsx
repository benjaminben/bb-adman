// spec/screens-variants.md, "The overview": one section per direction, in directions order,
// labelled by its level-3 heading, then "{n} variant(s)", the direction's controls and a grid
// "Variants in {name}" in direction-order.ts order (A-144). A plain click on a tile chooses it;
// a Cmd-click (Ctrl-click on Windows) opens it behind, like the tile's "+" (P3-10).
import { useId, useRef, type MouseEvent, type ReactNode } from 'react'
import { platform } from '@/renderer/editor/use-editor-key'
import { DirectionHeader } from '@/renderer/screens/campaign/direction-header'
import { VariantGrid } from '@/renderer/screens/campaign/variant-grid'
import type { CampaignGet, VariantSummary } from '@/shared/schemas/queries/campaign'
import type { DirectionRow } from '@/shared/schemas/rows/direction'
import layout from '@/renderer/ui/layout.module.css'
import { directionOrder } from './direction-order'
import styles from './direction-grids.module.css'

export type DirectionGridsProps = {
  projectId: string
  campaign: CampaignGet
  chosenId: string | null
  onChoose: (variantId: string) => void
  onOpenBehind: (variantId: string) => void
  // AP-12: drawn under each tile (the approval marks).
  tileFooter?: (variant: VariantSummary) => ReactNode
}

const opensBehind = (event: MouseEvent) => (platform === 'mac' ? event.metaKey : event.ctrlKey)

function DirectionSection(props: DirectionGridsProps & { direction: DirectionRow }) {
  const { campaign, direction } = props
  const headingId = useId()
  const behind = useRef(false)
  const variants = directionOrder(
    campaign.variants.filter((v) => v.directionId === direction.id),
    campaign.campaign,
    direction.masterVariantId,
  )
  return (
    <section aria-labelledby={headingId} className={styles.direction}>
      <h3 id={headingId} className={styles.heading}>
        {direction.name}
      </h3>
      <p className={`${layout.muted} ${styles.count}`}>{variants.length} variant(s)</p>
      <DirectionHeader projectId={props.projectId} campaign={campaign} direction={direction} />
      <div
        onClickCapture={(event) => {
          behind.current = opensBehind(event)
        }}
      >
        <VariantGrid
          projectId={props.projectId}
          label={`Variants in ${direction.name}`}
          variants={variants}
          chosenId={props.chosenId}
          onChoose={(id) => (behind.current ? props.onOpenBehind(id) : props.onChoose(id))}
          onOpenBehind={props.onOpenBehind}
          tileFooter={props.tileFooter}
        />
      </div>
    </section>
  )
}

export function DirectionGrids(props: DirectionGridsProps) {
  return props.campaign.directions.map((direction) => (
    <DirectionSection key={direction.id} {...props} direction={direction} />
  ))
}

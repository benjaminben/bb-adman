// R2C-1 (spec/phases/round-2-campaign.md, design addition 1): the overview's Variants view,
// moved out of campaign-view.tsx. One grid per direction (P5-14).
// R2C-3 (design addition 3): first the muted hint line; onChoose selects a tile, onOpen opens it.
// Design wave CAMP-7 (C-12): the slot view, the picture panel and the runs left this view.
// Pictures and videos are made in the editor's Generate panel; runs are followed in Activity.
import type { ReactNode } from 'react'
import { DirectionGrids } from '@/renderer/screens/campaign/direction-grids'
import type { TileView } from '@/renderer/screens/campaign/variant-tile'
import type { CampaignGet, VariantSummary } from '@/shared/schemas/queries/campaign'
import layout from '@/renderer/ui/layout.module.css'
import styles from './variants-tab.module.css'

export type VariantsTabProps = {
  projectId: string
  data: CampaignGet
  variant: VariantSummary | undefined
  onChoose: (variantId: string) => void
  onOpen: (variantId: string) => void
  onOpenBehind: (variantId: string) => void
  tileFooter?: (variant: VariantSummary) => ReactNode
  // Design wave CAMP-1: where the tiles' Checks and Translations marks lead.
  onView?: (view: TileView) => void
}

export function VariantsTab(props: VariantsTabProps) {
  return (
    <div className={styles.tab}>
      <p className={layout.muted}>
        Click a post to select it. Double-click it, or press Enter, to open it.
      </p>
      <DirectionGrids
        projectId={props.projectId}
        campaign={props.data}
        chosenId={props.variant?.id ?? null}
        onChoose={props.onChoose}
        onOpen={props.onOpen}
        onOpenBehind={props.onOpenBehind}
        tileFooter={props.tileFooter}
        onView={props.onView}
      />
    </div>
  )
}

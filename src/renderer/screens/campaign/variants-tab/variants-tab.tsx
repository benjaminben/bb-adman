// R2C-1 (spec/phases/round-2-campaign.md, design addition 1): the overview's Variants view,
// moved out of campaign-view.tsx. One grid per direction (P5-14), the line naming the chosen
// variant (S2-16), the slot view, the picture panel for the chosen variant with the reference
// ticks the page keeps (SP-7, A-120), and the chosen variant's runs. Videos are made in the
// editor's Generate panel (R2E-9, R-13).
// R2C-3 (design addition 3): first the muted hint line; onChoose selects a tile, onOpen opens it.
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { DirectionGrids } from '@/renderer/screens/campaign/direction-grids'
import { GeneratePanel } from '@/renderer/screens/campaign/generate-panel'
import { RunList } from '@/renderer/screens/campaign/run-list'
import { SlotView } from '@/renderer/screens/campaign/slot-view'
import type { JobStore } from '@/renderer/stores/job-store'
import { ReferenceRowsContext } from '@/renderer/ui/reference-picker/use-picture-list'
import type { AssetList } from '@/shared/schemas/queries/asset'
import type { CampaignGet, VariantSummary } from '@/shared/schemas/queries/campaign'
import layout from '@/renderer/ui/layout.module.css'
import styles from './variants-tab.module.css'

export type VariantsTabProps = {
  projectId: string
  campaignId: string
  data: CampaignGet
  variant: VariantSummary | undefined
  store: JobStore
  ticks: string[]
  setTicks: Dispatch<SetStateAction<string[]>>
  preTick: (rows: AssetList) => void
  onChoose: (variantId: string) => void
  onOpen: (variantId: string) => void
  onOpenBehind: (variantId: string) => void
  tileFooter?: (variant: VariantSummary) => ReactNode
}

export function VariantsTab(props: VariantsTabProps) {
  const { projectId, campaignId, data, variant, store } = props
  return (
    <div className={styles.tab}>
      <p className={layout.muted}>
        Click a post to select it. Double-click it, or press Enter, to open it.
      </p>
      <DirectionGrids
        projectId={projectId}
        campaign={data}
        chosenId={variant?.id ?? null}
        onChoose={props.onChoose}
        onOpen={props.onOpen}
        onOpenBehind={props.onOpenBehind}
        tileFooter={props.tileFooter}
      />
      {variant && (
        <p>
          Runs and panels below are for: {variant.title} · {variant.sizeLabel} · {variant.language}
        </p>
      )}
      <SlotView projectId={projectId} campaignId={campaignId} />
      {variant && (
        <ReferenceRowsContext.Provider value={props.preTick}>
          <GeneratePanel
            key={variant.id}
            projectId={projectId}
            campaignId={campaignId}
            variantId={variant.id}
            data={data}
            ticks={props.ticks}
            setTicks={props.setTicks}
            onStarted={(reply) => store.getState().track(reply)}
          />
        </ReferenceRowsContext.Provider>
      )}
      <RunList projectId={projectId} store={store} />
    </div>
  )
}

// MV-6 (spec/screens-variants.md, "The variant tile" and "Make variants"): a tile's "Make
// variants from this one…" opens the Make variants dialog with that variant as the source. On
// the master's tile it is the header's dialog, with no `source`, so it sends no
// sourceVariantId. Opening sends nothing; the fills start here after the dialog has closed.
import type { CampaignGet, VariantSummary } from '@/shared/schemas/queries/campaign'
import type { DirectionRow } from '@/shared/schemas/rows/direction'
import type { FanOutBasis } from './fan-out-model'
import { FanOutDialog } from './fan-out-dialog'
import { useStartFills } from './use-start-fills'

// The dialog's basis with `source` as the variant whose facts it judges against.
export function basisFrom(
  campaign: CampaignGet,
  direction: DirectionRow,
  source: VariantSummary,
): FanOutBasis {
  return {
    sizes: campaign.campaign.sizes,
    languages: campaign.campaign.languages,
    primaryLanguage: campaign.campaign.primaryLanguage,
    master: source,
    existing: campaign.variants.filter((v) => v.directionId === direction.id),
  }
}

export type MakeFromVariantProps = {
  projectId: string
  campaign: CampaignGet
  variantId: string | null
  onClose: () => void
}

export function MakeFromVariant(props: MakeFromVariantProps) {
  const { projectId, campaign } = props
  const startFills = useStartFills(projectId)
  const source = campaign.variants.find((v) => v.id === props.variantId)
  const direction = campaign.directions.find((d) => d.id === source?.directionId)
  if (!source || !direction) return null
  const fromMaster = source.id === direction.masterVariantId
  return (
    <FanOutDialog
      key={source.id}
      projectId={projectId}
      direction={direction}
      basis={basisFrom(campaign, direction, source)}
      source={fromMaster ? undefined : source}
      onClose={props.onClose}
      onMade={(fill, provider) => void startFills(fill, provider)}
    />
  )
}

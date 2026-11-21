// The project's campaigns (SPEC 14 1.41 TP-1): a name and an Open button each, or one line
// when there is none. Names are drawn as text.
import type { CampaignSummary } from '@/shared/schemas/queries/campaign'
import layout from '@/renderer/ui/layout.module.css'

export function CampaignList(props: {
  campaigns: CampaignSummary[]
  onOpen: (campaignId: string) => void
}) {
  if (props.campaigns.length === 0) return <p className={layout.muted}>No campaign yet.</p>
  return (
    <ul className={layout.list} aria-label="Campaigns">
      {props.campaigns.map((c) => (
        <li key={c.id} className={layout.row}>
          <span>{c.name}</span>
          <span className={layout.muted}>{`Variants: ${c.variantCount}`}</span>
          <button type="button" aria-label={`Open ${c.name}`} onClick={() => props.onOpen(c.id)}>
            Open
          </button>
        </li>
      ))}
    </ul>
  )
}

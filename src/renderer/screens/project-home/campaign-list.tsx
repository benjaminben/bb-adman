// The project's campaigns (SPEC 14 1.41 TP-1): a name and an Open button each, or one line
// when there is none. Names are drawn as text.
import type { CampaignSummary } from '../../../shared/schemas/queries/campaign'
import styles from '../screens.module.css'

export function CampaignList(props: {
  campaigns: CampaignSummary[]
  onOpen: (campaignId: string) => void
}) {
  if (props.campaigns.length === 0) return <p className={styles.muted}>No campaign yet.</p>
  return (
    <ul className={styles.list} aria-label="Campaigns">
      {props.campaigns.map((c) => (
        <li key={c.id} className={styles.row}>
          <span>{c.name}</span>
          <span className={styles.muted}>{`Variants: ${c.variantCount}`}</span>
          <button type="button" aria-label={`Open ${c.name}`} onClick={() => props.onOpen(c.id)}>
            Open
          </button>
        </li>
      ))}
    </ul>
  )
}

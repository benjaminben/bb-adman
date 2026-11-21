// The project's campaigns (SPEC 14 1.41 TP-1): a name and an Open button each, or one line
// when there is none. Names are drawn as text. With projectId, each row starts with a box
// holding its cover, the master of the campaign's first direction (spec/editor.md,
// "Thumbnails on the screens"); the box stays empty when the campaign has none.
import type { CampaignSummary } from '@/shared/schemas/queries/campaign'
import { VariantThumbnail } from '@/renderer/ui/variant-thumbnail'
import layout from '@/renderer/ui/layout.module.css'
import styles from './campaign-list.module.css'

export function CampaignList(props: {
  projectId?: string
  campaigns: CampaignSummary[]
  onOpen: (campaignId: string) => void
}) {
  const { projectId } = props
  if (props.campaigns.length === 0) return <p className={layout.muted}>No campaign yet.</p>
  return (
    <ul className={`${layout.list} ${styles.grid}`} aria-label="Campaigns">
      {props.campaigns.map((c) => (
        <li key={c.id} className={`${layout.card} ${styles.card}`}>
          {projectId && (
            <span className={styles.cover}>
              {c.cover && (
                <VariantThumbnail
                  projectId={projectId}
                  variantId={c.cover.variantId}
                  rev={c.cover.rev}
                  alt={`Cover of ${c.name}`}
                />
              )}
            </span>
          )}
          <div className={styles.text}>
            <span className={styles.name}>{c.name}</span>
            <span className={styles.count}>{`Variants: ${c.variantCount}`}</span>
            <button type="button" aria-label={`Open ${c.name}`} onClick={() => props.onOpen(c.id)}>
              Open
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}

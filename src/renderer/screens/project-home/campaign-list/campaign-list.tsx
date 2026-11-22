// The project's campaigns as tiles (SPEC 14 1.41 TP-1; HOME-1). Each tile is one button named
// "Open {name}": the cover (the master of the campaign's first direction, spec/editor.md
// "Thumbnails on the screens"; the box stays empty when there is none), the name, the variant
// count, and the same marks as the campaign's tab. Names are drawn as text. With `onNew`, a
// dashed "+" tile ends the list. With no campaign, an EmptyState.
import type { CampaignSummary } from '@/shared/schemas/queries/campaign'
import { EmptyState } from '@/renderer/ui/empty-state'
import { Icon } from '@/renderer/ui/icon'
import { plural } from '@/renderer/ui/plural'
import { TabMarks } from '@/renderer/ui/tab-marks'
import { VariantThumbnail } from '@/renderer/ui/variant-thumbnail'
import layout from '@/renderer/ui/layout.module.css'
import styles from './campaign-list.module.css'

export type CampaignListProps = {
  projectId?: string
  campaigns: CampaignSummary[]
  onOpen: (campaignId: string) => void
  onNew?: () => void
}

function Tile(props: { projectId?: string; campaign: CampaignSummary; onOpen: () => void }) {
  const c = props.campaign
  const { projectId } = props
  return (
    <button
      type="button"
      className={`${layout.card} ${styles.tile}`}
      aria-label={`Open ${c.name}`}
      onClick={props.onOpen}
    >
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
      <span className={styles.text}>
        <span className={styles.name}>{c.name}</span>
        <span className={styles.meta}>
          <span className={styles.count} title={plural(c.variantCount, 'variant')}>
            <Icon name="grid" size="small" />
            {c.variantCount}
          </span>
          <TabMarks running={c.jobRunning} unseen={c.resultUnseen} />
        </span>
      </span>
    </button>
  )
}

export function CampaignList(props: CampaignListProps) {
  const { projectId, onNew } = props
  if (props.campaigns.length === 0) return <EmptyState icon="grid" words="No campaigns yet" />
  return (
    <ul className={`${layout.list} ${styles.grid}`} aria-label="Campaigns">
      {props.campaigns.map((c) => (
        <li key={c.id} className={styles.item}>
          <Tile projectId={projectId} campaign={c} onOpen={() => props.onOpen(c.id)} />
        </li>
      ))}
      {onNew && (
        <li className={styles.item}>
          <button
            type="button"
            className={styles.add}
            aria-label="New campaign"
            title="New campaign"
            onClick={onNew}
          >
            <Icon name="plus" />
          </button>
        </li>
      )}
    </ul>
  )
}

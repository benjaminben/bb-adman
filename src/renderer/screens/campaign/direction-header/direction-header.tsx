// spec/screens-variants.md, "The overview", as design wave CAMP-2 (AP-3, AP-7) draws a
// direction's header: one line holding the name as the section's `h3`, a count chip "{n}" with
// a hidden "{n} variants" read in its place, the select-and-open hint as an InfoTip on the first
// direction only (R2C-3), then "Fan out…", "Sync {n}" while something is out of date, and the direction's More menu.
// Each control comes from its own dialog folder; none sends anything on its own click.
import { DirectionMenu } from '@/renderer/dialogs/direction-menu'
import { FanOutButton } from '@/renderer/dialogs/fan-out'
import { SyncButton, type SyncOpen } from '@/renderer/dialogs/sync-review'
import type { CampaignGet } from '@/shared/schemas/queries/campaign'
import type { DirectionRow } from '@/shared/schemas/rows/direction'
import { InfoTip } from '@/renderer/ui/info-tip'
import { plural } from '@/renderer/ui/plural'
import styles from './direction-header.module.css'

export type DirectionControlProps = {
  projectId: string
  campaign: CampaignGet
  direction: DirectionRow
}

export type DirectionHeaderProps = DirectionControlProps & {
  headingId: string
  count: number
  first: boolean
  sync: SyncOpen
}

export const SELECT_HINT = 'Click a post to select it. Double-click it, or press Enter, to open it.'

export function DirectionHeader(props: DirectionHeaderProps) {
  const { projectId, campaign, direction } = props
  const controls = { projectId, campaign, direction }
  return (
    <div className={styles.header}>
      <h3 id={props.headingId} className={styles.heading}>
        {direction.name}
      </h3>
      <span className={styles.count} aria-hidden="true">
        {props.count}
      </span>
      <span className={styles.hidden}>{plural(props.count, 'variant')}</span>
      {props.first && <InfoTip about="Variants">{SELECT_HINT}</InfoTip>}
      <span className={styles.actions}>
        <FanOutButton {...controls} />
        <SyncButton {...controls} control={props.sync} />
        <DirectionMenu {...controls} />
      </span>
    </div>
  )
}

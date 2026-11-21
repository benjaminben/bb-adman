// spec/screens-variants.md, "The overview": the row of direction controls under a direction's
// heading. Each control comes from its own dialog folder and gets the project, the campaign and
// the direction.
import { DirectionMenu } from '@/renderer/dialogs/direction-menu'
import { FanOutButton } from '@/renderer/dialogs/fan-out'
import { SyncButton } from '@/renderer/dialogs/sync-review'
import type { CampaignGet } from '@/shared/schemas/queries/campaign'
import type { DirectionRow } from '@/shared/schemas/rows/direction'
import layout from '@/renderer/ui/layout.module.css'

export type DirectionControlProps = {
  projectId: string
  campaign: CampaignGet
  direction: DirectionRow
}

export function DirectionHeader(props: DirectionControlProps) {
  return (
    <div className={layout.row}>
      <FanOutButton {...props} />
      <SyncButton {...props} />
      <DirectionMenu {...props} />
    </div>
  )
}

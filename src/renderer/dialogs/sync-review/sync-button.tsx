// spec/screens-variants.md, "Sync review", as design wave CAMP-2 (AP-7, AP-13) draws it: with n
// of the direction's variants out of date, a secondary button with the `sync` icon showing
// "Sync {n}", named and titled "Sync {n} out of date…"; with none out of date, no button. It
// opens the review, mounted afresh (a new key) for each opening and kept after close so focus
// goes back to what opened it. The direction may hold the opening (useSyncOpen) so that a
// tile's "Out of date" mark opens the same review. Opening sends nothing.
import { useState } from 'react'
import type { DirectionControlProps } from '@/renderer/screens/campaign/direction-header'
import { Icon } from '@/renderer/ui/icon'
import { SyncReview } from './sync-review'

export type SyncOpen = { opening: number; open: boolean; show: () => void; hide: () => void }

export function useSyncOpen(): SyncOpen {
  const [open, setOpen] = useState(false)
  const [opening, setOpening] = useState(0)
  return {
    opening,
    open,
    show: () => {
      setOpening((n) => n + 1)
      setOpen(true)
    },
    hide: () => setOpen(false),
  }
}

export const outOfDateCount = (props: DirectionControlProps): number =>
  props.campaign.variants.filter((v) => v.directionId === props.direction.id && v.badges.outOfDate)
    .length

export function SyncButton(props: DirectionControlProps & { control?: SyncOpen }) {
  const own = useSyncOpen()
  const sync = props.control ?? own
  const count = outOfDateCount(props)
  const name = `Sync ${count} out of date…`
  const { projectId, campaign, direction } = props
  return (
    <>
      {count > 0 && (
        <button type="button" aria-label={name} title={name} onClick={sync.show}>
          <Icon name="sync" size="small" />
          Sync {count}
        </button>
      )}
      <SyncReview
        key={sync.opening}
        projectId={projectId}
        campaign={campaign}
        direction={direction}
        open={sync.open}
        onClose={sync.hide}
      />
    </>
  )
}

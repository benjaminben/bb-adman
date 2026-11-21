// spec/screens-variants.md, "Sync review": "Sync {n} out of date…", with n the direction's
// variants marked out of date; at 0, "Nothing to sync", disabled. It opens the review, mounted
// afresh (a new key) for each opening and kept after close so focus goes back to the button.
import { useState } from 'react'
import type { DirectionControlProps } from '@/renderer/screens/campaign/direction-header'
import { SyncReview } from './sync-review'

export function SyncButton(props: DirectionControlProps) {
  const [open, setOpen] = useState(false)
  const [opening, setOpening] = useState(0)
  const count = props.campaign.variants.filter(
    (v) => v.directionId === props.direction.id && v.badges.outOfDate,
  ).length
  return (
    <>
      <button
        type="button"
        disabled={count === 0}
        onClick={() => {
          setOpening((n) => n + 1)
          setOpen(true)
        }}
      >
        {count === 0 ? 'Nothing to sync' : `Sync ${count} out of date…`}
      </button>
      <SyncReview key={opening} {...props} open={open} onClose={() => setOpen(false)} />
    </>
  )
}

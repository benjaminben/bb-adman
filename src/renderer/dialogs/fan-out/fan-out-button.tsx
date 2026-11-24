// spec/screens-variants.md, "Fan-out": "Fan out…" in a direction's header row opens the dialog.
// The fills start here, after the dialog has closed, so they outlive it.
// Design wave CAMP-2: the button carries the `plus` icon. Opening sends nothing.
import { useState } from 'react'
import type { DirectionControlProps } from '@/renderer/screens/campaign/direction-header'
import { Icon } from '@/renderer/ui/icon'
import { FanOutDialog } from './fan-out-dialog'
import { basisFrom } from './make-from-variant'
import { useStartFills } from './use-start-fills'

export function FanOutButton(props: DirectionControlProps) {
  const { projectId, campaign, direction } = props
  const [open, setOpen] = useState(false)
  const startFills = useStartFills(projectId)
  const master = campaign.variants.find((v) => v.id === direction.masterVariantId)
  if (!master) return null
  const basis = basisFrom(campaign, direction, master)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        <Icon name="plus" size="small" />
        Make variants…
      </button>
      {open && (
        <FanOutDialog
          projectId={projectId}
          direction={direction}
          basis={basis}
          onClose={() => setOpen(false)}
          onMade={(fill, provider) => void startFills(fill, provider)}
        />
      )}
    </>
  )
}

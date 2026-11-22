// spec/screens-variants.md, "Fan-out": "Fan out…" in a direction's header row opens the dialog.
// The fills start here, after the dialog has closed, so they outlive it.
import { useState } from 'react'
import type { DirectionControlProps } from '@/renderer/screens/campaign/direction-header'
import type { FanOutBasis } from './fan-out-model'
import { FanOutDialog } from './fan-out-dialog'
import { useStartFills } from './use-start-fills'

export function FanOutButton(props: DirectionControlProps) {
  const { projectId, campaign, direction } = props
  const [open, setOpen] = useState(false)
  const startFills = useStartFills(projectId)
  const master = campaign.variants.find((v) => v.id === direction.masterVariantId)
  if (!master) return null
  const basis: FanOutBasis = {
    sizes: campaign.campaign.sizes,
    languages: campaign.campaign.languages,
    master,
    existing: campaign.variants.filter((v) => v.directionId === direction.id),
  }
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Fan out…
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

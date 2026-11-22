// "Publish…" in the campaign page's header row [P9-13] (spec/phases/phase-09.md "Screens"),
// beside "Export…" and "Reports". It opens the publish dialog for this campaign, mounted afresh
// at each open, so every open starts with no storage chosen and nothing ticked. CAMP-3: the
// head's one primary button.
import { useState } from 'react'
import { PublishDialog } from '@/renderer/dialogs/publish-dialog'
import layout from '@/renderer/ui/layout.module.css'

export type PublishButtonProps = { projectId: string; campaignId: string; campaignName: string }

export function PublishButton(props: PublishButtonProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className={layout.primary} onClick={() => setOpen(true)}>
        Publish…
      </button>
      {open && (
        <PublishDialog
          projectId={props.projectId}
          campaignId={props.campaignId}
          campaignName={props.campaignName}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

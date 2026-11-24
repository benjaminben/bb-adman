// The dialog's sends: one command at a time through the app store's command, so NEEDS_KEY asks
// for the key and a refusal also reaches the banner. `running` names the command that waits,
// and the last refusal's sentence is kept for the dialog. "Update gallery" (approvals.publish)
// goes through the app store's owner of the update instead (D-110, gallery-updates.ts), so it
// goes on with the dialog closed; its running state and refusal are read from there.
import { useState } from 'react'
import { useApp } from '@/renderer/app/app-context'
import { updateKey } from '@/renderer/stores/gallery-updates'

export type Send = (name: string, extra?: object) => Promise<boolean>

export type Sender = {
  running: string | null
  refusal: string | null
  send: Send
}

export function useSend(projectId: string, campaignId: string): Sender {
  const command = useApp((s) => s.command)
  const updateGallery = useApp((s) => s.updateGallery)
  const clearRefusal = useApp((s) => s.clearRefusal)
  const update = useApp((s) => s.updates[updateKey(projectId, campaignId)])
  const [running, setRunning] = useState<string | null>(null)
  const [refusal, setRefusal] = useState<string | null>(null)

  async function send(name: string, extra: object = {}): Promise<boolean> {
    setRefusal(null)
    clearRefusal(projectId, campaignId)
    if (name === 'approvals.publish') return (await updateGallery(projectId, campaignId)).ok
    setRunning(name)
    const result = await command(name, { projectId, campaignId, ...extra })
    setRunning(null)
    if (!result.ok) setRefusal(result.error.message)
    return result.ok
  }

  return {
    running: running ?? (update?.running ? 'approvals.publish' : null),
    refusal: refusal ?? update?.refusal ?? null,
    send,
  }
}

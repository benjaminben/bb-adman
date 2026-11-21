// The dialog's sends: one command at a time through the app store's command, so NEEDS_KEY asks
// for the key and a refusal also reaches the banner. `running` names the command that waits,
// and the last refusal's sentence is kept for the dialog.
import { useState } from 'react'
import { useApp } from '@/renderer/app/app-context'

export type Send = (name: string, extra?: object) => Promise<boolean>

export type Sender = {
  running: string | null
  refusal: string | null
  send: Send
}

export function useSend(projectId: string, campaignId: string): Sender {
  const command = useApp((s) => s.command)
  const [running, setRunning] = useState<string | null>(null)
  const [refusal, setRefusal] = useState<string | null>(null)

  async function send(name: string, extra: object = {}): Promise<boolean> {
    setRunning(name)
    setRefusal(null)
    const result = await command(name, { projectId, campaignId, ...extra })
    setRunning(null)
    if (!result.ok) setRefusal(result.error.message)
    return result.ok
  }

  return { running, refusal, send }
}

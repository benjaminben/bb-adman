// The latest approvals.progress of this campaign while "Update gallery" runs, and "Stop"
// (round-2-approvals-video.md "The dialog"). Events of another campaign are ignored. Stop goes
// through the app store's command, not the dialog's sender, so the update keeps waiting.
import { useEffect, useState } from 'react'
import { useApi, useApp } from '@/renderer/app/app-context'
import type { EventMap } from '@/shared/schemas/events'

export type UpdateStep = Pick<EventMap['approvals.progress'], 'step' | 'done' | 'total'>

export type UpdateProgress = {
  step: UpdateStep | null
  stopping: boolean
  stop: () => void
}

export function useUpdateProgress(projectId: string, campaignId: string): UpdateProgress {
  const api = useApi()
  const command = useApp((s) => s.command)
  const [step, setStep] = useState<UpdateStep | null>(null)
  const [stopping, setStopping] = useState(false)

  useEffect(
    () =>
      api.on('approvals.progress', (event) => {
        if (event.projectId !== projectId || event.campaignId !== campaignId) return
        setStep({ step: event.step, done: event.done, total: event.total })
      }),
    [api, projectId, campaignId],
  )

  function stop() {
    setStopping(true)
    void command('approvals.cancelUpdate', { projectId, campaignId })
  }

  return { step, stopping, stop }
}

export function progressLine(p: UpdateProgress): string {
  if (p.stopping) return 'Stopping…'
  if (p.step === null) return 'Updating the gallery…'
  const verb = p.step.step === 'making' ? 'Making' : 'Sending'
  return `${verb} video ${p.step.done + 1} of ${p.step.total}…`
}

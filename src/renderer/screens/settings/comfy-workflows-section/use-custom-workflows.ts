// The added ComfyUI workflows, from comfy.getInfo (D-104). Read on open and again whenever the
// app state changes: every comfyWorkflow command sets changesAppState, an agent's add included.
import { useCallback, useEffect, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import type { AdmanApi } from '@/shared/schemas/api'
import type { ComfyInfo, WorkflowInfo } from '@/shared/schemas/queries/comfy'

async function customWorkflows(api: AdmanApi): Promise<WorkflowInfo[] | null> {
  const reply = await api.query('comfy.getInfo', {})
  if (!reply.ok) return null
  return (reply.data as ComfyInfo).workflows.filter((w) => w.status === 'custom')
}

export function useCustomWorkflows(): { workflows: WorkflowInfo[]; read: () => Promise<void> } {
  const api = useApi()
  const [workflows, setWorkflows] = useState<WorkflowInfo[]>([])

  const read = useCallback(async () => {
    const next = await customWorkflows(api)
    if (next) setWorkflows(next)
  }, [api])

  useEffect(() => {
    let live = true
    const show = (next: WorkflowInfo[] | null) => live && next && setWorkflows(next)
    void customWorkflows(api).then(show)
    const stop = api.on('app.stateChanged', () => void customWorkflows(api).then(show))
    return () => {
      live = false
      stop()
    }
  }, [api])

  return { workflows, read }
}

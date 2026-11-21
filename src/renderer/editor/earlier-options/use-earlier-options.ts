// Reads job.earlierOptions for one layer (spec/screens-ai.md, "Earlier options"; spec/ai-jobs.md
// "The three queries"), and again on a job.updated for one of its jobs or one naming this layer
// (by layer ID, or by slot within its variant), and on a project.changed naming an asset it
// shows. A reply that arrives after a newer read started is dropped. A refused read is empty.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import type { EarlierOptions } from '@/shared/schemas/queries/earlier-options'
import type { ProjectChangedPayload } from '@/shared/schemas/events'
import type { JobRow } from '@/shared/schemas/rows/job'
import type { LayerRow } from '@/shared/schemas/rows/layer'

type Place = Pick<LayerRow, 'id' | 'variantId' | 'slot'>

function namesLayer(row: JobRow, layer: Place): boolean {
  if (row.layerId === layer.id) return true
  return layer.slot !== null && row.slot === layer.slot && row.variantId === layer.variantId
}

function namedAssets(payload: ProjectChangedPayload): string[] {
  const changed = (payload.changed.asset ?? []).map((row) => String(row.id))
  return [...changed, ...(payload.removed.asset ?? [])]
}

export function useEarlierOptions(projectId: string, layer: Place): EarlierOptions | null {
  const api = useApi()
  const [reply, setReply] = useState<EarlierOptions | null>(null)
  const shown = useRef<EarlierOptions>([])
  const reads = useRef(0)
  const { id: layerId, variantId, slot } = layer

  const read = useCallback(async () => {
    reads.current += 1
    const mine = reads.current
    const result = await api.query('job.earlierOptions', { projectId, layerId })
    if (mine !== reads.current) return
    const next = result.ok ? ((result.data as EarlierOptions | null) ?? []) : []
    shown.current = next
    setReply(next)
  }, [api, projectId, layerId])

  useEffect(() => {
    void read()
    const place = { id: layerId, variantId, slot }
    const stopJobs = api.on('job.updated', (row) => {
      const ours = shown.current.some((option) => option.job.id === row.id)
      if (ours || namesLayer(row, place)) void read()
    })
    const stopProject = api.on('project.changed', (payload) => {
      if (payload.projectId !== projectId) return
      const ids = new Set(shown.current.flatMap((option) => option.assets.map((a) => a.assetId)))
      if (namedAssets(payload).some((id) => ids.has(id))) void read()
    })
    return () => {
      reads.current += 1
      stopJobs()
      stopProject()
    }
  }, [api, read, projectId, layerId, variantId, slot])

  return reply
}

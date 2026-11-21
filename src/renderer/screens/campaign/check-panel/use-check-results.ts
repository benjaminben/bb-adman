// The check panel's data (spec/phases/phase-06.md, design addition 8): check.results for the
// campaign, read on mount and again on each project.changed for this project. A reply older
// than the newest read is dropped.
import { useEffect, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import type { CheckResultsReply, VariantCheckState } from '@/shared/schemas/queries/check'

export type ChecksRead =
  | { kind: 'loading' }
  | { kind: 'refused'; message: string }
  | { kind: 'done'; states: VariantCheckState[] }

export function useCheckResults(projectId: string, campaignId: string): ChecksRead {
  const api = useApi()
  const [read, setRead] = useState<ChecksRead>({ kind: 'loading' })

  useEffect(() => {
    let latest = 0
    const load = async () => {
      const turn = ++latest
      const reply = await api.query('check.results', { projectId, campaignId })
      if (turn !== latest) return
      if (!reply.ok) return setRead({ kind: 'refused', message: reply.error.message })
      const data = reply.data as CheckResultsReply | null
      setRead({ kind: 'done', states: data?.variants ?? [] })
    }
    void load()
    const stop = api.on('project.changed', (payload) => {
      if (payload.projectId === projectId) void load()
    })
    return () => {
      latest = -1
      stop()
    }
  }, [api, projectId, campaignId])

  return read
}

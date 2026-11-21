// campaign.paidCount for one campaign (spec/screens-ai.md, "The paid count"), read again after
// each job.updated whose row has that campaignId. A refused query gives null.
import { useEffect, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import type { PaidCount } from '@/shared/schemas/queries/paid-count'

export function usePaidCount(projectId: string, campaignId: string): PaidCount | null {
  const api = useApi()
  const [counts, setCounts] = useState<PaidCount | null>(null)
  useEffect(() => {
    let live = true
    const read = () =>
      void api.query('campaign.paidCount', { projectId, campaignId }).then((result) => {
        if (live) setCounts(result.ok ? (result.data as PaidCount) : null)
      })
    read()
    const stop = api.on('job.updated', (job) => {
      if (job.campaignId === campaignId) read()
    })
    return () => {
      live = false
      stop()
    }
  }, [api, projectId, campaignId])
  return counts
}

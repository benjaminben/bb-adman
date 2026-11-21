// The campaign page's campaign.get reply, read on open and again on project.changed for the
// project and on job.updated for the campaign, so a deleted variant loses its tab and the marks
// follow the jobs. Moved out of campaign-view.tsx (P5-14), unchanged.
import { useEffect, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import type { CampaignGet } from '@/shared/schemas/queries/campaign'

export function useCampaign(projectId: string, campaignId: string): CampaignGet | null {
  const api = useApi()
  const [data, setData] = useState<CampaignGet | null>(null)
  useEffect(() => {
    let live = true
    const read = () =>
      void api.query('campaign.get', { projectId, campaignId }).then((result) => {
        if (live && result.ok && result.data) setData(result.data as CampaignGet)
      })
    read()
    const stops = [
      api.on('project.changed', (payload) => {
        if (payload.projectId === projectId) read()
      }),
      api.on('job.updated', (job) => {
        if (job.campaignId === campaignId) read()
      }),
    ]
    return () => {
      live = false
      for (const stop of stops) stop()
    }
  }, [api, projectId, campaignId])
  return data
}

// spec/editor.md, "Properties panel", "Text": the campaign's palette, from campaign.get's rule
// set, for the palette buttons. Read once per campaign; empty until read or when refused.
import { useEffect, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import type { CampaignGet } from '@/shared/schemas/queries/campaign'

export function usePalette(projectId: string, campaignId: string | null): string[] {
  const api = useApi()
  const [palette, setPalette] = useState<string[]>([])
  useEffect(() => {
    if (campaignId === null) return
    let live = true
    void api.query('campaign.get', { projectId, campaignId }).then((result) => {
      const data = result.ok ? (result.data as CampaignGet | null) : null
      if (live) setPalette(data?.ruleSet.palette ?? [])
    })
    return () => {
      live = false
    }
  }, [api, projectId, campaignId])
  return palette
}

// spec/editor.md, "Properties panel", "Text": the campaign's palette, from campaign.get's rule
// set, for the palette buttons. Read once per campaign; empty until read or when refused.
// Every swatch draws its entry as CSS, so an entry that is not an exact #RRGGBB (text a hostile
// project file could plant) is left out here, the one source of the swatches.
import { useEffect, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import { HEX_COLOUR } from '@/shared/schemas/layer'
import type { CampaignGet } from '@/shared/schemas/queries/campaign'

export function usePalette(projectId: string, campaignId: string | null): string[] {
  const api = useApi()
  const [palette, setPalette] = useState<string[]>([])
  useEffect(() => {
    if (campaignId === null) return
    let live = true
    void api.query('campaign.get', { projectId, campaignId }).then((result) => {
      const data = result.ok ? (result.data as CampaignGet | null) : null
      const entries: unknown[] = data?.ruleSet.palette ?? []
      const exact = entries.filter((e): e is string => typeof e === 'string' && HEX_COLOUR.test(e))
      if (live) setPalette(exact)
    })
    return () => {
      live = false
    }
  }, [api, projectId, campaignId])
  return palette
}

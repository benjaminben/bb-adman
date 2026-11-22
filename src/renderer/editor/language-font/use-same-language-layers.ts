// spec/phases/phase-06.md, design addition 6 (A-166): the layers that share a translated text
// layer's direction, language and key, read from translation.forCampaign on mount and again on
// each project.changed for this project, so an agent's edit shows. Null while unread, outside a
// campaign, or when the layer is not a translation (it is in the campaign's main language). A
// reply older than the newest read is dropped.
import { useEffect, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import type { TranslationForCampaign } from '@/shared/schemas/queries/translation'

export type SameLanguageLayers = { language: string; layerIds: string[] }

export function matchingLayers(
  data: TranslationForCampaign,
  layerId: string,
): SameLanguageLayers | null {
  const own = data.rows.find((r) => r.layerId === layerId)
  if (!own) return null
  const layerIds = data.rows
    .filter(
      (r) =>
        r.directionId === own.directionId &&
        r.language === own.language &&
        r.layerKey === own.layerKey,
    )
    .map((r) => r.layerId)
  return { language: own.language, layerIds }
}

export function useSameLanguageLayers(
  projectId: string,
  campaignId: string | null,
  layerId: string,
): SameLanguageLayers | null {
  const api = useApi()
  const [found, setFound] = useState<SameLanguageLayers | null>(null)

  useEffect(() => {
    if (campaignId === null) return
    let latest = 0
    const load = async () => {
      const turn = ++latest
      const reply = await api.query('translation.forCampaign', { projectId, campaignId })
      if (turn !== latest) return
      const data = reply.ok ? (reply.data as TranslationForCampaign | null) : null
      setFound(data ? matchingLayers(data, layerId) : null)
    }
    void load()
    const stop = api.on('project.changed', (payload) => {
      if (payload.projectId === projectId) void load()
    })
    return () => {
      latest = -1
      stop()
    }
  }, [api, projectId, campaignId, layerId])

  return campaignId === null ? null : found
}

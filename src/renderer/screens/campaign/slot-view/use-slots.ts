// The slot view's data (spec/screens-campaign.md, "The slot view"): template.slots for the
// campaign and asset.list for the candidates' names and pictures, read on mount and again on
// each project.changed for this project. asset.list is read only when an empty picture slot
// has candidates, since nothing else is drawn from it. A reply older than the newest read is
// dropped.
import { useEffect, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import type { AssetList } from '@/shared/schemas/queries/asset'
import type { TemplateSlots } from '@/shared/schemas/queries/campaign'

export type Candidate = AssetList[number]

export type SlotsRead =
  | { kind: 'loading' }
  | { kind: 'refused'; message: string }
  | { kind: 'done'; slots: TemplateSlots; assets: Map<string, Candidate> }

// An empty picture slot with candidates; only such a slot draws pictures.
export function wantsPictures(entry: TemplateSlots[number]): boolean {
  return entry.slot.type !== 'copy' && entry.state === 'empty' && entry.candidates.length > 0
}

export function useSlots(projectId: string, campaignId: string): SlotsRead {
  const api = useApi()
  const [read, setRead] = useState<SlotsRead>({ kind: 'loading' })

  useEffect(() => {
    let latest = 0
    const readImages = async (): Promise<AssetList> => {
      const result = await api.query('asset.list', { projectId, kind: 'image' })
      return result.ok ? ((result.data as AssetList | null) ?? []) : []
    }
    const load = async () => {
      const turn = ++latest
      const reply = await api.query('template.slots', { projectId, campaignId })
      if (turn !== latest) return
      if (!reply.ok) return setRead({ kind: 'refused', message: reply.error.message })
      const slots = (reply.data as TemplateSlots | null) ?? []
      const rows = slots.some(wantsPictures) ? await readImages() : []
      if (turn !== latest) return
      setRead({ kind: 'done', slots, assets: new Map(rows.map((a) => [a.id, a])) })
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

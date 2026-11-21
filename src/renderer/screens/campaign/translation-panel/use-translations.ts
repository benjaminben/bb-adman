// The translation panel's data (spec/phases/phase-06.md, design addition 8; P6-4b):
// translation.forCampaign, read on mount, on each project.changed for this project and on each
// job.updated for a translation job of this campaign. An agent may change a text at any time,
// so the rows are always the newest read; a reply older than the newest read is dropped.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import type { TranslationForCampaign } from '@/shared/schemas/queries/translation'

// An empty reply reads as no rows.
const EMPTY: TranslationForCampaign = { primaryLanguage: '', rows: [], jobs: [] }

export type TranslationsRead =
  | { kind: 'loading' }
  | { kind: 'refused'; message: string }
  | { kind: 'done'; data: TranslationForCampaign }

export function useTranslations(
  projectId: string,
  campaignId: string,
): { read: TranslationsRead; reload: () => void } {
  const api = useApi()
  const [read, setRead] = useState<TranslationsRead>({ kind: 'loading' })
  const latest = useRef(0)

  const reload = useCallback(() => {
    const turn = ++latest.current
    void api.query('translation.forCampaign', { projectId, campaignId }).then((reply) => {
      if (turn !== latest.current) return
      if (!reply.ok) return setRead({ kind: 'refused', message: reply.error.message })
      setRead({ kind: 'done', data: (reply.data as TranslationForCampaign | null) ?? EMPTY })
    })
  }, [api, projectId, campaignId])

  useEffect(() => {
    reload()
    const stopProject = api.on('project.changed', (payload) => {
      if (payload.projectId === projectId) reload()
    })
    const stopJobs = api.on('job.updated', (row) => {
      if (row.kind === 'translation' && row.campaignId === campaignId) reload()
    })
    return () => {
      latest.current += 1
      stopProject()
      stopJobs()
    }
  }, [api, reload, projectId, campaignId])

  return { read, reload }
}

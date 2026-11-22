// The translation panel's data (spec/phases/phase-06.md, design addition 8; P6-4b):
// translation.forCampaign, read on mount, on each project.changed for this project and on each
// job.updated for a translation job of this campaign. An agent may change a text at any time,
// so the rows are always the newest read; a reply older than the newest read is dropped.
// R3-3: translation.sources is read with it each time, for the source block and the
// out-of-date marks.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import type {
  TranslationForCampaign,
  TranslationSources,
} from '@/shared/schemas/queries/translation'

export type TranslationsData = TranslationForCampaign & { sources: TranslationSources }

// An empty reply reads as no rows.
const EMPTY: TranslationForCampaign = { primaryLanguage: '', rows: [], jobs: [] }
const NO_SOURCES: TranslationSources = { rows: [], outOfDate: [] }

export type TranslationsRead =
  | { kind: 'loading' }
  | { kind: 'refused'; message: string }
  | { kind: 'done'; data: TranslationsData }

export function useTranslations(
  projectId: string,
  campaignId: string,
): { read: TranslationsRead; reload: () => void } {
  const api = useApi()
  const [read, setRead] = useState<TranslationsRead>({ kind: 'loading' })
  const latest = useRef(0)

  const reload = useCallback(() => {
    const turn = ++latest.current
    const input = { projectId, campaignId }
    void Promise.all([
      api.query('translation.forCampaign', input),
      api.query('translation.sources', input),
    ]).then(([reply, sources]) => {
      if (turn !== latest.current) return
      if (!reply.ok) return setRead({ kind: 'refused', message: reply.error.message })
      if (!sources.ok) return setRead({ kind: 'refused', message: sources.error.message })
      const data = (reply.data as TranslationForCampaign | null) ?? EMPTY
      const source = (sources.data as TranslationSources | null) ?? NO_SOURCES
      setRead({ kind: 'done', data: { ...data, sources: source } })
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

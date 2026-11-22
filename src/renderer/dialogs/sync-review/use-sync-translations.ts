// Translation in the sync review (spec/phases/phase-06.md, section 7; spec/data-rules.md,
// "Sync"; P6-16). When the preview has a translated copy change that is not yet proposed, the
// dialog sends one translation.propose in `sync` mode per language, with the text provider
// from Settings, and reads the preview again when a job succeeds. Only a local provider is
// started on open. A paid run starts only on the user's own confirm and never on open
// (spec/screens.md; P6-18): with a paid provider each waiting language is listed in `needs`,
// `ask` opens its paid confirm and only `confirm` starts it. Each language starts once per
// opening; "Retry" starts it again, through the confirm when the provider is paid.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApi, useApp } from '@/renderer/app/app-context'
import { plainMessage } from '@/shared/providers/messages'
import type { SyncPreviewReply } from '@/shared/schemas/queries/sync'
import type { JobRow } from '@/shared/schemas/rows/job'

export type LanguageRun =
  | { kind: 'running'; jobId: string | null }
  | { kind: 'failed'; sentence: string | null }
  | { kind: 'done' }
export type LanguageRuns = Readonly<Record<string, LanguageRun>>

type Options = {
  projectId: string
  directionId: string
  reply: SyncPreviewReply | null
  languageOf: (variantId: string) => string | undefined
  onDone: () => void
}

const ENDED = new Set(['succeeded', 'failed', 'cancelled'])

// The languages whose translated copy changes have no usable text yet.
function languagesToTranslate(reply: SyncPreviewReply, languageOf: Options['languageOf']) {
  const out = new Set<string>()
  for (const v of reply.variants) {
    const language = languageOf(v.variantId)
    const waiting = v.changes.some((c) => c.proposedTranslation?.status === 'failed')
    if (language && waiting) out.add(language)
  }
  return [...out]
}

export function useSyncTranslations(options: Options) {
  const { projectId, directionId, reply, languageOf, onDone } = options
  const api = useApi()
  const command = useApp((s) => s.command)
  const app = useApp((s) => s.app)
  const provider = app?.providers.find((p) => p.id === app.settings.defaultProviders.text)
  const usable = provider !== undefined && provider.available && provider.jobs.includes('text')
  const local = usable && provider.local === true
  const label = provider?.label ?? ''
  const [runs, setRuns] = useState<LanguageRuns>({})
  const [asking, setAsking] = useState<ReadonlySet<string>>(new Set())
  const started = useRef(new Set<string>())
  const ended = useRef(new Map<string, JobRow>())
  const jobs = useRef(new Map<string, string>()) // job ID to language

  const finish = useCallback(
    (language: string, row: JobRow) => {
      const run: LanguageRun =
        row.status === 'succeeded'
          ? { kind: 'done' }
          : { kind: 'failed', sentence: plainMessage(row.errorKind ?? 'other', label) }
      setRuns((was) => ({ ...was, [language]: run }))
      if (run.kind === 'done') onDone()
    },
    [label, onDone],
  )

  const start = useCallback(
    async (language: string) => {
      if (!usable) return
      started.current.add(language)
      setRuns((was) => ({ ...was, [language]: { kind: 'running', jobId: null } }))
      const input = { projectId, provider: provider.id, mode: 'sync', directionId, language }
      const result = await command('translation.propose', input)
      if (!result.ok) {
        const run: LanguageRun = { kind: 'failed', sentence: result.error.message }
        return setRuns((was) => ({ ...was, [language]: run }))
      }
      const [jobId = ''] = (result.data as { jobIds: string[] }).jobIds
      jobs.current.set(jobId, language)
      setRuns((was) => ({ ...was, [language]: { kind: 'running', jobId } }))
      const row = ended.current.get(jobId)
      if (row) finish(language, row)
    },
    [command, directionId, finish, usable, projectId, provider],
  )

  useEffect(
    () =>
      api.on('job.updated', (row) => {
        if (row.kind !== 'translation' || !ENDED.has(row.status)) return
        ended.current.set(row.id, row)
        const language = jobs.current.get(row.id)
        if (language) finish(language, row)
      }),
    [api, finish],
  )

  const needs = useMemo(
    () => (reply ? languagesToTranslate(reply, languageOf) : []),
    [reply, languageOf],
  )
  useEffect(() => {
    if (!local) return
    for (const language of needs) {
      if (!started.current.has(language)) void start(language)
    }
  }, [local, needs, start])

  const setAsk = (language: string, on: boolean) =>
    setAsking((was) => {
      const next = new Set(was)
      if (on) next.add(language)
      else next.delete(language)
      return next
    })
  const paid = usable && !local
  return {
    runs,
    // P6-18: the paid path. Empty and unused with a local provider.
    paid: paid ? { label, needs, asking } : null,
    ask: (language: string) => setAsk(language, true),
    cancel: (language: string) => setAsk(language, false),
    confirm: (language: string) => {
      setAsk(language, false)
      void start(language)
    },
    retry: (language: string) => (paid ? setAsk(language, true) : void start(language)),
  }
}

// Translation in the sync review (spec/phases/phase-06.md, section 7; spec/data-rules.md,
// "Sync"; P6-16). When the preview has a translated copy change that is not yet proposed, the
// dialog sends one translation.propose in `sync` mode per language, with the text provider
// from Settings, and reads the preview again when a job succeeds. Only a local provider is
// started this way: a paid run starts only on the user's own confirm and never on open
// (spec/screens.md), and no confirm step for the review is designed yet, so with a paid
// provider nothing is sent and the Phase 5 line stays. Each language starts once per opening;
// "Retry" starts it again.
import { useCallback, useEffect, useRef, useState } from 'react'
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
  const local = provider?.local === true && provider.available && provider.jobs.includes('text')
  const label = provider?.label ?? ''
  const [runs, setRuns] = useState<LanguageRuns>({})
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
      if (!local || !provider) return
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
    [command, directionId, finish, local, projectId, provider],
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

  useEffect(() => {
    if (!reply) return
    for (const language of languagesToTranslate(reply, languageOf)) {
      if (!started.current.has(language)) void start(language)
    }
  }, [reply, languageOf, start])

  return { runs, retry: (language: string) => void start(language) }
}

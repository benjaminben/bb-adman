// The copy options dialog's runs (spec/screens-ai.md, "Copy options"; spec/ai-jobs.md "Copy
// options"): the layer's newest succeeded copy_options job from job.list, and the run started
// in this dialog, followed through job.updated. Rows of copy jobs for the layer that come
// before a command's reply are kept, so the reply finds its row. Shown options are marked seen.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import type { JobRow } from '@/shared/schemas/rows/job'
import type { Result } from '@/shared/schemas/result'

export type CopyRun =
  | { state: 'none' }
  | { state: 'running'; jobId: string }
  | { state: 'failed'; row: JobRow }
  | { state: 'options'; row: JobRow }

const ended = (row: JobRow) => row.status !== 'queued' && row.status !== 'running'
const isCopy = (row: JobRow, layerId: string) =>
  row.kind === 'copy_options' && row.layerId === layerId

function jobIdOf(data: unknown): string | null {
  if (typeof data !== 'object' || data === null || !('jobId' in data)) return null
  return typeof data.jobId === 'string' ? data.jobId : null
}

export function useCopyRun(projectId: string, layerId: string) {
  const api = useApi()
  const [latest, setLatest] = useState<JobRow | null>(null)
  const [run, setRun] = useState<JobRow | { id: string } | null>(null)
  const seen = useRef(new Map<string, JobRow>())
  const runId = useRef<string | null>(null)
  const marked = useRef(new Set<string>())

  const take = useCallback((row: JobRow) => {
    if (row.status === 'succeeded') setLatest(row)
    if (row.status === 'cancelled' || row.status === 'succeeded') {
      runId.current = null
      setRun(null)
    } else setRun(row)
  }, [])

  useEffect(() => {
    let live = true
    void api.query('job.list', { projectId, layerId }).then((reply) => {
      if (!live || !reply.ok || !Array.isArray(reply.data)) return
      const rows = reply.data as JobRow[]
      const done = rows.find((r) => isCopy(r, layerId) && r.status === 'succeeded')
      if (done) setLatest((now) => now ?? done)
    })
    const off = api.on('job.updated', (row) => {
      if (!isCopy(row, layerId)) return
      seen.current.set(row.id, row)
      if (row.id === runId.current) take(row)
    })
    return () => {
      live = false
      off()
    }
  }, [api, projectId, layerId, take])

  // Takes a command's reply ({ jobId }); returns the job ID it now follows.
  const follow = useCallback(
    (reply: Result<unknown>): string | null => {
      const jobId = reply.ok ? jobIdOf(reply.data) : null
      if (jobId === null) return null
      runId.current = jobId
      const row = seen.current.get(jobId)
      if (row) take(row)
      else setRun({ id: jobId })
      return jobId
    },
    [take],
  )

  const current: CopyRun = describe(run, latest)
  const shownRow = current.state === 'options' ? current.row : null

  useEffect(() => {
    if (!shownRow || shownRow.seenAt !== null || marked.current.has(shownRow.id)) return
    marked.current.add(shownRow.id)
    void api.command('job.markSeen', { projectId, jobIds: [shownRow.id] })
  }, [api, projectId, shownRow])

  return { current, follow }
}

function describe(run: JobRow | { id: string } | null, latest: JobRow | null): CopyRun {
  if (run && !('status' in run)) return { state: 'running', jobId: run.id }
  if (run && !ended(run)) return { state: 'running', jobId: run.id }
  if (run?.status === 'failed') return { state: 'failed', row: run }
  return latest ? { state: 'options', row: latest } : { state: 'none' }
}

// The export dialog's sends and its job (spec/phases/phase-08.md "Export run"). export.run goes
// through the app store's `command`, so a refusal shows in the error banner, except the
// warnings gate (export_has_warnings), which this hook turns into the warnings step and takes
// out of the banner. A started job is followed through job.updated for its own ID only; rows
// that come before the reply are kept, so the reply finds its row.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useApi, useApp } from '@/renderer/app/app-context'
import {
  exportHasWarningsDetails,
  type ExportRunInput,
  type ExportWarning,
} from '@/shared/schemas/commands/export'
import type { JobRow } from '@/shared/schemas/rows/job'
import type { Result } from '@/shared/schemas/result'

export type ExportStep =
  | { kind: 'choose' }
  | { kind: 'warnings'; warnings: ExportWarning[] }
  | { kind: 'running'; percent: number }
  | { kind: 'done'; exported: number; failed: number }
  | { kind: 'ended'; status: 'failed' | 'cancelled' }

const count = (value: unknown) => (typeof value === 'number' ? value : 0)

function stepOf(row: JobRow): ExportStep {
  if (row.status === 'queued' || row.status === 'running')
    return { kind: 'running', percent: Math.round((row.progress ?? 0) * 100) }
  if (row.status !== 'succeeded') return { kind: 'ended', status: row.status }
  const result = (row.result ?? {}) as Record<string, unknown>
  return { kind: 'done', exported: count(result.exported), failed: count(result.failed) }
}

function jobIdOf(reply: Result<unknown>): string | null {
  if (!reply.ok || typeof reply.data !== 'object' || reply.data === null) return null
  const { jobId } = reply.data as { jobId?: unknown }
  return typeof jobId === 'string' ? jobId : null
}

function warningsOf(reply: Result<unknown>): ExportWarning[] | null {
  if (reply.ok || reply.error.code !== 'RULE_VIOLATION') return null
  const details = exportHasWarningsDetails.safeParse(reply.error.details)
  return details.success ? details.data.warnings : null
}

export function useExportJob() {
  const api = useApi()
  const command = useApp((s) => s.command)
  const clearError = useApp((s) => s.clearError)
  const [step, setStep] = useState<ExportStep>({ kind: 'choose' })
  const [sending, setSending] = useState(false)
  const seen = useRef(new Map<string, JobRow>())
  const jobId = useRef<string | null>(null)

  useEffect(
    () =>
      api.on('job.updated', (row) => {
        if (row.kind !== 'export') return
        seen.current.set(row.id, row)
        if (row.id === jobId.current) setStep(stepOf(row))
      }),
    [api],
  )

  const send = useCallback(
    async (input: ExportRunInput) => {
      setSending(true)
      const reply = await command('export.run', input)
      setSending(false)
      const started = jobIdOf(reply)
      if (started !== null) {
        jobId.current = started
        const row = seen.current.get(started)
        return setStep(row ? stepOf(row) : { kind: 'running', percent: 0 })
      }
      const warnings = warningsOf(reply)
      if (warnings === null) return
      clearError()
      setStep({ kind: 'warnings', warnings })
    },
    [command, clearError],
  )

  const back = useCallback(() => setStep({ kind: 'choose' }), [])

  return { step, sending, send, back }
}

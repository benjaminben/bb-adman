// spec/screens-ai.md, "Attached jobs and the close warning"; spec/jobs.md, "Closing a project
// and quitting" (the Ask answer to Q-039): "Close project" sends project.close; refused with
// jobs_running, it asks "Close {project}?" instead of showing the refusal. "Stop runs and close"
// sends project.close with runningJobs 'stop'; "Keep open" (focused) sends nothing.
// P7-15 (A-174): a started paid video run the close leaves running adds the left-running line,
// one per provider. The rows come from job.activity for the project.
import { useState } from 'react'
import { EMPTY, useApi, useApp } from '@/renderer/app/app-context'
import { cancelShown } from '@/renderer/ui/cancel-shown'
import { leftRunningLine } from '@/renderer/ui/close-warning/close-words'
import { DialogFrame } from '@/renderer/ui/dialog-frame'
import { ACTIVITY_LIMIT_MAX, type JobActivity } from '@/shared/schemas/queries/activity'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import type { AdmanApi } from '@/shared/schemas/api'
import styles from './project-switcher.module.css'

type Asking = { projectId: string; name: string; count: number; lines: string[] }

// The close's own test (leftRunningOnClose in src/main/jobs/leave-running.ts): a running video
// row of a provider that is not local, with cancel may_finish, whose cancel the app refuses
// because it would still be charged (started, at stage working).
async function leftRunningLines(
  api: AdmanApi,
  projectId: string,
  providers: readonly ProviderInfo[],
): Promise<string[]> {
  const result = await api.query('job.activity', { projectId, limit: ACTIVITY_LIMIT_MAX })
  if (!result.ok || !Array.isArray(result.data)) return []
  const counts = new Map<string, number>()
  for (const { job } of result.data as JobActivity) {
    const provider = providers.find((p) => p.id === job.provider)
    const left =
      job.kind === 'video_generation' &&
      job.status === 'running' &&
      provider?.local === false &&
      provider.cancel === 'may_finish' &&
      !cancelShown(job, provider)
    if (left) counts.set(provider.label, (counts.get(provider.label) ?? 0) + 1)
  }
  return [...counts].map(([label, n]) => leftRunningLine(label, n))
}

export function closeProjectWords(count: number): string {
  const going =
    count === 1
      ? '1 run is still going in this project. Closing stops it.'
      : `${count} runs are still going in this project. Closing stops them.`
  return (
    `${going} Requests already sent to a paid provider may still be charged, and their ` +
    'results are lost.'
  )
}

export function useCloseProject() {
  const api = useApi()
  const providers = useApp((s) => s.app?.providers ?? EMPTY)
  const command = useApp((s) => s.command)
  const clearError = useApp((s) => s.clearError)
  const [asking, setAsking] = useState<Asking | null>(null)
  const [sending, setSending] = useState(false)

  async function closeProject(projectId: string, name: string) {
    const result = await command('project.close', { projectId })
    if (result.ok || result.error.details?.reason !== 'jobs_running') return
    clearError()
    const count = Number(result.error.details.count ?? 0)
    const lines = await leftRunningLines(api, projectId, providers)
    setAsking({ projectId, name, count, lines })
  }

  async function stopAndClose() {
    if (!asking) return
    setSending(true)
    await command('project.close', { projectId: asking.projectId, runningJobs: 'stop' })
    setSending(false)
    setAsking(null)
  }

  const dialog = (
    <DialogFrame
      open={asking !== null}
      onClose={() => setAsking(null)}
      title={`Close ${asking?.name ?? ''}?`}
      description={[closeProjectWords(asking?.count ?? 0), ...(asking?.lines ?? [])].join(' ')}
      closable={!sending}
    >
      <div className={styles.actions}>
        <button type="button" disabled={sending} onClick={() => setAsking(null)}>
          Keep open
        </button>
        <button
          type="button"
          className={styles.stop}
          disabled={sending}
          onClick={() => void stopAndClose()}
        >
          Stop runs and close
        </button>
      </div>
    </DialogFrame>
  )
  return { closeProject, dialog }
}

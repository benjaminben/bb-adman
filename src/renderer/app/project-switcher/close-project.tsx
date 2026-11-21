// spec/screens-ai.md, "Attached jobs and the close warning"; spec/jobs.md, "Closing a project
// and quitting" (the Ask answer to Q-039): "Close project" sends project.close; refused with
// jobs_running, it asks "Close {project}?" instead of showing the refusal. "Stop runs and close"
// sends project.close with runningJobs 'stop'; "Keep open" (focused) sends nothing.
import { useState } from 'react'
import { useApp } from '@/renderer/app/app-context'
import { DialogFrame } from '@/renderer/ui/dialog-frame'
import styles from './project-switcher.module.css'

type Asking = { projectId: string; name: string; count: number }

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
  const command = useApp((s) => s.command)
  const clearError = useApp((s) => s.clearError)
  const [asking, setAsking] = useState<Asking | null>(null)
  const [sending, setSending] = useState(false)

  async function closeProject(projectId: string, name: string) {
    const result = await command('project.close', { projectId })
    if (result.ok || result.error.details?.reason !== 'jobs_running') return
    clearError()
    setAsking({ projectId, name, count: Number(result.error.details.count ?? 0) })
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
      description={closeProjectWords(asking?.count ?? 0)}
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

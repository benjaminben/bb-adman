// P7-15 (A-174): the started paid video runs that quitting leaves running, by provider label,
// for the quit question (quit-question.ts). Read from the open projects' job rows; a row counts
// when leftRunningOnClose is true for it, the same test the close uses.
import { activeJobs, readJob } from './job-store'
import { leftRunningOnClose } from './leave-running'
import type { ProjectHandle } from '@/main/db/project-file'
import type { ActivityLog } from '@/main/log/activity-log'
import type { LeftRunning } from '@/main/quit-question'
import { storedWords } from '@/shared/providers/model-words'
import type { ProviderInfo } from '@/shared/schemas/queries/app'

export function leftRunningList(
  handles: readonly ProjectHandle[],
  providers: readonly ProviderInfo[],
  log: ActivityLog,
): LeftRunning[] {
  const counts = new Map<string, number>()
  for (const handle of handles) {
    for (const active of activeJobs(handle)) {
      const row = readJob(handle, active.id, log)
      const provider = providers.find((p) => p.id === row?.provider)
      if (!row || !provider || !leftRunningOnClose(row, provider)) continue
      // R3-2: counted by the provider and the model the run uses.
      const label = storedWords(provider, row.model)
      counts.set(label, (counts.get(label) ?? 0) + 1)
    }
  }
  return [...counts].map(([label, count]) => ({ label, count }))
}

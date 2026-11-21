// job.getServerMessage (SPEC 4.3, 6.10.9; FR-267, FR-277) (security class): the cleaned
// server text of a failed job, for a provider whose serverText is true (ComfyUI only). User
// only: an agent is refused with AGENT_DENIED and no MCP tool calls it. The text is data: the
// window draws it as text and nothing acts on it. Only the reasons whose detail holds the
// server's words give a text; every other detail is the app's own and gives null.
import type { CoreDeps } from '@/main/core-deps'
import type { QueryFn } from './types'
import { readJobErrorDetail, readWireRow } from '@/main/db/rows'
import { jobServerMessageInput, type JobServerMessage } from '@/shared/schemas/queries/job'
import type { ProviderErrorReason } from '@/shared/schemas/queries/app'
import type { JobRow } from '@/shared/schemas/rows/job'
import { AppError } from '@/shared/schemas/result'

export const SERVER_MESSAGE_DENIED =
  "Agents cannot read a server's own message. Ask the user to read it in the app."

// The reasons whose detail is the server's words, after cleanServerText (comfyui/failures.ts).
const SERVER_WORDS: ReadonlySet<ProviderErrorReason> = new Set([
  'server_refused',
  'run_failed',
  'out_of_memory',
])

export function jobGetServerMessage(deps: Pick<CoreDeps, 'projects' | 'providers'>): QueryFn {
  return (raw, opts): JobServerMessage => {
    if (opts.actor !== 'user') throw new AppError('AGENT_DENIED', SERVER_MESSAGE_DENIED)
    const parsed = jobServerMessageInput.safeParse(raw)
    if (!parsed.success) throw new AppError('INVALID_INPUT', 'Some values are not valid.')
    const project = deps.projects.requireOpen(parsed.data.projectId)
    const job = readWireRow(project.db, 'job', { id: parsed.data.jobId }) as JobRow | null
    const provider = deps.providers.find((p) => p.id === job?.provider)
    const words =
      job?.status === 'failed' &&
      provider?.serverText === true &&
      job.errorReason !== null &&
      SERVER_WORDS.has(job.errorReason)
    const text = words ? readJobErrorDetail(project.db, job.id) : null
    return { text: text === '' ? null : text }
  }
}

export function jobServerMessageQueries(deps: CoreDeps): Record<string, QueryFn> {
  return { 'job.getServerMessage': jobGetServerMessage(deps) }
}

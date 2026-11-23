// SPEC 6.10.9 [REQ: FR-265, FR-266, FR-267] (security class): the failures of a ComfyUI run,
// each with its reason. The server's own words go only into `detail`, which the runner
// stores in job.error_detail and never logs, and only after cleanServerText. Every other
// detail is the app's own fixed text, so none holds the address. [1.43] K-1: the client
// parsed the 400; this file reads `refusal` and never parses an answer itself.
import type { ComfyCheckOutcome } from '@/shared/schemas/commands/comfy-check'
import type {
  MissingItem,
  ProviderErrorKind,
  ProviderErrorReason,
} from '@/shared/schemas/queries/app'
import { ProviderFailure } from '@/main/providers/types'
import type { RunMessage } from './answers'
import type { ComfyRefused } from './refusal'
import { cleanServerText } from './server-text'

export function comfyFailure(
  reason: ProviderErrorReason,
  detail: string,
  kind: ProviderErrorKind = 'other',
): ProviderFailure {
  return new ProviderFailure({ kind, reason, detail })
}

const joined = (texts: Array<string | undefined>) =>
  cleanServerText(texts.filter((t): t is string => t !== undefined && t !== '').join('\n'))

// What is kept from a 400: error.message and error.details, and each node error's message
// and details (SPEC 6.10.9). Never the traceback, which the client already dropped.
export function refusedFailure(refused: ComfyRefused): ProviderFailure {
  const { refusal } = refused
  const nodeTexts = refusal.nodes.flatMap((n) => n.errors.flatMap((e) => [e.message, e.details]))
  return comfyFailure('server_refused', joined([refusal.message, refusal.details, ...nodeTexts]))
}

const OUT_OF_MEMORY = ['out of memory', 'allocation on device']

function isOutOfMemory(type: string, message: string): boolean {
  if (type.includes('OutOfMemory')) return true
  const lower = message.toLowerCase()
  return OUT_OF_MEMORY.some((words) => lower.includes(words))
}

// A run the server ended with an error: the exception's type and message, never more.
export function runFailure(messages: RunMessage[]): ProviderFailure {
  const error = messages.find((m) => m.type === 'execution_error')
  const type = error?.exceptionType ?? ''
  const message = error?.exceptionMessage ?? ''
  const reason = isOutOfMemory(type, message) ? 'out_of_memory' : 'run_failed'
  return comfyFailure(reason, joined([[type, message].filter((t) => t !== '').join(': ')]))
}

export function checkFailure(outcome: Exclude<ComfyCheckOutcome, 'ok'>): ProviderFailure {
  const kind = outcome === 'no_answer' ? 'offline' : 'other'
  return comfyFailure(outcome, `The check ended ${outcome}`, kind)
}

// For a shipped workflow the names come from the app's own workflow file (SPEC 6.10.3), so
// the list is safe to show. A custom workflow's names come from its graph (D-104, rule 2):
// the failure holds only their count, since job rows reach events and project files.
export function missingFailure(missing: MissingItem[], custom = false): ProviderFailure {
  const detail = `The server is missing ${missing.length} item(s)`
  if (custom) {
    const count = { missing: [], missingCount: missing.length }
    return new ProviderFailure({ kind: 'other', reason: 'missing_items', detail, ...count })
  }
  return new ProviderFailure({ kind: 'other', reason: 'missing_items', detail, missing })
}

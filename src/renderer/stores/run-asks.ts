// S2-6 (spec/screens-campaign.md, "The address dialog" and "The commercial-licence dialog"):
// which refusal of which command opens which dialog. Only the three run commands ask; every
// other refusal, `comfy.check` included, goes to the error banner as before. Pure.
import type { ErrorBody } from '@/shared/schemas/result'

const RUN_COMMANDS: readonly string[] = [
  'generation.runImages',
  'generation.startVideo',
  'job.retry',
]

export type RunAsk = { kind: 'address' } | { kind: 'licence'; workflow: string }

export function runAsk(name: string, error: ErrorBody): RunAsk | null {
  if (!RUN_COMMANDS.includes(name)) return null
  const reason = error.details?.reason
  if (error.code === 'RULE_VIOLATION' && reason === 'comfy_address_needed') {
    return { kind: 'address' }
  }
  const workflow = error.details?.workflow
  if (
    error.code === 'INVALID_INPUT' &&
    reason === 'licence_not_confirmed' &&
    typeof workflow === 'string'
  ) {
    return { kind: 'licence', workflow }
  }
  return null
}

// The same input with the user's confirmation; the main process ignores it for an agent.
export function withLicenceFlag(input: unknown): unknown {
  if (typeof input !== 'object' || input === null) return input
  return { ...input, licenceConfirmed: true }
}

// The saved list with the model added, once.
export function addModel(list: readonly string[], model: string): string[] {
  return list.includes(model) ? [...list] : [...list, model]
}

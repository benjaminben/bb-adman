// phase-07 "Status mapping" and "Cancel": the request addresses, built by the app from the
// fixed app path and a request ID of UUID form (never from an answer or a row's URL), the
// answer shapes, and the status and cancel tables.
import { z } from 'zod'
import { ProviderFailure, type CancelOutcome, type VideoProvider } from '@/main/providers/types'
import { FAL_APP } from './endpoints'
import type { FalAnswer } from './fal-fetch'
import { falHttpFailure, falRunFailure } from './failure'
import { FAL_QUEUE_ORIGIN } from './origins'

export type Checked = Awaited<ReturnType<VideoProvider['check']>>

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NOT_JSON = 'Answer is not the expected JSON'
export const BAD_ID = 'The request ID is not in the expected form'
export const UNKNOWN_REQUEST = 'unknown_request'

export const isRequestId = (id: string) => UUID.test(id)

// The address of one request's status, result or cancel call. An ID that is not a UUID is
// refused before it is put in a path.
export function requestAddress(id: string, call: 'status' | 'result' | 'cancel'): string {
  if (!isRequestId(id)) throw new ProviderFailure({ kind: 'other', detail: BAD_ID })
  const base = `${FAL_QUEUE_ORIGIN}/${FAL_APP}/requests/${id}`
  return call === 'result' ? base : `${base}/${call}`
}

export const submitAnswer = z.object({ request_id: z.string().max(64) })

export const resultAnswer = z.object({ video: z.object({ url: z.string().max(4096) }) })

const statusAnswer = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('IN_QUEUE'),
    queue_position: z.number().int().nonnegative().optional(),
  }),
  z.object({ status: z.literal('IN_PROGRESS') }),
  z.object({
    status: z.literal('COMPLETED'),
    error: z.string().nullish(),
    error_type: z.string().nullish(),
  }),
])

// The answer body as JSON of the given shape, or `other` with a fixed detail.
export function readJson<T>(answer: FalAnswer, schema: z.ZodType<T>): T {
  let value: unknown
  try {
    value = JSON.parse(new TextDecoder().decode(answer.bytes))
  } catch {
    throw new ProviderFailure({ kind: 'other', detail: NOT_JSON })
  }
  const parsed = schema.safeParse(value)
  if (!parsed.success) throw new ProviderFailure({ kind: 'other', detail: NOT_JSON })
  return parsed.data
}

const failed = (failure: ProviderFailure): Checked => ({ status: 'failed', error: failure.error })

export function checkedFrom(answer: FalAnswer, key: string): Checked {
  if (answer.status === 404)
    return { status: 'failed', error: { kind: 'other', detail: UNKNOWN_REQUEST } }
  if (answer.status < 200 || answer.status > 299) return failed(falHttpFailure(answer, key))
  let state: z.infer<typeof statusAnswer>
  try {
    state = readJson(answer, statusAnswer)
  } catch (error) {
    if (error instanceof ProviderFailure) return failed(error)
    throw error
  }
  if (state.status === 'IN_QUEUE') {
    const at = state.queue_position
    return { status: 'waiting', ...(at !== undefined && { queuePosition: at }) }
  }
  if (state.status === 'IN_PROGRESS') return { status: 'running' }
  if (state.error || state.error_type) return failed(falRunFailure(state.error_type, key))
  return { status: 'succeeded' }
}

export function cancelOutcome(answer: FalAnswer): CancelOutcome {
  if (answer.status === 200) return 'stopped'
  if (answer.status !== 400) return 'unknown'
  try {
    const body = readJson(answer, z.object({ status: z.string() }))
    return body.status === 'ALREADY_COMPLETED' ? 'finished' : 'unknown'
  } catch {
    return 'unknown'
  }
}

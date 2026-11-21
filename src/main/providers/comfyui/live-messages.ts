// CU-9 [REQ: FR-269] (security class): what one text message on the live connection means for
// one run. Only the message types below are read, each through a schema, and only for the
// run's own prompt ID. Everything else means nothing. No piece of a message is kept, logged
// or passed on: the answer is the fixed stage word and a whole percent the app works out.
import { z } from 'zod'

export type LiveSeen = { stage: 'working'; fraction?: number } | 'ended'

const promptOnly = z.object({ prompt_id: z.string() })

const message = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('progress'),
    data: z
      .object({
        value: z.number().int().min(0),
        max: z.number().int().min(1).max(1_000_000),
        prompt_id: z.string(),
      })
      .refine((d) => d.value <= d.max),
  }),
  z.object({ type: z.literal('execution_start'), data: promptOnly }),
  z.object({
    type: z.literal('executing'),
    data: z.object({ node: z.string().nullable(), prompt_id: z.string() }),
  }),
  z.object({
    type: z.enum(['execution_success', 'execution_error', 'execution_interrupted']),
    data: promptOnly,
  }),
])

export function readLive(text: string, promptId: string): LiveSeen | null {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return null
  }
  const parsed = message.safeParse(value)
  if (!parsed.success || parsed.data.data.prompt_id !== promptId) return null
  const read = parsed.data
  if (read.type === 'progress') {
    const percent = Math.floor((read.data.value / read.data.max) * 100)
    return { stage: 'working', fraction: percent / 100 }
  }
  if (read.type === 'execution_start') return { stage: 'working' }
  if (read.type === 'executing') return read.data.node === null ? 'ended' : { stage: 'working' }
  return 'ended'
}

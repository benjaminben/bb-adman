// SPEC 14 1.43 K-1 [REQ: FR-267, FR-277] (security class): a 400 from POST /prompt. The client
// parses the server's words and hands them on as `refusal`; it keeps, cleans and stores
// nothing. The `error` holds none of them, so the runner and the log never see them. The
// field names are from a reading of ComfyUI's source, not from a run (CU-5a corrects them),
// so every field may be missing.
import { z } from 'zod'
import { ProviderFailure } from '../types'
import { MAX_SERVER_NAME_CHARS, MAX_SERVER_TEXT_CHARS } from './limits'

export type NodeRefusal = { type?: string; message?: string; details?: string; inputName?: string }

export type ServerRefusal = {
  type?: string
  message?: string
  details?: string
  nodes: { nodeId: string; errors: NodeRefusal[] }[]
}

const cut = (max: number) =>
  z
    .unknown()
    .transform((v) => (typeof v === 'string' ? v.slice(0, max) : undefined))
    .optional()
const nameText = cut(MAX_SERVER_NAME_CHARS)
const longText = cut(MAX_SERVER_TEXT_CHARS)

// Known fields only: the traceback, received_value, input_config, dependent_outputs and the
// server's class_type are dropped.
const nodeError = z.object({
  type: nameText,
  message: longText,
  details: longText,
  extra_info: z.object({ input_name: nameText }).optional().catch(undefined),
})

const refusalAnswer = z.object({
  error: z.object({ type: nameText, message: longText, details: longText }).optional(),
  node_errors: z
    .record(z.string(), z.object({ errors: z.array(nodeError).default([]) }))
    .default({}),
})

// Drops the fields that are missing, so an absent text is absent, not undefined.
function present<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T
}

// A body that is not JSON or has another shape gives `nodes: []` and no text.
export function readRefusal(bytes: Uint8Array | null): ServerRefusal {
  let value: unknown
  try {
    value = JSON.parse(Buffer.from(bytes ?? []).toString('utf8'))
  } catch {
    return { nodes: [] }
  }
  const parsed = refusalAnswer.safeParse(value)
  if (!parsed.success) return { nodes: [] }
  const { error, node_errors } = parsed.data
  return {
    ...present({ type: error?.type, message: error?.message, details: error?.details }),
    nodes: Object.entries(node_errors).map(([nodeId, node]) => ({
      nodeId: nodeId.slice(0, MAX_SERVER_NAME_CHARS),
      errors: node.errors.map((e) =>
        present({
          type: e.type,
          message: e.message,
          details: e.details,
          inputName: e.extra_info?.input_name,
        }),
      ),
    })),
  }
}

export class ComfyRefused extends ProviderFailure {
  readonly refusal: ServerRefusal

  constructor(refusal: ServerRefusal) {
    super({ kind: 'other', reason: 'server_refused', detail: 'HTTP 400' })
    this.name = 'ComfyRefused'
    this.refusal = refusal
  }
}

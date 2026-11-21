// SPEC 6.10.2 [REQ: FR-277] (security class): every JSON answer from a ComfyUI server goes
// through one of these schemas. Each keeps known fields only, and cuts every text field to a
// stated length before it is kept. The shapes of a history entry and a job state are not
// verified (U-2); the trial corrects field names.
import { z } from 'zod'
import { MAX_SERVER_NAME_CHARS, MAX_SERVER_TEXT_CHARS } from './limits'
import { isPromptId } from './values'

const name = z.string().transform((s) => s.slice(0, MAX_SERVER_NAME_CHARS))

function textField(value: unknown, max: number): string | undefined {
  return typeof value === 'string' ? value.slice(0, max) : undefined
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export const systemStatsAnswer = z
  .object({ system: z.object({ comfyui_version: name }), devices: z.array(z.unknown()) })
  .transform((a) => ({ comfyuiVersion: a.system.comfyui_version, deviceCount: a.devices.length }))

export const modelFilesAnswer = z.array(name)

export const nodeInfoAnswer = z.record(z.string(), z.unknown())

export const uploadAnswer = z.object({ name, subfolder: name.default('') })

export const submitAnswer = z
  .object({ prompt_id: z.string().refine(isPromptId), number: z.number() })
  .transform((a) => ({ promptId: a.prompt_id, number: a.number }))

export const jobStateAnswer = z.object({ status: name })

// Only IDs and order are kept; the rest of each entry, which can hold other people's work,
// is dropped here.
type QueueRow = { number: number; id: string }

function queueRows(rows: unknown[][]): QueueRow[] {
  const kept: QueueRow[] = []
  for (const [number, id] of rows) {
    if (typeof number === 'number' && typeof id === 'string') {
      kept.push({ number, id: id.slice(0, MAX_SERVER_NAME_CHARS) })
    }
  }
  return kept.sort((a, b) => a.number - b.number)
}

export const queueAnswer = z
  .object({
    queue_running: z.array(z.array(z.unknown())),
    queue_pending: z.array(z.array(z.unknown())),
  })
  .transform((a) => ({
    running: queueRows(a.queue_running).map((r) => r.id),
    pending: queueRows(a.queue_pending).map((r) => r.id),
  }))

export type FileRef = { filename?: string; subfolder?: string; type?: string }

function fileRef(item: Record<string, unknown>): FileRef {
  const ref: FileRef = {}
  for (const key of ['filename', 'subfolder', 'type'] as const) {
    const value = textField(item[key], MAX_SERVER_NAME_CHARS)
    if (value !== undefined) ref[key] = value
  }
  return ref
}

function outputLists(lists: Record<string, unknown>): Record<string, FileRef[]> {
  const kept: Record<string, FileRef[]> = {}
  for (const [list, items] of Object.entries(lists)) {
    if (Array.isArray(items)) kept[list] = items.filter(isObject).map(fileRef)
  }
  return kept
}

export type RunMessage = { type: string; exceptionType?: string; exceptionMessage?: string }

// A message is [type, data]. Of the data, only an exception's type and text are kept: never
// the traceback, which holds paths on the server's computer.
function runMessage(message: unknown): RunMessage[] {
  if (!Array.isArray(message) || typeof message[0] !== 'string') return []
  const kept: RunMessage = { type: message[0].slice(0, MAX_SERVER_NAME_CHARS) }
  const data: unknown = message[1]
  if (isObject(data)) {
    const exceptionType = textField(data.exception_type, MAX_SERVER_TEXT_CHARS)
    const exceptionMessage = textField(data.exception_message, MAX_SERVER_TEXT_CHARS)
    if (exceptionType !== undefined) kept.exceptionType = exceptionType
    if (exceptionMessage !== undefined) kept.exceptionMessage = exceptionMessage
  }
  return [kept]
}

const historyEntry = z
  .object({
    status: z
      .object({
        status_str: name.optional(),
        completed: z.boolean().optional(),
        messages: z.array(z.unknown()).default([]),
      })
      .optional(),
    outputs: z.record(z.string(), z.record(z.string(), z.unknown())).default({}),
  })
  .transform((e) => ({
    ...(e.status && {
      status: {
        ...(e.status.status_str !== undefined && { statusStr: e.status.status_str }),
        ...(e.status.completed !== undefined && { completed: e.status.completed }),
        messages: e.status.messages.flatMap(runMessage),
      },
    }),
    outputs: Object.fromEntries(
      Object.entries(e.outputs).map(([node, lists]) => [node, outputLists(lists)]),
    ),
  }))

export type HistoryEntry = z.infer<typeof historyEntry>

export const historyAnswer = z.record(z.string(), historyEntry)

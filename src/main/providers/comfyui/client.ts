// SPEC 6.10.2 [REQ: FR-271, FR-274, FR-277, FR-289] (security class): the only code that
// talks to a ComfyUI server. One function per call of the 6.10.2 table and no general one;
// no function takes an address or a path. Calls that could take away the server's work or
// files do not exist here (the source-text test holds this).
import { randomUUID } from 'node:crypto'
import type { z } from 'zod'
import type { ProviderErrorReason } from '@/shared/schemas/queries/app'
import {
  historyAnswer,
  jobStateAnswer,
  modelFilesAnswer,
  nodeInfoAnswer,
  queueAnswer,
  submitAnswer,
  systemStatsAnswer,
  uploadAnswer,
  type HistoryEntry,
} from './answers'
import { DOWNLOAD_MS, MAX_COMFY_JSON_BYTES, SHORT_CALL_MS, UPLOAD_MS } from './limits'
import { ComfyRefused, readRefusal } from './refusal'
import { failure, openConnection, send, type Answer, type Call } from './request'
import { uploadForm } from './upload-form'
import {
  isFileName,
  isPromptId,
  isSubfolder,
  isViewType,
  uploadName,
  type ViewType,
} from './values'

// SPEC 14 1.43 R2-1. The class's value export from this file is held: the existing test that
// this module's only runtime export is createComfyClient would fail. Import it from ./refusal.
export type { ComfyRefused, NodeRefusal, ServerRefusal } from './refusal'

export type ViewRef = { filename: string; subfolder: string; type: ViewType }

export type ComfyClient = {
  systemStats(): Promise<z.output<typeof systemStatsAnswer>>
  modelFiles(folder: string): Promise<string[] | null>
  nodeInfo(classType: string): Promise<boolean>
  uploadImage(name: string, bytes: Uint8Array): Promise<{ name: string; subfolder: string }>
  submit(
    promptId: string,
    graph: Record<string, unknown>,
  ): Promise<{ promptId: string; number: number }>
  history(promptId: string): Promise<HistoryEntry | null>
  jobState(promptId: string): Promise<{ status: string } | null>
  queueIds(): Promise<{ running: string[]; pending: string[] }>
  removeFromQueue(promptId: string): Promise<void>
  interrupt(promptId: string): Promise<void>
  viewFile(ref: ViewRef, maxBytes: number): Promise<Uint8Array>
  // Hands the client an ID from a job row, so removeFromQueue and interrupt may name it.
  adopt(promptId: string): void
}

const JSON_TYPE = 'application/json'

function refused(detail: string): never {
  throw failure('other', undefined, detail)
}

function checkedId(promptId: string): string {
  return isPromptId(promptId) ? promptId : refused('Not a prompt ID')
}

function jsonBody(value: unknown): Call['body'] {
  return { type: JSON_TYPE, bytes: Buffer.from(JSON.stringify(value)) }
}

function read<S extends z.ZodType>(answer: Answer, schema: S, bad: ProviderErrorReason) {
  let value: unknown
  try {
    value = JSON.parse(answer.bytes.toString('utf8'))
  } catch {
    throw failure('other', bad, 'The answer is not JSON')
  }
  const parsed = schema.safeParse(value)
  if (!parsed.success) throw failure('other', bad, 'The answer has the wrong shape')
  return parsed.data as z.output<S>
}

function unexpected(answer: Answer, reason?: ProviderErrorReason): never {
  throw failure('other', reason, `HTTP ${answer.status}`)
}

const ok = (answer: Answer) => answer.status >= 200 && answer.status < 300

export function createComfyClient(options: {
  origin: string
  ownPorts: () => readonly number[]
}): ComfyClient {
  const conn = openConnection(options.origin, options.ownPorts)
  const clientId = randomUUID()
  const ownIds = new Set<string>()

  const call = (method: Call['method'], path: string, more: Partial<Call> = {}) =>
    send(conn, {
      method,
      path,
      accept: JSON_TYPE,
      maxBytes: MAX_COMFY_JSON_BYTES,
      totalMs: SHORT_CALL_MS,
      badAnswer: 'bad_result',
      ...more,
    })

  const getJson = async <S extends z.ZodType>(path: string, schema: S) => {
    const answer = await call('GET', path)
    if (answer.status === 404) return null
    return ok(answer) ? read(answer, schema, 'bad_result') : unexpected(answer)
  }

  const postOwn = async (promptId: string, path: string, body: unknown) => {
    if (!ownIds.has(promptId)) refused('Not an ID this app submitted')
    const answer = await call('POST', path, { body: jsonBody(body) })
    if (!ok(answer)) unexpected(answer)
  }

  return {
    async systemStats() {
      const answer = await call('GET', '/system_stats', { badAnswer: 'not_comfyui' })
      if (!ok(answer)) unexpected(answer, 'not_comfyui')
      return read(answer, systemStatsAnswer, 'not_comfyui')
    },
    modelFiles: (folder) => getJson(`/models/${encodeURIComponent(folder)}`, modelFilesAnswer),
    async nodeInfo(classType) {
      const found = await getJson(`/object_info/${encodeURIComponent(classType)}`, nodeInfoAnswer)
      return found !== null && Object.hasOwn(found, classType)
    },
    async uploadImage(name, bytes) {
      if (name !== uploadName(bytes)) refused('Not the name the app gives these bytes')
      const body = uploadForm(name, bytes)
      const answer = await call('POST', '/upload/image', { body, totalMs: UPLOAD_MS })
      if (!ok(answer)) unexpected(answer)
      const kept = read(answer, uploadAnswer, 'bad_result')
      if (!isFileName(kept.name) || !isSubfolder(kept.subfolder)) {
        throw failure('other', 'bad_result', 'The upload answer holds a name the app cannot use')
      }
      return kept
    },
    async submit(promptId, graph) {
      ownIds.add(checkedId(promptId))
      const body = jsonBody({ prompt: graph, prompt_id: promptId, client_id: clientId })
      const answer = await call('POST', '/prompt', { body, refusedStatus: 400 })
      if (answer.status === 400) throw new ComfyRefused(readRefusal(answer.bytes))
      if (!ok(answer)) unexpected(answer)
      const submitted = read(answer, submitAnswer, 'bad_result')
      // The ID in the server's answer is the one used from then on.
      ownIds.add(submitted.promptId)
      return submitted
    },
    async history(promptId) {
      const found = await getJson(`/history/${checkedId(promptId)}`, historyAnswer)
      return found?.[promptId] ?? null
    },
    jobState: async (promptId) => getJson(`/api/jobs/${checkedId(promptId)}`, jobStateAnswer),
    async queueIds() {
      const answer = await call('GET', '/queue')
      return ok(answer) ? read(answer, queueAnswer, 'bad_result') : unexpected(answer)
    },
    removeFromQueue: (promptId) => postOwn(promptId, '/queue', { delete: [promptId] }),
    interrupt: (promptId) => postOwn(promptId, '/interrupt', { prompt_id: promptId }),
    async viewFile(ref, maxBytes) {
      if (!isFileName(ref.filename) || !isSubfolder(ref.subfolder) || !isViewType(ref.type)) {
        throw failure('other', 'bad_result', 'The file reference is not one the app can use')
      }
      const query = (['filename', 'subfolder', 'type'] as const)
        .map((key) => `${key}=${encodeURIComponent(ref[key])}`)
        .join('&')
      const answer = await call('GET', `/view?${query}`, {
        accept: '*/*',
        maxBytes,
        totalMs: DOWNLOAD_MS,
      })
      return ok(answer) ? new Uint8Array(answer.bytes) : unexpected(answer)
    },
    adopt(promptId) {
      ownIds.add(checkedId(promptId))
    },
  }
}

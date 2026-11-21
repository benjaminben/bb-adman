// SPEC 6.10.6 steps 5 to 7 (security class): one submission of a filled shipped workflow,
// polled until it ends, and its picture fetched. The result is read only at the workflow's
// own outputNode key; no node key or list name from the server is stored, logged or sent
// on (14 1.43 D-05). Every ID sent to or answered by submit joins the own-ID set (K-7).
import { fitSize } from '../../../shared/comfy/fit-size'
import { MAX_PICTURE_BYTES } from '../picture-limits'
import { pictureType } from '../picture-type'
import { ProviderCancelled, type ImageResult, type RunOptions } from '../types'
import type { HistoryEntry } from './answers'
import type { ComfyClient, ViewRef } from './client'
import { cancelOwnRun } from './cancel'
import { comfyFailure, refusedFailure, runFailure } from './failures'
import type { FillValues } from './fill'
import { fillWorkflow } from './fill'
import { rememberOwnId } from './own-ids'
import { PollStopped, pollRun, throughBreaks } from './poll'
import { ComfyRefused } from './refusal'
import { isViewType } from './values'
import type { WorkflowSpec } from './workflows/types'

// The adapter's clock and waits, and the maker of prompt IDs. Tests hand in their own.
export type RunTiming = {
  now(): number
  sleep(ms: number, signal?: AbortSignal): Promise<void>
  newId(): string
}

export type RunAsk = { prompt: string; width: number; height: number; references: string[] }

// [1.45] B-4: the fill values come from the workflow's own slots, and a key is set only when
// the slot is there. [1.46] A workflow with no width slot skips fitSize.
export function fillValuesFor(spec: WorkflowSpec, ask: RunAsk, promptId: string): FillValues {
  const { slots } = spec
  const values: FillValues = { prompt: ask.prompt }
  if (slots.width && slots.height) {
    const size = fitSize({ width: ask.width, height: ask.height }, spec.size)
    values.width = size.width
    values.height = size.height
  }
  if (slots.references) values.references = ask.references
  if (slots.outputPrefix) values.promptId = promptId
  return values
}

function endedEntry(entry: HistoryEntry): void {
  const messages = entry.status?.messages ?? []
  if (entry.status?.statusStr === 'error' || messages.some((m) => m.type === 'execution_error')) {
    throw runFailure(messages)
  }
  if (messages.some((m) => m.type === 'execution_interrupted')) {
    throw comfyFailure('server_stopped', 'The run was interrupted on the server')
  }
}

// SPEC 6.10.6 step 7: the first item that has filename, subfolder and type, under whichever
// list name it sits (U-2).
function resultRef(spec: WorkflowSpec, entry: HistoryEntry): ViewRef {
  const lists = entry.outputs[spec.slots.outputNode] ?? {}
  for (const items of Object.values(lists)) {
    for (const item of items) {
      const { filename, subfolder, type } = item
      if (filename !== undefined && subfolder !== undefined && type !== undefined) {
        if (isViewType(type)) return { filename, subfolder, type }
        throw comfyFailure('bad_result', 'The result is not a file the app can fetch')
      }
    }
  }
  throw comfyFailure('bad_result', 'The run left no picture the app can fetch')
}

export type RunEnv = {
  client: ComfyClient
  timing: RunTiming
  serverVersion: string | undefined
}

async function submitted(env: RunEnv, graph: Record<string, unknown>, promptId: string) {
  rememberOwnId(promptId)
  try {
    const answer = await env.client.submit(promptId, graph)
    rememberOwnId(answer.promptId)
    return answer.promptId
  } catch (e) {
    if (e instanceof ComfyRefused) throw refusedFailure(e)
    throw e
  }
}

export async function runPicture(
  env: RunEnv,
  spec: WorkflowSpec,
  ask: RunAsk,
  opts: RunOptions = {},
): Promise<ImageResult> {
  const sentId = env.timing.newId()
  const graph = fillWorkflow(spec, fillValuesFor(spec, ask, sentId))
  if (opts.signal?.aborted) throw new ProviderCancelled()
  const promptId = await submitted(env, graph, sentId)
  try {
    const entry = await pollRun(env.client, promptId, env.timing, opts)
    endedEntry(entry)
    const ref = resultRef(spec, entry)
    const bytes = await throughBreaks(
      env.timing,
      () => env.client.viewFile(ref, MAX_PICTURE_BYTES),
      opts.signal,
    )
    const mime = pictureType(bytes)
    if (!mime) throw comfyFailure('bad_result', 'The result is not a PNG or JPEG')
    // [1.53] G-1: the details come from the shipped workflow file, never from the server.
    const details = {
      models: spec.needs.models.map((m) => m.file),
      workflow: { id: spec.id, version: spec.version },
    }
    return { bytes, mime, model: spec.model.mainFile, details }
  } catch (e) {
    if (!(e instanceof PollStopped)) throw e
    await cancelOwnRun(env.client, promptId, env.serverVersion)
    throw new ProviderCancelled()
  }
}

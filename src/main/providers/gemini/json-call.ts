// spec/providers-adapters.md "Layout and text": one generateContent call with a JSON answer,
// shared by layout and text. Same pinned client and error mapping as pictures; no retry.
// The model's answer is untrusted data: it is parsed and checked, never run, never used as a
// path, never logged, and never put in a failure's detail.
import type { GenerateContentResponse, Part, Schema } from '@google/genai'
import { redactSecret } from '@/main/providers/redact'
import { ProviderCancelled, ProviderFailure, type AdapterContext } from '@/main/providers/types'
import type { RunOptions } from '@/main/providers/types'
import { failureFromError } from './failure'
import { pinnedClient, type Transport } from './image'

export const TEXT_TIMEOUT_MS = 60_000
export const NOT_THE_ASKED_JSON = 'Answer is not the asked JSON'

// Finish reasons that mean the provider's content rules stopped a text answer.
const REFUSED_FINISH = new Set(['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'RECITATION'])

export type JsonCall<T> = {
  job: 'layout' | 'text'
  parts: Part[]
  responseSchema: Schema
  // Gives the checked value, or null when the parsed JSON is not the asked shape.
  read: (value: unknown) => T | null
}

function whenAborted(signal: AbortSignal): Promise<never> {
  return new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('aborted')))
  })
}

function fail(kind: 'refused' | 'other', detail: string, key: string): ProviderFailure {
  return new ProviderFailure({ kind, detail: redactSecret(detail, key) })
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

// The checked value of the first text part of the first candidate, or the failure the
// answer describes. A thought part is not the answer.
function valueFrom<T>(response: GenerateContentResponse, call: JsonCall<T>, key: string): T {
  const blocked = response.promptFeedback?.blockReason
  if (blocked) throw fail('refused', `Prompt blocked: ${blocked}`, key)
  const candidate = response.candidates?.[0]
  const finish = candidate?.finishReason ?? 'none'
  if (REFUSED_FINISH.has(finish)) throw fail('refused', `Answer stopped: ${finish}`, key)
  const part = candidate?.content?.parts?.find((p) => typeof p.text === 'string' && !p.thought)
  const parsed = part?.text === undefined ? undefined : parseJson(part.text)
  const value = parsed === undefined ? null : call.read(parsed)
  if (value === null) throw fail('other', NOT_THE_ASKED_JSON, key)
  return value
}

// Reading the secret and the model and building the client happen inside the `try`, so any
// error they throw also leaves as a ProviderFailure. The run's signal stops the call with
// ProviderCancelled; a signal already aborted sends nothing.
export async function jsonCall<T>(
  ctx: AdapterContext,
  transport: Transport,
  call: JsonCall<T>,
  opts: RunOptions = {},
): Promise<T> {
  const cancelled = () => opts.signal?.aborted === true
  if (cancelled()) throw new ProviderCancelled()
  let key = ''
  const timer = new AbortController()
  const handle = setTimeout(() => timer.abort(), TEXT_TIMEOUT_MS)
  const onCancel = () => timer.abort()
  opts.signal?.addEventListener('abort', onCancel)
  try {
    key = ctx.secret('gemini.apiKey')
    const model = ctx.model(call.job)
    const request = pinnedClient(key, transport).models.generateContent({
      model,
      contents: [{ role: 'user', parts: call.parts }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: call.responseSchema,
        abortSignal: timer.signal,
      },
    })
    const response = await Promise.race([request, whenAborted(timer.signal)])
    return valueFrom(response, call, key)
  } catch (error) {
    if (cancelled()) throw new ProviderCancelled()
    if (error instanceof ProviderFailure) throw error
    throw failureFromError(error, timer.signal.aborted, key)
  } finally {
    clearTimeout(handle)
    opts.signal?.removeEventListener('abort', onCancel)
  }
}

// SPEC 6.2 slice E: ImageProvider.generate through @google/genai generateContent.
// One call per picture, two at a time. No automatic retry (SPEC 6 retry rule): the SDK
// retries only when retryOptions is set, and it is never set here.
import { GoogleGenAI } from '@google/genai'
import { ProviderCancelled, ProviderFailure } from '@/main/providers/types'
import type { AdapterContext, ImageFile, ImageProvider, ImageResult } from '@/main/providers/types'
import { nearestAspectRatio } from './aspect-ratio'
import { failureFromError, pictureFromResponse } from './failure'
import { GEMINI_ORIGIN, pinnedFetch } from './pinned-origin'

export const IMAGE_TIMEOUT_MS = 120_000
// The library's own default for the Gemini API in @google/genai 3.6.1, pinned so the
// environment cannot change it. Shared with json-call.ts.
export const GEMINI_API_VERSION = 'v1'
const AT_ONCE = 2

// Tests hand in a fetch that answers with recorded responses. It is wrapped like the real one.
export type Transport = { fetch?: typeof fetch }

// The library is given every setting it would otherwise fill from the environment (SPEC 6
// [1.12], 6.2 O-1): the key, the mode, the address and the API version (GOOGLE_GENAI_API_VERSION
// would change the path). GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION are still read by the
// library and cannot be switched off, but the Gemini API mode does not use them. Shared with
// json-call.ts.
export function pinnedClient(key: string, transport: Transport): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: key,
    vertexai: false,
    apiVersion: GEMINI_API_VERSION,
    httpOptions: { baseUrl: GEMINI_ORIGIN, fetch: pinnedFetch(transport.fetch ?? fetch) },
  })
}

type OneCall = { prompt: string; references: ImageFile[]; width: number; height: number }

function toPart(file: ImageFile) {
  return { inlineData: { mimeType: file.mime, data: Buffer.from(file.bytes).toString('base64') } }
}

// Rejects when the signal aborts, so the time limit holds even if the SDK ignored it.
function whenAborted(signal: AbortSignal): Promise<never> {
  return new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('aborted')))
  })
}

// Reading the secret and the model and building the client happen inside the `try`, so any
// error they throw also leaves as a ProviderFailure (SPEC 6 [1.12]). A run signal (extend
// only) stops the call with ProviderCancelled; one already aborted sends nothing.
async function oneCall(
  ctx: AdapterContext,
  transport: Transport,
  call: OneCall,
  signal?: AbortSignal,
): Promise<ImageResult> {
  const cancelled = () => signal?.aborted === true
  if (cancelled()) throw new ProviderCancelled()
  let key = ''
  const timer = new AbortController()
  const handle = setTimeout(() => timer.abort(), IMAGE_TIMEOUT_MS)
  const onCancel = () => timer.abort()
  signal?.addEventListener('abort', onCancel)
  try {
    key = ctx.secret('gemini.apiKey')
    const model = ctx.model('image')
    const client = pinnedClient(key, transport)
    const request = client.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: call.prompt }, ...call.references.map(toPart)] }],
      config: {
        responseModalities: ['IMAGE'],
        imageConfig: { aspectRatio: nearestAspectRatio(call.width, call.height) },
        abortSignal: timer.signal,
      },
    })
    const response = await Promise.race([request, whenAborted(timer.signal)])
    return { ...pictureFromResponse(response, key), model }
  } catch (error) {
    if (cancelled()) throw new ProviderCancelled()
    if (error instanceof ProviderFailure) throw error
    throw failureFromError(error, timer.signal.aborted, key)
  } finally {
    clearTimeout(handle)
    signal?.removeEventListener('abort', onCancel)
  }
}

// Runs `count` calls with at most AT_ONCE in flight. After a failure no new call starts;
// the first failure is thrown once the calls already sent have finished.
async function runPool(count: number, run: () => Promise<ImageResult>): Promise<ImageResult[]> {
  const results: ImageResult[] = []
  let started = 0
  let failure: unknown
  async function worker() {
    while (started < count && failure === undefined) {
      started += 1
      try {
        results.push(await run())
      } catch (error) {
        failure ??= error
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(AT_ONCE, count) }, worker))
  if (failure !== undefined) throw failure
  return results
}

export function geminiImage(ctx: AdapterContext, transport: Transport = {}): ImageProvider {
  return {
    generate: (input) => runPool(input.count, () => oneCall(ctx, transport, input)),
    // spec/providers-adapters.md "Picture extend" (A-128): no canvas. The picture goes as it
    // is, as the one picture part, with the target's nearest ratio; `placement` is not sent.
    extend: (input, opts) =>
      oneCall(
        ctx,
        transport,
        {
          prompt: input.prompt,
          references: [input.image],
          width: input.width,
          height: input.height,
        },
        opts?.signal,
      ),
  }
}

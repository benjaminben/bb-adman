// P4-6, spec/providers-adapters.md "Adobe Firefly (stub)": ImageProvider.generate written from
// Adobe's public Firefly documentation. Never called at run time: the registry row has
// `available: false`, so adapterFor refuses it. The steps: a token from the sign-in host;
// POST /v3/images/generate-async on the Firefly API host; check the job's status until it has
// succeeded; fetch each picture from the picture host, with no credentials.
// No automatic retry (spec/providers.md "Retry rule"): checking a started job's status is not a
// repeat of the paid call.
import { pictureType } from '@/main/providers/picture-type'
import { ProviderFailure, type AdapterContext, type ImageProvider } from '@/main/providers/types'
import type { ImageResult } from '@/main/providers/types'
import { fail, failureFromAnswer, failureFromError, kindForCode } from './failure'
import { FIREFLY_API_ORIGIN, pinnedFetch } from './pinned-origin'
import { requestToken } from './token'

export const IMAGE_TIMEOUT_MS = 120_000
export const POLL_MS = 2_000
// numVariations is 1 to 4 in Adobe's published OpenAPI file.
export const MAX_VARIATIONS = 4
// The registry row has no default model and the call sends no model header, so the result
// names the API it came from.
export const FIREFLY_IMAGE_MODEL = 'firefly-v3'
const GENERATE_PATH = '/v3/images/generate-async'

// The sizes Adobe's published OpenAPI file lists for a generated picture.
const SIZES = [
  { width: 2048, height: 2048 },
  { width: 2304, height: 1792 },
  { width: 1792, height: 2304 },
  { width: 2688, height: 1536 },
]

export function nearestSize(width: number, height: number): { width: number; height: number } {
  const wanted = Math.log(width / height)
  const gap = (size: { width: number; height: number }) =>
    Math.abs(Math.log(size.width / size.height) - wanted)
  return SIZES.reduce((best, size) => (gap(size) < gap(best) ? size : best))
}

// Tests hand in a fetch that answers with recorded answers, and a wait that does not wait.
export type Transport = {
  fetch?: typeof fetch
  wait?: (ms: number) => Promise<void>
}

type Run = {
  api: typeof fetch
  picture: typeof fetch
  wait: (ms: number) => Promise<void>
  headers: Record<string, string>
  signal: AbortSignal
  secrets: string[]
}

type Status = { status?: unknown; error_code?: unknown; result?: { outputs?: unknown } }

async function readJson(response: Response, secrets: string[]): Promise<unknown> {
  const text = await response.text()
  if (!response.ok) throw failureFromAnswer(response.status, text, secrets)
  return JSON.parse(text) as unknown
}

async function submit(run: Run, prompt: string, count: number, size: object): Promise<string> {
  const response = await run.api(`${FIREFLY_API_ORIGIN}${GENERATE_PATH}`, {
    method: 'POST',
    headers: { ...run.headers, 'content-type': 'application/json' },
    body: JSON.stringify({ prompt, numVariations: count, size }),
    signal: run.signal,
  })
  const { statusUrl } = (await readJson(response, run.secrets)) as { statusUrl?: unknown }
  if (typeof statusUrl !== 'string') throw fail('other', 'No status address in the answer', [])
  return statusUrl
}

function pictureAddresses(outputs: unknown): string[] {
  const list = Array.isArray(outputs) ? (outputs as Array<{ image?: { url?: unknown } }>) : []
  const urls = list.map((output) => output.image?.url)
  if (urls.length === 0 || urls.some((url) => typeof url !== 'string')) {
    throw fail('other', 'No picture address in the finished job', [])
  }
  return urls as string[]
}

// Checks the job until it has succeeded, failed or been cancelled.
async function finished(run: Run, statusUrl: string): Promise<string[]> {
  for (;;) {
    const response = await run.api(statusUrl, { headers: run.headers, signal: run.signal })
    const body = (await readJson(response, run.secrets)) as Status
    if (body.status === 'succeeded') return pictureAddresses(body.result?.outputs)
    if (body.status === 'failed' || body.status === 'canceled') {
      const code = typeof body.error_code === 'string' ? body.error_code : undefined
      throw fail(kindForCode(code), `Job ${String(body.status)}: ${code ?? 'no code'}`, run.secrets)
    }
    await run.wait(POLL_MS)
  }
}

async function download(run: Run, address: string): Promise<ImageResult> {
  const response = await run.picture(address, { signal: run.signal })
  if (!response.ok) throw failureFromAnswer(response.status, '', run.secrets)
  const bytes = new Uint8Array(await response.arrayBuffer())
  const mime = pictureType(bytes)
  if (!mime) throw fail('other', 'Picture is not a PNG or JPEG', [])
  return { bytes, mime, model: FIREFLY_IMAGE_MODEL }
}

// Rejects when the signal aborts, so the time limit holds while waiting between checks.
function whenAborted(signal: AbortSignal): Promise<never> {
  return new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('aborted')))
  })
}

type Input = Parameters<ImageProvider['generate']>[0]

async function generate(ctx: AdapterContext, transport: Transport, input: Input) {
  const secrets: string[] = []
  const timer = new AbortController()
  const handle = setTimeout(() => timer.abort(), IMAGE_TIMEOUT_MS)
  try {
    if (input.references.length > 0) {
      throw fail('other', 'Reference pictures are not built for Firefly', [])
    }
    const clientId = ctx.secret('firefly.clientId')
    secrets.push(clientId)
    const clientSecret = ctx.secret('firefly.clientSecret')
    secrets.push(clientSecret)
    const inner = transport.fetch ?? fetch
    const work = async () => {
      const token = await requestToken(inner, { clientId, clientSecret }, timer.signal)
      secrets.push(token)
      const run: Run = {
        api: pinnedFetch('api', inner),
        picture: pinnedFetch('picture', inner),
        wait: transport.wait ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
        headers: {
          'x-api-key': clientId,
          authorization: `Bearer ${token}`,
          accept: 'application/json',
        },
        signal: timer.signal,
        secrets,
      }
      const size = nearestSize(input.width, input.height)
      const results: ImageResult[] = []
      for (let left = input.count; left > 0; left -= MAX_VARIATIONS) {
        const statusUrl = await submit(run, input.prompt, Math.min(left, MAX_VARIATIONS), size)
        for (const address of await finished(run, statusUrl)) {
          results.push(await download(run, address))
        }
      }
      return results
    }
    const working = work()
    // After the time limit the work may still fail; that later failure is not reported.
    working.catch(() => undefined)
    return await Promise.race([working, whenAborted(timer.signal)])
  } catch (error) {
    throw failureFromError(error, timer.signal.aborted, secrets)
  } finally {
    clearTimeout(handle)
  }
}

export function fireflyImage(ctx: AdapterContext, transport: Transport = {}): ImageProvider {
  return {
    generate: (input) => generate(ctx, transport, input),
    extend: async () => {
      throw new ProviderFailure({ kind: 'other', detail: 'Image extend is not built for Firefly' })
    },
  }
}

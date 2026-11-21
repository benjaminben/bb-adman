import { afterEach, describe, it, expect, vi } from 'vitest'
import {
  FIREFLY_IMAGE_MODEL,
  IMAGE_TIMEOUT_MS,
  POLL_MS,
  fireflyImage,
  nearestSize,
} from '@/main/providers/firefly/image'
import { ProviderFailure } from '@/main/providers/types'
import {
  PNG_1X1,
  TEST_CLIENT_ID,
  TEST_CLIENT_SECRET,
  TEST_TOKEN,
  fireflyAnswering,
  jsonResponse,
  noWait,
  recorded,
  recordedError,
  testContext,
  type SeenRequest,
} from './recorded'

const input = { prompt: 'A red bicycle', references: [], width: 1080, height: 1080, count: 1 }

function at(seen: SeenRequest[], host: string): SeenRequest[] {
  return seen.filter((request) => new URL(request.url).host === host)
}

async function failureOf(run: Promise<unknown>): Promise<ProviderFailure> {
  const error = await run.then(
    () => undefined,
    (e: unknown) => e,
  )
  expect(error).toBeInstanceOf(ProviderFailure)
  return error as ProviderFailure
}

describe('Firefly picture generation, recorded answers [P4-6]', () => {
  afterEach(() => vi.useRealTimers())

  it('sends the generate request to the Firefly API host with the token and client ID', async () => {
    const { fetchFn, seen } = fireflyAnswering()
    const results = await fireflyImage(testContext(), { fetch: fetchFn, wait: noWait }).generate(
      input,
    )
    expect(results).toEqual([{ bytes: PNG_1X1, mime: 'image/png', model: FIREFLY_IMAGE_MODEL }])
    const [submit, status] = at(seen, 'firefly-api.adobe.io')
    expect(submit?.url).toBe('https://firefly-api.adobe.io/v3/images/generate-async')
    expect(submit?.method).toBe('POST')
    expect(submit?.headers.get('x-api-key')).toBe(TEST_CLIENT_ID)
    expect(submit?.headers.get('authorization')).toBe(`Bearer ${TEST_TOKEN}`)
    expect(submit?.headers.get('content-type')).toBe('application/json')
    expect(JSON.parse(submit?.body ?? '')).toEqual({
      prompt: 'A red bicycle',
      numVariations: 1,
      size: { width: 2048, height: 2048 },
    })
    expect(status?.url).toBe(
      (recorded('generate-accepted.json') as { statusUrl: string }).statusUrl,
    )
    expect(status?.method).toBe('GET')
    expect(status?.headers.get('authorization')).toBe(`Bearer ${TEST_TOKEN}`)
  })

  it('fetches the picture from the picture host and sends it no credentials', async () => {
    const { fetchFn, seen } = fireflyAnswering()
    await fireflyImage(testContext(), { fetch: fetchFn, wait: noWait }).generate(input)
    const pictures = at(seen, 'pre-signed-firefly-prod.s3-accelerate.amazonaws.com')
    expect(pictures).toHaveLength(1)
    expect(pictures[0]?.headers.get('authorization')).toBeNull()
    expect(pictures[0]?.headers.get('x-api-key')).toBeNull()
    expect(seen).toHaveLength(4)
  })

  it('checks the job again, waiting between checks, until it has succeeded', async () => {
    const running = jsonResponse(recorded('status-running.json'))
    const done = jsonResponse(recorded('status-succeeded.json'))
    const { fetchFn, seen } = fireflyAnswering({ statuses: [running, running.clone(), done] })
    const waits: number[] = []
    const wait = async (ms: number) => {
      waits.push(ms)
    }
    await fireflyImage(testContext(), { fetch: fetchFn, wait }).generate(input)
    expect(seen.filter((r) => r.url.includes('/v3/status/'))).toHaveLength(3)
    expect(waits).toEqual([POLL_MS, POLL_MS])
  })

  it('asks for at most four variations per job', async () => {
    const { fetchFn, seen } = fireflyAnswering()
    await fireflyImage(testContext(), { fetch: fetchFn, wait: noWait }).generate({
      ...input,
      count: 6,
    })
    const asked = seen
      .filter((r) => r.url.endsWith('/generate-async'))
      .map((r) => (JSON.parse(r.body) as { numVariations: number }).numVariations)
    expect(asked).toEqual([4, 2])
  })

  it.each([
    [1080, 1080, 2048, 2048],
    [1920, 1080, 2688, 1536],
    [1200, 900, 2304, 1792],
    [1080, 1350, 1792, 2304],
  ])('picks the documented size nearest %i x %i', (width, height, w, h) => {
    expect(nearestSize(width, height)).toEqual({ width: w, height: h })
  })

  it.each([
    ['400', 400, 'other'],
    ['403', 403, 'bad_key'],
    ['408', 408, 'timeout'],
    ['422-prompt', 422, 'refused'],
    ['422-input', 422, 'refused'],
    ['422-output', 422, 'refused'],
    ['422-validation', 422, 'other'],
    ['500', 500, 'other'],
    ['503', 503, 'other'],
  ] as const)('maps the recorded %s error (HTTP %i) to %s', async (key, status, kind) => {
    const { fetchFn } = fireflyAnswering({ submit: () => jsonResponse(recordedError(key), status) })
    const failure = await failureOf(
      fireflyImage(testContext(), { fetch: fetchFn, wait: noWait }).generate(input),
    )
    expect(failure.error.kind).toBe(kind)
    expect(failure.error.detail).toContain(String(status))
  })

  it.each([
    [
      'a failed job with an unsafe-output code',
      { ...(recorded('status-failed.json') as object) },
      'refused',
    ],
    ['a cancelled job', { status: 'canceled', jobId: 'made-up' }, 'other'],
    [
      'a succeeded job with no outputs',
      { status: 'succeeded', jobId: 'made-up', result: {} },
      'other',
    ],
  ] as const)('maps %s to %s', async (_case, body, kind) => {
    const { fetchFn } = fireflyAnswering({ statuses: [jsonResponse(body)] })
    const failure = await failureOf(
      fireflyImage(testContext(), { fetch: fetchFn, wait: noWait }).generate(input),
    )
    expect(failure.error.kind).toBe(kind)
  })

  it('refuses a picture address on another host and never fetches it', async () => {
    const elsewhere = recorded('status-succeeded.json') as {
      result: { outputs: Array<{ image: { url: string } }> }
    }
    const first = elsewhere.result.outputs[0]
    if (first) first.image.url = 'https://pictures.example/made-up.png'
    const { fetchFn, seen } = fireflyAnswering({ statuses: [jsonResponse(elsewhere)] })
    const failure = await failureOf(
      fireflyImage(testContext(), { fetch: fetchFn, wait: noWait }).generate(input),
    )
    expect(failure.error.kind).toBe('other')
    expect(seen.some((r) => r.url.startsWith('https://pictures.example'))).toBe(false)
  })

  it('refuses a status address on another host and never sends the token there', async () => {
    const accepted = { jobId: 'made-up', statusUrl: 'https://status.example/v3/status/made-up' }
    const { fetchFn, seen } = fireflyAnswering({ submit: () => jsonResponse(accepted, 202) })
    const failure = await failureOf(
      fireflyImage(testContext(), { fetch: fetchFn, wait: noWait }).generate(input),
    )
    expect(failure.error.kind).toBe('other')
    expect(seen.some((r) => r.url.startsWith('https://status.example'))).toBe(false)
  })

  it('refuses a picture that is not a PNG or JPEG', async () => {
    const { fetchFn } = fireflyAnswering()
    const notPicture = async (address: RequestInfo | URL, init?: RequestInit) =>
      String(address).includes('pre-signed') ? new Response('<html>') : fetchFn(address, init)
    const failure = await failureOf(
      fireflyImage(testContext(), { fetch: notPicture, wait: noWait }).generate(input),
    )
    expect(failure.error.kind).toBe('other')
  })

  it('refuses reference pictures before anything is sent', async () => {
    const { fetchFn, seen } = fireflyAnswering()
    const references = [{ bytes: PNG_1X1, mime: 'image/png' }]
    const failure = await failureOf(
      fireflyImage(testContext(), { fetch: fetchFn, wait: noWait }).generate({
        ...input,
        references,
      }),
    )
    expect(failure.error.kind).toBe('other')
    expect(seen).toHaveLength(0)
  })

  it('removes the client secret, client ID and token from a detail that echoes them', async () => {
    const echo = {
      error_code: 'bad_request',
      message: `${TEST_TOKEN} ${TEST_CLIENT_SECRET} ${TEST_CLIENT_ID}`,
    }
    const { fetchFn } = fireflyAnswering({ submit: () => jsonResponse(echo, 400) })
    const failure = await failureOf(
      fireflyImage(testContext(), { fetch: fetchFn, wait: noWait }).generate(input),
    )
    for (const secret of [TEST_TOKEN, TEST_CLIENT_SECRET, TEST_CLIENT_ID]) {
      expect(failure.error.detail).not.toContain(secret)
    }
  })

  it('leaves a missing secret as kind other with nothing sent', async () => {
    const { fetchFn, seen } = fireflyAnswering()
    const ctx = {
      ...testContext(),
      secret: () => {
        throw new Error('Secret not saved: firefly.clientId')
      },
    }
    const failure = await failureOf(
      fireflyImage(ctx, { fetch: fetchFn, wait: noWait }).generate(input),
    )
    expect(failure.error.kind).toBe('other')
    expect(seen).toHaveLength(0)
  })

  it('ends as timeout when the job is still running at the time limit', async () => {
    vi.useFakeTimers()
    const { fetchFn } = fireflyAnswering({
      statuses: [jsonResponse(recorded('status-running.json'))],
    })
    const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
    const run = failureOf(fireflyImage(testContext(), { fetch: fetchFn, wait }).generate(input))
    await vi.advanceTimersByTimeAsync(IMAGE_TIMEOUT_MS)
    expect((await run).error.kind).toBe('timeout')
  })

  it('extend is not built', async () => {
    const extend = fireflyImage(testContext()).extend({
      image: { bytes: PNG_1X1, mime: 'image/png' },
      placement: { x: 0, y: 0, width: 1, height: 1, rotation: 0, crop: null },
      width: 1,
      height: 1,
      prompt: 'p',
    })
    expect((await failureOf(extend)).error.kind).toBe('other')
  })
})

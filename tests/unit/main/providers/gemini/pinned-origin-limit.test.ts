import { describe, it, expect } from 'vitest'
import { GEMINI_ORIGIN, isNetworkError, pinnedFetch } from '@/main/providers/gemini/pinned-origin'
import { MAX_PROVIDER_ANSWER_BYTES } from '@/main/providers/picture-limits'
import { ProviderFailure } from '@/main/providers/types'

const ADDRESS = `${GEMINI_ORIGIN}/v1/models/made-up-image-model:generateContent`
const LIMIT = 10

// A body handed out in the given chunks, one per read (no read ahead). It records how many
// chunks were asked for and whether the read was cancelled.
function chunkedBody(chunks: number[][]) {
  const state = { pulled: 0, cancelled: false }
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        const chunk = chunks[state.pulled]
        state.pulled += 1
        if (chunk === undefined) controller.close()
        else controller.enqueue(new Uint8Array(chunk))
      },
      cancel() {
        state.cancelled = true
      },
    },
    { highWaterMark: 0 },
  )
  return { state, stream }
}

function answering(stream: ReadableStream<Uint8Array>, headers: Record<string, string> = {}) {
  return async () => new Response(stream, { status: 200, headers })
}

async function failureOf(call: Promise<Response>): Promise<unknown> {
  return call.catch((error: unknown) => error)
}

describe('Gemini fetch wrapper answer limit [SPEC 6 1.20, 14 L1]', () => {
  it('has the 48 MiB limit of Section 6.2 as its default', () => {
    expect(MAX_PROVIDER_ANSWER_BYTES).toBe(50_331_648)
  })

  it('refuses a content-length over the limit and never reads the body', async () => {
    const { state, stream } = chunkedBody([[1, 2, 3]])
    const call = pinnedFetch(answering(stream, { 'content-length': '11' }), LIMIT)(ADDRESS)
    const error = await failureOf(call)
    expect(error).toBeInstanceOf(ProviderFailure)
    expect(error).toMatchObject({ error: { kind: 'other', detail: 'Answer too large' } })
    expect(isNetworkError(error)).toBe(false)
    expect(state.pulled).toBe(0)
  })

  it('refuses a body with no content-length once it passes the limit, and cancels the read', async () => {
    const { state, stream } = chunkedBody([[1, 2, 3, 4, 5, 6], [7, 8, 9, 10, 11], [12]])
    const error = await failureOf(pinnedFetch(answering(stream), LIMIT)(ADDRESS))
    expect(error).toBeInstanceOf(ProviderFailure)
    expect(error).toMatchObject({ error: { kind: 'other', detail: 'Answer too large' } })
    expect(isNetworkError(error)).toBe(false)
    expect(state.cancelled).toBe(true)
    expect(state.pulled).toBeLessThan(3)
  })

  it('refuses a body that passes the limit under a smaller content-length', async () => {
    const { stream } = chunkedBody([[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]])
    const call = pinnedFetch(answering(stream, { 'content-length': '3' }), LIMIT)(ADDRESS)
    await expect(call).rejects.toMatchObject({
      error: { kind: 'other', detail: 'Answer too large' },
    })
  })

  it('checks the size of an answer that has no body stream to count', async () => {
    const standIn = {
      status: 200,
      statusText: '',
      headers: new Headers(),
      arrayBuffer: async () => new ArrayBuffer(LIMIT + 1),
    }
    const call = pinnedFetch(async () => standIn as unknown as Response, LIMIT)(ADDRESS)
    await expect(call).rejects.toMatchObject({
      error: { kind: 'other', detail: 'Answer too large' },
    })
  })

  it('passes a body exactly at the limit through unchanged', async () => {
    const bytes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const { stream } = chunkedBody([bytes.slice(0, 4), bytes.slice(4)])
    const response = await pinnedFetch(answering(stream, { 'x-made-up': 'kept' }), LIMIT)(ADDRESS)
    expect(response.status).toBe(200)
    expect(response.headers.get('x-made-up')).toBe('kept')
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual(bytes)
  })
})

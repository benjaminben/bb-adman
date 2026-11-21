import { describe, expect, it } from 'vitest'
import { REDIRECT_REFUSED, pinnedFal } from '@/main/providers/fal-seedance/fal-fetch'
import { FAL_QUEUE_ORIGIN } from '@/main/providers/fal-seedance/origins'
import { falVideo } from '@/main/providers/fal-seedance/video'
import { MAX_VIDEO_BYTES } from '@/main/providers/picture-limits'
import { ProviderFailure } from '@/main/providers/types'
import {
  APP,
  MEDIA_URL,
  QUEUE,
  REQUEST_ID,
  TEST_KEY,
  clip,
  json,
  standIn,
  testContext,
  type Route,
} from './stand-in'

const resultAt = (url: string, media: Route = () => new Response(clip())): Route => {
  return (seen) => (seen.url === url ? media(seen) : json({ video: { url } }))
}

// A body that hands out the same 16 MiB chunk until the read is stopped.
function endless(): ReadableStream<Uint8Array> {
  const chunk = new Uint8Array(16 * 1024 * 1024)
  return new ReadableStream({ pull: (c) => c.enqueue(chunk) }, { highWaterMark: 0 })
}

describe('fal Seedance fetchResult [P7-14, phase-07 "Two origins"]', () => {
  it('gets the result from the queue, then the file from the media host with no header', async () => {
    const { fetchFn, seen } = standIn(resultAt(MEDIA_URL))
    const result = await falVideo(testContext(), { fetch: fetchFn }).fetchResult(REQUEST_ID)
    expect(result.mime).toBe('video/mp4')
    expect(result.bytes).toEqual(clip())
    expect(result.model).toBe(`${APP}/image-to-video`)
    const [answer, media] = seen
    expect(answer?.url).toBe(`${QUEUE}/${APP}/requests/${REQUEST_ID}`)
    expect(answer?.method).toBe('GET')
    expect(answer?.headers.get('authorization')).toBe(`Key ${TEST_KEY}`)
    expect(media?.url).toBe(MEDIA_URL)
    expect(media?.method).toBe('GET')
    expect([...(media?.headers.keys() ?? [])]).toEqual([])
    expect(media?.redirect).toBe('manual')
  })

  it.each([
    'https://files.example/clip.mp4',
    'http://v3.fal.media/files/clip.mp4',
    'https://fal.media.example/clip.mp4',
    'https://evilfal.media/clip.mp4',
    'https://user:pass@v3.fal.media/clip.mp4',
    'https://v3.fal.media:8443/clip.mp4',
    'https://queue.fal.run/files/clip.mp4',
    'not an address',
  ])('a result address of %s is refused before it is fetched', async (url) => {
    const { fetchFn, seen } = standIn(resultAt(url))
    const run = falVideo(testContext(), { fetch: fetchFn }).fetchResult(REQUEST_ID)
    await expect(run).rejects.toMatchObject({ error: { kind: 'other' } })
    expect(seen).toHaveLength(1)
  })

  it('a redirect from the media host is refused and not followed', async () => {
    const moved = () => new Response(null, { status: 302, headers: { location: MEDIA_URL } })
    const { fetchFn, seen } = standIn(resultAt(MEDIA_URL, moved))
    const run = falVideo(testContext(), { fetch: fetchFn }).fetchResult(REQUEST_ID)
    await expect(run).rejects.toMatchObject({ error: { kind: 'other', detail: REDIRECT_REFUSED } })
    expect(seen).toHaveLength(2)
  })

  it.each([
    {
      how: 'declared',
      media: () => new Response('x', { headers: { 'content-length': `${MAX_VIDEO_BYTES + 1}` } }),
    },
    { how: 'counted', media: () => new Response(endless()) },
  ])('a download over MAX_VIDEO_BYTES ($how) is stopped', async ({ media }) => {
    const { fetchFn } = standIn(resultAt(MEDIA_URL, media))
    const run = falVideo(testContext(), { fetch: fetchFn }).fetchResult(REQUEST_ID)
    await expect(run).rejects.toMatchObject({
      error: { kind: 'other', detail: 'Answer too large' },
    })
  })

  it('a download that is not an MP4 by its bytes is refused', async () => {
    const { fetchFn } = standIn(resultAt(MEDIA_URL, () => new Response('<html></html>')))
    const run = falVideo(testContext(), { fetch: fetchFn }).fetchResult(REQUEST_ID)
    await expect(run).rejects.toMatchObject({ error: { kind: 'other', reason: 'bad_result' } })
  })

  it.each([{}, { video: {} }, { video: { url: 7 } }])(
    'a result answer without a video address (%j) is a failure',
    async (answer) => {
      const { fetchFn, seen } = standIn(() => json(answer))
      const run = falVideo(testContext(), { fetch: fetchFn }).fetchResult(REQUEST_ID)
      await expect(run).rejects.toBeInstanceOf(ProviderFailure)
      expect(seen).toHaveLength(1)
    },
  )
})

describe('the pinned fal fetch [P7-14, A-170]', () => {
  it.each([
    'http://queue.fal.run/bytedance/seedance-2.0/text-to-video',
    'https://queue.fal.run.example/bytedance/seedance-2.0/text-to-video',
    'https://rest.fal.ai/storage/upload',
    'https://files.example/thing',
  ])('refuses %s before sending', async (address) => {
    const { fetchFn, seen } = standIn(() => json({}))
    const { send } = pinnedFal(fetchFn, TEST_KEY)
    await expect(send(address, { method: 'POST', body: {} })).rejects.toBeInstanceOf(
      ProviderFailure,
    )
    expect(seen).toHaveLength(0)
  })

  it('refuses a redirect from the queue host and sends nothing again', async () => {
    const moved = () => new Response(null, { status: 307, headers: { location: MEDIA_URL } })
    const { fetchFn, seen } = standIn(moved)
    const { send } = pinnedFal(fetchFn, TEST_KEY)
    const run = send(`${FAL_QUEUE_ORIGIN}/${APP}/text-to-video`, { method: 'POST', body: {} })
    await expect(run).rejects.toMatchObject({ error: { kind: 'other' } })
    expect(seen).toHaveLength(1)
  })

  it('sends the key to the queue origin only, and no body or other method to the media host', async () => {
    const { fetchFn, seen } = standIn(() => new Response('ok'))
    const { send } = pinnedFal(fetchFn, TEST_KEY)
    await send(MEDIA_URL, { method: 'GET' })
    await expect(send(MEDIA_URL, { method: 'POST', body: { a: 1 } })).rejects.toBeInstanceOf(
      ProviderFailure,
    )
    expect(seen).toHaveLength(1)
    expect(seen[0]?.headers.get('authorization')).toBeNull()
  })
})

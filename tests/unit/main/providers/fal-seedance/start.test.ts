import { describe, expect, it } from 'vitest'
import { falVideo } from '@/main/providers/fal-seedance/video'
import { adapters } from '@/main/providers/fal-seedance'
import { durationText, nearestRatio } from '@/main/providers/fal-seedance/endpoints'
import { ProviderCancelled, ProviderFailure, type ImageFile } from '@/main/providers/types'
import { APP, QUEUE, REQUEST_ID, TEST_KEY, json, only, standIn, testContext } from './stand-in'

const png: ImageFile = { bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2]), mime: 'image/png' }
const jpeg: ImageFile = { bytes: new Uint8Array([0xff, 0xd8, 0xff, 3]), mime: 'image/jpeg' }
const data = (f: ImageFile) => `data:${f.mime};base64,${Buffer.from(f.bytes).toString('base64')}`

const base = { prompt: 'A paper boat on a pond', durationMs: 8_000, width: 1080, height: 1920 }
const common = { resolution: '720p', duration: '8', aspect_ratio: '9:16', generate_audio: true }

const submitted = () =>
  standIn(() => json({ request_id: REQUEST_ID, status_url: 'https://x.example' }))

describe('fal Seedance start [P7-14, A-171, A-172]', () => {
  it.each([
    {
      kind: 'prompt',
      input: { ...base, image: null, references: [] },
      endpoint: `${APP}/text-to-video`,
      body: { prompt: base.prompt, ...common },
    },
    {
      kind: 'first frame or background',
      input: { ...base, image: png, references: [] },
      endpoint: `${APP}/image-to-video`,
      body: { prompt: base.prompt, ...common, image_url: data(png) },
    },
    {
      kind: 'reference',
      input: {
        ...base,
        prompt: 'Put <Picture 1> beside <Picture 2> on a table',
        image: null,
        references: [png, jpeg],
      },
      endpoint: `${APP}/reference-to-video`,
      body: {
        prompt: 'Put @Image1 beside @Image2 on a table',
        ...common,
        image_urls: [data(png), data(jpeg)],
      },
    },
  ])(
    'a $kind start posts to its endpoint with the exact body',
    async ({ input, endpoint, body }) => {
      const { fetchFn, seen } = submitted()
      const result = await falVideo(testContext(), { fetch: fetchFn }).start(input)
      expect(result).toEqual({ remoteJobId: REQUEST_ID })
      const request = only(seen)
      expect(request.method).toBe('POST')
      expect(request.url).toBe(`${QUEUE}/${endpoint}`)
      expect(JSON.parse(request.body ?? '')).toEqual(body)
      expect(request.headers.get('authorization')).toBe(`Key ${TEST_KEY}`)
      expect(request.headers.get('content-type')).toBe('application/json')
      expect(request.redirect).toBe('manual')
    },
  )

  it('the adapter index exports the video adapter', () => {
    expect(typeof adapters.video).toBe('function')
    expect(Object.keys(adapters)).toEqual(['video'])
  })

  it('a signal fired before submit gives ProviderCancelled and sends nothing', async () => {
    const { fetchFn, seen } = submitted()
    const controller = new AbortController()
    controller.abort()
    const run = falVideo(testContext(), { fetch: fetchFn }).start(
      { ...base, image: png, references: [] },
      { signal: controller.signal },
    )
    await expect(run).rejects.toBeInstanceOf(ProviderCancelled)
    expect(seen).toHaveLength(0)
  })

  it.each([
    { why: 'ten references', input: { ...base, image: null, references: Array(10).fill(png) } },
    { why: 'a first frame and references', input: { ...base, image: png, references: [png] } },
    { why: 'three seconds', input: { ...base, durationMs: 3_000, image: null, references: [] } },
    { why: 'sixteen seconds', input: { ...base, durationMs: 16_000, image: null, references: [] } },
    { why: 'part seconds', input: { ...base, durationMs: 8_500, image: null, references: [] } },
    {
      why: 'a picture that is not PNG or JPEG',
      input: { ...base, image: { bytes: new Uint8Array(4), mime: 'image/webp' }, references: [] },
    },
  ])('$why is refused before anything is sent', async ({ input }) => {
    const { fetchFn, seen } = submitted()
    const run = falVideo(testContext(), { fetch: fetchFn }).start(input)
    await expect(run).rejects.toBeInstanceOf(ProviderFailure)
    expect(seen).toHaveLength(0)
  })

  it('a submit answer whose request ID is not a UUID is a failure', async () => {
    const { fetchFn } = standIn(() => json({ request_id: '../../other/thing' }))
    const run = falVideo(testContext(), { fetch: fetchFn }).start({
      ...base,
      image: null,
      references: [],
    })
    await expect(run).rejects.toMatchObject({ error: { kind: 'other' } })
  })
})

describe('fal Seedance body parts [P7-14, A-172]', () => {
  it.each([
    { width: 2560, height: 1080, ratio: '21:9' },
    { width: 1920, height: 1080, ratio: '16:9' },
    { width: 1350, height: 1080, ratio: '4:3' },
    { width: 1100, height: 1000, ratio: '1:1' },
    { width: 1080, height: 1080, ratio: '1:1' },
    { width: 1080, height: 1350, ratio: '3:4' },
    { width: 1080, height: 1920, ratio: '9:16' },
    { width: 500, height: 4000, ratio: '9:16' },
    { width: Math.sqrt(4 / 3), height: 1, ratio: '4:3' },
    { width: 1, height: Math.sqrt(4 / 3), ratio: '1:1' },
  ])('$width x $height is sent as $ratio (ties to the wider)', ({ width, height, ratio }) => {
    expect(nearestRatio(width, height)).toBe(ratio)
  })

  it.each([
    [4_000, '4'],
    [15_000, '15'],
  ])('%i ms is sent as "%s"', (ms, text) => {
    expect(durationText(ms)).toBe(text)
  })
})

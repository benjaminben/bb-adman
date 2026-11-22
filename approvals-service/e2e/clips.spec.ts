import { readFileSync } from 'node:fs'
import { expect, test, type APIRequestContext, type APIResponse, type Page } from '@playwright/test'

// round-2-approvals-video.md "The clip route (service)", R2V-2, SV-6 and SV-7, through
// `next start`: a link seeded through the keyed API with one video variant whose clip is
// `pictures/d.mp4` on the test picture server. Every address is http://localhost:{port}.
const auth = { Authorization: `Bearer ${process.env.E2E_API_KEY ?? ''}` }
const ORIGIN = `http://localhost:${process.env.E2E_PORT ?? ''}`
const PICTURES = `http://127.0.0.1:${process.env.E2E_PICTURE_PORT ?? ''}`
const PROJECT = '01ARZ3NDEKTSV4RRFFQ69G5FAY'
const PASSWORD = 'clips password 1'
const KEY = 'dddd55'
const CLIP = readFileSync(new URL('pictures/d.mp4', import.meta.url))
const SIZE = CLIP.byteLength

let made = 0

async function seed(request: APIRequestContext): Promise<string> {
  made += 1
  const campaignId = `clips-${made}-${Date.now()}-k7m2pq`
  const created = await request.post('/api/v1/links', {
    headers: auth,
    data: { projectId: PROJECT, campaignId, campaignName: 'Clips', password: PASSWORD },
  })
  expect(created.status()).toBe(201)
  const { slug } = (await created.json()) as { slug: string }
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  const variant = {
    variantKey: KEY,
    title: 'Blue clip',
    sizeLine: '320 × 180 · 0:02',
    version: 1,
    pictureUrl: `${PICTURES}/a.png`,
    pictureExpiresAt: expires,
    kind: 'video',
    clip: { clipUrl: `${PICTURES}/d.mp4`, type: 'video/mp4', durationMs: 2000, bytes: SIZE },
  }
  const put = await request.put(`/api/v1/links/${PROJECT}/${campaignId}/gallery`, {
    headers: auth,
    data: { campaignName: 'Clips', variants: [variant] },
  })
  expect(put.status()).toBe(200)
  return slug
}

async function enter(request: APIRequestContext, slug: string): Promise<string> {
  const reply = await request.post(`/l/${slug}/enter`, {
    headers: { Origin: ORIGIN },
    form: { password: PASSWORD },
    maxRedirects: 0,
  })
  expect(reply.status()).toBe(303)
  return (reply.headers()['set-cookie'] ?? '').split(';')[0] ?? ''
}

// Every clip reply: no-store, nosniff, never compressed, never naming the bucket.
async function expectClipReply(reply: APIResponse) {
  const headers = reply.headers()
  expect(headers['cache-control']).toBe('no-store')
  expect(headers['x-content-type-options']).toBe('nosniff')
  expect(headers['content-encoding']).toBeUndefined()
  expect(Object.values(headers).join('\n')).not.toContain('127.0.0.1')
  expect(await reply.text()).not.toContain('127.0.0.1')
}

test('the clip route answers ranges for a session only [R2V-2, SV-6]', async ({
  request,
  playwright,
}) => {
  const slug = await seed(request)
  const cookie = await enter(request, slug)
  const path = `/l/${slug}/c/${KEY}/1`
  // Accept-Encoding asks for compression the route must never apply.
  const get = (range: string | null, headers: Record<string, string> = { Cookie: cookie }) =>
    request.get(path, {
      headers: { 'Accept-Encoding': 'gzip, br', ...headers, ...(range ? { Range: range } : {}) },
    })

  const first = await get('bytes=0-1')
  expect(first.status()).toBe(206)
  expect(first.headers()['content-type']).toBe('video/mp4')
  expect(first.headers()['content-range']).toBe(`bytes 0-1/${SIZE}`)
  // `next start` sends a streamed body in chunks and drops the route's Content-Length; if one
  // is sent, it is exact.
  expect([undefined, '2']).toContain(first.headers()['content-length'])
  expect(Buffer.from(await first.body())).toEqual(CLIP.subarray(0, 2))
  await expectClipReply(first)

  const whole = await get('bytes=0-')
  expect(whole.status()).toBe(206)
  expect(whole.headers()['content-range']).toBe(`bytes 0-${SIZE - 1}/${SIZE}`)
  expect(Buffer.from(await whole.body())).toEqual(CLIP)
  await expectClipReply(whole)

  const past = await get(`bytes=${SIZE}-`)
  expect(past.status()).toBe(416)
  expect(past.headers()['content-range']).toBe(`bytes */${SIZE}`)
  expect((await past.body()).byteLength).toBe(0)
  await expectClipReply(past)

  const noRange = await get(null)
  expect(noRange.status()).toBe(404)
  expect((await noRange.body()).byteLength).toBe(0)
  await expectClipReply(noRange)

  // The fixture's context keeps the cookie from /enter, so "no session" needs its own context.
  const stranger = await playwright.request.newContext({ baseURL: ORIGIN })
  const without = await stranger.get(path, { headers: { Range: 'bytes=0-1' } })
  expect(without.status()).toBe(404)
  expect((await without.body()).byteLength).toBe(0)
  await expectClipReply(without)
  await stranger.dispose()
})

// Run in the page as text: this folder's types hold no DOM. Adds a muted video and waits for its
// first frame, its failure, or 15 seconds.
const addVideo = (src: string) => `new Promise((resolve) => {
  const video = document.createElement('video')
  video.muted = true
  video.preload = 'auto'
  video.addEventListener('loadeddata', () => resolve('loaded'))
  video.addEventListener('error', () => resolve('error'))
  setTimeout(() => resolve('timeout'), 15000)
  video.src = ${JSON.stringify(src)}
  document.body.append(video)
})`

function watch(page: Page) {
  const refusals: string[] = []
  const clips: { status: number; headers: Record<string, string> }[] = []
  page.on('console', (message) => {
    if (/Content Security Policy|Refused to/i.test(message.text())) refusals.push(message.text())
  })
  page.on('response', (reply) => {
    if (new URL(reply.url()).pathname.includes('/c/')) {
      clips.push({ status: reply.status(), headers: reply.headers() })
    }
  })
  return { refusals, clips }
}

test('the page lets its own clips load and no other media [R2V-2, SV-7]', async ({
  page,
  request,
}) => {
  const slug = await seed(request)
  const { refusals, clips } = watch(page)
  await page.goto(`/l/${slug}`)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Open' }).click()
  await expect(page).toHaveURL(`/l/${slug}`)
  const shown = await page.reload()
  expect(shown?.headers()['content-security-policy']).toContain(
    "; img-src 'self'; media-src 'self'; font-src 'self'; ",
  )

  const playable = await page.evaluate(
    `document.createElement('video').canPlayType('video/mp4; codecs="avc1.42E01E"')`,
  )
  const result = await page.evaluate(addVideo(`/l/${slug}/c/${KEY}/1`))
  // Without the codec the browser still asks for the clip; playback is then R2V-8's hand check.
  expect(result).toBe(playable === '' ? 'error' : 'loaded')
  expect(clips.length).toBeGreaterThan(0)
  expect(clips[0]?.status).toBe(206)
  for (const { headers } of clips) {
    expect(headers['cache-control']).toBe('no-store')
    expect(headers['content-encoding']).toBeUndefined()
  }
  expect(await page.evaluate(addVideo(`/l/${slug}/c/${KEY}/2`))).toBe('error')
  expect(refusals).toEqual([])

  // The bucket's own address is another origin: the policy refuses it.
  expect(await page.evaluate(addVideo(`${PICTURES}/d.mp4`))).toBe('error')
  expect(refusals.join('\n')).toContain('media-src')
})

// Run in the page as text: plays the lightbox's video without sound (the page's own markup has
// no `muted`; muting here only keeps the browser's autoplay rule out of the test) and gives its
// readyState once it has a frame, or after 15 seconds.
const playShown = `new Promise((resolve) => {
  const video = document.querySelector('dialog[open] video')
  video.muted = true
  const done = () => resolve(video.readyState)
  video.addEventListener('loadeddata', done)
  video.addEventListener('error', done)
  setTimeout(done, 15000)
  video.play().catch(() => {})
})`

test('a video card opens a player that loads nothing before play [R2V-4, SV-7]', async ({
  page,
  request,
}) => {
  const slug = await seed(request)
  const { refusals, clips } = watch(page)
  await page.goto(`/l/${slug}`)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Open' }).click()
  await expect(page).toHaveURL(`/l/${slug}`)

  await page.getByRole('button', { name: 'Open video: Blue clip, 0:02' }).click()
  const box = page.getByRole('dialog', { name: 'Blue clip' })
  await expect(box).toBeVisible()
  const video = box.locator('video')
  const attributes = [
    ['controls', ''],
    ['preload', 'none'],
    ['playsinline', ''],
    ['controlslist', 'nodownload'],
    ['poster', `/l/${slug}/p/${KEY}/1`],
  ]
  for (const [name = '', value = ''] of attributes) {
    await expect(video).toHaveAttribute(name, value)
  }
  for (const name of ['autoplay', 'muted', 'src']) {
    expect(await video.getAttribute(name)).toBeNull()
  }
  await expect(box.locator('source')).toHaveAttribute('src', `/l/${slug}/c/${KEY}/1`)
  await expect(box.locator('[data-clip-error]')).toBeHidden()
  expect(clips).toEqual([])

  const playable = await page.evaluate(
    `document.createElement('video').canPlayType('video/mp4; codecs="avc1.42E01E"')`,
  )
  if (playable !== '') {
    expect(await page.evaluate(playShown)).toBeGreaterThanOrEqual(2)
    expect(clips[0]?.status).toBe(206)
  }
  expect(refusals).toEqual([])
})

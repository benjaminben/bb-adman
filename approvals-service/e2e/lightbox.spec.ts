import { statSync } from 'node:fs'
import { expect, test, type Browser, type Page } from '@playwright/test'

// spec/phases/round-2-approvals.md R2A-8: the lightbox with the gallery script on and off,
// against `next start`. Every address is http://localhost:{port}; made-up names only.
const auth = { Authorization: `Bearer ${process.env.E2E_API_KEY ?? ''}` }
const ORIGIN = `http://localhost:${process.env.E2E_PORT ?? ''}`
const PICTURES = `http://127.0.0.1:${process.env.E2E_PICTURE_PORT ?? ''}`
const PROJECT = '01ARZ3NDEKTSV4RRFFQ69G5FAY'
const PASSWORD = 'lightbox password 3'
const DESKTOP = { width: 1280, height: 900 }

// Cards of three shapes, so the lanes hold cards of different heights.
const VARIANTS = [
  { variantKey: 'aaaa22', title: 'Red tile', size: '64 × 64', file: 'a.png' },
  { variantKey: 'bbbb33', title: 'Blue banner', size: '128 × 64', file: 'b.png' },
  { variantKey: 'cccc44', title: 'Green story', size: '64 × 128', file: 'c.jpg' },
  { variantKey: 'dddd55', title: 'Plum tile', size: '64 × 64', file: 'a.png' },
  { variantKey: 'eeee66', title: 'Sand story', size: '64 × 128', file: 'c.jpg' },
]
const TITLES = VARIANTS.map((v) => v.title)

let made = 0

const EXPIRES = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
const stills = () =>
  VARIANTS.map(({ variantKey, title, size, file }) => ({
    variantKey,
    title,
    sizeLine: size,
    version: 1,
    pictureUrl: `${PICTURES}/${file}`,
    pictureExpiresAt: EXPIRES,
  }))

async function seed(browser: Browser, variants: object[] = stills()): Promise<string> {
  const api = await browser.newContext({ baseURL: ORIGIN })
  made += 1
  const campaignId = `lightbox-${made}-${Date.now()}-r2a8tk`
  const created = await api.request.post('/api/v1/links', {
    headers: auth,
    data: { projectId: PROJECT, campaignId, campaignName: 'Shapes', password: PASSWORD },
  })
  expect(created.status()).toBe(201)
  const { slug } = (await created.json()) as { slug: string }
  const put = await api.request.put(`/api/v1/links/${PROJECT}/${campaignId}/gallery`, {
    headers: auth,
    data: { campaignName: 'Shapes', variants },
  })
  expect(put.status()).toBe(200)
  await api.close()
  return slug
}

// The policy refusals and page errors the browser reports, and every picture reply.
function watch(page: Page) {
  const refusals: string[] = []
  const pictures: { url: string; cache: string }[] = []
  page.on('console', (message) => {
    if (/Content Security Policy|Refused to/i.test(message.text())) refusals.push(message.text())
  })
  page.on('pageerror', (error) => refusals.push(error.message))
  page.on('response', (reply) => {
    if (reply.url().startsWith(`${ORIGIN}/l/`) && reply.url().includes('/p/')) {
      pictures.push({ url: reply.url(), cache: reply.headers()['cache-control'] ?? '' })
    }
  })
  return { refusals, pictures }
}

async function open(browser: Browser, javaScript = true, seeded = seed) {
  const slug = await seeded(browser)
  const context = await browser.newContext({
    baseURL: ORIGIN,
    viewport: DESKTOP,
    javaScriptEnabled: javaScript,
  })
  const page = await context.newPage()
  const watched = watch(page)
  await page.goto(`/l/${slug}`)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Open' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Shapes')
  return { page, slug, ...watched }
}

const pictureButton = (page: Page, title: string) =>
  page.getByRole('button', { name: `View larger: ${title}` })
const dialog = (page: Page, title: string) => page.getByRole('dialog', { name: title })

// The id of the focused element, or of the element holding it; '' when nothing holds focus.
// Run in the browser, as text: this folder's types hold no DOM.
const focusedIn = (page: Page) =>
  page.evaluate<string>(`(() => {
    const active = document.activeElement
    if (active === null || active === document.body) return ''
    return active.closest('dialog')?.id ?? active.getAttribute('aria-label') ?? active.tagName
  })()`)
type Styled = { style: { gridRowEnd: string } }
const rowEnd = (card: unknown) => (card as Styled).style.gridRowEnd
type Boxed = { getBoundingClientRect(): { left: number; top: number; bottom: number } }
// Whole, as Playwright sends the function's text alone to the browser.
const boxesOf = (cards: unknown[]) =>
  cards.map((card) => {
    const { left, top, bottom } = (card as Boxed).getBoundingClientRect()
    return { left: Math.round(left), top, bottom }
  })

test('opens from the picture; Escape closes and focus is back on the picture', async ({
  browser,
}) => {
  const { page, refusals, pictures } = await open(browser)
  await pictureButton(page, 'Blue banner').click()
  const box = dialog(page, 'Blue banner')
  await expect(box).toBeVisible()
  await expect(box.getByRole('button', { name: 'Close' })).toBeFocused()
  await expect(box.getByRole('img', { name: 'Blue banner' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(box).toBeHidden()
  await expect(pictureButton(page, 'Blue banner')).toBeFocused()

  // The picture replies, the lightbox's included, are never stored.
  expect(pictures.length).toBeGreaterThan(0)
  for (const { url, cache } of pictures) expect(cache, url).toContain('no-store')
  expect(refusals).toEqual([])
  await page.context().close()
})

test('Tab stays inside the open lightbox', async ({ browser }) => {
  const { page, refusals } = await open(browser)
  await pictureButton(page, 'Red tile').click()
  await expect(dialog(page, 'Red tile')).toBeVisible()
  const seen = new Set<string>()
  for (let n = 0; n < 10; n += 1) {
    await page.keyboard.press('Tab')
    const holder = await focusedIn(page)
    // Inside the dialog, or out to the browser's own controls (normal for a modal dialog).
    expect(['view-aaaa22', '']).toContain(holder)
    seen.add(holder)
  }
  expect(seen).toContain('view-aaaa22')
  expect(refusals).toEqual([])
  await page.context().close()
})

test('Right and Left move through the cards in gallery order and stop at the ends', async ({
  browser,
}) => {
  const { page, refusals } = await open(browser)
  await pictureButton(page, TITLES[0] ?? '').click()
  for (const title of [...TITLES.slice(1), TITLES.at(-1)]) {
    await page.keyboard.press('ArrowRight')
    await expect(dialog(page, title ?? '')).toBeVisible()
    await expect(page.locator('dialog[open]')).toHaveCount(1)
  }
  for (const title of [...TITLES.slice(0, -1).reverse(), TITLES[0]]) {
    await page.keyboard.press('ArrowLeft')
    await expect(dialog(page, title ?? '')).toBeVisible()
    await expect(page.locator('dialog[open]')).toHaveCount(1)
  }

  // The buttons are shown and step the same way; closing puts focus on that card's picture.
  const first = dialog(page, 'Red tile')
  await first.getByRole('button', { name: 'Next' }).click()
  const second = dialog(page, 'Blue banner')
  await expect(second).toBeVisible()
  await second.getByRole('button', { name: 'Next' }).click()
  const third = dialog(page, 'Green story')
  await expect(third).toBeVisible()
  await third.getByRole('button', { name: 'Previous' }).click()
  await expect(second).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('dialog[open]')).toHaveCount(0)
  await expect(pictureButton(page, 'Blue banner')).toBeFocused()
  expect(refusals).toEqual([])
  await page.context().close()
})

test('the masonry spans are set and close the gaps under shorter cards', async ({ browser }) => {
  const { page, refusals } = await open(browser)
  const lanes = await page.evaluate<boolean>("CSS.supports('display', 'grid-lanes')")
  test.skip(lanes, 'this browser lays the lanes itself')
  const cards = page.locator('main article')
  await expect(cards).toHaveCount(VARIANTS.length)
  for (const card of await cards.all()) {
    await expect.poll(() => card.evaluate(rowEnd)).toMatch(/^span [1-9][0-9]*$/)
  }
  // Each card under another in its lane starts 16px to 20px below it (the gap and under one row).
  const boxes = await cards.evaluateAll(boxesOf)
  let stacked = 0
  for (const below of boxes) {
    const above = boxes.filter((b) => b.left === below.left && b.bottom <= below.top).at(-1)
    if (above === undefined) continue
    stacked += 1
    expect(below.top - above.bottom).toBeGreaterThanOrEqual(15.5)
    expect(below.top - above.bottom).toBeLessThanOrEqual(20.5)
  }
  expect(stacked).toBeGreaterThan(0)
  expect(refusals).toEqual([])
  await page.context().close()
})

test('with script off the lightbox opens and closes, and Remove works', async ({ browser }) => {
  const { page, slug, refusals } = await open(browser, false)
  await page.getByLabel('Signing off as:').fill('ann@example.com')
  await page.getByRole('button', { name: 'Sign off: Green story' }).click()
  await expect(page).toHaveURL(`/l/${slug}?m=signed#v-cccc44`)

  await pictureButton(page, 'Green story').click()
  const box = dialog(page, 'Green story')
  await expect(box).toBeVisible()
  // Without the script the steps stay hidden.
  await expect(box.getByRole('button', { name: 'Next' })).toBeHidden()
  await box.getByRole('button', { name: 'Close' }).click()
  await expect(box).toBeHidden()

  await pictureButton(page, 'Green story').click()
  await box.getByRole('button', { name: 'Remove sign-off by ann@example.com' }).click()
  await expect(page.locator('main [role=status]')).toHaveText('The sign-off was removed.')
  await expect(page.getByRole('button', { name: 'Sign off: Green story' })).toBeVisible()
  expect(refusals).toEqual([])
  await page.context().close()
})

// round-2-approvals-video.md R2V-6: a video card with the test clip, then a picture card.
const CLIP_SIZE = statSync(new URL('pictures/d.mp4', import.meta.url)).size
const clip = { clipUrl: `${PICTURES}/d.mp4`, type: 'video/mp4', durationMs: 2000, bytes: CLIP_SIZE }
const [red] = stills()
const blue = { ...red, variantKey: 'ffff77', title: 'Blue clip', kind: 'video', clip }
const withVideo = (browser: Browser) =>
  seed(browser, [{ ...blue, sizeLine: '320 × 180 · 0:02' }, red ?? {}])
const FAILED =
  'The video could not be loaded. Reload the page to try again. If it still fails, ask the person who sent the link to update the gallery.'

// Run in the browser, as text: plays the open lightbox's video muted (only to keep the autoplay
// rule out of the test) and gives `paused`, after play starts if `wait` (a failed play hangs).
const play = (wait: boolean) => `(async () => {
  const video = document.querySelector('dialog[open] video')
  video.muted = true
  const started = video.play().catch(() => {})
  if (${String(wait)}) await started
  return video.paused
})()`
const isPaused = (video: unknown) => (video as { paused: boolean }).paused

test('a focused video keeps its arrows; a playing one pauses on close [R2V-6]', async ({
  browser,
}) => {
  const { page, refusals } = await open(browser, true, withVideo)
  const opener = page.getByRole('button', { name: 'Open video: Blue clip, 0:02' })
  const box = dialog(page, 'Blue clip')
  // By id: a closed dialog is out of the page's roles.
  const video = page.locator('#view-ffff77 video')

  await opener.click()
  await expect(box).toBeVisible()
  await video.focus()
  await expect(video).toBeFocused()
  for (const key of ['ArrowRight', 'ArrowLeft', 'ArrowRight']) {
    await page.keyboard.press(key)
    await expect(box).toBeVisible()
    await expect(page.locator('dialog[open]')).toHaveCount(1)
  }

  expect(await page.evaluate<boolean>(play(true))).toBe(false)
  await page.keyboard.press('Escape')
  await expect(box).toBeHidden()
  await expect.poll(() => video.evaluate(isPaused)).toBe(true)

  await opener.click()
  await expect(box).toBeVisible()
  expect(await page.evaluate<boolean>(play(true))).toBe(false)
  await page.keyboard.press('ArrowRight')
  await expect(dialog(page, 'Red tile')).toBeVisible()
  await expect.poll(() => video.evaluate(isPaused)).toBe(true)
  expect(refusals).toEqual([])
  await page.context().close()
})

test('a clip that fails to load shows the failure notice [R2V-6]', async ({ browser }) => {
  const { page, refusals } = await open(browser, true, withVideo)
  const clips: number[] = []
  page.on('response', (reply) => {
    if (new URL(reply.url()).pathname.includes('/c/')) clips.push(reply.status())
  })
  await page.getByRole('button', { name: 'Open video: Blue clip, 0:02' }).click()
  const box = dialog(page, 'Blue clip')
  await expect(box).toBeVisible()
  const notice = box.locator('[data-clip-error]')
  await expect(notice).toBeHidden()

  // Without the session cookie the clip route answers its empty 404.
  await page.context().clearCookies()
  await page.evaluate(play(false))
  await expect(notice).toBeVisible()
  await expect(box.getByRole('alert')).toHaveText(FAILED)
  expect(clips).toEqual([404])
  expect(refusals).toEqual([])
  await page.context().close()
})

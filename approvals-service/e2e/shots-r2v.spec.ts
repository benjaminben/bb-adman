import { fileURLToPath } from 'node:url'
import { expect, test, type Browser, type Page } from '@playwright/test'

// round-2-approvals-video.md R2V-4: video cards, the lightbox's player and a video sent as its
// still only, written to the repository's root shots/ folder (not in git). Made-up names only.
// Every address is http://localhost:{port}.
const auth = { Authorization: `Bearer ${process.env.E2E_API_KEY ?? ''}` }
const ORIGIN = `http://localhost:${process.env.E2E_PORT ?? ''}`
const SHOTS = fileURLToPath(new URL('../../shots/', import.meta.url))
const PROJECT = '01ARZ3NDEKTSV4RRFFQ69G5FB0'
const CAMPAIGN = `spring-juice-${Date.now()}-r2v4tk`
const PASSWORD = 'shots password 4'
const PHONE = { width: 390, height: 844 }
const DESKTOP = { width: 1280, height: 900 }
const PICTURES = `http://127.0.0.1:${process.env.E2E_PICTURE_PORT ?? ''}`
const DAY = 24 * 60 * 60 * 1000
// Run in the browser: the picture's width once loaded, else 0. This folder's types hold no DOM.
type Loaded = { complete: boolean; naturalWidth: number }
const loaded = (img: unknown) => ((img as Loaded).complete ? (img as Loaded).naturalWidth : 0)

const clip = {
  clipUrl: `${PICTURES}/d.mp4`,
  type: 'video/mp4',
  durationMs: 30_000,
  bytes: 1,
}

// Two videos with a clip, one sent as its still only, one picture.
const CARDS = [
  ['aaaa22', 'Morning run, 9:16', '1080 × 1920 · Story', 'c.jpg', 'video', clip],
  ['bbbb33', 'Juice pour, square', '1080 × 1080 · Feed post', 'a.png', 'video', null],
  ['cccc44', 'Bottle banner, wide', '1200 × 600 · Banner', 'b.png', 'image', null],
  ['dddd55', 'Citrus close-up, wide', '1920 × 1080 · In-stream', 'b.png', 'video', clip],
] as const

async function seed(browser: Browser) {
  const api = await browser.newContext({ baseURL: ORIGIN })
  const created = await api.request.post('/api/v1/links', {
    headers: auth,
    data: {
      projectId: PROJECT,
      campaignId: CAMPAIGN,
      campaignName: 'Spring juice launch',
      password: PASSWORD,
    },
  })
  expect(created.status()).toBe(201)
  const { slug } = (await created.json()) as { slug: string }
  const variants = CARDS.map(([variantKey, title, sizeLine, file, kind, sent]) => ({
    variantKey,
    title,
    sizeLine,
    version: 1,
    pictureUrl: `${PICTURES}/${file}`,
    pictureExpiresAt: new Date(Date.now() + DAY).toISOString(),
    kind,
    clip: sent,
  }))
  const put = await api.request.put(`/api/v1/links/${PROJECT}/${CAMPAIGN}/gallery`, {
    headers: auth,
    data: { campaignName: 'Spring juice launch', variants },
  })
  expect(put.status()).toBe(200)
  await api.close()
  return slug
}

// Waits for every picture shown, then shoots the window or the whole page.
async function shootLoaded(page: Page, file: string, fullPage = true) {
  for (const picture of await page.locator('img:visible').all()) {
    await picture.scrollIntoViewIfNeeded()
    await expect.poll(() => picture.evaluate(loaded)).toBeGreaterThan(0)
  }
  await page.evaluate('window.scrollTo(0, 0)')
  await page.screenshot({ path: `${SHOTS}${file}.png`, fullPage })
}

async function enter(browser: Browser, slug: string, viewport: typeof DESKTOP) {
  const context = await browser.newContext({ baseURL: ORIGIN, viewport })
  const page = await context.newPage()
  await page.goto(`/l/${slug}`)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Open' }).click()
  await expect(page).toHaveURL(`/l/${slug}`)
  return page
}

test('the round 2 video screenshots', async ({ browser }) => {
  const slug = await seed(browser)

  const wide = await enter(browser, slug, DESKTOP)
  await shootLoaded(wide, '99-r2v-card-video')
  await wide.getByRole('button', { name: 'Open video: Morning run, 9:16, 0:30' }).click()
  const box = wide.getByRole('dialog', { name: 'Morning run, 9:16' })
  await expect(box.locator('video')).toBeVisible()
  // The poster is drawn by the player with no load event of its own to wait on.
  await wide.waitForTimeout(3000)
  await wide.screenshot({ path: `${SHOTS}99-r2v-lightbox-video.png` })
  await wide.keyboard.press('Escape')
  const still = 'View larger: Juice pour, square. Video, still picture only.'
  await wide.getByRole('button', { name: still }).click()
  await expect(wide.getByRole('dialog', { name: 'Juice pour, square' })).toBeVisible()
  await shootLoaded(wide, '99-r2v-still-only', false)
  await wide.context().close()

  const phone = await enter(browser, slug, PHONE)
  await shootLoaded(phone, '99-r2v-card-video-phone')
  await phone.context().close()
})

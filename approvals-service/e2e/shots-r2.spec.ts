import { fileURLToPath } from 'node:url'
import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test'

// spec/phases/round-2-approvals.md R2A-4 and R2A-7: the password page and the gallery drawn in
// the app's look, written to the repository's root shots/ folder (not in git). Made-up names only. Every address is
// http://localhost:{port}.
const auth = { Authorization: `Bearer ${process.env.E2E_API_KEY ?? ''}` }
const ORIGIN = `http://localhost:${process.env.E2E_PORT ?? ''}`
const SHOTS = fileURLToPath(new URL('../../shots/', import.meta.url))
const PROJECT = '01ARZ3NDEKTSV4RRFFQ69G5FAZ'
const CAMPAIGN = `autumn-shapes-${Date.now()}-r2a4tk`
const PASSWORD = 'shots password 2'
const PHONE = { width: 390, height: 844 }
const DESKTOP = { width: 1280, height: 900 }
const PICTURES = `http://127.0.0.1:${process.env.E2E_PICTURE_PORT ?? ''}`
const GALLERY = `summer-shapes-${Date.now()}-r2a7tk`
const DAY = 24 * 60 * 60 * 1000
// Run in the browser: the picture's width once loaded, else 0. This folder's types hold no DOM.
type Loaded = { complete: boolean; naturalWidth: number }
const loaded = (img: unknown) => ((img as Loaded).complete ? (img as Loaded).naturalWidth : 0)

async function shoot(page: Page, file: string) {
  await page.screenshot({ path: `${SHOTS}${file}.png`, fullPage: true })
}

test('the round 2 password screenshots', async ({ browser, playwright }) => {
  const api = await playwright.request.newContext({ baseURL: ORIGIN })
  const created = await api.post('/api/v1/links', {
    headers: auth,
    data: {
      projectId: PROJECT,
      campaignId: CAMPAIGN,
      campaignName: 'Autumn shapes',
      password: PASSWORD,
    },
  })
  expect(created.status()).toBe(201)
  const { slug } = (await created.json()) as { slug: string }
  await api.dispose()

  const desktop = await browser.newContext({ baseURL: ORIGIN, viewport: DESKTOP })
  const wide = await desktop.newPage()
  await wide.goto(`/l/${slug}`)
  await expect(wide.getByRole('heading', { level: 1 })).toHaveText('Review campaign')
  await shoot(wide, '98-r2-password')
  await desktop.close()

  const phone = await browser.newContext({ baseURL: ORIGIN, viewport: PHONE })
  const page = await phone.newPage()
  await page.goto(`/l/${slug}`)
  await page.getByLabel('Password').fill('not the password at all')
  await page.getByRole('button', { name: 'Open' }).click()
  await expect(page).toHaveURL(`/l/${slug}?m=wrong-password`)
  await expect(page.locator('main [role=alert]')).toBeVisible()
  await shoot(page, '98-r2-password-wrong')
  await phone.close()
})

// Four cards: one waiting, one this reviewer signs, one another reviewer signed, one expired.
const CARDS = [
  { variantKey: 'aaaa22', title: 'Coral square, feed post', size: '1080 × 1080', file: 'a.png' },
  { variantKey: 'bbbb33', title: 'Navy banner, wide', size: '1200 × 600', file: 'b.png' },
  { variantKey: 'cccc44', title: 'Mint tile, story', size: '1080 × 1080', file: 'c.jpg' },
  { variantKey: 'dddd55', title: 'Sand square, feed post', size: '1080 × 1080', file: 'a.png' },
]

async function seedGallery(api: APIRequestContext) {
  const created = await api.post('/api/v1/links', {
    headers: auth,
    data: {
      projectId: PROJECT,
      campaignId: GALLERY,
      campaignName: 'Summer shapes',
      password: PASSWORD,
    },
  })
  expect(created.status()).toBe(201)
  const { slug } = (await created.json()) as { slug: string }
  const variants = CARDS.map(({ variantKey, title, size, file }, n) => ({
    variantKey,
    title,
    sizeLine: `${size} · Made-up placement`,
    version: 1,
    pictureUrl: `${PICTURES}/${file}`,
    pictureExpiresAt: new Date(Date.now() + (n === 3 ? -DAY : DAY)).toISOString(),
  }))
  const put = await api.put(`/api/v1/links/${PROJECT}/${GALLERY}/gallery`, {
    headers: auth,
    data: { campaignName: 'Summer shapes', variants },
  })
  expect(put.status()).toBe(200)
  // Another reviewer's sign-off, through a session of its own.
  await api.post(`/l/${slug}/enter`, { headers: { Origin: ORIGIN }, form: { password: PASSWORD } })
  const signed = await api.post(`/l/${slug}/signoffs`, {
    headers: { Origin: ORIGIN },
    form: { one: 'cccc44.1', email: 'sam.ortiz@example.com' },
    maxRedirects: 0,
  })
  expect(signed.status()).toBe(303)
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

// A reviewer who has entered, saved an email and signed off the navy banner.
async function reviewerPage(browser: Browser, slug: string, viewport: typeof DESKTOP) {
  const context = await browser.newContext({ baseURL: ORIGIN, viewport })
  const page = await context.newPage()
  await page.goto(`/l/${slug}`)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Open' }).click()
  await page.getByLabel('Signing off as:').fill('mia.chen@example.com')
  await page.getByRole('button', { name: 'Sign off: Navy banner, wide' }).click()
  await expect(page).toHaveURL(/m=signed/)
  await page.goto(`/l/${slug}`)
  return page
}

async function openLightbox(page: Page, title: string) {
  await page.getByRole('button', { name: `View larger: ${title}` }).click()
  await expect(page.getByRole('dialog', { name: title })).toBeVisible()
}

test('the round 2 gallery screenshots', async ({ browser, playwright }) => {
  const api = await playwright.request.newContext({ baseURL: ORIGIN })
  const slug = await seedGallery(api)
  await api.dispose()

  const wide = await reviewerPage(browser, slug, DESKTOP)
  await shootLoaded(wide, '99-r2-gallery')
  await openLightbox(wide, 'Mint tile, story')
  await shootLoaded(wide, '99-r2-lightbox', false)
  await wide.keyboard.press('Escape')
  await wide.getByRole('button', { name: 'Sign off all…' }).click()
  await expect(wide.getByRole('dialog', { name: 'Sign off all?' })).toBeVisible()
  await shootLoaded(wide, '99-r2-confirm-all', false)
  await wide.context().close()

  const phone = await reviewerPage(browser, slug, PHONE)
  await shootLoaded(phone, '99-r2-gallery-phone')
  await openLightbox(phone, 'Mint tile, story')
  await shootLoaded(phone, '99-r2-lightbox-phone', false)
  await phone.context().close()

  // No email saved: the lightbox's Sign off reaches the server's check.
  const fresh = await browser.newContext({ baseURL: ORIGIN, viewport: DESKTOP })
  const page = await fresh.newPage()
  await page.goto(`/l/${slug}`)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Open' }).click()
  await openLightbox(page, 'Coral square, feed post')
  const box = page.getByRole('dialog', { name: 'Coral square, feed post' })
  await box.getByRole('button', { name: 'Sign off: Coral square, feed post' }).click()
  await expect(page).toHaveURL(`/l/${slug}?m=bad-email`)
  await expect(page.locator('aside [role=alert]')).toBeVisible()
  await shootLoaded(page, '99-r2-bad-email')
  await fresh.close()
})

// R2A-8: where the browser has no grid lanes, the script's spans close the gaps under shorter
// cards. Eight cards of three shapes, no email saved.
const MASONRY = `spring-shapes-${Date.now()}-r2a8tk`
const SQUARE = { name: 'square, feed post', size: '1080 × 1080', file: 'a.png' }
const BANNER = { name: 'banner, wide', size: '1200 × 600', file: 'b.png' }
const STORY = { name: 'tile, story', size: '1080 × 1920', file: 'c.jpg' }
const MIXED = [
  ['aaaa22', 'Coral', SQUARE],
  ['bbbb33', 'Mint', STORY],
  ['cccc44', 'Navy', BANNER],
  ['dddd55', 'Sand', BANNER],
  ['eeee66', 'Plum', SQUARE],
  ['ffff77', 'Teal', STORY],
  ['gggg88', 'Rose', SQUARE],
  ['hhhh99', 'Slate', BANNER],
] as const

test('the round 2 masonry screenshot', async ({ browser, playwright }) => {
  const api = await playwright.request.newContext({ baseURL: ORIGIN })
  const created = await api.post('/api/v1/links', {
    headers: auth,
    data: {
      projectId: PROJECT,
      campaignId: MASONRY,
      campaignName: 'Spring shapes',
      password: PASSWORD,
    },
  })
  expect(created.status()).toBe(201)
  const { slug } = (await created.json()) as { slug: string }
  const variants = MIXED.map(([variantKey, colour, shape]) => ({
    variantKey,
    title: `${colour} ${shape.name}`,
    sizeLine: `${shape.size} · Made-up placement`,
    version: 1,
    pictureUrl: `${PICTURES}/${shape.file}`,
    pictureExpiresAt: new Date(Date.now() + DAY).toISOString(),
  }))
  const put = await api.put(`/api/v1/links/${PROJECT}/${MASONRY}/gallery`, {
    headers: auth,
    data: { campaignName: 'Spring shapes', variants },
  })
  expect(put.status()).toBe(200)
  await api.dispose()

  const context = await browser.newContext({ baseURL: ORIGIN, viewport: DESKTOP })
  const page = await context.newPage()
  await page.goto(`/l/${slug}`)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Open' }).click()
  await expect(page.locator('main article').first()).toHaveCSS('grid-row-end', /^span \d+$/)
  await shootLoaded(page, '99-r2-masonry')
  await context.close()
})

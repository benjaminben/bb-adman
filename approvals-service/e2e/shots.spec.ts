import { fileURLToPath } from 'node:url'
import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

// spec/approvals-gallery.md "Screenshots for the user": written to the repository's root shots/
// folder (not in git). Made-up shapes and names only. Every address is http://localhost:{port}.
const auth = { Authorization: `Bearer ${process.env.E2E_API_KEY ?? ''}` }
const ORIGIN = `http://localhost:${process.env.E2E_PORT ?? ''}`
const PICTURES = `http://127.0.0.1:${process.env.E2E_PICTURE_PORT ?? ''}`
// Run in the browser: the picture's width once loaded, else 0. This folder's types hold no DOM.
type Loaded = { complete: boolean; naturalWidth: number }
const loaded = (img: unknown) => ((img as Loaded).complete ? (img as Loaded).naturalWidth : 0)
const SHOTS = fileURLToPath(new URL('../../shots/', import.meta.url))
const PROJECT = '01ARZ3NDEKTSV4RRFFQ69G5FAY'
const CAMPAIGN = `spring-shapes-${Date.now()}-k7m2pq`
const NAME = 'Spring shapes'
const PASSWORD = 'shots password 1'
const PHONE = { width: 390, height: 844 }
const DESKTOP = { width: 1280, height: 900 }

const DAY = 24 * 60 * 60 * 1000
const at = (ms: number) => new Date(Date.now() + ms).toISOString()

// Red tile: a current sign-off. Blue tile: signed at version 1, now version 2. Green: expired.
function gallery(blueVersion: number, greenExpires: string) {
  const variant = (variantKey: string, title: string, file: string, version = 1) => ({
    variantKey,
    title,
    sizeLine: '1080 × 1080 · Square post',
    version,
    pictureUrl: `${PICTURES}/${file}`,
    pictureExpiresAt: at(DAY),
  })
  return {
    campaignName: NAME,
    variants: [
      variant('aaaa22', 'Red tile', 'a.png'),
      variant('bbbb33', 'Blue tile', 'b.png', blueVersion),
      { ...variant('cccc44', 'Green tile', 'c.jpg'), pictureExpiresAt: greenExpires },
    ],
  }
}

async function putGallery(api: APIRequestContext, body: ReturnType<typeof gallery>) {
  const reply = await api.put(`/api/v1/links/${PROJECT}/${CAMPAIGN}/gallery`, {
    headers: auth,
    data: body,
  })
  expect(reply.status()).toBe(200)
}

async function signOff(api: APIRequestContext, slug: string, variant: string, email: string) {
  const reply = await api.post(`/l/${slug}/signoffs`, {
    headers: { Origin: ORIGIN },
    form: { one: `${variant}.1`, email },
    maxRedirects: 0,
  })
  expect(reply.headers().location).toBe(`/l/${slug}?m=signed#v-${variant}`)
}

// The link with its three cards and two sign-offs, made through the API's own session; gives
// the slug.
async function seed(api: APIRequestContext) {
  const created = await api.post('/api/v1/links', {
    headers: auth,
    data: { projectId: PROJECT, campaignId: CAMPAIGN, campaignName: NAME, password: PASSWORD },
  })
  expect(created.status()).toBe(201)
  const { slug } = (await created.json()) as { slug: string }
  await putGallery(api, gallery(1, at(DAY)))
  const entered = await api.post(`/l/${slug}/enter`, {
    headers: { Origin: ORIGIN },
    form: { password: PASSWORD },
    maxRedirects: 0,
  })
  expect(entered.headers().location).toBe(`/l/${slug}`)
  await signOff(api, slug, 'aaaa22', 'ann.lee@example.com')
  await signOff(api, slug, 'bbbb33', 'sam.ortiz@example.com')
  await putGallery(api, gallery(2, at(-DAY)))
  return slug
}

async function shoot(page: Page, file: string) {
  for (const picture of await page.getByRole('img').all()) {
    await picture.scrollIntoViewIfNeeded()
    await expect.poll(() => picture.evaluate(loaded)).toBeGreaterThan(0)
  }
  await page.evaluate('window.scrollTo(0, 0)')
  await page.screenshot({ path: `${SHOTS}${file}.png`, fullPage: true })
}

// The visitor's way in: the password form.
async function enter(page: Page, password: string) {
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Open' }).click()
}

test('the gallery screenshots', async ({ browser, playwright }) => {
  const api = await playwright.request.newContext({ baseURL: ORIGIN })
  const slug = await seed(api)
  await api.dispose()

  const phone = await browser.newContext({ baseURL: ORIGIN, viewport: PHONE })
  const page = await phone.newPage()
  await page.goto(`/l/${slug}`)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Review campaign')
  await shoot(page, '98-gallery-password')
  await enter(page, 'not the password at all')
  await expect(page).toHaveURL(`/l/${slug}?m=wrong-password`)
  await expect(page.locator('main [role=alert]')).toBeVisible()
  await shoot(page, '98-gallery-password-wrong')
  await enter(page, PASSWORD)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(NAME)
  await shoot(page, '99-gallery-phone')
  await phone.close()

  const desktop = await browser.newContext({ baseURL: ORIGIN, viewport: DESKTOP })
  const wide = await desktop.newPage()
  await wide.goto(`/l/${slug}`)
  await enter(wide, PASSWORD)
  // The card's sentence; its closed lightbox holds the same one.
  await expect(wide.getByText('This picture has expired.').first()).toBeVisible()
  // The Blue tile's sign-off is for version 1, now version 2: it stays stored and is not shown.
  await expect(wide.getByText('sam.ortiz@example.com')).toHaveCount(0)
  await shoot(wide, '99-gallery')
  await desktop.close()
})

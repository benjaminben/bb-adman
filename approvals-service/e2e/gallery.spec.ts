import { expect, test, type APIResponse, type Browser, type Page } from '@playwright/test'

// spec/approvals-gallery.md "Tests" (AP-16), against `next start`. Every address is
// http://localhost:{port}; the form Origin check is not loosened for it. Links are seeded through
// the keyed API, as the app would, with pictures on the test picture server.
const auth = { Authorization: `Bearer ${process.env.E2E_API_KEY ?? ''}` }
const ORIGIN = `http://localhost:${process.env.E2E_PORT ?? ''}`
const PICTURES = `http://127.0.0.1:${process.env.E2E_PICTURE_PORT ?? ''}`
// Run in the browser: the picture's width once loaded, else 0. This folder's types hold no DOM.
type Loaded = { complete: boolean; naturalWidth: number }
const loaded = (img: unknown) => ((img as Loaded).complete ? (img as Loaded).naturalWidth : 0)
const PROJECT = '01ARZ3NDEKTSV4RRFFQ69G5FAX'
const PASSWORD = 'gallery password 1'
const UNKNOWN = 'zzzzZZZZ2222'

const ALLOWED = ['date', 'connection', 'keep-alive', 'transfer-encoding', 'content-length']
const PAGE_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'same-origin',
  'cross-origin-opener-policy': 'same-origin',
  'cache-control': 'no-store',
  'x-robots-tag': 'noindex, nofollow',
}
const POLICY =
  /^default-src 'none'; script-src 'self' 'nonce-([A-Za-z0-9+/]{22}==)'; style-src 'self' 'nonce-\1'; img-src 'self'; media-src 'self'; font-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'$/

const VARIANTS = [
  { variantKey: 'aaaa22', title: 'Red tile', file: 'a.png' },
  { variantKey: 'bbbb33', title: 'Blue tile', file: 'b.png' },
  { variantKey: 'cccc44', title: 'Green tile', file: 'c.jpg' },
]

let made = 0

async function seed(browser: Browser): Promise<string> {
  const api = await browser.newContext({ baseURL: ORIGIN })
  made += 1
  const campaignId = `gallery-${made}-${Date.now()}-k7m2pq`
  const created = await api.request.post('/api/v1/links', {
    headers: auth,
    data: { projectId: PROJECT, campaignId, campaignName: 'Shapes', password: PASSWORD },
  })
  expect(created.status()).toBe(201)
  const { slug } = (await created.json()) as { slug: string }
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  const variants = VARIANTS.map(({ variantKey, title, file }) => ({
    variantKey,
    title,
    sizeLine: '64 × 64',
    version: 1,
    pictureUrl: `${PICTURES}/${file}`,
    pictureExpiresAt: expires,
  }))
  const put = await api.request.put(`/api/v1/links/${PROJECT}/${campaignId}/gallery`, {
    headers: auth,
    data: { campaignName: 'Shapes', variants },
  })
  expect(put.status()).toBe(200)
  await api.close()
  return slug
}

const nonceOf = (reply: APIResponse) =>
  POLICY.exec(reply.headers()['content-security-policy'] ?? '')?.[1] ?? null

// Every header is a page header or one any HTTP server may add.
function expectPageHeaders(reply: APIResponse) {
  const headers = reply.headers()
  expect(headers).toMatchObject(PAGE_HEADERS)
  expect(nonceOf(reply)).not.toBeNull()
  const own = [...Object.keys(PAGE_HEADERS), 'content-security-policy', 'vary', 'content-encoding']
  expect(Object.keys(headers).filter((name) => ![...own, ...ALLOWED].includes(name))).toEqual([])
}

// The policy refusals the browser reports, and every reply of ours under /l/.
function watch(page: Page) {
  const refusals: string[] = []
  const replies: { url: string; status: number; headers: Record<string, string> }[] = []
  page.on('console', (message) => {
    if (/Content Security Policy|Refused to/i.test(message.text())) refusals.push(message.text())
  })
  page.on('pageerror', (error) => refusals.push(error.message))
  page.on('response', (reply) => {
    const url = new URL(reply.url())
    if (url.origin === ORIGIN && url.pathname.startsWith('/l/')) {
      replies.push({ url: reply.url(), status: reply.status(), headers: reply.headers() })
    }
  })
  return { refusals, replies }
}

async function enterWith(page: Page, slug: string, password: string) {
  await page.goto(`/l/${slug}`)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Open' }).click()
}

test('an unknown slug and a real one without a session get the same page [gallery 1]', async ({
  browser,
}) => {
  const slug = await seed(browser)
  const visitor = await browser.newContext({ baseURL: ORIGIN })
  const real = await visitor.request.get(`/l/${slug}`)
  const unknown = await visitor.request.get(`/l/${UNKNOWN}`)
  expect(real.status()).toBe(200)
  expect(unknown.status()).toBe(real.status())
  for (const reply of [real, unknown]) {
    expectPageHeaders(reply)
    expect(reply.headers()['set-cookie']).toBeUndefined()
  }
  const plain = async (reply: APIResponse, own: string) =>
    (await reply.text()).replaceAll(nonceOf(reply) ?? '-', 'NONCE').replaceAll(own, 'SLUG')
  expect(await plain(unknown, UNKNOWN)).toBe(await plain(real, slug))
  expect(await real.text()).not.toContain('Shapes')
  await visitor.close()
})

test('the password page ignores a planted reviewer cookie [gallery 1, S-4]', async ({
  browser,
}) => {
  const slug = await seed(browser)
  const visitor = await browser.newContext({ baseURL: ORIGIN })
  const plain = async (reply: APIResponse, own: string) =>
    (await reply.text()).replaceAll(nonceOf(reply) ?? '-', 'NONCE').replaceAll(own, 'SLUG')
  const bodies: string[] = []
  for (const own of [slug, UNKNOWN]) {
    for (const planted of [false, true]) {
      const cookie = planted ? { Cookie: `__Host-adman-${own}-as=ann@example.com` } : undefined
      const reply = await visitor.request.get(`/l/${own}`, { headers: cookie })
      expect(reply.status()).toBe(200)
      expect(reply.headers()['set-cookie']).toBeUndefined()
      bodies.push(await plain(reply, own))
    }
  }
  expect(new Set(bodies).size).toBe(1)
  expect(bodies[0]).not.toContain('ann@example.com')
  await visitor.close()
})

test("a visitor's own policy and x-nonce headers are never used [gallery 1]", async ({
  request,
}) => {
  const chosen = 'AAAAAAAAAAAAAAAAAAAAAA=='
  const reply = await request.get(`/l/${UNKNOWN}`, {
    headers: { 'Content-Security-Policy': `script-src 'nonce-${chosen}'`, 'x-nonce': chosen },
  })
  const nonce = nonceOf(reply)
  expect(nonce).not.toBe(chosen)
  const body = await reply.text()
  expect(body).not.toContain(chosen)
  const used = new Set([...body.matchAll(/nonce="([^"]*)"/g)].map((m) => m[1]))
  expect([...used]).toEqual([nonce])
})

test('a wrong password, then the right one, then the gallery in order [gallery 2]', async ({
  page,
  browser,
}) => {
  const slug = await seed(browser)
  const { refusals } = watch(page)
  await enterWith(page, slug, 'not the password at all')
  await expect(page).toHaveURL(`/l/${slug}?m=wrong-password`)
  await expect(page.locator('main [role=alert]')).toHaveText(
    'That password did not work. If you have tried many times, wait 15 minutes and try again.',
  )
  const entered = page.waitForResponse((r) => r.url().endsWith(`/l/${slug}/enter`))
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Open' }).click()
  const cookie = (await (await entered).headerValue('set-cookie')) ?? ''
  expect(cookie).toMatch(
    new RegExp(
      `^__Host-adman-${slug}=[A-Za-z0-9_-]{43}; Path=/; Max-Age=43200; HttpOnly; Secure; SameSite=Lax$`,
    ),
  )
  await expect(page).toHaveURL(`/l/${slug}`)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Shapes')
  const cards = page.locator('main article')
  await expect(cards.getByRole('heading', { level: 2 })).toHaveText(VARIANTS.map((v) => v.title))
  for (const { title } of VARIANTS) {
    const picture = cards.getByRole('button', { name: `View larger: ${title}` }).locator('img')
    await picture.scrollIntoViewIfNeeded()
    await expect.poll(() => picture.evaluate(loaded)).toBeGreaterThan(0)
  }
  expect(refusals).toEqual([])
})

// The reviewer cookie's exact text (S-2), as the sign-off and reviewer replies set it.
const reviewerCookie = (slug: string, email: string) =>
  `__Host-adman-${slug}-as=${email}; Path=/; HttpOnly; Secure; SameSite=Lax`
const TICK = 'Signed off by you. Open to view or remove.'

// Sign off as the sidebar's email, see the tick, remove it from the lightbox, sign off all, log
// out: plain forms, command buttons and redirects only.
async function signOffFlow(page: Page, slug: string) {
  await enterWith(page, slug, PASSWORD)
  await page.getByLabel('Signing off as:').fill('ann@example.com')
  const signed = page.waitForResponse((r) => r.url().endsWith(`/l/${slug}/signoffs`))
  await page.getByRole('button', { name: 'Sign off: Blue tile' }).click()
  expect(await (await signed).headerValue('set-cookie')).toBe(
    reviewerCookie(slug, 'ann@example.com'),
  )
  await expect(page).toHaveURL(`/l/${slug}?m=signed#v-bbbb33`)
  await expect(page.locator('main [role=status]')).toHaveText('Your sign-off was saved.')
  const card = page.locator('#v-bbbb33')
  await expect(card.getByRole('button', { name: TICK })).toBeVisible()
  await expect(card.getByRole('button', { name: 'Sign off: Blue tile' })).toHaveCount(0)

  await page.reload()
  await expect(page.getByLabel('Signing off as:')).toHaveValue('ann@example.com')

  await card.getByRole('button', { name: TICK }).click()
  const box = page.getByRole('dialog', { name: 'Blue tile' })
  await expect(box).toBeVisible()
  await expect(box).toContainText('ann@example.com · ')
  await box.getByRole('button', { name: 'Remove sign-off by ann@example.com' }).click()
  await expect(page.locator('main [role=status]')).toHaveText('The sign-off was removed.')
  await expect(card.getByRole('button', { name: 'Sign off: Blue tile' })).toBeVisible()

  await page.getByRole('button', { name: 'Sign off all…' }).click()
  const confirm = page.getByRole('dialog', { name: 'Sign off all?' })
  await expect(confirm).toBeVisible()
  await confirm.getByRole('button', { name: 'Sign off all', exact: true }).click()
  await expect(page).toHaveURL(`/l/${slug}?m=signed-all`)
  await expect(page.locator('main [role=status]')).toHaveText('Your sign-offs were saved.')
  for (const { variantKey } of VARIANTS) {
    await expect(page.locator(`#v-${variantKey}`).getByRole('button', { name: TICK })).toBeVisible()
  }

  const left = page.waitForResponse((r) => r.url().endsWith(`/l/${slug}/leave`))
  await page.getByRole('button', { name: 'Log out' }).click()
  expect(await (await left).headerValue('set-cookie')).toContain(
    `__Host-adman-${slug}-as=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
  )
  await expect(page).toHaveURL(`/l/${slug}`)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Review campaign')
  const names = (await page.context().cookies()).map((c) => c.name)
  expect(names).not.toContain(`__Host-adman-${slug}-as`)
  expect(names).not.toContain(`__Host-adman-${slug}`)
}

for (const javaScript of [false, true]) {
  test(`sign off, remove and leave with JavaScript ${javaScript ? 'on' : 'off'} [gallery 3, 4, 6]`, async ({
    browser,
  }) => {
    const slug = await seed(browser)
    const context = await browser.newContext({ baseURL: ORIGIN, javaScriptEnabled: javaScript })
    const page = await context.newPage()
    const { refusals, replies } = watch(page)
    await signOffFlow(page, slug)
    expect(refusals).toEqual([])

    // Every reply under /l/ is no-store and never public or shared-cached.
    expect(replies.length).toBeGreaterThan(0)
    for (const { url, headers } of replies) {
      expect(headers['cache-control'], url).toContain('no-store')
      expect(headers['cache-control'], url).not.toMatch(/public|s-maxage/)
    }
    expect(replies.some((r) => r.status === 303)).toBe(true)
    // Every page reply carries the page policy, with a new nonce each time.
    const pages = replies.filter((r) => r.status === 200 && !r.url.includes('/p/'))
    const nonces = pages.map((r) => POLICY.exec(r.headers['content-security-policy'] ?? '')?.[1])
    expect(pages.length).toBeGreaterThanOrEqual(5)
    expect(nonces.every((n) => n !== undefined)).toBe(true)
    expect(new Set(nonces).size).toBe(nonces.length)
    await context.close()
  })
}

test.describe('a slug of the wrong shape [gallery 5]', () => {
  const TEXT = {
    'content-type': 'text/plain; charset=utf-8',
    'content-security-policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    'cache-control': 'no-store',
  }
  for (const path of ['/l/short', '/l/%41aaaaaaaaaaa', '/l/aaaaaaaaaaaaa']) {
    test(`${path} gives the plain 404`, async ({ request }) => {
      const reply = await request.get(path)
      expect(reply.status()).toBe(404)
      expect(await reply.text()).toBe('Not found.')
      expect(reply.headers()).toMatchObject(TEXT)
    })
  }

  test('a POST to the page path gives the plain 404', async ({ request }) => {
    const reply = await request.post(`/l/${UNKNOWN}`, { headers: { Origin: ORIGIN } })
    expect(reply.status()).toBe(404)
    expect(await reply.text()).toBe('Not found.')
  })
})

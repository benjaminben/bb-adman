import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'

// spec/phases/round-2-approvals.md R2A-4: the password page drawn in the app's look, written to
// the repository's root shots/ folder (not in git). Made-up names only. Every address is
// http://localhost:{port}.
const auth = { Authorization: `Bearer ${process.env.E2E_API_KEY ?? ''}` }
const ORIGIN = `http://localhost:${process.env.E2E_PORT ?? ''}`
const SHOTS = fileURLToPath(new URL('../../shots/', import.meta.url))
const PROJECT = '01ARZ3NDEKTSV4RRFFQ69G5FAZ'
const CAMPAIGN = `autumn-shapes-${Date.now()}-r2a4tk`
const PASSWORD = 'shots password 2'
const PHONE = { width: 390, height: 844 }
const DESKTOP = { width: 1280, height: 900 }

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

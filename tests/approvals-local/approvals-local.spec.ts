// AP-13, the local proof (spec/phases/approvals.md, exit criteria): the built app and the real
// service from global-setup.ts, with Playwright's Chromium as the visitor. The app is given
// http://127.0.0.1:{port}; the visitor opens the copied link at http://localhost:{port}, the
// origin `next start` gives, so the form Origin check passes unloosened. People are made up.
import {
  test,
  expect,
  _electron as electron,
  type Browser,
  type BrowserContext,
  type ElectronApplication,
  type Page,
} from '@playwright/test'
import path from 'node:path'
import * as screens from '../e2e/screens'
import { quietEnv } from '../e2e/launch'
import * as steps from './app-steps'

const EMAIL = 'ann.reviewer@example.com'
// A value global-setup.ts passes; a plain error when it is missing.
function passed(name: string): string {
  const value = process.env[name]
  if (value === undefined || value === '') throw new Error(`${name} is not set: run global set-up`)
  return value
}

const folder = passed('APPROVALS_LOCAL_FOLDER')
const port = passed('APPROVALS_LOCAL_PORT')
const SERVICE = `http://127.0.0.1:${port}`
const PICTURES = `http://127.0.0.1:${passed('APPROVALS_LOCAL_PICTURE_PORT')}`

let app: ElectronApplication | undefined
let visitor: BrowserContext | undefined

test.afterEach(async () => {
  await visitor?.close()
  await app?.close()
})

// The app in the run's folder, with the dev tools and the test picture store. The run's key is
// left out of the app's environment: the app gets it only through Settings.
async function launchApp(): Promise<ElectronApplication> {
  const env: Record<string, string> = {}
  for (const [name, value] of Object.entries(process.env)) {
    if (value !== undefined && !name.startsWith('APPROVALS_LOCAL_')) env[name] = value
  }
  return electron.launch({
    args: ['.', '--use-mock-keychain'],
    env: {
      ...env,
      ADMAN_USER_DATA_DIR: path.join(folder, 'userData'),
      ADMAN_FAKE_PROVIDERS: '1',
      ADMAN_DEV_TOOLS: '1',
      ADMAN_APPROVALS_TEST_PICTURES: PICTURES,
      ...quietEnv(process.env),
    },
  })
}

type Loaded = { complete: boolean; naturalWidth: number }
const loaded = (img: unknown) => ((img as Loaded).complete ? (img as Loaded).naturalWidth : 0)

async function openVisitor(browser: Browser, link: string): Promise<Page> {
  visitor = await browser.newContext()
  const page = await visitor.newPage()
  await page.goto(link)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Review campaign')
  await page.getByLabel('Password').fill('not the password at all')
  await page.getByRole('button', { name: 'Open' }).click()
  await expect(page.locator('main [role=alert]')).toContainText('That password did not work.')
  await page.getByLabel('Password').fill(steps.LINK_PASSWORD)
  await page.getByRole('button', { name: 'Open' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(screens.E2E_CAMPAIGN)
  // "Check first": Chromium keeps the __Host- session cookie from http://localhost.
  const cookies = await visitor.cookies()
  expect(cookies.filter((c) => c.name.startsWith('__Host-adman-')).length).toBe(1)
  const picture = page.getByRole('article').getByRole('img')
  await expect.poll(() => picture.evaluate(loaded)).toBeGreaterThan(0)
  return page
}

test('link, password, sign-off, edit, update, turn off: app and visitor agree', async ({
  browser,
}) => {
  app = await launchApp()
  const page = await app.firstWindow()
  await steps.setUpSettings(page, SERVICE, passed('APPROVALS_LOCAL_KEY'))
  await screens.createProject(page, 'Approvals Local')
  await screens.loadBriefAndCreate(app, page)
  await screens.openCampaign(page)

  const address = await steps.makeLink(page)
  expect(address).toMatch(new RegExp(`^${SERVICE}/l/[A-Za-z0-9]{12}$`))
  const link = address.replace(`${SERVICE}/`, `http://localhost:${port}/`)
  const gallery = await openVisitor(browser, link)
  const card = gallery.getByRole('article')
  await card.getByLabel('Your email').fill(EMAIL)
  await card.getByRole('button', { name: 'Sign off' }).click()
  await expect(gallery.locator('main [role=status]')).toHaveText('Your sign-off was saved.')

  await steps.refresh(page)
  await expect(steps.bar(page).getByText('Signed off: 1 of 1 variant')).toBeVisible()
  await expect(steps.grid(page).getByText('Signed off by 1')).toBeVisible()
  await steps.editVariant(page)
  await expect(steps.grid(page).getByText('Changed since sign-off')).toBeVisible()
  const dialog = await steps.updateGallery(page)
  const earlier = new RegExp(`^${EMAIL.replaceAll('.', '\\.')} · .* · for an earlier version$`)
  await expect(dialog.getByText(earlier)).toBeVisible()
  await dialog.getByRole('button', { name: 'Close' }).click()

  // The visitor's gallery: the new title and the sign-off under "For an earlier version".
  await gallery.goto(link)
  await expect(card.getByRole('heading', { level: 2 })).toHaveText(steps.EDITED_TITLE)
  await expect(card.getByText('No sign-offs yet.')).toBeVisible()
  const older = card.getByRole('heading', { level: 3, name: 'For an earlier version' })
  await expect(older).toBeVisible()
  await expect(card).toContainText(`${EMAIL} · `)

  await steps.refresh(page)
  await expect(steps.grid(page).getByText('Earlier version signed off')).toBeVisible()
  await steps.grid(page).getByRole('button', { name: 'Sign-offs (1)' }).click()
  await expect(steps.grid(page).getByText(earlier)).toBeVisible()

  // Turned off: the same address shows the password page and nothing else.
  await steps.turnOffLink(page)
  await gallery.goto(link)
  await expect(gallery.getByRole('heading', { level: 1 })).toHaveText('Review campaign')
  await expect(gallery.getByLabel('Password')).toBeVisible()
  await expect(gallery.getByRole('article')).toHaveCount(0)
  await expect(gallery.getByRole('img')).toHaveCount(0)
  const text = (await gallery.locator('body').textContent()) ?? ''
  expect(text).not.toContain(screens.E2E_CAMPAIGN)
  expect(text).not.toContain(EMAIL)
})

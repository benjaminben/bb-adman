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
import { ffmpegFetched } from '../e2e/export-steps'
import { firstIds } from '../e2e/held-run'
import { quietEnv } from '../e2e/launch'
import { command } from '../e2e/render-helpers'
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
  const picture = page
    .getByRole('article')
    .getByRole('button', { name: /^View larger: / })
    .locator('img')
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
  const title = await card.getByRole('heading', { level: 2 }).textContent()
  await gallery.getByLabel('Signing off as:').fill(EMAIL)
  await card.getByRole('button', { name: `Sign off: ${title ?? ''}` }).click()
  await expect(gallery.locator('main [role=status]')).toHaveText('Your sign-off was saved.')
  await expect(card.getByRole('button', { name: /^Sign off: / })).toHaveCount(0)
  await expect(card.getByText(/^Signed off by \d+$/)).toHaveText('Signed off by 1')

  await steps.refresh(page)
  await expect(steps.bar(page).getByText('Signed off: 1 of 1 variant')).toBeVisible()
  await expect(steps.grid(page).getByTitle('Signed off by 1')).toBeVisible()
  // R-10: the edit leaves the sign-off on an older version, so the app shows none at once.
  await steps.editVariant(page)
  await expect(steps.grid(page).getByTitle('Changed since published')).toBeVisible()
  await expect(steps.grid(page).getByTitle('Signed off by 1')).toHaveCount(0)
  await expect(steps.grid(page).getByTitle(/^Signed off by/)).toHaveCount(0)
  const dialog = await steps.updateGallery(page)
  await expect(dialog.getByText('No sign-offs yet.')).toBeVisible()
  await expect(dialog.getByText(EMAIL)).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Close' }).click()

  // The visitor's gallery: the new title, and the card needs a sign-off again.
  await gallery.goto(link)
  await expect(card.getByRole('heading', { level: 2 })).toHaveText(steps.EDITED_TITLE)
  await expect(card.getByRole('button', { name: `Sign off: ${steps.EDITED_TITLE}` })).toBeVisible()
  // The card's count line; the closed lightbox's "Signed off by" heading is not it.
  await expect(card.getByText(/^Signed off by \d+$/)).toHaveCount(0)
  await expect(gallery.getByRole('heading', { name: 'For an earlier version' })).toHaveCount(0)

  await steps.refresh(page)
  await expect(steps.bar(page).getByText('Signed off: 0 of 1 variant')).toBeVisible()
  await expect(steps.grid(page).getByTitle(/earlier version|Changed since/i)).toHaveCount(0)
  await expect(steps.grid(page).getByTitle(/^Signed off by/)).toHaveCount(0)
  await expect(steps.grid(page).getByText(EMAIL)).toHaveCount(0)

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

const VIDEO_PROJECT = 'Approvals Video'
const userData = path.join(folder, 'userData')

async function signIn(browser: Browser, link: string): Promise<Page> {
  visitor = await browser.newContext()
  const page = await visitor.newPage()
  await page.goto(link)
  await page.getByLabel('Password').fill(steps.LINK_PASSWORD)
  await page.getByRole('button', { name: 'Open' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(screens.E2E_CAMPAIGN)
  return page
}

// The lightbox's player: its <source> answers 206 once play is pressed. Gives the readyState
// reached within 15 s (muted here only to keep the browser's autoplay rule out of the test).
async function playShown(gallery: Page): Promise<number> {
  const video = gallery.locator('dialog[open] video')
  const source = await video.locator('source').getAttribute('src')
  expect(source).toMatch(/^\/l\/[A-Za-z0-9]{12}\/c\/[^/]+\/\d+$/)
  const reply = gallery.waitForResponse((r) => new URL(r.url()).pathname === source)
  const ready = video.evaluate(
    (v: HTMLVideoElement) =>
      new Promise<number>((resolve) => {
        v.muted = true
        const done = () => resolve(v.readyState)
        v.addEventListener('loadeddata', done)
        v.addEventListener('error', done)
        setTimeout(done, 15_000)
        v.play().catch(() => {})
      }),
  )
  expect((await reply).status()).toBe(206)
  return ready
}

test('a video variant: its clip is made, played, and made again only after an edit', async ({
  browser,
}) => {
  test.skip(!ffmpegFetched(), 'FFmpeg is not fetched.')
  steps.freshUserData(folder)
  app = await launchApp()
  const page = await app.firstWindow()
  await steps.setUpSettings(page, SERVICE, passed('APPROVALS_LOCAL_KEY'))
  await screens.createProject(page, VIDEO_PROJECT)
  await screens.loadBriefAndCreate(app, page)
  await screens.openCampaign(page)
  const ids = await firstIds(page)
  await steps.closeProject(page, VIDEO_PROJECT)
  steps.plantVideo(ids.filePath, ids.variantId, 2000)
  await steps.reopenProject(page, VIDEO_PROJECT)

  const link = (await steps.makeLink(page)).replace(`${SERVICE}/`, `http://localhost:${port}/`)
  const first = steps.clipsIn(userData, ids)
  expect(first).toHaveLength(1)
  const gallery = await signIn(browser, link)
  const card = gallery.getByRole('article')
  await expect(card.getByText('Video 0:02')).toBeVisible()
  const title = (await card.getByRole('heading', { level: 2 }).textContent()) ?? ''
  await card.getByRole('button', { name: `Open video: ${title}, 0:02` }).click()
  const readyState = await playShown(gallery)
  test.info().annotations.push({ type: 'readyState', description: String(readyState) })
  expect(readyState).toBeGreaterThanOrEqual(2)

  // An edit: "Update gallery" makes the clip again, under the new rev's name.
  await steps.editVariant(page)
  await steps.bar(page).getByRole('button', { name: 'Approval link…' }).click()
  const box = steps.dialog(page)
  await box.getByRole('button', { name: 'Update gallery' }).click()
  await expect(box.getByText('Making video 1 of 1…')).toBeVisible({ timeout: 60_000 })
  await expect(box.getByText('1 variant changed since.')).toBeHidden({ timeout: 120_000 })
  await box.getByRole('button', { name: 'Close' }).click()
  const second = steps.clipsIn(userData, ids)
  expect(second).toHaveLength(1)
  expect(second).not.toEqual(first)

  // No edit: nothing is made again.
  const reply = await command(page, 'approvals.publish', {
    projectId: ids.projectId,
    campaignId: ids.campaignId,
  })
  expect(reply).toMatchObject({ clips: 0 })
  expect(steps.clipsIn(userData, ids)).toEqual(second)

  await gallery.goto(link)
  await expect(card.getByRole('heading', { level: 2 })).toHaveText(steps.EDITED_TITLE)
  await card.getByRole('button', { name: `Open video: ${steps.EDITED_TITLE}, 0:02` }).click()
  expect(await playShown(gallery)).toBeGreaterThanOrEqual(2)
})

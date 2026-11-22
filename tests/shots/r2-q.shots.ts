// R2-Q: three fixes from hand testing, with the fake providers (nothing leaves the computer).
// r2-q-1: the Direction menu opened in a narrow window, fully inside it, lined up with its
// button's right edge, and no sideways scroll. r2-q-2: the direction row's "Fan out…",
// "Nothing to sync" and "Direction" at one height. r2-q-3: the brief form opened by the top
// bar's "+" ("New campaign") from a campaign tab, focus in its first field; its select and its
// buttons at one height. Made-up names only.
import path from 'node:path'
import { test, expect, type Locator, type Page } from '@playwright/test'
import * as screens from '../e2e/screens'
import { command, query } from '../e2e/render-helpers'
import { closeApp, openApp, shot, type Session } from './shot'

const CAMPAIGN = 'Harbour Kite Club'
const NARROW = { width: 900, height: 700 }

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

async function openCampaign(page: Page) {
  await screens.createProject(page, 'Harbour Kites')
  const state = (await query(page, 'app.getState', {})) as {
    openProjects: { projectId: string }[]
  }
  const projectId = state.openProjects[0]!.projectId
  await command(page, 'campaign.create', {
    projectId,
    brief: {
      campaignName: CAMPAIGN,
      region: 'US',
      audience: 'Weekend sailors',
      message: 'Wind on the water',
      callToAction: 'Join the club',
      subjects: [{ name: 'Kite' }],
    },
    subjectMap: [{ subjectId: 'kite', create: true }],
    languages: ['en'],
    sizes: [{ label: '1080x1080', width: 1080, height: 1080 }],
    templateId: 'starter',
  })
  await page.getByRole('button', { name: `Open ${CAMPAIGN}` }).click()
  await expect(page.getByRole('heading', { name: CAMPAIGN, level: 2 })).toBeVisible()
}

// The widest sideways overflow of any box that scrolls, the page included.
function sidewaysScroll(): number {
  let most = 0
  for (const el of [document.documentElement, ...document.querySelectorAll('*')]) {
    const x = getComputedStyle(el).overflowX
    if (el !== document.documentElement && x !== 'auto' && x !== 'scroll') continue
    most = Math.max(most, el.scrollWidth - el.clientWidth)
  }
  return most
}

async function height(of: Locator): Promise<number> {
  const box = await of.boundingBox()
  return box?.height ?? -1
}

const trigger = (page: Page) => page.getByRole('button', { name: 'Direction', exact: true })

test('The Direction menu stays inside a narrow window', async () => {
  test.setTimeout(180_000)
  session = await openApp()
  const { page } = session
  await openCampaign(page)
  await page.setViewportSize(NARROW)
  const before = await page.evaluate(sidewaysScroll)
  await trigger(page).click()
  const menu = page.getByRole('menu', { name: /^Direction / })
  await expect(menu).toBeVisible()
  await expect(menu).toHaveAttribute('data-inline', 'end')
  const box = (await menu.boundingBox())!
  const button = (await trigger(page).boundingBox())!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(NARROW.width)
  expect(Math.round(box.x + box.width)).toBe(Math.round(button.x + button.width))
  expect(await page.evaluate(sidewaysScroll)).toBe(before)
  await page.screenshot({ path: path.resolve('shots', 'r2-q-1-direction-menu-narrow.png') })
})

test('The direction row draws its three controls at one height', async () => {
  test.setTimeout(180_000)
  session = await openApp()
  const { page } = session
  await openCampaign(page)
  const fanOut = await height(page.getByRole('button', { name: 'Fan out…' }))
  expect(fanOut).toBeGreaterThan(0)
  expect(await height(page.getByRole('button', { name: 'Nothing to sync' }))).toBe(fanOut)
  expect(await height(trigger(page))).toBe(fanOut)
  await shot(page, 'r2-q-2-direction-row')
})

test('"+" opens the new campaign form from a campaign tab', async () => {
  test.setTimeout(180_000)
  session = await openApp()
  const { page } = session
  await openCampaign(page)
  const plus = page.getByRole('button', { name: 'New campaign' })
  await expect(plus).toHaveAttribute('title', 'New campaign')
  await plus.click()
  await expect(page.getByRole('tab', { name: 'Project' })).toHaveAttribute('aria-selected', 'true')
  const form = page.getByRole('region', { name: 'Brief' })
  await expect(form.getByLabel('Campaign name')).toBeFocused()
  const create = await height(form.getByRole('button', { name: 'Create campaign' }))
  expect(create).toBeGreaterThan(0)
  expect(await height(form.getByRole('combobox', { name: 'Master size' }))).toBe(create)
  await shot(page, 'r2-q-3-new-campaign')
})

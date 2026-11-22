// ST-11: the campaign page in the app style, from the S2-16 brief. Two directions ("Direction
// 1" and a second made with "New direction from this master…"), the first with a 9:16 and a
// 1:1 variant added through variant.add, so the tile shapes and their action buttons show.
// 197: the overview with one tile chosen. Made-up names only.
import { test, expect, type Page } from '@playwright/test'
import path from 'node:path'
import * as screens from '../e2e/screens'
import { closeApp, openApp, shot, type Session } from './shot'

const BRIEF = path.resolve('tests/shots/fixtures/s2-16-brief.yaml')
const CAMPAIGN = 'Alpine Spring Water'

type Reply = { ok: boolean; data: unknown }
type Api = { api: { query: (n: string, i: unknown) => Promise<Reply> } }
type Ids = { projectId: string; directionId: string }

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

function readIds(page: Page): Promise<Ids> {
  return page.evaluate(async () => {
    const { api } = window as unknown as Api
    const state = (await api.query('app.getState', {})).data as {
      openProjects: { projectId: string }[]
    }
    const projectId = state.openProjects[0]?.projectId ?? ''
    const project = (await api.query('project.get', { projectId })).data as {
      campaigns: { id: string }[]
    }
    const campaignId = project.campaigns[0]?.id ?? ''
    const campaign = (await api.query('campaign.get', { projectId, campaignId })).data as {
      directions: { id: string }[]
    }
    return { projectId, directionId: campaign.directions[0]?.id ?? '' }
  })
}

async function addVariant(page: Page, input: unknown): Promise<void> {
  const reply = await page.evaluate(
    (i) =>
      (
        window as unknown as { api: { command: (n: string, i: unknown) => Promise<Reply> } }
      ).api.command('variant.add', i),
    input,
  )
  expect(reply.ok).toBe(true)
}

test('the campaign grid with two directions and several sizes', async () => {
  test.setTimeout(180_000)
  session = await openApp()
  const { app, page } = session
  await screens.createProject(page, 'Alpine Spring')
  await screens.answerOpenDialog(app, [BRIEF])
  await page.getByRole('button', { name: 'Load a brief' }).click()
  await page
    .getByRole('region', { name: 'Brief' })
    .getByRole('button', { name: 'Create campaign' })
    .click()
  await expect(page.getByRole('heading', { name: CAMPAIGN, level: 2 })).toBeVisible()

  const { projectId, directionId } = await readIds(page)
  for (const [sizeLabel, language] of [
    ['9x16', 'en'],
    ['1x1', 'de'],
  ] as const) {
    await addVariant(page, { projectId, directionId, sizeLabel, language, format: 'image' })
  }
  const first = page.getByRole('region', { name: 'Direction 1' })
  await expect(first.getByText('3 variant(s)')).toBeVisible()

  await first.getByRole('button', { name: 'Direction', exact: true }).click()
  await page.getByRole('menuitem', { name: 'New direction from this master…' }).click()
  const make = page.getByRole('dialog', { name: 'New direction' })
  await make.getByRole('textbox', { name: 'Name' }).fill('Studio')
  await make.getByRole('button', { name: 'Make direction' }).click()
  await expect(make).toBeHidden()
  await expect(page.getByRole('list', { name: /^Variants in / })).toHaveCount(2)

  const pictures = page.getByRole('list', { name: /^Variants in / }).locator('img')
  await expect(pictures).toHaveCount(4)
  for (const img of await pictures.all()) {
    await expect
      .poll(() => img.evaluate((i: HTMLImageElement) => i.naturalWidth))
      .toBeGreaterThan(0)
  }
  await page.mouse.move(0, 0)
  await shot(page, '197-campaign-grid')
})

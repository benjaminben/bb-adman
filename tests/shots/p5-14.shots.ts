// P5-14: the campaign overview's Undo and Redo and its one grid per direction, from the S2-16
// brief (two languages, three sizes). campaign.create makes one direction with its master.
// 151: after one campaign change (a rule set edit through ruleSet.update), Undo is enabled.
// 150: the direction with two more variants made through variant.add. Made-up names only.
import { test, expect, type Page } from '@playwright/test'
import path from 'node:path'
import * as screens from '../e2e/screens'
import { closeApp, openApp, shot, type Session } from './shot'

const BRIEF = path.resolve('tests/shots/fixtures/s2-16-brief.yaml')
const CAMPAIGN = 'Alpine Spring Water'

type Reply = { ok: boolean; data: unknown }
type Api = {
  api: {
    query: (name: string, input: unknown) => Promise<Reply>
    command: (name: string, input: unknown) => Promise<Reply>
  }
}
type Ids = { projectId: string; campaignId: string; directionId: string; direction: string }

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

// The open project, its one campaign and that campaign's first direction.
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
      directions: { id: string; name: string }[]
    }
    const first = campaign.directions[0]
    return { projectId, campaignId, directionId: first?.id ?? '', direction: first?.name ?? '' }
  })
}

async function send(page: Page, name: string, input: unknown): Promise<void> {
  const reply = await page.evaluate(
    ([n, i]) => (window as unknown as Api).api.command(n as string, i),
    [name, input] as const,
  )
  expect(reply.ok).toBe(true)
}

test('Campaign Undo and the grid per direction', async () => {
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
  const ids = await readIds(page)
  const changes = page.getByRole('group', { name: 'Campaign changes' })
  await expect(changes.getByRole('button', { name: 'Undo' })).toBeDisabled()

  const { projectId, campaignId, directionId } = ids
  await send(page, 'ruleSet.update', { projectId, campaignId, palette: ['#1F6FEB'] })
  await expect(changes.getByRole('button', { name: 'Undo' })).toBeEnabled()
  await expect(changes.getByRole('button', { name: 'Redo' })).toBeDisabled()
  await shot(page, '151-campaign-undo')

  for (const [sizeLabel, language] of [
    ['9x16', 'en'],
    ['1x1', 'de'],
  ] as const) {
    await send(page, 'variant.add', {
      projectId,
      directionId,
      sizeLabel,
      language,
      format: 'image',
    })
  }
  const section = page.getByRole('region', { name: ids.direction })
  const grid = section.getByRole('list', { name: `Variants in ${ids.direction}`, exact: true })
  await expect(grid.getByRole('listitem')).toHaveCount(3)
  await expect(section.getByText('3 variant(s)')).toBeVisible()
  // Each tile's thumbnail drawn (alt is empty, so they are found as img elements).
  const pictures = grid.locator('img')
  await expect(pictures).toHaveCount(3)
  for (const img of await pictures.all()) {
    await expect
      .poll(() => img.evaluate((i: HTMLImageElement) => i.naturalWidth))
      .toBeGreaterThan(0)
  }
  await shot(page, '150-direction-grid')
})

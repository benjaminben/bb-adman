// P5-15: the tile's actions (quick look and delete) and their dialogs, on the S2-16 brief's
// campaign with two more variants made through variant.add (as p5-14). 152: the tiles with
// "+", quick look and, except on the master, delete. 153: quick look on the master. 154: after
// Next. 155: the delete warning, "Keep" focused. Nothing is deleted. Made-up names only.
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
type Ids = { projectId: string; directionId: string; direction: string }

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
      directions: { id: string; name: string }[]
    }
    const first = campaign.directions[0]
    return { projectId, directionId: first?.id ?? '', direction: first?.name ?? '' }
  })
}

async function send(page: Page, name: string, input: unknown): Promise<void> {
  const reply = await page.evaluate(
    ([n, i]) => (window as unknown as Api).api.command(n as string, i),
    [name, input] as const,
  )
  expect(reply.ok).toBe(true)
}

async function pictureDrawn(page: Page): Promise<void> {
  const img = page.getByRole('dialog').locator('img')
  await expect(img).toHaveCount(1)
  await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0)
}

test('Tile actions: quick look and the delete warning', async () => {
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
  for (const [sizeLabel, language] of [
    ['9x16', 'en'],
    ['1x1', 'de'],
  ] as const) {
    await send(page, 'variant.add', {
      projectId: ids.projectId,
      directionId: ids.directionId,
      sizeLabel,
      language,
      format: 'image',
    })
  }
  const grid = page
    .getByRole('region', { name: ids.direction })
    .getByRole('list', { name: `Variants in ${ids.direction}`, exact: true })
  await expect(grid.getByRole('listitem')).toHaveCount(3)
  const looks = grid.getByRole('button', { name: /^Quick look at / })
  await expect(looks).toHaveCount(3)
  await expect(grid.getByRole('button', { name: /^Delete / })).toHaveCount(2)
  await shot(page, '152-tile-actions')

  await looks.first().click()
  await expect(page.getByRole('dialog').getByText('1 of 3')).toBeVisible()
  await pictureDrawn(page)
  await shot(page, '153-quick-look')

  await page.getByRole('dialog').getByRole('button', { name: 'Next' }).click()
  await expect(page.getByRole('dialog').getByText('2 of 3')).toBeVisible()
  await pictureDrawn(page)
  await shot(page, '154-quick-look-next')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(looks.first()).toBeFocused()

  const remove = grid.getByRole('button', { name: /^Delete / }).first()
  const title = ((await remove.getAttribute('aria-label')) ?? '').replace(/^Delete /, '')
  await remove.click()
  const warning = page.getByRole('dialog', { name: `Delete ${title}?` })
  await expect(warning.getByText('This cannot be undone.')).toBeVisible()
  await expect(warning.getByRole('button', { name: 'Keep' })).toBeFocused()
  await shot(page, '155-delete-variant-confirm')
  await warning.getByRole('button', { name: 'Keep' }).click()
  await expect(grid.getByRole('listitem')).toHaveCount(3)
})

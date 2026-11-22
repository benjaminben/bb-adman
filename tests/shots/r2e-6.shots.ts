// R2E-6: results elsewhere (spec/phases/round-2-editor.md D6, "Elsewhere"). The campaign comes
// from the S2-16 brief, with a second post added. 328: the window shows the second post's tab
// while the fake provider makes a picture for the first post's background; the result notice
// says where it is, and Show goes there. 329: on the campaign page, the finished run's row has
// "Choose in the editor", which opens the post with that layer. Reduce motion and a fixed
// Math.random keep the window still. Only the fake provider runs; nothing leaves this machine.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import path from 'node:path'
import * as screens from '../e2e/screens'
import { answerQuit } from '../e2e/quit-answer'
import { command, query } from '../e2e/render-helpers'
import { closeApp, openApp, shot, type Session } from './shot'

const BRIEF = path.resolve('tests/shots/fixtures/s2-16-brief.yaml')

let session: Session | undefined

test.afterEach(async () => {
  if (session) await answerQuit(session.app)
  await closeApp(session)
  session = undefined
})

type Ids = { projectId: string; variantId: string; layerId: string; layerName: string }

// The project and its campaign, a second post, and the first post's background layer.
async function setUp(app: ElectronApplication, page: Page): Promise<Ids> {
  await page.addInitScript(() => {
    Math.random = () => 0.3
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  await screens.createProject(page, 'Alpine Spring')
  await screens.answerOpenDialog(app, [BRIEF])
  await page.getByRole('button', { name: 'Load a brief' }).click()
  await page
    .getByRole('region', { name: 'Brief' })
    .getByRole('button', { name: 'Create campaign' })
    .click()
  await expect(page.getByRole('list', { name: 'Variants' }).getByRole('listitem')).toHaveCount(1)
  const state = (await query(page, 'app.getState', {})) as {
    openProjects: { projectId: string }[]
  }
  const projectId = state.openProjects[0]!.projectId
  const project = (await query(page, 'project.get', { projectId })) as {
    campaigns: { id: string }[]
  }
  const campaignId = project.campaigns[0]!.id
  const campaign = (await query(page, 'campaign.get', { projectId, campaignId })) as {
    variants: { id: string }[]
    directions: { id: string }[]
  }
  const variantId = campaign.variants[0]!.id
  const directionId = campaign.directions[0]!.id
  await command(page, 'variant.add', {
    ...{ projectId, directionId, sizeLabel: '9x16', language: 'en', format: 'image' },
  })
  await expect(page.getByRole('list', { name: 'Variants' }).getByRole('listitem')).toHaveCount(2)
  const got = (await query(page, 'variant.get', { projectId, variantId })) as {
    layers: { id: string; type: string; name: string }[]
  }
  const background = got.layers.find((l) => l.type === 'background')!
  return { projectId, variantId, layerId: background.id, layerName: background.name }
}

async function makePicture(page: Page, ids: Ids) {
  await command(page, 'generation.runImages', {
    ...{ projectId: ids.projectId, variantId: ids.variantId, layerId: ids.layerId },
    prompt: 'A sunlit alpine meadow at first light, wide and calm',
    referenceAssetIds: [],
    count: 1,
    provider: 'fake',
  })
}

test('A run that finishes on another post says where its pictures are', async () => {
  session = await openApp()
  const { app, page } = session
  const ids = await setUp(app, page)
  const tiles = page.getByRole('list', { name: 'Variants' }).getByRole('listitem')
  await tiles.last().getByRole('button').first().dblclick()
  await expect(page.getByRole('region', { name: /^Canvas, / })).toBeVisible()
  await makePicture(page, ids)
  const notice = page.getByRole('status').filter({ hasText: 'New pictures are ready' })
  await expect(notice).toBeVisible({ timeout: 20_000 })
  await expect(notice).toContainText(ids.layerName)
  await page.waitForTimeout(500)
  await shot(page, '328-result-notice-other-tab')
  await notice.getByRole('button', { name: 'Show' }).click()
  await expect(notice).toBeHidden()
  await expect(page.getByRole('group', { name: 'Generate' })).toBeVisible()
})

test('The run list offers Choose in the editor for a finished picture run', async () => {
  session = await openApp()
  const { app, page } = session
  const ids = await setUp(app, page)
  await page.getByRole('list', { name: 'Variants' }).getByRole('button').first().click()
  await makePicture(page, ids)
  const runs = page.getByRole('list', { name: 'Runs' })
  const choose = runs.getByRole('button', { name: 'Choose in the editor' })
  await expect(choose).toBeVisible({ timeout: 20_000 })
  await choose.scrollIntoViewIfNeeded()
  await page.waitForTimeout(500)
  await shot(page, '329-run-row-choose-in-editor')
  await choose.click()
  await expect(page.getByRole('region', { name: /^Canvas, / })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Generate' })).toBeVisible()
})

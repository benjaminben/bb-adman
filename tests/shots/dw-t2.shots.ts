// T2 (spec/phases/design-wave.md, "T2 — Base controls"): the screens at the design wave's
// smaller control and row heights, page titles at 24px, h2 and h3 at 17px, cards with no
// shadow and menus at elevation 2. 400 Settings, 401 the project home, 402 the campaign page,
// 403 the editor with a text layer selected, 404 the run dialog with the fake provider chosen
// (cancelled; nothing is sent). The campaign comes from the S2-16 brief. Reduce motion and a
// fixed Math.random keep the window still. Nothing leaves this machine.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import path from 'node:path'
import * as screens from '../e2e/screens'
import { answerQuit } from '../e2e/quit-answer'
import { query } from '../e2e/render-helpers'
import { closeApp, openApp, shot, type Session } from './shot'

const BRIEF = path.resolve('tests/shots/fixtures/s2-16-brief.yaml')
const CAMPAIGN = 'Alpine Spring Water'

let session: Session | undefined

test.afterEach(async () => {
  if (session) await answerQuit(session.app)
  await closeApp(session)
  session = undefined
})

async function holdStill(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Math.random = () => 0.3
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
}

// The project and its campaign; returns the names of the first post's layers by type.
async function setUp(app: ElectronApplication, page: Page) {
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
  }
  const variantId = campaign.variants[0]!.id
  const got = (await query(page, 'variant.get', { projectId, variantId })) as {
    layers: { type: string; name: string }[]
  }
  const named = (type: string) => got.layers.find((l) => l.type === type)!.name
  return { text: named('text'), background: named('background') }
}

test('Settings at the design wave heights', async () => {
  session = await openApp()
  const { page } = session
  await holdStill(page)
  await expect(await screens.openSettings(page)).toBeVisible()
  await page.waitForTimeout(300)
  await shot(page, '400-settings')
})

test('Project home, campaign page, editor and run dialog at the design wave heights', async () => {
  session = await openApp()
  const { app, page } = session
  await holdStill(page)
  const layers = await setUp(app, page)
  await page.waitForTimeout(300)
  await shot(page, '402-campaign-page')

  await page.getByRole('button', { name: 'Back to project' }).click()
  await expect(page.getByRole('list', { name: 'Campaigns' })).toBeVisible()
  await page.waitForTimeout(300)
  await shot(page, '401-project-home')

  await page.getByRole('button', { name: `Open ${CAMPAIGN}` }).click()
  await page.getByRole('list', { name: 'Variants' }).getByRole('button').first().dblclick()
  await expect(page.getByRole('region', { name: /^Canvas, / })).toBeVisible()
  await page.getByRole('button', { name: new RegExp(`^${layers.text}`) }).click()
  await page.waitForTimeout(500)
  await shot(page, '403-editor-text-layer')

  await page.getByRole('button', { name: new RegExp(`^${layers.background}`) }).click()
  const panel = page.getByRole('group', { name: 'Generate' })
  await panel.getByRole('button', { name: 'Generate…' }).click()
  const run = page.getByRole('dialog', { name: 'Make pictures' })
  await run.getByRole('radio', { name: 'Fake provider' }).check()
  await page.waitForTimeout(300)
  await shot(page, '404-run-dialog')
  await run.getByRole('button', { name: 'Cancel' }).click()
  await expect(run).toBeHidden()
})

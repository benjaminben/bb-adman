// ED-1b (spec/phases/design-wave-screens-a.md): the properties panel's frame. 423: a locked
// text layer selected, the head with its type icon, name and Locked mark, Position folded with
// its "{x}, {y}" summary. 424: nothing selected on a video post, "Select a layer" with the
// InfoTip about making a video. The campaign comes from the S2-16 brief.
import { test, expect, type Page } from '@playwright/test'
import path from 'node:path'
import * as screens from '../e2e/screens'
import { command } from '../e2e/render-helpers'
import { closeApp, openApp, shot, type Session } from './shot'

const BRIEF = path.resolve('tests/shots/fixtures/s2-16-brief.yaml')

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

async function query(page: Page, name: string, input: unknown): Promise<Record<string, unknown>> {
  return page.evaluate(
    async ([n, i]) => {
      const api = (
        window as unknown as { api: { query: (n: string, i: unknown) => Promise<unknown> } }
      ).api
      return ((await api.query(n, i)) as { data: Record<string, unknown> }).data
    },
    [name, input] as const,
  )
}

async function firstVariant(page: Page): Promise<{ projectId: string; variantId: string }> {
  const state = await query(page, 'app.getState', {})
  const projectId = (state.openProjects as { projectId: string }[])[0]!.projectId
  const project = await query(page, 'project.get', { projectId })
  const campaignId = (project.campaigns as { id: string }[])[0]!.id
  const campaign = await query(page, 'campaign.get', { projectId, campaignId })
  return { projectId, variantId: (campaign.variants as { id: string }[])[0]!.id }
}

// A still window (reduce motion, a fixed Math.random), a project and the brief's campaign.
async function campaign(s: Session): Promise<void> {
  const { app, page } = s
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
}

async function openEditor(page: Page): Promise<void> {
  await page.getByRole('list', { name: 'Variants' }).getByRole('button').first().dblclick()
  await expect(page.getByRole('region', { name: /^Canvas, / })).toBeVisible()
}

test('A locked text layer: the head with its Locked mark, Position folded', async () => {
  session = await openApp()
  const { page } = session
  await campaign(session)
  await openEditor(page)
  const list = page.getByRole('list', { name: 'Layers' })
  await list.getByRole('button', { name: /^Lock Headline/ }).click()
  await list
    .getByRole('button', { name: /^Headline/ })
    .first()
    .click()
  const properties = page.getByRole('region', { name: 'Properties' })
  await expect(properties.getByRole('button', { name: 'Locked. Unlock' })).toBeVisible()
  await expect(properties.getByRole('button', { name: 'Position' })).toHaveAttribute(
    'aria-expanded',
    'false',
  )
  await page.mouse.move(640, 790)
  await page.waitForTimeout(300)
  await shot(page, '423-properties-locked-text')
})

test('Nothing selected on a video post', async () => {
  session = await openApp()
  const { page } = session
  await campaign(session)
  const { projectId, variantId } = await firstVariant(page)
  await command(page, 'variant.setFormat', { projectId, variantId, format: 'video' })
  await openEditor(page)
  const properties = page.getByRole('region', { name: 'Properties' })
  await expect(properties.getByText('Select a layer', { exact: true })).toBeVisible()
  await expect(properties.getByRole('button', { name: 'About making a video' })).toBeVisible()
  await page.mouse.move(640, 790)
  await page.waitForTimeout(300)
  await shot(page, '424-properties-empty-video')
})

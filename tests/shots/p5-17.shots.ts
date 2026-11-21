// P5-17: the sync review, from the S2-16 brief. Two more variants come from variant.add (one in
// the master's language, one in German); the English one's headline colour is changed by hand
// first (an override), then the master's headline text and colour. 162: both variants out of
// date. 163: the review. 164: a change ticked and "Take the master's" chosen for the override.
// 165: after "Accept all", nothing to sync. Made-up names only.
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
type Variant = { id: string; sizeLabel: string; language: string }
type Ids = { projectId: string; campaignId: string; directionId: string; direction: string }
type Read = Ids & { masterId: string; variants: Variant[] }

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

async function query(page: Page, name: string, input: unknown): Promise<unknown> {
  const reply = await page.evaluate(
    ([n, i]) => (window as unknown as Api).api.query(n as string, i),
    [name, input] as const,
  )
  expect(reply.ok).toBe(true)
  return reply.data
}

async function send(page: Page, name: string, input: unknown): Promise<void> {
  const reply = await page.evaluate(
    ([n, i]) => (window as unknown as Api).api.command(n as string, i),
    [name, input] as const,
  )
  expect(reply.ok).toBe(true)
}

// The open project, its one campaign, that campaign's first direction and its variants.
async function readIds(page: Page): Promise<Read> {
  const state = (await query(page, 'app.getState', {})) as {
    openProjects: { projectId: string }[]
  }
  const projectId = state.openProjects[0]?.projectId ?? ''
  const project = (await query(page, 'project.get', { projectId })) as {
    campaigns: { id: string }[]
  }
  const campaignId = project.campaigns[0]?.id ?? ''
  const campaign = (await query(page, 'campaign.get', { projectId, campaignId })) as {
    directions: { id: string; name: string; masterVariantId: string }[]
    variants: Variant[]
  }
  const first = campaign.directions[0]
  return {
    projectId,
    campaignId,
    directionId: first?.id ?? '',
    direction: first?.name ?? '',
    masterId: first?.masterVariantId ?? '',
    variants: campaign.variants,
  }
}

// The first text layer of a variant: the headline in the starter template.
async function headline(page: Page, projectId: string, variantId: string): Promise<string> {
  const read = (await query(page, 'variant.get', { projectId, variantId })) as {
    layers: { id: string; type: string }[]
  }
  const layer = read.layers.find((l) => l.type === 'text')
  expect(layer).toBeDefined()
  return layer?.id ?? ''
}

test('The sync review', async () => {
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
  const { projectId, directionId } = ids
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
  await expect(section.getByText('3 variant(s)')).toBeVisible()
  await expect(section.getByRole('button', { name: 'Nothing to sync' })).toBeDisabled()

  const { variants } = await readIds(page)
  const tall = variants.find((v) => v.sizeLabel === '9x16')
  expect(tall).toBeDefined()
  const own = await headline(page, projectId, tall?.id ?? '')
  await send(page, 'layer.update', {
    projectId,
    layerId: own,
    patch: { style: { color: '#C2185B' } },
  })
  const master = await headline(page, projectId, ids.masterId)
  await send(page, 'layer.update', {
    projectId,
    layerId: master,
    patch: { copy: 'Fresh from the peaks', style: { color: '#1F6FEB' } },
  })

  const button = section.getByRole('button', { name: 'Sync 2 out of date…' })
  await expect(button).toBeEnabled()
  await expect(section.getByText('Out of date', { exact: true })).toHaveCount(2)
  await shot(page, '162-out-of-date-badges')

  await button.click()
  const dialog = page.getByRole('dialog', { name: `Sync ${ids.direction}` })
  await expect(dialog.getByRole('button', { name: 'Accept all' })).toBeEnabled()
  await expect(dialog.getByText('New text: Fresh from the peaks')).toBeVisible()
  await expect(dialog.getByText(/^No translation yet\./)).toBeVisible()
  await shot(page, '163-sync-review')

  const choice = dialog.getByRole('radiogroup', { name: 'Changed on this variant: style: colour' })
  await expect(choice.getByRole('radio', { name: 'Keep mine' })).toBeChecked()
  await dialog.getByRole('checkbox').first().check()
  await choice.getByRole('radio', { name: "Take the master's" }).check()
  await expect(dialog.getByRole('button', { name: 'Accept selected' })).toBeEnabled()
  await choice.scrollIntoViewIfNeeded()
  await shot(page, '164-sync-overrides')

  await choice.getByRole('radio', { name: 'Keep mine' }).check()
  await dialog.getByRole('button', { name: 'Accept all' }).click()
  await expect(dialog).toBeHidden()
  await expect(section.getByRole('button', { name: 'Nothing to sync' })).toBeDisabled()
  await expect(section.getByText('Out of date', { exact: true })).toHaveCount(0)
  await shot(page, '165-sync-up-to-date')
})

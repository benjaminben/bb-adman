// P6-13: the translation panel with a failed German translation and "Retry" (207), and after
// "Export translation sheet…" (208). German posts are added through the window's api as in
// p6-12.shots.ts. The failure is a real one of the fake provider: while the master's texts are
// 5000 characters long, its answer ("[de] " in front) is too long to keep, so the job fails;
// the texts are then put back. The native save dialog is answered by a stub in the main
// process (as save-picker.spec.ts does). Only the fake provider runs; nothing is paid.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import path from 'node:path'
import * as screens from '../e2e/screens'
import { closeApp, openApp, shot, type Session } from './shot'

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

type Reply = { ok: boolean; data: unknown }
type Api = {
  query(n: string, i?: unknown): Promise<Reply>
  command(n: string, i: unknown): Promise<Reply>
}
type Copy = { layerId: string; copy: string }

// Adds German and one German post per size; answers the master's text layers and their copy.
async function addGermanPosts(page: Page): Promise<{ projectId: string; texts: Copy[] }> {
  const got = await page.evaluate(async () => {
    const api = (window as unknown as { api: Api }).api
    const open = (await api.query('project.listOpen')).data as Array<{ id: string }>
    const projectId = open[0]!.id
    const project = (await api.query('project.get', { projectId })).data as {
      campaigns: Array<{ id: string }>
    }
    const campaignId = project.campaigns[0]!.id
    const problems: string[] = []
    const check = (reply: Reply) => {
      if (!reply.ok) problems.push(JSON.stringify(reply))
    }
    check(await api.command('campaign.update', { projectId, campaignId, languages: ['en', 'de'] }))
    const read = (await api.query('campaign.get', { projectId, campaignId })).data as {
      campaign: { sizes: Array<{ label: string }> }
      directions: Array<{ id: string }>
      variants: Array<{ id: string; isMaster: boolean }>
    }
    for (const { label: sizeLabel } of read.campaign.sizes) {
      const input = { projectId, directionId: read.directions[0]!.id, sizeLabel, language: 'de' }
      check(await api.command('variant.add', { ...input, format: 'image' }))
    }
    const master = read.variants.find((v) => v.isMaster)!
    const detail = (await api.query('variant.get', { projectId, variantId: master.id })).data as {
      layers: Array<{ id: string; type: string; copy: string | null }>
    }
    const texts = detail.layers
      .filter((l) => l.type === 'text' && (l.copy ?? '').trim() !== '')
      .map((l) => ({ layerId: l.id, copy: l.copy ?? '' }))
    return { projectId, texts, problems }
  })
  expect(got.problems).toEqual([])
  expect(got.texts.length).toBeGreaterThan(0)
  return got
}

async function setCopies(page: Page, projectId: string, texts: Copy[]): Promise<void> {
  const failed = await page.evaluate(
    async ({ projectId, texts }) => {
      const api = (window as unknown as { api: Api }).api
      const problems: string[] = []
      for (const { layerId, copy } of texts) {
        const reply = await api.command('layer.update', { projectId, layerId, patch: { copy } })
        if (!reply.ok) problems.push(JSON.stringify(reply))
      }
      return problems
    },
    { projectId, texts },
  )
  expect(failed).toEqual([])
}

async function answerSaveDialog(app: ElectronApplication, filePath: string): Promise<void> {
  await app.evaluate(({ dialog }, given) => {
    dialog.showSaveDialog = (async () => ({
      canceled: false,
      filePath: given,
    })) as unknown as typeof dialog.showSaveDialog
  }, filePath)
}

test('The translation panel: a failed language with Retry, then the sheet saved', async () => {
  test.setTimeout(240_000)
  session = await openApp()
  const { app, page, box } = session
  await screens.createProject(page, 'Translation Sheet Shots')
  await screens.loadBriefAndCreate(app, page)
  const { projectId, texts } = await addGermanPosts(page)
  await screens.openCampaign(page)

  const panel = page.getByRole('region', { name: 'Translations' })
  const german = panel.getByRole('region', { name: /^German · 0 of \d+ approved$/ })
  await expect(german).toBeVisible()

  // Too long to keep once the fake puts "[de] " in front: the job fails.
  const long = 'Lumo '.repeat(1000).slice(0, 4999)
  await setCopies(
    page,
    projectId,
    texts.map((t) => ({ ...t, copy: long })),
  )
  await german.getByRole('button', { name: 'Translate German again…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Translate' })
  await dialog.getByRole('radio', { name: 'Fake provider' }).check()
  await expect(dialog.getByText('This uses the fake provider. Nothing is charged.')).toBeVisible()
  await dialog.getByRole('button', { name: 'Translate', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(german.getByText(/^The translation did not finish: /)).toBeVisible({
    timeout: 30_000,
  })
  await setCopies(page, projectId, texts)
  await expect(german.getByRole('button', { name: 'Retry' })).toBeVisible()
  await panel.scrollIntoViewIfNeeded()
  await shot(page, '207-translation-failed')

  await answerSaveDialog(app, path.join(box.root, 'summer-translations.csv'))
  await panel.getByRole('button', { name: 'Export translation sheet…' }).click()
  await expect(panel.getByText('Saved summer-translations.csv.')).toBeVisible()
  await expect(panel.getByText(box.root)).toHaveCount(0)
  await shot(page, '208-translation-sheet-saved')
})

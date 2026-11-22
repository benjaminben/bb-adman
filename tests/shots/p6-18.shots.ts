// P6-18: paid lines for translation, with Google Gemini as the text provider (the default; the
// registry marks it as not local). Nothing is confirmed, so no paid call is made. 215: the sync
// review's "Translate" line for German. 216: "Translate German again…" over two directions,
// whose run dialog counts 2 paid requests. German, its posts and the second direction are added
// through the window's api as a screen would. Made-up words only.
import { test, expect, type Page } from '@playwright/test'
import { showCampaignView } from '../e2e/campaign-view-steps'
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

// Adds German, optionally a second direction from the first master, and one German post per
// direction; then, optionally, changes the first master's texts. Gives the first direction's name.
async function setUp(page: Page, opts: { second: boolean; edit: string | null }): Promise<string> {
  const out = await page.evaluate(async ({ second, edit }) => {
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
    type Got = {
      campaign: { sizes: Array<{ label: string }> }
      directions: Array<{ id: string; name: string; masterVariantId: string }>
    }
    const read = async () =>
      (await api.query('campaign.get', { projectId, campaignId })).data as Got
    check(await api.command('campaign.update', { projectId, campaignId, languages: ['en', 'de'] }))
    const first = (await read()).directions[0]!
    if (second) {
      const input = { projectId, masterVariantId: first.masterVariantId, name: 'Evening light' }
      check(await api.command('direction.createFromMaster', input))
    }
    const got = await read()
    const sizeLabel = got.campaign.sizes[0]!.label
    for (const d of got.directions) {
      const input = { projectId, directionId: d.id, sizeLabel, language: 'de', format: 'image' }
      check(await api.command('variant.add', input))
    }
    if (edit !== null) {
      const variantId = first.masterVariantId
      const detail = (await api.query('variant.get', { projectId, variantId })).data as {
        layers: Array<{ id: string; type: string }>
      }
      for (const layer of detail.layers.filter((l) => l.type === 'text')) {
        const patch = { copy: edit }
        check(await api.command('layer.update', { projectId, layerId: layer.id, patch }))
      }
    }
    return { problems, name: first.name }
  }, opts)
  expect(out.problems).toEqual([])
  return out.name
}

test('The sync review offers "Translate" with a paid text provider', async () => {
  test.setTimeout(180_000)
  session = await openApp()
  const { app, page } = session
  await screens.createProject(page, 'Paid Sync Shots')
  await screens.loadBriefAndCreate(app, page)
  const direction = await setUp(page, { second: false, edit: 'Fresh from the peaks' })
  await screens.openCampaign(page)
  const section = page.getByRole('region', { name: direction })
  await section.getByRole('button', { name: 'Sync 1 out of date…' }).click()
  const dialog = page.getByRole('dialog', { name: `Sync ${direction}` })
  await expect(dialog.getByText('German has no translation yet.')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Translate', exact: true })).toBeVisible()
  await page.waitForTimeout(500)
  await shot(page, '215-sync-translate-paid')
  await dialog.getByRole('button', { name: 'Cancel' }).click()
})

test('Translate again counts one paid request per direction', async () => {
  test.setTimeout(180_000)
  session = await openApp()
  const { app, page } = session
  await screens.createProject(page, 'Paid Count Shots')
  await screens.loadBriefAndCreate(app, page)
  await setUp(page, { second: true, edit: null })
  await screens.openCampaign(page)
  await showCampaignView(page, 'Translations')
  const panel = page.getByRole('region', { name: 'Translations' })
  const german = panel.getByRole('region', { name: /^German · / })
  await german.getByRole('button', { name: 'Translate German again…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Translate' })
  await expect(dialog.getByText('This sends 2 paid request(s) to Google Gemini.')).toBeVisible()
  await page.waitForTimeout(500)
  await shot(page, '216-translate-again-count')
  await dialog.getByRole('button', { name: 'Cancel' }).click()
})

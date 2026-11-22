// DLG-4b (spec/phases/design-wave-screens-b.md): fan-out and copy options. 479: fan-out with
// the sizes, German and French pressed and one size on "Generate fill" with Google Gemini: the
// chips, the icon fits, the fill MoneyLine and the translations MoneyLine above "Make {n}
// variants". 480: copy options for a text layer with no options yet: the run setup drawn in the
// dialog's own body, the MoneyLine above "Generate". Nothing is sent: each dialog is cancelled
// or closed, so no paid call is made. Made-up words and the brief's drawn pictures only.
import { test, expect, type Page } from '@playwright/test'
import * as screens from '../e2e/screens'
import { openMaster } from '../e2e/picture-run'
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

// A still window (reduce motion, a fixed Math.random), a project and the brief's campaign.
async function campaign(s: Session, name: string): Promise<void> {
  const { app, page } = s
  await page.addInitScript(() => {
    Math.random = () => 0.3
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  await screens.createProject(page, name)
  await screens.loadBriefAndCreate(app, page)
}

// Google Gemini for pictures and text (only chosen, never called), three languages, and one of
// the brief's pictures as the master's background, so fan-out offers a fill.
async function prepare(page: Page): Promise<string[]> {
  const problems = await page.evaluate(async () => {
    const api = (window as unknown as { api: Api }).api
    const out: string[] = []
    const check = (reply: Reply) => {
      if (!reply.ok) out.push(JSON.stringify(reply))
    }
    const open = (await api.query('project.listOpen')).data as Array<{ id: string }>
    const projectId = open[0]!.id
    const project = (await api.query('project.get', { projectId })).data as {
      campaigns: Array<{ id: string }>
    }
    const campaignId = project.campaigns[0]!.id
    const defaultProviders = { image: 'gemini', text: 'gemini' }
    check(await api.command('settings.update', { defaultProviders }))
    const languages = ['en', 'de', 'fr']
    check(await api.command('campaign.update', { projectId, campaignId, languages }))
    const got = (await api.query('campaign.get', { projectId, campaignId })).data as {
      directions: Array<{ masterVariantId: string }>
    }
    const variantId = got.directions[0]!.masterVariantId
    const assets = (await api.query('asset.list', { projectId, kind: 'image' })).data as Array<{
      id: string
    }>
    const detail = (await api.query('variant.get', { projectId, variantId })).data as {
      layers: Array<{ id: string; type: string }>
    }
    const background = detail.layers.find((l) => l.type === 'background')
    if (!background || !assets[0]) return [...out, 'no background or picture']
    const patch = { source: { assetId: assets[0].id } }
    check(await api.command('layer.update', { projectId, layerId: background.id, patch }))
    return out
  })
  return problems
}

test('479 fan-out with a paid fill and translations', async () => {
  test.setTimeout(180_000)
  session = await openApp()
  const { page } = session
  await campaign(session, 'Lantern Market')
  expect(await prepare(page)).toEqual([])
  await screens.openCampaign(page)
  await page.getByRole('button', { name: 'Fan out…' }).first().click()
  const dialog = page.getByRole('dialog', { name: /^Fan out / })
  const sizes = dialog.getByRole('group', { name: 'Sizes' }).getByRole('button')
  for (const chip of await sizes.all()) {
    if ((await chip.getAttribute('aria-pressed')) !== 'true') await chip.click()
  }
  for (const tag of ['de', 'fr'])
    await dialog.getByRole('button', { name: tag, exact: true }).click()
  const fit = dialog.getByRole('group', { name: /^Background for / }).first()
  await fit.getByRole('radio', { name: 'Generate fill: extend the picture with AI' }).check()
  await expect(dialog.getByLabel('Provider')).toHaveValue('gemini')
  await expect(dialog.getByText(/^Paid: 1 fill to Google Gemini$/)).toBeVisible()
  await expect(dialog.getByText(/^Paid: up to 2 translations to Google Gemini$/)).toBeVisible()
  await page.waitForTimeout(500)
  await shot(page, '479-fan-out-paid')
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toBeHidden()
})

test('480 copy options with the inline setup', async () => {
  test.setTimeout(180_000)
  session = await openApp()
  const { page } = session
  await campaign(session, 'Lantern Copy')
  expect(await prepare(page)).toEqual([])
  await screens.openCampaign(page)
  await openMaster(page)
  const rows = page.getByRole('list', { name: 'Layers' })
  await rows
    .getByRole('button', { name: /^Call to action/ })
    .first()
    .click()
  const panel = page.getByRole('region', { name: 'Properties' })
  await panel.getByRole('button', { name: 'Suggest copy…' }).click()
  const dialog = page.getByRole('dialog', { name: /^Copy options for / })
  await expect(dialog.getByRole('button', { name: 'Generate' })).toBeVisible()
  await expect(dialog.getByText(/^Paid: 1 request to Google Gemini$/)).toBeVisible()
  await page.waitForTimeout(500)
  await shot(page, '480-copy-options-inline')
  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()
})

// DLG-4a (spec/phases/design-wave-screens-b.md): the paid lines. 477: the run dialog with
// Google Gemini chosen, four pictures and the subject's photo plus one added picture as
// references: the provider as segments, the count inline, the paid count mark, the MoneyLine
// last above the buttons. 478: the sync review's Translate with Google Gemini as the text
// provider: the two-step line with Confirm and Cancel. Nothing is confirmed: each dialog is
// cancelled, so no paid call is made. Made-up words and a drawn grey picture only.
import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { greyPng } from '@/main/providers/fake/png'
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

test('477 the run dialog, paid, with references', async () => {
  test.setTimeout(180_000)
  session = await openApp()
  const { app, page, box } = session
  await campaign(session, 'Harbour Lights')
  await screens.openCampaign(page)
  await screens.setPrompt(page, 'A lantern on a quiet harbour wall at dusk')
  const file = path.join(box.root, 'harbour-grey.png')
  fs.writeFileSync(file, greyPng(32, 24))
  const panel = screens.picturePanel(page)
  await panel.getByRole('button', { name: /^Choose reference pictures/ }).click()
  const chooser = page.getByRole('dialog', { name: /^Reference pictures for / })
  await screens.answerOpenDialog(app, [file])
  const references = chooser.getByRole('region', { name: 'Reference pictures' })
  await references.getByRole('button', { name: 'Add pictures' }).click()
  const boxes = references.getByRole('checkbox')
  await expect(boxes).toHaveCount(2)
  for (const tick of await boxes.all()) await tick.check()
  await chooser.getByRole('button', { name: 'Done' }).click()
  await screens.chooseProvider(page, 'Google Gemini')
  await screens.setCount(page, 4)
  const run = await screens.openRunDialog(page)
  await expect(
    run.getByText(/^Paid: 4 pictures \+ 2 references to Google Gemini · Nano Banana 2\.1$/),
  ).toBeVisible()
  await expect(run.getByText(/^Paid so far: /)).toBeVisible()
  await page.waitForTimeout(500)
  await shot(page, '477-run-dialog-paid')
  await run.getByRole('button', { name: 'Cancel' }).click()
  await expect(run).toBeHidden()
})

// German and one German post for the first direction, then the master's texts change, so the
// sync review has a German change with no translation.
async function germanChange(page: Page): Promise<string> {
  const out = await page.evaluate(async () => {
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
    check(await api.command('campaign.update', { projectId, campaignId, languages: ['en', 'de'] }))
    const got = (await api.query('campaign.get', { projectId, campaignId })).data as Got
    const first = got.directions[0]!
    const sizeLabel = got.campaign.sizes[0]!.label
    const add = { projectId, directionId: first.id, sizeLabel, language: 'de', format: 'image' }
    check(await api.command('variant.add', add))
    const variantId = first.masterVariantId
    const detail = (await api.query('variant.get', { projectId, variantId })).data as {
      layers: Array<{ id: string; type: string }>
    }
    for (const layer of detail.layers.filter((l) => l.type === 'text')) {
      const patch = { copy: 'Lanterns along the harbour' }
      check(await api.command('layer.update', { projectId, layerId: layer.id, patch }))
    }
    return { problems, name: first.name }
  })
  expect(out.problems).toEqual([])
  return out.name
}

test('478 the two-step line in the sync review', async () => {
  test.setTimeout(180_000)
  session = await openApp()
  const { page } = session
  await campaign(session, 'Harbour Sync')
  const direction = await germanChange(page)
  await screens.openCampaign(page)
  await page
    .getByRole('button', { name: /^Sync 1 out of date/ })
    .first()
    .click()
  const dialog = page.getByRole('dialog', { name: `Sync ${direction}` })
  await dialog.getByRole('button', { name: 'Translate', exact: true }).click()
  const german = dialog.getByRole('group', { name: 'German translation' })
  await expect(
    german.getByText(/^Paid: 1 request to Google · Gemini 3\.5 Flash-Lite$/),
  ).toBeVisible()
  await expect(german.getByRole('button', { name: 'Confirm' })).toBeVisible()
  await page.waitForTimeout(500)
  await shot(page, '478-sync-two-step-line')
  await german.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog.getByRole('button', { name: 'Translate', exact: true })).toBeVisible()
})

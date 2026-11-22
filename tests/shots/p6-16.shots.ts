// P6-16: translation in the sync review, with the fake as the text provider (local, so the
// review starts its sync translation on open; no paid call). The e2e brief has one language,
// so this file adds German and one German post with campaign.update and variant.add, sets the
// text provider to the fake with settings.update, and changes the master's text with
// layer.update, through the window's api as a screen would. 213: the fake's proposed text in
// the review. 214: a failed translation with "Retry": every master text is made so long that
// the fake's answer ("[de] " before it) is over the 5000 code point limit, so no usable text
// comes back and the job fails. Made-up words only.
import { test, expect, type Page } from '@playwright/test'
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

// Sets up the German post and the fake text provider; gives the first direction's name.
async function addGermanPost(page: Page): Promise<string> {
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
    check(await api.command('settings.update', { defaultProviders: { text: 'fake' } }))
    check(await api.command('campaign.update', { projectId, campaignId, languages: ['en', 'de'] }))
    const got = (await api.query('campaign.get', { projectId, campaignId })).data as {
      campaign: { sizes: Array<{ label: string }> }
      directions: Array<{ id: string; name: string }>
    }
    const direction = got.directions[0]!
    const sizeLabel = got.campaign.sizes[0]!.label
    const input = { projectId, directionId: direction.id, sizeLabel, language: 'de' }
    check(await api.command('variant.add', { ...input, format: 'image' }))
    return { problems, name: direction.name }
  })
  expect(out.problems).toEqual([])
  return out.name
}

// Sets every text layer of the master: the first to `first`, the others to `others` (the
// first's text when not given).
async function editMaster(page: Page, first: string, others?: string): Promise<void> {
  const problems = await page.evaluate(
    async ([one, rest]) => {
      const api = (window as unknown as { api: Api }).api
      const open = (await api.query('project.listOpen')).data as Array<{ id: string }>
      const projectId = open[0]!.id
      const project = (await api.query('project.get', { projectId })).data as {
        campaigns: Array<{ id: string }>
      }
      const campaignId = project.campaigns[0]!.id
      const got = (await api.query('campaign.get', { projectId, campaignId })).data as {
        directions: Array<{ masterVariantId: string }>
      }
      const variantId = got.directions[0]!.masterVariantId
      const read = (await api.query('variant.get', { projectId, variantId })).data as {
        layers: Array<{ id: string; type: string }>
      }
      const texts = read.layers.filter((l) => l.type === 'text')
      const out: string[] = []
      for (const [i, layer] of texts.entries()) {
        const copy = i === 0 ? one : (rest ?? one)
        const reply = await api.command('layer.update', {
          projectId,
          layerId: layer.id,
          patch: { copy },
        })
        if (!reply.ok) out.push(JSON.stringify(reply))
      }
      return out
    },
    [first, others] as const,
  )
  expect(problems).toEqual([])
}

test('Translation in the sync review, proposed and failed', async () => {
  test.setTimeout(180_000)
  session = await openApp()
  const { app, page } = session
  await screens.createProject(page, 'Sync Translation Shots')
  await screens.loadBriefAndCreate(app, page)
  const direction = await addGermanPost(page)
  await screens.openCampaign(page)
  const section = page.getByRole('region', { name: direction })
  await expect(section.getByRole('button', { name: 'Nothing to sync' })).toBeDisabled()

  await editMaster(page, 'Fresh from the peaks', 'Find it near you')
  await section.getByRole('button', { name: 'Sync 1 out of date…' }).click()
  const dialog = page.getByRole('dialog', { name: `Sync ${direction}` })
  await expect(dialog.getByText('Proposed translation: [de] Fresh from the peaks')).toBeVisible({
    timeout: 20_000,
  })
  await page.waitForTimeout(500)
  await shot(page, '213-sync-translation-proposed')

  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toBeHidden()
  await editMaster(page, 'Cold and clear, '.repeat(313).slice(0, 4999))
  await section.getByRole('button', { name: 'Sync 1 out of date…' }).click()
  await expect(dialog.getByText(/^The translation did not finish: /).first()).toBeVisible({
    timeout: 20_000,
  })
  await expect(dialog.getByRole('button', { name: 'Retry' }).first()).toBeVisible()
  await expect(dialog.getByLabel('Or type the translation').first()).toBeVisible()
  await page.waitForTimeout(500)
  await shot(page, '214-sync-translation-failed')
})

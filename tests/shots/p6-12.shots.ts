// P6-12: the translation panel, with proposed rows (205) and after "Approve all German" (206).
// The e2e brief has one language; no screen adds a language post yet, so this file adds German
// to the campaign and two German posts with campaign.update and variant.add, and proposes
// made-up German words with translation.set, through the window's api as a screen would.
import { test, expect, type Page } from '@playwright/test'
import { showCampaignView } from '../e2e/campaign-view-steps'
import * as screens from '../e2e/screens'
import { closeApp, openApp, shot, type Session } from './shot'

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

// Made-up words per layer key; any other key gets the first.
const WORDS: Record<string, string> = {
  headline: 'Kühl bleiben mit jedem Schluck',
  'call-to-action': 'Jetzt in deiner Nähe finden',
}

type Reply = { ok: boolean; data: unknown }
type Api = {
  query(n: string, i?: unknown): Promise<Reply>
  command(n: string, i: unknown): Promise<Reply>
}

async function addGermanPosts(page: Page): Promise<void> {
  const failed = await page.evaluate(async (words) => {
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
    const got = (await api.query('campaign.get', { projectId, campaignId })).data as {
      campaign: { sizes: Array<{ label: string }> }
      directions: Array<{ id: string }>
    }
    for (const { label: sizeLabel } of got.campaign.sizes) {
      const input = { projectId, directionId: got.directions[0]!.id, sizeLabel, language: 'de' }
      check(await api.command('variant.add', { ...input, format: 'image' }))
    }
    const read = await api.query('translation.forCampaign', { projectId, campaignId })
    const rows = (read.data as { rows: Array<{ layerId: string; layerKey: string }> }).rows
    for (const row of rows) {
      const text = words[row.layerKey] ?? Object.values(words)[0]!
      check(
        await api.command('translation.set', {
          projectId,
          layerId: row.layerId,
          text,
          applyToSameLanguage: false,
        }),
      )
    }
    if (rows.length === 0) problems.push('no translation rows')
    return problems
  }, WORDS)
  expect(failed).toEqual([])
}

test('The translation panel, proposed and approved', async () => {
  test.setTimeout(180_000)
  session = await openApp()
  const { app, page } = session
  await screens.createProject(page, 'Translation Shots')
  await screens.loadBriefAndCreate(app, page)
  await addGermanPosts(page)
  await screens.openCampaign(page)

  await showCampaignView(page, 'Translations')
  const panel = page.getByRole('region', { name: 'Translations' })
  const german = panel.getByRole('region', { name: /^German · 0 of \d+ approved$/ })
  await expect(german).toBeVisible()
  await expect(german.getByRole('button', { name: 'Approve' }).first()).toBeVisible()
  await panel.scrollIntoViewIfNeeded()
  await shot(page, '205-translation-proposed')

  await german.getByRole('button', { name: 'Approve all German' }).click()
  await expect(
    panel.getByRole('heading', { name: /^German · (\d+) of \1 approved$/ }),
  ).toBeVisible()
  await expect(panel.getByRole('button', { name: 'Approve', exact: true })).toHaveCount(0)
  await shot(page, '206-translation-approved')
})

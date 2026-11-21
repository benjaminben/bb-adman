// P6-14: the editor's translation controls on a French variant of a made-up campaign. 209: the
// headline's Copy with "Translation: Proposed, from you" and "Approve" under it. 210: "Use this
// font for every fr post" under the font field. Set-up by commands, as other shots files do: two
// French variants by variant.add, and the headline's text by translation.set.
import { test, expect, type Page } from '@playwright/test'
import * as screens from '../e2e/screens'
import { command, query } from '../e2e/render-helpers'
import { closeApp, openApp, shot, type Session } from './shot'
import { panel, select } from './lk-7-steps'

let session: Session | undefined

test.afterEach(async () => {
  try {
    await closeApp(session)
  } finally {
    session = undefined
  }
})

type Row = { layerId: string; layerKey: string; sizeLabel: string; layerName: string }

async function frenchCampaign(page: Page): Promise<void> {
  await screens.createProject(page, 'Corner bakery')
  const state = (await query(page, 'app.getState', {})) as {
    openProjects: { projectId: string }[]
  }
  const projectId = state.openProjects[0]!.projectId
  const { campaignId } = (await command(page, 'campaign.create', {
    projectId,
    brief: {
      campaignName: 'Fresh loaf',
      region: 'CA',
      audience: 'Neighbours',
      message: 'Keep your morning loaf fresh for days.',
      callToAction: 'Order ahead in the app',
      subjects: [{ name: 'Product' }],
    },
    subjectMap: [{ subjectId: 'product', create: true }],
    languages: ['en', 'fr'],
    sizes: [
      { label: '1080x1350', width: 1080, height: 1350 },
      { label: '1080x1920', width: 1080, height: 1920 },
    ],
    templateId: 'starter',
  })) as { campaignId: string }
  const campaign = (await query(page, 'campaign.get', { projectId, campaignId })) as {
    directions: { id: string }[]
  }
  const directionId = campaign.directions[0]!.id
  for (const sizeLabel of ['1080x1350', '1080x1920']) {
    await command(page, 'variant.add', {
      projectId,
      directionId,
      sizeLabel,
      language: 'fr',
      format: 'image',
    })
  }
  const { rows } = (await query(page, 'translation.forCampaign', { projectId, campaignId })) as {
    rows: Row[]
  }
  const headline = rows.find((r) => r.layerName === 'Headline' && r.sizeLabel === '1080x1350')!
  await command(page, 'translation.set', {
    projectId,
    layerId: headline.layerId,
    text: 'Gardez votre pain frais plus longtemps.',
    applyToSameLanguage: false,
  })
  await page.getByRole('button', { name: 'Open Fresh loaf' }).click()
  await page
    .getByRole('list', { name: 'Variants' })
    .getByRole('button', { name: /1080×1350 · fr/ })
    .click()
  await expect(page.getByRole('region', { name: /^Canvas, / })).toBeVisible()
}

test('The translation controls of a French headline', async () => {
  session = await openApp()
  const { page } = session
  await frenchCampaign(page)
  await select(page, 'Headline')
  const text = panel(page).getByRole('group', { name: 'Text settings' })
  await expect(text.getByText('Translation: Proposed, from you')).toBeVisible()
  await expect(text.getByRole('button', { name: 'Approve' })).toBeVisible()
  await shot(page, '209-editor-translation-status')
  const font = text.getByRole('button', { name: 'Use this font for every fr post' })
  await font.scrollIntoViewIfNeeded()
  await expect(font).toBeVisible()
  await shot(page, '210-editor-language-font')
})

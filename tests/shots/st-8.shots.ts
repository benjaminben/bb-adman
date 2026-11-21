// ST-8: the properties panel of a text layer: the Layer, Text settings and Box groups, the copy
// in the reading face, the segmented alignment groups, the colour swatches (a white and a cream
// one among them, to show their edges) and the four-column Position and size grid. Made-up
// campaign only; set-up by commands, as other shots files do.
import { test, expect, type Page } from '@playwright/test'
import * as screens from '../e2e/screens'
import { command, query } from '../e2e/render-helpers'
import { closeApp, openApp, shot, type Session } from './shot'
import { panel, select } from './lk-7-steps'

const PALETTE = ['#FFFFFF', '#F7F1E1', '#C2410C', '#1F2937']

let session: Session | undefined

test.afterEach(async () => {
  try {
    await closeApp(session)
  } finally {
    session = undefined
  }
})

async function campaignWithPalette(page: Page): Promise<void> {
  await screens.createProject(page, 'Corner bakery')
  const state = (await query(page, 'app.getState', {})) as {
    openProjects: { projectId: string }[]
  }
  const projectId = state.openProjects[0]!.projectId
  const { campaignId } = (await command(page, 'campaign.create', {
    projectId,
    brief: {
      campaignName: 'Fresh loaf',
      region: 'US',
      audience: 'Neighbours',
      message: 'Keep your morning loaf fresh for days.',
      callToAction: 'Order ahead in the app',
      subjects: [{ name: 'Product' }],
    },
    subjectMap: [{ subjectId: 'product', create: true }],
    languages: ['en'],
    sizes: [{ label: '1080x1920', width: 1080, height: 1920 }],
    templateId: 'starter',
  })) as { campaignId: string }
  await command(page, 'ruleSet.update', { projectId, campaignId, palette: PALETTE })
  await page.getByRole('button', { name: 'Open Fresh loaf' }).click()
  await page.getByRole('list', { name: 'Variants' }).getByRole('button').first().click()
  await expect(page.getByRole('region', { name: /^Canvas, / })).toBeVisible()
}

test('The properties panel of a text layer', async () => {
  session = await openApp()
  const { page } = session
  await campaignWithPalette(page)
  await select(page, 'Headline')
  const text = panel(page).getByRole('group', { name: 'Text settings' })
  await expect(text.getByRole('button', { name: 'Palette colour #FFFFFF' })).toBeVisible()
  await shot(page, '192-editor-text-properties')
})

// P9-13: the publish dialog's warnings step and "Publish…" in the campaign header. One made-up
// campaign in English and German whose rule set asks for a word its ads do not hold, so a
// publish is refused with warnings. Only the fake storage is used, a folder in the sandbox: no bucket,
// no Dropbox, no sign-in. The warnings step is shot before "Publish anyway", so nothing is
// published and nothing is paid.
import { test, expect, type Page } from '@playwright/test'
import * as screens from '../e2e/screens'
import { command, query } from '../e2e/render-helpers'
import { closeApp, openApp, shot, type Session } from './shot'

const CAMPAIGN = 'Harbor Day Cold Brew'

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

async function setUp(page: Page) {
  await screens.createProject(page, 'Harbor Day')
  const state = (await query(page, 'app.getState', {})) as {
    openProjects: { projectId: string }[]
  }
  const projectId = state.openProjects[0]!.projectId
  await command(page, 'campaign.create', {
    projectId,
    brief: {
      campaignName: CAMPAIGN,
      region: 'US',
      audience: 'Commuters',
      message: 'Cold brew for the early ferry',
      callToAction: 'Try it this week',
      subjects: [{ name: 'Bottle' }],
    },
    subjectMap: [{ subjectId: 'bottle', create: true }],
    languages: ['en', 'de'],
    sizes: [{ label: '1080x1080', width: 1080, height: 1080 }],
    templateId: 'starter',
    ruleSet: {
      requiredAssetIds: [],
      palette: [],
      requiredWords: { en: ['fresh'], de: ['frisch'] },
      prohibitedWords: {},
    },
  })
  await page.getByRole('button', { name: `Open ${CAMPAIGN}` }).click()
  await expect(page.getByRole('heading', { name: CAMPAIGN, level: 2 })).toBeVisible()
}

test('277 the warnings step, a reason typed', async () => {
  session = await openApp()
  const { page } = session
  await setUp(page)
  await page.getByRole('button', { name: 'Publish…' }).click()
  const dialog = page.getByRole('dialog', { name: `Publish ${CAMPAIGN}` })
  await dialog.getByRole('radio').last().check()
  await expect(dialog.getByText('Nothing is published for this campaign yet.')).toBeVisible()
  await dialog.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(dialog.getByRole('list', { name: 'These ads have warnings' })).toBeVisible()
  await dialog
    .getByRole('textbox', { name: 'Why publish anyway? (optional)' })
    .fill('The client approved this copy by email on 18 November.')
  await shot(page, '277-publish-warnings')
})

test('278 Publish… in the campaign header', async () => {
  session = await openApp()
  const { page } = session
  await setUp(page)
  await expect(page.getByRole('button', { name: 'Publish…' })).toBeVisible()
  await shot(page, '278-campaign-publish-button')
})

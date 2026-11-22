// P8-11: the export dialog. One campaign at two sizes in two languages, fanned out to four ads.
// 251 the dialog with a folder chosen (the picker answered with a made-up folder) and JPG
// picked, so the quality field shows. 252 (warnings), 253 (running) and 254 (done) need the
// built export command and job (P8-5, P8-6); until then export.run refuses, so they are not
// made here. Nothing is exported, nothing is paid. Made-up names only.
import { test, expect, type Page } from '@playwright/test'
import * as screens from '../e2e/screens'
import { command, query } from '../e2e/render-helpers'
import { closeApp, openApp, shot, type Session } from './shot'

const CAMPAIGN = 'Ridge Trail Water'
const FOLDER = '/Users/alex/Desktop/Ridge Trail export'

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

async function setUp(page: Page) {
  await screens.createProject(page, 'Ridge Trail')
  const state = (await query(page, 'app.getState', {})) as {
    openProjects: { projectId: string }[]
  }
  const projectId = state.openProjects[0]!.projectId
  const { campaignId } = (await command(page, 'campaign.create', {
    projectId,
    brief: {
      campaignName: CAMPAIGN,
      region: 'US',
      audience: 'Trail runners',
      message: 'Cold water for the long climb',
      callToAction: 'Find it near you',
      subjects: [{ name: 'Bottle' }],
    },
    subjectMap: [{ subjectId: 'bottle', create: true }],
    languages: ['en', 'de'],
    sizes: [
      { label: '1080x1080', width: 1080, height: 1080 },
      { label: '1080x1920', width: 1080, height: 1920 },
    ],
    templateId: 'starter',
  })) as { campaignId: string }
  const read = (await query(page, 'campaign.get', { projectId, campaignId })) as {
    directions: { id: string }[]
  }
  await command(page, 'variant.fanOut', {
    projectId,
    directionId: read.directions[0]!.id,
    sizes: ['1080x1080', '1080x1920'],
    languages: ['en', 'de'],
    formats: ['image'],
    fits: { '1080x1920': 'scale' },
  })
}

test('Export: the dialog with a folder chosen and JPG picked', async () => {
  test.setTimeout(180_000)
  session = await openApp()
  const { app, page } = session
  await setUp(page)
  await page.getByRole('button', { name: `Open ${CAMPAIGN}` }).click()
  await expect(page.getByRole('heading', { name: CAMPAIGN, level: 2 })).toBeVisible()

  await page.getByRole('button', { name: 'Export…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Export campaign' })
  await expect(dialog.getByRole('checkbox')).toHaveCount(4)
  await screens.answerOpenDialog(app, [FOLDER])
  await dialog.getByRole('button', { name: 'Choose folder…' }).click()
  await expect(dialog.getByText(FOLDER)).toBeVisible()
  await dialog.getByLabel('Picture format').selectOption('jpg')
  await expect(dialog.getByLabel('JPG quality')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Export', exact: true })).toBeEnabled()
  await shot(page, '251-export-dialog')
})

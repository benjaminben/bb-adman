// DLG-6a (spec/phases/design-wave-screens-b.md, "DLG-6a — Export and package"): 484, the export
// dialog with the folder set (its base name only, the full path in the row's tooltip); 485, the
// package dialog with two missing files. Every folder is made inside the sandbox; the package
// is refused for the missing files, so nothing is written. Fake providers only, nothing is paid
// and nothing leaves the machine. Made-up names only.
import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import * as ex from '../e2e/export-steps'
import { command, query } from '../e2e/render-helpers'
import * as screens from '../e2e/screens'
import { closeApp, openApp, shot, type Session } from './shot'

const CAMPAIGN = 'Fernwood Tea'

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

async function still(page: Page) {
  await page.addInitScript(() => {
    Math.random = () => 0.3
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
}

async function projectIdOf(page: Page): Promise<string> {
  const state = (await query(page, 'app.getState', {})) as {
    openProjects: { projectId: string }[]
  }
  return state.openProjects[0]!.projectId
}

async function makeCampaign(page: Page, projectId: string) {
  const { campaignId } = (await command(page, 'campaign.create', {
    projectId,
    brief: {
      campaignName: CAMPAIGN,
      region: 'US',
      audience: 'Tea drinkers on a slow morning',
      message: 'Steeped in the woods',
      callToAction: 'Brew a cup',
      subjects: [{ name: 'Tin' }],
    },
    subjectMap: [{ subjectId: 'tin', create: true }],
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

// A PNG header: enough for the import to know the type and size.
function pngHeader(width: number, height: number): Buffer {
  const head = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])
  const size = Buffer.alloc(8)
  size.writeUInt32BE(width, 0)
  size.writeUInt32BE(height, 4)
  return Buffer.concat([head, Buffer.from('IHDR'), size, Buffer.from([8, 6, 0, 0, 0])])
}

// Two pictures linked from a folder in the sandbox, then the folder moved away.
async function linkThenMove(page: Page, projectId: string, root: string) {
  const shoot = path.join(root, 'Fernwood shoot')
  fs.mkdirSync(shoot, { recursive: true })
  const paths = ['tin-on-moss.png', 'steam-over-cup.png'].map((name, i) => {
    const to = path.join(shoot, name)
    fs.writeFileSync(to, pngHeader(2000 + i * 400, 1600))
    return to
  })
  await command(page, 'asset.import', { projectId, paths, library: 'asset', copy: false })
  fs.renameSync(shoot, path.join(root, 'Fernwood shoot (moved)'))
}

async function settle(page: Page) {
  await page.mouse.move(5, 5)
  await page.waitForTimeout(500)
}

test('484 export with the folder set, 485 package with missing files', async () => {
  test.setTimeout(240_000)
  session = await openApp()
  const { app, box, page } = session
  await still(page)
  await screens.createProject(page, 'Fernwood')
  const projectId = await projectIdOf(page)
  await makeCampaign(page, projectId)

  await page.getByRole('button', { name: `Open ${CAMPAIGN}` }).click()
  await expect(page.getByRole('heading', { name: CAMPAIGN, level: 2 })).toBeVisible()
  const folder = ex.outputFolder(box.root, 'Fernwood handover')
  const dialog = await ex.openExport(app, page, folder)
  await dialog.getByRole('checkbox').nth(2).uncheck()
  await expect(dialog.getByRole('checkbox', { name: 'All ads' })).not.toBeChecked()
  await expect(dialog.getByText(folder)).toHaveCount(0)
  await expect(dialog.locator('img')).toHaveCount(4)
  await settle(page)
  await shot(page, '484-export-folder-set')
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toBeHidden()
  expect(fs.readdirSync(folder)).toEqual([])

  await linkThenMove(page, projectId, box.root)
  const target = ex.outputFolder(box.root, 'Fernwood package')
  await page.locator('header button[aria-haspopup="menu"]').click()
  await page.getByRole('menuitem', { name: 'Package…' }).click()
  const pack = page.getByRole('dialog', { name: 'Package project' })
  await screens.answerOpenDialog(app, [target])
  await pack.getByRole('button', { name: 'Choose a folder and package…' }).click()
  await expect(pack.getByText('2 missing')).toBeVisible()
  await expect(pack.getByRole('list', { name: 'Missing files' }).getByRole('listitem')).toHaveCount(
    2,
  )
  await settle(page)
  await shot(page, '485-package-missing-files')
  expect(fs.readdirSync(target)).toEqual([])
})

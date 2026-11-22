// HOME-1 (spec/phases/design-wave-screens-b.md, "HOME-1"): the project home in the design
// wave's look. 450: two campaigns as tiles and 3 missing files (linked pictures whose folder
// is moved; one more import makes the page read project.get again). 451: an empty project.
// Made-up names and drawn pictures only; no provider runs.
import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { command, query } from '../e2e/render-helpers'
import * as screens from '../e2e/screens'
import { closeApp, openApp, shot, type Session } from './shot'

const PHOTOS = path.resolve('tests/fixtures/briefs/photos')

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

async function shownProjectId(page: Page, name: string): Promise<string> {
  const state = (await query(page, 'app.getState', {})) as {
    openProjects: { projectId: string; name: string }[]
  }
  return state.openProjects.find((p) => p.name === name)!.projectId
}

async function makeCampaign(page: Page, projectId: string, name: string, subject: string) {
  const id = subject.toLowerCase().replace(/ /g, '-')
  await command(page, 'campaign.create', {
    projectId,
    brief: {
      campaignName: name,
      region: 'US',
      audience: 'Early risers who walk to work',
      message: 'A bold roast from the harbour',
      subjects: [{ name: subject }],
    },
    subjectMap: [{ subjectId: id, create: true }],
    languages: ['en'],
    sizes: [
      { label: '1080x1080', width: 1080, height: 1080 },
      { label: '1080x1920', width: 1080, height: 1920 },
    ],
    templateId: 'starter',
  })
}

// A PNG header of the given size: enough for the import to know the type and the size, and a
// different file for each size.
function pngHeader(width: number, height: number): Buffer {
  const head = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])
  const size = Buffer.alloc(8)
  size.writeUInt32BE(width, 0)
  size.writeUInt32BE(height, 4)
  return Buffer.concat([head, Buffer.from('IHDR'), size, Buffer.from([8, 6, 0, 0, 0])])
}

async function linkThenMove(page: Page, projectId: string, root: string) {
  const shoot = path.join(root, 'Harbour shoot')
  fs.mkdirSync(shoot, { recursive: true })
  const paths = [2400, 3000, 1200].map((width, i) => {
    const to = path.join(shoot, `harbour-${i + 1}.png`)
    fs.writeFileSync(to, pngHeader(width, 1600))
    return to
  })
  await command(page, 'asset.import', { projectId, paths, library: 'asset', copy: false })
  fs.renameSync(shoot, path.join(root, 'Harbour shoot (moved)'))
  const logo = path.join(root, 'logo.png')
  fs.copyFileSync(path.join(PHOTOS, 'berry-bottle.png'), logo)
  await command(page, 'asset.import', { projectId, paths: [logo], library: 'asset', copy: true })
}

async function settle(page: Page) {
  await page.mouse.move(1200, 780)
  await page.waitForTimeout(500)
}

test('the project home: campaign tiles and missing files, then an empty project', async () => {
  test.setTimeout(180_000)
  session = await openApp()
  const { box, page } = session
  await page.addInitScript(() => {
    Math.random = () => 0.3
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()

  await screens.createProject(page, 'Tidewater Coffee')
  const projectId = await shownProjectId(page, 'Tidewater Coffee')
  await makeCampaign(page, projectId, 'Harbour Blend', 'Harbour Blend bag')
  await makeCampaign(page, projectId, 'Morning Walk', 'Tidewater Mug')
  await linkThenMove(page, projectId, box.root)
  const list = page.getByRole('list', { name: 'Campaigns' })
  await expect(list.getByRole('button', { name: /^Open / })).toHaveCount(2)
  await expect(list.locator('img')).toHaveCount(2)
  await expect(page.getByRole('button', { name: /^3 missing/ })).toBeVisible()
  await settle(page)
  await shot(page, '450-project-home-campaigns-missing')

  await screens.createProject(page, 'Saltmarsh Tea')
  await expect(page.getByText('No campaigns yet')).toBeVisible()
  await settle(page)
  await shot(page, '451-project-home-empty')
})

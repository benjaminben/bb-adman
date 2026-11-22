// P9-12: the publish dialog. One made-up campaign with two pictures and a font; the dialog is
// opened from "Publish…" in the campaign header (the button is P9-13's, so this file runs once
// that is merged). Only the fake storage is used, which is a folder in the sandbox: no bucket,
// no Dropbox, no sign-in. 274 plants a made-up earlier publish in that folder. Nothing is paid
// and nothing is published.
import fs from 'node:fs'
import path from 'node:path'
import { test, expect, type Page } from '@playwright/test'
import * as screens from '../e2e/screens'
import { FONT_FILE, command, query } from '../e2e/render-helpers'
import { closeApp, openApp, shot, type Session } from './shot'

const CAMPAIGN = 'Harbor Day Cold Brew'
const PHOTOS = path.resolve('tests/shots/fixtures/photos')
const OTHER_PROJECT = '01JD0000000000000000000077'

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

type Ids = { projectId: string; campaignId: string }

// The pictures and the font are copied into the sandbox first, so the paths drawn are made-up
// ones under the sandbox, not this computer's own folders.
function sandboxFiles(projects: string, font: boolean): string[] {
  const folder = path.join(projects, 'Harbor Day pictures')
  fs.mkdirSync(folder, { recursive: true })
  const sources = ['glass-bottle.png', 'sport-flask.png'].map((f) => path.join(PHOTOS, f))
  if (font) sources.push(FONT_FILE)
  return sources.map((source) => {
    const copy = path.join(folder, path.basename(source))
    fs.copyFileSync(source, copy)
    return copy
  })
}

async function setUp(session: Session, opts: { font: boolean }): Promise<Ids> {
  const { page, box } = session
  await screens.createProject(page, 'Harbor Day')
  const state = (await query(page, 'app.getState', {})) as {
    openProjects: { projectId: string }[]
  }
  const projectId = state.openProjects[0]!.projectId
  const paths = sandboxFiles(box.projects, opts.font)
  const { assetIds } = (await command(page, 'asset.import', {
    projectId,
    paths,
    library: 'asset',
    copy: false,
  })) as { assetIds: string[] }
  const { campaignId, variantId } = (await command(page, 'campaign.create', {
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
    languages: ['en'],
    sizes: [{ label: '1080x1080', width: 1080, height: 1080 }],
    templateId: 'starter',
  })) as { campaignId: string; variantId: string }
  for (const [i, assetId] of assetIds.slice(0, 2).entries()) {
    await command(page, 'layer.create', {
      projectId,
      variantId,
      type: 'image',
      values: {
        source: { assetId },
        geometry: { x: 100 + i * 400, y: 300, width: 300, height: 300, rotation: 0, crop: null },
        style: { opacity: 1 },
      },
    })
  }
  if (opts.font) {
    const fontId = assetIds[2] as string
    await command(page, 'asset.update', { projectId, assetId: fontId, fontPublishAllowed: true })
    await command(page, 'layer.create', {
      projectId,
      variantId,
      type: 'text',
      values: { copy: 'Harbor Day', style: { fontAssetId: fontId } },
    })
  }
  return { projectId, campaignId }
}

async function openDialog(page: Page) {
  await page.getByRole('button', { name: `Open ${CAMPAIGN}` }).click()
  await expect(page.getByRole('heading', { name: CAMPAIGN, level: 2 })).toBeVisible()
  await page.getByRole('button', { name: 'Publish…' }).click()
  const dialog = page.getByRole('dialog', { name: `Publish ${CAMPAIGN}` })
  await expect(dialog.getByRole('group', { name: 'Publish to' })).toBeVisible()
  return dialog
}

async function chooseFake(page: Page) {
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('radio').last().check()
  await expect(dialog.getByText('Looking at the published folder…')).toHaveCount(0)
}

// A made-up earlier publish from another project, as a manifest and three files.
function plantPublished(userData: string, campaignId: string) {
  const folder = path.join(userData, 'fake-storage', campaignId)
  fs.mkdirSync(path.join(folder, 'ads'), { recursive: true })
  const files = ['ads/harbor-day-1080x1080-en.png', 'report-1.html', 'report-1.json']
  for (const f of files) fs.writeFileSync(path.join(folder, f), 'made-up')
  const manifest = {
    format: 1,
    appVersion: '0.1.0',
    projectId: OTHER_PROJECT,
    campaignId,
    publishNumber: 2,
    publishedAt: '2026-11-12T16:40:00.000Z',
    files: files.map((p) => ({ path: p, bytes: 7, sha256: 'b'.repeat(64) })),
  }
  fs.writeFileSync(path.join(folder, 'manifest.json'), JSON.stringify(manifest))
}

test('273 the first view, fake storage chosen, nothing published yet', async () => {
  session = await openApp()
  const { page } = session
  await setUp(session, { font: false })
  const dialog = await openDialog(page)
  await chooseFake(page)
  await expect(dialog.getByText('Nothing is published for this campaign yet.')).toBeVisible()
  await shot(page, '273-publish-dialog-first')
})

test('274 the replace block, files published from another project', async () => {
  session = await openApp()
  const { page, box } = session
  const { campaignId } = await setUp(session, { font: false })
  plantPublished(box.userData, campaignId)
  const dialog = await openDialog(page)
  await chooseFake(page)
  await expect(dialog.getByRole('checkbox', { name: 'Replace the published files' })).toBeVisible()
  await shot(page, '274-publish-dialog-replace')
})

test('275 a font the project file says may be shared, to confirm on this computer', async () => {
  session = await openApp()
  const { page } = session
  await setUp(session, { font: true })
  const dialog = await openDialog(page)
  await chooseFake(page)
  await expect(dialog.getByText(/Confirm it on this computer\./)).toBeVisible()
  await dialog.getByRole('region', { name: 'Fonts' }).scrollIntoViewIfNeeded()
  await shot(page, '275-publish-dialog-fonts')
})

test('276 Amazon S3 and Dropbox not set up', async () => {
  session = await openApp()
  const { page } = session
  await setUp(session, { font: false })
  const dialog = await openDialog(page)
  await expect(dialog.getByText('Set up Amazon S3 in Settings.')).toBeVisible()
  await expect(dialog.getByText('Sign in to Dropbox in Settings.')).toBeVisible()
  await shot(page, '276-publish-dialog-not-set-up')
})

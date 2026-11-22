// P8-19: the end of a video export and the report file it wrote. One campaign at two sizes, the
// tall ad changed to a 2 s video with a still clip under its text; both ads exported through the
// Export dialog with the fake providers to a folder in the sandbox. 258 the dialog's end counts;
// 257 the report's HTML file opened in a hidden window with JavaScript off (as report-html.spec.ts
// opens it), captured whole through that window's debugger. Needs the fetched FFmpeg. Nothing is paid and nothing
// leaves the machine. Made-up names only.
import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import * as screens from '../e2e/screens'
import { command, makePng, query } from '../e2e/render-helpers'
import { PICTURES } from '../e2e/scene-cases'
import { makeSandbox, launch } from '../e2e/launch'
import { appWindow, filesUnder } from '../e2e/publish-steps'
import * as ex from '../e2e/export-steps'
import { closeApp, shot, type Session } from './shot'

const CAMPAIGN = 'Lantern Bay Iced Tea'
const SHOTS = path.resolve('shots')

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

async function setUp(s: Session) {
  const { app, page, box } = s
  await screens.createProject(page, 'Lantern Bay')
  const state = (await query(page, 'app.getState', {})) as {
    openProjects: { projectId: string }[]
  }
  const projectId = state.openProjects[0]!.projectId
  await command(page, 'settings.update', { reports: { exporterName: 'Robin Avery' } })
  const file = path.join(box.root, 'bands.png')
  fs.writeFileSync(file, await makePng(app, PICTURES.bands))
  const { assetIds } = (await command(page, 'asset.import', {
    projectId,
    paths: [file],
    library: 'asset',
    copy: false,
  })) as { assetIds: string[] }
  const { campaignId } = (await command(page, 'campaign.create', {
    projectId,
    brief: {
      campaignName: CAMPAIGN,
      region: 'US',
      audience: 'Evening walkers by the bay',
      message: 'Cool tea as the lanterns come on',
      callToAction: 'Pour a glass',
      subjects: [{ name: 'Tea bottle' }],
    },
    subjectMap: [{ subjectId: 'tea-bottle', create: true }],
    languages: ['en'],
    sizes: [
      { label: '1080x1080', width: 1080, height: 1080 },
      { label: '1080x1920', width: 1080, height: 1920 },
    ],
    templateId: 'starter',
  })) as { campaignId: string }
  const read = (await query(page, 'campaign.get', { projectId, campaignId })) as {
    directions: { id: string }[]
    variants: { id: string; sizeLabel: string }[]
  }
  await command(page, 'variant.fanOut', {
    projectId,
    directionId: read.directions[0]!.id,
    sizes: ['1080x1920'],
    languages: ['en'],
    formats: ['image'],
    fits: { '1080x1920': 'scale' },
  })
  const all = (await query(page, 'campaign.get', { projectId, campaignId })) as {
    variants: { id: string; sizeLabel: string }[]
  }
  const tall = all.variants.find((v) => v.sizeLabel === '1080x1920')!.id
  await command(page, 'variant.setFormat', { projectId, variantId: tall, format: 'video' })
  await command(page, 'variant.update', { projectId, variantId: tall, durationMs: 2000 })
  const { clips } = await query(page, 'variant.get', { projectId, variantId: tall })
  for (const clip of (clips ?? []) as { id: string }[]) {
    await command(page, 'clip.remove', { projectId, clipId: clip.id })
  }
  await command(page, 'clip.add', { projectId, variantId: tall, assetId: assetIds[0], startMs: 0 })
}

// The report HTML opened as a file in a hidden window with JavaScript off, captured to a shot.
async function shootReport(s: Session, file: string, name: string) {
  const base64 = await s.app.evaluate(async ({ BrowserWindow }, pagePath) => {
    const win = new BrowserWindow({
      show: false,
      width: 1280,
      height: 800,
      webPreferences: { javascript: false, partition: 'report-shot', sandbox: true },
    })
    await win.loadFile(pagePath)
    await new Promise((resolve) => setTimeout(resolve, 800))
    // The whole page, past the window's height, through the window's own debugger.
    const tools = win.webContents.debugger
    tools.attach()
    const metrics = (await tools.sendCommand('Page.getLayoutMetrics')) as {
      cssContentSize: { width: number; height: number }
    }
    const { width, height } = metrics.cssContentSize
    const clip = { x: 0, y: 0, width, height, scale: 1 }
    const image = (await tools.sendCommand('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true,
      clip,
    })) as { data: string }
    tools.detach()
    win.destroy()
    return image.data
  }, file)
  fs.mkdirSync(SHOTS, { recursive: true })
  fs.writeFileSync(path.join(SHOTS, `${name}.png`), Buffer.from(base64, 'base64'))
}

test('Export: a video export done, then its report file', async () => {
  test.setTimeout(240_000)
  test.skip(!ex.ffmpegFetched(), 'FFmpeg is not fetched.')
  const box = makeSandbox()
  const app = await launch(box)
  const page: Page = await appWindow(app)
  await page.setViewportSize({ width: 1280, height: 800 })
  session = { box, app, page }
  await setUp(session)
  await page.getByRole('button', { name: `Open ${CAMPAIGN}` }).click()
  await expect(page.getByRole('heading', { name: CAMPAIGN, level: 2 })).toBeVisible()

  const folder = ex.outputFolder(box.root, 'Lantern Bay handover')
  const dialog = await ex.openExport(app, page, folder)
  await expect(dialog.getByRole('checkbox', { checked: true })).toHaveCount(2)
  await expect(dialog.getByLabel('Frames per second')).toBeVisible()
  await dialog.getByRole('button', { name: 'Export', exact: true }).click()
  await expect(dialog.getByText('Exported 2 ads. 0 failed.')).toBeVisible({ timeout: 180_000 })
  await shot(page, '258-video-export-done')

  const files = filesUnder(folder)
  expect(files.filter((f) => f.endsWith('.mp4'))).toHaveLength(1)
  const html = files.find((f) => f.endsWith('.html'))!
  await shootReport(session, path.join(folder, html), '257-report-html')
})

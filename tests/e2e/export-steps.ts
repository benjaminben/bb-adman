// P8-19: the steps the export end-to-end files and the p8-19 shots share. An export reaches the
// app only as a user does: the Export dialog (the folder picker answered in the main process, as
// screens.ts does for every system dialog) or export.run sent from window.api with a temporary
// folder. The job is waited for with job.get, which the window itself sends. Not a test file
// itself. Made-up names only.
import fs from 'node:fs'
import path from 'node:path'
import { expect, type ElectronApplication, type Locator, type Page } from '@playwright/test'
import { ffmpegPath } from '@/main/media/ffmpeg-path'
import * as screens from './screens'
import { command, query } from './render-helpers'

export type Place = { projectId: string; campaignId: string }

// A fresh folder for one export, inside the sandbox, so the sandbox's removal removes it.
export function outputFolder(root: string, name: string): string {
  const folder = path.join(root, name)
  fs.mkdirSync(folder, { recursive: true })
  return folder
}

// export.run from the window with the folder given, then the job waited for until it ends.
export async function exportByApi(
  page: Page,
  place: Place,
  variantIds: string[],
  outputDir: string,
  more: Record<string, unknown> = {},
): Promise<{ status: string; result: unknown }> {
  const { jobId } = (await command(page, 'export.run', {
    ...place,
    variantIds,
    outputDir,
    imageFormat: 'png',
    jpgQuality: 90,
    fps: 30,
    proceedDespiteWarnings: false,
    ...more,
  })) as { jobId: string }
  return waitForJob(page, place.projectId, jobId)
}

const ENDED = ['succeeded', 'failed', 'cancelled']

export async function waitForJob(page: Page, projectId: string, jobId: string) {
  const row = async () =>
    (await query(page, 'job.get', { projectId, jobId })) as { status: string; result: unknown }
  await expect
    .poll(async () => ENDED.includes((await row()).status), { timeout: 180_000 })
    .toBe(true)
  return row()
}

// "Export {campaign}" (DLG-6a); not the Reports dialog's "Export report".
export const exportDialog = (page: Page): Locator =>
  page.getByRole('dialog', { name: /^Export (?!report$)/ })

// "Export…", every ad ticked as the dialog opens, the folder chosen in the system picker. The
// folder row shows only the folder's base name (DLG-6a); the full path is the row's title.
export async function openExport(app: ElectronApplication, page: Page, folder: string) {
  await page.getByRole('button', { name: 'Export…' }).click()
  const dialog = exportDialog(page)
  await expect(dialog.getByText('Loading the ads…')).toHaveCount(0)
  await screens.answerOpenDialog(app, [folder])
  await dialog.getByRole('button', { name: 'Choose folder…' }).click()
  await expect(dialog.getByText(path.basename(folder), { exact: true })).toBeVisible()
  await expect(dialog.getByText(folder)).toHaveCount(0)
  return dialog
}

// The end mark shown ("{n} exported"), then Close.
export async function finishExport(dialog: Locator, line: string | RegExp): Promise<void> {
  await expect(dialog.getByText(line)).toBeVisible({ timeout: 180_000 })
  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()
}

// The window's own read of a campaign's reports, newest first.
export async function reportsOf(page: Page, place: Place) {
  return (await query(page, 'report.list', place)) as unknown as Array<{
    reportId: string
    exportNumber: number
  }>
}

export async function reportOf(page: Page, projectId: string, reportId: string) {
  const got = (await query(page, 'report.get', { projectId, reportId })) as {
    report: {
      exportNumber: number
      proceeded: { reason: string | null } | null
      warningsExportedPast: Array<{ variantId: string; checkId: string; seenBeforeExport: boolean }>
      variants: Array<{ variantId: string; changedSincePrevious: string | null; file: string }>
    }
  }
  return got.report
}

// The fetched FFmpeg in this checkout (resources/ffmpeg/{platform}-{arch}), which the app finds
// when not packaged. The test process runs it only to read exported files back.
export const FETCHED_FFMPEG = ffmpegPath({
  packaged: false,
  resourcesPath: '',
  appPath: process.cwd(),
  platform: process.platform,
  arch: process.arch,
})
export const ffmpegFetched = () => fs.existsSync(FETCHED_FFMPEG)

// The number of video frames an MP4 holds: the sample count of its one stsz box.
export function frameCountOf(mp4: Buffer): number {
  const at = mp4.indexOf(Buffer.from('stsz', 'latin1'))
  if (at < 0) throw new Error('No stsz box')
  return mp4.readUInt32BE(at + 12)
}

import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { makeSandbox, launch, type Sandbox } from './launch'
import { reportHtml } from '@/main/export/report/html'
import { samplePictures, sampleReport } from '../fixtures/report-sample'

let box: Sandbox
test.beforeEach(() => {
  box = makeSandbox()
})
test.afterEach(() => fs.rmSync(box.root, { recursive: true, force: true }))

// The sample report with text that would load something if it were ever read as markup.
const hostile = {
  ...sampleReport,
  campaignName: '<link rel="stylesheet" href="https://example.com/a.css">Spring',
  market: '<img src="https://example.com/m.png">',
  audience: '<style>body{background:url(https://example.com/b.png)}</style>',
  variants: sampleReport.variants.map((ad) => ({
    ...ad,
    title: `${ad.title}<iframe src="https://example.com/f"></iframe>‮evil`,
  })),
}

// Slice P8-8 [FR-233, A-203]: the page loads nothing. It is opened in a hidden window with
// JavaScript turned off, and every request its session sees is recorded.
test('the report page opened in a window makes no request', async () => {
  const file = path.join(box.root, 'report.html')
  fs.writeFileSync(file, reportHtml(hostile, samplePictures))
  const app = await launch(box)
  await app.firstWindow()

  const seen = await app.evaluate(async ({ BrowserWindow, session }, pagePath) => {
    const reportSession = session.fromPartition('report-html-test')
    const urls: string[] = []
    reportSession.webRequest.onBeforeRequest((details, callback) => {
      urls.push(details.url)
      callback({})
    })
    const win = new BrowserWindow({
      show: false,
      webPreferences: { javascript: false, partition: 'report-html-test', sandbox: true },
    })
    await win.loadFile(pagePath)
    // Time for any late picture, style or frame to ask.
    await new Promise((resolve) => setTimeout(resolve, 1500))
    const title = win.webContents.getTitle()
    win.destroy()
    return { urls, title }
  }, file)

  // The listener saw the page itself, so it works; nothing else was asked for.
  const pageUrl = seen.urls.filter((url) => url.startsWith('file:') && url.endsWith('report.html'))
  expect(pageUrl).toHaveLength(1)
  const others = seen.urls.filter((url) => !pageUrl.includes(url))
  expect(others.filter((url) => !url.startsWith('data:image/jpeg;base64,'))).toEqual([])
  expect(seen.title).toContain('<link rel="stylesheet"')
  await app.close()
})

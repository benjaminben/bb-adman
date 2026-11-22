// P7-8, phase-07.md open question 4: a <video> in the hidden render window loads tiny.mp4
// through the asset protocol (byte ranges, P7-6), seeks inside it, and capturePage() of the
// hidden window holds the decoded frame. tiny.mp4 is one second of solid 0x3366cc at 24 fps.
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { makeSandbox, launch, type Sandbox } from './launch'
import { command, FONT_FILE, inRenderWindow, projectWithFont, renderVariant } from './render-helpers'
import { decodePng } from './reference-compare'

const CLIP = path.resolve('tests/fixtures/video/tiny.mp4')

let box: Sandbox
test.beforeEach(() => {
  box = makeSandbox()
})
test.afterEach(() => fs.rmSync(box.root, { recursive: true, force: true }))

// Page script: a 64 by 64 video at the window's top-left corner, over everything, seeked to
// 0.5 s; gives its readyState and currentTime once the seek and one frame are done.
const seekScript = (address: string) => `new Promise((done, fail) => {
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  video.style.cssText = 'position:fixed;left:0;top:0;width:64px;height:64px;z-index:10'
  video.onerror = () => fail(new Error('video error ' + (video.error && video.error.code)))
  video.onloadedmetadata = () => { video.currentTime = 0.5 }
  video.onseeked = () => requestAnimationFrame(() => requestAnimationFrame(() =>
    done({ readyState: video.readyState, currentTime: video.currentTime, width: video.videoWidth })))
  video.src = ${JSON.stringify(address)}
  document.body.appendChild(video)
})`

test('the hidden render window seeks inside tiny.mp4 and its capture holds the frame', async () => {
  const font = path.join(box.root, 'brand.woff2')
  fs.copyFileSync(FONT_FILE, font)
  const clip = path.join(box.root, 'tiny.mp4')
  fs.copyFileSync(CLIP, clip)
  const app = await launch(box)
  try {
    const page = await app.firstWindow()
    const ids = await projectWithFont(page, box.projects, font)
    const { assetIds } = await command(page, 'asset.import', {
      projectId: ids.projectId,
      paths: [clip],
      library: 'asset',
      copy: false,
    })
    const assetId = (assetIds as string[])[0] as string
    // A draw first, so the render window exists.
    expect(await renderVariant(page, { ...ids, maxDimension: 300 })).toMatchObject({
      pngWidth: 300,
    })
    const address = `adman-asset://${ids.projectId}/${assetId}`
    const seeked = (await inRenderWindow(app, seekScript(address))) as Record<string, number>
    expect(seeked.width).toBe(64)
    expect(seeked.readyState).toBeGreaterThanOrEqual(2)
    expect(Math.abs((seeked.currentTime ?? 0) - 0.5)).toBeLessThan(1 / 24)

    const base64 = await app.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows().find((w) =>
        w.webContents.getURL().endsWith('/render.html'),
      )
      if (!win) throw new Error('There is no render window.')
      return (await win.webContents.capturePage()).toPNG().toString('base64')
    })
    const shot = await decodePng(app, Buffer.from(base64, 'base64'))
    // toBitmap gives blue, green, red, alpha. The frame's colour, give or take the video's
    // colour conversion.
    const at = (32 * shot.width + 32) * 4
    const [b, g, r] = [shot.pixels[at]!, shot.pixels[at + 1]!, shot.pixels[at + 2]!]
    expect(Math.abs(r - 0x33), `red ${r}`).toBeLessThan(16)
    expect(Math.abs(g - 0x66), `green ${g}`).toBeLessThan(16)
    expect(Math.abs(b - 0xcc), `blue ${b}`).toBeLessThan(16)
  } finally {
    await app.close()
  }
})

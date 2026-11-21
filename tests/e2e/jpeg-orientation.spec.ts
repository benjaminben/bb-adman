// EX-1 (A-55): a JPEG whose orientation tag says "turn a quarter clockwise" reaches ComfyUI
// upright, through the built app's real toPng and fitPicture (Electron's nativeImage).
// The JPEG is made in the main process by nativeImage, then an Exif segment is spliced in.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { makeSandbox, launch, type Sandbox } from './launch'
import { startComfyStandIn, type StandIn } from '../helpers/comfy-stand-in'
import { nthSentId, serveNeedsFromApp } from './stand-in-runs'
import * as screens from './screens'
import * as video from './video-screens'
import { lastGraph, runSize, uploads, type Upload } from './stand-in-uploads'
import { decodePng, type Bitmap } from './reference-compare'
import { pictureType } from '@/main/providers/picture-type'

let box: Sandbox
let stand: StandIn
let app: ElectronApplication
let page: Page

test.beforeEach(async () => {
  box = makeSandbox()
  stand = await startComfyStandIn()
  app = await launch(box, [], { ADMAN_DEV_TOOLS: '1' })
  page = await app.firstWindow()
  await serveNeedsFromApp(page, stand)
})
test.afterEach(async () => {
  try {
    await app?.close()
    await stand?.close()
  } finally {
    fs.rmSync(box.root, { recursive: true, force: true })
  }
})

// Stored 96 wide and 64 tall: the left half white, the right half black. Shown by tag 6, it
// is 64 wide and 96 tall with the white half on top.
async function sidewaysJpeg(): Promise<Buffer> {
  const base64 = await app.evaluate(({ nativeImage }) => {
    const [width, height] = [96, 64]
    const data = Buffer.alloc(width * height * 4)
    for (let i = 0; i < width * height; i++) {
      const shade = i % width < width / 2 ? 255 : 0
      data.set([shade, shade, shade, 255], i * 4)
    }
    return nativeImage.createFromBitmap(data, { width, height }).toJPEG(95).toString('base64')
  })
  const jpeg = Buffer.from(base64, 'base64')
  const tiff = [0x4d, 0x4d, 0, 42, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, 6, 0, 0]
  const body = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff, 0, 0, 0, 0]
  const app1 = [0xff, 0xe1, 0, body.length + 2, ...body]
  return Buffer.concat([jpeg.subarray(0, 2), Buffer.from(app1), jpeg.subarray(2)])
}

function shadeAt(picture: Bitmap, x: number, y: number): number {
  return picture.pixels[(y * picture.width + x) * 4] ?? -1
}

async function onlyUpload(): Promise<Bitmap> {
  const sent = uploads(stand)
  expect(sent).toHaveLength(1)
  const [upload] = sent as [Upload]
  expect(pictureType(upload.bytes)).toBe('image/png')
  return decodePng(app, Buffer.from(upload.bytes))
}

// Starts a video from the sideways JPEG and waits for the run to be sent. Gives the bytes
// written, so the test can see the user's file is unchanged.
async function videoFrom(start: string): Promise<Buffer> {
  const comfy = await screens.openSettings(page)
  await screens.saveAddress(comfy, stand.origin)
  await screens.createProject(page, 'Stand-in')
  await screens.loadBriefAndCreate(app, page)
  await screens.openCampaign(page)
  await screens.chooseProvider(page, 'ComfyUI')
  await screens.chooseSlot(page)
  await screens.setPrompt(page, screens.E2E_PROMPT)
  await screens.setCount(page, 1)
  const file = path.join(box.root, 'phone-photo.jpg')
  const bytes = await sidewaysJpeg()
  fs.writeFileSync(file, bytes)
  await video.choosePictureStart(app, page, start, [file])
  await screens.startVideo(page, 2)
  await screens.confirmLicence(page)
  await nthSentId(stand, 1)
  expect(fs.readFileSync(file).equals(bytes)).toBe(true)
  return bytes
}

const WHITE = 200
const BLACK = 55

test('A sideways JPEG reference is sent upright, its width and height swapped', async () => {
  await videoFrom(video.REFERENCE_START)
  const sent = await onlyUpload()
  expect([sent.width, sent.height]).toEqual([64, 96])
  for (const x of [4, 59]) {
    expect(shadeAt(sent, x, 4)).toBeGreaterThan(WHITE)
    expect(shadeAt(sent, x, 91)).toBeLessThan(BLACK)
  }
})

test('A sideways JPEG first frame is turned before it is cropped to the run', async () => {
  await videoFrom(video.FIRST_FRAME_START)
  const sent = await onlyUpload()
  const size = runSize(lastGraph(stand))
  expect([sent.width, sent.height]).toEqual([size.width, size.height])
  for (const x of [3, sent.width - 4]) {
    expect(shadeAt(sent, x, 3)).toBeGreaterThan(WHITE)
    expect(shadeAt(sent, x, sent.height - 4)).toBeLessThan(BLACK)
  }
})

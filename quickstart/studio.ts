// The quickstart's drawing room: a browser with no window (through Playwright) that shows the
// drawing page (served by Vite on this machine only) and photographs it. Pictures and fonts are
// handed to the page from memory, so no file is written to disk to be drawn.
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, type Browser, type Page } from '@playwright/test'
import react from '@vitejs/plugin-react'
import { createServer } from 'vite'
import type { Pixels } from '@/shared/generation/contrast'
import type { SceneAsset, SceneMode, SceneVariant } from '@/shared/scene/types'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { srcAlias } from '../path-alias.config'
import type { DrawProps } from './page/main'

export type Picture = { bytes: Uint8Array; mime: string; width: number; height: number }
// A file the page draws with: a picture (a WebP has no size) or a font.
type PageFile = {
  bytes: Uint8Array
  mime: string
  kind: 'image' | 'font'
  width: number | null
  height: number | null
}
export type Drawn = { png: Uint8Array; overflow: Record<string, boolean> }

export type Studio = {
  addPicture(id: string, picture: Pick<PageFile, 'bytes' | 'mime' | 'width' | 'height'>): void
  addFont(id: string, font: Pick<PageFile, 'bytes' | 'mime'>): void
  draw(variant: SceneVariant, layers: LayerRow[], mode: SceneMode, scale?: number): Promise<Drawn>
  pixels(png: Uint8Array): Promise<Pixels>
  close(): Promise<void>
}

const here = dirname(fileURLToPath(import.meta.url))
const PICTURES = '/__picture/'
// Playwright's own Chromium first, then a browser most computers already have.
const CHANNELS = [undefined, 'chrome', 'msedge'] as const
export const NO_BROWSER =
  'No browser was found to draw with. Run this once, then try again:\n  npx playwright install chromium'

async function openBrowser(): Promise<Browser> {
  for (const channel of CHANNELS) {
    try {
      return await chromium.launch({ headless: true, ...(channel ? { channel } : {}) })
    } catch {
      // The next one is tried.
    }
  }
  throw new Error(NO_BROWSER)
}

async function servePage() {
  const server = await createServer({
    configFile: false,
    root: resolve(here, 'page'),
    cacheDir: resolve(here, '..', 'node_modules', '.vite-quickstart'),
    logLevel: 'error',
    plugins: [react()],
    resolve: { alias: srcAlias },
    server: {
      host: '127.0.0.1',
      port: 0,
      hmr: false,
      watch: null,
      fs: { allow: [resolve(here, '..')] },
    },
  })
  await server.listen()
  const address = server.httpServer?.address()
  if (!address || typeof address === 'string') throw new Error('The drawing page did not start.')
  return { server, origin: `http://127.0.0.1:${address.port}` }
}

async function openPage(browser: Browser, origin: string, pictures: Map<string, PageFile>) {
  const context = await browser.newContext({ deviceScaleFactor: 1 })
  const page = await context.newPage()
  await page.route(`**${PICTURES}*`, (route) => {
    const id = decodeURIComponent(new URL(route.request().url()).pathname.slice(PICTURES.length))
    const picture = pictures.get(id)
    if (!picture) return route.fulfill({ status: 404, body: '' })
    return route.fulfill({ body: Buffer.from(picture.bytes), contentType: picture.mime })
  })
  await page.goto(origin)
  await page.waitForFunction(() => window.studio !== undefined)
  return page
}

function assetsOf(origin: string, pictures: Map<string, PageFile>): Record<string, SceneAsset> {
  const assets: Record<string, SceneAsset> = {}
  for (const [id, { kind, width, height }] of pictures) {
    const url = `${origin}${PICTURES}${encodeURIComponent(id)}`
    assets[id] = { url, kind, missing: false, width, height, version: 1 }
  }
  return assets
}

async function photograph(page: Page, props: DrawProps, scale: number): Promise<Drawn> {
  const { width, height } = props.variant
  await page.setViewportSize({ width, height })
  const { overflow } = await page.evaluate(
    ([sceneProps, by]) => window.studio!.draw(sceneProps, by),
    [props, scale] as const,
  )
  const clip = { x: 0, y: 0, width: Math.round(width * scale), height: Math.round(height * scale) }
  const png = await page.screenshot({ type: 'png', omitBackground: true, clip })
  return { png: new Uint8Array(png), overflow }
}

export async function openStudio(): Promise<Studio> {
  const browser = await openBrowser()
  const pictures = new Map<string, PageFile>()
  let served: Awaited<ReturnType<typeof servePage>>
  let page: Page
  try {
    served = await servePage()
    page = await openPage(browser, served.origin, pictures)
  } catch (error) {
    await browser.close()
    throw error
  }
  const { origin, server } = served
  return {
    addPicture: (id, picture) => void pictures.set(id, { ...picture, kind: 'image' }),
    addFont: (id, font) =>
      void pictures.set(id, { ...font, kind: 'font', width: null, height: null }),
    draw(variant, layers, mode, scale = 1) {
      const props = { variant, layers, assets: assetsOf(origin, pictures), timeMs: 0, mode }
      return photograph(page, props, scale)
    },
    async pixels(png) {
      const id = '__pixels'
      pictures.set(id, { bytes: png, mime: 'image/png', kind: 'image', width: 0, height: 0 })
      const url = `${origin}${PICTURES}${id}?at=${Date.now()}`
      const read = await page.evaluate((address) => window.studio!.pixels(address), url)
      pictures.delete(id)
      const rgba = new Uint8Array(Buffer.from(read.base64, 'base64'))
      return { width: read.width, height: read.height, rgba }
    },
    async close() {
      await browser.close()
      await server.close()
    },
  }
}

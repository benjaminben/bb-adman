// Shared steps for the render window and asset font end-to-end tests (P3-6).
import { expect, type ElectronApplication, type Page } from '@playwright/test'
import path from 'node:path'

// A real font file to import: the bundled Inter, so no font fixture is needed.
export const FONT_FILE = path.resolve('src/shared/scene/fonts/InterVariable.woff2')

type Reply = { ok: boolean; data: Record<string, unknown>; error?: unknown }
type Api = { [k in 'command' | 'query']: (n: string, i: unknown) => Promise<unknown> }

async function call(page: Page, kind: 'command' | 'query', name: string, input: unknown) {
  const reply = (await page.evaluate(
    ([k, n, i]) => (window as unknown as { api: Api }).api[k](n, i),
    [kind, name, input] as const,
  )) as Reply
  expect(reply.ok, JSON.stringify(reply.error)).toBe(true)
  return reply.data
}

export const command = (page: Page, name: string, input: unknown) =>
  call(page, 'command', name, input)

// A project with one font asset and a 1200 by 800 campaign; gives the IDs the tests need.
export async function projectWithFont(page: Page, folder: string, fontFile: string) {
  const { projectId } = await command(page, 'project.create', { name: 'Render', location: folder })
  const { assetIds } = await command(page, 'asset.import', {
    projectId,
    paths: [fontFile],
    library: 'asset',
    copy: false,
  })
  const { variantId } = await command(page, 'campaign.create', {
    projectId,
    brief: {
      campaignName: 'Draw',
      region: 'US',
      audience: 'All',
      message: 'Hello',
      subjects: [{ name: 'Can' }],
    },
    subjectMap: [{ subjectId: 'can', create: true }],
    languages: ['en'],
    sizes: [{ label: '1200x800', width: 1200, height: 800 }],
    templateId: 'starter',
  })
  return {
    projectId: projectId as string,
    fontId: (assetIds as string[])[0] as string,
    variantId: variantId as string,
  }
}

// variant.render from the app window; gives the reply's size and the PNG's own header size.
export function renderVariant(page: Page, input: Record<string, unknown>) {
  return page.evaluate(async (i) => {
    const api = (window as unknown as { api: Api }).api
    const reply = (await api.query('variant.render', i)) as {
      ok: boolean
      data: { png: Uint8Array; width: number; height: number }
      error?: unknown
    }
    if (!reply.ok) return { error: JSON.stringify(reply.error) }
    const view = new DataView(reply.data.png.buffer, reply.data.png.byteOffset)
    const signature = [...reply.data.png.subarray(1, 4)].map((b) => String.fromCharCode(b)).join('')
    return {
      signature,
      width: reply.data.width,
      height: reply.data.height,
      pngWidth: view.getUint32(16),
      pngHeight: view.getUint32(20),
    }
  }, input)
}

// Runs page script in the render window, from the main process. Fails when there is none.
export function inRenderWindow(app: ElectronApplication, script: string): Promise<unknown> {
  return app.evaluate(({ BrowserWindow }, code) => {
    const win = BrowserWindow.getAllWindows().find((w) =>
      w.webContents.getURL().endsWith('/render.html'),
    )
    if (!win) throw new Error('There is no render window.')
    return win.webContents.executeJavaScript(code)
  }, script)
}

// Every window: its page address and whether it is visible.
export function windows(app: ElectronApplication) {
  return app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().map((w) => ({
      url: w.webContents.getURL(),
      visible: w.isVisible(),
    })),
  )
}

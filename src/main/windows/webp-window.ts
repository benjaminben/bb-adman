// Slice WP (security class): the hidden WebP decoder window behind CoreDeps.webpToPng.
// The app window's walls (sandbox, context isolation, no Node), no preload, never shown,
// a fixed bundled page (src/renderer/webp.html), and a session of its own that lets no
// request leave the app's own page files. Bytes go in and the PNG comes back through
// executeJavaScript, which only the main process can call: the page has no channel at all.
import { app, BrowserWindow, session, type BrowserWindowConstructorOptions } from 'electron'
import { pageAddress } from './app-window'
import { isAllowedNavigation } from './navigation'
import { createWebpDecoder, type DecoderPage } from './webp-decoder'

const PARTITION = 'adman-webp-decoder'

export function webpWindowOptions(
  decoderSession: Electron.Session,
): BrowserWindowConstructorOptions {
  return {
    width: 1,
    height: 1,
    show: false,
    skipTaskbar: true,
    frame: false,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      session: decoderSession,
      backgroundThrottling: false,
      devTools: false,
    },
  }
}

// The built page's own folder (and below), or the development server's own origin.
export function decoderMayLoad(target: string, pageUrl: string): boolean {
  try {
    const to = new URL(target)
    const page = new URL(pageUrl)
    if (page.protocol !== 'file:') return to.origin === page.origin
    const folder = page.pathname.slice(0, page.pathname.lastIndexOf('/') + 1)
    return to.protocol === 'file:' && to.pathname.startsWith(folder)
  } catch {
    return false
  }
}

// The same rule as the app window's page address (spec/security.md, "Page address").
export function webpPageAddress(opts: {
  isPackaged: boolean
  rendererUrl: string | undefined
  builtPage: string
}): string {
  const page = pageAddress(opts)
  return page === opts.builtPage ? page : new URL('webp.html', page).href
}

let sessionReady: Electron.Session | null = null

// An in-memory session: no permission is granted and every other request is cancelled.
function decoderSession(pageUrl: string): Electron.Session {
  if (sessionReady) return sessionReady
  const ses = session.fromPartition(PARTITION)
  ses.webRequest.onBeforeRequest((details, callback) =>
    callback({ cancel: !decoderMayLoad(details.url, pageUrl) }),
  )
  ses.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  ses.setPermissionCheckHandler(() => false)
  sessionReady = ses
  return ses
}

function openWebpPage(): DecoderPage {
  const pageUrl = webpPageAddress({
    isPackaged: app.isPackaged,
    rendererUrl: process.env.ELECTRON_RENDERER_URL,
    builtPage: new URL('../renderer/webp.html', import.meta.url).href,
  })
  const win = new BrowserWindow(webpWindowOptions(decoderSession(pageUrl)))
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedNavigation(url, pageUrl)) event.preventDefault()
  })
  win.on('unresponsive', () => win.destroy())
  // A crash or a closed window fails the conversion that waits on it.
  const gone = new Promise<never>((_, reject) => {
    win.webContents.once('render-process-gone', () => reject(new Error('gone')))
    win.once('closed', () => reject(new Error('gone')))
  })
  gone.catch(() => undefined)
  const loaded = win.loadURL(pageUrl)
  const run = (base64: string) =>
    win.webContents.executeJavaScript(`window.admanDecodeWebp(${JSON.stringify(base64)})`)
  return {
    decode: (base64) => Promise.race([loaded.then(() => run(base64)), gone]),
    end: () => {
      if (!win.isDestroyed()) win.destroy()
    },
  }
}

const decoder = createWebpDecoder(openWebpPage)

export const webpToPng = (bytes: Uint8Array): Promise<Uint8Array> => decoder.convert(bytes)

// Ended with the app window and before quit, so a hidden window never keeps the app open.
export const endWebpDecoder = (): void => decoder.end()

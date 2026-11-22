// Creates the app window with the SPEC 8.2 settings, the SPEC 8.1 navigation rules and the
// SPEC 1.3 opening state.
import { app, BrowserWindow, screen, shell } from 'electron'
import { fileURLToPath } from 'node:url'
import { appWindowOptions } from './app-window-options'
import { decideWindowOpen, isAllowedNavigation } from './navigation'
import { revealOnce } from './reveal-window'

const DEV_SERVER = /^http:\/\/localhost:\d{1,5}\/?$/

// SPEC 8.2: the development server's address only when the app is not packaged and the
// address is http://localhost:{port}. In every other case, the built page.
export function pageAddress(opts: {
  isPackaged: boolean
  rendererUrl: string | undefined
  builtPage: string
}): string {
  const { isPackaged, rendererUrl, builtPage } = opts
  if (!isPackaged && rendererUrl !== undefined && DEV_SERVER.test(rendererUrl)) return rendererUrl
  return builtPage
}

export function createAppWindow(quiet = false): BrowserWindow {
  const preload = fileURLToPath(new URL('../preload/index.cjs', import.meta.url))
  const win = new BrowserWindow(appWindowOptions(preload, quiet))
  const pageUrl = pageAddress({
    isPackaged: app.isPackaged,
    rendererUrl: process.env.ELECTRON_RENDERER_URL,
    builtPage: new URL('../renderer/index.html', import.meta.url).href,
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    const decision = decideWindowOpen(url)
    if (decision.openExternal) void shell.openExternal(url)
    return { action: decision.action }
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedNavigation(url, pageUrl)) event.preventDefault()
  })
  // SPEC 1.3 [D-031]: maximized before it is first shown, on every launch. Never full screen.
  // Quiet mode (quiet.ts) gives the window the maximized size and never shows it: on macOS
  // maximize() would show it.
  if (quiet) win.setBounds(screen.getPrimaryDisplay().workArea)
  else
    revealOnce(win, () => {
      win.maximize()
      win.show()
    })
  void win.loadURL(pageUrl)
  return win
}

// spec/scene.md "Life of the window": the one hidden render window. Made on the first draw,
// never shown, ended on a crash, a hang, a time-out, when the app window closes and before quit.
import { app, BrowserWindow, type BrowserWindowConstructorOptions } from 'electron'
import { fileURLToPath } from 'node:url'
import { appWindowOptions } from '@/main/windows/app-window-options'
import { isAllowedNavigation } from '@/main/windows/navigation'
import { devToolsEnabled } from '@/main/dev-tools-flag'
import { renderPageAddress } from './render-page'

// The app window's webPreferences, plus offscreen drawing that never slows down while hidden.
export function renderWindowOptions(
  preloadPath: string,
  devTools: boolean,
): BrowserWindowConstructorOptions {
  return {
    width: 1,
    height: 1,
    show: false,
    skipTaskbar: true,
    frame: false,
    useContentSize: true,
    paintWhenInitiallyHidden: true,
    webPreferences: {
      ...appWindowOptions(preloadPath).webPreferences,
      offscreen: true,
      backgroundThrottling: false,
      devTools,
    },
  }
}

export type RenderWindow = { win: BrowserWindow; loaded: Promise<void> }

let current: RenderWindow | null = null

// The window and its loaded page; a new one when there is none.
export function renderWindow(): RenderWindow {
  if (current && !current.win.isDestroyed()) return current
  const preload = fileURLToPath(new URL('../preload/render.cjs', import.meta.url))
  const devTools = devToolsEnabled(app.isPackaged, process.env)
  const win = new BrowserWindow(renderWindowOptions(preload, devTools))
  const pageUrl = renderPageAddress({
    isPackaged: app.isPackaged,
    rendererUrl: process.env.ELECTRON_RENDERER_URL,
    builtPage: new URL('../renderer/render.html', import.meta.url).href,
  })
  // Every new window is denied; the page never leaves its own address.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedNavigation(url, pageUrl)) event.preventDefault()
  })
  win.webContents.on('render-process-gone', () => endRenderWindow())
  win.on('unresponsive', () => endRenderWindow())
  win.on('closed', () => {
    if (current?.win === win) current = null
  })
  const made: RenderWindow = { win, loaded: win.loadURL(pageUrl) }
  current = made
  return made
}

export function endRenderWindow(): void {
  const win = current?.win
  current = null
  if (win && !win.isDestroyed()) win.destroy()
}

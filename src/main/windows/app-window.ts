// Creates the app window with the SPEC 8.2 settings and the SPEC 8.1 navigation rules.
import { BrowserWindow, shell } from 'electron'
import { fileURLToPath } from 'node:url'
import { appWindowOptions } from './app-window-options'
import { decideWindowOpen, isAllowedNavigation } from './navigation'

export function createAppWindow(): BrowserWindow {
  const preload = fileURLToPath(new URL('../preload/index.cjs', import.meta.url))
  const win = new BrowserWindow(appWindowOptions(preload))
  const devUrl = process.env.ELECTRON_RENDERER_URL
  const pageUrl = devUrl ?? new URL('../renderer/index.html', import.meta.url).href

  win.webContents.setWindowOpenHandler(({ url }) => {
    const decision = decideWindowOpen(url)
    if (decision.openExternal) void shell.openExternal(url)
    return { action: decision.action }
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedNavigation(url, pageUrl)) event.preventDefault()
  })
  win.once('ready-to-show', () => win.show())
  void win.loadURL(pageUrl)
  return win
}

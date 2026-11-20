import type { BrowserWindowConstructorOptions } from 'electron'

// SPEC 8.2 window settings. The hidden render window (Phase 3) uses the same webPreferences.
export function appWindowOptions(preloadPath: string): BrowserWindowConstructorOptions {
  return {
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'Adman',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  }
}

import type { BrowserWindowConstructorOptions } from 'electron'
import { APP_DISPLAY_NAME } from '@/shared/config/app-name'

// SPEC 8.2 window settings. The hidden render window (Phase 3) uses the same webPreferences.
// In quiet mode (quiet.ts) the window stays hidden, so its page is not throttled: animation
// frames keep running and the page reports itself visible.
export function appWindowOptions(
  preloadPath: string,
  quiet = false,
): BrowserWindowConstructorOptions {
  return {
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: APP_DISPLAY_NAME,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      ...(quiet ? { backgroundThrottling: false } : {}),
    },
  }
}

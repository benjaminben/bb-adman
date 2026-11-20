// SPEC 8.1: navigation and new windows are blocked; https links open in the system browser.
export function decideWindowOpen(url: string): { action: 'deny'; openExternal: boolean } {
  try {
    return { action: 'deny', openExternal: new URL(url).protocol === 'https:' }
  } catch {
    return { action: 'deny', openExternal: false }
  }
}

export function isAllowedNavigation(target: string, appUrl: string): boolean {
  try {
    const to = new URL(target)
    const app = new URL(appUrl)
    if (app.protocol === 'file:') return to.protocol === 'file:' && to.pathname === app.pathname
    return to.origin === app.origin
  } catch {
    return false
  }
}

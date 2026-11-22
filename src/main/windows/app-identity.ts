// D10: the name and icon people see. The About panel says the display name (its default is
// app.name, which stays "Adman" for the data folder and Keychain). Under `npm run dev` on macOS
// the Dock shows resources/icon.png; a packaged app has the icon in its bundle.
import path from 'node:path'

// Electron's app, or a stand-in in tests.
export type IdentityApp = {
  isPackaged: boolean
  getAppPath(): string
  setAboutPanelOptions(options: { applicationName: string }): void
  dock?: { setIcon(image: string): void }
}

export function applyAppIdentity(
  app: IdentityApp,
  platform: NodeJS.Platform,
  displayName: string,
): void {
  app.setAboutPanelOptions({ applicationName: displayName })
  if (platform === 'darwin' && !app.isPackaged) {
    app.dock?.setIcon(path.join(app.getAppPath(), 'resources/icon.png'))
  }
}

// D10: the About panel names the app "AdManager"; under `npm run dev` on macOS the Dock shows
// the app's icon (a packaged app has it from its bundle).
import { describe, expect, it, vi } from 'vitest'
import path from 'node:path'
import { applyAppIdentity } from '@/main/windows/app-identity'

function fakeApp(isPackaged: boolean) {
  return {
    isPackaged,
    getAppPath: () => '/work/adman',
    setAboutPanelOptions: vi.fn(),
    dock: { setIcon: vi.fn() },
  }
}

describe('applyAppIdentity [D10]', () => {
  it.each([true, false])('names the app in the About panel (packaged %s)', (isPackaged) => {
    const app = fakeApp(isPackaged)
    applyAppIdentity(app, 'darwin', 'AdManager')
    expect(app.setAboutPanelOptions).toHaveBeenCalledWith({ applicationName: 'AdManager' })
  })

  it('sets the Dock icon from resources/icon.png when unpackaged on macOS', () => {
    const app = fakeApp(false)
    applyAppIdentity(app, 'darwin', 'AdManager')
    expect(app.dock.setIcon).toHaveBeenCalledWith(path.join('/work/adman', 'resources/icon.png'))
  })

  it.each([
    ['packaged on macOS', true, 'darwin'],
    ['on Windows', false, 'win32'],
  ] as const)('leaves the Dock alone %s', (_case, isPackaged, platform) => {
    const app = fakeApp(isPackaged)
    applyAppIdentity(app, platform, 'AdManager')
    expect(app.dock.setIcon).not.toHaveBeenCalled()
  })
})

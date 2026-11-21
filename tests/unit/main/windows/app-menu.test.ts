// spec/editor.md, "Keyboard shortcuts", the app menu: on macOS the app menu (About, Hide,
// Quit); on both systems Edit (as roles) and Window. No View menu, so Mod+=, Mod+- and Mod+0
// never zoom the page, and no reload. "Toggle Developer Tools" only with the hand-test flag.
import { describe, expect, it, vi } from 'vitest'
import type { MenuItemConstructorOptions } from 'electron'
import { appMenuTemplate, setAppMenu } from '@/main/windows/app-menu'

type Item = MenuItemConstructorOptions

const items = (menu: Item | undefined): Item[] => (menu?.submenu as Item[] | undefined) ?? []
const roles = (menu: Item | undefined) => items(menu).map((i) => i.role ?? i.type)
const all = (template: Item[]): Item[] => template.flatMap((m) => [m, ...items(m)])

describe('app menu [spec/editor.md "Keyboard shortcuts"]', () => {
  it.each([
    ['macOS', 'darwin', ['Adman', 'Edit', 'Window']],
    ['Windows', 'win32', ['Edit', 'Window']],
  ] as const)('on %s has these menus and no View menu', (_os, platform, labels) => {
    const template = appMenuTemplate({ platform, appName: 'Adman', devTools: false })
    expect(template.map((m) => m.label)).toEqual(labels)
  })

  it('gives the macOS app menu About, Hide and Quit', () => {
    const [app] = appMenuTemplate({ platform: 'darwin', appName: 'Adman', devTools: false })
    expect(roles(app)).toEqual(['about', 'separator', 'hide', 'separator', 'quit'])
  })

  it('has Edit as roles, so text fields keep their own keys, and Window with Minimize and Close', () => {
    const template = appMenuTemplate({ platform: 'win32', appName: 'Adman', devTools: false })
    const edit = template.find((m) => m.label === 'Edit')
    const window = template.find((m) => m.label === 'Window')
    expect(roles(edit)).toEqual(['undo', 'redo', 'separator', 'cut', 'copy', 'paste', 'selectAll'])
    expect(roles(window)).toEqual(['minimize', 'close'])
  })

  it.each(['darwin', 'win32'] as const)(
    'has no zoom, reload or full-screen item anywhere on %s, even with the flag',
    (platform) => {
      const template = appMenuTemplate({ platform, appName: 'Adman', devTools: true })
      const banned = ['zoomIn', 'zoomOut', 'resetZoom', 'reload', 'forceReload', 'togglefullscreen']
      expect(all(template).filter((i) => banned.includes(String(i.role)))).toEqual([])
    },
  )

  it.each([
    [true, ['Toggle Developer Tools']],
    [false, []],
  ])('with the hand-test flag %s lists %j', (devTools, labels) => {
    const template = appMenuTemplate({ platform: 'darwin', appName: 'Adman', devTools })
    const found = all(template).filter((i) => i.role === 'toggleDevTools')
    expect(found.map((i) => i.label)).toEqual(labels)
  })

  it('sets the built menu as the application menu', () => {
    const built = { built: true }
    const menu = { buildFromTemplate: vi.fn(() => built), setApplicationMenu: vi.fn() }
    setAppMenu(menu, { platform: 'win32', appName: 'Adman', devTools: false })
    expect(menu.buildFromTemplate).toHaveBeenCalledWith(
      appMenuTemplate({ platform: 'win32', appName: 'Adman', devTools: false }),
    )
    expect(menu.setApplicationMenu).toHaveBeenCalledWith(built)
  })
})

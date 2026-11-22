// spec/editor.md, "Keyboard shortcuts", the app menu: on macOS the app menu (About, Hide, Quit),
// and on both systems Edit (as roles, so text fields keep working) and Window. There is no View
// menu, so Mod+=, Mod+- and Mod+0 reach the editor and never zoom the whole page, and there is
// no reload. With the hand-test flag on, Window adds "Toggle Developer Tools".
import type { MenuItemConstructorOptions } from 'electron'

export type AppMenuOptions = { platform: NodeJS.Platform; appName: string; devTools: boolean }

// Electron's Menu, or a stand-in in tests.
type MenuApi<M> = {
  buildFromTemplate(template: MenuItemConstructorOptions[]): M
  setApplicationMenu(menu: M): void
}

const separator: MenuItemConstructorOptions = { type: 'separator' }

export function appMenuTemplate(options: AppMenuOptions): MenuItemConstructorOptions[] {
  const app: MenuItemConstructorOptions = {
    label: options.appName,
    // Labelled here (D10): the roles' own labels use app.name, which stays "Adman".
    submenu: [
      { role: 'about', label: `About ${options.appName}` },
      separator,
      { role: 'hide', label: `Hide ${options.appName}` },
      separator,
      { role: 'quit', label: `Quit ${options.appName}` },
    ],
  }
  const edit: MenuItemConstructorOptions = {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      separator,
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' },
    ],
  }
  const devTools: MenuItemConstructorOptions[] = options.devTools
    ? [{ role: 'toggleDevTools', label: 'Toggle Developer Tools' }]
    : []
  const window: MenuItemConstructorOptions = {
    label: 'Window',
    submenu: [{ role: 'minimize' }, { role: 'close' }, ...devTools],
  }
  return options.platform === 'darwin' ? [app, edit, window] : [edit, window]
}

export function setAppMenu<M>(menu: MenuApi<M>, options: AppMenuOptions): void {
  menu.setApplicationMenu(menu.buildFromTemplate(appMenuTemplate(options)))
}

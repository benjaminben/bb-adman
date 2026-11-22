// D10 (spec/phases/round-2-platform.md): people see "AdManager"; the data stays under "Adman".
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { APP_DISPLAY_NAME } from '@/shared/config/app-name'
import { appWindowOptions } from '@/main/windows/app-window-options'

type Pkg = { name: string; productName: string; scripts: Record<string, string> }
type Builder = {
  appId: string
  productName: string
  mac: { icon: string }
  win: { icon: string }
  electronFuses: Record<string, boolean>
}

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')) as Pkg
const builder = JSON.parse(fs.readFileSync('electron-builder.json', 'utf8')) as Builder

describe('app names [D10]', () => {
  // Do not change these two. At run time app.name comes from package.json's productName, and
  // the data folder (~/Library/Application Support/Adman, %APPDATA%\Adman) and the Keychain
  // entry "Adman Safe Storage" hang on app.name. Changing either would leave a person's
  // projects list, settings and saved keys behind.
  it('keeps package.json name "adman" and productName "Adman"', () => {
    expect(pkg.name).toBe('adman')
    expect(pkg.productName).toBe('Adman')
  })

  it('names the built app "AdManager" and keeps the app ID', () => {
    expect(APP_DISPLAY_NAME).toBe('AdManager')
    expect(builder.productName).toBe(APP_DISPLAY_NAME)
    expect(builder.appId).toBe('com.adman.app')
  })

  it('titles the app window "AdManager"', () => {
    expect(fs.readFileSync('src/renderer/index.html', 'utf8')).toContain('<title>AdManager</title>')
    expect(appWindowOptions('/preload.cjs').title).toBe('AdManager')
  })

  it('gives the macOS and Windows builds an icon file that exists', () => {
    expect(builder.mac.icon).toBe('resources/icon.icns')
    expect(builder.win.icon).toBe('resources/icon.png')
    expect(fs.existsSync(builder.mac.icon)).toBe(true)
    expect(fs.existsSync(builder.win.icon)).toBe(true)
  })

  it('keeps the Electron fuses as they are', () => {
    expect(builder.electronFuses).toEqual({
      runAsNode: false,
      enableNodeOptionsEnvironmentVariable: false,
      enableNodeCliInspectArguments: false,
      onlyLoadAppFromAsar: true,
      resetAdHocDarwinSignature: true,
    })
  })

  it('checks the packaged app with its own command, outside npm test', () => {
    expect(pkg.scripts['test:package']).toBe('vitest run --config vitest.package.config.ts')
  })
})

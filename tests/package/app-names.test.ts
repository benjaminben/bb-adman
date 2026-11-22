// D10: the packaged app is called "AdManager" by macOS, while the package.json inside it keeps
// productName "Adman", so app.name, the data folder and the Keychain entry stay as they were.
// Run after `npm run package:dir`. It reads files only: starting the packaged app would use
// the person's own data folder and Keychain.
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { extractFile } from '@electron/asar'

const folder = process.arch === 'arm64' ? 'mac-arm64' : 'mac'
const bundle = path.resolve('dist', folder, 'AdManager.app', 'Contents')

type DocumentType = { CFBundleTypeExtensions?: string[] }
type InfoPlist = {
  CFBundleName: string
  CFBundleDisplayName: string
  CFBundleExecutable: string
  CFBundleIdentifier: string
  CFBundleIconFile: string
  CFBundleDocumentTypes: DocumentType[]
}

function infoPlist(): InfoPlist {
  const file = path.join(bundle, 'Info.plist')
  return JSON.parse(
    execFileSync('plutil', ['-convert', 'json', '-o', '-', file], { encoding: 'utf8' }),
  )
}

describe.skipIf(process.platform !== 'darwin')('the packaged macOS app [D10]', () => {
  it('is named AdManager and keeps the bundle ID', () => {
    const info = infoPlist()
    expect(info.CFBundleName).toBe('AdManager')
    expect(info.CFBundleDisplayName).toBe('AdManager')
    expect(info.CFBundleExecutable).toBe('AdManager')
    expect(info.CFBundleIdentifier).toBe('com.adman.app')
  })

  it('has its icon file in Resources', () => {
    const icon = infoPlist().CFBundleIconFile
    const name = icon.endsWith('.icns') ? icon : `${icon}.icns`
    expect(fs.existsSync(path.join(bundle, 'Resources', name))).toBe(true)
  })

  it('lists the .adman document type', () => {
    const extensions = infoPlist().CFBundleDocumentTypes.flatMap((t) => t.CFBundleTypeExtensions)
    expect(extensions).toContain('adman')
  })

  it('keeps productName "Adman" in the archived package.json, so app.name stays Adman', () => {
    const archive = path.join(bundle, 'Resources', 'app.asar')
    const pkg = JSON.parse(extractFile(archive, 'package.json').toString('utf8'))
    expect(pkg.productName).toBe('Adman')
    expect(pkg.name).toBe('adman')
  })
})

// The Windows build is checked by hand by the stakeholder (D-087); this check reads a macOS
// bundle only.
describe.skipIf(process.platform === 'darwin')('the packaged app on this system', () => {
  it.skip('is checked by hand on Windows: this check reads a macOS bundle only', () => {})
})

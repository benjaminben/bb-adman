import { describe, it, expect } from 'vitest'
import fs from 'node:fs'

type Target = { target: string; arch: string[] }
type BuilderConfig = {
  appId: string
  productName: string
  fileAssociations: Array<{ ext: string; name: string; role: string }>
  mac: { target: Target[]; identity: null; extendInfo: Record<string, unknown> }
  win: { target: Target[] }
  asarUnpack: string[]
  publish?: unknown
}

const config = JSON.parse(fs.readFileSync('electron-builder.json', 'utf8')) as BuilderConfig

describe('installers [SPEC 2, 3.1, 7.5, R-16]', () => {
  it('uses the app ID and product name from SPEC 3.1', () => {
    expect(config.appId).toBe('com.adman.app')
    expect(config.productName).toBe('AdManager')
  })

  it('registers the .adman extension so a double-click opens the project [R-06]', () => {
    expect(config.fileAssociations).toEqual([
      expect.objectContaining({ ext: 'adman', name: 'Adman Project', role: 'Editor' }),
    ])
  })

  it('declares the .adman document type to macOS', () => {
    const types = config.mac.extendInfo.UTExportedTypeDeclarations as Array<Record<string, unknown>>
    expect(types[0]).toMatchObject({
      UTTypeIdentifier: 'com.adman.project',
      UTTypeTagSpecification: { 'public.filename-extension': ['adman'] },
    })
  })

  it('builds a DMG for macOS arm64 and x64 and NSIS for Windows x64', () => {
    expect(config.mac.target).toEqual([{ target: 'dmg', arch: ['arm64', 'x64'] }])
    expect(config.win.target).toEqual([{ target: 'nsis', arch: ['x64'] }])
  })

  it('builds unsigned installers in this build', () => {
    expect(config.mac.identity).toBeNull()
  })

  it('keeps the native SQLite module outside the archive so it can load', () => {
    expect(config.asarUnpack).toContain('**/*.node')
  })

  // Releases are built on a person's own computer and uploaded by hand (D-102).
  it('never publishes from the builder, and has one release script per system', () => {
    expect(config.publish).toBeNull()
    const scripts = (
      JSON.parse(fs.readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> }
    ).scripts
    expect(scripts['package:mac']).toBe(
      'npm run build && electron-builder --mac dmg --arm64 --publish never',
    )
    expect(scripts['package:win']).toBe(
      'npm run build && electron-builder --win nsis --x64 --publish never',
    )
    expect(fs.existsSync('.github/workflows/release.yml')).toBe(false)
  })
})

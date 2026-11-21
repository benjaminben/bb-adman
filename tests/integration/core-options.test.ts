import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { createCore, type Core, type CoreOptions } from '../../src/main/core'
import { devCommands } from '../../src/main/commands/dev'
import { fakeCrypto } from './core-fixture'

let core: Core | null = null
let root = ''
afterEach(() => {
  core?.closeAll()
  core = null
  if (root) fs.rmSync(root, { recursive: true, force: true })
})

function build(extra: Partial<CoreOptions> = {}): Core {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-core-options-'))
  core = createCore({
    userDataDir: path.join(root, 'userData'),
    documentsDir: path.join(root, 'Documents'),
    appVersion: '0.1.0',
    crypto: fakeCrypto(),
    env: {},
    emit: () => undefined,
    askPermission: async () => false,
    ...extra,
  })
  return core
}

describe('createCore options openExternal and devTools [SPEC 12, 14 step 0 R1]', () => {
  it('puts the asset service and the job service on CoreDeps', async () => {
    const deps = build().deps
    for (const name of [
      'missingAssetIds',
      'resolve',
      'assetsDir',
      'writeManaged',
      'read',
    ] as const) {
      expect(typeof deps.assets[name]).toBe('function')
    }
    expect(deps.jobs.activeCount('p1')).toBe(0)
  })

  it('hands the openExternal option to every domain through CoreDeps', async () => {
    const openExternal = vi.fn(async () => undefined)
    const deps = build({ openExternal }).deps
    await deps.openExternal('https://example.com/')
    expect(openExternal).toHaveBeenCalledWith('https://example.com/')
  })

  it('refuses to open anything when no openExternal option is given', async () => {
    const deps = build().deps
    await expect(deps.openExternal('https://example.com/')).rejects.toThrow(/not available/)
  })

  it('has devTools false unless the option says true', () => {
    expect(build().deps.devTools).toBe(false)
    core?.closeAll()
    fs.rmSync(root, { recursive: true, force: true })
    expect(build({ devTools: true }).deps.devTools).toBe(true)
  })

  it('gives no dev commands when devTools is false', () => {
    const deps = build().deps
    expect(devCommands(deps)).toEqual([])
    expect(core?.commandNames.filter((n) => n.startsWith('dev.'))).toEqual([])
  })
})

describe('createCore option toPng [SPEC 6.2 1.18, 14 K3]', () => {
  it('hands the toPng option to every domain through CoreDeps', () => {
    const png = new Uint8Array([9, 9])
    const toPng = vi.fn(() => png)
    const deps = build({ toPng }).deps
    expect(deps.toPng(new Uint8Array([1]))).toBe(png)
    expect(toPng).toHaveBeenCalledWith(new Uint8Array([1]))
  })

  it('throws when no toPng option is given', () => {
    const deps = build().deps
    expect(() => deps.toPng(new Uint8Array([0xff, 0xd8, 0xff]))).toThrow(/not available/)
  })
})

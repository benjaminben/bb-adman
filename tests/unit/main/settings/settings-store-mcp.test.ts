import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createSettingsStore } from '../../../../src/main/settings/settings-store'
import { defaultSettings } from '../../../../src/main/settings/defaults'

let dir: string
let file: string
const open = () =>
  createSettingsStore({ file, defaults: defaultSettings(path.join(dir, 'Documents')) })

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-settings-'))
  file = path.join(dir, 'settings.json')
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

describe('settings.mcp.enabled has one writer [SPEC 4.2 notes, 6.8]', () => {
  it('is off on first run', () => {
    expect(open().get().mcp.enabled).toBe(false)
  })

  it('setMcpEnabled saves the flag and keeps the port and the other mcp keys', () => {
    const store = open()
    store.update({ mcp: { port: 48123, autoApproveDestructive: true } })
    store.setMcpEnabled(true)
    const saved = JSON.parse(fs.readFileSync(file, 'utf8')) as { mcp: unknown }
    expect(saved.mcp).toEqual({ enabled: true, port: 48123, autoApproveDestructive: true })
    expect(open().get().mcp.enabled).toBe(true)
    store.setMcpEnabled(false)
    expect(open().get().mcp).toEqual({ enabled: false, port: 48123, autoApproveDestructive: true })
  })
})

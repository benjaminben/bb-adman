// R2E-10 (spec/phases/round-2-editor.md D8): settings.setup.done, the first-run mark.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createSettingsStore } from '@/main/settings/settings-store'
import { defaultSettings } from '@/main/settings/defaults'
import { settingsPatchSchema } from '@/shared/schemas/settings'

let dir: string
let file: string
const defaults = () => defaultSettings(path.join(dir, 'Documents'))
const open = () => createSettingsStore({ file, defaults: defaults() })

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-settings-setup-'))
  file = path.join(dir, 'settings.json')
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

describe('settings.setup.done [R2E-10, D8]', () => {
  it('defaults to not done', () => {
    expect(defaults().setup).toEqual({ done: false })
  })

  it('loads done: false from an older file with no setup key, keeping the other keys', () => {
    const older: Record<string, unknown> = { ...defaults(), generation: { optionsPerRun: 2 } }
    delete older.setup
    fs.writeFileSync(file, JSON.stringify(older))
    const store = open()
    expect(store.get().setup).toEqual({ done: false })
    expect(store.get().generation).toEqual({ optionsPerRun: 2 })
  })

  it('is written by settings.update and kept after a reload', () => {
    open().update(settingsPatchSchema.parse({ setup: { done: true } }))
    expect(open().get().setup).toEqual({ done: true })
  })

  it.each([
    ['an unknown key', { done: true, step: 2 }],
    ['a string', { done: 'yes' }],
    ['null', null],
  ])('settings.update refuses %s under setup', (_name, setup) => {
    expect(settingsPatchSchema.safeParse({ setup }).success).toBe(false)
  })
})

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
const writeWith = (extra: Record<string, unknown>) =>
  fs.writeFileSync(
    file,
    JSON.stringify({ ...defaults(), generation: { optionsPerRun: 2 }, ...extra }),
  )

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-settings-'))
  file = path.join(dir, 'settings.json')
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

describe('settings.licenceConfirmed [D-088, S2-4]', () => {
  it('defaults to an empty list', () => {
    expect(open().get().licenceConfirmed).toEqual([])
  })

  it.each([
    ['not a list', 'MiniMax H3'],
    ['a non-text entry', ['MiniMax H3', 7]],
    ['an empty label', ['']],
    ['a label over 100 characters', ['x'.repeat(101)]],
    ['more than 50 labels', Array.from({ length: 51 }, (_, i) => `Model ${i}`)],
  ])('reads %s from the file as [] and keeps the other keys', (_case, value) => {
    writeWith({ licenceConfirmed: value })
    const loaded = open().get()
    expect(loaded.licenceConfirmed).toEqual([])
    expect(loaded.generation).toEqual({ optionsPerRun: 2 })
  })

  it('loads a good list as it is', () => {
    writeWith({ licenceConfirmed: ['MiniMax H3', 'FLUX 3 klein'] })
    expect(open().get().licenceConfirmed).toEqual(['MiniMax H3', 'FLUX 3 klein'])
  })

  it('settings.update takes a list, which replaces the saved one', () => {
    const store = open()
    store.update(settingsPatchSchema.parse({ licenceConfirmed: ['MiniMax H3', 'FLUX 3 klein'] }))
    store.update(settingsPatchSchema.parse({ licenceConfirmed: ['FLUX 3 klein'] }))
    expect(open().get().licenceConfirmed).toEqual(['FLUX 3 klein'])
  })

  it.each([
    [['MiniMax H3', 7]],
    [[null]],
    [['']],
    ['MiniMax H3'],
    [Array.from({ length: 51 }, (_, i) => `Model ${i}`)],
  ])('settings.update refuses %j', (value) => {
    expect(settingsPatchSchema.safeParse({ licenceConfirmed: value }).success).toBe(false)
  })
})

// P8-1 (spec/phases/phase-08.md "Settings" [A-201]): reports.exporterName found in settings.json.
// A bad value loads as '', the other keys as usual; settings.update is its writer.
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
const onDisk = () => JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>
const writeWith = (extra: Record<string, unknown>) =>
  fs.writeFileSync(
    file,
    JSON.stringify({ ...defaults(), generation: { optionsPerRun: 2 }, ...extra }),
  )

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-settings-reports-'))
  file = path.join(dir, 'settings.json')
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

describe('reports.exporterName in settings.json [P8-1, A-201]', () => {
  it('defaults to an empty name', () => {
    expect(defaults().reports).toEqual({ exporterName: '' })
  })

  it("loads '' from a file with no reports key, keeping the other keys", () => {
    const without: Record<string, unknown> = { ...defaults(), generation: { optionsPerRun: 2 } }
    delete without.reports
    fs.writeFileSync(file, JSON.stringify(without))
    const store = open()
    expect(store.get().reports).toEqual({ exporterName: '' })
    expect(store.get().generation).toEqual({ optionsPerRun: 2 })
  })

  it.each([
    ['a 101-character name', { exporterName: 'a'.repeat(101) }],
    ['a name with a control character', { exporterName: 'Sam\u0000Rivera' }],
    ['a number', { exporterName: 7 }],
    ['a list', ['Sam']],
    ['null', null],
  ])("loads %s as '' with the other keys kept", (_name, reports) => {
    writeWith({ reports })
    const store = open()
    expect(store.get().reports).toEqual({ exporterName: '' })
    expect(store.get().generation).toEqual({ optionsPerRun: 2 })
    expect(store.get().export).toEqual(defaults().export)
  })

  it('keeps a good name through a save', () => {
    writeWith({ reports: { exporterName: 'Sam Rivera' } })
    const store = open()
    expect(store.get().reports).toEqual({ exporterName: 'Sam Rivera' })
    store.touchRecent({ path: '/p/A.adman', name: 'A' }, '2026-11-21T00:00:00.000Z')
    expect(onDisk().reports).toEqual({ exporterName: 'Sam Rivera' })
    expect(open().get().reports).toEqual({ exporterName: 'Sam Rivera' })
  })

  it('is written by settings.update, trimmed', () => {
    const store = open()
    const patch = settingsPatchSchema.parse({ reports: { exporterName: '  Sam Rivera ' } })
    store.update(patch)
    expect(onDisk().reports).toEqual({ exporterName: 'Sam Rivera' })
  })

  it.each([
    ['a 101-character name', { exporterName: 'a'.repeat(101) }],
    ['a name with a control character', { exporterName: 'Sam\nRivera' }],
    ['an unknown key', { exporterName: 'Sam', extra: 1 }],
  ])('settings.update refuses %s', (_name, reports) => {
    expect(settingsPatchSchema.safeParse({ reports }).success).toBe(false)
  })
})

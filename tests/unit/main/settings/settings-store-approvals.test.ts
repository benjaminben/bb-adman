// AP-5 (spec/approvals.md "Settings", "Named tests"): approvals.baseUrl found in settings.json.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createSettingsStore } from '@/main/settings/settings-store'
import { defaultSettings } from '@/main/settings/defaults'

let dir: string
let file: string
const defaults = () => defaultSettings(path.join(dir, 'Documents'))
const open = () => createSettingsStore({ file, defaults: defaults() })
const onDisk = () => JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>
const writeRaw = (text: string) => fs.writeFileSync(file, text)
const writeWith = (extra: Record<string, unknown>) =>
  writeRaw(JSON.stringify({ ...defaults(), generation: { optionsPerRun: 2 }, ...extra }))
const save = (store: ReturnType<typeof open>) =>
  store.touchRecent({ path: '/p/A.adman', name: 'A' }, '2026-11-21T00:00:00.000Z')

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-settings-approvals-'))
  file = path.join(dir, 'settings.json')
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

describe('approvals.baseUrl found in settings.json [spec/approvals.md "Settings"]', () => {
  it('defaults to a null address', () => {
    expect(defaults().approvals).toEqual({ baseUrl: null })
    expect(open().get().approvals).toEqual({ baseUrl: null })
  })

  it('gives a file without approvals the default, keeping the other keys', () => {
    const withoutApprovals: Record<string, unknown> = {
      ...defaults(),
      generation: { optionsPerRun: 2 },
    }
    delete withoutApprovals.approvals
    writeRaw(JSON.stringify(withoutApprovals))
    const store = open()
    expect(store.get().approvals).toEqual({ baseUrl: null })
    expect(store.get().generation).toEqual({ optionsPerRun: 2 })
  })

  it.each([
    ['plain http', 'http://approvals.example.com'],
    ['the local test address (the store does not know about dev tools)', 'http://127.0.0.1:8787'],
    ['an address with a path', 'https://approvals.example.com/api'],
    ['an IP address', 'https://203.0.113.5'],
    ['user info', 'https://user:pw@approvals.example.com'],
    ['a number', 7],
  ])('reads %s as null, and the next save writes null and keeps the other keys', (_n, baseUrl) => {
    writeWith({ approvals: { baseUrl } })
    const store = open()
    expect(store.get().approvals).toEqual({ baseUrl: null })
    expect(store.get().generation).toEqual({ optionsPerRun: 2 })
    expect(onDisk().approvals).toEqual({ baseUrl })
    save(store)
    const saved = onDisk()
    expect(saved.approvals).toEqual({ baseUrl: null })
    expect(saved.generation).toEqual({ optionsPerRun: 2 })
    expect(saved.recentProjects).toHaveLength(1)
  })

  it('holds a passing address as its origin and saves it in that form', () => {
    writeWith({ approvals: { baseUrl: '  HTTPS://Approvals.Example.com/ ' } })
    const store = open()
    expect(store.get().approvals).toEqual({ baseUrl: 'https://approvals.example.com' })
    save(store)
    expect(onDisk().approvals).toEqual({ baseUrl: 'https://approvals.example.com' })
  })

  it('adds nothing for __proto__ inside approvals', () => {
    writeRaw(
      `{"generation":{"optionsPerRun":2},"approvals":{"__proto__":{"baseUrl":"https://evil.example.com","extra":1}}}`,
    )
    const store = open()
    const approvals = store.get().approvals
    expect(approvals).toEqual({ baseUrl: null })
    expect(Object.getPrototypeOf(approvals)).toBe(Object.prototype)
    expect((approvals as Record<string, unknown>).extra).toBeUndefined()
    expect(({} as Record<string, unknown>).baseUrl).toBeUndefined()
    expect(store.get().generation).toEqual({ optionsPerRun: 2 })
  })

  it('keeps no copy of a refused address anywhere in the store', () => {
    writeWith({ approvals: { baseUrl: 'http://secret-host.example.com' } })
    const store = open()
    expect(JSON.stringify(store.get())).not.toContain('secret-host')
  })

  it('saves an origin through setApprovalsAddress, and null removes it', () => {
    const store = open()
    store.setApprovalsAddress('https://approvals.example.com')
    expect(store.get().approvals).toEqual({ baseUrl: 'https://approvals.example.com' })
    expect(onDisk().approvals).toEqual({ baseUrl: 'https://approvals.example.com' })
    store.setApprovalsAddress(null)
    expect(onDisk().approvals).toEqual({ baseUrl: null })
  })
})

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

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-settings-'))
  file = path.join(dir, 'settings.json')
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

describe('a ComfyUI address found in settings.json [SPEC 13.1 "After CU-1"]', () => {
  it('reads a failing address as null, and the next save writes null and keeps the other keys', () => {
    writeWith({ comfyui: { baseUrl: 'http://169.254.169.254' } })
    const store = open()
    expect(store.get().comfyui).toEqual({ baseUrl: null })
    expect(onDisk().comfyui).toEqual({ baseUrl: 'http://169.254.169.254' })
    store.touchRecent({ path: '/p/A.adman', name: 'A' }, '2026-11-20T00:00:00.000Z')
    const saved = onDisk()
    expect(saved.comfyui).toEqual({ baseUrl: null })
    expect(saved.generation).toEqual({ optionsPerRun: 2 })
    expect(saved.recentProjects).toHaveLength(1)
  })

  it('loads a passing address as its origin, and a save keeps it', () => {
    writeWith({ comfyui: { baseUrl: 'http://127.0.0.1:8188' } })
    const store = open()
    expect(store.get().comfyui).toEqual({ baseUrl: 'http://127.0.0.1:8188' })
    store.touchRecent({ path: '/p/A.adman', name: 'A' }, '2026-11-20T00:00:00.000Z')
    expect(onDisk().comfyui).toEqual({ baseUrl: 'http://127.0.0.1:8188' })
  })

  it('holds a passing address in its origin form and saves it in that form', () => {
    writeWith({ comfyui: { baseUrl: '  HTTP://My-PC.Local:8188/ ' } })
    const store = open()
    expect(store.get().comfyui).toEqual({ baseUrl: 'http://my-pc.local:8188' })
    store.touchRecent({ path: '/p/A.adman', name: 'A' }, '2026-11-20T00:00:00.000Z')
    expect(onDisk().comfyui).toEqual({ baseUrl: 'http://my-pc.local:8188' })
  })

  it("checks the address against the file's own MCP port", () => {
    const mcp = { enabled: false, port: 50000, autoApproveDestructive: false }
    writeWith({ mcp, comfyui: { baseUrl: 'http://127.0.0.1:50000' } })
    expect(open().get().comfyui).toEqual({ baseUrl: null })
    writeWith({ mcp, comfyui: { baseUrl: 'http://127.0.0.1:47821' } })
    expect(open().get().comfyui).toEqual({ baseUrl: 'http://127.0.0.1:47821' })
  })

  it('reads a baseUrl that is not text as null and keeps the other keys', () => {
    writeWith({ comfyui: { baseUrl: 8188 } })
    const s = open().get()
    expect(s.comfyui).toEqual({ baseUrl: null })
    expect(s.generation).toEqual({ optionsPerRun: 2 })
  })
})

describe('merge skips the key __proto__ [SPEC 13.1 "After CU-1" item 4]', () => {
  const protoKeys = () => Object.getOwnPropertyNames(Object.prototype).sort()

  it('loads comfyui.__proto__.baseUrl as no address', () => {
    const before = protoKeys()
    const text = JSON.stringify(defaults()).replace(
      '"comfyui":{"baseUrl":null}',
      '"comfyui":{"__proto__":{"baseUrl":"http://169.254.169.254"}}',
    )
    expect(text).toContain('__proto__')
    writeRaw(text)
    const s = open().get()
    expect(s.comfyui).toEqual({ baseUrl: null })
    expect(s.comfyui.baseUrl).toBeNull()
    expect(Object.getPrototypeOf(s.comfyui)).toBe(Object.prototype)
    expect(protoKeys()).toEqual(before)
  })

  it('loads agentRuns.__proto__ with no comfyui entry, own or inherited', () => {
    const before = protoKeys()
    const text = JSON.stringify(defaults()).replace(
      '"agentRuns":{}',
      '"agentRuns":{"__proto__":{"comfyui":{"allowed":true}}}',
    )
    expect(text).toContain('__proto__')
    writeRaw(text)
    const runs = open().get().agentRuns
    expect(runs).toEqual({})
    expect('comfyui' in runs).toBe(false)
    expect(runs['comfyui']).toBeUndefined()
    expect(Object.getPrototypeOf(runs)).toBe(Object.prototype)
    expect(protoKeys()).toEqual(before)
  })

  it('skips __proto__ one level further down, under a key the defaults do not have', () => {
    const text = JSON.stringify(defaults()).replace(
      '"agentRuns":{}',
      '"agentRuns":{"fal":{"__proto__":{"polluted":true},"allowed":false}}',
    )
    writeRaw(text)
    const runs = open().get().agentRuns
    expect(runs).toEqual({ fal: { allowed: false } })
    expect(Object.getPrototypeOf(runs['fal'])).toBe(Object.prototype)
  })
})

describe('setComfyAddress [SPEC 6.10.1: comfy.setAddress is the one writer]', () => {
  it('saves an origin and removes it with null', () => {
    const store = open()
    store.setComfyAddress('http://192.168.1.20:8188')
    expect(store.get().comfyui).toEqual({ baseUrl: 'http://192.168.1.20:8188' })
    expect(onDisk().comfyui).toEqual({ baseUrl: 'http://192.168.1.20:8188' })
    store.setComfyAddress(null)
    expect(onDisk().comfyui).toEqual({ baseUrl: null })
  })
})

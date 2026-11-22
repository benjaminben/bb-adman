import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { MAX_WORKFLOW_BYTES } from '@/shared/comfy/custom-workflow'
import { makeStoreFixture, checked, type StoreFixture } from './store-fixture'
import { storedFrom } from '../../unit/main/providers/comfyui/custom/stored'
import type { StoredCustomWorkflow } from '@/main/providers/comfyui/custom/stored'

let f: StoreFixture
afterEach(() => {
  vi.restoreAllMocks()
  f.cleanup()
})

const write = (name: string, text: string) => {
  fs.mkdirSync(f.dir, { recursive: true })
  fs.writeFileSync(path.join(f.dir, name), text)
}
const writeStored = (stored: StoredCustomWorkflow, name = `${stored.id}.json`) =>
  write(name, JSON.stringify(stored))

const skipLines = () => f.lines.filter((l) => l.level === 'warn')

describe('the custom workflow store: reading at start [D-104, CW-2]', () => {
  it('gives an empty list when there is no folder, and makes none', () => {
    f = makeStoreFixture()
    expect(f.open().list()).toEqual([])
    expect(fs.existsSync(f.dir)).toBe(false)
  })

  it('reads back a saved workflow the same', () => {
    f = makeStoreFixture()
    const first = f.open()
    const added = first.add({ checked: checked('picture'), name: 'Lighthouse', addedBy: 'user' })
    const again = f.open().list()
    expect(again.map((e) => e.stored)).toEqual([added.stored])
    expect(again[0]?.spec.id).toBe(added.stored.id)
    expect(again[0]?.checked.job).toBe('image')
  })

  it('writes compact JSON and leaves no temporary file', () => {
    f = makeStoreFixture()
    const added = f.open().add({ checked: checked('two-refs'), name: 'Two', addedBy: 'agent' })
    expect(fs.readdirSync(f.dir)).toEqual([`${added.stored.id}.json`])
    const text = fs.readFileSync(path.join(f.dir, `${added.stored.id}.json`), 'utf8')
    expect(text).toBe(JSON.stringify(added.stored))
  })

  it('skips a file that fails the checks, with one warn line holding only its ID', () => {
    f = makeStoreFixture()
    const bad = storedFrom('picture', {
      id: 'custom-aaaaaaaaaaaa',
      name: 'MARKER-name',
      graph: { MARKER: { class_type: 'MARKER', inputs: {} } },
    })
    writeStored(bad)
    expect(f.open().list()).toEqual([])
    expect(skipLines()).toHaveLength(1)
    const line = JSON.stringify(skipLines()[0])
    expect(line).toContain('custom-aaaaaaaaaaaa')
    expect(line).not.toContain('MARKER')
    expect(line).not.toContain(f.root)
    expect(skipLines()[0]?.message).toBe('A stored workflow was skipped.')
  })

  it('skips a file that is not JSON, and one whose ID differs from its file name', () => {
    f = makeStoreFixture()
    write('custom-bbbbbbbbbbbb.json', '{ not json')
    writeStored(storedFrom('two-refs', { id: 'custom-cccccccccccc' }), 'custom-dddddddddddd.json')
    expect(f.open().list()).toEqual([])
    expect(skipLines().map((l) => l.context?.workflowId)).toEqual(
      expect.arrayContaining(['custom-bbbbbbbbbbbb', 'custom-dddddddddddd']),
    )
    expect(skipLines()).toHaveLength(2)
  })

  it('ignores other files in the folder without a line', () => {
    f = makeStoreFixture()
    const good = storedFrom('two-refs', { id: 'custom-eeeeeeeeeeee' })
    for (const name of ['notes.json', 'custom-EEEEEEEEEEEE.json', 'custom-eeeeeeeeeeee.json.tmp']) {
      writeStored(good, name)
    }
    write('custom-0123.json', '{}')
    expect(f.open().list()).toEqual([])
    expect(f.lines).toEqual([])
  })

  it('skips a stored file over MAX_WORKFLOW_BYTES plus 4,096 bytes before parsing it', () => {
    f = makeStoreFixture()
    const stored = storedFrom('two-refs', { id: 'custom-ffffffffffff' })
    const text = JSON.stringify(stored)
    const limit = MAX_WORKFLOW_BYTES + 4_096
    write(`${stored.id}.json`, text + ' '.repeat(limit - text.length + 1))
    const parse = vi.spyOn(JSON, 'parse')
    expect(f.open().list()).toEqual([])
    expect(parse).not.toHaveBeenCalled()
    expect(skipLines()).toHaveLength(1)
  })

  it('reads a stored file of exactly that limit', () => {
    f = makeStoreFixture()
    const stored = storedFrom('two-refs', { id: 'custom-ffffffffffff' })
    const text = JSON.stringify(stored)
    write(`${stored.id}.json`, text + ' '.repeat(MAX_WORKFLOW_BYTES + 4_096 - text.length))
    expect(f.open().list().map((e) => e.stored.id)).toEqual([stored.id])
  })

  it('skips a link in place of a file', () => {
    f = makeStoreFixture()
    const stored = storedFrom('two-refs', { id: 'custom-111111111111' })
    const outside = path.join(f.root, 'outside.json')
    fs.writeFileSync(outside, JSON.stringify(stored))
    fs.mkdirSync(f.dir, { recursive: true })
    fs.symlinkSync(outside, path.join(f.dir, `${stored.id}.json`))
    expect(f.open().list()).toEqual([])
    expect(skipLines()).toHaveLength(1)
  })

  it('keeps the files in order of addedAt, and skips a later file with a taken name', () => {
    f = makeStoreFixture()
    const later = storedFrom('two-refs', {
      id: 'custom-222222222222',
      name: 'Beach',
      addedAt: '2026-11-22T12:00:00.000Z',
    })
    const earlier = storedFrom('two-refs', {
      id: 'custom-333333333333',
      name: 'Avenue',
      addedAt: '2026-11-21T12:00:00.000Z',
    })
    const twin = storedFrom('two-refs', {
      id: 'custom-444444444444',
      name: 'BEACH',
      addedAt: '2026-11-23T12:00:00.000Z',
    })
    for (const s of [later, earlier, twin]) writeStored(s)
    expect(f.open().list().map((e) => e.stored.id)).toEqual([earlier.id, later.id])
    expect(skipLines().map((l) => l.context?.workflowId)).toEqual([twin.id])
  })
})

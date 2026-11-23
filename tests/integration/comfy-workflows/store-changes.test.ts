import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import {
  CUSTOM_SIZE_DEFAULTS,
  CUSTOM_VIDEO_DEFAULT,
  CUSTOM_WORKFLOW_ID,
  MAX_CUSTOM_WORKFLOWS,
  sizeFromChoice,
} from '@/shared/comfy/custom-workflow'
import { AppError } from '@/shared/schemas/result'
import { makeStoreFixture, checked, type StoreFixture } from './store-fixture'

let f: StoreFixture
afterEach(() => f.cleanup())

const reasonOf = (run: () => unknown) => {
  try {
    run()
  } catch (e) {
    if (e instanceof AppError) return e.details?.reason ?? e.code
    throw e
  }
  return 'no refusal'
}

describe('the custom workflow store: adds, changes and removes [D-104, CW-2]', () => {
  it('adds with a new ID of the form, the time, the default size and video values', () => {
    f = makeStoreFixture()
    const store = f.open()
    const picture = store.add({ checked: checked('picture'), name: 'P', addedBy: 'user' })
    expect(picture.stored.id).toMatch(CUSTOM_WORKFLOW_ID)
    expect(picture.stored).toMatchObject({
      format: 1,
      addedBy: 'user',
      addedAt: '2026-11-22T10:00:00.000Z',
      size: CUSTOM_SIZE_DEFAULTS.image,
      video: null,
    })
    const refs = store.add({ checked: checked('two-refs'), name: 'R', addedBy: 'agent' })
    expect(refs.stored.size).toBeNull()
    const video = store.add({ checked: checked('video-prompt'), name: 'V', addedBy: 'user' })
    expect(video.stored).toMatchObject({ size: CUSTOM_SIZE_DEFAULTS.video })
    expect(video.stored.video).toEqual(CUSTOM_VIDEO_DEFAULT)
    expect(store.list().map((e) => e.stored.name)).toEqual(['P', 'R', 'V'])
  })

  it('takes given video values for a video graph', () => {
    f = makeStoreFixture()
    const video = { fps: 16, maxMs: 4_000, frameStep: 8, frameOffset: 1 }
    const added = f.open().add({ checked: checked('video-refs'), name: 'V', addedBy: 'agent', video })
    expect(added.stored.video).toEqual(video)
  })

  it('refuses a taken name in any letter case, and finds a free one with " 2", " 3"', () => {
    f = makeStoreFixture()
    const store = f.open()
    store.add({ checked: checked('two-refs'), name: 'Beach', addedBy: 'user' })
    const again = () => store.add({ checked: checked('two-refs'), name: 'BEACH', addedBy: 'user' })
    expect(reasonOf(again)).toBe('workflow_name_taken')
    expect(store.freeName('beach')).toBe('beach 2')
    store.add({ checked: checked('two-refs'), name: 'Beach 2', addedBy: 'user' })
    expect(store.freeName('Beach')).toBe('Beach 3')
    expect(store.freeName('Avenue')).toBe('Avenue')
  })

  it('cuts a long name so the number still fits in 60 characters', () => {
    f = makeStoreFixture()
    const store = f.open()
    const long = 'n'.repeat(60)
    store.add({ checked: checked('two-refs'), name: long, addedBy: 'user' })
    expect(store.freeName(long)).toBe(`${'n'.repeat(58)} 2`)
  })

  it(`refuses the add after ${MAX_CUSTOM_WORKFLOWS} with workflow_limit`, () => {
    f = makeStoreFixture()
    const store = f.open()
    for (let i = 0; i < MAX_CUSTOM_WORKFLOWS; i++) {
      store.add({ checked: checked('two-refs'), name: `W${i}`, addedBy: 'user' })
    }
    const extra = () => store.add({ checked: checked('two-refs'), name: 'X', addedBy: 'user' })
    expect(reasonOf(extra)).toBe('workflow_limit')
    expect(fs.readdirSync(f.dir)).toHaveLength(MAX_CUSTOM_WORKFLOWS)
  })

  it('changes the name, size and video values and writes them', () => {
    f = makeStoreFixture()
    const store = f.open()
    const id = store.add({ checked: checked('video-prompt'), name: 'V', addedBy: 'user' }).stored.id
    store.add({ checked: checked('two-refs'), name: 'Other', addedBy: 'user' })
    const size = sizeFromChoice(64, 2)
    const video = { fps: 30, maxMs: 10_000, frameStep: 1, frameOffset: 0 }
    store.update(id, { name: 'v', size, video })
    expect(f.open().get(id)?.stored).toMatchObject({ name: 'v', size, video })
    expect(store.get(id)?.spec).toMatchObject({ label: 'v', size, video })
    expect(reasonOf(() => store.update(id, { name: 'OTHER' }))).toBe('workflow_name_taken')
  })

  it('removes exactly one file', () => {
    f = makeStoreFixture()
    const store = f.open()
    const a = store.add({ checked: checked('two-refs'), name: 'A', addedBy: 'user' }).stored.id
    const b = store.add({ checked: checked('two-refs'), name: 'B', addedBy: 'user' }).stored.id
    fs.writeFileSync(path.join(f.dir, 'notes.txt'), 'kept')
    expect(store.remove(a)).toBe(true)
    expect(fs.readdirSync(f.dir).sort()).toEqual([`${b}.json`, 'notes.txt'])
    expect(store.list().map((e) => e.stored.id)).toEqual([b])
    expect(store.remove(a)).toBe(false)
  })

  it('looks up by own keys only', () => {
    f = makeStoreFixture()
    const store = f.open()
    for (const key of ['__proto__', 'constructor', 'toString']) {
      expect(store.get(key)).toBeUndefined()
      expect(store.remove(key)).toBe(false)
    }
  })

describe('the custom workflow store: names compared trimmed [D-104, CW-2]', () => {
  it('takes "Beach " and "beach" as the same name', () => {
    f = makeStoreFixture()
    const store = f.open()
    store.add({ checked: checked('two-refs'), name: 'beach', addedBy: 'user' })
    const twin = () => store.add({ checked: checked('two-refs'), name: 'Beach ', addedBy: 'user' })
    expect(reasonOf(twin)).toBe('workflow_name_taken')
    expect(store.freeName(' BEACH')).toBe(' BEACH 2')
  })
})
})

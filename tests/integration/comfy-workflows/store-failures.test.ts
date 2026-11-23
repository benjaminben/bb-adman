import fs from 'node:fs'
import { describe, it, expect, afterEach } from 'vitest'
import { makeStoreFixture, checked, type StoreFixture } from './store-fixture'
import { NON_DRAFT_WORKFLOWS, WORKFLOWS } from '@/main/providers/comfyui/workflows'
import { allWorkflows, checkedWorkflows } from '@/main/providers/comfyui/workflows/all'

let f: StoreFixture
afterEach(() => f.cleanup())

describe('the custom workflow store when the disk refuses [D-104, CW-2]', () => {
  it('throws a fixed error with no path, and keeps nothing it could not write', () => {
    f = makeStoreFixture()
    // A file where the folder should be, so nothing can be written.
    fs.writeFileSync(f.dir, 'not a folder')
    const store = f.open()
    let message = ''
    try {
      store.add({ checked: checked('picture'), name: 'Beach', addedBy: 'user' })
    } catch (e) {
      message = (e as Error).message
    }
    expect(message).toBe('Adman could not save the workflow.')
    expect(message).not.toContain(f.root)
    expect(store.list()).toEqual([])
  })
})

describe('allWorkflows and checkedWorkflows [D-104]', () => {
  it('give the shipped lists, then the custom ones in order of addedAt', () => {
    f = makeStoreFixture()
    const store = f.open()
    const a = store.add({ checked: checked('picture'), name: 'A', addedBy: 'user' })
    const b = store.add({ checked: checked('two-refs'), name: 'B', addedBy: 'user' })
    expect(allWorkflows(store)).toEqual([...WORKFLOWS, a.spec, b.spec])
    expect(checkedWorkflows(store)).toEqual([...NON_DRAFT_WORKFLOWS, a.spec, b.spec])
  })
})

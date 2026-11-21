import { describe, it, expect } from 'vitest'
import {
  handTestPath,
  listHandTest,
  removeHandTest,
  writeHandTest,
} from '@/main/commands/dev/hand-test-storage'
import { HAND_TEST_FOLDER } from '@/shared/config/dev-tools'
import type { StorageProvider } from '@/main/providers/types'
import { AppError } from '@/shared/schemas/result'

type Call = { op: string; arg: unknown }

// A stand-in that records every call. `listed` is what list() answers, whatever it is asked.
function recorder(listed: string[] = []) {
  const calls: Call[] = []
  const storage: StorageProvider = {
    exists: async (path) => (calls.push({ op: 'exists', arg: path }), false),
    read: async (path) => (calls.push({ op: 'read', arg: path }), new Uint8Array()),
    write: async (path) => void calls.push({ op: 'write', arg: path }),
    list: async (prefix) => (calls.push({ op: 'list', arg: prefix }), listed),
    remove: async (paths) => void calls.push({ op: 'remove', arg: paths }),
  }
  return { storage, calls }
}

function refusedCode(run: () => unknown): string | undefined {
  try {
    run()
  } catch (e) {
    return e instanceof AppError ? e.code : 'not an AppError'
  }
  return undefined
}

describe('the hand-test folder [SPEC 4.2 dev.storage, 12 [1.8]]', () => {
  it('is adman-hand-test', () => {
    expect(HAND_TEST_FOLDER).toBe('adman-hand-test')
  })
})

describe('handTestPath: the only path dev.storage writes [SPEC 4.2 dev.storage]', () => {
  it('puts a plain file name inside the hand-test folder', () => {
    expect(handTestPath('note.txt')).toBe('adman-hand-test/note.txt')
  })

  it.each([
    ['..'],
    ['.'],
    [''],
    ['a/b.txt'],
    ['../x.txt'],
    ['/etc'],
    ['a\\..\\b.txt'],
    ['CON.txt'],
    ['c:x'],
    ['trailing.'],
  ])('refuses the name %j with INVALID_INPUT', (name) => {
    expect(refusedCode(() => handTestPath(name))).toBe('INVALID_INPUT')
  })
})

describe('writeHandTest [SPEC 4.2 dev.storage write]', () => {
  it('writes only to the hand-test folder', async () => {
    const { storage, calls } = recorder()
    await writeHandTest(storage, 'note.txt', new Uint8Array([1, 2]))
    expect(calls).toEqual([{ op: 'write', arg: 'adman-hand-test/note.txt' }])
  })

  it('sends nothing for a refused name', async () => {
    const { storage, calls } = recorder()
    await expect(writeHandTest(storage, '..', new Uint8Array())).rejects.toBeInstanceOf(AppError)
    expect(calls).toEqual([])
  })
})

describe('listHandTest [SPEC 4.2 dev.storage list]', () => {
  it('lists only the hand-test folder and gives names inside it, sorted', async () => {
    const { storage, calls } = recorder(['adman-hand-test/b.txt', 'adman-hand-test/a.txt'])
    expect(await listHandTest(storage)).toEqual(['a.txt', 'b.txt'])
    expect(calls).toEqual([{ op: 'list', arg: 'adman-hand-test' }])
  })

  it('leaves out any path a provider answers that is outside the folder', async () => {
    const { storage } = recorder([
      'adman-hand-test/kept.txt',
      'other/x.txt',
      'adman-hand-testX/y.txt',
      'adman-hand-test',
      '../adman-hand-test/z.txt',
    ])
    expect(await listHandTest(storage)).toEqual(['kept.txt'])
  })
})

describe('removeHandTest [SPEC 4.2 dev.storage remove]', () => {
  it('removes every file in the folder and says how many', async () => {
    const { storage, calls } = recorder(['adman-hand-test/a.txt', 'adman-hand-test/sub/b.txt'])
    expect(await removeHandTest(storage)).toBe(2)
    expect(calls).toEqual([
      { op: 'list', arg: 'adman-hand-test' },
      { op: 'remove', arg: ['adman-hand-test/a.txt', 'adman-hand-test/sub/b.txt'] },
    ])
  })

  it('never names a path outside the folder, whatever list answers', async () => {
    const { storage, calls } = recorder([
      'adman-hand-test/a.txt',
      'other/x.txt',
      'adman-hand-testX/y.txt',
      'adman-hand-test/../secrets.bin',
    ])
    await removeHandTest(storage)
    expect(calls.at(-1)).toEqual({ op: 'remove', arg: ['adman-hand-test/a.txt'] })
  })

  it('sends no remove call when the folder is empty', async () => {
    const { storage, calls } = recorder([])
    expect(await removeHandTest(storage)).toBe(0)
    expect(calls).toEqual([{ op: 'list', arg: 'adman-hand-test' }])
  })
})

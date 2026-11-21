import { describe, it, expect } from 'vitest'
import { adapters } from '../../../../../src/main/providers/azure-blob'
import type { AdapterContext } from '../../../../../src/main/providers/types'
import type { Settings } from '../../../../../src/shared/schemas/settings'

const ctx: AdapterContext = {
  secret: () => {
    throw new Error('Azure Blob reads no secret')
  },
  settings: () => ({}) as Settings,
  model: () => 'none',
}

describe('Azure Blob storage stub [SPEC 6.5]', () => {
  it('builds a StorageProvider whose every call fails with "not available"', async () => {
    const storage = adapters.storage?.(ctx)
    if (!storage) throw new Error('azure-blob exports no storage adapter')
    const calls = [
      storage.exists('a.txt'),
      storage.read('a.txt'),
      storage.write('a.txt', new Uint8Array([1]), 'text/plain'),
      storage.list(''),
      storage.remove(['a.txt']),
    ]
    for (const call of calls)
      await expect(call).rejects.toThrow('Azure Blob storage is not available')
  })
})

import { describe, it, expect } from 'vitest'
import { adapters } from '@/main/providers/azure-blob'
import { ProviderFailure, type AdapterContext } from '@/main/providers/types'
import type { Settings } from '@/shared/schemas/settings'

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
      await expect(call).rejects.toThrow(
        expect.objectContaining({
          error: { kind: 'other', detail: 'Azure Blob storage is not available' },
        }),
      )
  })
})

describe('Azure Blob storage stub errors [SPEC 6.5 1.14, H2]', () => {
  it('rejects every call with a ProviderFailure of kind other', async () => {
    const storage = adapters.storage?.(ctx)
    if (!storage) throw new Error('azure-blob exports no storage adapter')
    const failure = await storage.list('').catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(ProviderFailure)
    expect((failure as ProviderFailure).error).toEqual({
      kind: 'other',
      detail: 'Azure Blob storage is not available',
    })
  })
})

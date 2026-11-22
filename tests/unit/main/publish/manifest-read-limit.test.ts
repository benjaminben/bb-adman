// Review leftovers, "Publish": the old manifest is read under MANIFEST_MAX_BYTES, and a storage
// that stops at that limit makes it count as none.
import { describe, expect, it, vi } from 'vitest'
import type { ActivityLog } from '@/main/log/activity-log'
import { MANIFEST_MAX_BYTES, readPrevious } from '@/main/publish/manifest'
import { tooLarge } from '@/main/providers/read-limited'
import type { StorageProvider } from '@/main/providers/types'

const CAMPAIGN = 'summer-sale-a1b2c3'

function storageReading(read: StorageProvider['read']): StorageProvider {
  return {
    exists: () => Promise.resolve(true),
    read,
    write: () => Promise.resolve(),
    list: () => Promise.resolve([]),
    remove: () => Promise.resolve(),
  }
}

describe('readPrevious under a byte limit', () => {
  it('asks the storage for at most MANIFEST_MAX_BYTES', async () => {
    const read = vi.fn<StorageProvider['read']>(() => Promise.resolve(new Uint8Array()))
    const log: ActivityLog = { write: vi.fn(), prune: vi.fn() }
    await readPrevious(storageReading(read), CAMPAIGN, { log })
    expect(read).toHaveBeenCalledWith(expect.any(String), MANIFEST_MAX_BYTES)
  })

  it('counts a manifest the storage finds too large as none, with a warn line', async () => {
    const write = vi.fn<ActivityLog['write']>()
    const storage = storageReading(() => Promise.reject(tooLarge()))
    expect(await readPrevious(storage, CAMPAIGN, { log: { write, prune: vi.fn() } })).toBeNull()
    expect(write.mock.calls[0]?.[0]).toMatchObject({ context: { reason: 'manifest_unreadable' } })
  })

  it('lets any other storage failure through', async () => {
    const storage = storageReading(() => Promise.reject(new Error('down')))
    const log: ActivityLog = { write: vi.fn(), prune: vi.fn() }
    await expect(readPrevious(storage, CAMPAIGN, { log })).rejects.toThrow('down')
  })
})

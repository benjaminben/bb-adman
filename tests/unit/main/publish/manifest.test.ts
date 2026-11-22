// P9-8: the old manifest is read with a schema; anything else counts as none (A-220).
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { localStorageAt } from '@/main/providers/local-storage'
import type { ActivityLog } from '@/main/log/activity-log'
import {
  campaignPrefix,
  MANIFEST_MAX_BYTES,
  nextPublishNumber,
  readPrevious,
  writeManifest,
} from '@/main/publish/manifest'
import type { Manifest } from '@/shared/publish/manifest'
import { recordedPaths, recordingStorage } from '../../../helpers/recording-storage'

const CAMPAIGN = 'summer-sale-a1b2c3'
const SHA = 'a'.repeat(64)

const good: Manifest = {
  format: 1,
  appVersion: '0.9.0',
  projectId: '01JD5Q6R7S8T9V0W1X2Y3Z4A5B',
  campaignId: CAMPAIGN,
  publishNumber: 4,
  publishedAt: '2026-11-20T10:00:00.000Z',
  files: [{ path: 'exports/a.png', bytes: 12, sha256: SHA }],
}

let root: string
let log: ActivityLog & { write: ReturnType<typeof vi.fn<ActivityLog['write']>> }

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'adman-manifest-'))
  log = { write: vi.fn<ActivityLog['write']>(), prune: vi.fn() }
})
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true })
})

async function plant(text: string | Uint8Array): Promise<void> {
  await fs.mkdir(path.join(root, CAMPAIGN), { recursive: true })
  await fs.writeFile(path.join(root, CAMPAIGN, 'manifest.json'), text)
}

describe('readPrevious [A-220]', () => {
  it('gives null with no manifest, and the next number is 1, with no log line', async () => {
    const previous = await readPrevious(localStorageAt(root), CAMPAIGN, { log })
    expect(previous).toBeNull()
    expect(nextPublishNumber(previous)).toBe(1)
    expect(log.write).not.toHaveBeenCalled()
  })

  it('gives a good manifest number, project and time; the next number is one more', async () => {
    await plant(JSON.stringify(good))
    const previous = await readPrevious(localStorageAt(root), CAMPAIGN, { log })
    expect(previous).toEqual({
      publishNumber: 4,
      projectId: good.projectId,
      publishedAt: good.publishedAt,
    })
    expect(nextPublishNumber(previous)).toBe(5)
  })

  it('reads only the campaign folder manifest', async () => {
    const storage = recordingStorage(localStorageAt(root))
    await plant(JSON.stringify(good))
    await readPrevious(storage, CAMPAIGN, { log })
    expect(recordedPaths(storage).every((p) => p === `${CAMPAIGN}/manifest.json`)).toBe(true)
  })

  const SECRET_WORD = 'planted-words-x'
  const bad: Array<[string, string | Uint8Array]> = [
    ['damaged JSON', `{"format":1,"note":"${SECRET_WORD}"`],
    ['wrong shape', JSON.stringify({ ...good, publishNumber: 0, note: SECRET_WORD })],
    ['wrong format', JSON.stringify({ ...good, format: 2, appVersion: SECRET_WORD })],
    [
      'a bad hash',
      JSON.stringify({ ...good, files: [{ path: SECRET_WORD, bytes: 1, sha256: 'x' }] }),
    ],
    ['an array', JSON.stringify([SECRET_WORD])],
    ['oversized', new Uint8Array(MANIFEST_MAX_BYTES + 1).fill(0x20)],
  ]

  it.each(bad)('gives null and a warn line with no content for %s', async (_name, body) => {
    await plant(body)
    const previous = await readPrevious(localStorageAt(root), CAMPAIGN, { log })
    expect(previous).toBeNull()
    expect(nextPublishNumber(previous)).toBe(1)
    expect(log.write).toHaveBeenCalledTimes(1)
    const entry = log.write.mock.calls[0]?.[0]
    expect(entry).toMatchObject({ level: 'warn', context: { reason: 'manifest_unreadable' } })
    const text = JSON.stringify(entry)
    expect(text).not.toContain(SECRET_WORD)
    expect(text).not.toContain(root)
  })

  it('lets a storage failure through', async () => {
    const storage = { ...localStorageAt(root), exists: () => Promise.reject(new Error('down')) }
    await expect(readPrevious(storage, CAMPAIGN, { log })).rejects.toThrow('down')
  })
})

describe('writeManifest', () => {
  it('writes manifest.json in the campaign folder, which reads back the same', async () => {
    const storage = recordingStorage(localStorageAt(root))
    await writeManifest(storage, CAMPAIGN, good)
    const text = await fs.readFile(path.join(root, CAMPAIGN, 'manifest.json'), 'utf8')
    expect(JSON.parse(text)).toEqual(good)
    expect(recordedPaths(storage)).toEqual([`${CAMPAIGN}/manifest.json`])
  })

  it('refuses a manifest of another campaign or of the wrong shape, writing nothing', async () => {
    const storage = recordingStorage(localStorageAt(root))
    await expect(
      writeManifest(storage, CAMPAIGN, { ...good, campaignId: 'other-c-a1b2c3' }),
    ).rejects.toThrow()
    await expect(writeManifest(storage, CAMPAIGN, { ...good, publishNumber: 0 })).rejects.toThrow()
    expect(storage.calls).toEqual([])
  })

  it('refuses a campaign ID that is not one folder name', async () => {
    const storage = recordingStorage(localStorageAt(root))
    for (const id of ['', 'a/b', '..', 'a.']) {
      await expect(writeManifest(storage, id, { ...good, campaignId: id })).rejects.toThrow(
        'Storage path refused',
      )
    }
    expect(storage.calls).toEqual([])
  })
})

describe('campaignPrefix [P9-10, A-221]', () => {
  it('gives {campaignId}/ for an ID of the campaign ID form', () => {
    expect(campaignPrefix(CAMPAIGN)).toBe(`${CAMPAIGN}/`)
    expect(campaignPrefix('campaign-x1y2z3')).toBe('campaign-x1y2z3/')
  })

  it.each([
    'C1',
    'Summer-sale-a1b2c3',
    'summer sale-a1b2c3',
    'summer-sale-a1b2c',
    `${'a'.repeat(41)}-a1b2c3`,
  ])('refuses %s, which is not of the campaign ID form', (id) => {
    expect(() => campaignPrefix(id)).toThrow('Storage path refused')
  })
})

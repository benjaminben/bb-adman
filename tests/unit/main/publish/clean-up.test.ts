// P9-8: clean-up deletes only what the new manifest lacks, only inside {campaignId}/ (A-219).
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { localStorageAt } from '@/main/providers/local-storage'
import { removeStale } from '@/main/publish/clean-up'
import { recordedPaths, recordingStorage } from '../../../helpers/recording-storage'

const CAMPAIGN = 'summer-sale-a1b2c3'

let root: string

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'adman-clean-up-'))
})
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true })
})

async function plant(rel: string, text = rel): Promise<void> {
  await fs.mkdir(path.dirname(path.join(root, rel)), { recursive: true })
  await fs.writeFile(path.join(root, rel), text)
}

async function present(rel: string): Promise<boolean> {
  return fs.stat(path.join(root, rel)).then(
    () => true,
    () => false,
  )
}

const inside = [
  `${CAMPAIGN}/Exports/A.png`,
  `${CAMPAIGN}/exports/old/b.png`,
  `${CAMPAIGN}/components/logos/gone.png`,
  `${CAMPAIGN}/report.html`,
  `${CAMPAIGN}/manifest.json`,
]
const outside = [
  `${CAMPAIGN}x/exports/a.png`,
  `${CAMPAIGN}x/manifest.json`,
  'other-campaign-zzzzzz/report.html',
  'root-file.txt',
  `${CAMPAIGN}.txt`,
]

describe('removeStale [A-219]', () => {
  it('deletes only what the manifest lacks, case folded, and keeps manifest.json', async () => {
    for (const rel of [...inside, ...outside]) await plant(rel)
    const storage = recordingStorage(localStorageAt(root))

    const removed = await removeStale(storage, CAMPAIGN, ['exports/a.png', 'report.html'])

    expect(removed).toBe(2)
    expect(await present(`${CAMPAIGN}/Exports/A.png`)).toBe(true)
    expect(await present(`${CAMPAIGN}/report.html`)).toBe(true)
    expect(await present(`${CAMPAIGN}/manifest.json`)).toBe(true)
    expect(await present(`${CAMPAIGN}/exports/old/b.png`)).toBe(false)
    expect(await present(`${CAMPAIGN}/components/logos/gone.png`)).toBe(false)
    for (const rel of outside) {
      expect(await fs.readFile(path.join(root, rel), 'utf8')).toBe(rel)
    }
    const paths = recordedPaths(storage)
    expect(paths.length).toBeGreaterThan(0)
    expect(paths.every((p) => p.startsWith(`${CAMPAIGN}/`))).toBe(true)
  })

  it('keeps a manifest.json in any letter case', async () => {
    await plant(`${CAMPAIGN}/Manifest.JSON`)
    expect(await removeStale(localStorageAt(root), CAMPAIGN, [])).toBe(0)
    expect(await present(`${CAMPAIGN}/Manifest.JSON`)).toBe(true)
  })

  it('removes nothing and calls no remove when nothing is stale', async () => {
    await plant(`${CAMPAIGN}/report.html`)
    const storage = recordingStorage(localStorageAt(root))
    expect(await removeStale(storage, CAMPAIGN, ['report.html'])).toBe(0)
    expect(storage.calls.map((c) => c.op)).toEqual(['list'])
  })

  it('never removes a listed path outside the campaign folder, even if the storage gives one', async () => {
    const removedPaths: string[][] = []
    const storage = {
      ...localStorageAt(root),
      list: async () => [`${CAMPAIGN}/stale.png`, `${CAMPAIGN}x/a.png`, 'root.txt', 'a/../b'],
      remove: async (paths: string[]) => {
        removedPaths.push(paths)
      },
    }
    expect(await removeStale(storage, CAMPAIGN, [])).toBe(1)
    expect(removedPaths).toEqual([[`${CAMPAIGN}/stale.png`]])
  })

  it('refuses a campaign ID that is not one folder name, before anything is listed', async () => {
    const storage = recordingStorage(localStorageAt(root))
    for (const id of ['', 'a/b', '..', 'x/../y']) {
      await expect(removeStale(storage, id, [])).rejects.toThrow('Storage path refused')
    }
    expect(storage.calls).toEqual([])
  })
})

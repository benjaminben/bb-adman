// P9-11, review fix 2 (spec/phases/phase-09.md "Components"): a picture or video component is
// uploaded only from the file that was checked. The check records the checked handle's inode,
// device, size and modified time; an upload whose open finds anything else is refused
// (publish_file_refused) and nothing of it is written. Local storage on a temporary folder.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { localStorageAt } from '@/main/providers/local-storage'
import type { StorageProvider } from '@/main/providers/types'
import { BYTES, CAMPAIGN } from './component-project'
import { IMG, jobSetUp, type JobSetUp } from './publish-job-setup'

let s: JobSetUp | undefined
let root: string | undefined
afterEach(() => {
  s?.cleanup()
  s = undefined
  if (root) fs.rmSync(root, { recursive: true, force: true })
})

const OTHER_PICTURE = Buffer.concat([BYTES.png, Buffer.from('another picture entirely')])

// Local storage that runs `swap` once, just before the image component is written.
function swapBeforeImage(swap: () => void): StorageProvider {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-swap-'))
  const inner = localStorageAt(root)
  let swapped = false
  return {
    ...inner,
    async write(p, body, type) {
      if (p.includes('/components/images/') && !swapped) {
        swapped = true
        swap()
      }
      return inner.write(p, body, type)
    },
  }
}

const swaps: Array<[string, (file: string) => void]> = [
  ['rewritten in place', (file) => fs.writeFileSync(file, OTHER_PICTURE)],
  [
    'replaced by another file',
    (file) => {
      fs.writeFileSync(`${file}.new`, OTHER_PICTURE)
      fs.renameSync(`${file}.new`, file)
    },
  ],
]

describe('a component changed after its check [P9-11 review fix 2]', () => {
  it.each(swaps)('is refused when %s, and none of it is uploaded', async (_name, swap) => {
    let file = ''
    s = await jobSetUp({ storage: swapBeforeImage(() => swap(file)) })
    file = s.assetFiles[IMG] as string
    const job = await s.publish()
    expect(job.status).toBe('failed')
    expect(s.hidden(job.id).error_detail).toBe('publish_file_refused')
    const images = path.join(root as string, CAMPAIGN, 'components', 'images')
    expect(fs.existsSync(images) ? fs.readdirSync(images) : []).toEqual([])
  })
})

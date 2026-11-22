// P9-10 (spec/phases/phase-09.md "Publishing"; "Published layout"; A-219, A-220, A-227, A-260;
// security class full): the publish job through the real runner, with the fake export port and
// local storage on a temporary folder. Nothing reaches a bucket or Dropbox.
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { localStorageAt } from '@/main/providers/local-storage'
import { ProviderFailure, type StorageProvider } from '@/main/providers/types'
import { createPublishDeps } from '@/main/publish/deps'
import { reasonMessage } from '@/shared/providers/messages'
import { ADS, PNG } from '../../helpers/fake-publish-export'
import { CAMPAIGN } from './component-project'
import { BG, CLIP, FONT, jobSetUp, type JobSetUp } from './publish-job-setup'

const SECRET = '403 X-Amz-Signature=made-up-signature-0001 /Users/someone/private'

let s: JobSetUp | undefined
afterEach(() => {
  s?.cleanup()
  s = undefined
})

async function setUp() {
  s = await jobSetUp()
  return s
}

const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
const manifestOf = (x: JobSetUp) =>
  JSON.parse(fs.readFileSync(path.join(x.storageRoot, CAMPAIGN, 'manifest.json'), 'utf8'))
const consent = (x: JobSetUp, assetId: string) =>
  x.fx.user('publish.setFontConsent', { projectId: x.projectId, assetId, allowed: true })

// Local storage whose write fails for each path `fails` picks, with a detail no row may hold.
function failingWrites(
  root: string,
  fails: (path: string, n: number) => boolean,
  reason?: 'dropbox_signed_out',
) {
  const inner = localStorageAt(root)
  let writes = 0
  const storage: StorageProvider = {
    ...inner,
    async write(p, body, type) {
      if (fails(p, ++writes)) {
        throw new ProviderFailure({ kind: 'bad_key', detail: SECRET, ...(reason && { reason }) })
      }
      return inner.write(p, body, type)
    },
  }
  return storage
}

const EXPECTED_FILES = [
  ...ADS.map((ad) => `exports/${ad.relPath}`),
  'report.html',
  'report.json',
  'translations.csv',
  'components/backgrounds/Beach-00000001.png',
  'components/images/Bottle-00000003.png',
]

describe('the publish job, layout and manifest [P9-10]', () => {
  it('publishes the published layout, with the header, sizes and hashes in the manifest', async () => {
    const x = await setUp()
    const job = await x.publish()
    expect(job).toMatchObject({ status: 'succeeded', paidCalls: 0, progress: 1 })
    expect(job.result).toEqual({
      publishNumber: 1,
      uploaded: EXPECTED_FILES.length,
      removed: 0,
      skipped: expect.arrayContaining([
        { assetId: CLIP, problem: 'wrong_type' },
        { assetId: FONT, problem: 'not_shared' },
      ]),
    })
    expect(Object.keys(x.storageFiles()).sort()).toEqual(
      [...EXPECTED_FILES, 'manifest.json'].map((f) => `${CAMPAIGN}/${f}`).sort(),
    )
    expect(x.fake.inputs[0]?.publishHeader).toEqual({
      publishNumber: 1,
      publishedAt: expect.any(String),
    })
    const manifest = manifestOf(x)
    expect(manifest).toMatchObject({ format: 1, projectId: x.projectId, campaignId: CAMPAIGN })
    expect(manifest.publishNumber).toBe(1)
    for (const entry of manifest.files) {
      const bytes = fs.readFileSync(path.join(x.storageRoot, CAMPAIGN, entry.path))
      expect(entry).toEqual({ path: entry.path, bytes: bytes.length, sha256: sha(bytes) })
    }
    expect(manifest.files.map((f: { path: string }) => f.path).sort()).toEqual(
      [...EXPECTED_FILES].sort(),
    )
    const ad = `${CAMPAIGN}/exports/${ADS[0]?.relPath}`
    expect(x.storageFiles()[ad]).toBe(PNG.toString('base64'))
    expect(x.workChildren()).toEqual([])
  })

  it('gives the next number to the header of the next publish and uploads a consented font', async () => {
    const x = await setUp()
    await x.publish()
    expect((await consent(x, FONT)).ok).toBe(true)
    const job = await x.publish()
    expect(job.status).toBe('succeeded')
    expect(x.fake.inputs[1]?.publishHeader?.publishNumber).toBe(2)
    expect(manifestOf(x).publishNumber).toBe(2)
    const font = path.join(x.storageRoot, CAMPAIGN, 'components/fonts/Open Sans-00000002.ttf')
    expect(fs.readFileSync(font).equals(fs.readFileSync(x.assetFiles[FONT] as string))).toBe(true)
  })
})

describe('the publish job, fonts (A-260) [P9-10]', () => {
  it('does not upload a font the project flags with no local consent', async () => {
    const x = await setUp()
    await x.publish()
    expect(Object.keys(x.storageFiles()).some((f) => f.includes('components/fonts'))).toBe(false)
  })

  it('does not upload a font consented and then changed', async () => {
    const x = await setUp()
    expect((await consent(x, FONT)).ok).toBe(true)
    fs.appendFileSync(x.assetFiles[FONT] as string, Buffer.from([7]))
    const job = await x.publish()
    expect(job.result).toMatchObject({
      skipped: expect.arrayContaining([{ assetId: FONT, problem: 'not_shared' }]),
    })
    expect(Object.keys(x.storageFiles()).some((f) => f.includes('components/fonts'))).toBe(false)
  })
})

describe('the publish job, failures keep the old publish [P9-10]', () => {
  it('leaves the old manifest and removes nothing after an upload failure, with no error text in the row', async () => {
    const x = await setUp()
    await x.publish()
    const old = fs.readFileSync(path.join(x.storageRoot, CAMPAIGN, 'manifest.json'))
    x.plant(`${CAMPAIGN}/stale-from-before.png`, PNG)
    // dropbox_signed_out is not tried again, so the test waits for no retry.
    x.fx.core.deps.publish.storageFor = () =>
      failingWrites(x.storageRoot, (_p, n) => n >= 2, 'dropbox_signed_out')
    const job = await x.publish()
    expect(job).toMatchObject({ status: 'failed', errorKind: 'bad_key' })
    expect(x.hidden(job.id)).toEqual({
      error_detail: 'publish_upload_failed',
      error_reason: 'dropbox_signed_out',
    })
    expect(fs.readFileSync(path.join(x.storageRoot, CAMPAIGN, 'manifest.json'))).toEqual(old)
    expect(fs.existsSync(path.join(x.storageRoot, CAMPAIGN, 'stale-from-before.png'))).toBe(true)
    const rowText = JSON.stringify([job, x.hidden(job.id), x.fx.events, x.fx.readLogs()])
    expect(rowText).not.toContain('Signature')
    expect(rowText).not.toContain('/Users/someone')
    expect(x.workChildren()).toEqual([])
  })

  it('drops any other storage reason and detail, and cleans up nothing when the manifest fails', async () => {
    const x = await setUp()
    x.plant(`${CAMPAIGN}/stale-from-before.png`, PNG)
    x.fx.core.deps.publish.storageFor = () =>
      failingWrites(x.storageRoot, (p) => p.endsWith('manifest.json'))
    const job = await x.publish()
    expect(job).toMatchObject({ status: 'failed', errorKind: 'bad_key', errorReason: null })
    expect(x.hidden(job.id)).toEqual({
      error_detail: 'publish_manifest_failed',
      error_reason: null,
    })
    expect(fs.existsSync(path.join(x.storageRoot, CAMPAIGN, 'manifest.json'))).toBe(false)
    expect(fs.existsSync(path.join(x.storageRoot, CAMPAIGN, 'stale-from-before.png'))).toBe(true)
    expect(JSON.stringify([job, x.fx.events, x.fx.readLogs()])).not.toContain('Signature')
  })

  it('leaves the old manifest after a cancel before the manifest', async () => {
    const x = await setUp()
    await x.publish()
    const old = fs.readFileSync(path.join(x.storageRoot, CAMPAIGN, 'manifest.json'))
    x.fake.after = async () => {
      const running = x.jobs().find((j) => j.status === 'running')
      await x.fx.core.deps.jobs.cancel(x.projectId, running?.id as string)
    }
    const job = await x.publish()
    expect(job.status).toBe('cancelled')
    expect(fs.readFileSync(path.join(x.storageRoot, CAMPAIGN, 'manifest.json'))).toEqual(old)
    expect(x.workChildren()).toEqual([])
  })

  it('ends work_folder_unsafe when publish-work is a link, and exports nothing', async () => {
    const x = await setUp()
    const elsewhere = path.join(x.fx.root, 'elsewhere')
    fs.mkdirSync(elsewhere)
    fs.symlinkSync(elsewhere, path.join(x.fx.userData, 'publish-work'))
    const job = await x.publish()
    expect(job).toMatchObject({ status: 'failed', errorReason: 'work_folder_unsafe' })
    expect(reasonMessage('work_folder_unsafe')).toContain('Nothing was published.')
    expect(x.fake.inputs).toEqual([])
    expect(fs.readdirSync(elsewhere)).toEqual([])
    expect(x.storageFiles()).toEqual({})
  })

  it('ends export_not_built with the stub port, and export_failed with no text when export throws', async () => {
    const x = await setUp()
    x.fx.core.deps.publish.exportForPublish = createPublishDeps().exportForPublish
    expect(await x.publish()).toMatchObject({ status: 'failed', errorReason: 'export_not_built' })
    x.fx.core.deps.publish.exportForPublish = x.fake.port
    x.fake.fail = new Error(`could not write ${SECRET}`)
    const job = await x.publish()
    expect(job).toMatchObject({ status: 'failed', errorReason: 'export_failed' })
    expect(x.hidden(job.id).error_detail).toBe('export_failed')
    expect(x.storageFiles()).toEqual({})
    expect(x.workChildren()).toEqual([])
  })
})

describe('the publish job, paths and files refused [P9-10]', () => {
  it('ends publish_paths_clash before any upload when two paths differ only in letter case', async () => {
    const x = await setUp()
    x.fake.change = (files) => [
      ...files,
      { ...(files[0] as (typeof files)[number]), relPath: 'summer/1080x1080/en-vaaaaa.png' },
    ]
    const job = await x.publish()
    expect(job).toMatchObject({ status: 'failed', errorReason: 'publish_paths_clash' })
    expect(reasonMessage('publish_paths_clash')).toBe(
      'Two files would have the same name in the published folder. Nothing was published.',
    )
    expect(x.storageFiles()).toEqual({})
  })

  it('refuses a remote path ending .partial before any upload', async () => {
    const x = await setUp()
    x.fake.change = (files) =>
      files.map((f, i) => (i === 1 ? { ...f, relPath: 'Summer/a.png.partial' } : f))
    const job = await x.publish()
    expect(job.status).toBe('failed')
    expect(x.hidden(job.id).error_detail).toBe('publish_path_refused')
    expect(x.storageFiles()).toEqual({})
  })

  it('refuses an exported file that leads out of the work folder, uploading nothing', async () => {
    const x = await setUp()
    const outside = path.join(x.fx.root, 'outside.png')
    fs.writeFileSync(outside, PNG)
    x.fake.change = (files, root) => {
      const link = path.join(root, 'link.png')
      fs.symlinkSync(outside, link)
      return files.map((f, i) => (i === 0 ? { ...f, absPath: link } : f))
    }
    const job = await x.publish()
    expect(job.status).toBe('failed')
    expect(x.hidden(job.id).error_detail).toBe('publish_file_refused')
    expect(x.storageFiles()).toEqual({})
  })

  it('skips a hard-linked component file and uploads the rest', async () => {
    const x = await setUp()
    fs.linkSync(x.assetFiles[BG] as string, path.join(x.fx.root, 'second-name.png'))
    const job = await x.publish()
    expect(job.status).toBe('succeeded')
    expect(job.result).toMatchObject({
      skipped: expect.arrayContaining([{ assetId: BG, problem: 'wrong_type' }]),
    })
    const files = Object.keys(x.storageFiles())
    expect(files).toContain(`${CAMPAIGN}/components/images/Bottle-00000003.png`)
    expect(files.some((f) => f.includes('Beach'))).toBe(false)
  })
})

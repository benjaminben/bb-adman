// P4-5 (spec/ai-jobs.md "A plain sentence per failure cause", OI-68; security class): a
// picture job queued, then broken before its turn, ends failed, kind other, with its own
// reason. error_detail is the reason name. No path, code or message of the error reaches the
// row or any line of the test's log (closes H4 O-3 in review-leftovers.md).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { greyPng } from '@/main/providers/fake/png'
import { AppError } from '@/shared/schemas/result'
import type { ProviderErrorReason } from '@/shared/schemas/queries/app'
import { waitFor } from '../generation/generation-fixture'
import { REFUSAL, makeLocalFailureFixture, type LocalFailureFixture } from './local-failure-fixture'

let f: LocalFailureFixture
const extra: string[] = []
afterEach(() => {
  const assets = f.assetsDir()
  if (fs.existsSync(assets)) fs.chmodSync(assets, 0o755)
  f.cleanup()
  for (const d of extra.splice(0)) fs.rmSync(d, { recursive: true, force: true })
})

const ended = (id: string) => () =>
  ['succeeded', 'failed', 'cancelled'].includes(f.job(id)?.status ?? '')

// The reference picture: a linked file beside the project file.
async function reference(): Promise<{ file: string; id: string }> {
  const file = path.join(f.root, 'ref.png')
  fs.writeFileSync(file, greyPng(5, 4))
  const r = await f.user('asset.import', { paths: [file], library: 'reference', copy: false })
  if (!r.ok) throw new Error('import failed')
  return { file, id: (r.data as { assetIds: string[] }).assetIds[0] as string }
}

// Points the assets folder at a folder outside the project's folder, which is never made again.
function assetsOutside(): string {
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-outside-'))
  extra.push(outside)
  const set = f.project.db.prepare(
    'INSERT INTO project_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  )
  set.run('assets_dir_rel', path.relative(f.root, outside))
  set.run('assets_dir_abs', outside)
  return outside
}

type Case = {
  name: string
  reason: ProviderErrorReason | null
  detail: string
  // Prepares before the job is queued; returns what breaks it, and the words that must not leave.
  arrange: (ref: { file: string; id: string }) => { brk: () => void; secret: string[] }
}

const CASES: Case[] = [
  {
    name: 'the key removed',
    reason: 'key_missing',
    detail: 'key_missing',
    arrange: () => ({
      brk: () => f.keys.delete('gemini.apiKey'),
      secret: ['NEEDS_KEY', 'Add your Keyed Test key', 'k-123'],
    }),
  },
  {
    name: 'the reference file deleted',
    reason: 'picture_missing',
    detail: 'picture_missing',
    arrange: (ref) => ({
      brk: () => fs.rmSync(ref.file),
      secret: [ref.file, 'MISSING_FILE', 'cannot be found'],
    }),
  },
  {
    name: 'the reference replaced by a file over 32 MiB',
    reason: 'picture_too_large',
    detail: 'picture_too_large',
    arrange: (ref) => ({
      brk: () => fs.truncateSync(ref.file, 32 * 1024 * 1024 + 1),
      secret: [ref.file, 'RULE_VIOLATION', 'asset_too_large', 'too large to send'],
    }),
  },
  {
    name: 'the reference replaced by a text file',
    reason: 'picture_changed',
    detail: 'picture_changed',
    arrange: (ref) => ({
      brk: () => fs.writeFileSync(ref.file, 'Just some words, not a picture.'),
      secret: [ref.file, 'RULE_VIOLATION', 'asset_not_a_picture', 'not a picture the app'],
    }),
  },
  {
    name: 'the assets folder removed',
    reason: 'assets_folder_missing',
    detail: 'assets_folder_missing',
    arrange: () => {
      const outside = assetsOutside()
      return {
        brk: () => fs.rmSync(outside, { recursive: true }),
        secret: [outside, 'RULE_VIOLATION', 'Choose the assets folder again.'],
      }
    },
  },
  {
    name: 'the assets folder made read-only',
    reason: 'assets_not_writable',
    detail: 'assets_not_writable',
    arrange: () => {
      const assets = f.assetsDir()
      fs.mkdirSync(assets, { recursive: true })
      return { brk: () => fs.chmodSync(assets, 0o555), secret: [assets, 'permission denied'] }
    },
  },
  {
    name: 'asset.addGenerated refused through a stand-in bus',
    reason: 'results_not_added',
    detail: 'results_not_added',
    arrange: () => ({
      brk: () => (f.t.refuseAdd = true),
      secret: [REFUSAL.message, REFUSAL.code, REFUSAL.details.reason, 'secret-folder'],
    }),
  },
  {
    name: 'another AppError met in the job',
    reason: null,
    detail: 'app_error',
    arrange: () => {
      const odd = new AppError('INVALID_INPUT', 'Odd thing at /Users/someone/odd.png', {
        reason: 'odd_reason',
      })
      return {
        brk: () => (f.t.readError = odd),
        secret: ['INVALID_INPUT', 'odd_reason', '/Users/someone/odd.png', 'Odd thing'],
      }
    },
  },
]

describe('a picture job that fails for a local cause [OI-68, FR-069] (security class)', () => {
  it.each(CASES)(
    '$name: failed, kind other, its own reason, nothing from the error leaves',
    async (c) => {
      f = makeLocalFailureFixture()
      const ref = await reference()
      const { brk, secret } = c.arrange(ref)
      const { id, holders } = await f.queued({ referenceAssetIds: [ref.id] })
      expect(f.job(id)?.status).toBe('queued')
      brk()
      f.release()
      for (const h of [...holders, id]) await waitFor(ended(h))

      expect(f.job(id)).toMatchObject({
        status: 'failed',
        errorKind: 'other',
        errorReason: c.reason,
      })
      expect(f.errorDetail(id)).toBe(c.detail)
      const row = JSON.stringify(f.job(id))
      const lines = f.logLines()
      expect(lines.some((l) => l.includes(id))).toBe(true)
      for (const word of [...secret, f.root]) {
        expect(row).not.toContain(word)
        for (const line of lines) expect(line).not.toContain(word)
      }
    },
  )

  it('a write error gives its own code in one warn line per job, with no path', async () => {
    f = makeLocalFailureFixture()
    const assets = f.assetsDir()
    fs.mkdirSync(assets, { recursive: true })
    const { id, holders } = await f.queued()
    fs.chmodSync(assets, 0o555)
    f.release()
    for (const h of [...holders, id]) await waitFor(ended(h))
    const coded = f
      .logLines()
      .map((l) => JSON.parse(l) as Record<string, unknown>)
      .filter((e) => JSON.stringify(e).includes('EACCES'))
    for (const jobId of [...holders, id]) {
      const own = coded.filter((e) => e.jobId === jobId)
      expect(own).toHaveLength(1)
      expect(own[0]).toMatchObject({ level: 'warn', event: 'job', context: { code: 'EACCES' } })
    }
    expect(coded).toHaveLength(holders.length + 1)
  })
})

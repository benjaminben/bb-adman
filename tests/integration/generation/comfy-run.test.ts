// CU-4 end to end: generation.runImages with provider comfyui against the stand-in, through
// the real core, job runner and asset store. The adapter polls on its real 2 s clock.
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { makeComfyFixture, type ComfyFixture } from './comfy-fixture'
import { waitFor } from './generation-fixture'
import { startComfyStandIn, type StandIn } from '../../helpers/comfy-stand-in'
import { finishRun, historyEntry, serveNeeds, servePicture } from '../../helpers/comfy-run'
import { data } from '../core-fixture'
import { generationDetailsOf } from '../../fixtures/png-chunks'
import { assetsDirOf } from '../../../src/main/assets/service'
import { promptToSend } from '../../../src/shared/generation/prompt'
import { greyPng } from '../../../src/main/providers/fake/png'
import { mossTextToImage as moss } from '../../../src/main/providers/comfyui/workflows/moss'
import { flux3KleinEditReferences as flux } from '../../../src/main/providers/comfyui/workflows/flux3'
import type { ImageJobResult } from '../../../src/shared/schemas/jobs/image-generation'

let f: ComfyFixture
let stand: StandIn
afterEach(async () => {
  f.cleanup()
  await stand.close()
})

const RUN_MS = 15_000

const ended = (fixture: ComfyFixture, id: string) => () =>
  ['succeeded', 'failed', 'cancelled'].includes(fixture.job(id)?.status ?? '')

async function ready(): Promise<void> {
  stand = await startComfyStandIn()
  serveNeeds(stand)
  servePicture(stand)
  f = await makeComfyFixture({ devTools: true, origin: stand.origin })
}

// Answers the run's history with a finished entry once the run was submitted.
async function finishWhenSubmitted(outputNode: string): Promise<void> {
  await waitFor(() => stand.seen.some((r) => r.path === '/prompt'), RUN_MS)
  const sent = stand.seen.find((r) => r.path === '/prompt')?.body.toString('utf8') ?? '{}'
  finishRun(stand, (JSON.parse(sent) as { prompt_id: string }).prompt_id, historyEntry(outputNode))
}

async function finishedJob(input: Record<string, unknown>, outputNode: string) {
  const { jobId } = data<{ jobId: string }>(await f.run(input))
  await finishWhenSubmitted(outputNode)
  await waitFor(ended(f, jobId), RUN_MS)
  return f.job(jobId)
}

// Every byte of the project file and its journal files.
function projectBytes(): string {
  const file = f.projectFile()
  return ['', '-wal', '-shm', '-journal']
    .map((end) => `${file}${end}`)
    .filter((p) => fs.existsSync(p))
    .map((p) => fs.readFileSync(p).toString('latin1'))
    .join('')
}

describe('generation.runImages with comfyui against the stand-in [SPEC 14 CU-4]', () => {
  it('stores a PNG with the details of Section 6.6, paid_calls 0, and both IDs [1.45 A-4]', async () => {
    await ready()
    const job = await finishedJob({}, moss.slots.outputNode)
    expect(job).toMatchObject({
      status: 'succeeded',
      provider: 'comfyui',
      campaignId: 'c1',
      variantId: 'v1',
      paidCalls: 0,
      startedBy: 'user',
    })
    const [assetId] = (job?.result as ImageJobResult).assetIds
    const stored = fs.readFileSync(path.join(assetsDirOf(f.project), `${assetId}.png`))
    expect(generationDetailsOf(stored)).toMatchObject({
      app: 'Adman',
      provider: 'comfyui',
      model: moss.model.mainFile,
      prompt: promptToSend('A bottle on a rock'),
      kind: 'image_generation',
    })
    // [1.53] G-1: every model file the shipped workflow names, and its id and version.
    const details = generationDetailsOf(stored)
    expect(details.models).toEqual(moss.needs.models.map((m) => m.file))
    expect(details.workflow).toEqual({ id: moss.id, version: moss.version })
    expect(Object.keys(details)).toEqual([
      'app',
      'appVersion',
      'provider',
      'model',
      'prompt',
      'kind',
      'createdAt',
      'models',
      'workflow',
    ])
    // [1.46 B] The real picture's size (RESULT_PNG is 4 by 4), not the variant's 1080 by 1350.
    expect(f.asset(assetId ?? '')).toMatchObject({ width: 4, height: 4 })
  }, 20_000)

  it('holds the address in no row of the project file (the whole file is searched)', async () => {
    await ready()
    await finishedJob({}, moss.slots.outputNode)
    const text = projectBytes()
    expect(text).not.toContain(stand.origin)
    expect(text).not.toContain('127.0.0.1')
  }, 20_000)

  it('a reference run sends only the picture bytes: no display name, path or asset ID in any request (security class) [1.46]', async () => {
    await ready()
    const bytes = greyPng(9, 3)
    const assetId = await f.importPicture('MARKERFOLDERQ7', 'MARKERNAMEZ3.png', bytes)
    expect(f.asset(assetId)?.displayName).toContain('MARKERNAMEZ3')
    const job = await finishedJob({ referenceAssetIds: [assetId] }, flux.slots.outputNode)
    expect(job?.status).toBe('succeeded')
    const uploads = stand.seen.filter((r) => r.path === '/upload/image')
    expect(uploads).toHaveLength(1)
    expect(uploads[0]?.body.includes(Buffer.from(bytes))).toBe(true)
    for (const r of stand.seen) {
      const seen = `${r.path}\n${r.body.toString('latin1')}`
      for (const marker of ['MARKERNAMEZ3', 'MARKERFOLDERQ7', f.root, assetId]) {
        expect(seen).not.toContain(marker)
      }
    }
  }, 20_000)

  it('a refused graph fails with server_refused and keeps the words for job.getServerMessage only', async () => {
    await ready()
    stand.reply('POST /prompt', {
      status: 400,
      json: { error: { message: 'Prompt has no outputs' }, node_errors: {} },
    })
    const { jobId } = data<{ jobId: string }>(await f.run({}))
    await waitFor(ended(f, jobId), RUN_MS)
    const job = f.job(jobId)
    expect(job).toMatchObject({
      status: 'failed',
      errorKind: 'other',
      errorReason: 'server_refused',
    })
    expect(JSON.stringify(job)).not.toContain('Prompt has no outputs')
    const input = { projectId: f.projectId, jobId }
    const reply = await f.core.query('job.getServerMessage', input, { actor: 'user' })
    expect(reply).toEqual({ ok: true, data: { text: 'Prompt has no outputs' } })
  }, 20_000)
})

// P6-16 (spec/phases/phase-06.md, section 7, "Sync review"; spec/data-rules.md, "Sync"): a
// `sync` translation job per language, read by sync.preview through latestSyncTranslation and
// written by sync.apply on accept as `proposed`, source `ai`. Only the newest sync job of the
// direction and language counts, only when it succeeded against the master's copy counter now
// and the layer's own copy counter has not moved since the job was queued.
import { describe, it, expect, afterEach } from 'vitest'
import { denialMessage } from '@/main/commands/agent-policy'
import { setFakeBehaviour } from '@/main/providers/fake/behaviour'
import type { TranslationJobRequest } from '@/shared/schemas/jobs/translation'
import type { SyncChange, SyncPreviewReply } from '@/shared/schemas/queries/sync'
import type { TranslationForCampaign } from '@/shared/schemas/queries/translation'
import { data } from '../core-fixture'
import { makeProposeFixture, waitFor, type ProposeFixture } from './propose-fixture'

let f: ProposeFixture
afterEach(() => f.cleanup())

const NEW_TEXT = 'Fresh from the peaks'

// The fixture, with the master's first text changed, so every linked text of it is stale.
async function ready(text = NEW_TEXT) {
  f = await makeProposeFixture()
  await editMaster(text)
}

async function editMaster(text: string) {
  const key = f.textKeys[0] ?? ''
  data(await f.user('layer.update', { layerId: f.masterLayerId(key), patch: { copy: text } }))
}

async function startSync(language = 'de', directionId = f.directionId): Promise<string> {
  const input = { provider: 'fake', mode: 'sync', directionId, language }
  const [jobId = ''] = data<{ jobIds: string[] }>(await f.user('translation.propose', input)).jobIds
  await waitFor(() => f.ended(jobId))
  return jobId
}

async function preview(): Promise<SyncPreviewReply> {
  const input = { projectId: f.projectId, directionId: f.directionId }
  return data<SyncPreviewReply>(await f.core.query('sync.preview', input, { actor: 'user' }))
}

async function change(variantId = 'D1'): Promise<SyncChange | undefined> {
  const key = f.textKeys[0]
  const reply = await preview()
  return reply.variants
    .find((v) => v.variantId === variantId)
    ?.changes.find((c) => c.layerKey === key)
}

async function apply(accept: boolean, variantId = 'D1') {
  const { masterRev } = await preview()
  const decisions = [{ variantId, layerKey: f.textKeys[0] ?? '', accept, overrides: [] }]
  return f.user('sync.apply', { directionId: f.directionId, masterRev, decisions })
}

const headline = (variantId = 'D1') => f.layer(f.id(variantId, f.textKeys[0] ?? ''))
const masterCopyRev = () => f.layer(f.masterLayerId(f.textKeys[0] ?? '')).revs.copy

describe('translation in the sync review [P6-16]', () => {
  it("shows the fake's text when the newest job matches the master's copy counter", async () => {
    await ready()
    await startSync()
    expect((await change())?.proposedTranslation).toEqual({
      text: `[de] ${NEW_TEXT}`,
      status: 'proposed',
    })
  })

  it('does not use a job made before the master changed again', async () => {
    await ready()
    await startSync()
    await editMaster('Cold and clear')
    const before = headline().copy
    expect((await change())?.proposedTranslation).toEqual({ text: before, status: 'failed' })
  })

  it("does not use another direction's job, nor another language's", async () => {
    await ready()
    await startSync('de', 'dir-2')
    await startSync('fr')
    expect((await change())?.proposedTranslation?.status).toBe('failed')
    expect((await change('F1'))?.proposedTranslation?.status).toBe('proposed')
  })

  it('gives failed for a failed job; accepting keeps the text and marks it missing', async () => {
    await ready()
    setFakeBehaviour({ fail: 'other' })
    const jobId = await startSync()
    expect(f.job(jobId)?.status).toBe('failed')
    const before = headline()
    expect((await change())?.proposedTranslation).toEqual({ text: before.copy, status: 'failed' })
    data(await apply(true))
    expect(headline()).toMatchObject({
      copy: before.copy,
      translationStatus: 'missing',
      translationSource: null,
    })
  })

  it('writes an accepted text as proposed, source ai, with synced_revs.copy set', async () => {
    await ready()
    await startSync()
    const before = headline()
    expect(data(await apply(true))).toEqual({ variantIds: ['D1'] })
    const after = headline()
    expect(after).toMatchObject({
      copy: `[de] ${NEW_TEXT}`,
      translationStatus: 'proposed',
      translationSource: 'ai',
    })
    expect(after.revs.copy).toBe(before.revs.copy + 1)
    expect(after.syncedRevs.copy).toBe(masterCopyRev())
    expect(headline('D2').copy).toBe(before.copy)
  })

  it('writes nothing for a refused change', async () => {
    await ready()
    await startSync()
    const before = headline()
    expect(data(await apply(false))).toEqual({ variantIds: [] })
    expect(headline()).toEqual(before)
  })

  it('never replaces a text typed over after the job was queued', async () => {
    await ready()
    await startSync()
    data(await f.user('layer.update', { layerId: headline().id, patch: { copy: 'Mein Text' } }))
    expect((await change())?.proposedTranslation).toEqual({ text: 'Mein Text', status: 'failed' })
    data(await apply(true))
    expect(headline().copy).toBe('Mein Text')
  })

  it("writes nothing itself, and records each layer's copy counter in its request", async () => {
    await ready()
    const before = ['D1', 'D2', 'F1'].map((v) => headline(v))
    const jobId = await startSync()
    expect(f.job(jobId)?.result).toMatchObject({ written: 0 })
    expect(['D1', 'D2', 'F1'].map((v) => headline(v))).toEqual(before)
    const request = f.job(jobId)?.request as TranslationJobRequest
    expect(request.mode).toBe('sync')
    const headlines = request.targets.filter((t) => t.key === f.textKeys[0])
    expect(headlines).toEqual(
      ['D1', 'D2'].map((v) => ({
        layerId: headline(v).id,
        key: f.textKeys[0],
        copyRev: headline(v).revs.copy,
      })),
    )
  })

  it("is not translation.forCampaign's newest job for its language", async () => {
    await ready()
    const write = await f.user('translation.propose', { provider: 'fake', variantIds: ['D1'] })
    const [writeJob = ''] = data<{ jobIds: string[] }>(write).jobIds
    await waitFor(() => f.ended(writeJob))
    await startSync()
    const input = { projectId: f.projectId, campaignId: f.campaignId }
    const read = data<TranslationForCampaign>(
      await f.core.query('translation.forCampaign', input, { actor: 'user' }),
    )
    const de = read.jobs.filter((j) => j.directionId === f.directionId && j.language === 'de')
    expect(de.map((j) => j.jobId)).toEqual([writeJob])
  })

  it('cannot be started by the agent, and no answer text reaches a log line', async () => {
    await ready()
    const input = { provider: 'fake', mode: 'sync', directionId: f.directionId, language: 'de' }
    expect(await f.agent('translation.propose', input)).toEqual({
      ok: false,
      error: { code: 'AGENT_DENIED', message: denialMessage('translation.propose') },
    })
    expect(f.jobs()).toEqual([])
    await startSync()
    data(await apply(true))
    expect(f.readLogs()).not.toContain('[de]')
    expect(f.readLogs()).not.toContain(NEW_TEXT)
  })
})

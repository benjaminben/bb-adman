// P6-6 (spec/phases/phase-06.md, design addition 2, "The job" and "translation.write"; A-155,
// A-168): the translation job with the fake provider, through the real core. One translate
// call; the cleaned answer written as `proposed`, source `ai`; a late answer never overwrites
// newer text; a cancel writes nothing; the call counted for a paid provider only.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { setFakeBehaviour } from '@/main/providers/fake/behaviour'
import type { TextProvider } from '@/main/providers/types'
import type { TranslationJobResult } from '@/shared/schemas/jobs/translation'
import { data } from '../core-fixture'
import { makeProposeFixture, waitFor, type ProposeFixture } from './propose-fixture'

type TranslateInput = Parameters<TextProvider['translate']>[0]
const ctl = vi.hoisted(() => ({
  calls: [] as unknown[],
  answer: null as null | ((input: { items: Array<{ key: string; text: string }> }) => unknown),
}))
vi.mock('@/main/providers/fake/text', async (original) => {
  const real = await original<typeof import('@/main/providers/fake/text')>()
  const fakeText = (): TextProvider => {
    const made = real.fakeText()
    return {
      ...made,
      translate: async (input, opts) => {
        ctl.calls.push(input)
        const answer = await made.translate(input, opts)
        return (ctl.answer ? ctl.answer(input) : answer) as Awaited<typeof answer>
      },
    }
  }
  return { ...real, fakeText }
})

let f: ProposeFixture
afterEach(() => {
  ctl.calls = []
  ctl.answer = null
  f.cleanup()
})

const D1 = () => f.textKeys.map((key) => f.id('D1', key))

async function start(variantIds = ['D1']): Promise<string> {
  const r = await f.user('translation.propose', { provider: 'fake', variantIds })
  const [jobId = ''] = data<{ jobIds: string[] }>(r).jobIds
  return jobId
}

async function run(variantIds?: string[]): Promise<string> {
  const jobId = await start(variantIds)
  await waitFor(() => f.ended(jobId))
  return jobId
}

const texts = (ids: string[]) =>
  ids.map((id) => {
    const l = f.layer(id)
    return { copy: l.copy, status: l.translationStatus, source: l.translationSource }
  })
const masterCopy = (key: string) => f.layer(f.masterLayerId(key)).copy

describe('the translation job [P6-6]', () => {
  it('writes the fake answer as proposed, source ai, and counts no paid call', async () => {
    f = await makeProposeFixture()
    const rev = f.db.prepare("SELECT rev FROM variant WHERE id = 'D1'").get() as { rev: number }
    const jobId = await run()
    expect(f.job(jobId)).toMatchObject({ status: 'succeeded', paidCalls: 0 })
    expect(texts(D1())).toEqual(
      f.textKeys.map((key) => ({
        copy: `[de] ${masterCopy(key)}`,
        status: 'proposed',
        source: 'ai',
      })),
    )
    for (const id of D1()) {
      const l = f.layer(id)
      expect(l.syncedRevs.copy).toBe(f.layer(f.masterLayerId(l.key)).revs.copy)
    }
    const result = f.job(jobId)?.result as TranslationJobResult
    expect(result.written).toBe(D1().length)
    expect(f.db.prepare("SELECT rev FROM variant WHERE id = 'D1'").get()).toEqual({
      rev: rev.rev + 1,
    })
    expect(texts(f.textKeys.map((key) => f.id('D2', key)))[0]?.status).toBe('missing')
  })

  it('sends only the texts, the languages, the region and the audience', async () => {
    f = await makeProposeFixture()
    await run()
    expect(ctl.calls).toEqual([
      {
        items: f.textKeys.map((key) => ({ key, text: masterCopy(key) ?? '' })),
        from: 'en',
        to: 'de',
        region: 'US',
        audience: 'Families',
      } satisfies TranslateInput,
    ])
  })

  it('counts the call for a paid provider in campaign.paidCount', async () => {
    f = await makeProposeFixture()
    f.paidFake()
    const jobId = await run()
    expect(f.job(jobId)).toMatchObject({ status: 'succeeded', paidCalls: 1 })
    const count = await f.core.query(
      'campaign.paidCount',
      { projectId: f.projectId, campaignId: f.campaignId },
      { actor: 'user' },
    )
    expect(count).toEqual({ ok: true, data: { pictures: 0, videos: 0, text: 1 } })
  })

  it('writes only the keys a partial answer gives [A-168]', async () => {
    f = await makeProposeFixture()
    const [firstKey = '', ...otherKeys] = f.textKeys
    ctl.answer = () => [
      { key: firstKey, text: '  Hallo  ' },
      { key: 'not-asked', text: 'x' },
      { key: firstKey, text: 'again' },
    ]
    const jobId = await run()
    expect(f.job(jobId)?.status).toBe('succeeded')
    expect(texts([f.id('D1', firstKey)])).toEqual([
      { copy: 'Hallo', status: 'proposed', source: 'ai' },
    ])
    for (const key of otherKeys) expect(f.layer(f.id('D1', key)).translationStatus).toBe('missing')
  })

  it.each([
    ['empty', () => []],
    ['blank texts only', () => f.textKeys.map((key) => ({ key, text: '  ' }))],
    [
      'texts over 5000 code points',
      () => f.textKeys.map((key) => ({ key, text: 'é'.repeat(5001) })),
    ],
  ])(
    'fails an answer that is %s with "No usable translation in the answer"',
    async (_n, answer) => {
      f = await makeProposeFixture()
      ctl.answer = answer
      const before = texts(D1())
      const jobId = await run()
      expect(f.job(jobId)).toMatchObject({ status: 'failed', errorKind: 'other' })
      expect(f.errorDetail(jobId)).toBe('No usable translation in the answer')
      expect(texts(D1())).toEqual(before)
    },
  )

  it('a translation that arrives after the user typed over the layer does not overwrite it', async () => {
    f = await makeProposeFixture()
    setFakeBehaviour({ waitMs: 300 })
    const [typed = '', other = ''] = D1()
    const jobId = await start()
    await waitFor(() => f.job(jobId)?.status === 'running')
    const set = { layerId: typed, text: 'Selbst getippt', applyToSameLanguage: false }
    data(await f.user('translation.set', set))
    await waitFor(() => f.ended(jobId))
    expect(f.job(jobId)?.status).toBe('succeeded')
    expect(texts([typed])).toEqual([{ copy: 'Selbst getippt', status: 'proposed', source: 'user' }])
    expect(texts([other])[0]).toMatchObject({ status: 'proposed', source: 'ai' })
    expect((f.job(jobId)?.result as TranslationJobResult).written).toBe(D1().length - 1)
  })

  it('leaves a layer approved while the job ran [A-155]', async () => {
    f = await makeProposeFixture()
    setFakeBehaviour({ waitMs: 300 })
    const [approved = ''] = D1()
    const jobId = await start()
    await waitFor(() => f.job(jobId)?.status === 'running')
    f.setRow(approved, { translation_status: 'approved', translation_source: 'user' })
    await waitFor(() => f.ended(jobId))
    expect(texts([approved])[0]).toMatchObject({ status: 'approved', source: 'user' })
  })

  it('writes nothing when stopped through job.cancel', async () => {
    f = await makeProposeFixture()
    setFakeBehaviour({ waitMs: 2_000 })
    const before = texts(D1())
    const jobId = await start()
    await waitFor(() => f.job(jobId)?.status === 'running')
    data(await f.user('job.cancel', { projectId: f.projectId, jobId }))
    await waitFor(() => f.ended(jobId))
    expect(f.job(jobId)?.status).toBe('cancelled')
    expect(texts(D1())).toEqual(before)
  })

  it('puts no answer or source text in a log line', async () => {
    f = await makeProposeFixture()
    await run()
    const logs = f.readLogs()
    expect(logs).not.toContain('[de]')
    for (const key of f.textKeys) expect(logs).not.toContain(masterCopy(key) ?? '')
  })
})

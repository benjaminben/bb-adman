// P4-8 (security class): brief.extract and the brief_extraction job (spec/ai-jobs.md "Brief
// reading"; FR-022, FR-023, FR-171), through the real bus and runner with a stand-in text
// adapter. brief.extract reads a path the caller names, so it keeps brief.parse's path rules,
// agents are denied it, and no word of the brief reaches a log line.
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { waitFor } from '../generation/generation-fixture'
import {
  makeTextFixture,
  KEYED,
  NOT_AVAILABLE,
  PICTURES_ONLY,
  TEXT,
  type TextFixture,
} from '../generation/text-fixture'
import { denialMessage } from '@/main/commands/agent-policy'

let f: TextFixture
afterEach(() => f.cleanup())

const MARK = 'Zephyrine-7731'
const BRIEF_TEXT = `# ${MARK} launch\n\nCampaign name: ${MARK}\nRegion: Germany\n`

const ABSOLUTE = { code: 'INVALID_INPUT', message: 'The file path must be absolute.' }
const NOT_TEXT = {
  code: 'RULE_VIOLATION',
  message: 'Choose a Markdown or plain-text brief to read with AI.',
  details: { reason: 'brief_type_not_supported' },
}
const NO_TEXT = { code: 'INVALID_INPUT', message: 'That provider cannot read briefs.' }
const NEEDS_KEY = { code: 'NEEDS_KEY', message: 'Add your Keyed key to read a brief with AI.' }
const MISSING = { code: 'NOT_FOUND', message: 'That file was not found.' }
const UNREADABLE = {
  code: 'RULE_VIOLATION',
  message: 'That file could not be read.',
  details: { reason: 'file_not_readable' },
}
const EMPTY = { code: 'INVALID_INPUT', message: 'The brief file is empty.' }

function write(name: string, text = BRIEF_TEXT): string {
  const file = path.join(f.root, name)
  fs.writeFileSync(file, text)
  return file
}

function extract(filePath: string, provider = TEXT.id) {
  return f.user('brief.extract', { filePath, provider })
}

async function finished(draft: unknown, text = BRIEF_TEXT) {
  f.t.draft = draft
  const r = await extract(write('brief.md', text))
  if (!r.ok) throw new Error(`brief.extract failed: ${JSON.stringify(r.error)}`)
  const { jobId } = r.data as { jobId: string }
  await waitFor(() => f.ended(jobId))
  return f.job(jobId)
}

type Case = [string, (root: string) => string, string, Record<string, unknown>]

describe('brief.extract refusals [FR-022, FR-171]', () => {
  const cases: Case[] = [
    ['a relative path', () => 'brief.md', TEXT.id, ABSOLUTE],
    ['a relative path before its ending', () => 'brief.pdf', 'nope', ABSOLUTE],
    ['a JSON brief', () => write('brief.json'), TEXT.id, NOT_TEXT],
    ['a YAML brief', () => write('brief.YML'), TEXT.id, NOT_TEXT],
    ['a file with no ending', () => write('brief'), TEXT.id, NOT_TEXT],
    ['a wrong ending before the provider', () => write('brief.pdf'), 'nope', NOT_TEXT],
    ['an unknown provider', () => write('brief.md'), 'nope', NO_TEXT],
    ['a provider without text', () => write('brief.md'), PICTURES_ONLY.id, NO_TEXT],
    ['a provider not available', () => write('brief.md'), NOT_AVAILABLE.id, NO_TEXT],
    ['the provider before the file', (root) => path.join(root, 'gone.md'), 'nope', NO_TEXT],
    ['a missing key', () => write('brief.md'), KEYED.id, NEEDS_KEY],
    ['the key before the file', (root) => path.join(root, 'gone.md'), KEYED.id, NEEDS_KEY],
    ['a missing file', (root) => path.join(root, 'gone.txt'), TEXT.id, MISSING],
    [
      'an unreadable file',
      () => {
        const file = write('locked.md')
        fs.chmodSync(file, 0o000)
        return file
      },
      TEXT.id,
      UNREADABLE,
    ],
    [
      'a folder',
      (root) => {
        fs.mkdirSync(path.join(root, 'folder.md'))
        return path.join(root, 'folder.md')
      },
      TEXT.id,
      UNREADABLE,
    ],
    ['an empty file', () => write('empty.md', ''), TEXT.id, EMPTY],
    ['a file of spaces and lines only', () => write('blank.txt', ' \n\t\r\n '), TEXT.id, EMPTY],
  ]

  it.each(cases)(
    'refuses %s, with no job row and no call',
    async (_case, file, provider, error) => {
      f = makeTextFixture()
      const r = await extract(file(f.root), provider)
      expect(r).toEqual({ ok: false, error: expect.objectContaining(error) })
      expect(f.jobs()).toEqual([])
      expect(f.t.briefCalls).toEqual([])
    },
  )

  it('is denied to the agent, with no job row and no read', async () => {
    f = makeTextFixture()
    const r = await f.agent('brief.extract', { filePath: write('brief.md'), provider: TEXT.id })
    expect(r).toEqual({
      ok: false,
      error: { code: 'AGENT_DENIED', message: denialMessage('brief.extract') },
    })
    expect(f.jobs()).toEqual([])
    expect(f.t.briefCalls).toEqual([])
  })
})

describe('the brief_extraction job [FR-022, FR-023]', () => {
  it('sends the whole text and keeps the draft with its primary language', async () => {
    f = makeTextFixture()
    const draft = { campaignName: MARK, region: 'Germany', subjects: [{ name: 'Bottle' }] }
    const job = await finished(draft)
    expect(job).toMatchObject({
      kind: 'brief_extraction',
      status: 'succeeded',
      campaignId: null,
      variantId: null,
      layerId: null,
      slot: null,
      provider: TEXT.id,
      model: 'text-model-1',
      startedBy: 'user',
      paidCalls: 1,
      request: { text: BRIEF_TEXT },
      result: { draft, primaryLanguage: 'de' },
    })
    expect(f.t.briefCalls).toEqual([{ text: BRIEF_TEXT }])
    expect(f.t.adapterFor).toEqual([TEXT.id])
  })

  it.each(['brief.markdown', 'BRIEF.TXT', 'brief.Md'])('reads %s', async (name) => {
    f = makeTextFixture()
    f.t.draft = { campaignName: 'A' }
    const r = await extract(write(name))
    expect(r.ok).toBe(true)
  })

  it('drops unknown and wrong-typed fields from the answer', async () => {
    f = makeTextFixture()
    const answer = { campaignName: 'A', region: 42, languages: 'fr', sizes: ['1:1'], other: 'x' }
    const job = await finished(answer)
    expect(job?.result).toEqual({
      draft: { campaignName: 'A', sizes: ['1:1'] },
      primaryLanguage: null,
    })
  })

  it('removes pictures from every subject, so the stored result has no path [D-098, SP-1]', async () => {
    f = makeTextFixture()
    const answer = {
      campaignName: 'A',
      subjects: [
        { name: 'Can', pictures: ['/Users/someone/private.png'] },
        { name: 'Jar', pictures: 'jar.png' },
        { pictures: 'only.png' },
      ],
    }
    const job = await finished(answer)
    expect(job?.result).toEqual({
      draft: { campaignName: 'A', subjects: [{ name: 'Can' }, { name: 'Jar' }, {}] },
      primaryLanguage: null,
    })
    expect(JSON.stringify(job)).not.toContain('.png')
  })

  it('takes the first listed language before the region', async () => {
    f = makeTextFixture()
    const job = await finished({ region: 'Germany', languages: ['fr', 'de'] })
    expect(job?.result).toMatchObject({ primaryLanguage: 'fr' })
  })

  it.each([
    ['an empty object', {}],
    ['only wrong-typed fields', { campaignName: 5, subjects: 'x' }],
    ['a list', [{ campaignName: 'A' }]],
    ['a string', 'Campaign name: A'],
    ['null', null],
  ])('fails as other when the answer is %s', async (_case, answer) => {
    f = makeTextFixture()
    const job = await finished(answer)
    expect(job).toMatchObject({ status: 'failed', errorKind: 'other', paidCalls: 1 })
    expect(f.errorDetail(job?.id ?? '')).toBe('No brief fields in the answer')
  })

  it('writes no word of the brief to any log line', async () => {
    f = makeTextFixture()
    await finished({ campaignName: MARK, message: MARK })
    await finished({ other: MARK })
    await extract(write('brief.json'))
    await extract(path.join(f.root, `${MARK}.md`))
    await f.agent('brief.extract', { filePath: write('brief.md'), provider: TEXT.id })
    const log = f.logText()
    expect(log.split('\n').filter(Boolean).length).toBeGreaterThanOrEqual(5)
    expect(log).not.toContain(MARK)
    expect(log).not.toContain('Zephyrine')
  })
})

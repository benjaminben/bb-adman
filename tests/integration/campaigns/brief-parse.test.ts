import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { briefCommands } from '@/main/commands/brief'
import { makeAssetBus, expectRefused } from '../assets/asset-bus'
import { testDeps } from './campaign-deps'

let bus: ReturnType<typeof makeAssetBus>
let dir: string
beforeEach(() => {
  bus = makeAssetBus(briefCommands(testDeps()))
  dir = fs.mkdtempSync(path.join(path.dirname(bus.project.filePath), 'briefs-'))
})
afterEach(() => bus.cleanup())

const JSON_BRIEF = JSON.stringify({
  campaignName: 'Summer',
  region: 'Germany',
  audience: 'All',
  message: 'Hello',
  subjects: [{ id: 'can', name: 'Can' }],
  extra: 'dropped',
})
const YAML_BRIEF = [
  'campaignName: Summer',
  'region: Germany',
  'audience: All',
  'message: Hello',
  'subjects:',
  '  - id: can',
  '    name: Can',
].join('\n')
const DRAFT = {
  campaignName: 'Summer',
  region: 'Germany',
  audience: 'All',
  message: 'Hello',
  subjects: [{ id: 'can', name: 'Can' }],
}
// One entry per draft subject; DRAFT's one subject names no pictures [D-098].
const NO_PICTURES = [{ paths: [], assetIds: [], notes: [] }]

function write(name: string, text: string): string {
  const file = path.join(dir, name)
  fs.writeFileSync(file, text)
  return file
}

const parse = (input: Record<string, unknown>) => bus.user('brief.parse', input)

describe('brief.parse from a file [SPEC 4.2, 6.1, FR-020]', () => {
  it.each([
    ['b.json', JSON_BRIEF],
    ['b.yaml', YAML_BRIEF],
    ['b.yml', YAML_BRIEF],
  ])('reads %s into a draft and the region language, writing nothing', async (name, text) => {
    const filePath = write(name, text)
    const result = await bus.changed(() => parse({ filePath }))
    expect(result).toEqual({
      ok: true,
      data: { draft: DRAFT, primaryLanguage: 'de', subjectPictures: NO_PICTURES },
    })
  })

  it('takes the primary language from the first listed language first', async () => {
    const filePath = write('b.json', JSON.stringify({ region: 'Germany', languages: ['fr', 'de'] }))
    expect(await parse({ filePath })).toMatchObject({ data: { primaryLanguage: 'fr' } })
  })

  it('gives null as the primary language when nothing names one', async () => {
    const filePath = write('b.json', JSON.stringify({ region: 'Atlantis' }))
    expect(await parse({ filePath })).toEqual({
      ok: true,
      data: { draft: { region: 'Atlantis' }, primaryLanguage: null, subjectPictures: [] },
    })
  })

  it('reads a .json file as JSON only, with no second try as YAML', async () => {
    const filePath = write('b.json', YAML_BRIEF)
    const error = await expectRefused(bus, () => parse({ filePath }), 'INVALID_INPUT')
    expect(error).toEqual({
      code: 'INVALID_INPUT',
      message: 'The brief is malformed. It could not be read as JSON or YAML.',
      details: { reason: 'brief_unreadable' },
    })
  })

  it('names the first bad line of a malformed YAML file and logs no word of it', async () => {
    const filePath = write('b.yaml', 'campaignName: Summer\nregion: [secretword\n')
    const error = await expectRefused(bus, () => parse({ filePath }), 'INVALID_INPUT')
    expect(error.details).toMatchObject({ reason: 'brief_unreadable' })
    expect(typeof error.details?.line).toBe('number')
    expect(error.message).toContain(`line ${String(error.details?.line)}`)
    expect(bus.logText()).not.toContain('secretword')
    expect(bus.logText()).not.toContain(dir)
  })

  it("gives the bad line's text in the reply and only its number in the log [SPEC 14 1.42 C-R6, C4-5]", async () => {
    // No newline at the end, so the bad line is the one that holds the open bracket.
    const filePath = write('b.yaml', 'campaignName: Summer\nregion: [secretword')
    const error = await expectRefused(bus, () => parse({ filePath }), 'INVALID_INPUT')
    expect(error.message).toBe(
      'The brief is malformed. The first line that could not be read is line 2: region: [secretword',
    )
    const log = bus.logText()
    expect(log).toContain(`line ${String(error.details?.line)}`)
    expect(log).not.toContain('secretword')
    expect(log).not.toContain('Summer')
    expect(log).not.toContain('region')
  })

  it.each(['b.md', 'b.txt', 'B.TXT'])(
    'refuses %s with brief_type_not_supported until Phase 4',
    async (name) => {
      const filePath = write(name, 'A brief')
      await expectRefused(
        bus,
        () => parse({ filePath }),
        'RULE_VIOLATION',
        'brief_type_not_supported',
      )
    },
  )

  it('refuses another file ending with brief_type_not_supported', async () => {
    const filePath = write('b.csv', JSON_BRIEF)
    await expectRefused(
      bus,
      () => parse({ filePath }),
      'RULE_VIOLATION',
      'brief_type_not_supported',
    )
  })

  it('answers NOT_FOUND for a file that is not there, with no path in the reply', async () => {
    const filePath = path.join(dir, 'gone.json')
    const error = await expectRefused(bus, () => parse({ filePath }), 'NOT_FOUND')
    expect(JSON.stringify(error)).not.toContain(dir)
  })

  it('answers file_not_readable for a folder, with no path in the reply', async () => {
    const filePath = path.join(dir, 'folder.json')
    fs.mkdirSync(filePath)
    const error = await expectRefused(
      bus,
      () => parse({ filePath }),
      'RULE_VIOLATION',
      'file_not_readable',
    )
    expect(JSON.stringify(error)).not.toContain(dir)
  })

  it('reads a large file whole: a brief has no size limit [SPEC 14 1.39 Z7]', async () => {
    const big = JSON.stringify({ campaignName: 'Summer', tone: 'x'.repeat(200_000) })
    const filePath = write('big.json', big)
    expect(await parse({ filePath })).toMatchObject({ ok: true })
  })
})

describe('brief.parse from text [SPEC 6.1 item 6]', () => {
  it('reads JSON text', async () => {
    expect(await parse({ text: JSON_BRIEF })).toEqual({
      ok: true,
      data: { draft: DRAFT, primaryLanguage: 'de', subjectPictures: NO_PICTURES },
    })
  })

  it('reads YAML text after the JSON try fails', async () => {
    expect(await parse({ text: YAML_BRIEF })).toEqual({
      ok: true,
      data: { draft: DRAFT, primaryLanguage: 'de', subjectPictures: NO_PICTURES },
    })
  })

  // R2P-3 [D1]: text is read by parseBriefText, whose one error gives no bad line.
  it('returns the brief_unreadable error with no line', async () => {
    const error = await expectRefused(
      bus,
      () => parse({ text: 'a: 1\nb: [x\n' }),
      'INVALID_INPUT',
      'brief_unreadable',
    )
    expect(error.details?.line).toBeUndefined()
  })

  it('refuses a list at the top with brief_unreadable', async () => {
    await expectRefused(bus, () => parse({ text: '[1, 2]' }), 'INVALID_INPUT', 'brief_unreadable')
  })
})

describe('brief.parse input [SPEC 4.2]', () => {
  it.each([{}, { text: 'a: 1', filePath: '/x.json' }, { filePath: '' }])(
    'refuses %j with INVALID_INPUT',
    async (input) => {
      await expectRefused(bus, () => parse(input), 'INVALID_INPUT')
    },
  )

  it('is denied to an agent', async () => {
    const result = await bus.bus.execute(
      'brief.parse',
      { projectId: bus.projectId, text: JSON_BRIEF },
      { actor: 'agent' },
    )
    expect(result).toMatchObject({ ok: false, error: { code: 'AGENT_DENIED' } })
  })
})

describe('brief.parse refuses a relative path [F-2]', () => {
  it('gives INVALID_INPUT for a relative path to a brief that exists, and parses the absolute one', async () => {
    const filePath = write('b.json', JSON_BRIEF)
    const relative = path.relative(process.cwd(), filePath)
    expect(fs.existsSync(relative)).toBe(true)
    const error = await expectRefused(bus, () => parse({ filePath: relative }), 'INVALID_INPUT')
    expect(error).toMatchObject({ message: 'The file path must be absolute.' })
    expect(await parse({ filePath })).toEqual({
      ok: true,
      data: { draft: DRAFT, primaryLanguage: 'de', subjectPictures: NO_PICTURES },
    })
  })
})

// SP-1 (security class) [D-098]: brief.parse checks the pictures a brief names.
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])
const withPictures = (pictures: unknown) =>
  JSON.stringify({ campaignName: 'Summer', subjects: [{ name: 'Can', pictures }, { name: 'Jar' }] })

describe('brief.parse subject pictures [D-098, SP-1]', () => {
  it('gives the real paths of good pictures and a note for each bad one', async () => {
    fs.mkdirSync(path.join(dir, 'photos'))
    fs.writeFileSync(path.join(dir, 'photos', 'can.png'), PNG)
    fs.writeFileSync(path.join(dir, 'notes.png'), 'secretword')
    const filePath = write('b.json', withPictures(['photos/can.png', '../x.png', 'notes.png']))
    const result = await bus.changed(() => parse({ filePath }))
    expect(result).toMatchObject({
      ok: true,
      data: {
        subjectPictures: [
          {
            paths: [path.join(fs.realpathSync(dir), 'photos', 'can.png')],
            notes: [
              { name: 'x.png', reason: 'not_found' },
              { name: 'notes.png', reason: 'not_a_picture' },
            ],
          },
          { paths: [], notes: [] },
        ],
      },
    })
  })

  it('keeps the raw texts in the draft beside the checked result', async () => {
    const filePath = write('b.yaml', 'subjects:\n  - name: Can\n    pictures: can.webp\n')
    expect(await parse({ filePath })).toMatchObject({
      data: {
        draft: { subjects: [{ name: 'Can', pictures: 'can.webp' }] },
        subjectPictures: [{ paths: [], notes: [{ name: 'can.webp', reason: 'not_found' }] }],
      },
    })
  })

  it('gives a relative picture of a typed brief not_full_path and checks a full path', async () => {
    expect(await parse({ text: withPictures(['photos/can.png', '/etc/passwd']) })).toMatchObject({
      ok: true,
      data: {
        subjectPictures: [
          {
            paths: [],
            notes: [
              { name: 'can.png', reason: 'not_full_path' },
              { name: 'passwd', reason: 'not_a_picture' },
            ],
          },
          { paths: [], notes: [] },
        ],
      },
    })
  })

  it('puts no path in a log line or an error', async () => {
    const outside = path.join(path.dirname(dir), 'private-photo.png')
    fs.writeFileSync(outside, PNG)
    const named = ['../private-photo.png', outside, 'missing-photo.png']
    const ok = await parse({ filePath: write('b.json', withPictures(named)) })
    const accepted = [fs.realpathSync(outside)]
    expect(ok).toMatchObject({ ok: true, data: { subjectPictures: [{ paths: accepted }, {}] } })
    const bad = write('c.yaml', `subjects:\n  - pictures: [${outside}\n`)
    const error = await expectRefused(bus, () => parse({ filePath: bad }), 'INVALID_INPUT')
    expect(error.details).toMatchObject({ reason: 'brief_unreadable' })
    const log = bus.logText()
    for (const text of [dir, 'private-photo', 'missing-photo']) expect(log).not.toContain(text)
  })
})

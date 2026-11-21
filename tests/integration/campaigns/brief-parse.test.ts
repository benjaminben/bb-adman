import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { briefCommands } from '../../../src/main/commands/brief'
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
    expect(result).toEqual({ ok: true, data: { draft: DRAFT, primaryLanguage: 'de' } })
  })

  it('takes the primary language from the first listed language first', async () => {
    const filePath = write('b.json', JSON.stringify({ region: 'Germany', languages: ['fr', 'de'] }))
    expect(await parse({ filePath })).toMatchObject({ data: { primaryLanguage: 'fr' } })
  })

  it('gives null as the primary language when nothing names one', async () => {
    const filePath = write('b.json', JSON.stringify({ region: 'Atlantis' }))
    expect(await parse({ filePath })).toEqual({
      ok: true,
      data: { draft: { region: 'Atlantis' }, primaryLanguage: null },
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
      data: { draft: DRAFT, primaryLanguage: 'de' },
    })
  })

  it('reads YAML text after the JSON try fails', async () => {
    expect(await parse({ text: YAML_BRIEF })).toEqual({
      ok: true,
      data: { draft: DRAFT, primaryLanguage: 'de' },
    })
  })

  it("returns the YAML try's error, line included", async () => {
    const error = await expectRefused(
      bus,
      () => parse({ text: 'a: 1\nb: [x\n' }),
      'INVALID_INPUT',
      'brief_unreadable',
    )
    expect(typeof error.details?.line).toBe('number')
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

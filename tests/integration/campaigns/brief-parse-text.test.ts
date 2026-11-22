// R2P-3 [D1, D3]: brief.parse { text } reads with parseBriefText (JSON, YAML, then Markdown)
// and checks the pictures the text names. Pasted text has no folder, so a full path is checked
// as a file and a relative one is refused with no disk read.
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { briefCommands } from '@/main/commands/brief'
import { makeAssetBus, expectRefused } from '../assets/asset-bus'
import { testDeps } from './campaign-deps'

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])

let bus: ReturnType<typeof makeAssetBus>
let dir: string
beforeEach(() => {
  bus = makeAssetBus(briefCommands(testDeps()))
  dir = fs.mkdtempSync(path.join(path.dirname(bus.project.filePath), 'pasted-'))
})
afterEach(() => bus.cleanup())

const parse = (text: string) => bus.user('brief.parse', { text })

describe('brief.parse { text } reads Markdown [D1, R2P-3]', () => {
  it('reads a Markdown brief into a draft, writing nothing', async () => {
    const text = [
      '# Spring Glow launch',
      '',
      'Region: Canada',
      'Languages: en, fr',
      '',
      '## Subjects',
      '',
      '### Citrus Glow serum',
      'ID: citrus-serum',
    ].join('\n')
    const result = await bus.changed(() => parse(text))
    expect(result).toEqual({
      ok: true,
      data: {
        draft: {
          campaignName: 'Spring Glow launch',
          region: 'Canada',
          languages: ['en', 'fr'],
          subjects: [{ id: 'citrus-serum', name: 'Citrus Glow serum' }],
        },
        primaryLanguage: 'en',
        subjectPictures: [{ paths: [], assetIds: [], notes: [] }],
      },
    })
  })

  it('refuses text that is none of the three with the D1 message', async () => {
    const error = await expectRefused(
      bus,
      () => parse('just some words'),
      'INVALID_INPUT',
      'brief_unreadable',
    )
    expect(error.message).toBe('The brief could not be read as JSON, YAML or Markdown.')
  })
})

describe('brief.parse { text } checks a pasted full path [D3, R2P-3]', () => {
  it('accepts an absolute path as its real path and refuses a relative one', async () => {
    fs.writeFileSync(path.join(dir, 'can.png'), PNG)
    const text = [
      '# Pasted',
      '## Subjects',
      '### Can',
      'Pictures:',
      `- ${path.join(dir, 'can.png')}`,
      '- photos/jar.png',
    ].join('\n')
    expect(await parse(text)).toMatchObject({
      ok: true,
      data: {
        subjectPictures: [
          {
            paths: [path.join(fs.realpathSync(dir), 'can.png')],
            assetIds: [],
            notes: [{ name: 'jar.png', reason: 'not_full_path' }],
          },
        ],
      },
    })
    expect(bus.logText()).not.toContain(dir)
  })
})

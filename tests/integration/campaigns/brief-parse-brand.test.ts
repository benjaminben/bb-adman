// BB-3 (security class): brief.parse checks the brand files a brief names, for a file and for
// pasted text (spec/brief-brand.md "brief.parse"). No path it names reaches a log line or an
// event; the reply goes to the window only.
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { briefCommands } from '@/main/commands/brief'
import { makeAssetBus } from '../assets/asset-bus'
import { insertTestAsset } from '../assets/asset-rows'
import { testDeps } from './campaign-deps'

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])
const WOFF2 = Buffer.from('wOF2made-up font bytes')
const FONT_ID = '01JABCDEFGHJKMNPQRSTVWXYZ0'
const REFERENCE_ID = '01JABCDEFGHJKMNPQRSTVWXYZ1'

let bus: ReturnType<typeof makeAssetBus>
let dir: string
let real: string
beforeEach(() => {
  bus = makeAssetBus(briefCommands(testDeps()))
  dir = fs.mkdtempSync(path.join(path.dirname(bus.project.filePath), 'brand-briefs-'))
  real = fs.realpathSync(dir)
  fs.mkdirSync(path.join(dir, 'brand'))
  fs.writeFileSync(path.join(dir, 'brand/logo.png'), PNG)
  fs.writeFileSync(path.join(dir, 'brand/Headline.woff2'), WOFF2)
  insertTestAsset(bus.db, { id: FONT_ID, kind: 'font', relPath: 'a/f', absPath: '/x/f' })
  insertTestAsset(bus.db, {
    id: REFERENCE_ID,
    library: 'reference',
    relPath: 'a/r',
    absPath: '/x/r',
  })
})
afterEach(() => bus.cleanup())

function write(name: string, brief: unknown): string {
  const file = path.join(dir, name)
  fs.writeFileSync(file, JSON.stringify(brief))
  return file
}

const parse = (input: Record<string, unknown>) => bus.user('brief.parse', input)

describe('brief.parse brandFiles [BB-3]', () => {
  it('lists the brand files of a brief file, with nothing written', async () => {
    const filePath = write('b.json', {
      campaignName: 'Summer',
      brand: { logo: 'brand/logo.png', fonts: { heading: 'brand/Headline.woff2', body: FONT_ID } },
    })
    const result = await bus.changed(() => parse({ filePath }))
    expect(result).toMatchObject({
      ok: true,
      data: {
        brandFiles: {
          files: [
            { role: 'logo', path: path.join(real, 'brand/logo.png'), assetId: null },
            { role: 'headingFont', path: path.join(real, 'brand/Headline.woff2'), assetId: null },
            { role: 'bodyFont', path: null, assetId: FONT_ID },
          ],
          notes: [],
        },
      },
    })
  })

  it('lists the brand files of pasted text, with notes for a relative path and a reference ID', async () => {
    const text = JSON.stringify({
      campaignName: 'Summer',
      brand: {
        logo: REFERENCE_ID,
        fonts: { heading: path.join(dir, 'brand/Headline.woff2'), body: 'brand/Body.ttf' },
      },
    })
    expect(await parse({ text })).toMatchObject({
      ok: true,
      data: {
        brandFiles: {
          files: [
            { role: 'headingFont', path: path.join(real, 'brand/Headline.woff2'), assetId: null },
          ],
          notes: [
            { role: 'logo', name: REFERENCE_ID, reason: 'unknown_asset' },
            { role: 'bodyFont', name: 'Body.ttf', reason: 'not_full_path' },
          ],
        },
      },
    })
  })

  it('puts no given path in a log line or an event', async () => {
    const brand = {
      logo: '../secret-logos/missing-logo.png',
      fonts: { heading: path.join(dir, 'brand/Headline.woff2'), body: 'private-fonts/body.ttf' },
    }
    expect(await parse({ filePath: write('log.json', { brand }) })).toMatchObject({ ok: true })
    expect(await parse({ text: JSON.stringify({ brand }) })).toMatchObject({ ok: true })
    const said = bus.logText() + JSON.stringify(bus.events)
    for (const text of [dir, real, 'secret-logos', 'missing-logo', 'private-fonts', 'Headline']) {
      expect(said).not.toContain(text)
    }
  })
})

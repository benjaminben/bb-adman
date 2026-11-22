// Z-1 (spec/phases/design-wave-screens-b.md, "Z-1 — Clean-up"): the names nothing used any more
// are gone from src/renderer, and so are the files that held them.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = path.resolve('src/renderer')

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name)
    return e.isDirectory() ? files(full) : [full]
  })
}

const SOURCES = files(ROOT).map((file) => ({ file, text: fs.readFileSync(file, 'utf8') }))
const users = (pattern: RegExp) =>
  SOURCES.filter((s) => pattern.test(s.text)).map((s) => path.relative(ROOT, s.file))
const bare = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '')

describe('the shared layout classes nothing used are gone [Z-1]', () => {
  const layout = bare(fs.readFileSync(path.join(ROOT, 'ui/layout.module.css'), 'utf8'))

  it.each([['screen'], ['keyRow']])('.%s is not read and not defined', (name) => {
    expect(users(new RegExp(`layout(\\.${name}\\b|\\[['"]${name}['"]\\])`))).toEqual([])
    expect(layout).not.toMatch(new RegExp(`\\.${name}(?![\\w-])`))
  })
})

describe('the dead code found at merge is gone [Z-1]', () => {
  it.each([
    ['editor/colour-choice'],
    ['ui/close-warning/close-warning.module.css'],
  ])('%s does not exist', (rel) => {
    expect(fs.existsSync(path.join(ROOT, rel))).toBe(false)
  })

  it.each([
    ['ColourChoice'],
    ['colour-choice'],
    ['close-warning.module'],
    ['createJobStore'],
    ['resultAssetIds'],
    ['hasBrandWarning'],
    ['summaryCounts'],
    ['CampaignReports'],
    ['failureApart'],
  ])('no file names %s', (name) => {
    expect(users(new RegExp(`\\b${name}\\b`))).toEqual([])
  })

  it('CampaignExport takes no reports prop', () => {
    expect(users(/reports=\{/)).toEqual([])
  })
})

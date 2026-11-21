// P6-7 (spec/phases/phase-06.md, design addition 4; A-164): translation.exportSheet writes the
// sheet to a path from outside. The path is checked before anything is written, the write goes
// to {path}.partial and is renamed over the target, and nothing is left behind on a failure.
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { data } from '../core-fixture'
import { makeRowsSetup, type RowsSetup } from './rows-fixture'
import { assetsDirOf } from '@/main/assets/service'
import { AGENT_POLICY, denialMessage } from '@/main/commands/agent-policy'
import { sheetCsv } from '@/shared/translation/sheet'
import type { TranslationForCampaign } from '@/shared/schemas/queries/translation'

let s: RowsSetup | undefined
afterEach(() => {
  vi.restoreAllMocks()
  s?.fx.cleanup()
  s = undefined
})

async function setup() {
  s = await makeRowsSetup()
  const t = s
  const out = path.join(t.fx.root, 'out')
  fs.mkdirSync(out)
  const assets = assetsDirOf(t.fx.core.deps.projects.requireOpen(t.projectId))
  fs.mkdirSync(assets, { recursive: true })
  const exportTo = (filePath: string, actor: 'user' | 'agent' = 'user') =>
    t.fx.core.bus.execute(
      'translation.exportSheet',
      { projectId: t.projectId, campaignId: t.campaignId, filePath },
      { actor },
    )
  return { ...t, out, assets, exportTo }
}

// Every file and folder under a folder, so a refusal can show it left nothing behind.
function listing(dir: string): string[] {
  return fs.readdirSync(dir, { recursive: true, encoding: 'utf8' }).sort()
}

async function expectedSheet(t: RowsSetup) {
  const input = { projectId: t.projectId, campaignId: t.campaignId }
  const reply = await t.fx.core.query('translation.forCampaign', input, { actor: 'user' })
  return sheetCsv(data<TranslationForCampaign>(reply).rows)
}

describe('translation.exportSheet [P6-7]', () => {
  it('writes the sheet and answers the file name and the row count', async () => {
    const t = await setup()
    const before = t.fx.events.length
    const file = path.join(t.out, 'Sheet.CSV')
    const reply = data<{ path: string; rowCount: number }>(await t.exportTo(file))
    expect(fs.readFileSync(file, 'utf8')).toBe(await expectedSheet(t))
    expect(reply).toEqual({ path: 'Sheet.CSV', rowCount: 3 })
    expect(listing(t.out)).toEqual(['Sheet.CSV'])
    expect(t.fx.events.slice(before)).toEqual([])
    expect(t.fx.readLogs()).not.toContain(t.out)
  })

  it('replaces an existing file', async () => {
    const t = await setup()
    const file = path.join(t.out, 'sheet.csv')
    fs.writeFileSync(file, 'old')
    expect(await t.exportTo(file)).toMatchObject({ ok: true })
    expect(fs.readFileSync(file, 'utf8')).toBe(await expectedSheet(t))
    expect(listing(t.out)).toEqual(['sheet.csv'])
  })

  type Case = [string, (t: Awaited<ReturnType<typeof setup>>) => string, string, string]
  const cases: Case[] = [
    ['a relative path', () => 'sheet.csv', 'INVALID_INPUT', 'The file path must be absolute.'],
    [
      'a path not ending in .csv',
      (t) => path.join(t.out, 'sheet.txt'),
      'INVALID_INPUT',
      'The sheet must be a .csv file.',
    ],
    [
      'an over-long path',
      (t) => path.join(t.out, `${'a'.repeat(4100)}.csv`),
      'INVALID_INPUT',
      'Some values are not valid.',
    ],
    [
      'a missing folder',
      (t) => path.join(t.out, 'gone', 'sheet.csv'),
      'NOT_FOUND',
      'That folder was not found.',
    ],
    [
      'a folder at the path',
      (t) => {
        fs.mkdirSync(path.join(t.out, 'sheet.csv'))
        return path.join(t.out, 'sheet.csv')
      },
      'RULE_VIOLATION',
      'Something that is not a file is already there.',
    ],
    [
      'a link at the path',
      (t) => {
        fs.symlinkSync(
          t.fx.core.deps.projects.requireOpen(t.projectId).filePath,
          path.join(t.out, 'sheet.csv'),
        )
        return path.join(t.out, 'sheet.csv')
      },
      'RULE_VIOLATION',
      'Something that is not a file is already there.',
    ],
    [
      'the assets folder itself',
      (t) => path.join(t.assets, 'sheet.csv'),
      'RULE_VIOLATION',
      "Choose a folder outside the project's assets folder.",
    ],
    [
      'inside the assets folder',
      (t) => {
        fs.mkdirSync(path.join(t.assets, 'sub'))
        return path.join(t.assets, 'sub', 'sheet.csv')
      },
      'RULE_VIOLATION',
      "Choose a folder outside the project's assets folder.",
    ],
    [
      'inside the assets folder through a link',
      (t) => {
        fs.symlinkSync(t.assets, path.join(t.out, 'link'))
        return path.join(t.out, 'link', 'sheet.csv')
      },
      'RULE_VIOLATION',
      "Choose a folder outside the project's assets folder.",
    ],
    [
      'an unfinished sheet in the way',
      (t) => {
        fs.writeFileSync(path.join(t.out, 'sheet.csv.partial'), 'keep')
        return path.join(t.out, 'sheet.csv')
      },
      'RULE_VIOLATION',
      'An unfinished sheet file is in the way.',
    ],
  ]

  it.each(cases)('refuses %s and writes nothing', async (_name, pathOf, code, message) => {
    const t = await setup()
    const filePath = pathOf(t)
    const before = { out: listing(t.out), assets: listing(t.assets) }
    const reply = await t.exportTo(filePath)
    expect(reply).toMatchObject({ ok: false, error: { code, message } })
    expect({ out: listing(t.out), assets: listing(t.assets) }).toEqual(before)
    expect(JSON.stringify(reply)).not.toContain(t.out)
  })

  it('removes the partial file when the rename fails, and logs no path', async () => {
    const t = await setup()
    vi.spyOn(fs.promises, 'rename').mockRejectedValueOnce(
      Object.assign(new Error(`EXDEV: cross-device link, rename '${t.out}'`), { code: 'EXDEV' }),
    )
    const reply = await t.exportTo(path.join(t.out, 'sheet.csv'))
    expect(reply).toEqual({
      ok: false,
      error: {
        code: 'INTERNAL',
        message: 'The sheet could not be written.',
        details: { reason: 'write_failed' },
      },
    })
    expect(listing(t.out)).toEqual([])
    expect(t.fx.readLogs()).not.toContain(t.out)
  })

  it('refuses the agent, with the policy row deny', async () => {
    const t = await setup()
    expect(AGENT_POLICY['translation.exportSheet']?.policy).toBe('deny')
    expect(await t.exportTo(path.join(t.out, 'sheet.csv'), 'agent')).toEqual({
      ok: false,
      error: { code: 'AGENT_DENIED', message: denialMessage('translation.exportSheet') },
    })
    expect(listing(t.out)).toEqual([])
  })

  it('refuses a campaign not in the project before writing', async () => {
    const t = await setup()
    const filePath = path.join(t.out, 'sheet.csv')
    const input = { projectId: t.projectId, campaignId: 'C-none', filePath }
    expect(await t.fx.user('translation.exportSheet', input)).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND' },
    })
    expect(listing(t.out)).toEqual([])
  })
})

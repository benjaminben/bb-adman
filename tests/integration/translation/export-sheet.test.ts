// P6-7 (spec/phases/phase-06.md, design addition 4; A-164): translation.exportSheet writes the
// sheet to a path from outside. The path is checked before anything is written, the write goes
// to {path}.partial and is renamed over the target, and nothing is left behind on a failure.
// P6-7b: only the path the save dialog last gave is written, once.
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'

const showSaveDialog = vi.fn()
vi.mock('electron', () => ({ dialog: { showSaveDialog } }))

const { runDialogQuery } = await import('@/main/windows/dialogs')
const PICK = { purpose: 'translation-sheet' }
import { data } from '../core-fixture'
import { makeRowsSetup, type RowsSetup } from './rows-fixture'
import { assetsDirOf } from '@/main/assets/service'
import { AGENT_POLICY, denialMessage } from '@/main/commands/agent-policy'
import { forgetSheetPath } from '@/main/translation/chosen-sheet-path'
import { sheetCsv } from '@/shared/translation/sheet'
import type { TranslationForCampaign } from '@/shared/schemas/queries/translation'

let s: RowsSetup | undefined
beforeEach(() => forgetSheetPath())
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
  const send = (filePath: string, actor: 'user' | 'agent' = 'user') =>
    t.fx.core.bus.execute(
      'translation.exportSheet',
      { projectId: t.projectId, campaignId: t.campaignId, filePath },
      { actor },
    )
  // The path chosen in the save dialog first, as the window does, then sent.
  const exportTo = async (filePath: string, actor: 'user' | 'agent' = 'user') => {
    await choose(filePath)
    return send(filePath, actor)
  }
  return { ...t, out, assets, send, exportTo }
}

// The save dialog answers filePath, through the real dialog query.
async function choose(filePath: string) {
  showSaveDialog.mockResolvedValueOnce({ canceled: false, filePath })
  const picked = await runDialogQuery('dialog.pickSaveFile', PICK)
  expect(picked).toEqual({ ok: true, data: { path: filePath } })
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
    const reply = data<{ fileName: string; rowCount: number }>(await t.exportTo(file))
    expect(fs.readFileSync(file, 'utf8')).toBe(await expectedSheet(t))
    expect(reply).toEqual({ fileName: 'Sheet.CSV', rowCount: 3 })
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
    await choose(filePath)
    const input = { projectId: t.projectId, campaignId: 'C-none', filePath }
    expect(await t.fx.user('translation.exportSheet', input)).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND' },
    })
    expect(listing(t.out)).toEqual([])
  })
})

describe('translation.exportSheet writes only the chosen path [P6-7b]', () => {
  const NOT_CHOSEN = {
    ok: false,
    error: {
      code: 'RULE_VIOLATION',
      message: 'Choose where to save the sheet first.',
      details: { reason: 'path_not_chosen' },
    },
  }

  it('refuses a path never chosen, before any file-system call, and writes nothing', async () => {
    const t = await setup()
    const file = path.join(t.out, 'sheet.csv')
    fs.writeFileSync(file, 'old')
    const stat = vi.spyOn(fs.promises, 'stat')
    const lstat = vi.spyOn(fs.promises, 'lstat')
    expect(await t.send(file)).toEqual(NOT_CHOSEN)
    expect(stat).not.toHaveBeenCalled()
    expect(lstat).not.toHaveBeenCalled()
    expect(fs.readFileSync(file, 'utf8')).toBe('old')
    expect(listing(t.out)).toEqual(['sheet.csv'])
  })

  it('writes the chosen path once and refuses it the second time', async () => {
    const t = await setup()
    const file = path.join(t.out, 'sheet.csv')
    expect(await t.exportTo(file)).toMatchObject({ ok: true })
    fs.writeFileSync(file, 'kept')
    expect(await t.send(file)).toEqual(NOT_CHOSEN)
    expect(fs.readFileSync(file, 'utf8')).toBe('kept')
  })

  it('lets a newer choice replace an older one', async () => {
    const t = await setup()
    const older = path.join(t.out, 'older.csv')
    const newer = path.join(t.out, 'newer.csv')
    await choose(older)
    await choose(newer)
    expect(await t.send(older)).toEqual(NOT_CHOSEN)
    expect(await t.send(newer)).toMatchObject({ ok: true })
    expect(listing(t.out)).toEqual(['newer.csv'])
  })

  it('remembers nothing when the dialog is cancelled', async () => {
    const t = await setup()
    const file = path.join(t.out, 'sheet.csv')
    await choose(file)
    showSaveDialog.mockResolvedValueOnce({ canceled: true, filePath: '' })
    expect(await runDialogQuery('dialog.pickSaveFile', PICK)).toEqual({
      ok: true,
      data: { path: null },
    })
    expect(await t.send(file)).toMatchObject({ ok: true })
  })
})

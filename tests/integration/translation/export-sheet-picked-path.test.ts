// P6-7b with the CW-2 review fix: translation.exportSheet writes only the path the save dialog
// gave, as remembered, never the path text it was sent. The system follows a link before it
// applies "..", so "link/../sheet.csv" can lead to another folder.
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'

const showSaveDialog = vi.fn()
vi.mock('electron', () => ({ dialog: { showSaveDialog } }))

const { runDialogQuery } = await import('@/main/windows/dialogs')
import { data } from '../core-fixture'
import { makeRowsSetup, type RowsSetup } from './rows-fixture'
import { forgetSheetPath } from '@/main/translation/chosen-sheet-path'

let s: RowsSetup | undefined
beforeEach(() => forgetSheetPath())
afterEach(() => {
  s?.fx.cleanup()
  s = undefined
})

describe('translation.exportSheet writes the remembered path [P6-7b]', () => {
  it('writes the chosen file, not where the sent text leads through a link', async () => {
    s = await makeRowsSetup()
    const t = s
    const out = path.join(t.fx.root, 'out')
    const elsewhere = path.join(t.fx.root, 'elsewhere')
    fs.mkdirSync(out)
    fs.mkdirSync(path.join(elsewhere, 'sub'), { recursive: true })
    fs.symlinkSync(path.join(elsewhere, 'sub'), path.join(out, 'link'))
    const chosen = path.join(out, 'sheet.csv')
    showSaveDialog.mockResolvedValueOnce({ canceled: false, filePath: chosen })
    data(await runDialogQuery('dialog.pickSaveFile', { purpose: 'translation-sheet' }))

    const sent = `${out}/link/../sheet.csv`
    const reply = await t.fx.core.bus.execute(
      'translation.exportSheet',
      { projectId: t.projectId, campaignId: t.campaignId, filePath: sent },
      { actor: 'user' },
    )
    expect(reply).toMatchObject({ ok: true, data: { fileName: 'sheet.csv' } })
    expect(fs.existsSync(chosen)).toBe(true)
    expect(fs.readdirSync(elsewhere)).toEqual(['sub'])
  })
})

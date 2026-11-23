import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { BrowserWindow } from 'electron'
import { pickSaveFileInput } from '@/shared/schemas/queries/dialog'
import { forgetSheetPath, takeSheetPath } from '@/main/translation/chosen-sheet-path'

const showSaveDialog = vi.fn()
const showOpenDialog = vi.fn()
vi.mock('electron', () => ({
  BrowserWindow: { getFocusedWindow: () => null, getAllWindows: () => [] },
  dialog: { showSaveDialog, showOpenDialog },
}))

const { DIALOG_QUERIES, runDialogQuery, saveFileOptions } = await import('@/main/windows/dialogs')

const CSV_FILTER = [{ name: 'Translation sheet', extensions: ['csv'] }]

beforeEach(() => {
  showSaveDialog.mockReset()
  showOpenDialog.mockReset()
  showSaveDialog.mockResolvedValue({ canceled: false, filePath: '/w/sheet.csv' })
})

describe('dialog.pickSaveFile options [Phase 6 section 1, P6-8]', () => {
  it('is one of the dialog queries index.ts answers from the app window only', () => {
    expect(DIALOG_QUERIES).toContain('dialog.pickSaveFile')
  })

  it('offers .csv for the translation sheet, with the default path as a suggestion', () => {
    expect(saveFileOptions({ purpose: 'translation-sheet', defaultPath: '/w/a.csv' })).toEqual({
      defaultPath: '/w/a.csv',
      filters: CSV_FILTER,
    })
    expect(saveFileOptions({ purpose: 'translation-sheet' })).toEqual({ filters: CSV_FILTER })
  })

  it.each([
    null,
    {},
    { purpose: 'export' },
    { purpose: 'translation-sheet', title: 'x' },
    { purpose: 'translation-sheet', defaultPath: 3 },
  ])('refuses %j', (input) => {
    expect(pickSaveFileInput.safeParse(input).success).toBe(false)
    expect(saveFileOptions(input)).toBeNull()
  })
})

describe('dialog.pickSaveFile reply [Phase 6 section 1, P6-8]', () => {
  it('returns the chosen path and nothing else, from a save dialog modal to the window', async () => {
    showSaveDialog.mockResolvedValue({ canceled: false, filePath: '/w/s.csv', bookmark: 'b' })
    const asking = { id: 7 } as unknown as BrowserWindow
    const input = { purpose: 'translation-sheet', defaultPath: '/w/s.csv' }
    const result = await runDialogQuery('dialog.pickSaveFile', input, { window: asking })
    expect(result).toEqual({ ok: true, data: { path: '/w/s.csv' } })
    expect(showSaveDialog.mock.calls[0]).toEqual([asking, saveFileOptions(input)])
    expect(showOpenDialog).not.toHaveBeenCalled()
  })

  it.each([
    { canceled: true, filePath: '/w/s.csv' },
    { canceled: true, filePath: '' },
    { canceled: false, filePath: '' },
  ])('returns path null when the dialog gives %j', async (answer) => {
    showSaveDialog.mockResolvedValue(answer)
    expect(await runDialogQuery('dialog.pickSaveFile', { purpose: 'translation-sheet' })).toEqual({
      ok: true,
      data: { path: null },
    })
  })

  it('refuses a bad input with INVALID_INPUT and shows no dialog', async () => {
    for (const input of [{}, { purpose: 'export' }, { purpose: 'translation-sheet', x: 1 }]) {
      expect(await runDialogQuery('dialog.pickSaveFile', input)).toMatchObject({
        ok: false,
        error: { code: 'INVALID_INPUT' },
      })
    }
    expect(showSaveDialog).not.toHaveBeenCalled()
  })

  it('never creates, reads or writes the default path', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-save-pick-'))
    const suggested = path.join(root, 'missing', 'sheet.csv')
    try {
      await runDialogQuery('dialog.pickSaveFile', {
        purpose: 'translation-sheet',
        defaultPath: suggested,
      })
      expect(showSaveDialog.mock.calls[0]?.at(-1)).toMatchObject({ defaultPath: suggested })
      expect(fs.readdirSync(root)).toEqual([])
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('dialog.pickSaveFile remembers the chosen path [P6-7b]', () => {
  const PICK = { purpose: 'translation-sheet' }

  it('remembers the path it gave, for one use', async () => {
    forgetSheetPath()
    await runDialogQuery('dialog.pickSaveFile', PICK)
    expect(takeSheetPath('/w/sheet.csv')).toBe('/w/sheet.csv')
    expect(takeSheetPath('/w/sheet.csv')).toBeNull()
  })

  it('remembers nothing when cancelled, and keeps the earlier choice', async () => {
    forgetSheetPath()
    await runDialogQuery('dialog.pickSaveFile', PICK)
    showSaveDialog.mockResolvedValue({ canceled: true, filePath: '' })
    await runDialogQuery('dialog.pickSaveFile', PICK)
    expect(takeSheetPath('/w/sheet.csv')).toBe('/w/sheet.csv')
  })
})

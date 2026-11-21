import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { BrowserWindow } from 'electron'
import { pickerExtensions } from '@/shared/config/file-types'

const showOpenDialog = vi.fn()
vi.mock('electron', () => ({
  BrowserWindow: { getFocusedWindow: () => null, getAllWindows: () => [] },
  dialog: { showOpenDialog },
}))

const { DIALOG_QUERIES, runDialogQuery } = await import('@/main/windows/dialogs')

beforeEach(() => {
  showOpenDialog.mockReset()
  showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['/w/a.png', '/w/b.png'] })
})

const optionsOfCall = () => showOpenDialog.mock.calls[0]?.at(-1) as Electron.OpenDialogOptions

describe('dialog.pickFiles [SPEC 4.3, Phase 2 slice A]', () => {
  it('is one of the dialog queries index.ts joins to the query channel', () => {
    expect(DIALOG_QUERIES).toContain('dialog.pickFiles')
  })

  it('picks several files for import by default, offering every accepted type', async () => {
    const result = await runDialogQuery('dialog.pickFiles', {
      purpose: 'import',
      defaultPath: '/w',
    })
    expect(result).toEqual({ ok: true, data: { paths: ['/w/a.png', '/w/b.png'] } })
    expect(optionsOfCall()).toEqual({
      properties: ['openFile', 'multiSelections'],
      defaultPath: '/w',
      filters: [{ name: 'Accepted files', extensions: pickerExtensions('import') }],
    })
  })

  it('picks one file for relink, offering only the asset kind', async () => {
    await runDialogQuery('dialog.pickFiles', { purpose: 'relink', kind: 'font' })
    expect(optionsOfCall()).toEqual({
      properties: ['openFile'],
      filters: [{ name: 'Accepted files', extensions: ['ttf', 'otf', 'woff2'] }],
    })
  })

  it('picks one brief file, offering the text types, unless multiple is asked for', async () => {
    await runDialogQuery('dialog.pickFiles', { purpose: 'brief' })
    expect(optionsOfCall().properties).toEqual(['openFile'])
    expect(optionsOfCall().filters).toEqual([
      { name: 'Accepted files', extensions: pickerExtensions('brief') },
    ])
    showOpenDialog.mockClear()
    await runDialogQuery('dialog.pickFiles', { purpose: 'brief', multiple: true })
    expect(optionsOfCall().properties).toEqual(['openFile', 'multiSelections'])
  })

  it('returns an empty list when the picker is cancelled', async () => {
    showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] })
    expect(await runDialogQuery('dialog.pickFiles', { purpose: 'import' })).toEqual({
      ok: true,
      data: { paths: [] },
    })
  })

  it('is modal to the window that asked', async () => {
    const asking = { id: 7 } as unknown as BrowserWindow
    await runDialogQuery('dialog.pickFiles', { purpose: 'import' }, { window: asking })
    expect(showOpenDialog.mock.calls[0]?.[0]).toBe(asking)
  })

  it('refuses an unknown purpose, an unknown kind or an unknown key and shows no picker', async () => {
    for (const input of [
      {},
      { purpose: 'export' },
      { purpose: 'relink', kind: 'gif' },
      { purpose: 'import', title: 'x' },
    ]) {
      expect(await runDialogQuery('dialog.pickFiles', input)).toMatchObject({
        ok: false,
        error: { code: 'INVALID_INPUT' },
      })
    }
    expect(showOpenDialog).not.toHaveBeenCalled()
  })
})

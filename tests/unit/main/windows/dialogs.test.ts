import { describe, it, expect, vi, beforeEach } from 'vitest'

const showOpenDialog = vi.fn()
vi.mock('electron', () => ({
  BrowserWindow: { getFocusedWindow: () => null, getAllWindows: () => [] },
  dialog: { showOpenDialog },
}))

const { runDialogQuery } = await import('../../../../src/main/windows/dialogs')

beforeEach(() => {
  showOpenDialog.mockReset()
  showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['/w/A.adman'] })
})

describe('dialog queries validate with Zod [SPEC 4.3, correction 20]', () => {
  it('returns INVALID_INPUT and shows no picker for an input the schema refuses', async () => {
    for (const [name, input] of [
      ['dialog.pickFolder', { defaultPath: 3 }],
      ['dialog.pickProjectFile', { title: 'x' }],
      ['dialog.pickFolder', null],
    ] as const) {
      expect(await runDialogQuery(name, input)).toMatchObject({
        ok: false,
        error: { code: 'INVALID_INPUT' },
      })
    }
    expect(showOpenDialog).not.toHaveBeenCalled()
  })

  it('passes the title and start folder to the folder picker', async () => {
    const result = await runDialogQuery('dialog.pickFolder', { title: 'Where', defaultPath: '/w' })
    expect(result).toEqual({ ok: true, data: { path: '/w/A.adman' } })
    expect(showOpenDialog).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Where', defaultPath: '/w' }),
    )
  })

  it('returns path null when the picker is cancelled', async () => {
    showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] })
    expect(await runDialogQuery('dialog.pickProjectFile', {})).toEqual({
      ok: true,
      data: { path: null },
    })
  })
})

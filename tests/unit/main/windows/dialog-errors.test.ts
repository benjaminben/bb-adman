import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { LogInput } from '@/main/log/activity-log'
import { INTERNAL_MESSAGE } from '@/shared/schemas/result'

const showOpenDialog = vi.fn()
const focused = { id: 'focused' }
vi.mock('electron', () => ({
  BrowserWindow: { getFocusedWindow: () => focused, getAllWindows: () => [focused] },
  dialog: { showOpenDialog },
}))

const { runDialogQuery } = await import('@/main/windows/dialogs')

function memoryLog() {
  const lines: LogInput[] = []
  return { lines, log: { write: (e: LogInput) => lines.push(e), prune: () => undefined } }
}

beforeEach(() => {
  showOpenDialog.mockReset()
  showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['/w/A.adman'] })
})

describe('a picker never rejects [SPEC 4.3, S2-03]', () => {
  it('returns the fixed INTERNAL result with a ULID and logs one query line when the dialog throws', async () => {
    showOpenDialog.mockRejectedValue(new Error('dialog broke at /Users/someone/x'))
    const { lines, log } = memoryLog()
    const result = await runDialogQuery('dialog.pickFolder', {}, { log })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('INTERNAL')
    expect(result.error.message).toBe(INTERNAL_MESSAGE)
    const commandId = result.error.details?.commandId
    expect(commandId).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({
      level: 'error',
      event: 'query',
      name: 'dialog.pickFolder',
      actor: 'user',
      ok: false,
      errorKind: 'INTERNAL',
      context: { commandId },
    })
  })
})

describe('the picker is modal to the window that asked [SPEC 4.3, S2-04]', () => {
  it('uses the asking window as parent, not the focused one', async () => {
    const asking = { id: 'asking' } as unknown as Electron.BrowserWindow
    await runDialogQuery('dialog.pickFolder', {}, { window: asking })
    expect(showOpenDialog).toHaveBeenCalledTimes(1)
    expect(showOpenDialog.mock.calls[0]?.[0]).toBe(asking)
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { pickerExtensions } from '@/shared/config/file-types'
import {
  forgetWorkflowPath,
  takeWorkflowPath,
} from '@/main/providers/comfyui/custom/chosen-workflow-path'

const showOpenDialog = vi.fn()
vi.mock('electron', () => ({
  BrowserWindow: { getFocusedWindow: () => null, getAllWindows: () => [] },
  dialog: { showOpenDialog },
}))

const { runDialogQuery } = await import('@/main/windows/dialogs')

beforeEach(() => {
  forgetWorkflowPath()
  showOpenDialog.mockReset()
  showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['/w/flow.json'] })
})

const optionsOfCall = () => showOpenDialog.mock.calls[0]?.at(-1) as Electron.OpenDialogOptions

describe('dialog.pickFiles with purpose comfy-workflow [D-104, CW-2]', () => {
  it('offers .json only, for that purpose', () => {
    expect(pickerExtensions('comfy-workflow')).toEqual(['json'])
    expect(pickerExtensions('import')).toContain('png')
  })

  it('picks one .json file and remembers its path for comfyWorkflow.addFromFile', async () => {
    const result = await runDialogQuery('dialog.pickFiles', { purpose: 'comfy-workflow' })
    expect(result).toEqual({ ok: true, data: { paths: ['/w/flow.json'] } })
    expect(optionsOfCall()).toEqual({
      properties: ['openFile'],
      filters: [{ name: 'Accepted files', extensions: ['json'] }],
    })
    expect(takeWorkflowPath('/w/flow.json')).toBe('/w/flow.json')
  })

  it('picks one file even when several are asked for', async () => {
    await runDialogQuery('dialog.pickFiles', { purpose: 'comfy-workflow', multiple: true })
    expect(optionsOfCall().properties).toEqual(['openFile'])
  })

  it('remembers nothing when cancelled, or for another purpose', async () => {
    showOpenDialog.mockResolvedValueOnce({ canceled: true, filePaths: [] })
    await runDialogQuery('dialog.pickFiles', { purpose: 'comfy-workflow' })
    await runDialogQuery('dialog.pickFiles', { purpose: 'brief' })
    expect(takeWorkflowPath('/w/flow.json')).toBeNull()
  })
})

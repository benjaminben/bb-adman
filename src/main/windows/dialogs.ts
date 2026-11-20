// Native file and folder pickers (SPEC 4.3). The window cannot read the file system, so it
// asks the main process through these two queries. Inputs are checked with Zod.
import { BrowserWindow, dialog } from 'electron'
import { fail, ok, type Result } from '../../shared/schemas/result'
import {
  pickFolderInput,
  pickProjectFileInput,
  type PickedPath,
} from '../../shared/schemas/queries/dialog'

export const DIALOG_QUERIES = ['dialog.pickFolder', 'dialog.pickProjectFile'] as const

function dialogOptions(name: string, input: unknown): Electron.OpenDialogOptions | null {
  if (name === 'dialog.pickFolder') {
    const parsed = pickFolderInput.safeParse(input)
    if (!parsed.success) return null
    return { properties: ['openDirectory', 'createDirectory'], ...parsed.data }
  }
  const parsed = pickProjectFileInput.safeParse(input)
  if (!parsed.success) return null
  return {
    properties: ['openFile'],
    ...parsed.data,
    filters: [{ name: 'Adman project', extensions: ['adman'] }],
  }
}

export async function runDialogQuery(name: string, input: unknown): Promise<Result<PickedPath>> {
  const options = dialogOptions(name, input)
  if (!options) return fail({ code: 'INVALID_INPUT', message: 'Some values are not valid.' })
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  const result = win
    ? await dialog.showOpenDialog(win, options)
    : await dialog.showOpenDialog(options)
  return ok({ path: result.canceled ? null : (result.filePaths[0] ?? null) })
}

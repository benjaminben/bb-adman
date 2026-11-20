// Native file and folder pickers. The window cannot read the file system, so it asks
// the main process through these two queries.
import { BrowserWindow, dialog } from 'electron'
import { ok, type Result } from '../../shared/schemas/result'

export const DIALOG_QUERIES = ['dialog.pickFolder', 'dialog.pickProjectFile'] as const

function startPath(input: unknown): string | undefined {
  if (typeof input !== 'object' || input === null || !('defaultPath' in input)) return undefined
  return typeof input.defaultPath === 'string' ? input.defaultPath : undefined
}

export async function runDialogQuery(name: string, input: unknown): Promise<Result<unknown>> {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  const options: Electron.OpenDialogOptions =
    name === 'dialog.pickFolder'
      ? { properties: ['openDirectory', 'createDirectory'], defaultPath: startPath(input) }
      : {
          properties: ['openFile'],
          defaultPath: startPath(input),
          filters: [{ name: 'Adman project', extensions: ['adman'] }],
        }
  const result = win
    ? await dialog.showOpenDialog(win, options)
    : await dialog.showOpenDialog(options)
  return ok({ path: result.canceled ? null : (result.filePaths[0] ?? null) })
}

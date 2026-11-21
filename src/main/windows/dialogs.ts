// Native file and folder pickers (SPEC 4.3). The window cannot read the file system, so it
// asks the main process through these two queries. Inputs are checked with Zod.
import { dialog, type BrowserWindow } from 'electron'
import { ulid } from 'ulid'
import type { ActivityLog } from '../log/activity-log'
import { errorContext } from '../log/error-context'
import { fail, internalError, ok, type Result } from '../../shared/schemas/result'
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

// The window that asked (SPEC 4.3, S2-04) and the log for an unforeseen error (S2-03).
export type DialogRunOptions = { window?: BrowserWindow | null; log?: ActivityLog }

// The dialog queries skip the query runner, so this catch keeps the window's call from
// rejecting (SPEC 4.3): the reply is the fixed INTERNAL result and one query log line.
export async function runDialogQuery(
  name: string,
  input: unknown,
  opts: DialogRunOptions = {},
): Promise<Result<PickedPath>> {
  const options = dialogOptions(name, input)
  if (!options) return fail({ code: 'INVALID_INPUT', message: 'Some values are not valid.' })
  try {
    const result = opts.window
      ? await dialog.showOpenDialog(opts.window, options)
      : await dialog.showOpenDialog(options)
    return ok({ path: result.canceled ? null : (result.filePaths[0] ?? null) })
  } catch (e) {
    const body = internalError(ulid())
    opts.log?.write({
      level: 'error',
      event: 'query',
      name,
      actor: 'user',
      ok: false,
      errorKind: 'INTERNAL',
      message: body.message,
      context: { commandId: body.details?.commandId, error: errorContext(e) },
    })
    return fail(body)
  }
}

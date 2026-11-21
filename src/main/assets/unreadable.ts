// SPEC 14, Slice A rulings point 6 and [1.27] A3-7: a file that is there but cannot be read.
// The reply names the file only; the operating system's code (EACCES, EBUSY, EIO) goes to
// one warn log line, with no path and no file name, because each code needs other help.
import type { ActivityLog } from '../log/activity-log'
import type { Actor } from '../../shared/schemas/events'
import { AppError } from '../../shared/schemas/result'

// The code is kept on the error itself; toBody() never sends it.
export class UnreadableFileError extends AppError {
  readonly osCode: string

  constructor(fileName: string, osCode: string | undefined) {
    super('RULE_VIOLATION', `${fileName} could not be read.`, { reason: 'file_not_readable' })
    this.osCode = osCode ?? 'unknown'
  }
}

// Runs a step that reads files and writes the warn line when one could not be read.
export async function logUnreadable<T>(
  log: ActivityLog,
  call: { command: string; actor: Actor },
  work: () => Promise<T>,
): Promise<T> {
  try {
    return await work()
  } catch (e) {
    if (e instanceof UnreadableFileError) {
      log.write({
        level: 'warn',
        event: 'asset',
        name: call.command,
        actor: call.actor,
        ok: false,
        message: `A file could not be read (${e.osCode}).`,
        context: { reason: 'file_not_readable', code: e.osCode },
      })
    }
    throw e
  }
}

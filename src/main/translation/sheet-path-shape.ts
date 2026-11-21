// The checks on the sheet path's shape alone (spec/phases/phase-06.md, design addition 4;
// P6-7b). Pure: the path module is passed in, so the Windows rules can be tested anywhere.
import path from 'node:path'
import { AppError } from '@/shared/schemas/result'

const notAPlace = () =>
  new AppError('RULE_VIOLATION', 'The sheet cannot be saved in that place.', {
    reason: 'unsupported_path',
  })

// On Windows: a path starting with two separators (a network share, \\?\ or \\.\), or a file
// name holding ':' (a hidden stream of another file), is not a place for the sheet.
function checkWindowsShape(filePath: string, p: path.PlatformPath) {
  if (/^[\\/]{2}/.test(filePath)) throw notAPlace()
  if (p.basename(filePath).includes(':')) throw notAPlace()
}

// Gives the resolved target.
export function checkSheetPathShape(filePath: string, p: path.PlatformPath = path): string {
  if (!p.isAbsolute(filePath)) {
    throw new AppError('INVALID_INPUT', 'The file path must be absolute.')
  }
  if (p.sep === '\\') checkWindowsShape(filePath, p)
  const target = p.resolve(filePath)
  if (!p.basename(target).toLowerCase().endsWith('.csv')) {
    throw new AppError('INVALID_INPUT', 'The sheet must be a .csv file.')
  }
  return target
}

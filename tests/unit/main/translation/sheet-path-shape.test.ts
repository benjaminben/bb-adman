// P6-7b: the pure checks on the sheet path's shape, for POSIX and Windows paths. path.win32 is
// passed in, so the Windows rows run on any machine.
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { checkSheetPathShape } from '@/main/translation/sheet-path-shape'
import { AppError } from '@/shared/schemas/result'

const ABSOLUTE = { code: 'INVALID_INPUT', message: 'The file path must be absolute.' }
const CSV = { code: 'INVALID_INPUT', message: 'The sheet must be a .csv file.' }
const PLACE = {
  code: 'RULE_VIOLATION',
  message: 'The sheet cannot be saved in that place.',
  details: { reason: 'unsupported_path' },
}

function refusal(filePath: string, p: path.PlatformPath) {
  try {
    checkSheetPathShape(filePath, p)
  } catch (e) {
    if (e instanceof AppError) return e.toBody()
    throw e
  }
  return null
}

describe('checkSheetPathShape [P6-7b]', () => {
  it.each([
    ['C:\\Users\\a\\sheet.csv', null],
    ['C:\\Users\\a\\Sheet.CSV', null],
    ['D:/out/sheet.csv', null],
    ['sheet.csv', ABSOLUTE],
    ['C:sheet.csv', ABSOLUTE],
    ['C:\\Users\\a\\sheet.txt', CSV],
    ['\\\\server\\share\\sheet.csv', PLACE],
    ['//server/share/sheet.csv', PLACE],
    ['\\\\?\\C:\\Users\\a\\sheet.csv', PLACE],
    ['\\\\.\\C:\\sheet.csv', PLACE],
    ['C:\\Users\\a\\b:c.csv', PLACE],
    ['C:\\Users\\a\\sheet.csv:hidden.csv', PLACE],
  ])('on Windows, %s gives %o', (filePath, expected) => {
    expect(refusal(filePath, path.win32)).toEqual(expected)
  })

  it.each([
    ['/Users/a/sheet.csv', null],
    ['/Users/a/b:c.csv', null],
    ['//Users/a/sheet.csv', null],
    ['sheet.csv', ABSOLUTE],
    ['/Users/a/sheet.txt', CSV],
  ])('on macOS and Linux, %s gives %o', (filePath, expected) => {
    expect(refusal(filePath, path.posix)).toEqual(expected)
  })

  it('gives the resolved target', () => {
    expect(checkSheetPathShape('/a/b/../sheet.csv', path.posix)).toBe('/a/sheet.csv')
  })
})

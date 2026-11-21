// P4-5 (spec/ai-jobs.md "A plain sentence per failure cause", OI-68; security class): the
// reason is decided from an AppError's code and details.reason alone.
import { describe, it, expect } from 'vitest'
import {
  appErrorEnd,
  errnoCode,
  readRefusalReason,
  writeFailureReason,
} from '@/main/jobs/local-failure'
import { AppError } from '@/shared/schemas/result'

const rule = (reason: string) => new AppError('RULE_VIOLATION', 'At /x/y.png', { reason })

describe('readRefusalReason [OI-68]', () => {
  it.each<[string, unknown, string | null]>([
    ['MISSING_FILE', new AppError('MISSING_FILE', 'm', { assetIds: ['a'] }), 'picture_missing'],
    ['NOT_FOUND', new AppError('NOT_FOUND', 'm'), 'picture_missing'],
    ['asset_too_large', rule('asset_too_large'), 'picture_too_large'],
    ['asset_not_a_picture', rule('asset_not_a_picture'), 'picture_changed'],
    ['picture_not_usable', rule('picture_not_usable'), 'picture_changed'],
    ['another rule', rule('jobs_running'), null],
    ['another code', new AppError('INVALID_INPUT', 'm', { reason: 'asset_too_large' }), null],
    ['not an AppError', new Error('MISSING_FILE asset_too_large'), null],
  ])('%s gives %s', (_, error, expected) => {
    expect(readRefusalReason(error)).toBe(expected)
  })
})

describe('writeFailureReason [OI-68]', () => {
  it.each<[string, unknown, string]>([
    ['the refused folder', rule('assets_folder_missing'), 'assets_folder_missing'],
    ['another rule', rule('jobs_running'), 'assets_not_writable'],
    [
      'a file-system error',
      Object.assign(new Error('x'), { code: 'EACCES' }),
      'assets_not_writable',
    ],
    ['a thrown string', 'assets_folder_missing', 'assets_not_writable'],
  ])('%s gives %s', (_, error, expected) => {
    expect(writeFailureReason(error)).toBe(expected)
  })
})

describe('appErrorEnd and errnoCode [OI-68]', () => {
  it('turns NEEDS_KEY into key_missing and any other AppError into app_error', () => {
    expect(appErrorEnd(new AppError('NEEDS_KEY', 'Add your key.'))).toEqual({
      reason: 'key_missing',
      detail: 'key_missing',
    })
    expect(appErrorEnd(new AppError('PROJECT_LOCKED', 'At /x'))).toEqual({
      reason: null,
      detail: 'app_error',
    })
  })

  it.each<[unknown, string | null]>([
    [Object.assign(new Error('x'), { code: 'EACCES' }), 'EACCES'],
    [Object.assign(new Error('x'), { code: '/Users/someone/file' }), null],
    [Object.assign(new Error('x'), { code: 13 }), null],
    [null, null],
    ['EACCES', null],
  ])('errnoCode of %o is %s', (error, expected) => {
    expect(errnoCode(error)).toBe(expected)
  })
})

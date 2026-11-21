import { describe, it, expect } from 'vitest'
import { storageError } from '../../../../../src/main/commands/dev/storage-error'
import { ProviderFailure } from '../../../../../src/main/providers/types'
import { REFUSED_PATH } from '../../../../../src/main/providers/storage-paths'
import { AppError } from '../../../../../src/shared/schemas/result'

const S3 = { id: 's3', label: 'Amazon S3' }

function failure(kind: ProviderFailure['error']['kind'], detail = 'raw detail text') {
  return new ProviderFailure({ kind, detail })
}

describe('storageError: how dev.storage reports a failure [SPEC 4.1, 6 plain messages]', () => {
  it.each([
    ['bad_key', 'Amazon S3 did not accept your key. Check it in Settings and try again.'],
    [
      'quota',
      'Your Amazon S3 account has reached its limit. Check your plan with Amazon S3, then try again.',
    ],
    [
      'refused',
      'Amazon S3 declined this request because of its content rules. Change the prompt or the images and try again.',
    ],
    ['timeout', 'Amazon S3 took too long to answer. Try again.'],
    [
      'offline',
      'The app could not reach Amazon S3. Check your internet connection and try again.',
    ],
    ['other', 'Amazon S3 could not finish this request. Try again.'],
  ] as const)('gives PROVIDER_ERROR with the plain message for %s', (kind, message) => {
    const error = storageError(failure(kind), S3)
    expect(error).toBeInstanceOf(AppError)
    expect((error as AppError).toBody()).toEqual({
      code: 'PROVIDER_ERROR',
      message,
      details: { provider: 's3', kind },
    })
  })

  it('never puts the raw detail in the reply', () => {
    const body = (storageError(failure('other', 'host s3.eu.example'), S3) as AppError).toBody()
    expect(JSON.stringify(body)).not.toContain('s3.eu.example')
  })

  it('gives INVALID_INPUT for a refused storage path, holding no path', () => {
    const body = (storageError(new Error(REFUSED_PATH), S3) as AppError).toBody()
    expect(body).toEqual({ code: 'INVALID_INPUT', message: 'That path cannot be used in storage.' })
  })

  it('passes any other error on unchanged', () => {
    const app = new AppError('NEEDS_KEY', 'Add your key.')
    const plain = new Error('unforeseen')
    expect(storageError(app, S3)).toBe(app)
    expect(storageError(plain, S3)).toBe(plain)
  })
})

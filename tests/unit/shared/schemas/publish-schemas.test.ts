// P9-1 (spec/phases/phase-09.md "Publishing", "Dropbox tokens"): the Phase 9 command and query
// inputs. One table: for each schema a good value, then each field changed to a value it must
// refuse.
import { describe, it, expect } from 'vitest'
import type { z } from 'zod'
import { PUBLISH_STORAGE_IDS, publishRunInput } from '@/shared/schemas/commands/publish'
import { publishInspectInput } from '@/shared/schemas/queries/publish'
import { storageSetDropboxFolderInput } from '@/shared/schemas/commands/storage'

const ids = { projectId: '01JD5Z8Q4N3V6W7X8Y9Z0ABCDE', campaignId: 'spring-sale-abc234' }
const run = { ...ids, storage: 'dropbox', replaceConfirmed: false, proceedDespiteWarnings: false }

const cases: Array<[string, z.ZodType, unknown, Array<[string, unknown]>]> = [
  [
    'publish.run',
    publishRunInput,
    { ...run, proceedReason: 'The client asked for it today.' },
    [
      ['a missing projectId', { ...run, projectId: undefined }],
      ['an empty campaignId', { ...run, campaignId: '' }],
      ['a storage outside the list', { ...run, storage: 'azure-blob' }],
      ['a null storage', { ...run, storage: null }],
      ['a missing replaceConfirmed', { ...run, replaceConfirmed: undefined }],
      ['a replaceConfirmed that is not a boolean', { ...run, replaceConfirmed: 'yes' }],
      ['a missing proceedDespiteWarnings', { ...run, proceedDespiteWarnings: undefined }],
      ['a proceedReason over 500 characters', { ...run, proceedReason: 'a'.repeat(501) }],
      ['a proceedReason with a control character', { ...run, proceedReason: 'a\u0007b' }],
      ['an unknown key', { ...run, extra: 1 }],
    ],
  ],
  [
    'publish.inspect',
    publishInspectInput,
    { ...ids, storage: null },
    [
      ['a missing projectId', { campaignId: ids.campaignId, storage: null }],
      ['a missing campaignId', { projectId: ids.projectId, storage: null }],
      ['a missing storage', ids],
      ['a storage outside the list', { ...ids, storage: 'local-storage' }],
      ['an unknown key', { ...ids, storage: 's3', extra: 1 }],
    ],
  ],
  [
    'storage.setDropboxFolder',
    storageSetDropboxFolderInput,
    { rootPath: 'Adman/Spring' },
    [
      ['a missing rootPath', {}],
      ['a rootPath over 200 characters', { rootPath: 'a'.repeat(201) }],
      ['a rootPath that is not text', { rootPath: 7 }],
      ['an unknown key', { rootPath: '', token: 'x' }],
    ],
  ],
]

describe('the Phase 9 inputs [P9-1]', () => {
  it.each(cases)('%s accepts a good value', (_name, schema, good) => {
    expect(schema.safeParse(good).success).toBe(true)
  })

  const refused = cases.flatMap(([name, schema, , bad]) =>
    bad.map(([what, value]): [string, string, z.ZodType, unknown] => [name, what, schema, value]),
  )
  it.each(refused)('%s refuses %s', (_name, _what, schema, value) => {
    expect(schema.safeParse(value).success).toBe(false)
  })

  it('offers exactly the three publish storages', () => {
    expect(PUBLISH_STORAGE_IDS).toEqual(['s3', 'dropbox', 'fake'])
    for (const storage of PUBLISH_STORAGE_IDS) {
      expect(publishRunInput.safeParse({ ...run, storage }).success).toBe(true)
      expect(publishInspectInput.safeParse({ ...ids, storage }).success).toBe(true)
    }
  })

  it('accepts a proceedReason of exactly 500 characters and none at all', () => {
    expect(publishRunInput.safeParse({ ...run, proceedReason: 'a'.repeat(500) }).success).toBe(true)
    expect(publishRunInput.safeParse(run).success).toBe(true)
  })

  it('trims the Dropbox folder and accepts an empty one', () => {
    expect(storageSetDropboxFolderInput.parse({ rootPath: '  Adman  ' })).toEqual({
      rootPath: 'Adman',
    })
    expect(storageSetDropboxFolderInput.parse({ rootPath: '' })).toEqual({ rootPath: '' })
  })
})

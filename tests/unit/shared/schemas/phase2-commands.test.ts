import { describe, it, expect } from 'vitest'
import {
  jobCancelInput,
  jobMarkSeenInput,
  jobRetryInput,
} from '../../../../src/shared/schemas/commands/job'
import { generationRunImagesInput } from '../../../../src/shared/schemas/commands/generation'
import {
  storageDropboxSignInInput,
  storageDropboxSignOutInput,
} from '../../../../src/shared/schemas/commands/storage'
import { devStorageInput } from '../../../../src/shared/schemas/commands/dev'
import { assetAddGeneratedInput } from '../../../../src/shared/schemas/commands/asset'
import { projectCloseInput } from '../../../../src/shared/schemas/commands/project'
import { jobListInput } from '../../../../src/shared/schemas/queries/job'

const P = { projectId: 'p1' }
const images = {
  ...P,
  variantId: 'v1',
  prompt: 'A bottle on a beach',
  referenceAssetIds: [],
  count: 2,
  provider: 'gemini',
}

describe('job command inputs [SPEC 4.2, 1.8]', () => {
  it('takes projectId and jobId for retry and cancel, and a list for markSeen', () => {
    expect(jobRetryInput.safeParse({ ...P, jobId: 'j1' }).success).toBe(true)
    expect(jobCancelInput.safeParse({ ...P }).success).toBe(false)
    expect(jobMarkSeenInput.safeParse({ ...P, jobIds: ['j1', 'j2'] }).success).toBe(true)
    expect(jobMarkSeenInput.safeParse({ ...P, jobIds: [] }).success).toBe(false)
  })
})

describe('generation.runImages input [SPEC 4.2]', () => {
  it('takes a slot or a layerId, not both and not neither', () => {
    expect(generationRunImagesInput.safeParse({ ...images, slot: 'background' }).success).toBe(true)
    expect(generationRunImagesInput.safeParse({ ...images, layerId: 'l1' }).success).toBe(true)
    expect(generationRunImagesInput.safeParse(images).success).toBe(false)
    expect(
      generationRunImagesInput.safeParse({ ...images, slot: 'logo', layerId: 'l1' }).success,
    ).toBe(false)
  })

  it('refuses a count below one', () => {
    expect(generationRunImagesInput.safeParse({ ...images, slot: 'x', count: 0 }).success).toBe(
      false,
    )
  })
})

describe('storage and dev inputs [SPEC 4.2]', () => {
  it('Dropbox sign-in and sign-out take nothing', () => {
    expect(storageDropboxSignInInput.safeParse({}).success).toBe(true)
    expect(storageDropboxSignOutInput.safeParse({ token: 'x' }).success).toBe(false)
  })

  it('dev.storage needs filePath for write only', () => {
    expect(devStorageInput.safeParse({ storage: 's3', action: 'list' }).success).toBe(true)
    expect(devStorageInput.safeParse({ storage: 'local', action: 'write' }).success).toBe(false)
    expect(
      devStorageInput.safeParse({ storage: 'dropbox', action: 'write', filePath: '/w/a.png' })
        .success,
    ).toBe(true)
    expect(devStorageInput.safeParse({ storage: 'azure-blob', action: 'list' }).success).toBe(false)
  })
})

describe('asset.addGenerated input [SPEC 4.2]', () => {
  it('holds asset IDs and extensions, no path and no contents', () => {
    const ok = { ...P, jobId: 'j1', files: [{ assetId: 'a1', ext: 'png' }] }
    expect(assetAddGeneratedInput.safeParse(ok).success).toBe(true)
    expect(
      assetAddGeneratedInput.safeParse({ ...ok, files: [{ assetId: 'a1', ext: '../x' }] }).success,
    ).toBe(false)
    expect(assetAddGeneratedInput.safeParse({ ...ok, files: [] }).success).toBe(false)
  })
})

describe('project.close runningJobs [SPEC 3.6, 4.2]', () => {
  it("defaults to 'refuse' and accepts 'stop'", () => {
    expect(projectCloseInput.parse(P)).toEqual({ ...P, runningJobs: 'refuse' })
    expect(projectCloseInput.parse({ ...P, runningJobs: 'stop' }).runningJobs).toBe('stop')
    expect(projectCloseInput.safeParse({ ...P, runningJobs: 'keep' }).success).toBe(false)
  })
})

describe('job.list input [SPEC 4.3]', () => {
  it('has optional filters and a limit of 200 by default', () => {
    expect(jobListInput.parse(P)).toEqual({ ...P, limit: 200 })
    expect(jobListInput.safeParse({ ...P, state: 'unseen', variantId: 'v1' }).success).toBe(true)
    expect(jobListInput.safeParse({ ...P, state: 'done' }).success).toBe(false)
  })
})

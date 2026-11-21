import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { s3Storage } from '../../../../../src/main/providers/s3/s3-storage'
import { failureFromS3Error } from '../../../../../src/main/providers/s3/failure'
import { ProviderFailure } from '../../../../../src/main/providers/types'
import { TEST_KEY_ID, TEST_SECRET, recordingHandler, testContext, xml } from './recorded'

const ORIGINAL_ENV = process.env
const STUBBED = [
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_SESSION_TOKEN',
  'AWS_REGION',
  'AWS_DEFAULT_REGION',
  'AWS_ENDPOINT_URL',
  'AWS_ENDPOINT_URL_S3',
  'AWS_USE_FIPS_ENDPOINT',
  'AWS_USE_DUALSTACK_ENDPOINT',
  'AWS_MAX_ATTEMPTS',
  'AWS_RETRY_MODE',
  'AWS_DEFAULTS_MODE',
  'AWS_S3_USE_ARN_REGION',
  'AWS_PROFILE',
  'AWS_CONFIG_FILE',
  'AWS_SHARED_CREDENTIALS_FILE',
]
const BEFORE: Record<string, string | undefined> = Object.fromEntries(
  STUBBED.map((name) => [name, process.env[name]]),
)
const folders: string[] = []
afterEach(() => {
  vi.unstubAllEnvs()
  for (const folder of folders.splice(0)) fs.rmSync(folder, { recursive: true, force: true })
})

// A made-up AWS config file in a temporary folder that points somewhere else.
function hostileConfigFile(): string {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-s3-env-'))
  folders.push(folder)
  const file = path.join(folder, 'config')
  fs.writeFileSync(
    file,
    [
      '[default]',
      'region = ap-southeast-2',
      'endpoint_url = https://config-file.example',
      'max_attempts = 7',
      'use_fips_endpoint = true',
      'aws_access_key_id = config-file-id-must-not-be-used',
      'aws_secret_access_key = config-file-secret-must-not-be-used',
      '',
    ].join('\n'),
  )
  return file
}

describe('S3 takes nothing from the environment [SPEC 6 1.12]', () => {
  it('goes to the pinned host, once, signed with the given keys, whatever AWS_* says', async () => {
    const config = hostileConfigFile()
    const hostile = {
      AWS_ACCESS_KEY_ID: 'environment-id-must-not-be-used',
      AWS_SECRET_ACCESS_KEY: 'environment-secret-must-not-be-used',
      AWS_SESSION_TOKEN: 'environment-token-must-not-be-used',
      AWS_REGION: 'us-east-2',
      AWS_DEFAULT_REGION: 'us-east-2',
      AWS_ENDPOINT_URL: 'https://environment.example',
      AWS_ENDPOINT_URL_S3: 'https://environment-s3.example',
      AWS_USE_FIPS_ENDPOINT: 'true',
      AWS_USE_DUALSTACK_ENDPOINT: 'true',
      AWS_MAX_ATTEMPTS: '5',
      AWS_RETRY_MODE: 'adaptive',
      AWS_DEFAULTS_MODE: 'mobile',
      AWS_S3_USE_ARN_REGION: 'true',
      AWS_PROFILE: 'default',
      AWS_CONFIG_FILE: config,
      AWS_SHARED_CREDENTIALS_FILE: config,
    }
    for (const [name, value] of Object.entries(hostile)) vi.stubEnv(name, value)
    const { seen, requestHandler } = recordingHandler(() => xml('error-internal.xml', 500))
    const call = s3Storage(testContext(), { requestHandler }).read('a.txt')
    await expect(call).rejects.toBeInstanceOf(ProviderFailure)
    expect(seen).toHaveLength(1)
    const request = seen[0]
    expect(request?.hostname).toBe('made-up-bucket.s3.eu-west-1.amazonaws.com')
    expect(request?.headers.authorization).toContain(`Credential=${TEST_KEY_ID}/`)
    expect(request?.headers.authorization).toContain('/eu-west-1/s3/aws4_request')
    expect(request?.headers['x-amz-security-token']).toBeUndefined()
  })

  it('puts back every variable the test above set [SPEC 14 H15]', () => {
    expect(process.env).toBe(ORIGINAL_ENV)
    for (const name of STUBBED) expect(process.env[name]).toBe(BEFORE[name])
  })
})

describe('S3 lets out only ProviderFailure [SPEC 6 1.12]', () => {
  it('a secret that cannot be read is a ProviderFailure of kind other', () => {
    const ctx = testContext()
    const broken = {
      ...ctx,
      secret: () => {
        throw new Error('Secret not saved: s3.secretAccessKey')
      },
    }
    expect(() => s3Storage(broken)).toThrow(
      expect.objectContaining({ error: expect.objectContaining({ kind: 'other' }) }),
    )
  })

  it.each([
    ['a region that is not an AWS region name', 'eu-west-1.evil.example', 'made-up-bucket'],
    ['a bucket that is not an S3 bucket name', 'eu-west-1', 'bucket/../x'],
  ])('%s is a ProviderFailure of kind other', (_case, region, bucket) => {
    const ctx = testContext()
    const settings = { storage: { s3: { bucket, region, prefix: '' }, dropbox: null } }
    const odd = { ...ctx, settings: () => settings as ReturnType<typeof ctx.settings> }
    expect(() => s3Storage(odd)).toThrow(
      expect.objectContaining({ error: expect.objectContaining({ kind: 'other' }) }),
    )
  })

  it('an error with a network code that the network call did not throw is other', () => {
    const plain = Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' })
    expect(failureFromS3Error(plain, []).error.kind).toBe('other')
    expect(failureFromS3Error(new TypeError('x is not a function'), []).error.kind).toBe('other')
  })

  it('removes each key as given, URL-encoded and in base64 from a detail', () => {
    const secret = `${TEST_SECRET}/+=`
    const text = `${secret} ${encodeURIComponent(secret)} ${Buffer.from(secret).toString('base64')}`
    const failure = failureFromS3Error(new Error(text), [secret])
    expect(failure.error.detail).toBe('Error: [key removed] [key removed] [key removed]')
  })
})

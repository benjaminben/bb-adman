// storage.checkS3 (spec/storage-and-publish.md "Test connection (S3)"): the context the check
// gets reads only the two S3 keys, never another saved key (security review L-1).
import { describe, it, expect } from 'vitest'
import { storageCheckS3 } from '@/main/commands/storage/check-s3'
import type { CoreDeps } from '@/main/core-deps'
import type { AdapterContext } from '@/main/providers/types'

const SAVED: Record<string, string> = {
  's3.accessKeyId': 'made-up-s3-key-id-0001',
  's3.secretAccessKey': 'made-up-s3-secret-0001',
  'gemini.apiKey': 'made-up-gemini-key-0001',
}

function fakeDeps() {
  const deps = {
    providers: [
      { id: 's3', label: 'Amazon S3', secrets: ['s3.accessKeyId', 's3.secretAccessKey'] },
    ],
    secrets: { get: (name: string) => SAVED[name] },
    settings: {
      get: () => ({
        storage: { s3: { bucket: 'made-up-bucket', region: 'eu-west-1', prefix: '' } },
      }),
    },
    log: { write: () => {} },
  }
  return deps as unknown as Pick<CoreDeps, 'providers' | 'secrets' | 'settings' | 'log'>
}

describe('storage.checkS3: the check reads only the S3 keys [review L-1]', () => {
  it('gives the two S3 keys and refuses another saved key without its value', async () => {
    let s3Keys: string[] = []
    let refusal: unknown
    const check = async (ctx: AdapterContext) => {
      s3Keys = [ctx.secret('s3.accessKeyId'), ctx.secret('s3.secretAccessKey')]
      try {
        ctx.secret('gemini.apiKey')
      } catch (error) {
        refusal = error
      }
      return { ok: true as const }
    }
    const command = storageCheckS3(fakeDeps(), check)
    await command.run({ actor: 'user', commandId: 'c1' } as never, {} as never)
    expect(s3Keys).toEqual([SAVED['s3.accessKeyId'], SAVED['s3.secretAccessKey']])
    expect(refusal).toBeInstanceOf(Error)
    const text = `${String(refusal)} ${JSON.stringify(refusal)}`
    for (const value of Object.values(SAVED)) expect(text).not.toContain(value)
  })
})

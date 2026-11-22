// "Test connection" for Amazon S3 (spec/storage-and-publish.md "Test connection (S3)"). Sends
// storage.checkS3 only on the user's click, and gives "Connected" with the main process's
// sentence or the refusal's one sentence. Disabled until a bucket and a region are saved; keys
// are not needed to press it (a missing key gives the NEEDS_KEY sentence). A result belongs to
// the saved S3 settings and keys it was made with: when they change, it is gone.
import { useState } from 'react'
import { useApp, EMPTY } from '@/renderer/app/app-context'
import { S3_CONNECTED_MESSAGE } from '@/shared/schemas/commands/storage-check'
import type { CheckResult } from './check-mark'

const S3_KEYS = new Set(['s3.accessKeyId', 's3.secretAccessKey'])

type Run = { made: string; testing: boolean; result: CheckResult | null }

export function useS3Check() {
  const command = useApp((s) => s.command)
  const saved = useApp((s) => s.app?.settings.storage.s3 ?? null)
  const secrets = useApp((s) => s.app?.secrets ?? EMPTY)
  const keys = secrets.filter((secret) => S3_KEYS.has(secret.name))
  const made = JSON.stringify([saved, keys])
  const [run, setRun] = useState<Run | null>(null)
  const current = run?.made === made ? run : null

  async function test() {
    setRun({ made, testing: true, result: null })
    const reply = await command('storage.checkS3', {})
    const sentence = reply.ok ? S3_CONNECTED_MESSAGE : reply.error.message
    setRun({ made, testing: false, result: { ok: reply.ok, sentence } })
  }

  return {
    setUp: saved !== null && saved.bucket !== '' && saved.region !== '',
    testing: current?.testing ?? false,
    result: current?.result ?? null,
    test: () => void test(),
  }
}

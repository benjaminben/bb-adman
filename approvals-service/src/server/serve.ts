import 'server-only'
// spec/approvals-service.md "How Next.js and the service code fit": the catch-all hands the
// request, unchanged, to the reviewed router. Its own path regexes decide what a request is.
import { createApp, type Parts } from '../app'
import { cryptoBytes } from '../crypto/random'
import { s3ClipSource } from '../pictures/s3-clip-source'
import type { Env } from '../env'
import { loadEnv } from './env'

// The environment is made per request, so the clip source that reads it is too.
const liveParts = (env: Env): Parts => ({
  now: () => Date.now(),
  random: cryptoBytes,
  clips: s3ClipSource(env),
})

export function serve(request: Request): Promise<Response> {
  const env = loadEnv()
  return createApp(env, liveParts(env)).fetch(request)
}

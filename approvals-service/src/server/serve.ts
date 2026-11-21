import 'server-only'
// spec/approvals-service.md "How Next.js and the service code fit": the catch-all hands the
// request, unchanged, to the reviewed router. Its own path regexes decide what a request is.
import { createApp, type Parts } from '../app'
import { cryptoBytes } from '../crypto/random'
import { loadEnv } from './env'

const liveParts: Parts = { now: () => Date.now(), random: cryptoBytes }

export function serve(request: Request): Promise<Response> {
  return createApp(loadEnv(), liveParts).fetch(request)
}

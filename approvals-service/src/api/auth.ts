// Checks 1 to 3 of every API request (spec/approvals-service.md "The keyed API"), before
// anything else of the request is read.
import { sameSecret } from '../crypto/compare'
import { apiKeyOf, type Env } from '../env'
import { apiError } from './errors'

const BEARER = 'Bearer '

// A refusal, or null when the request may go on.
export async function checkKey(request: Request, env: Env): Promise<Response | null> {
  // 1. A browser page has no business here.
  if (request.headers.has('Origin')) return apiError(403, 'bad_request')
  // 2. No usable key in the environment: the service is not set up.
  const key = apiKeyOf(env)
  if (key === null) return apiError(503, 'not_set_up')
  // 3. Exactly "Bearer {key}". A missing or malformed header compares an empty text, so all
  // three cases take the same timing-safe path and get the same refusal.
  const header = request.headers.get('Authorization') ?? ''
  const given = header.startsWith(BEARER) ? header.slice(BEARER.length) : ''
  const same = await sameSecret(given, key)
  return same ? null : apiError(401, 'bad_key')
}

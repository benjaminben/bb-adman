// checkPictureUrl (spec/approvals-service.md "Pictures"): the one guard on a picture address,
// used when the API stores one and again before every fetch. The contract checks only that the
// text is a URL of at most 2,048 characters.
import { testPictureOriginOf, type Env } from '../env'

// A bucket's own host, and the path style: the two forms the app's S3 client makes.
const BUCKET_HOST = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]\.s3\.[a-z0-9-]+\.amazonaws\.com$/
const PATH_HOST = /^s3\.[a-z0-9-]+\.amazonaws\.com$/

function parse(text: string): URL | null {
  try {
    return new URL(text)
  } catch {
    return null
  }
}

export function checkPictureUrl(text: string, env: Env): boolean {
  const url = parse(text)
  if (url === null || url.username !== '' || url.password !== '') return false
  const testOrigin = testPictureOriginOf(env)
  if (testOrigin !== null && url.origin === testOrigin) return true
  // The parser lower-cases the host and drops port 443 for https, so an empty port means
  // "no port, or 443".
  if (url.protocol !== 'https:' || url.port !== '') return false
  return BUCKET_HOST.test(url.hostname) || PATH_HOST.test(url.hostname)
}

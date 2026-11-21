// The MCP access token (SPEC 5.1, 5.3): 32 random bytes in base64url, compared in
// constant time. Neither function logs or returns the token.
import crypto from 'node:crypto'

const PREFIX = 'Bearer '

export function makeToken(): string {
  return crypto.randomBytes(32).toString('base64url')
}

const digest = (text: string): Buffer => crypto.createHash('sha256').update(text, 'utf8').digest()

// Both sides are hashed first, so the comparison takes the same time whatever the length
// of the text the caller sent.
export function bearerMatches(header: string | undefined, token: string | null): boolean {
  const sent = header?.startsWith(PREFIX) ? header.slice(PREFIX.length) : ''
  const same = crypto.timingSafeEqual(digest(sent), digest(token ?? ''))
  return same && sent.length > 0 && Boolean(token)
}

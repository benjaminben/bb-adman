// The PKCE values of one Dropbox sign-in (spec/phases/phase-09.md "The sign-in redirect").
// Verifier: 64 random bytes, base64url (86 characters). Challenge: its SHA-256, base64url
// (method S256). state: 32 random bytes, base64url. The values stay in memory: this module
// logs nothing and puts none of them in an error.
import crypto from 'node:crypto'

export type Pkce = { verifier: string; challenge: string; state: string }

// Tests hand in their own bytes; the app uses the system's secure random source.
export type ByteSource = (size: number) => Buffer

export function challengeFor(verifier: string): string {
  return crypto.createHash('sha256').update(verifier, 'ascii').digest('base64url')
}

export function makePkce(source: ByteSource = (size) => crypto.randomBytes(size)): Pkce {
  const verifier = source(64).toString('base64url')
  const state = source(32).toString('base64url')
  return { verifier, challenge: challengeFor(verifier), state }
}

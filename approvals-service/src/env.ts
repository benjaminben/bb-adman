// The Worker's environment (spec/approvals-service.md "What it is"). API_KEY is a secret set
// with Wrangler when deploying; it is never written into wrangler.jsonc.

export type Env = {
  DB: D1Database
  API_KEY?: string
}

export const API_KEY_MIN_LENGTH = 32

// The key, or null when it is missing or too short to be safe: the service is then not set up.
export function apiKeyOf(env: Env): string | null {
  const key = env.API_KEY
  return typeof key === 'string' && key.length >= API_KEY_MIN_LENGTH ? key : null
}

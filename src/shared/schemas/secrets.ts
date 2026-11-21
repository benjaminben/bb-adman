import { z } from 'zod'

// SPEC 7.7 secret names. mcp.token is created and replaced by the MCP commands
// (SPEC 5.1), so secret.set and secret.delete accept only the user keys.
export const SECRET_NAMES = [
  'gemini.apiKey',
  'fal.apiKey',
  'firefly.clientId',
  'firefly.clientSecret',
  's3.accessKeyId',
  's3.secretAccessKey',
  'dropbox.refreshToken',
  'approvals.apiKey',
  'mcp.token',
] as const
export type SecretName = (typeof SECRET_NAMES)[number]

export const USER_SECRET_NAMES = SECRET_NAMES.filter((n) => n !== 'mcp.token')
export const userSecretName = z.enum(USER_SECRET_NAMES as [SecretName, ...SecretName[]])

export const secretSetInput = z.object({
  name: userSecretName,
  value: z.string().trim().min(1, 'Enter a key.'),
})
export const secretDeleteInput = z.object({ name: userSecretName })

export type SecretSummary = { name: SecretName; lastFour: string }

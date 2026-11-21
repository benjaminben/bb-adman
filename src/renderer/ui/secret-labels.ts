import type { SecretName } from '@/shared/schemas/secrets'

const LABELS: Record<string, string> = {
  apiKey: 'API key',
  clientId: 'Client ID',
  clientSecret: 'Client secret',
  accessKeyId: 'Access key ID',
  secretAccessKey: 'Secret access key',
  refreshToken: 'Refresh token',
  token: 'Token',
}

// "gemini.apiKey" -> "API key"
export function secretLabel(name: SecretName): string {
  const field = name.split('.')[1] ?? name
  return LABELS[field] ?? field
}

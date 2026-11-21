// SPEC 6 [1.12]: the one function that removes a secret from text. Every adapter passes every
// `detail` through it for each secret it read. It removes the secret as given, its
// encodeURIComponent form and its base64 form.
const REMOVED = '[key removed]'

export function redactSecret(text: string, secret: string): string {
  if (secret === '') return text
  const forms = [secret, encodeURIComponent(secret), Buffer.from(secret).toString('base64')]
  let safe = text
  for (const form of forms) safe = safe.split(form).join(REMOVED)
  return safe
}

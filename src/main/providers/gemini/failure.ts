// SPEC 6, 6.2: every Gemini failure becomes one ProviderFailure with an error kind.
// 401/403, or 400 with reason API_KEY_INVALID → bad_key; 429 → quota; content rules →
// refused; no answer in time → timeout; a network error marked by the fetch wrapper → offline
// (SPEC 6 [1.12]); anything else → other.
// The key never appears in `detail`.
import { ApiError, type GenerateContentResponse } from '@google/genai'
import { pictureType, type PictureType } from '../picture-type'
import { redactSecret } from '../redact'
import { ProviderFailure, type ProviderError } from '../types'
import { isNetworkError } from './pinned-origin'

// Finish reasons that mean the provider's content rules stopped the picture (SPEC 6.2 [1.11]).
const REFUSED_FINISH = new Set([
  'SAFETY',
  'IMAGE_SAFETY',
  'PROHIBITED_CONTENT',
  'IMAGE_PROHIBITED_CONTENT',
  'BLOCKLIST',
  'SPII',
  'RECITATION',
])

function fail(kind: ProviderError['kind'], detail: string, key: string): ProviderFailure {
  return new ProviderFailure({ kind, detail: redactSecret(detail, key) })
}

// The SDK puts the JSON error body in the message. A wrong key is HTTP 400 with an
// ErrorInfo detail whose reason is API_KEY_INVALID.
function isInvalidKey(message: string): boolean {
  try {
    const body = JSON.parse(message) as { error?: { details?: Array<{ reason?: unknown }> } }
    return body.error?.details?.some((d) => d.reason === 'API_KEY_INVALID') ?? false
  } catch {
    return false
  }
}

function kindForStatus(status: number, message: string): ProviderError['kind'] {
  if (status === 401 || status === 403) return 'bad_key'
  if (status === 400 && isInvalidKey(message)) return 'bad_key'
  if (status === 429) return 'quota'
  return 'other'
}

// A thrown error from the SDK or from fetch. `timedOut` is true when our own timer fired.
export function failureFromError(error: unknown, timedOut: boolean, key: string): ProviderFailure {
  if (timedOut) return fail('timeout', 'No answer within the time limit', key)
  if (error instanceof ApiError) {
    return fail(
      kindForStatus(error.status, error.message),
      `HTTP ${error.status}: ${error.message}`,
      key,
    )
  }
  if (isNetworkError(error)) return fail('offline', error.message, key)
  return fail('other', error instanceof Error ? error.message : String(error), key)
}

// The picture in a successful HTTP answer, PNG or JPEG as it came (SPEC 6.2 [1.18]), or the
// failure the answer describes.
export function pictureFromResponse(
  response: GenerateContentResponse,
  key: string,
): { bytes: Uint8Array; mime: PictureType } {
  const blocked = response.promptFeedback?.blockReason
  if (blocked) throw fail('refused', `Prompt blocked: ${blocked}`, key)
  const candidate = response.candidates?.[0]
  const finish = candidate?.finishReason ?? 'none'
  if (REFUSED_FINISH.has(finish)) throw fail('refused', `Picture stopped: ${finish}`, key)
  const image = candidate?.content?.parts?.find((part) =>
    part.inlineData?.mimeType?.startsWith('image/'),
  )?.inlineData
  if (!image?.data) throw fail('other', `No picture in the answer (finish: ${finish})`, key)
  const bytes = new Uint8Array(Buffer.from(image.data, 'base64'))
  const mime = pictureType(bytes)
  if (!mime) throw fail('other', `Picture is not a PNG or JPEG (type: ${image.mimeType})`, key)
  return { bytes, mime }
}

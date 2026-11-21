// spec/approvals-service.md "Forms that write": the checks every POST under /l/ passes before
// anything is read or written.
import { pageReply } from './headers'
import { documentOf, html } from './html'

const REFUSED = 'This form could not be sent. Open the link again and try once more.'

export const FORM_LIMIT = 8 * 1024

const FORM_TYPE = 'application/x-www-form-urlencoded'

// Checks 1 and 2: the form was sent from a page of this service.
function sameOrigin(request: Request): boolean {
  if (request.headers.get('Origin') !== new URL(request.url).origin) return false
  const site = request.headers.get('Sec-Fetch-Site')
  return site === null || site === 'same-origin'
}

function isForm(request: Request): boolean {
  const type = request.headers.get('Content-Type') ?? ''
  return type.split(';')[0]?.trim().toLowerCase() === FORM_TYPE
}

// The body's text, or null once it passes the limit (the rest is never read), so a missing or
// false Content-Length cannot get past it.
async function readCapped(request: Request): Promise<string | null> {
  if (Number(request.headers.get('Content-Length') ?? 0) > FORM_LIMIT) return null
  if (request.body === null) return ''
  const reader = request.body.getReader()
  const decoder = new TextDecoder()
  let size = 0
  let text = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > FORM_LIMIT) {
      await reader.cancel()
      return null
    }
    text += decoder.decode(value, { stream: true })
  }
  return text + decoder.decode()
}

// Checks 1 to 3, in order. The fields, or null for the 403 reply. Check 4 (the session) is the
// route's, since /enter has none.
export async function readForm(request: Request): Promise<URLSearchParams | null> {
  if (!sameOrigin(request) || !isForm(request)) return null
  const text = await readCapped(request)
  return text === null ? null : new URLSearchParams(text)
}

export function refused(request: Request): Response {
  const page = documentOf(
    'Review campaign',
    html`<h1>Review campaign</h1>
      <p>${REFUSED}</p>`,
  )
  return pageReply(request, page, 403)
}

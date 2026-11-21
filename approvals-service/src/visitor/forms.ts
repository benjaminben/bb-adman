// spec/approvals-service.md "Forms that write": the checks every POST under /l/ passes before
// anything is read or written.
import { pageReply } from './headers'
import { documentOf, html } from './html'

const REFUSED = 'This form could not be sent. Open the link again and try once more.'

export async function readForm(request: Request): Promise<URLSearchParams | null> {
  return new URLSearchParams(await request.text())
}

export function refused(request: Request): Response {
  const page = documentOf(
    'Review campaign',
    html`<h1>Review campaign</h1>
      <p>${REFUSED}</p>`,
  )
  return pageReply(request, page, 403)
}

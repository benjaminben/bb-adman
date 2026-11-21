// spec/approvals-service.md "The pages": the gallery page.
import type { LinkRow } from '../db/links'
import { documentOf, html } from './html'

export function galleryPage(link: LinkRow) {
  return documentOf(
    link.campaignName,
    html`<h1>${link.campaignName}</h1>
      <form method="post" action="/l/${link.slug}/leave">
        <button type="submit">Leave</button>
      </form>`,
  )
}

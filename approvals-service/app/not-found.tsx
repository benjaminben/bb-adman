// spec/approvals-gallery.md "Routes": drawn only if the proxy were skipped and the page met a slug
// of the wrong shape.
import { PageShell } from '../src/ui/page-shell/page-shell'

export default function NotFound() {
  return (
    <PageShell>
      <title>Not found</title>
      <p>Not found.</p>
    </PageShell>
  )
}

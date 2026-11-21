'use client'
// spec/approvals-gallery.md "Routes": the boundary for a failure in the layout itself. It replaces
// the whole document, shows one fixed sentence and never reads the error it is given.
import { PageShell } from '../src/ui/page-shell/page-shell'

export default function GlobalError(_props: { error: Error & { digest?: string } }) {
  return (
    <html lang="en">
      <body>
        <PageShell>
          <title>Something went wrong</title>
          <p>Something went wrong. Try again later.</p>
        </PageShell>
      </body>
    </html>
  )
}

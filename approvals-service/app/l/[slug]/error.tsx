'use client'
// spec/approvals-gallery.md "Routes": Next.js requires an error boundary to be a client component.
// It shows one fixed sentence and never reads the error it is given.
import { PageShell } from '../../../src/ui/page-shell/page-shell'

export default function PageError(_props: { error: Error & { digest?: string } }) {
  return (
    <PageShell>
      <title>Something went wrong</title>
      <p>Something went wrong. Try again later.</p>
    </PageShell>
  )
}

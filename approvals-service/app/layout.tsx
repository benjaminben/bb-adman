// spec/approvals-gallery.md "Look and structure": the document of every page. The app's tokens,
// the gallery's tokens and base.css are the only global stylesheets, in that order
// (spec/phases/round-2-approvals.md "Where the look comes from"). Every page renders per
// request: nothing about a link is built ahead.
import type { ReactNode } from 'react'
import '../src/ui/app-tokens.css'
import '../src/ui/gallery-tokens.css'
import '../src/ui/base.css'

export const dynamic = 'force-dynamic'

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="referrer" content="same-origin" />
        <meta name="robots" content="noindex, nofollow" />
      </head>
      <body>{children}</body>
    </html>
  )
}

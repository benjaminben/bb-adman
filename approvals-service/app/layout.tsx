// spec/approvals-gallery.md "Look and structure": the document of every page. The tokens are the
// one global stylesheet. Every page renders per request: nothing about a link is built ahead.
import type { ReactNode } from 'react'
import '../src/ui/tokens.css'

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

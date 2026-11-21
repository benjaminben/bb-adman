// The bare document `next build` needs (spec/phases/approvals.md AP-14). AP-16 fills it.
import type { ReactNode } from 'react'

export const dynamic = 'force-dynamic'

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

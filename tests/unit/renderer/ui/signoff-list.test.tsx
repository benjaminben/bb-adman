// spec/approvals.md "The campaign page", the sign-off list: one line per sign-off, newest
// first, "{email} · {date and time}", "· for an earlier version" for an older one. Emails are
// text from the service, drawn as text.
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SignoffList, timeText } from '@/renderer/ui/signoff-list'
import type { ApprovalsSignoff } from '@/shared/schemas/queries/approvals'
import { axeViolations } from '../render'

const OLD: ApprovalsSignoff = {
  id: 's1',
  email: 'ben@example.com',
  signedAt: '2026-11-18T11:00:00.000Z',
  version: 3,
}
const NEW: ApprovalsSignoff = {
  id: 's2',
  email: 'ana@example.com',
  signedAt: '2026-11-19T10:00:00.000Z',
  version: 4,
}

describe('sign-off list [spec/approvals.md "Sign-off list"]', () => {
  it('draws one line per sign-off, newest first, with the earlier-version line', async () => {
    render(
      <main>
        <SignoffList label="Sign-offs for Square post" signoffs={[OLD, NEW]} />
      </main>,
    )
    const lines = screen.getAllByRole('listitem').map((li) => li.textContent)
    expect(lines).toEqual([
      `ana@example.com · ${timeText(NEW.signedAt)}`,
      `ben@example.com · ${timeText(OLD.signedAt)}`,
    ])
    expect(screen.getByRole('list', { name: 'Sign-offs for Square post' })).toBeInTheDocument()
    expect(await axeViolations()).toEqual([])
  })

  it('draws an email holding markup as text', () => {
    const email = '<b>bold</b>@example.com'
    const { container } = render(<SignoffList label="Sign-offs" signoffs={[{ ...NEW, email }]} />)
    expect(container.querySelector('b')).toBeNull()
    expect(screen.getByRole('listitem')).toHaveTextContent(email)
  })

  it('writes a time as a local date and time', () => {
    expect(timeText(NEW.signedAt)).toBe(
      new Date(NEW.signedAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    )
  })
})

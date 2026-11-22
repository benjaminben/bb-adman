// AP-12 (spec/approvals.md "The campaign page", tile marks): under each tile, outside its
// button, the marks of approvalMarks and, when the variant has sign-offs, a "Sign-offs ({n})"
// toggle (aria-expanded) showing the sign-off list. Emails are drawn as text.
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ApprovalMark, approvalFooter } from '@/renderer/screens/campaign/approval-mark'
import { VariantGrid } from '@/renderer/screens/campaign/variant-grid'
import { timeText } from '@/renderer/ui/signoff-list'
import type { ApprovalsVariant } from '@/shared/schemas/queries/approvals'
import { axeViolations } from '../../render'
import { VARIANTS, endedLink, forCampaign } from '../../stores/approvals-fixture'
import { variant } from './campaign-fixture'

const [SIGNED, CHANGED, OUTSIDE] = VARIANTS as [
  ApprovalsVariant,
  ApprovalsVariant,
  ApprovalsVariant,
]

const draw = (entry: ApprovalsVariant | undefined, linkState: 'live' | 'ended' | null = 'live') =>
  render(
    <main>
      <ApprovalMark title="Square post" entry={entry} linkState={linkState} />
    </main>,
  )

describe('ApprovalMark [AP-12]', () => {
  it.each([
    ['signed off', SIGNED, ['Signed off by 1']],
    ['changed since published', CHANGED, ['Changed since published']],
    ['not in the gallery', OUTSIDE, ['Not in the gallery']],
  ])('draws the marks of a variant %s', (_name, entry, marks) => {
    draw(entry)
    const group = screen.getByRole('group', { name: 'Approval marks for Square post' })
    for (const mark of marks) expect(within(group).getByTitle(mark)).toBeInTheDocument()
  })

  it('draws nothing with no link', () => {
    const { container } = draw(SIGNED, null)
    expect(container.querySelector('main')).toBeEmptyDOMElement()
  })

  it('draws no toggle for a variant with no sign-offs', () => {
    draw(CHANGED)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('opens and closes the sign-off list with the toggle', async () => {
    draw(SIGNED)
    const toggle = screen.getByRole('button', { name: 'Signed off by 1' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('list', { name: 'Sign-offs for Square post' })).toBeNull()
    await userEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const list = screen.getByRole('list', { name: 'Sign-offs for Square post' })
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual([`ana@example.com · ${timeText('2026-11-19T10:00:00.000Z')}`])
    await userEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('list', { name: 'Sign-offs for Square post' })).toBeNull()
  })

  it('draws an email holding markup as text', async () => {
    const email = '<b>bold</b>@example.com'
    const signoffs = SIGNED.signoffs.map((s) => ({ ...s, email }))
    const { container } = draw({ ...SIGNED, signoffs })
    await userEvent.click(screen.getByRole('button', { name: 'Signed off by 1' }))
    expect(container.querySelector('b')).toBeNull()
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent(email)
  })

  it('has no accessibility violations, closed and open', async () => {
    draw(SIGNED)
    expect(await axeViolations()).toEqual([])
    await userEvent.click(screen.getByRole('button', { name: 'Signed off by 1' }))
    expect(await axeViolations()).toEqual([])
  })
})

describe('approvalFooter [AP-12]', () => {
  it('gives no footer before the first read', () => {
    expect(approvalFooter(null)).toBeUndefined()
  })

  it('draws 30 marks for 30 variants, each under its tile', () => {
    const tiles = Array.from({ length: 30 }, (_, i) => variant(`v${i}`, { title: `Post ${i}` }))
    const rows = tiles.map((t) => ({ ...SIGNED, variantId: t.id }))
    render(
      <VariantGrid
        variants={tiles}
        chosenId={null}
        onChoose={() => {}}
        tileFooter={approvalFooter(forCampaign({ variants: rows }))}
      />,
    )
    const items = [...document.querySelectorAll<HTMLElement>('[data-variant]')]
    const marked = items.filter((li) => within(li).queryByTitle('Signed off by 1') !== null)
    expect(marked).toHaveLength(30)
    expect(screen.getAllByRole('button', { name: 'Signed off by 1' })).toHaveLength(30)
    expect(screen.getByRole('group', { name: 'Approval marks for Post 29' })).toBeInTheDocument()
  })

  it('keeps the sign-off marks after the link ends', () => {
    const footer = approvalFooter(forCampaign({ link: endedLink() }))!
    render(<>{footer(variant('v1', { title: 'Square post' }))}</>)
    expect(screen.getByTitle('Signed off by 1')).toBeInTheDocument()
  })
})

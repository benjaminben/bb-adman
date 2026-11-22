// ST-11 (spec/app-style.md, "Campaign page, grid and tiles"): the approval marks take the tile
// marks' badge piece, each with an icon hidden from assistive tech; their words do not change.
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ApprovalMark } from '@/renderer/screens/campaign/approval-mark'
import type { ApprovalsVariant } from '@/shared/schemas/queries/approvals'
import { VARIANTS } from '../../stores/approvals-fixture'

const [SIGNED, CHANGED, OUTSIDE] = VARIANTS as [
  ApprovalsVariant,
  ApprovalsVariant,
  ApprovalsVariant,
]

describe('approval marks look [ST-11]', () => {
  it.each([
    ['Signed off by 1', SIGNED],
    ['Changed since published', CHANGED],
    ['Not in the gallery', OUTSIDE],
  ])('draws "%s" with an aria-hidden icon and its words unchanged', (word, entry) => {
    render(<ApprovalMark title="Square post" entry={entry} linkState="live" />)
    const group = screen.getByRole('group', { name: 'Approval marks for Square post' })
    const mark = within(group).getByText(word)
    expect(mark.textContent).toBe(word)
    expect(mark.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })
})

// DLG-7 (spec/phases/design-wave-screens-b.md, "DLG-7 — Review dialogs"): quick look uses
// kind="review"; "Previous" and "Next" are icon buttons on the picture's sides, the count reads
// "{i} / {n}", and "Drawing the variant…" is a spinner with the same words as a hidden status.
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { QuickLook } from '@/renderer/dialogs/quick-look'
import { axeViolations } from '../render'
import { MASTER, P, campaignApi, renderWith, variant } from '../screens/campaign/campaign-fixture'

const VARIANTS = [MASTER, variant('V2', { title: 'Tide post', language: 'de' })]

async function draw(drawn: boolean) {
  const fake = campaignApi()
  fake.onQuery('variant.render', () =>
    drawn
      ? { ok: true, data: { png: new Uint8Array([1]), width: 1024, height: 1024, rev: 1 } }
      : new Promise(() => {}),
  )
  await renderWith(
    <QuickLook projectId={P} variants={VARIANTS} startId="V1" onClose={() => {}} />,
    fake,
  )
  return screen.getByRole('dialog')
}

describe('quick look as a review dialog [DLG-7]', () => {
  it('has icon buttons "Previous" and "Next" with their names as tooltips, and "{i} / {n}"', async () => {
    const dialog = await draw(true)
    const previous = within(dialog).getByRole('button', { name: 'Previous' })
    const next = within(dialog).getByRole('button', { name: 'Next' })
    expect(previous).toHaveAttribute('title', 'Previous')
    expect(next).toHaveAttribute('title', 'Next')
    expect(previous).not.toHaveTextContent('Previous')
    expect(within(dialog).getByText('1 / 2')).toBeVisible()
    await userEvent.click(next)
    expect(within(dialog).getByText('2 / 2')).toBeVisible()
    expect(within(dialog).getByRole('heading')).toHaveTextContent('Tide post · 1:1 · de')
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeVisible()
    expect(await axeViolations()).toEqual([])
  })

  it('shows a spinner with "Drawing the variant…" as a hidden status while it draws', async () => {
    const dialog = await draw(false)
    const status = within(dialog).getByRole('status')
    expect(status).toHaveTextContent('Drawing the variant…')
    expect(status.querySelector('svg')).not.toBeNull()
  })
})

// DLG-4a (design-wave-screens-b.md; choice C-15): the two-step line from a place not opened to
// pay (the sync review's Translate, the activity row's video Retry) takes the MoneyLine look
// and words, directly left of Confirm and Cancel; only Confirm sends. The campaign's paid count
// is a short mark with today's sentence as its tip (OI-DW-7); it shows numbers and starts nothing.
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PaidConfirm } from '@/renderer/ui/paid-confirm'
import { paidLine } from '@/renderer/ui/paid-confirm/paid-confirm'
import { PaidCount } from '@/renderer/ui/paid-count'
import { paidCountLabel } from '@/renderer/ui/paid-count/paid-count'
import layout from '@/renderer/ui/layout.module.css'
import { axeViolations, renderApp } from '../render'
import { makeFakeApi } from '../fake-api'
import { costLine } from '../cost-line'

describe('paidLine [DLG-4a]', () => {
  it.each([
    [1, 0, 'Paid: 1 request → Made-up Cloud'],
    [2, 0, 'Paid: 2 requests → Made-up Cloud'],
    [null, 0, 'Paid: requests → Made-up Cloud'],
    [1, 1, 'Paid: 1 request + 1 reference → Made-up Cloud'],
    [2, 3, 'Paid: 2 requests + 3 references → Made-up Cloud'],
  ])('words count %s with %i references', (count, references, words) => {
    expect(paidLine(count, 'Made-up Cloud', references)).toBe(words)
  })
})

function draw() {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  render(
    <main>
      <PaidConfirm
        count={2}
        providerLabel="Made-up Cloud"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    </main>,
  )
  return { onConfirm, onCancel }
}

describe('the two-step line [DLG-4a, C-15]', () => {
  it('draws the MoneyLine directly left of Confirm (primary) and Cancel', () => {
    draw()
    const line = screen.getByText(costLine('Paid: 2 requests → Made-up Cloud'))
    const confirm = screen.getByRole('button', { name: 'Confirm' })
    expect(line.nextElementSibling).toBe(confirm)
    expect(confirm).toHaveClass(layout.primary as string)
    expect(confirm.nextElementSibling).toBe(screen.getByRole('button', { name: 'Cancel' }))
  })

  it('gives Confirm the cost as its description, so the words are read at the click', () => {
    draw()
    expect(screen.getByRole('button', { name: 'Confirm' })).toHaveAccessibleDescription(
      'Paid: 2 requests to Made-up Cloud',
    )
  })

  it('sends nothing on Cancel and once on Confirm', async () => {
    const { onConfirm, onCancel } = draw()
    expect(onConfirm).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onConfirm).not.toHaveBeenCalled()
    expect(onCancel).toHaveBeenCalledOnce()
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('has no accessibility violations', async () => {
    draw()
    expect(await axeViolations()).toEqual([])
  })
})

describe('the paid count mark [DLG-4a, OI-DW-7]', () => {
  it.each([
    [{ pictures: 3, videos: 1, text: 0 }, 'Paid so far: 3 pictures, 1 video'],
    [{ pictures: 1, videos: 0, text: 0 }, 'Paid so far: 1 picture, 0 videos'],
    [{ pictures: 0, videos: 2, text: 1 }, 'Paid so far: 0 pictures, 2 videos, 1 text request'],
    [{ pictures: 0, videos: 0, text: 4 }, 'Paid so far: 0 pictures, 0 videos, 4 text requests'],
  ])('labels %o with real plurals', (counts, label) => {
    expect(paidCountLabel(counts)).toBe(label)
  })

  it('is an info mark with the coin, the label shown and the full sentence as its tip', async () => {
    const fake = makeFakeApi()
    fake.onQuery('campaign.paidCount', () => ({
      ok: true,
      data: { pictures: 2, videos: 0, text: 1 },
    }))
    await renderApp(
      <main>
        <PaidCount projectId="P1" campaignId="C1" />
      </main>,
      fake,
    )
    const sentence =
      'Paid generations for this campaign so far: 2 pictures, 0 videos. Text requests: 1.'
    const mark = await screen.findByTitle(sentence)
    expect(
      within(mark).getByText('Paid so far: 2 pictures, 0 videos, 1 text request'),
    ).toBeVisible()
    expect(mark.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(fake.commands).toEqual([])
    expect(await axeViolations()).toEqual([])
  })
})

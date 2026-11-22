// T3e (spec/phases/design-wave.md; spec/app-style-parts.md, "SubPage"): long or rare content
// opened from a Section. A back button and the title; Back and Escape call onBack; focus goes to
// the title on open.
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SubPage, type SubPageProps } from '@/renderer/ui/sub-page'
import { axeViolations } from '../render'

function draw(props: Partial<SubPageProps> = {}) {
  const onBack = vi.fn()
  render(
    <main>
      <SubPage title="Server folders" onBack={onBack} {...props}>
        <button type="button">Add folder</button>
      </SubPage>
    </main>,
  )
  return onBack
}

describe('SubPage [T3e]', () => {
  it('shows the title as a level 2 heading and focuses it on open', () => {
    draw()
    const title = screen.getByRole('heading', { level: 2, name: 'Server folders' })
    expect(title).toHaveFocus()
    expect(title).toHaveAttribute('tabindex', '-1')
    expect(screen.getByRole('region', { name: 'Server folders' })).toContainElement(
      screen.getByRole('button', { name: 'Add folder' }),
    )
  })

  it('has a "Back" button with the same title that calls onBack', async () => {
    const onBack = draw()
    const back = screen.getByRole('button', { name: 'Back' })
    expect(back).toHaveAttribute('title', 'Back')
    expect(back.querySelector('svg')).not.toBeNull()
    await userEvent.click(back)
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('names the back button with backLabel when given', async () => {
    const onBack = draw({ backLabel: 'Back to Agents' })
    const back = screen.getByRole('button', { name: 'Back to Agents' })
    expect(back).toHaveAttribute('title', 'Back to Agents')
    await userEvent.click(back)
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('calls onBack on Escape from inside the page', async () => {
    const onBack = draw()
    await userEvent.keyboard('{Escape}')
    expect(onBack).toHaveBeenCalledOnce()
    await userEvent.click(screen.getByRole('button', { name: 'Add folder' }))
    await userEvent.keyboard('{Escape}')
    expect(onBack).toHaveBeenCalledTimes(2)
  })

  it('passes axe', async () => {
    draw()
    expect(await axeViolations()).toEqual([])
  })
})

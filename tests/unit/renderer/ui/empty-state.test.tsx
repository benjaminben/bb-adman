// T3c (spec/app-style-parts.md, "ObjectRow", EmptyState): an icon, a few words and the one
// action that fills the empty place.
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EmptyState } from '@/renderer/ui/empty-state'
import layout from '@/renderer/ui/layout.module.css'
import { axeViolations } from '../render'

describe('EmptyState [T3c]', () => {
  it('hides the icon, shows the words, and its one button calls the action', async () => {
    const onClick = vi.fn()
    const { container } = render(
      <main>
        <EmptyState
          icon="folder"
          words="No campaigns yet"
          action={{ label: 'New campaign', onClick, primary: true }}
        />
      </main>,
    )
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByText('No campaigns yet')).toBeVisible()
    expect(screen.getAllByRole('button')).toHaveLength(1)
    const button = screen.getByRole('button', { name: 'New campaign' })
    expect(button).toHaveClass(layout.primary)
    await userEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(await axeViolations()).toEqual([])
  })

  it('draws the empty look and no button without an action', () => {
    const { container } = render(<EmptyState icon="image" words="No pictures" />)
    expect(container.firstElementChild).toHaveClass(layout.empty)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('draws a secondary button unless primary is asked for', () => {
    render(<EmptyState icon="key" words="No keys" action={{ label: 'Add key', onClick() {} }} />)
    expect(screen.getByRole('button', { name: 'Add key' })).not.toHaveClass(layout.primary)
  })
})

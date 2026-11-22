// T4 (spec/app-style-parts.md, "Dialog", DialogAlert): a refusal, a failure or a busy state at
// the top of a dialog's body: an icon, one line, at most one action.
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DialogAlert } from '@/renderer/ui/dialog-alert'
import styles from '@/renderer/ui/dialog-alert/dialog-alert.module.css'
import { axeViolations } from '../render'

describe('DialogAlert [T4]', () => {
  it.each(['danger', 'warn'] as const)('%s is an alert in its own colours', async (tone) => {
    render(
      <main>
        <DialogAlert tone={tone}>The provider refused the request.</DialogAlert>
      </main>,
    )
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('The provider refused the request.')
    expect(alert).toHaveClass(styles[tone] ?? 'missing')
    expect(alert.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(await axeViolations()).toEqual([])
  })

  it('busy is a status with the turning spinner', async () => {
    const { container } = render(
      <main>
        <DialogAlert tone="busy">Checking the key</DialogAlert>
      </main>,
    )
    expect(screen.getByRole('status')).toHaveTextContent('Checking the key')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(container.querySelector('svg[class*="spin"]')).not.toBeNull()
    expect(await axeViolations()).toEqual([])
  })

  it('draws at most one action button, which calls its action', async () => {
    const onClick = vi.fn()
    render(
      <DialogAlert tone="danger" action={{ label: 'Retry', onClick }}>
        The run failed.
      </DialogAlert>,
    )
    expect(screen.getAllByRole('button')).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('draws no button without an action', () => {
    render(<DialogAlert tone="warn">Two files are missing.</DialogAlert>)
    expect(screen.queryByRole('button')).toBeNull()
  })
})

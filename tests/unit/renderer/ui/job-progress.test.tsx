// DLG-1 (spec/phases/design-wave-screens-b.md; spec/app-style-parts.md, "Dialog"): a long job
// shows a progress bar and one button, "Run in background" or "Stop". The part only draws:
// its button calls the function it is given, and a failure is never drawn here.
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JobProgress } from '@/renderer/ui/job-progress'
import styles from '@/renderer/ui/job-progress/job-progress.module.css'
import { axeViolations } from '../render'

describe('JobProgress [DLG-1]', () => {
  it('is a progress bar named by its label, with its value as a whole percent', () => {
    render(<JobProgress label="Exporting" value={0.426} />)
    const bar = screen.getByRole('progressbar', { name: 'Exporting' })
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '100')
    expect(bar).toHaveAttribute('aria-valuenow', '43')
    expect(bar).toHaveAttribute('aria-valuetext', '43%')
  })

  it('reads "{done} of {total}" when given the count', () => {
    render(<JobProgress label="Publishing" value={0.3} count={{ done: 3, total: 10 }} />)
    const bar = screen.getByRole('progressbar', { name: 'Publishing' })
    expect(bar).toHaveAttribute('aria-valuenow', '30')
    expect(bar).toHaveAttribute('aria-valuetext', '3 of 10')
  })

  it.each([
    [-0.2, '0'],
    [0, '0'],
    [1, '100'],
    [1.4, '100'],
  ])('keeps the value %d inside 0 to 100 (%s)', (value, now) => {
    render(<JobProgress label="Packaging" value={value} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', now)
  })

  it('with no known value has no aria-valuenow and draws the moving bar', () => {
    const { container } = render(<JobProgress label="Packaging" value={null} />)
    const bar = screen.getByRole('progressbar', { name: 'Packaging' })
    expect(bar).not.toHaveAttribute('aria-valuenow')
    expect(bar).not.toHaveAttribute('aria-valuetext')
    expect(container.querySelector(`.${styles.moving}`)).not.toBeNull()
  })

  it('fills the bar to the known value', () => {
    const { container } = render(<JobProgress label="Exporting" value={0.25} />)
    const fill = container.querySelector<HTMLElement>(`.${styles.fill}`)
    expect(fill?.style.width).toBe('25%')
    expect(container.querySelector(`.${styles.moving}`)).toBeNull()
  })

  it('draws no button without an action', () => {
    render(<JobProgress label="Exporting" value={0.5} />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it.each(['Run in background', 'Stop', 'Stop publishing'])(
    'draws one button "%s" that calls its action',
    async (label) => {
      const onClick = vi.fn()
      render(<JobProgress label="Publishing" value={0.5} action={{ label, onClick }} />)
      expect(screen.getAllByRole('button')).toHaveLength(1)
      await userEvent.click(screen.getByRole('button', { name: label }))
      expect(onClick).toHaveBeenCalledTimes(1)
    },
  )

  it('a disabled action does not call its function', async () => {
    const onClick = vi.fn()
    render(
      <JobProgress
        label="Exporting"
        value={0.9}
        action={{ label: 'Stop', onClick, disabled: true }}
      />,
    )
    const button = screen.getByRole('button', { name: 'Stop' })
    expect(button).toBeDisabled()
    await userEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it.each([0.6, null])('is axe clean with the value %s', async (value) => {
    render(
      <main>
        <JobProgress
          label="Exporting"
          value={value}
          action={{ label: 'Run in background', onClick() {} }}
        />
      </main>,
    )
    expect(await axeViolations()).toEqual([])
  })
})

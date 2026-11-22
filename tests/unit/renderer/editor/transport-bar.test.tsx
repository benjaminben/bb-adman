// P7-18 (spec/phases/phase-07-slices-2.md): the transport bar has one button, "Play" or
// "Pause" by state, and the time as m:ss.s / m:ss.s.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TransportBar } from '@/renderer/editor/transport-bar'
import { variant } from '../screens/campaign/campaign-fixture'
import { axeViolations } from '../render'

const VIDEO = { ...variant('V1'), format: 'video' as const, durationMs: 8000 }

function setUp(playing: boolean, timeMs = 2500) {
  const onToggle = vi.fn()
  render(
    <main>
      <TransportBar
        projectId="P1"
        variant={VIDEO}
        playing={playing}
        timeMs={timeMs}
        onToggle={onToggle}
      />
    </main>,
  )
  return { onToggle }
}

describe('TransportBar [P7-18]', () => {
  it('paused: shows Play, and a click calls back', async () => {
    const { onToggle } = setUp(false)
    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(onToggle).toHaveBeenCalledOnce()
    expect(await axeViolations()).toEqual([])
  })

  it('playing: shows Pause, and a click calls back', async () => {
    const { onToggle } = setUp(true)
    expect(screen.queryByRole('button', { name: 'Play' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Pause' }))
    expect(onToggle).toHaveBeenCalledOnce()
  })

  it.each([
    [0, '0:00.0 / 0:08.0'],
    [2500, '0:02.5 / 0:08.0'],
    [8000, '0:08.0 / 0:08.0'],
  ])('at %i ms reads %s', (timeMs, text) => {
    setUp(false, timeMs)
    expect(screen.getByText(text)).toBeInTheDocument()
  })
})

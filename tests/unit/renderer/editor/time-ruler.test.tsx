// P7-18 (spec/phases/phase-07-slices-2.md): the time ruler shows seconds marks; a press or a
// drag on it scrubs. It is a slider named "Time", so the keyboard can move it too.
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TimeRuler, markStep } from '@/renderer/editor/time-ruler'
import { axeViolations } from '../render'

// The ruler is 800 px wide from x = 100 in these tests.
function setUp(timeMs = 0, durationMs = 8000) {
  const onScrub = vi.fn()
  render(
    <main>
      <TimeRuler timeMs={timeMs} durationMs={durationMs} onScrub={onScrub} />
    </main>,
  )
  const ruler = screen.getByRole('slider', { name: 'Time' })
  ruler.getBoundingClientRect = () => ({ left: 100, width: 800 }) as DOMRect
  return { ruler, onScrub }
}

describe('TimeRuler [P7-18]', () => {
  it('is a slider named Time with the time as its value', async () => {
    const { ruler } = setUp(2500)
    expect(ruler).toHaveAttribute('aria-valuemin', '0')
    expect(ruler).toHaveAttribute('aria-valuemax', '8000')
    expect(ruler).toHaveAttribute('aria-valuenow', '2500')
    expect(ruler).toHaveAttribute('aria-valuetext', '0:02.5')
    expect(await axeViolations()).toEqual([])
  })

  it('shows one mark per second, from 0, not at the end', () => {
    const { ruler } = setUp()
    const marks = [...ruler.querySelectorAll('[data-mark]')].map((m) => m.textContent)
    expect(marks).toEqual(['0:00', '0:01', '0:02', '0:03', '0:04', '0:05', '0:06', '0:07'])
  })

  it('a press scrubs to the time under it', () => {
    const { ruler, onScrub } = setUp()
    fireEvent.pointerDown(ruler, { clientX: 500, button: 0 })
    expect(onScrub).toHaveBeenLastCalledWith(4000)
  })

  it('a drag scrubs as it moves and stops at the release', () => {
    const { ruler, onScrub } = setUp()
    fireEvent.pointerDown(ruler, { clientX: 100, button: 0 })
    fireEvent.pointerMove(window, { clientX: 300 })
    expect(onScrub).toHaveBeenLastCalledWith(2000)
    fireEvent.pointerMove(window, { clientX: 2000 })
    expect(onScrub).toHaveBeenLastCalledWith(8000)
    fireEvent.pointerUp(window, { clientX: 2000 })
    onScrub.mockClear()
    fireEvent.pointerMove(window, { clientX: 400 })
    expect(onScrub).not.toHaveBeenCalled()
  })

  it('a move with no press does nothing; another button does not scrub', () => {
    const { ruler, onScrub } = setUp()
    fireEvent.pointerMove(window, { clientX: 400 })
    fireEvent.pointerDown(ruler, { clientX: 400, button: 2 })
    expect(onScrub).not.toHaveBeenCalled()
  })

  it.each([
    ['{ArrowRight}', 2600],
    ['{ArrowLeft}', 2400],
    ['{Shift>}{ArrowRight}{/Shift}', 3500],
    ['{Shift>}{ArrowLeft}{/Shift}', 1500],
    ['{Home}', 0],
    ['{End}', 8000],
  ])('the key %s scrubs to %i', async (keys, to) => {
    const { default: userEvent } = await import('@testing-library/user-event')
    const { ruler, onScrub } = setUp(2500)
    ruler.focus()
    await userEvent.keyboard(keys)
    expect(onScrub).toHaveBeenLastCalledWith(to)
  })
})

describe('markStep: seconds between marks', () => {
  it.each([
    [500, 1],
    [8000, 1],
    [10_000, 1],
    [15_000, 2],
    [60_000, 10],
    [600_000, 60],
    [86_400_000, 10_800],
  ])('%i ms has a mark every %i s', (durationMs, step) => {
    expect(markStep(durationMs)).toBe(step)
  })
})

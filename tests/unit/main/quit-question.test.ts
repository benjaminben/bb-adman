// spec/screens-ai.md, "Attached jobs and the close warning": quitting with jobs queued or
// running shows "Quit Adman?" with the count; with nothing running, no box.
import { describe, expect, it } from 'vitest'
import { QUIT_BUTTON, quitQuestion } from '@/main/quit-question'

describe('the quit question [spec/screens-ai.md, D-036]', () => {
  it('asks nothing when no run is going', () => {
    expect(quitQuestion(0)).toBeNull()
  })

  it.each([
    [1, '1 run is still going. Quitting stops it.'],
    [3, '3 runs are still going. Quitting stops them.'],
  ])('with %i runs gives the title, the count, the warning and the two buttons', (n, start) => {
    expect(quitQuestion(n)).toEqual({
      message: 'Quit Adman?',
      detail:
        `${start} Requests already sent to a paid provider may still be ` +
        'charged, and their results are lost.',
      buttons: ['Quit', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
    })
  })

  it('names the Quit button by its place in the list', () => {
    expect(quitQuestion(2)?.buttons[QUIT_BUTTON]).toBe('Quit')
  })
})

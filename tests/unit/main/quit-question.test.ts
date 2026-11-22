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

describe('the quit question names runs that keep running [P7-13, A-174]', () => {
  it.each([
    [
      [{ label: 'fal.ai Seedance', count: 1 }],
      'fal.ai Seedance has started 1 video and will charge for it. It keeps running; open the project again to collect it.',
    ],
    [
      [{ label: 'fal.ai Seedance', count: 2 }],
      'fal.ai Seedance has started 2 videos and will charge for them. They keep running; open the project again to collect them.',
    ],
  ])('adds one sentence for %o', (left, sentence) => {
    const detail = quitQuestion(2, left)?.detail ?? ''
    expect(detail.endsWith(sentence)).toBe(true)
    expect(detail.startsWith('2 runs are still going.')).toBe(false)
  })

  it('adds nothing when no run keeps running', () => {
    expect(quitQuestion(1, [])).toEqual(quitQuestion(1))
    expect(quitQuestion(1, [{ label: 'fal.ai Seedance', count: 0 }])).toEqual(quitQuestion(1))
  })
})

// P7-15b: the first sentence counts only the runs quitting really stops.
describe('the quit question counts only the runs it stops [P7-15b]', () => {
  const ONE =
    'fal.ai Seedance has started 1 video and will charge for it. It keeps running; open the project again to collect it.'
  const TWO =
    'fal.ai Seedance has started 2 videos and will charge for them. They keep running; open the project again to collect them.'
  const PAID =
    'Requests already sent to a paid provider may still be charged, and their results are lost.'

  it.each([
    [
      3,
      [{ label: 'fal.ai Seedance', count: 1 }],
      `2 runs are still going. Quitting stops them. ${PAID} ${ONE}`,
    ],
    [
      2,
      [{ label: 'fal.ai Seedance', count: 1 }],
      `1 run is still going. Quitting stops it. ${PAID} ${ONE}`,
    ],
    [2, [{ label: 'fal.ai Seedance', count: 2 }], TWO],
    [
      2,
      [
        { label: 'fal.ai Seedance', count: 1 },
        { label: 'Other Video', count: 1 },
      ],
      `${ONE} ${ONE.replace('fal.ai Seedance', 'Other Video')}`,
    ],
  ])('with %i running and %o left running', (running, left, detail) => {
    expect(quitQuestion(running, left)?.detail).toBe(detail)
  })
})

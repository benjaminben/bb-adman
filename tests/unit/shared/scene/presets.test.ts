// phase-07.md "Presets" [A-187]: entrance e(p) = 1 - (1 - p)^3, exit shown as 1 - p^3; fade-up
// moves down by (1 - e) x 5 % of the height, slide left by (1 - e) x 10 % of the width.
import { describe, expect, it } from 'vitest'
import { presetState, type PresetState } from '@/shared/scene/presets'

// 1000 by 2000, so both distances are (1 - e) x 100 pixels.
const SIZE = { width: 1000, height: 2000 }
const PROGRESS = [0, 0.25, 0.5, 0.75, 1]
const ENTRANCE = [0, 0.578125, 0.875, 0.984375, 1]
const EXIT = [1, 0.984375, 0.875, 0.578125, 0]

function close(got: PresetState, want: PresetState) {
  expect(got.opacity).toBeCloseTo(want.opacity, 9)
  expect(got.dx).toBeCloseTo(want.dx, 9)
  expect(got.dy).toBeCloseTo(want.dy, 9)
}

const looks = {
  none: () => ({ opacity: 1, dx: 0, dy: 0 }),
  fade: (e: number) => ({ opacity: e, dx: 0, dy: 0 }),
  'fade-up': (e: number) => ({ opacity: e, dx: 0, dy: (1 - e) * 100 }),
  slide: (e: number) => ({ opacity: e, dx: -(1 - e) * 100, dy: 0 }),
  // A single word moves as fade-up over the first half of the block, then stays.
  'stagger-words': (e: number) => ({ opacity: e, dx: 0, dy: (1 - e) * 100 }),
} as const

const cases = (['entrance', 'exit'] as const).flatMap((phase) =>
  (Object.keys(looks) as (keyof typeof looks)[]).flatMap((preset) =>
    PROGRESS.map((p, i) => [preset, phase, p, i] as const),
  ),
)

describe('presetState [A-187]', () => {
  it.each(cases)('%s, %s at progress %s', (preset, phase, p, i) => {
    const shown = (phase === 'entrance' ? ENTRANCE : EXIT)[i]!
    // stagger-words is checked here with two words, the first: its own progress is p / 0.5.
    const own = Math.min(1, p / 0.5)
    const staggered = phase === 'entrance' ? 1 - (1 - own) ** 3 : 1 - own ** 3
    const want = looks[preset](preset === 'stagger-words' ? staggered : shown)
    close(presetState(preset, phase, p, 0, 2, SIZE), want)
  })

  it('clamps progress outside 0 to 1', () => {
    close(presetState('fade', 'entrance', -1, 0, 1, SIZE), looks.fade(0))
    close(presetState('fade', 'entrance', 2, 0, 1, SIZE), looks.fade(1))
  })
})

describe('stagger-words: each word has its own progress', () => {
  // Five words: word i starts at 0.5 x i / 4 of the block and takes half of it.
  it.each([
    ['first', 0, 0.5, 1],
    ['middle', 2, 0.5, 0.5],
    ['last', 4, 0.5, 0],
    ['first', 0, 0.25, 0.5],
    ['middle', 2, 0.25, 0],
    ['last', 4, 0.75, 0.5],
    ['last', 4, 1, 1],
  ])('the %s word (index %s) at progress %s has its own progress %s', (_n, i, p, own) => {
    const entrance = 1 - (1 - own) ** 3
    close(presetState('stagger-words', 'entrance', p, i, 5, SIZE), looks['stagger-words'](entrance))
    const exit = 1 - own ** 3
    close(presetState('stagger-words', 'exit', p, i, 5, SIZE), looks['stagger-words'](exit))
  })

  it('one word takes progress p / 0.5', () => {
    close(presetState('stagger-words', 'entrance', 0.25, 0, 1, SIZE), looks['fade-up'](0.875))
  })
})

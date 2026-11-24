// The counts of approvals.progress for one "Update gallery" (spec/approvals-commands.md
// "Progress and Stop", D-110): one unit for each still the run draws, two for each clip it
// makes (making, sending). unitsDone is the units finished when an event is sent.
import type { PublishProgress } from './types'

type Step = Exclude<PublishProgress['step'], 'finishing'>

export type ProgressCounter = {
  // Sends one event with the units finished so far.
  send(step: Step, done: number, total: number): void
  // Marks n more units finished.
  add(n: number): void
  // The one finishing event: every unit counted.
  finish(): void
}

export function progressCounter(
  stills: number,
  clips: number,
  onStep: (counts: PublishProgress) => void,
): ProgressCounter {
  const unitsTotal = stills + 2 * clips
  let unitsDone = 0
  return {
    send: (step, done, total) => onStep({ step, done, total, unitsDone, unitsTotal }),
    add: (n) => (unitsDone += n),
    finish: () => onStep({ step: 'finishing', done: 0, total: 0, unitsDone: unitsTotal, unitsTotal }),
  }
}

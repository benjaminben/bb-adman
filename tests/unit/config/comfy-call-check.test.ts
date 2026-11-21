import { describe, it, expect } from 'vitest'
import { callProblems, withCallCheck } from '../../comfy/call-check'
import type { Call } from '../../comfy/recorder'

const OWN = '0b6f2c1e-7a3d-4c5b-9e8f-1a2b3c4d5e6f'
const OTHER = '11111111-2222-4333-8444-555555555555'

describe('callProblems [SPEC 6.10.12]', () => {
  it('finds no problem in calls the case meant to make', () => {
    const calls: Call[] = [{ name: 'systemStats' }, { name: 'submit', arg: OWN }]
    expect(callProblems(calls, ['systemStats', 'submit'])).toEqual([])
  })

  it('names an unexpected call, a cancel of another ID and a second upload', () => {
    const calls: Call[] = [
      { name: 'submit', arg: OWN },
      { name: 'queueIds' },
      { name: 'interrupt', arg: OTHER },
      { name: 'uploadImage' },
      { name: 'uploadImage' },
    ]
    expect(callProblems(calls, ['submit', 'interrupt', 'uploadImage'])).toEqual([
      'An unexpected call: queueIds()',
      `A cancel of an ID this case did not submit: interrupt(${OTHER})`,
      'More than one upload: 2',
    ])
  })
})

// Runs a case body under the check, collecting what it prints.
function checked(calls: Call[], body: () => Promise<unknown>) {
  const printed: string[] = []
  const print = (...lines: string[]) => {
    printed.push(...lines)
  }
  return { printed, run: withCallCheck(calls, ['systemStats'], print, body) }
}

describe('withCallCheck: the recorder checks run when a case fails too [review CU-5a item 2]', () => {
  it('prints the result and passes the value through when all is well', async () => {
    const { printed, run } = checked([{ name: 'systemStats' }], () => Promise.resolve(7))
    expect(await run).toBe(7)
    expect(printed).toEqual(['Calls made: only the ones this case meant to make.'])
  })

  it('fails a case that passed but made a call it did not mean to make', async () => {
    const calls: Call[] = []
    const { printed, run } = checked(calls, async () => {
      calls.push({ name: 'queueIds' })
    })
    await expect(run).rejects.toThrow('The case made calls it did not mean to make')
    expect(printed).toEqual(['An unexpected call: queueIds()'])
  })

  it("on a failed case still checks and prints the calls, and keeps the case's own error", async () => {
    const calls: Call[] = []
    const { printed, run } = checked(calls, async () => {
      calls.push({ name: 'queueIds' })
      throw new Error('The run ended with an error')
    })
    await expect(run).rejects.toThrow('The run ended with an error')
    expect(printed).toEqual(['An unexpected call: queueIds()'])
  })

  it('on a failed case with clean calls, says so and keeps the error', async () => {
    const { printed, run } = checked([], () =>
      Promise.reject(new Error('The check ended: no_answer')),
    )
    await expect(run).rejects.toThrow('The check ended: no_answer')
    expect(printed).toEqual(['Calls made: only the ones this case meant to make.'])
  })
})

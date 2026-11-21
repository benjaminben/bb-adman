// S2-1 [F-11, F-12]: the Settings check sentences, the marks and the licence refusal have
// one owner, src/shared/providers/messages.ts.
import { describe, it, expect } from 'vitest'
import {
  checkMessage,
  fillMarks,
  licenceNotConfirmedMessage,
  reasonMessage,
} from '@/shared/providers/messages'
import type { ComfyCheckOutcome } from '@/shared/schemas/commands/comfy-check'

describe('checkMessage: the six Settings check sentences [S2-1, F-12]', () => {
  const cases: Array<[Exclude<ComfyCheckOutcome, 'ok'>, string]> = [
    [
      'no_answer',
      'Nothing answered at {address}. Check that ComfyUI is running and the address is right.',
    ],
    ['not_comfyui', 'Something answered at {address}, but it is not a ComfyUI server.'],
    [
      'sign_in_needed',
      'The server at {address} asked for a sign-in. Adman can only use ComfyUI servers without one.',
    ],
    [
      'redirect_refused',
      'The server tried to send Adman to another address. Adman did not follow.',
    ],
    ['certificate', "Adman could not check the server's security certificate."],
    ['address_refused', 'Adman cannot use that address.'],
  ]
  it.each(cases)('%s has its sentence', (outcome, sentence) => {
    expect(checkMessage(outcome)).toBe(sentence)
  })

  it('the Settings form of redirect_refused names no run; the run form still does', () => {
    expect(checkMessage('redirect_refused')).not.toMatch(/run/)
    expect(reasonMessage('redirect_refused')).toMatch(/, and the run was stopped\.$/)
  })
})

describe('fillMarks [S2-1]', () => {
  const address = 'http://10.0.0.2:8188'
  it.each<[string, { address?: string; n?: number }, string]>([
    ['Nothing answered at {address}.', { address }, `Nothing answered at ${address}.`],
    ['Nothing answered at {address}.', {}, 'Nothing answered at the saved address.'],
    ['Missing {n} thing(s).', { n: 3 }, 'Missing 3 thing(s).'],
    ['{address} has {n}; {address}.', { address: 'A', n: 2 }, 'A has 2; A.'],
    ['No marks here.', { address: 'A', n: 1 }, 'No marks here.'],
  ])('%s with %o reads %s', (text, values, expected) => {
    expect(fillMarks(text, values)).toBe(expected)
  })
})

describe('licenceNotConfirmedMessage [S2-1, D-088]', () => {
  it('names the model', () => {
    expect(licenceNotConfirmedMessage('MiniMax H3')).toBe(
      'MiniMax H3 requires a commercial license. Confirm that you have one first.',
    )
  })
})

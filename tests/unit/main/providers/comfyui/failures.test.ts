import { describe, it, expect } from 'vitest'
import {
  checkFailure,
  missingFailure,
  refusedFailure,
  runFailure,
} from '../../../../../src/main/providers/comfyui/failures'
import { ComfyRefused } from '../../../../../src/main/providers/comfyui/refusal'
import { ProviderFailure } from '../../../../../src/main/providers/types'

describe('a 400 from /prompt [SPEC 6.10.9, 14 1.43 K-1, 1.45 C-1]', () => {
  it('keeps the messages and details, cleaned, as the detail of server_refused', () => {
    const refused = new ComfyRefused({
      type: 'prompt_outputs_failed_validation',
      message: 'Prompt outputs failed validation',
      details: 'one\u001b[31m bad',
      nodes: [
        {
          nodeId: '4',
          errors: [{ type: 'value_not_in_list', message: 'Value not in list', details: 'x\ty' }],
        },
      ],
    })
    const failure = refusedFailure(refused)
    expect(failure).toBeInstanceOf(ProviderFailure)
    expect(failure.error).toEqual({
      kind: 'other',
      reason: 'server_refused',
      detail: 'Prompt outputs failed validation\none bad\nValue not in list\nx y',
    })
  })

  it('has an empty detail when the server gave no words', () => {
    expect(refusedFailure(new ComfyRefused({ nodes: [] })).error.detail).toBe('')
  })
})

describe('a run that ended with an error [SPEC 6.10.9]', () => {
  const error = (exceptionType: string, exceptionMessage: string) => [
    { type: 'execution_start' },
    { type: 'execution_error', exceptionType, exceptionMessage },
  ]

  it.each([
    ['torch.OutOfMemoryError', 'CUDA failed'],
    ['RuntimeError', 'CUDA Out Of Memory. Tried to allocate 2 GiB'],
    ['RuntimeError', 'Allocation on device 0 would exceed allowed memory'],
  ])('is out_of_memory for %s: %s', (type, message) => {
    expect(runFailure(error(type, message)).error).toEqual({
      kind: 'other',
      reason: 'out_of_memory',
      detail: `${type}: ${message}`,
    })
  })

  it('is run_failed for any other error, with the type and message cleaned', () => {
    expect(runFailure(error('ValueError', 'bad\u0007 value')).error).toEqual({
      kind: 'other',
      reason: 'run_failed',
      detail: 'ValueError: bad  value',
    })
  })

  it('is run_failed with no detail when the error message holds nothing', () => {
    expect(runFailure([{ type: 'execution_error' }]).error).toEqual({
      kind: 'other',
      reason: 'run_failed',
      detail: '',
    })
  })
})

describe('a check that did not end ok [SPEC 6.10.3, 6.10.9]', () => {
  it('is offline for no_answer', () => {
    expect(checkFailure('no_answer').error).toMatchObject({ kind: 'offline', reason: 'no_answer' })
  })

  it.each([
    'not_comfyui',
    'sign_in_needed',
    'redirect_refused',
    'certificate',
    'address_refused',
  ] as const)('is other for %s, with a fixed detail', (outcome) => {
    expect(checkFailure(outcome).error).toEqual({
      kind: 'other',
      reason: outcome,
      detail: `The check ended ${outcome}`,
    })
  })

  it('lists the missing items with missing_items', () => {
    const missing = [{ what: 'node' as const, name: 'ReferenceMultiLatent' }]
    expect(missingFailure(missing).error).toEqual({
      kind: 'other',
      reason: 'missing_items',
      detail: 'The server is missing 1 item(s)',
      missing,
    })
  })
})

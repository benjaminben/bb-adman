// CU-9 [REQ: FR-269] (security class): what one live message from the server can mean. Only
// the run's own messages of the types the app needs are read; everything else means nothing.
import { describe, expect, it } from 'vitest'
import { readLive } from '@/main/providers/comfyui/live-messages'

const own = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b'
const other = '00000000-4d5e-4f60-8a7b-9c0d1e2f3a4b'
const text = (value: unknown) => JSON.stringify(value)

describe('readLive [CU-9, spec/comfyui.md "Live progress"]', () => {
  it.each([
    [
      'progress of the own run',
      { type: 'progress', data: { value: 3, max: 20, prompt_id: own } },
      { stage: 'working', fraction: 0.15 },
    ],
    [
      'progress cut to the whole percent',
      { type: 'progress', data: { value: 1, max: 3, prompt_id: own } },
      { stage: 'working', fraction: 0.33 },
    ],
    [
      'progress at the end',
      { type: 'progress', data: { value: 20, max: 20, prompt_id: own, node: '5' } },
      { stage: 'working', fraction: 1 },
    ],
    [
      'execution_start of the own run',
      { type: 'execution_start', data: { prompt_id: own } },
      { stage: 'working' },
    ],
    [
      'executing a node of the own run',
      { type: 'executing', data: { node: '5', prompt_id: own } },
      { stage: 'working' },
    ],
    [
      'executing with no node: the run is done',
      { type: 'executing', data: { node: null, prompt_id: own } },
      'ended',
    ],
    ['execution_success', { type: 'execution_success', data: { prompt_id: own } }, 'ended'],
    [
      'execution_error',
      { type: 'execution_error', data: { prompt_id: own, exception_message: 'x' } },
      'ended',
    ],
    ['execution_interrupted', { type: 'execution_interrupted', data: { prompt_id: own } }, 'ended'],
    [
      'progress of another run',
      { type: 'progress', data: { value: 3, max: 20, prompt_id: other } },
      null,
    ],
    [
      'execution_success of another run',
      { type: 'execution_success', data: { prompt_id: other } },
      null,
    ],
    [
      'a status message',
      { type: 'status', data: { status: { exec_info: { queue_remaining: 2 } } } },
      null,
    ],
    ['an unknown type', { type: 'crystools.monitor', data: { prompt_id: own } }, null],
    [
      'progress over its max',
      { type: 'progress', data: { value: 21, max: 20, prompt_id: own } },
      null,
    ],
    [
      'progress with a max of 0',
      { type: 'progress', data: { value: 0, max: 0, prompt_id: own } },
      null,
    ],
    [
      'progress with a negative value',
      { type: 'progress', data: { value: -1, max: 20, prompt_id: own } },
      null,
    ],
    [
      'progress with text numbers',
      { type: 'progress', data: { value: '3', max: '20', prompt_id: own } },
      null,
    ],
    ['no data', { type: 'progress' }, null],
    ['an array', [1, 2], null],
  ])('%s', (_name, message, expected) => {
    expect(readLive(text(message), own)).toEqual(expected)
  })

  it.each([
    ['not JSON', '{"type": "progress", '],
    ['empty', ''],
    ['a bare string', '"progress"'],
    ['null', 'null'],
  ])('%s means nothing', (_name, raw) => {
    expect(readLive(raw, own)).toBeNull()
  })
})

import { describe, it, expect } from 'vitest'
import {
  historyAnswer,
  jobStateAnswer,
  modelFilesAnswer,
  queueAnswer,
  submitAnswer,
  systemStatsAnswer,
  uploadAnswer,
} from '../../../../../src/main/providers/comfyui/answers'
import {
  MAX_SERVER_NAME_CHARS,
  MAX_SERVER_TEXT_CHARS,
} from '../../../../../src/main/providers/comfyui/limits'

const long = 'v'.repeat(MAX_SERVER_TEXT_CHARS + 50)
const id = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b'

describe('every JSON answer keeps known fields only, with text cut [SPEC 6.10.2, 14 CU-2]', () => {
  it('reads system_stats: the version as text and the devices as a list', () => {
    const answer = {
      system: { comfyui_version: '0.3.40', os: 'nt', argv: ['--listen'] },
      devices: [{ name: 'cuda:0' }],
      extra: 1,
    }
    expect(systemStatsAnswer.parse(answer)).toEqual({ comfyuiVersion: '0.3.40', deviceCount: 1 })
  })

  it.each([
    { system: {}, devices: [] },
    { system: { comfyui_version: 3 }, devices: [] },
    { system: { comfyui_version: '1' }, devices: {} },
    [],
  ])('refuses system_stats without the ComfyUI shape: %j', (answer) => {
    expect(systemStatsAnswer.safeParse(answer).success).toBe(false)
  })

  it('cuts the version to the stated length', () => {
    const answer = { system: { comfyui_version: long }, devices: [] }
    expect(systemStatsAnswer.parse(answer).comfyuiVersion).toHaveLength(MAX_SERVER_NAME_CHARS)
  })

  it('reads a model folder as a list of names, each cut', () => {
    expect(modelFilesAnswer.parse(['a.safetensors', long])).toEqual([
      'a.safetensors',
      long.slice(0, MAX_SERVER_NAME_CHARS),
    ])
    expect(modelFilesAnswer.safeParse([1]).success).toBe(false)
  })

  it('reads an upload answer as its name and subfolder', () => {
    const answer = { name: 'adman-0011223344556677.png', subfolder: 'adman', type: 'input', x: 1 }
    expect(uploadAnswer.parse(answer)).toEqual({ name: answer.name, subfolder: 'adman' })
    expect(uploadAnswer.parse({ name: 'a.png' })).toEqual({ name: 'a.png', subfolder: '' })
  })

  it('reads a submit answer whose ID has the UUID pattern', () => {
    const answer = { prompt_id: id, number: 4, node_errors: { 3: { x: 1 } } }
    expect(submitAnswer.parse(answer)).toEqual({ promptId: id, number: 4 })
    expect(submitAnswer.safeParse({ prompt_id: '../x', number: 4 }).success).toBe(false)
  })

  it('reads a job state as its status only', () => {
    expect(jobStateAnswer.parse({ status: 'in_progress', workflow: {} })).toEqual({
      status: 'in_progress',
    })
  })

  it('keeps only the IDs and the order of the queue, and drops the rest of each entry', () => {
    const other = '11111111-2222-4333-8444-555555555555'
    const answer = {
      queue_running: [[7, id, { secret: 'prompt' }, {}, []]],
      queue_pending: [[9, other, { text: 'someone else' }], [8, 'b', {}], ['bad']],
    }
    expect(queueAnswer.parse(answer)).toEqual({ running: [id], pending: ['b', other] })
  })

  it('reads a history entry: status, exception text cut, file references, no traceback', () => {
    const entry = {
      prompt: [1, id, { node: 'graph' }],
      status: {
        status_str: 'error',
        completed: false,
        messages: [
          ['execution_start', { prompt_id: id }],
          [
            'execution_error',
            {
              exception_type: 'torch.OutOfMemoryError',
              exception_message: long,
              traceback: ['C:\\x'],
            },
          ],
        ],
      },
      outputs: {
        9: { images: [{ filename: 'a.png', subfolder: '', type: 'temp', extra: 1 }, 'odd'] },
      },
    }
    expect(historyAnswer.parse({ [id]: entry })[id]).toEqual({
      status: {
        statusStr: 'error',
        completed: false,
        messages: [
          { type: 'execution_start' },
          {
            type: 'execution_error',
            exceptionType: 'torch.OutOfMemoryError',
            exceptionMessage: long.slice(0, MAX_SERVER_TEXT_CHARS),
          },
        ],
      },
      outputs: { 9: { images: [{ filename: 'a.png', subfolder: '', type: 'temp' }] } },
    })
  })

  it('reads an empty history as no entry', () => {
    expect(historyAnswer.parse({})).toEqual({})
  })
})

import { describe, it, expect, afterEach } from 'vitest'
import { randomUUID } from 'node:crypto'
import { startComfyStandIn, type StandIn } from '../../helpers/comfy-stand-in'
import { createComfyClient } from '../../../src/main/providers/comfyui/client'
import { fillWorkflow } from '../../../src/main/providers/comfyui/fill'
import { flux3KleinEditReferences } from '../../../src/main/providers/comfyui/workflows/flux3'
import { foreignCancels, recordCalls, unexpectedCalls } from '../../comfy/recorder'
import { fieldNames, runGraph, type Timing } from '../../comfy/run-graph'
import { makePrinter } from '../../comfy/print'

let stand: StandIn | undefined
afterEach(async () => {
  await stand?.close()
  stand = undefined
})

const spec = flux3KleinEditReferences
const graph = fillWorkflow(spec, { prompt: 'shapes', references: ['adman/adman-0.png'] })
const OUTPUT = {
  [spec.slots.outputNode]: { images: [{ filename: 'r.png', subfolder: '', type: 'temp' }] },
}

function fakeTiming(limitMs = 60_000): Timing & { clock: { at: number } } {
  const clock = { at: 0 }
  return {
    clock,
    pollMs: 2_000,
    limitMs,
    now: () => clock.at,
    sleep: async (ms) => {
      clock.at += ms
      await Promise.resolve()
    },
  }
}

async function setUp() {
  stand = await startComfyStandIn()
  const printed: string[] = []
  const print = makePrinter(stand.origin, (line) => printed.push(line))
  const recorded = recordCalls(createComfyClient({ origin: stand.origin, ownPorts: () => [] }))
  return { s: stand, printed, print, recorded, id: randomUUID() }
}

const RUN_CALLS = ['submit', 'history', 'jobState', 'queueIds', 'viewFile'] as const

describe('runGraph: submit, poll, fetch, at client level [SPEC 14 1.41 CU-5a, 1.46 case 5]', () => {
  it('submits with its own ID, waits for the history entry, and fetches the output file', async () => {
    const { s, print, recorded, id } = await setUp()
    s.reply(`GET /history/${id}`, {
      json: { [id]: { status: { status_str: 'success', completed: true }, outputs: OUTPUT } },
    })
    const run = await runGraph(recorded.client, spec, graph, id, print, fakeTiming(), 1_000)
    expect(Buffer.from(run.bytes).toString()).toBe('stand-in picture bytes')
    expect(run.ref).toEqual({ filename: 'r.png', subfolder: '', type: 'temp' })
    expect(recorded.calls[0]).toEqual({ name: 'submit', arg: id })
    expect(unexpectedCalls(recorded.calls, RUN_CALLS)).toEqual([])
    const view = s.seen.find((r) => r.path.startsWith('/view'))
    expect(view?.path).toBe('/view?filename=r.png&subfolder=&type=temp')
  })

  it('counts time waiting in the queue apart from time working', async () => {
    const { s, print, recorded, id } = await setUp()
    const timing = fakeTiming()
    let polls = 0
    s.reply(`GET /api/jobs/${id}`, { json: { status: 'pending' } })
    // The fifth poll finds the entry; the third sees the run start working.
    recorded.client.history = async () => {
      polls += 1
      if (polls === 3) s.reply(`GET /api/jobs/${id}`, { json: { status: 'in_progress' } })
      if (polls < 5) return null
      return { status: { statusStr: 'success', completed: true, messages: [] }, outputs: OUTPUT }
    }
    const run = await runGraph(recorded.client, spec, graph, id, print, timing, 1_000)
    expect(run.waitingMs).toBe(4_000)
    expect(run.workingMs).toBe(4_000)
  })

  it("a refused graph prints what K-2 allows, with the class from the app's graph [1.43 K-2]", async () => {
    const { s, printed, print, recorded, id } = await setUp()
    s.reply('POST /prompt', {
      status: 400,
      json: {
        error: {
          type: 'prompt_outputs_failed_validation',
          message: `at ${s.origin}`,
          details: 'd',
        },
        node_errors: {
          '6': {
            class_type: 'ServerSaysSomethingElse',
            errors: [
              {
                type: 'value_not_in_list',
                message: 'Value not in list',
                details: 'text\u001b[31m',
                extra_info: { input_name: 'text', received_value: 'secret prompt' },
              },
            ],
          },
        },
      },
    })
    const run = runGraph(recorded.client, spec, graph, id, print, fakeTiming(), 1_000)
    await expect(run).rejects.toThrow('The server refused the graph')
    expect(printed).toEqual([
      'Refused: prompt_outputs_failed_validation',
      'Message: at [test server]',
      'Details: d',
      'Node 6 (CLIPTextEncode), input text: value_not_in_list',
      '  Message: Value not in list',
      '  Details: text [31m',
    ])
    expect(printed.join(' ')).not.toContain('secret prompt')
    expect(unexpectedCalls(recorded.calls, ['submit'])).toEqual([])
  })

  it("a run that ended with an error prints the exception's type and message only", async () => {
    const { s, printed, print, recorded, id } = await setUp()
    const error = {
      exception_type: 'torch.OutOfMemoryError',
      exception_message: `CUDA out of memory on ${s.origin}`,
      traceback: ['/home/someone/ComfyUI/execution.py'],
    }
    s.reply(`GET /history/${id}`, {
      json: {
        [id]: {
          status: { status_str: 'error', messages: [['execution_error', error]] },
          outputs: {},
        },
      },
    })
    const run = runGraph(recorded.client, spec, graph, id, print, fakeTiming(), 1_000)
    await expect(run).rejects.toThrow('The run ended with an error')
    expect(printed).toEqual([
      'Run error: torch.OutOfMemoryError',
      '  Message: CUDA out of memory on [test server]',
    ])
  })

  it('a run that runs out of time removes and interrupts its own run only, then fails', async () => {
    const { print, recorded, id } = await setUp()
    const run = runGraph(recorded.client, spec, graph, id, print, fakeTiming(10_000), 1_000)
    await expect(run).rejects.toThrow('The run ran out of time; its own run was cancelled')
    const cancels = recorded.calls.filter(
      (c) => c.name === 'removeFromQueue' || c.name === 'interrupt',
    )
    expect(cancels).toEqual([
      { name: 'removeFromQueue', arg: id },
      { name: 'interrupt', arg: id },
    ])
    expect(foreignCancels(recorded.calls)).toEqual([])
  })

  it('a run with no output file for its output node fails', async () => {
    const { s, print, recorded, id } = await setUp()
    s.reply(`GET /history/${id}`, {
      json: { [id]: { status: { status_str: 'success', completed: true }, outputs: {} } },
    })
    const run = runGraph(recorded.client, spec, graph, id, print, fakeTiming(), 1_000)
    await expect(run).rejects.toThrow('The run gave no file for its output node')
  })
})

describe('fieldNames: names only, no values [CU-5a case 4]', () => {
  it('lists the field names of an object, with lists marked []', () => {
    const entry = {
      status: { statusStr: 'success', messages: [{ type: 'execution_start' }] },
      outputs: { '15': { images: [{ filename: 'secret-name.png' }] } },
    }
    expect(fieldNames(entry)).toEqual([
      'status',
      'status.statusStr',
      'status.messages',
      'status.messages[].type',
      'outputs',
      'outputs.15',
      'outputs.15.images',
      'outputs.15.images[].filename',
    ])
  })
})

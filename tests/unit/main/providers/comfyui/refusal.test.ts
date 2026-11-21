import { describe, it, expect } from 'vitest'
import { createComfyClient } from '../../../../../src/main/providers/comfyui/client'
import { MAX_SERVER_TEXT_CHARS } from '../../../../../src/main/providers/comfyui/limits'
import { ComfyRefused } from '../../../../../src/main/providers/comfyui/refusal'
import { ProviderFailure } from '../../../../../src/main/providers/types'
import { startComfyStandIn, type Reply } from '../../../../helpers/comfy-stand-in'

const id = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b'
const marker = 'MADE-UP-MARKER'

async function refusedWith(reply: Reply): Promise<ComfyRefused> {
  const standIn = await startComfyStandIn()
  try {
    standIn.reply('POST /prompt', reply)
    const client = createComfyClient({ origin: standIn.origin, ownPorts: () => [9100] })
    const error: unknown = await client.submit(id, {}).then(
      () => undefined,
      (e: unknown) => e,
    )
    if (!(error instanceof ComfyRefused)) throw new Error('Expected a ComfyRefused')
    return error
  } finally {
    await standIn.close()
  }
}

const answer = {
  error: {
    type: 'prompt_outputs_failed_validation',
    message: 'Prompt outputs failed validation',
    details: 'two nodes',
    extra_info: { traceback: [marker] },
  },
  node_errors: {
    3: {
      errors: [
        {
          type: 'value_not_in_list',
          message: 'Value not in list',
          details: 'ckpt_name',
          extra_info: { input_name: 'ckpt_name', received_value: marker, input_config: [marker] },
        },
      ],
      dependent_outputs: [marker],
      class_type: marker,
    },
    7: { errors: [{ type: 'required_input_missing', message: 'Required input is missing' }] },
  },
}

describe('a 400 from POST /prompt is a ComfyRefused [SPEC 14 1.43 K-1, R2-1, R2-3]', () => {
  it('keeps the error as built and hands on the message, the node IDs and an input name', async () => {
    const refused = await refusedWith({ status: 400, json: answer })
    expect(refused).toBeInstanceOf(ProviderFailure)
    expect(refused.error).toEqual({ kind: 'other', reason: 'server_refused', detail: 'HTTP 400' })
    expect(refused.refusal).toEqual({
      type: 'prompt_outputs_failed_validation',
      message: 'Prompt outputs failed validation',
      details: 'two nodes',
      nodes: [
        {
          nodeId: '3',
          errors: [
            {
              type: 'value_not_in_list',
              message: 'Value not in list',
              details: 'ckpt_name',
              inputName: 'ckpt_name',
            },
          ],
        },
        {
          nodeId: '7',
          errors: [{ type: 'required_input_missing', message: 'Required input is missing' }],
        },
      ],
    })
  })

  it('carries no traceback, received value, input config, outputs or class_type', async () => {
    const refused = await refusedWith({ status: 400, json: answer })
    expect(JSON.stringify(refused)).not.toContain(marker)
    expect(JSON.stringify(refused.refusal)).not.toContain(marker)
  })

  it('cuts a message over MAX_SERVER_TEXT_CHARS to it', async () => {
    const long = 'm'.repeat(MAX_SERVER_TEXT_CHARS + 10)
    const refused = await refusedWith({ status: 400, json: { error: { message: long } } })
    expect(refused.refusal.message).toBe(long.slice(0, MAX_SERVER_TEXT_CHARS))
  })

  it.each<[string, Reply]>([
    ['a body that is not JSON', { status: 400, body: '<html>no</html>' }],
    ['node_errors that is a number', { status: 400, json: { node_errors: 5 } }],
    ['a body over 8 MiB', { status: 400, body: 'x'.repeat(8 * 1024 * 1024 + 1) }],
    [
      'a body over 8 MiB with no length',
      { status: 400, body: 'x'.repeat(8 * 1024 * 1024 + 1), length: false },
    ],
  ])('%s is still server_refused, with nodes: []', async (_name, reply) => {
    const refused = await refusedWith(reply)
    expect(refused.error).toEqual({ kind: 'other', reason: 'server_refused', detail: 'HTTP 400' })
    expect(refused.refusal).toEqual({ nodes: [] })
  })
})

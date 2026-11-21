// SPEC 6.10.12, 14 1.41 CU-5a, 1.45, 1.46: the cases of `npm run test:comfy`, run against the
// project's ComfyUI test server, the stakeholder's own machine. Each case talks to the server
// through createComfyClient only, wrapped in the recorder, and ends by asserting it made only
// the calls it meant to. Nothing here can clear, delete or interrupt anyone else's work: the
// client has no such call. Every line printed and every error goes through the address guard.
import { describe, it, expect } from 'vitest'
import { createComfyClient } from '../../src/main/providers/comfyui/client'
import { runCheckCase } from './check-case'
import { guarded } from './guard'
import { makePrinter } from './print'
import { recordCalls, unexpectedCalls } from './recorder'
import { comfyTarget, TEST_OWN_PORTS } from './target'

const target = comfyTarget(process.env)
const origin = 'origin' in target ? target.origin : ''
if ('skip' in target) process.stdout.write(`${target.skip}\n`)

const CHECK_MS = 5 * 60_000

function connect() {
  return recordCalls(createComfyClient({ origin, ownPorts: () => TEST_OWN_PORTS }))
}

// Cases in one file run one after another, in this order (1.46: the check, the reference
// picture, the video, the MOSS picture).
describe.skipIf(origin === '')('test:comfy on the test server', () => {
  const print = makePrinter(origin)

  it(
    '1. the check: the version, and per trial workflow what is missing',
    () =>
      guarded(origin, async () => {
        const recorded = connect()
        const result = await runCheckCase(recorded.client, recorded.failures, print)
        expect(unexpectedCalls(recorded.calls, ['systemStats', 'modelFiles', 'nodeInfo'])).toEqual(
          [],
        )
        expect(result.outcome).toBe('ok')
      }),
    CHECK_MS,
  )
})

// SPEC 6.10.12, 14 1.41 CU-5a, 1.45, 1.46: the cases of `npm run test:comfy`, run against the
// project's ComfyUI test server, the stakeholder's own machine. Each case talks to the server
// through createComfyClient only, wrapped in the recorder, and ends by asserting it made only
// the calls it meant to. Nothing here can clear, delete or interrupt anyone else's work: the
// client has no such call. Every line printed and every error goes through the address guard.
import os from 'node:os'
import { describe, it, expect, type TestContext } from 'vitest'
import { createComfyClient } from '../../src/main/providers/comfyui/client'
import { pictureCase, referenceCase, videoCase, type CaseKit, type CaseOutcome } from './cases'
import { runCheckCase } from './check-case'
import { guarded } from './guard'
import { makePrinter } from './print'
import { foreignCancels, recordCalls, unexpectedCalls, type CallName } from './recorder'
import { PICTURE_LIMIT_MS, realTiming, VIDEO_LIMIT_MS } from './run-graph'
import { comfyTarget, TEST_OWN_PORTS } from './target'

const target = comfyTarget(process.env)
const origin = 'origin' in target ? target.origin : ''
if ('skip' in target) process.stdout.write(`${target.skip}\n`)

const CHECK_MS = 5 * 60_000
// The case's own wait, plus room for the check and the download.
const SPARE_MS = 10 * 60_000
const CHECK_CALLS: CallName[] = ['systemStats', 'modelFiles', 'nodeInfo']
const RUN_CALLS: CallName[] = [
  ...CHECK_CALLS,
  'submit',
  'history',
  'jobState',
  'queueIds',
  'viewFile',
  // Only when the case runs out of time, and only for its own ID (foreignCancels).
  'removeFromQueue',
  'interrupt',
]

function connect() {
  return recordCalls(createComfyClient({ origin, ownPorts: () => TEST_OWN_PORTS }))
}

const fieldNames = { shown: false }

// One run case: its own client and recorder, the calls it may make, and a skip with one line.
function runCase(
  run: (kit: CaseKit) => Promise<CaseOutcome>,
  limitMs: number,
  extra: CallName[] = [],
) {
  return async (ctx: TestContext) => {
    const print = makePrinter(origin)
    const outcome = await guarded(origin, async () => {
      const recorded = connect()
      const timing = realTiming(limitMs)
      const kit = { client: recorded.client, print, timing, outDir: os.tmpdir(), env: process.env }
      const done = await run({ ...kit, fieldNames })
      expect(unexpectedCalls(recorded.calls, [...RUN_CALLS, ...extra])).toEqual([])
      expect(foreignCancels(recorded.calls)).toEqual([])
      expect(recorded.calls.filter((c) => c.name === 'uploadImage').length).toBeLessThanOrEqual(1)
      return done
    })
    // Outside the guard: Vitest's skip works by throwing.
    if ('skip' in outcome) {
      print(outcome.skip)
      ctx.skip(outcome.skip)
    }
  }
}

// The order of 1.46: the check, the reference picture, the video, the MOSS picture.
describe.skipIf(origin === '')('test:comfy on the test server', () => {
  it(
    '1. the check: the version, and per trial workflow what is missing',
    () =>
      guarded(origin, async () => {
        const recorded = connect()
        const result = await runCheckCase(recorded.client, recorded.failures, makePrinter(origin))
        expect(unexpectedCalls(recorded.calls, CHECK_CALLS)).toEqual([])
        expect(result.outcome).toBe('ok')
      }),
    CHECK_MS,
  )

  it(
    "5. Flux 3 klein: a picture from the test's own reference picture",
    runCase(referenceCase, PICTURE_LIMIT_MS, ['uploadImage']),
    PICTURE_LIMIT_MS + SPARE_MS,
  )

  it(
    '2. MiniMax H3: a video from a prompt (only with ADMAN_COMFY_VIDEO=1)',
    runCase(videoCase, VIDEO_LIMIT_MS),
    VIDEO_LIMIT_MS + SPARE_MS,
  )

  it(
    '3. MOSS-Image: a picture from a prompt',
    runCase(pictureCase, PICTURE_LIMIT_MS),
    PICTURE_LIMIT_MS + SPARE_MS,
  )
})

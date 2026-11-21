// SPEC 6.10.12, 14 1.41 CU-5a, 1.45, 1.46: the cases of `npm run test:comfy`, run against the
// project's ComfyUI test server, the stakeholder's own machine. Each case talks to the server
// through createComfyClient only, wrapped in the recorder, and ends by asserting it made only
// the calls it meant to. Nothing here can clear, delete or interrupt anyone else's work: the
// client has no such call. Every line printed and every error goes through the address guard.
import os from 'node:os'
import { describe, it, expect, type TestContext } from 'vitest'
import { createComfyClient } from '../../src/main/providers/comfyui/client'
import {
  firstFrameCase,
  pictureCase,
  referenceCase,
  videoCase,
  type CaseKit,
  type CaseOutcome,
} from './cases'
import { runCheckCase } from './check-case'
import { guarded } from './guard'
import { makePrinter } from './print'
import { withCallCheck } from './call-check'
import { recordCalls, type CallName } from './recorder'
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
  // Only when the case runs out of time, and only for its own ID (callProblems).
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
    const outcome = await guarded(origin, () => {
      const recorded = connect()
      const timing = realTiming(limitMs)
      const kit = { client: recorded.client, print, timing, outDir: os.tmpdir(), env: process.env }
      // The calls are checked and printed whether the case passes or fails.
      return withCallCheck(recorded.calls, [...RUN_CALLS, ...extra], print, () =>
        run({ ...kit, fieldNames }),
      )
    })
    // Outside the guard: Vitest's skip works by throwing.
    if ('skip' in outcome) {
      print(outcome.skip)
      ctx.skip(outcome.skip)
    }
  }
}

// The order of 1.46: the check, the reference picture, the video, the MOSS picture; case 6, the
// video from a first frame, comes after case 2 (1.54 P-4).
describe.skipIf(origin === '')('test:comfy on the test server', () => {
  it(
    '1. the check: the version, and per trial workflow what is missing',
    () =>
      guarded(origin, () => {
        const recorded = connect()
        const print = makePrinter(origin)
        return withCallCheck(recorded.calls, CHECK_CALLS, print, async () => {
          const result = await runCheckCase(recorded.client, recorded.failures, print)
          expect(result.outcome).toBe('ok')
        })
      }),
    CHECK_MS,
  )

  it(
    '5. Flux 3 klein: a picture from a reference picture (only with ADMAN_COMFY_FLUX=1)',
    runCase(referenceCase, PICTURE_LIMIT_MS, ['uploadImage']),
    PICTURE_LIMIT_MS + SPARE_MS,
  )

  it(
    '2. MiniMax H3: a video from a prompt (only with ADMAN_COMFY_VIDEO=1)',
    runCase(videoCase, VIDEO_LIMIT_MS),
    VIDEO_LIMIT_MS + SPARE_MS,
  )

  it(
    '6. MiniMax H3: a video from a first frame (only with ADMAN_COMFY_FRAME=1)',
    runCase(firstFrameCase, VIDEO_LIMIT_MS, ['uploadImage']),
    VIDEO_LIMIT_MS + SPARE_MS,
  )

  it(
    '3. MOSS-Image: a picture from a prompt (only with ADMAN_COMFY_MOSS=1)',
    runCase(pictureCase, PICTURE_LIMIT_MS),
    PICTURE_LIMIT_MS + SPARE_MS,
  )
})

// phase-07 P7-24, exit criterion 6 (D-085, D-089): one real fal.ai Seedance run with the
// developer's own key. One still in, one MP4 of 4 s out, through the adapter. Run by hand only,
// once; never part of `npm test` or CI. Paid: exactly one submit, no retry.
// To run this case alone:
//   npm run test:live -- tests/live/seedance.live.test.ts
// The still is made here in code (shape-picture.ts), a magenta circle on white, so it holds no
// user file, brand or person. The adapter always asks for 720p; for this test only, the fetch
// it is given rewrites the one submit body to `resolution: '480p'`, the lowest cost. The clip
// is written into a new temporary folder (prefix `adman-seedance-live-`). Prints the endpoint
// path, the length, pixel size and sound of the clip, its byte count and the time taken; never
// the key, a header, a full address, a request ID or the clip's bytes. Every printed line, and
// the error thrown on a failure, has the live key values removed.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { falVideo } from '@/main/providers/fal-seedance/video'
import { listProviders } from '@/main/providers/registry'
import { checkMp4 } from '@/main/providers/video-check'
import { ProviderFailure, type AdapterContext, type VideoResult } from '@/main/providers/types'
import type { Settings } from '@/shared/schemas/settings'
import { livePrint, missingNames, safely } from './live-output'
import { circlePng } from './shape-picture'

const key = process.env.FAL_KEY
const SOURCE_SIDE = 512
const DURATION_MS = 4_000
const SIZE = { width: 1080, height: 1080 }
const RESOLUTION = '480p'
const PROMPT = 'The magenta circle slowly rolls to the right across the white floor.'
const POLL_MS = 5_000
// The adapter ends a run after 15 minutes; the test waits a little longer than that.
const TEST_MS = 17 * 60_000

const missingVariables = missingNames(['FAL_KEY'])
if (missingVariables.length > 0) {
  process.stdout.write(`fal Seedance live test skipped: not set: ${missingVariables.join(', ')}\n`)
}

function liveContext(apiKey: string): AdapterContext {
  const fal = listProviders({}).find((p) => p.id === 'fal-seedance')
  return {
    secret: () => apiKey,
    settings: () => ({}) as Settings,
    model(job) {
      const model = fal?.defaultModels[job]
      if (!model) throw new Error(`No default model for fal-seedance ${job}`)
      return model
    },
  }
}

// The real fetch, with the one submit body set to 480p. A second POST is refused before it is
// sent, so the test can never pay twice.
function lowCostFetch(): typeof fetch {
  let posts = 0
  return (input, init) => {
    if (init?.method !== 'POST') return fetch(input, init)
    posts += 1
    if (posts > 1) throw new Error('A second fal.ai submit was refused by the live test')
    if (typeof init.body !== 'string') throw new Error('The fal.ai submit body is not JSON text')
    const body = { ...JSON.parse(init.body), resolution: RESOLUTION }
    return fetch(input, { ...init, body: JSON.stringify(body) })
  }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// One submit, status checks until the run ends, then the one result. A failed run throws its
// ProviderFailure, so `safely` prints its kind and detail, made safe.
function runOnce(apiKey: string): Promise<VideoResult> {
  return safely('fal', async () => {
    const video = falVideo(liveContext(apiKey), { fetch: lowCostFetch() })
    const { remoteJobId } = await video.start({
      image: { bytes: circlePng(SOURCE_SIDE), mime: 'image/png' },
      references: [],
      prompt: PROMPT,
      durationMs: DURATION_MS,
      ...SIZE,
    })
    for (;;) {
      const state = await video.check(remoteJobId)
      if (state.status === 'succeeded') return video.fetchResult(remoteJobId)
      if (state.status === 'failed' || state.status === 'cancelled') {
        throw new ProviderFailure(
          state.error ?? { kind: 'other', detail: `The run ended as ${state.status}` },
        )
      }
      await wait(POLL_MS)
    }
  })
}

describe.skipIf(!key)('fal Seedance video, live [P7-24]', () => {
  it('turns one still into one MP4 of 4 seconds at 480p', { timeout: TEST_MS }, async () => {
    const began = Date.now()
    const result = await runOnce(key ?? '')
    const seconds = ((Date.now() - began) / 1000).toFixed(1)
    const details = checkMp4(result.bytes)
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-seedance-live-'))
    fs.writeFileSync(path.join(folder, 'seedance.mp4'), result.bytes)
    livePrint([
      `Still sent: image/png, ${SOURCE_SIDE} x ${SOURCE_SIDE}`,
      `Asked for: ${DURATION_MS / 1000} s, ${RESOLUTION}, ${SIZE.width} x ${SIZE.height} shape`,
      `fal endpoint path: ${result.model}`,
      `fal clip length: ${details.durationMs} ms`,
      `fal clip pixel size: ${details.width} x ${details.height}`,
      `fal clip hasSound: ${details.hasSound}`,
      `fal clip bytes: ${result.bytes.byteLength}`,
      `fal clip file: seedance.mp4 in a new adman-seedance-live- temporary folder`,
      `Time taken: ${seconds} s`,
    ])
    expect(result.mime).toBe('video/mp4')
    expect(details.durationMs).toBeGreaterThan(0)
  })
})

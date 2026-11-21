import { describe, it, expect, afterEach } from 'vitest'
import { adapters } from '../../../../../src/main/providers/fake'
import {
  resetFakeBehaviour,
  setFakeBehaviour,
} from '../../../../../src/main/providers/fake/behaviour'
import type { AdapterContext } from '../../../../../src/main/providers/types'
import { checkMp4 } from '../../../../../src/main/providers/video-check'

const ctx = {} as AdapterContext
const input = {
  image: null,
  references: [],
  prompt: 'waves',
  durationMs: 4_000,
  width: 64,
  height: 64,
}
const video = () => {
  const build = adapters.video
  if (!build) throw new Error('fake has no video part')
  return build(ctx)
}
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms))

afterEach(() => resetFakeBehaviour())

describe('fake provider, video [SPEC 14 slice D, 6.11.1]', () => {
  it('starts, reports success after its wait, and gives an MP4', async () => {
    setFakeBehaviour({ waitMs: 30 })
    const v = video()
    const { remoteJobId } = await v.start(input)
    expect((await v.check(remoteJobId)).status).toBe('running')
    await pause(40)
    expect((await v.check(remoteJobId)).status).toBe('succeeded')
    const result = await v.fetchResult(remoteJobId)
    expect(result.mime).toBe('video/mp4')
    expect(new TextDecoder().decode(result.bytes.slice(4, 8))).toBe('ftyp')
  })

  it('reports the failure kind it was told to', async () => {
    setFakeBehaviour({ fail: 'quota' })
    const v = video()
    const { remoteJobId } = await v.start(input)
    const checked = await v.check(remoteJobId)
    expect(checked.status).toBe('failed')
    expect(checked.error?.kind).toBe('quota')
  })

  it.each([
    ['stop', 'stopped', 'cancelled'],
    ['finish', 'finished', 'succeeded'],
    ['no_confirm', 'unknown', 'running'],
  ] as const)('cancel told to %s gives %s', async (onCancel, outcome, status) => {
    setFakeBehaviour({ waitMs: 5_000, onCancel })
    const v = video()
    const { remoteJobId } = await v.start(input)
    expect(await v.cancel(remoteJobId)).toBe(outcome)
    expect((await v.check(remoteJobId)).status).toBe(status)
  })

  it('does not know an ID it did not give', async () => {
    await expect(video().check('someone-else')).rejects.toThrow()
  })
})

describe('fake provider, video file [SPEC 14 CU-6a, 6.10.7]', () => {
  it('gives an MP4 that checkMp4 accepts, so the video job kind can store it', async () => {
    const v = video()
    const { remoteJobId } = await v.start(input)
    const { bytes } = await v.fetchResult(remoteJobId)
    expect(checkMp4(bytes)).toMatchObject({ hasSound: false })
  })
})

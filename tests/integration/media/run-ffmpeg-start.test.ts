// P8-17, from the review of video export: a start that throws at once (here an argument holding
// a NUL byte, which spawn refuses before any process exists) gives null, and the runner's queue
// keeps working for the runs after it.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { createFfmpegRunner } from '@/main/media/run-ffmpeg'
import { writeStandIn } from './stand-in'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-runstart-'))
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }))

describe.skipIf(process.platform === 'win32')('runFfmpeg when the start throws [P8-17]', () => {
  it('gives null, and a later run still starts and finishes', async () => {
    const binary = writeStandIn(dir, 'process.exit(0)')
    const runner = createFfmpegRunner({ binary })
    const folder = fs.mkdtempSync(path.join(dir, 'cwd-'))
    const [broken, later] = await Promise.allSettled([
      runner.run(['bad\0argument'], folder),
      runner.run([], folder),
    ])
    expect(broken).toEqual({ status: 'fulfilled', value: null })
    expect(later).toEqual({ status: 'fulfilled', value: 'done' })
    expect(await runner.run([], folder)).toBe('done')
  })
})

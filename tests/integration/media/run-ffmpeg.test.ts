import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { createFfmpegRunner } from '@/main/media/run-ffmpeg'
import { writeStandIn } from './stand-in'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-runffmpeg-'))
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }))
afterEach(() => vi.restoreAllMocks())

function cwd(): string {
  return fs.mkdtempSync(path.join(dir, 'cwd-'))
}

describe.skipIf(process.platform === 'win32')(
  'runFfmpeg (phase-07.md, "How FFmpeg is run")',
  () => {
    it('gives done on a clean exit, in the run folder it was given', async () => {
      const binary = writeStandIn(
        dir,
        "require('fs').writeFileSync('out.txt', process.argv.slice(2).join('|'))",
      )
      const folder = cwd()
      const result = await createFfmpegRunner({ binary }).run(['-a', 'b c'], folder)
      expect(result).toBe('done')
      expect(fs.readFileSync(path.join(folder, 'out.txt'), 'utf8')).toBe('-a|b c')
    })

    it('gives null on a non-zero exit', async () => {
      const binary = writeStandIn(dir, 'process.exit(3)')
      expect(await createFfmpegRunner({ binary }).run([], cwd())).toBeNull()
    })

    it('kills a run that goes over the time limit', async () => {
      const binary = writeStandIn(dir, 'setTimeout(() => {}, 30000)')
      const started = Date.now()
      const result = await createFfmpegRunner({ binary, timeoutMs: 300 }).run([], cwd())
      expect(result).toBeNull()
      expect(Date.now() - started).toBeLessThan(10_000)
    })

    it('reads a large standard error without stalling and passes none of it on', async () => {
      const binary = writeStandIn(
        dir,
        "process.stderr.write('SECRET-PATH /Users/someone '.repeat(80000), () => process.exit(1))",
      )
      const out = vi.spyOn(process.stdout, 'write')
      const err = vi.spyOn(process.stderr, 'write')
      const logged = vi.spyOn(console, 'error')
      expect(await createFfmpegRunner({ binary }).run([], cwd())).toBeNull()
      const seen = [...out.mock.calls, ...err.mock.calls, ...logged.mock.calls].flat().join('')
      expect(seen).not.toContain('SECRET-PATH')
    })

    it('gives the program an empty environment', async () => {
      const binary = writeStandIn(
        dir,
        "require('fs').writeFileSync('env.json', JSON.stringify(process.env))",
      )
      const folder = cwd()
      process.env.ADMAN_TEST_SECRET = 'do-not-pass'
      try {
        expect(await createFfmpegRunner({ binary }).run([], folder)).toBe('done')
      } finally {
        delete process.env.ADMAN_TEST_SECRET
      }
      const seen = JSON.parse(fs.readFileSync(path.join(folder, 'env.json'), 'utf8'))
      // macOS itself sets this one key inside every new process; nothing else may be there.
      delete seen.__CF_USER_TEXT_ENCODING
      expect(seen).toEqual({})
    })

    it('runs one program at a time', async () => {
      const marks = path.join(dir, 'marks.txt')
      const binary = writeStandIn(
        dir,
        `const fs = require('fs')
fs.appendFileSync(${JSON.stringify(marks)}, 'start ')
setTimeout(() => fs.appendFileSync(${JSON.stringify(marks)}, 'end '), 200)`,
      )
      const runner = createFfmpegRunner({ binary })
      const results = await Promise.all([runner.run([], cwd()), runner.run([], cwd())])
      expect(results).toEqual(['done', 'done'])
      expect(fs.readFileSync(marks, 'utf8')).toBe('start end start end ')
    })

    it('gives null without running when the binary is a link', async () => {
      const target = writeStandIn(dir, "require('fs').writeFileSync('ran.txt', 'x')")
      const link = path.join(dir, 'ffmpeg-link')
      fs.symlinkSync(target, link)
      const folder = cwd()
      expect(await createFfmpegRunner({ binary: link }).run([], folder)).toBeNull()
      expect(fs.existsSync(path.join(folder, 'ran.txt'))).toBe(false)
    })

    it('gives null when the binary cannot be started', async () => {
      const binary = path.join(dir, 'no-exec')
      fs.writeFileSync(binary, 'not a program', { mode: 0o644 })
      expect(await createFfmpegRunner({ binary }).run([], cwd())).toBeNull()
    })
  },
)

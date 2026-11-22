import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'

type Verdict = { ok: true } | { ok: false; reason: string }
type RunResult = { code: number; stdout: string }
type Run = (command: string, args: string[], options?: object) => Promise<RunResult>
type LicenceModule = {
  judgeLicence: (licenceText: string, buildconfText: string) => Verdict
  licenceCheck: (binary: string, runImpl?: Run) => Promise<Verdict>
}

const modulePath = path.resolve('scripts/ffmpeg/licence-check.mjs')
const { judgeLicence, licenceCheck } = (await import(
  /* @vite-ignore */ modulePath
)) as LicenceModule

const lgpl = `ffmpeg is free software; you can redistribute it and/or
modify it under the terms of the GNU Lesser General Public
License as published by the Free Software Foundation; either
version 2.1 of the License, or (at your option) any later version.

You should have received a copy of the GNU Lesser General Public
License along with ffmpeg; if not, write to the Free Software
Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA`

const gpl = `ffmpeg is free software; you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation; either version 2 of the License, or
(at your option) any later version.`

const nonfree = `This version of ffmpeg has nonfree parts compiled in.
Therefore it is not legally redistributable.`

const lgplConf = `  configuration:
    --disable-everything
    --disable-gpl
    --disable-nonfree
    --enable-videotoolbox`

describe('the FFmpeg licence check [P7-3, phase-07 "Where FFmpeg comes from"]', () => {
  it('passes an LGPL build without GPL or non-free flags', () => {
    expect(judgeLicence(lgpl, lgplConf)).toEqual({ ok: true })
  })

  it.each([
    ['a GPL licence text', gpl, lgplConf],
    ['a non-free notice', `${nonfree}\n${lgpl}`, lgplConf],
    ['a GPL text next to the LGPL one', `${lgpl}\n${gpl}`, lgplConf],
    ['an empty licence text', '', lgplConf],
    ['--enable-gpl in the build flags', lgpl, `${lgplConf}\n    --enable-gpl`],
    ['--enable-nonfree in the build flags', lgpl, `${lgplConf}\n    --enable-nonfree`],
    ['flags on one line with --enable-gpl', lgpl, '  configuration: --enable-gpl --enable-x'],
    ['an empty build flag text', lgpl, ''],
  ])('fails %s', (_name, licenceText, buildconfText) => {
    expect(judgeLicence(licenceText, buildconfText).ok).toBe(false)
  })
})

describe('licenceCheck runs the binary and deletes one that fails [P7-3]', () => {
  let folder = ''
  afterEach(() => {
    if (folder) fs.rmSync(folder, { recursive: true, force: true })
  })

  function standIn(): string {
    folder = fs.mkdtempSync(path.join(os.tmpdir(), 'licence-'))
    const binary = path.join(folder, 'ffmpeg')
    fs.writeFileSync(binary, 'not a program')
    return binary
  }

  function runAnswering(licenceText: string, conf: string, calls: string[][]): Run {
    return async (command, args) => {
      calls.push([command, ...args])
      return { code: 0, stdout: args.includes('-L') ? licenceText : conf }
    }
  }

  it('keeps an LGPL binary and runs it by its own path with -hide_banner', async () => {
    const binary = standIn()
    const calls: string[][] = []
    expect(await licenceCheck(binary, runAnswering(lgpl, lgplConf, calls))).toEqual({ ok: true })
    expect(fs.existsSync(binary)).toBe(true)
    expect(calls).toEqual([
      [binary, '-hide_banner', '-L'],
      [binary, '-hide_banner', '-buildconf'],
    ])
  })

  it.each([
    ['a GPL binary', gpl, lgplConf],
    ['a non-free build', lgpl, `${lgplConf}\n    --enable-nonfree`],
  ])('deletes %s', async (_name, licenceText, conf) => {
    const binary = standIn()
    const verdict = await licenceCheck(binary, runAnswering(licenceText, conf, []))
    expect(verdict.ok).toBe(false)
    expect(fs.existsSync(binary)).toBe(false)
  })

  it('deletes a binary that does not answer', async () => {
    const binary = standIn()
    const failing: Run = async () => ({ code: 1, stdout: '' })
    expect((await licenceCheck(binary, failing)).ok).toBe(false)
    expect(fs.existsSync(binary)).toBe(false)
  })

  it('deletes a binary whose run throws', async () => {
    const binary = standIn()
    const throwing: Run = async () => {
      throw new Error('spawn failed')
    }
    expect((await licenceCheck(binary, throwing)).ok).toBe(false)
    expect(fs.existsSync(binary)).toBe(false)
  })
})
